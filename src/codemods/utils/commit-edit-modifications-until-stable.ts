import { type Edit } from '@ast-grep/napi';

import commitEditModifications from './commit-edit-modifications.ts';
import type { Modifications } from '../../kit/types.ts';

async function commitEditModificationsUntilStable(
  modifications: Modifications,
  buildEdits: (modifications: Modifications) => Array<Edit>,
): Promise<Modifications> {
  const committed = await commitEditModifications(buildEdits(modifications), modifications);
  if (committed.ast.root().text() === modifications.ast.root().text()) {
    return modifications;
  }

  return commitEditModificationsUntilStable(committed, buildEdits);
}

export default commitEditModificationsUntilStable;
