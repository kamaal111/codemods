import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModifications from '../../utils/commit-edit-modifications.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiPrimitive from '../utils/get-joi-primitive.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

async function joiRemovePrimitiveForEnum(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  const joiImportIdentifierName = getJoiIdentifierName(root);
  if (joiImportIdentifierName == null) return modifications;

  const edits = compactMap(getJoiProperties(root, { primitive: '*', validationName: 'enum($ARGS)' }), property => {
    const primitive = getJoiPrimitive(property, joiImportIdentifierName);
    if (primitive == null) return undefined;

    const replacement = property.text().replace(`.${primitive}()`, '');

    return property.replace(replacement);
  });

  return commitEditModifications(edits, modifications);
}

export default joiRemovePrimitiveForEnum;
