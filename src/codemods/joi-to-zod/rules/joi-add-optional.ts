import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import innermostNodes from '../../utils/innermost-nodes.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

const PRESENCE_BEARING_PARENTS = new Set<string>(['pair', 'variable_declarator']);

function callChainNames(schema: JoiNode): Set<string> {
  const names = new Set<string>();
  let current: JoiNode = schema;

  while (current.kind() === 'call_expression') {
    const memberExpression: JoiNode | null = current.field('function');
    if (memberExpression?.kind() !== 'member_expression') break;

    const receiver: JoiNode | null = memberExpression.field('object');
    const property: JoiNode | null = memberExpression.field('property');
    if (receiver == null || property?.kind() !== 'property_identifier') break;

    names.add(property.text());
    if (receiver.kind() !== 'call_expression') break;

    current = receiver;
  }

  return names;
}

async function joiAddOptional(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const candidates = getJoiProperties(root, { primitive: '*' }).filter(property => {
      const parentKind = property.parent()?.kind();
      if (parentKind == null || !PRESENCE_BEARING_PARENTS.has(String(parentKind))) return false;

      const validations = callChainNames(property);

      return !validations.has('required') && !validations.has('optional');
    });

    return innermostNodes(candidates).map(property => property.replace(`${property.text()}.optional()`));
  });
}

export default joiAddOptional;
