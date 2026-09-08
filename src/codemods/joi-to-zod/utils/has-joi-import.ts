import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import getJoiIdentifierName from './get-joi-identifier-name.ts';

function hasJoiImport(root: SgNode<TypesMap, Kinds<TypesMap>>): boolean {
  return getJoiIdentifierName(root) != null;
}

export default hasJoiImport;
