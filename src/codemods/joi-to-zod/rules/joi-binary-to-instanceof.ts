import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiBinaryToInstanceof(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) {
    return modifications;
  }

  const binaries = modifications.ast.root().findAll({ rule: { pattern: `${joiImportIdentifierName}.binary()` } });
  const edits = binaries.map(node => node.replace(`${joiImportIdentifierName}.instanceof(Buffer)`));

  return commitEditModifications(edits, modifications);
}

export default joiBinaryToInstanceof;
