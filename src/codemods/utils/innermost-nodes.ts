import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

type AnyNode = SgNode<TypesMap, Kinds<TypesMap>>;

function contains(outer: AnyNode, inner: AnyNode): boolean {
  const outerRange = outer.range();
  const innerRange = inner.range();
  const isSameRange =
    outerRange.start.index === innerRange.start.index && outerRange.end.index === innerRange.end.index;

  return (
    !isSameRange && outerRange.start.index <= innerRange.start.index && outerRange.end.index >= innerRange.end.index
  );
}

export function innermostBy<Item>(items: Array<Item>, toNode: (item: Item) => AnyNode): Array<Item> {
  return items.filter(candidate => !items.some(other => contains(toNode(candidate), toNode(other))));
}

function innermostNodes(nodes: Array<AnyNode>): Array<AnyNode> {
  return innermostBy(nodes, node => node);
}

export default innermostNodes;
