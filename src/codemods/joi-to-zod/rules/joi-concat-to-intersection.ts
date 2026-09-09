import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

async function joiConcatToIntersection(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  const concatenations = modifications.ast.root().findAll({ rule: { kind: 'call_expression' } });
  const edits = compactMap(concatenations, node => {
    const chain = getJoiCallChain(node, joiImportIdentifierName);
    const concat = chain?.segments.at(-1);
    const schema = concat?.arguments[0];
    if (concat?.name !== 'concat' || schema == null || concat.arguments.length !== 1) return null;

    return node.replace(`${joiImportIdentifierName}.intersection(${concat.receiver.text()}, ${schema.text()})`);
  });

  return commitEditModifications(edits, modifications);
}

export default joiConcatToIntersection;
