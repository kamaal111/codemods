import assert from 'node:assert/strict';

import type { Modifications } from '../../../kit/types.ts';
import { compactMap } from '../../../utils/arrays.ts';
import commitEditModificationsUntilStable from '../../utils/commit-edit-modifications-until-stable.ts';
import { innermostBy } from '../../utils/innermost-nodes.ts';
import { findIdentifierCallChains, type ChainSegment } from '../../utils/parse-call-chain.ts';
import splitArguments from '../../utils/split-arguments.ts';
import getJoiIdentifierName from '../utils/get-joi-identifier-name.ts';
import getJoiProperties from '../utils/get-joi-properties.ts';

const PRESENCE_SEGMENTS = new Set(['required', 'optional']);

const SHIMMABLE_HELPERS = new Set(['error', 'message']);

const ARROW_PARAMETERS_PATTERN = /^\(([^)]*)\)\s*=>/s;
const FUNCTION_PARAMETERS_PATTERN = /^function\s*[$\w]*\s*\(([^)]*)\)/s;

function parseCallbackParameters(callback: string): Array<string> | undefined {
  const match = ARROW_PARAMETERS_PATTERN.exec(callback) ?? FUNCTION_PARAMETERS_PATTERN.exec(callback);
  if (match?.[1] == null) return undefined;

  return compactMap(splitArguments(match[1]), parameter => {
    const trimmedParameter = parameter.trim();
    if (trimmedParameter.length === 0) return null;
    return trimmedParameter;
  });
}

function referencedHelperMembers(callback: string, helpersName: string): Set<string> {
  const pattern = new RegExp(String.raw`\b${helpersName}\s*\.\s*([$\w]+)`, 'g');

  const members = Array.from(callback.matchAll(pattern), match => {
    assert(match[1] != null, 'the capture group always matches when the pattern matches');

    return match[1];
  });

  return new Set(members);
}

function buildCustomReplacement(args: string): string | undefined {
  const [callback] = splitArguments(args).map(argument => argument.trim());
  if (callback == null || callback.length === 0) return undefined;

  const parameters = parseCallbackParameters(callback);
  const helpersName = parameters?.[1];
  if (helpersName == null) return `transform(${callback})`;

  const members = referencedHelperMembers(callback, helpersName);
  if (members.size === 0) return `transform(${callback})`;
  if (Array.from(members).some(member => !SHIMMABLE_HELPERS.has(member))) return undefined;

  return [
    'transform((value, ctx) => {',
    '  const helpers = {',
    "    error: (code: unknown) => { ctx.addIssue({ code: 'custom', message: String(code) }); return z.NEVER; },",
    "    message: (text: unknown) => { ctx.addIssue({ code: 'custom', message: String(text) }); return z.NEVER; },",
    '  };',
    '',
    `  return (${callback})(value, helpers);`,
    '})',
  ].join('\n');
}

function isConvertible(segments: Array<ChainSegment>, customIndex: number): boolean {
  return segments.slice(customIndex + 1).every(segment => PRESENCE_SEGMENTS.has(segment.name));
}

function rewriteCustoms(chainText: string, joiIdentifierName: string): string {
  for (const { segments } of findIdentifierCallChains(chainText, joiIdentifierName)) {
    const customSegment = segments.find(segment => segment.name === 'custom');
    if (customSegment == null) continue;

    const customIndex = segments.indexOf(customSegment);
    assert(customIndex >= 0, 'segment was already found, so its index must certainly also be found');
    if (!isConvertible(segments, customIndex)) continue;

    const replacement = buildCustomReplacement(customSegment.args);
    if (replacement == null) continue;

    return chainText.slice(0, customSegment.startIndex) + `.${replacement}` + chainText.slice(customSegment.endIndex);
  }

  return chainText;
}

async function joiCustomToTransform(modifications: Modifications): Promise<Modifications> {
  return commitEditModificationsUntilStable(modifications, current => {
    const root = current.ast.root();
    const joiIdentifierName = getJoiIdentifierName(root);
    if (joiIdentifierName == null) return [];

    const properties = getJoiProperties(root, { primitive: '*' });
    const rewrites = compactMap(properties, property => {
      const propertyText = property.text();
      const replacement = rewriteCustoms(propertyText, joiIdentifierName);
      if (replacement === propertyText) return undefined;

      return { property, replacement };
    });

    return innermostBy(rewrites, rewrite => rewrite.property).map(rewrite => {
      return rewrite.property.replace(rewrite.replacement);
    });
  });
}

export default joiCustomToTransform;
