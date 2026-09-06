import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

function traverseUp(
  node: SgNode<TypesMap, Kinds<TypesMap>>,
  until: (node: SgNode<TypesMap, Kinds<TypesMap>>) => boolean,
): SgNode<TypesMap, Kinds<TypesMap>> | undefined {
  let current: SgNode<TypesMap, Kinds<TypesMap>> | undefined = node.parent() ?? undefined;

  while (current != null) {
    if (until(current)) return current;

    current = current.parent() ?? undefined;
  }

  return undefined;
}

export default traverseUp;
