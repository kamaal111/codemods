import type { Modifications } from '../../../kit/types.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

async function joiRemoveOptionsFromRegex(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiIdentifierName = getJoiIdentifierName(root);
  if (joiIdentifierName == null) return modifications;

  const edits = getJoiProperties(root, { primitive: 'string', validationName: 'regex($REGEX,$$$OPTIONS)' })
    .flatMap(property => getJoiCallChain(property, joiIdentifierName)?.segments ?? [])
    .filter(segment => segment.name === 'regex' && segment.argumentsNode.children().some(child => child.kind() === ','))
    .map(segment => segment.argumentsNode.replace(`(${segment.arguments[0]?.text() ?? ''})`));

  return commitEditModifications(edits, modifications);
}

export default joiRemoveOptionsFromRegex;
