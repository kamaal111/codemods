import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import { getJoiCallChain } from './get-joi-call-chain.ts';

function getJoiPrimitive(
  property: SgNode<TypesMap, Kinds<TypesMap>>,
  joiImportIdentifierName: string,
): string | undefined {
  return getJoiCallChain(property, joiImportIdentifierName)?.segments[0]?.name;
}

export default getJoiPrimitive;
