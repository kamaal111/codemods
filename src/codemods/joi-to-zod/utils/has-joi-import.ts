import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import getJoiImport, { JOI_IMPORT_META_IDENTIFIER } from './get-joi-import.ts';

function hasJoiImport(root: SgNode<TypesMap, Kinds<TypesMap>>): boolean {
  const joiImport = getJoiImport(root);

  return joiImport?.getMatch(JOI_IMPORT_META_IDENTIFIER) != null;
}

export default hasJoiImport;
