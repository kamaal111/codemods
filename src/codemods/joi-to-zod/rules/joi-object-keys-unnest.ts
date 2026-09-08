import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { getJoiCallChain, isOutermostCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiObjectKeysUnnest(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const callExpressions = root.findAll({ rule: { kind: 'call_expression' } });
    return compactMap(callExpressions, node => {
      if (!isOutermostCallChain(node)) return undefined;

      const chain = getJoiCallChain(node, joiIdentifierName);
      const baseSegment = chain?.segments[0];
      if (chain == null || baseSegment?.name !== 'object' || baseSegment.arguments.length > 0) return undefined;

      const keysSegment = chain.segments.find(segment => segment.name === 'keys' && segment.arguments.length > 0);
      if (keysSegment == null) return undefined;

      const offset = node.range().start.index;
      const text = node.text();
      const withoutKeys =
        text.slice(0, keysSegment.receiver.range().end.index - offset) +
        text.slice(keysSegment.call.range().end.index - offset);
      const shape = keysSegment.arguments.map(argument => argument.text()).join(', ');

      return node.replace(
        withoutKeys.slice(0, baseSegment.call.range().start.index - offset) +
          `${joiIdentifierName}.object(${shape})` +
          withoutKeys.slice(baseSegment.call.range().end.index - offset),
      );
    });
  });
}

export default joiObjectKeysUnnest;
