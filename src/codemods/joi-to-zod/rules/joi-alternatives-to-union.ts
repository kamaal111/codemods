import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const ARGS_META_IDENTIFIER = 'ARGS';

async function joiAlternativesToUnion(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) return modifications;

  const tryPrefix = `${joiImportIdentifierName}.alternatives().try(`;
  const alternativeTries = root.findAll({
    rule: { pattern: `${joiImportIdentifierName}.alternatives().try($$$${ARGS_META_IDENTIFIER})` },
  });
  const edits = compactMap(alternativeTries, node => {
    const text = node.text();
    if (!text.startsWith(tryPrefix) || !text.endsWith(')')) return null;

    const argsText = text.slice(tryPrefix.length, -1);

    return node.replace(`${joiImportIdentifierName}.union([${argsText}])`);
  });

  return commitEditModifications(edits, modifications);
}

export default joiAlternativesToUnion;
