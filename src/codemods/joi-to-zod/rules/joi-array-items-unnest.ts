import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import type { JoiCallChain, JoiCallSegment } from '../utils/get-joi-call-chain.ts';
import { getJoiCallChain, isOutermostCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

type CollectionRewrite = {
  segmentName: string;
  blockedBy?: Set<string>;
  base: (itemSchemas: Array<string>, joiName: string) => string;
};

const LENGTH_VALIDATIONS = new Set(['min', 'max', 'length']);

const COLLECTION_REWRITES: Array<CollectionRewrite> = [
  {
    segmentName: 'items',
    base: (itemSchemas, joiName) => {
      if (itemSchemas.length === 0) return `${joiName}.array()`;
      const itemSchema = itemSchemas.length === 1 ? itemSchemas[0] : `${joiName}.union([${itemSchemas.join(', ')}])`;

      return `${joiName}.array(${itemSchema})`;
    },
  },
  {
    segmentName: 'ordered',
    blockedBy: LENGTH_VALIDATIONS,
    base: (itemSchemas, joiName) => `${joiName}.tuple([${itemSchemas.join(', ')}])`,
  },
];

function rewriteCollectionBase(
  node: JoiCallChain['root'],
  chain: JoiCallChain,
  rewrite: CollectionRewrite,
  joiImportIdentifierName: string,
): string | undefined {
  const baseSegment = chain.segments[0];
  if (baseSegment?.name !== 'array' || baseSegment.arguments.length > 0) return undefined;

  const collectionSegment = chain.segments.find(
    (segment: JoiCallSegment) => segment.name === rewrite.segmentName && segment !== baseSegment,
  );
  if (collectionSegment == null) return undefined;
  if (chain.segments.some((segment: JoiCallSegment) => rewrite.blockedBy?.has(segment.name) ?? false)) return undefined;

  const offset = node.range().start.index;
  const text = node.text();
  const withoutCollection =
    text.slice(0, collectionSegment.receiver.range().end.index - offset) +
    text.slice(collectionSegment.call.range().end.index - offset);
  const itemSchemas = collectionSegment.arguments.map(argument => argument.text());

  return (
    withoutCollection.slice(0, baseSegment.call.range().start.index - offset) +
    rewrite.base(itemSchemas, joiImportIdentifierName) +
    withoutCollection.slice(baseSegment.call.range().end.index - offset)
  );
}

async function joiArrayItemsUnnest(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  return unnestArrayItems(modifications, joiImportIdentifierName);
}

async function unnestArrayItems(modifications: Modifications, joiImportIdentifierName: string): Promise<Modifications> {
  const callExpressions = modifications.ast.root().findAll({ rule: { kind: 'call_expression' } });
  const edits = compactMap(callExpressions, node => {
    if (!isOutermostCallChain(node)) return null;

    const chain = getJoiCallChain(node, joiImportIdentifierName);
    if (chain == null) return null;

    for (const rewrite of COLLECTION_REWRITES) {
      const replacement = rewriteCollectionBase(node, chain, rewrite, joiImportIdentifierName);
      if (replacement != null) return node.replace(replacement);
    }

    return null;
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) return modifications;

  return unnestArrayItems(updated, joiImportIdentifierName);
}

export default joiArrayItemsUnnest;
