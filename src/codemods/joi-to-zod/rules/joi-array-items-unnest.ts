import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiArrayItemsUnnest(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  return unnestArrayItems(modifications, joiImportIdentifierName);
}

async function unnestArrayItems(modifications: Modifications, joiImportIdentifierName: string): Promise<Modifications> {
  const arrayItems = modifications.ast.root().findAll({ rule: { kind: 'call_expression' } });
  const edits = compactMap(arrayItems, node => {
    const chain = getJoiCallChain(node, joiImportIdentifierName);
    const [arraySegment, itemsSegment] = chain?.segments ?? [];
    if (chain?.segments.length !== 2 || arraySegment?.name !== 'array' || itemsSegment?.name !== 'items') return null;

    const args = itemsSegment.arguments.map(argument => argument.text());
    if (args.length === 0) return node.replace(`${joiImportIdentifierName}.array()`);

    const itemSchema = args.length === 1 ? args[0] : `${joiImportIdentifierName}.union([${args.join(', ')}])`;

    return node.replace(`${joiImportIdentifierName}.array(${itemSchema})`);
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) return modifications;

  return unnestArrayItems(updated, joiImportIdentifierName);
}

export default joiArrayItemsUnnest;
