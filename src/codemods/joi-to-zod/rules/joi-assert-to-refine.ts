import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';
import { buildValueAccessor, parseJoiReferencePath, referenceToAccessor } from '../utils/object-path-accessor.ts';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

function buildAssertReplacement(args: Array<JoiNode>, joiIdentifierName: string): string | undefined {
  const [subjectNode, schemaNode, messageNode] = args;
  const subject = subjectNode?.text();
  const schema = schemaNode?.text();
  const message = messageNode?.text();
  if (subject == null || schema == null || schemaNode == null) return undefined;

  const subjectSegments = parseJoiReferencePath(subject);
  if (subjectSegments == null) return undefined;

  const subjectAccessor = buildValueAccessor(subjectSegments);
  const referenceAccessor = referenceToAccessor(schema);
  const predicate =
    referenceAccessor != null
      ? `${subjectAccessor} === ${referenceAccessor}`
      : `${schema}.safeParse(${subjectAccessor}).success`;
  if (referenceAccessor == null && getJoiCallChain(schemaNode, joiIdentifierName) == null) return undefined;

  const path = subjectSegments.map(segment => `'${segment}'`).join(', ');
  const options = message == null ? `{ path: [${path}] }` : `{ message: ${message}, path: [${path}] }`;

  return `refine(value => ${predicate}, ${options})`;
}

function rewriteAssertNodes(property: JoiNode, joiIdentifierName: string): string {
  const chain = getJoiCallChain(property, joiIdentifierName);
  if (chain?.segments[0]?.name !== 'object') return property.text();

  return chain.segments
    .filter(segment => segment.name === 'assert')
    .reverse()
    .reduce((accumulator, segment) => {
      const replacement = buildAssertReplacement(segment.arguments, joiIdentifierName);
      if (replacement == null) return accumulator;

      const startIndex = segment.receiver.range().end.index - property.range().start.index;
      const endIndex = segment.call.range().end.index - property.range().start.index;
      return accumulator.slice(0, startIndex) + `.${replacement}` + accumulator.slice(endIndex);
    }, property.text());
}

async function joiAssertToRefine(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: 'object' });
    const rewrites = compactMap(properties, property => {
      const propertyText = property.text();
      const replacement = rewriteAssertNodes(property, joiIdentifierName);
      if (replacement === propertyText) return null;

      return { property, replacement };
    });

    return innermostBy(rewrites, rewrite => rewrite.property).map(rewrite => {
      return rewrite.property.replace(rewrite.replacement);
    });
  });
}

export default joiAssertToRefine;
