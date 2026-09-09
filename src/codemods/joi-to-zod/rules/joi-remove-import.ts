import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { getJoiImportWithMeta } from '../utils/get-joi-import.ts';
import hasJoiImport from '../utils/has-joi-import.ts';

async function joiRemoveImport(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportWithMeta = getJoiImportWithMeta(root);
  if (joiImportWithMeta == null || !hasJoiImport(root)) {
    return modifications;
  }

  if (joiImportWithMeta.namedImports.length > 0) {
    const retainedNamedImport = `import { ${joiImportWithMeta.namedImports.map(node => node.text()).join(', ')} } from ${joiImportWithMeta.module.text()};`;

    return commitEditModifications([joiImportWithMeta.importNode.replace(retainedNamedImport)], modifications);
  }

  return commitEditModifications([joiImportWithMeta.importNode.replace('')], modifications);
}

export default joiRemoveImport;
