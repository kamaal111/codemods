import type { Modifications } from '../../../kit/types.ts';
import { spliced } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiImport from '../utils/get-joi-import.ts';

async function joiRemoveImport(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImport = getJoiImport(root);
  if (joiImport == null) return modifications;

  const lines = root.text().split('\n');
  const index = lines.findIndex(line => line.includes(joiImport.text()));
  if (index === -1) return modifications;

  const edit = root.replace(spliced(lines, index, 1).join('\n'));

  return commitEditModifications([edit], modifications);
}

export default joiRemoveImport;
