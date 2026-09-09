import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const KEY_META_IDENTIFIER = 'KEY';
const VALUE_META_IDENTIFIER = 'VALUE';

async function joiObjectPatternToRecord(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) {
    return modifications;
  }

  const patternRule = `${joiImportIdentifierName}.object().pattern($${KEY_META_IDENTIFIER}, $${VALUE_META_IDENTIFIER})`;

  const edits = compactMap(root.findAll({ rule: { pattern: patternRule } }), node => {
    const keyNode = node.getMatch(KEY_META_IDENTIFIER);
    const valueNode = node.getMatch(VALUE_META_IDENTIFIER);
    if (keyNode == null || valueNode == null) {
      return undefined;
    }

    const keyText = keyNode.text();
    const valueText = valueNode.text();

    const finalKeyText = keyText.startsWith('/') ? `${joiImportIdentifierName}.string().regex(${keyText})` : keyText;

    return node.replace(`${joiImportIdentifierName}.record(${finalKeyText}, ${valueText})`);
  });

  return commitEditModifications(edits, modifications);
}

export default joiObjectPatternToRecord;
