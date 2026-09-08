import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import { getJoiImportIdentifierFromJoiImport } from './get-joi-import.ts';

function getJoiIdentifierName(root: SgNode<TypesMap, Kinds<TypesMap>>): string | undefined {
  const identifierName = getJoiImportIdentifierFromJoiImport(root);
  if (identifierName == null) return undefined;
  if (identifierName.match(/^[A-Za-z_$][\w$]*$/) == null) return undefined;
  return identifierName;
}

export default getJoiIdentifierName;
