import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

function getZodImport(root: SgNode<TypesMap, Kinds<TypesMap>>): SgNode<TypesMap, Kinds<TypesMap>> | null {
  return (
    root.find("import $Z from 'zod'") ??
    root.find('import $Z from "zod"') ??
    root.find("import { $$$IMPORTS } from 'zod'") ??
    root.find('import { $$$IMPORTS } from "zod"') ??
    root.find("import * as $Z from 'zod'") ??
    root.find('import * as $Z from "zod"')
  );
}

function hasZodImport(root: SgNode<TypesMap, Kinds<TypesMap>>): boolean {
  const zodImport = getZodImport(root);

  return zodImport != null;
}

export default hasZodImport;
