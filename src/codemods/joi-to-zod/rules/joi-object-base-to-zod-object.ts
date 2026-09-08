import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import innermostNodes from '../../utils/innermost-nodes.ts';
import splitArguments from '../../utils/split-arguments.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';

const ARGS_META_IDENTIFIER = 'ARGS';

async function joiObjectBaseToZodObject(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const objectPrefix = `${joiIdentifierName}.object(`;
    const objectCalls = root.findAll({
      rule: { pattern: `${joiIdentifierName}.object($$$${ARGS_META_IDENTIFIER})` },
    });
    return compactMap(innermostNodes(objectCalls), objectCall => {
      const text = objectCall.text();
      if (!text.startsWith(objectPrefix) || !text.endsWith(')')) return undefined;
      const parentCall = objectCall.parent()?.parent();
      if (parentCall?.kind() === 'call_expression' && parentCall.text().startsWith(`${text}.strict(`)) return undefined;

      const args = splitArguments(text.slice(objectPrefix.length, -1)).filter(argument => argument.trim().length > 0);
      if (args.length === 0) {
        const parentText = parentCall?.text();
        const extendPrefix = `${text}.extend(`;
        if (
          parentCall?.kind() === 'call_expression' &&
          parentText?.startsWith(extendPrefix) &&
          parentText.endsWith(')')
        ) {
          const shape = parentText.slice(extendPrefix.length, -1);

          return parentCall.replace(`${joiIdentifierName}.object(${shape}).strict()`);
        }

        return objectCall.replace(`${joiIdentifierName}.looseObject({})`);
      }

      return objectCall.replace(`${text}.strict()`);
    });
  });
}

export default joiObjectBaseToZodObject;
