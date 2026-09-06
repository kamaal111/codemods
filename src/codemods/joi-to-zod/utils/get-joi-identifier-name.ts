import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import getJoiImport, { JOI_IMPORT_META_IDENTIFIER } from './get-joi-import.ts';

function getJoiIdentifierName(root: SgNode<TypesMap, Kinds<TypesMap>>): string | undefined {
  return getJoiImport(root)?.getMatch(JOI_IMPORT_META_IDENTIFIER)?.text();
}

export default getJoiIdentifierName;
