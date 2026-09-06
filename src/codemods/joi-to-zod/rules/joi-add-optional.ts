import type { Modifications } from '../../../kit/types.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import innermostNodes from '../../utils/innermost-nodes.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const PRESENCE_BEARING_PARENTS = new Set<string>(['pair', 'variable_declarator']);

async function joiAddOptional(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const candidates = getJoiProperties(root, { primitive: '*' }).filter(property => {
      const parentKind = property.parent()?.kind();
      if (parentKind == null || !PRESENCE_BEARING_PARENTS.has(String(parentKind))) return false;

      const text = property.text();

      return !text.includes('.required') && !text.trimEnd().endsWith('.optional()');
    });

    return innermostNodes(candidates).map(property => property.replace(`${property.text()}.optional()`));
  });
}

export default joiAddOptional;
