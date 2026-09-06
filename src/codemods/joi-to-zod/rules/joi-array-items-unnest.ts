import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const ARGS_META_IDENTIFIER = 'ARGS';

async function joiArrayItemsUnnest(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  return unnestArrayItems(modifications, joiImportIdentifierName);
}

async function unnestArrayItems(modifications: Modifications, joiImportIdentifierName: string): Promise<Modifications> {
  const arrayItems = modifications.ast
    .root()
    .findAll({ rule: { pattern: `${joiImportIdentifierName}.array().items($${ARGS_META_IDENTIFIER})` } });
  const edits = compactMap(arrayItems, node => {
    const itemsSchema = node.getMatch(ARGS_META_IDENTIFIER);
    if (itemsSchema == null) return null;

    return node.replace(`${joiImportIdentifierName}.array(${itemsSchema.text()})`);
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) return modifications;

  return unnestArrayItems(updated, joiImportIdentifierName);
}

export default joiArrayItemsUnnest;
