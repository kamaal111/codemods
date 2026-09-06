import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiForbiddenToNever(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  const nodes = modifications.ast.root().findAll({ rule: { pattern: `${joiImportIdentifierName}.forbidden()` } });
  const edits = compactMap(nodes, node => node.replace(`${joiImportIdentifierName}.never()`));

  return commitEditModifications(edits, modifications);
}

export default joiForbiddenToNever;
