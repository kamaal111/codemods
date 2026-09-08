import type { Modifications } from '../../../kit/types.ts';
import { spliced } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { getJoiImportWithMeta } from '../utils/get-joi-import.ts';
import hasJoiImport from '../utils/has-joi-import.ts';

async function joiRemoveImport(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportWithMeta = getJoiImportWithMeta(root);
  if (joiImportWithMeta == null || !hasJoiImport(root)) return modifications;

  if (joiImportWithMeta.namedImports.length > 0) {
    const retainedNamedImport = `import { ${joiImportWithMeta.namedImports.map(node => node.text()).join(', ')} } from ${joiImportWithMeta.module.text()};`;

    return commitEditModifications([joiImportWithMeta.importNode.replace(retainedNamedImport)], modifications);
  }

  const lines = root.text().split('\n');
  const index = lines.findIndex(line => line.includes(joiImportWithMeta.importNode.text()));
  if (index === -1) return modifications;

  const edit = root.replace(spliced(lines, index, 1).join('\n'));

  return commitEditModifications([edit], modifications);
}

export default joiRemoveImport;
