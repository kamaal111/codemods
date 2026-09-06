import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const CHAIN_META_IDENTIFIER = 'CHAIN';
const SCHEMA_META_IDENTIFIER = 'SCHEMA';

async function joiConcatToIntersection(modifications: Modifications): Promise<Modifications> {
  const joiImportIdentifierName = getJoiIdentifierName(modifications.ast.root());
  if (joiImportIdentifierName == null) return modifications;

  const concatenations = modifications.ast.root().findAll({
    rule: { pattern: `$${CHAIN_META_IDENTIFIER}.concat($${SCHEMA_META_IDENTIFIER})` },
  });
  const edits = compactMap(concatenations, node => {
    const chain = node.getMatch(CHAIN_META_IDENTIFIER);
    const schema = node.getMatch(SCHEMA_META_IDENTIFIER);
    const isNotJoiConcatChain = chain == null || schema == null || !chain.text().startsWith(joiImportIdentifierName);
    if (isNotJoiConcatChain) return null;

    return node.replace(`${joiImportIdentifierName}.intersection(${chain.text()}, ${schema.text()})`);
  });

  return commitEditModifications(edits, modifications);
}

export default joiConcatToIntersection;
