import assert from 'node:assert/strict';

import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import { getJoiCallChain, type JoiCallSegment } from '../utils/get-joi-call-chain.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

type JoiNode = SgNode<TypesMap, Kinds<TypesMap>>;

const PRESENCE_SEGMENTS = new Set(['required', 'optional']);

const SHIMMABLE_HELPERS = new Set(['error', 'message']);

function callbackParameterNames(callback: JoiNode): Array<string> {
  const parameters = callback.children().find(child => child.kind() === 'formal_parameters');
  if (parameters == null) return [];

  return compactMap(parameters.namedChildren(), parameter => {
    if (parameter.kind() === 'comment') return null;

    return parameter.kind() === 'identifier'
      ? parameter.text()
      : parameter.find({ rule: { kind: 'identifier' } })?.text();
  });
}

function referencedHelperMembers(callback: JoiNode, helpersName: string): Set<string> {
  return new Set(
    compactMap(callback.findAll({ rule: { kind: 'member_expression' } }), member => {
      const receiver: JoiNode | null = member.field('object');
      const property: JoiNode | null = member.field('property');
      if (receiver?.kind() !== 'identifier' || receiver.text() !== helpersName) return null;
      if (property?.kind() !== 'property_identifier') return null;

      return property.text();
    }),
  );
}

function buildCustomReplacement(callback: JoiNode | undefined): string | undefined {
  if (callback == null) return undefined;
  const callbackText = callback.text();

  const helpersName = callbackParameterNames(callback)[1];
  if (helpersName == null) return `transform(${callbackText})`;

  const members = referencedHelperMembers(callback, helpersName);
  if (members.size === 0) return `transform(${callbackText})`;
  if (Array.from(members).some(member => !SHIMMABLE_HELPERS.has(member))) return undefined;

  return [
    'transform((value, ctx) => {',
    '  const helpers = {',
    "    error: (code: unknown) => { ctx.addIssue({ code: 'custom', message: String(code) }); return z.NEVER; },",
    "    message: (text: unknown) => { ctx.addIssue({ code: 'custom', message: String(text) }); return z.NEVER; },",
    '  };',
    '',
    `  return (${callbackText})(value, helpers);`,
    '})',
  ].join('\n');
}

function isConvertible(segments: Array<JoiCallSegment>, customIndex: number): boolean {
  return segments.slice(customIndex + 1).every(segment => PRESENCE_SEGMENTS.has(segment.name));
}

async function joiCustomToTransform(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: '*' });
    const rewrites = compactMap(properties, property => {
      const segments = getJoiCallChain(property, joiIdentifierName)?.segments;
      const customSegment = segments?.find(segment => segment.name === 'custom');
      if (segments == null || customSegment == null) return undefined;

      const customIndex = segments.indexOf(customSegment);
      assert(customIndex >= 0, 'segment was already found, so its index must certainly also be found');
      if (!isConvertible(segments, customIndex)) return undefined;

      const replacement = buildCustomReplacement(customSegment.arguments[0]);
      if (replacement == null) return undefined;

      return { property: customSegment.call, replacement: `${customSegment.receiver.text()}.${replacement}` };
    });

    return innermostBy(rewrites, rewrite => rewrite.property).map(rewrite => {
      return rewrite.property.replace(rewrite.replacement);
    });
  });
}

export default joiCustomToTransform;
