import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiAlternativesToUnion(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) {
    return modifications;
  }

  const alternativeTries = root.findAll({ rule: { kind: 'call_expression' } });
  const edits = compactMap(alternativeTries, node => {
    const chain = getJoiCallChain(node, joiImportIdentifierName);
    const [alternativesSegment, trySegment] = chain?.segments ?? [];
    if (chain?.segments.length !== 2 || alternativesSegment?.name !== 'alternatives' || trySegment?.name !== 'try') {
      return null;
    }

    const argsText = trySegment.arguments.map(argument => argument.text()).join(', ');

    return node.replace(`${joiImportIdentifierName}.union([${argsText}])`);
  });

  return commitEditModifications(edits, modifications);
}

export default joiAlternativesToUnion;
