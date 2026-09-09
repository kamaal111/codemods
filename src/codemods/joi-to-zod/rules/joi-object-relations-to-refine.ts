import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import type { JoiCallSegment } from '../utils/get-joi-call-chain.ts';
import { getJoiCallChain } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const PRESENT = 'field => field !== undefined';
const ABSENT = 'field => field === undefined';

const PEER_RELATIONS: Record<string, (peers: string) => string> = {
  or: peers => `refine(value => [${peers}].some(${PRESENT}))`,
  xor: peers => `refine(value => [${peers}].filter(${PRESENT}).length === 1)`,
  oxor: peers => `refine(value => [${peers}].filter(${PRESENT}).length <= 1)`,
  and: peers => `refine(value => [${peers}].every(${PRESENT}) || [${peers}].every(${ABSENT}))`,
  nand: peers => `refine(value => ![${peers}].every(${PRESENT}))`,
};

const DEPENDENCY_RELATIONS: Record<string, (subject: string, peers: string) => string> = {
  with: (subject, peers) => `refine(value => value[${subject}] === undefined || [${peers}].every(${PRESENT}))`,
  without: (subject, peers) => `refine(value => value[${subject}] === undefined || [${peers}].every(${ABSENT}))`,
};

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

function flattenPeers(argumentNodes: Array<JoiNode>): string {
  return argumentNodes
    .flatMap(argument => {
      if (argument.kind() !== 'array') return [argument.text()];

      return argument
        .namedChildren()
        .filter(element => element.kind() !== 'comment')
        .map(element => element.text());
    })
    .filter(key => key.length > 0)
    .map(key => `value[${key}]`)
    .join(', ');
}

function buildRelationReplacement(name: string, argumentNodes: Array<JoiNode>): string | undefined {
  if (argumentNodes.length === 0) return undefined;

  const peerRelation = PEER_RELATIONS[name];
  if (peerRelation != null) return peerRelation(flattenPeers(argumentNodes));

  const dependencyRelation = DEPENDENCY_RELATIONS[name];
  if (dependencyRelation == null) return undefined;

  const [subject, ...peers] = argumentNodes;
  if (subject == null || peers.length === 0) return undefined;

  return dependencyRelation(subject.text(), flattenPeers(peers));
}

function isRelationSegment(segment: JoiCallSegment): boolean {
  return PEER_RELATIONS[segment.name] != null || DEPENDENCY_RELATIONS[segment.name] != null;
}

function rewriteObjectRelations(node: JoiNode, joiIdentifierName: string): string | undefined {
  const chain = getJoiCallChain(node, joiIdentifierName);
  const baseSegment = chain?.segments[0];
  if (chain == null || baseSegment?.name !== 'object') return undefined;

  const relationSegments = chain.segments.slice(1).filter(isRelationSegment);
  if (relationSegments.length === 0) return undefined;

  const offset = node.range().start.index;

  return relationSegments.reverse().reduce((accumulator, segment) => {
    const replacement = buildRelationReplacement(segment.name, segment.arguments);
    if (replacement == null) return accumulator;

    return (
      accumulator.slice(0, segment.receiver.range().end.index - offset) +
      `.${replacement}` +
      accumulator.slice(segment.call.range().end.index - offset)
    );
  }, node.text());
}

async function joiObjectRelationsToRefine(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: 'object' });
    const rewrites = compactMap(properties, property => {
      const replacement = rewriteObjectRelations(property, joiIdentifierName);
      if (replacement == null || replacement === property.text()) return undefined;

      return { property, replacement };
    });

    return innermostBy(rewrites, rewrite => rewrite.property).map(rewrite => {
      return rewrite.property.replace(rewrite.replacement);
    });
  });
}

export default joiObjectRelationsToRefine;
