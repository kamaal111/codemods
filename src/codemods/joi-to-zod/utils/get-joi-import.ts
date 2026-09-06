import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

export const JOI_IMPORT_META_IDENTIFIER = 'J';

function getJoiImport(root: SgNode<TypesMap, Kinds<TypesMap>>): SgNode<TypesMap, Kinds<TypesMap>> | undefined {
  const joiImport =
    root.find(`import $${JOI_IMPORT_META_IDENTIFIER} from 'joi'`) ??
    root.find(`import $${JOI_IMPORT_META_IDENTIFIER} from "joi"`);

  return joiImport ?? undefined;
}

export default getJoiImport;
