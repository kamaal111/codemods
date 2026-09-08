import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import splitArguments from '../../utils/split-arguments.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const ARGS_META_IDENTIFIER = 'ARGS';

async function joiArrayItemsUnnest(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  return unnestArrayItems(modifications, joiImportIdentifierName);
}

async function unnestArrayItems(modifications: Modifications, joiImportIdentifierName: string): Promise<Modifications> {
  const itemsPrefix = `${joiImportIdentifierName}.array().items(`;
  const arrayItems = modifications.ast
    .root()
    .findAll({ rule: { pattern: `${joiImportIdentifierName}.array().items($$$${ARGS_META_IDENTIFIER})` } });
  const edits = compactMap(arrayItems, node => {
    const text = node.text();
    if (!text.startsWith(itemsPrefix) || !text.endsWith(')')) return null;

    const args = splitArguments(text.slice(itemsPrefix.length, -1)).map(argument => argument.trim());
    const nonEmptyArgs = args.filter(argument => argument.length > 0);
    if (nonEmptyArgs.length === 0) return node.replace(`${joiImportIdentifierName}.array()`);

    const itemSchema =
      nonEmptyArgs.length === 1 ? nonEmptyArgs[0] : `${joiImportIdentifierName}.union([${nonEmptyArgs.join(', ')}])`;

    return node.replace(`${joiImportIdentifierName}.array(${itemSchema})`);
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) return modifications;

  return unnestArrayItems(updated, joiImportIdentifierName);
}

export default joiArrayItemsUnnest;
