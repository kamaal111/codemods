import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import { findIdentifierCallChains } from '../../utils/parse-call-chain.ts';
import splitArguments from '../../utils/split-arguments.ts';
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

function flattenPeers(args: Array<string>): string {
  return args
    .flatMap(argument => {
      const trimmed = argument.trim();
      if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [trimmed];

      return splitArguments(trimmed.slice(1, -1)).map(key => key.trim());
    })
    .filter(argument => argument.length > 0)
    .map(key => `value[${key}]`)
    .join(', ');
}

function buildRelationReplacement(name: string, args: string): string | undefined {
  const parsedArgs = splitArguments(args)
    .map(argument => argument.trim())
    .filter(argument => argument.length > 0);
  if (parsedArgs.length === 0) return undefined;

  const peerRelation = PEER_RELATIONS[name];
  if (peerRelation != null) return peerRelation(flattenPeers(parsedArgs));

  const dependencyRelation = DEPENDENCY_RELATIONS[name];
  if (dependencyRelation == null) return undefined;

  const [subject, ...peers] = parsedArgs;
  if (subject == null || peers.length === 0) return undefined;

  return dependencyRelation(subject, flattenPeers(peers));
}

function rewriteObjectRelations(chainText: string, joiIdentifierName: string): string {
  for (const { segments } of findIdentifierCallChains(chainText, joiIdentifierName)) {
    const baseSegment = segments[0];
    if (baseSegment == null || baseSegment.name !== 'object') continue;

    const relationSegments = segments
      .slice(1)
      .filter(segment => PEER_RELATIONS[segment.name] != null || DEPENDENCY_RELATIONS[segment.name] != null)
      .reverse();
    if (relationSegments.length === 0) continue;

    return relationSegments.reduce((accumulator, segment) => {
      const replacement = buildRelationReplacement(segment.name, segment.args);
      if (replacement == null) return accumulator;

      return accumulator.slice(0, segment.startIndex) + `.${replacement}` + accumulator.slice(segment.endIndex);
    }, chainText);
  }

  return chainText;
}

async function joiObjectRelationsToRefine(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: 'object' });
    const rewrites = compactMap(properties, property => {
      const propertyText = property.text();
      const replacement = rewriteObjectRelations(propertyText, joiIdentifierName);
      if (replacement === propertyText) return undefined;

      return { property, replacement };
    });

    return innermostBy(rewrites, rewrite => rewrite.property).map(rewrite => {
      return rewrite.property.replace(rewrite.replacement);
    });
  });
}

export default joiObjectRelationsToRefine;
