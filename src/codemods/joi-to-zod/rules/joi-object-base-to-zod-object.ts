import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

const UNKNOWN_KEY_VALIDATIONS = new Set(['strict', 'passthrough', 'catchall']);

type ObjectRewrite = { target: JoiNode; replacement: string };

function rewriteForObjectCall(objectCall: JoiNode, joiIdentifierName: string): ObjectRewrite | undefined {
  const objectSegment = getJoiCallChain(objectCall, joiIdentifierName)?.segments[0];
  if (objectSegment == null) {
    return undefined;
  }

  const parentCall = objectCall.parent()?.parent();
  const parentChain = parentCall == null ? undefined : getJoiCallChain(parentCall, joiIdentifierName);
  const parentSegment = parentChain?.segments.at(-1);
  const declaresUnknownKeyPolicy =
    parentSegment != null &&
    UNKNOWN_KEY_VALIDATIONS.has(parentSegment.name) &&
    parentSegment.receiver.id() === objectCall.id();
  if (declaresUnknownKeyPolicy) {
    return undefined;
  }

  if (objectSegment.arguments.length === 0) {
    if (parentCall != null && parentCall.kind() === 'call_expression' && parentSegment?.name === 'extend') {
      const objectArguments = parentSegment.arguments.map(argument => argument.text()).join(', ');

      return { target: parentCall, replacement: `${joiIdentifierName}.object(${objectArguments}).strict()` };
    }

    return { target: objectCall, replacement: `${joiIdentifierName}.looseObject({})` };
  }

  return { target: objectCall, replacement: `${objectCall.text()}.strict()` };
}

async function joiObjectBaseToZodObject(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) {
      return [];
    }

    const objectCalls = root.findAll({ rule: { kind: 'call_expression' } }).filter(call => {
      const chain = getJoiCallChain(call, joiIdentifierName);

      return chain?.segments.length === 1 && chain.segments[0]?.name === 'object';
    });
    const pending = compactMap(objectCalls, objectCall => {
      const rewrite = rewriteForObjectCall(objectCall, joiIdentifierName);

      return rewrite == null ? undefined : { objectCall, rewrite };
    });

    return innermostBy(pending, candidate => candidate.objectCall).map(({ rewrite }) => {
      return rewrite.target.replace(rewrite.replacement);
    });
  });
}

export default joiObjectBaseToZodObject;
