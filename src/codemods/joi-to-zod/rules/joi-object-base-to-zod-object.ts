import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import innermostNodes from '../../utils/innermost-nodes.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiObjectBaseToZodObject(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const objectCalls = root.findAll({ rule: { kind: 'call_expression' } }).filter(call => {
      const chain = getJoiCallChain(call, joiIdentifierName);

      return chain?.segments.length === 1 && chain.segments[0]?.name === 'object';
    });
    return compactMap(innermostNodes(objectCalls), objectCall => {
      const objectSegment = getJoiCallChain(objectCall, joiIdentifierName)?.segments[0];
      if (objectSegment == null) return undefined;

      const parentCall = objectCall.parent()?.parent();
      const parentChain = parentCall == null ? undefined : getJoiCallChain(parentCall, joiIdentifierName);
      const parentSegment = parentChain?.segments.at(-1);
      if (parentSegment?.name === 'strict' && parentSegment.receiver.id() === objectCall.id()) return undefined;

      if (objectSegment.arguments.length === 0) {
        if (parentCall?.kind() === 'call_expression' && parentSegment?.name === 'extend') {
          const shape = parentSegment.arguments.map(argument => argument.text()).join(', ');
          return parentCall.replace(`${joiIdentifierName}.object(${shape}).strict()`);
        }

        return objectCall.replace(`${joiIdentifierName}.looseObject({})`);
      }

      return objectCall.replace(`${objectCall.text()}.strict()`);
    });
  });
}

export default joiObjectBaseToZodObject;
