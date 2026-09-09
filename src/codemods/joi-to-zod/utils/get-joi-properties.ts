import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import extractNameFromCallExpression from '../../utils/extract-name-from-call-expression.ts';
import type { JoiPrimitives } from '../types.ts';
import { getJoiCallChain, isOutermostCallChain } from './get-joi-call-chain.ts';
import getJoiIdentifierName from './get-joi-identifier-name.ts';

function getJoiProperties(
  root: SgNode<TypesMap, Kinds<TypesMap>>,
  params: { primitive?: JoiPrimitives; validationName?: string },
): Array<SgNode<TypesMap, Kinds<TypesMap>>> {
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) return [];

  const validationName = extractNameFromCallExpression(params.validationName);
  return root.findAll({ rule: { kind: 'call_expression' } }).filter(callExpression => {
    if (!isOutermostCallChain(callExpression)) return false;

    const chain = getJoiCallChain(callExpression, joiImportIdentifierName);
    if (chain == null) return false;

    const primitive = chain.segments[0]?.name;
    if (params.primitive != null && params.primitive !== '*' && primitive !== params.primitive) return false;

    return validationName == null || chain.segments.some(segment => segment.name === validationName);
  });
}

export default getJoiProperties;
