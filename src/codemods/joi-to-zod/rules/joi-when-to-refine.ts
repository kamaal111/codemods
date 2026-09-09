import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import traverseUp from '../../utils/traverse-up.ts';
import { getJoiCallChain, type JoiCallSegment } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import { buildValueAccessor, referenceToAccessor } from '../utils/object-path-accessor.ts';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

const UNSUPPORTED_OPTIONS = new Set(['switch', 'not', 'break']);

const LITERAL_PATTERN = /^(['"].*['"]|-?\d+(\.\d+)?|true|false|null)$/s;

type WhenOptions = { is?: JoiNode; then?: JoiNode; otherwise?: JoiNode; unsupported: boolean };

function parseWhenOptions(optionsNode: JoiNode): WhenOptions {
  const options: WhenOptions = { unsupported: false };

  optionsNode.children().forEach(child => {
    if (child.kind() !== 'pair') return;

    const key = child.child(0)?.text().replace(/['"]/g, '');
    const valueNode = child.child(2);
    if (key == null || valueNode == null) return;
    if (UNSUPPORTED_OPTIONS.has(key)) {
      options.unsupported = true;

      return;
    }
    if (key === 'is' || key === 'then' || key === 'otherwise') options[key] = valueNode;
  });

  return options;
}

function schemaPredicateDetails(
  schemaNode: JoiNode,
  joiIdentifierName: string,
): { schema: string; isRequired: boolean } | undefined {
  const chain = getJoiCallChain(schemaNode, joiIdentifierName);
  if (chain == null) return undefined;

  const required = chain.segments.at(-1);
  const isRequired = required?.name === 'required' && required.arguments.length === 0;

  return { schema: isRequired ? required.receiver.text() : schemaNode.text(), isRequired };
}

function buildCondition(reference: string, is: JoiNode | undefined, joiIdentifierName: string): string | undefined {
  const referenceAccessor = referenceToAccessor(reference);
  if (referenceAccessor == null) return undefined;
  if (is == null) return `${referenceAccessor} !== undefined`;

  const trimmedIs = is.text().trim();
  if (LITERAL_PATTERN.test(trimmedIs)) return `${referenceAccessor} === ${trimmedIs}`;

  const isReferenceAccessor = referenceToAccessor(trimmedIs);
  if (isReferenceAccessor != null) return `${referenceAccessor} === ${isReferenceAccessor}`;
  const details = schemaPredicateDetails(is, joiIdentifierName);
  if (details == null) return undefined;
  const { schema, isRequired } = details;
  const parses = `${schema}.safeParse(${referenceAccessor}).success`;

  return isRequired
    ? `(${referenceAccessor} !== undefined && ${parses})`
    : `(${referenceAccessor} === undefined || ${parses})`;
}

function buildBranchPredicate(
  branch: JoiNode,
  fieldAccessor: string,
  joiIdentifierName: string,
): { predicate: string | undefined; description: string } | undefined {
  const chain = getJoiCallChain(branch, joiIdentifierName);
  if (chain == null) return undefined;
  const segments = chain.segments;
  if (segments.length === 1 && segments[0]?.name === 'optional') {
    return { predicate: undefined, description: 'optional' };
  }
  if (segments.length === 1 && segments[0]?.name === 'required') {
    return { predicate: `${fieldAccessor} !== undefined`, description: 'required' };
  }
  if (segments.length === 1 && segments[0]?.name === 'forbidden') {
    return { predicate: `${fieldAccessor} === undefined`, description: 'forbidden' };
  }
  const details = schemaPredicateDetails(branch, joiIdentifierName);
  if (details == null) return undefined;
  const { schema, isRequired } = details;
  const parses = `${schema}.safeParse(${fieldAccessor}).success`;

  return {
    predicate: isRequired
      ? `(${fieldAccessor} !== undefined && ${parses})`
      : `(${fieldAccessor} === undefined || ${parses})`,
    description: 'valid',
  };
}

function parenthesize(expression: string): string {
  if (!expression.startsWith('(') || !expression.endsWith(')')) return `(${expression})`;

  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === '(') depth += 1;
    if (expression[index] === ')') depth -= 1;
    if (depth === 0 && index < expression.length - 1) return `(${expression})`;
  }

  return expression;
}

function buildRefinement(
  condition: string,
  negate: boolean,
  predicate: string,
  path: Array<string>,
  description: string,
): string {
  const group = parenthesize(condition);
  const guard = negate ? group : `!${group}`;
  const pathText = path.map(segment => `'${segment}'`).join(', ');
  const message = `'"${path.join('.')}" is ${description} when the "when" condition ${negate ? 'does not hold' : 'holds'}'`;

  return `.refine(value => ${guard} || ${predicate}, { message: ${message}, path: [${pathText}] })`;
}

function outermostChain(node: JoiNode): JoiNode {
  let chain = node;
  while (chain.parent()?.kind() === 'member_expression') {
    const next = chain.parent()?.parent();
    if (next?.kind() !== 'call_expression') break;

    chain = next;
  }

  return chain;
}

type WhenConversion = { objectChain: JoiNode; objectText: string; replacement: string };

function planConversion(
  whenCall: JoiNode,
  whenSegment: JoiCallSegment,
  joiIdentifierName: string,
): WhenConversion | undefined {
  const [referenceNode, optionsNode] = whenSegment.arguments;
  const reference = referenceNode?.text().trim();
  if (reference == null) return undefined;

  if (optionsNode?.kind() !== 'object') return undefined;

  const options = parseWhenOptions(optionsNode);
  if (options.unsupported) return undefined;
  if (options.then == null && options.otherwise == null) return undefined;

  const pair = traverseUp(whenCall, node => node.kind() === 'pair');
  const fieldName = pair?.child(0)?.text().replace(/['"]/g, '');
  if (pair == null || fieldName == null) return undefined;

  const objectCall = traverseUp(pair, node => node.kind() === 'call_expression');
  if (objectCall == null) return undefined;

  const objectChain = outermostChain(objectCall);
  const objectText = objectChain.text();
  if (getJoiCallChain(objectChain, joiIdentifierName) == null) return undefined;

  const condition = buildCondition(reference, options.is, joiIdentifierName);
  if (condition == null) return undefined;

  const fieldPath = [fieldName];
  const fieldAccessor = buildValueAccessor(fieldPath);
  const branches = [
    { branch: options.then, negate: false },
    { branch: options.otherwise, negate: true },
  ];

  const refinements: Array<string> = [];
  for (const { branch, negate } of branches) {
    if (branch == null) continue;

    const built = buildBranchPredicate(branch, fieldAccessor, joiIdentifierName);
    if (built == null) return undefined;
    if (built.predicate == null) continue;

    refinements.push(buildRefinement(condition, negate, built.predicate, fieldPath, built.description));
  }

  const whenStart = whenSegment.receiver.range().end.index - objectChain.range().start.index;
  const whenEnd = whenCall.range().end.index - objectChain.range().start.index;
  const withoutWhen = objectText.slice(0, whenStart) + objectText.slice(whenEnd);

  return { objectChain, objectText, replacement: withoutWhen + refinements.join('') };
}

async function joiWhenToRefine(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiIdentifierName = getJoiIdentifierName(root);
  if (joiIdentifierName == null) return modifications;

  const whenCalls = root.findAll({ rule: { kind: 'call_expression' } });

  for (const whenCall of whenCalls) {
    const whenSegment = getJoiCallChain(whenCall, joiIdentifierName)?.segments.at(-1);
    if (whenSegment?.name !== 'when' || whenSegment.call.id() !== whenCall.id()) continue;

    const conversion = planConversion(whenCall, whenSegment, joiIdentifierName);
    if (conversion == null) continue;

    const committed = await commitEditModifications(
      [conversion.objectChain.replace(conversion.replacement)],
      modifications,
    );
    if (committed.ast.root().text() === modifications.ast.root().text()) continue;

    return joiWhenToRefine(committed);
  }

  return modifications;
}

export default joiWhenToRefine;
