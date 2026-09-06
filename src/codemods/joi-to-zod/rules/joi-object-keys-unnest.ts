import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import innermostNodes from '../../utils/innermost-nodes.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const ARGS_META_IDENTIFIER = 'ARGS';

async function joiObjectKeysUnnest(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiImportIdentifierName = getJoiIdentifierName(root);
    if (joiImportIdentifierName == null) return [];

    const matches = root.findAll({
      rule: { pattern: `${joiImportIdentifierName}.object().keys($${ARGS_META_IDENTIFIER})` },
    });
    return compactMap(innermostNodes(matches), node => {
      const objectSchema = node.getMatch(ARGS_META_IDENTIFIER);
      if (objectSchema == null) return undefined;

      return node.replace(`${joiImportIdentifierName}.object(${objectSchema.text()}).strict()`);
    });
  });
}

export default joiObjectKeysUnnest;
