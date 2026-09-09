import type { Modifications } from '../../../kit/types.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import innermostNodes from '../../utils/innermost-nodes.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const PRESENCE_BEARING_PARENTS = new Set<string>(['pair', 'variable_declarator']);

async function joiAddOptional(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const candidates = getJoiProperties(root, { primitive: '*' }).filter(property => {
      const parentKind = property.parent()?.kind();
      if (parentKind == null || !PRESENCE_BEARING_PARENTS.has(String(parentKind))) return false;

      const validations = new Set(getJoiCallChain(property, joiIdentifierName)?.segments.map(segment => segment.name));

      return !validations.has('required') && !validations.has('optional');
    });

    return innermostNodes(candidates).map(property => property.replace(`${property.text()}.optional()`));
  });
}

export default joiAddOptional;
