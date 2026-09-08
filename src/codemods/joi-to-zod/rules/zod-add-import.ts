import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiImport from '../utils/get-joi-import.ts';
import hasJoiImport from '../utils/has-joi-import.ts';
import hasZodImport from '../utils/has-zod-import.ts';

async function zodAddImport(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImport = getJoiImport(root);
  if (joiImport == null || !hasJoiImport(root)) return modifications;
  if (hasZodImport(root)) return modifications;

  const joiRange = joiImport.range();
  const edit = {
    startPos: joiRange.end.index,
    endPos: joiRange.end.index,
    insertedText: '\nimport { z } from "zod";',
  };

  return commitEditModifications([edit], modifications);
}

export default zodAddImport;
