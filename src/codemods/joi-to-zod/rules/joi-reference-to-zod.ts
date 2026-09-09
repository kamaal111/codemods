import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiReferenceToZod(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) {
    return modifications;
  }

  const edits = compactMap(root.findAll({ rule: { pattern: `${joiImportIdentifierName}.` } }), node => {
    return node
      .children()
      .find(child => child.text() === joiImportIdentifierName)
      ?.replace('z');
  }).flat();

  return commitEditModifications(edits, modifications);
}

export default joiReferenceToZod;
