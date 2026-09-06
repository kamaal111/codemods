import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import scanCallArguments from '../../utils/scan-call-arguments.ts';
import splitArguments from '../../utils/split-arguments.ts';
import traverseUp from '../../utils/traverse-up.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import { buildValueAccessor, referenceToAccessor } from '../utils/object-path-accessor.ts';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

const UNSUPPORTED_OPTIONS = new Set(['switch', 'not', 'break']);

const LITERAL_PATTERN = /^(['"].*['"]|-?\d+(\.\d+)?|true|false|null)$/s;

type WhenOptions = { is?: string; then?: string; otherwise?: string; unsupported: boolean };

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
    if (key === 'is' || key === 'then' || key === 'otherwise') options[key] = valueNode.text();
  });

  return options;
}

function buildCondition(reference: string, is: string | undefined, joiIdentifierName: string): string | undefined {
  const referenceAccessor = referenceToAccessor(reference);
  if (referenceAccessor == null) return undefined;
  if (is == null) return `${referenceAccessor} !== undefined`;

  const trimmedIs = is.trim();
  if (LITERAL_PATTERN.test(trimmedIs)) return `${referenceAccessor} === ${trimmedIs}`;

  const isReferenceAccessor = referenceToAccessor(trimmedIs);
  if (isReferenceAccessor != null) return `${referenceAccessor} === ${isReferenceAccessor}`;
  if (!trimmedIs.startsWith(joiIdentifierName)) return undefined;

  const requiredMatch = scanCallArguments(trimmedIs, 'required');
  const isRequired = requiredMatch != null && requiredMatch.args.trim().length === 0;
  const schema =
    requiredMatch == null
      ? trimmedIs
      : trimmedIs.slice(0, requiredMatch.startIndex) + trimmedIs.slice(requiredMatch.endIndex);
  const parses = `${schema}.safeParse(${referenceAccessor}).success`;

  return isRequired
    ? `(${referenceAccessor} !== undefined && ${parses})`
    : `(${referenceAccessor} === undefined || ${parses})`;
}

function buildBranchPredicate(
  branch: string,
  fieldAccessor: string,
  joiIdentifierName: string,
): { predicate: string | undefined; description: string } | undefined {
  const trimmed = branch.trim();
  if (trimmed === `${joiIdentifierName}.optional()`) return { predicate: undefined, description: 'optional' };
  if (trimmed === `${joiIdentifierName}.required()`) {
    return { predicate: `${fieldAccessor} !== undefined`, description: 'required' };
  }
  if (trimmed === `${joiIdentifierName}.forbidden()`) {
    return { predicate: `${fieldAccessor} === undefined`, description: 'forbidden' };
  }
  if (!trimmed.startsWith(joiIdentifierName)) return undefined;

  const requiredMatch = scanCallArguments(trimmed, 'required');
  const isRequired = requiredMatch != null && requiredMatch.args.trim().length === 0;
  const schema =
    requiredMatch == null
      ? trimmed
      : trimmed.slice(0, requiredMatch.startIndex) + trimmed.slice(requiredMatch.endIndex);
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

function planConversion(whenCall: JoiNode, joiIdentifierName: string): WhenConversion | undefined {
  const whenArgs = scanCallArguments(whenCall.text(), 'when');
  if (whenArgs == null) return undefined;

  const [reference] = splitArguments(whenArgs.args).map(argument => argument.trim());
  if (reference == null) return undefined;

  const optionsNode = whenCall
    .children()
    .find(child => child.kind() === 'arguments')
    ?.children()
    .find(child => child.kind() === 'object');
  if (optionsNode == null) return undefined;

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
  if (!objectText.startsWith(joiIdentifierName)) return undefined;

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

  const whenStart = whenCall.range().start.index - objectChain.range().start.index + whenArgs.startIndex;
  const whenEnd = whenCall.range().start.index - objectChain.range().start.index + whenArgs.endIndex;
  const withoutWhen = objectText.slice(0, whenStart) + objectText.slice(whenEnd);

  return { objectChain, objectText, replacement: withoutWhen + refinements.join('') };
}

async function joiWhenToRefine(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiIdentifierName = getJoiIdentifierName(root);
  if (joiIdentifierName == null) return modifications;

  const whenCalls = root
    .findAll({ rule: { kind: 'call_expression' } })
    .filter(node => scanCallArguments(node.text(), 'when') != null && node.text().startsWith(joiIdentifierName));

  for (const whenCall of whenCalls) {
    const conversion = planConversion(whenCall, joiIdentifierName);
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
