import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

export type JoiCallSegment = {
  name: string;
  call: JoiNode;
  receiver: JoiNode;
  argumentsNode: JoiNode;
  arguments: Array<JoiNode>;
};

export type JoiCallChain = {
  root: JoiNode;
  segments: Array<JoiCallSegment>;
};

function callArguments(argumentsNode: JoiNode): Array<JoiNode> {
  return argumentsNode.namedChildren().filter(child => child.kind() !== 'comment');
}

function rootIdentifier(node: JoiNode): JoiNode | undefined {
  let current = node;
  while (current.kind() === 'member_expression') {
    const receiver: JoiNode | null = current.field('object');
    const property: JoiNode | null = current.field('property');
    if (receiver == null || property?.kind() !== 'property_identifier') return undefined;
    current = receiver;
  }

  return current.kind() === 'identifier' ? current : undefined;
}

export function getJoiCallChain(node: JoiNode, joiIdentifierName: string): JoiCallChain | undefined {
  if (node.kind() !== 'call_expression') return undefined;

  const reversedSegments: Array<JoiCallSegment> = [];
  let current = node;
  let root: JoiNode | undefined;

  while (current.kind() === 'call_expression') {
    const memberExpression: JoiNode | null = current.field('function');
    const argumentsNode: JoiNode | null = current.field('arguments');
    if (memberExpression?.kind() !== 'member_expression' || argumentsNode == null) return undefined;

    const receiver: JoiNode | null = memberExpression.field('object');
    const property: JoiNode | null = memberExpression.field('property');
    if (receiver == null || property?.kind() !== 'property_identifier') return undefined;

    reversedSegments.push({
      name: property.text(),
      call: current,
      receiver,
      argumentsNode,
      arguments: callArguments(argumentsNode),
    });

    if (receiver.kind() !== 'call_expression') {
      root = rootIdentifier(receiver);
      break;
    }
    current = receiver;
  }

  if (root?.kind() !== 'identifier' || root.text() !== joiIdentifierName) return undefined;

  return { root, segments: reversedSegments.reverse() };
}

export function isOutermostCallChain(node: JoiNode): boolean {
  const memberExpression = node.parent();
  if (memberExpression?.kind() !== 'member_expression') return true;
  if (memberExpression.field('object')?.id() !== node.id()) return true;

  const parentCall = memberExpression.parent();

  return parentCall?.kind() !== 'call_expression' || parentCall.field('function')?.id() !== memberExpression.id();
}
