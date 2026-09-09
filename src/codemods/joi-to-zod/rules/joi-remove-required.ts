import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import removeJoiValidationEdits from '../utils/remove-joi-validation-edits.ts';

async function joiRemoveRequired(modifications: Modifications): Promise<Modifications> {
  return removeRequired(modifications);
}

async function removeRequired(modifications: Modifications): Promise<Modifications> {
  const edits = removeJoiValidationEdits(modifications.ast.root(), {
    primitive: '*',
    validationTargetKey: 'required()',
  });
  const updated = await commitEditModifications(edits, modifications);
  const isUnchanged = updated.ast.root().text() === modifications.ast.root().text();
  if (isUnchanged) {
    return modifications;
  }

  return removeRequired(updated);
}

export default joiRemoveRequired;
