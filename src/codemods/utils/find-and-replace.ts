import type { Edit, SgNode, SgRoot } from '@ast-grep/napi';
import type { Rule } from '@ast-grep/napi/types/rule.js';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import commitEditModifications from './commit-edit-modifications.ts';
import type { Modifications } from '../../kit/types.ts';
import { compactMap } from '../../utils/arrays.ts';

type Node = SgNode<TypesMap, Kinds<TypesMap>>;
type Replacement = Edit | string;
type Transformer = string | ((node: Node, rule: Rule<TypesMap>) => Replacement | Array<Replacement> | undefined);
type StringCandidate = Rule<TypesMap>['pattern'] | Replacement | Transformer;

export type FindAndReplaceConfig = {
  rule: Rule<TypesMap>;
  transformer: Transformer;
};

type MetaVariable = { value: string; original: string };

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

function isString(value: StringCandidate): value is string {
  return typeof value === 'string';
}

function escapeForRegex(value: string): string {
  return value.replace(REGEX_SPECIAL_CHARACTERS, '\\$&');
}

/**
 * Recovers what each `$META` / `$$$META` in a pattern actually matched, so a transformer that
 * returns a replacement string can write `$META` and have it filled in. ast-grep exposes matches
 * through `getMatch`, but only for the node it matched on; this reconstructs them from the pattern
 * text so string transformers work without the caller reaching into the node.
 */
function patternText(pattern: Rule<TypesMap>['pattern']): string | undefined {
  if (isString(pattern)) {
    return pattern;
  }
  if (pattern == null) {
    return undefined;
  }

  return pattern.context;
}

function extractMetaVariables(node: Node, rule: Rule<TypesMap>): Array<MetaVariable> {
  const pattern = patternText(rule.pattern);
  if (pattern == null) {
    return [];
  }

  const patternMetaVariables = Array.from(pattern.matchAll(/\$(\$\$)?([A-Z]+)/g)).map(match => ({
    name: match[2] ?? '',
    fullMatch: match[0],
    isMultiple: match[1] != null,
  }));
  if (patternMetaVariables.length === 0) {
    return [];
  }

  const regexPattern = patternMetaVariables.reduce(
    (acc, metaVariable) =>
      acc.replace(escapeForRegex(metaVariable.fullMatch), metaVariable.isMultiple ? '(.*?)' : '(.+?)'),
    escapeForRegex(pattern),
  );
  const textMatch = node.text().match(new RegExp(regexPattern));
  if (textMatch == null) {
    return [];
  }

  // Keyed by name so a pattern that repeats a meta variable resolves to a single value, matching
  // how ast-grep itself binds them.
  const byName = new Map<string, MetaVariable>();
  for (const [index, metaVariable] of patternMetaVariables.entries()) {
    const value = textMatch[index + 1];
    if (value == null || value === '') {
      continue;
    }

    byName.set(metaVariable.name, { value, original: metaVariable.fullMatch });
  }

  return Array.from(byName.values());
}

function replacementsForNode(node: Node, rule: Rule<TypesMap>, transformer: FindAndReplaceConfig['transformer']) {
  const transformed = isString(transformer) ? transformer : transformer(node, rule);
  if (transformed == null) {
    return [];
  }

  const replacements = Array.isArray(transformed) ? transformed : [transformed];
  const metaVariables = extractMetaVariables(node, rule);

  return compactMap(replacements, replacement => {
    if (!isString(replacement)) {
      return replacement;
    }

    const resolved = metaVariables.reduce((acc, { original, value }) => acc.replaceAll(original, value), replacement);
    if (resolved === node.text()) {
      return undefined;
    }

    return node.replace(resolved);
  });
}

export function findAndReplaceEdits(
  ast: SgRoot<TypesMap>,
  rule: Rule<TypesMap>,
  transformer: FindAndReplaceConfig['transformer'],
): Array<Edit> {
  return ast
    .root()
    .findAll({ rule })
    .flatMap(node => replacementsForNode(node, rule, transformer));
}

/** Applies each config entry in order, reparsing between entries so later rules see earlier edits. */
export async function findAndReplaceConfigModifications(
  modifications: Modifications,
  config: Array<FindAndReplaceConfig>,
): Promise<Modifications> {
  let current = modifications;
  for (const { rule, transformer } of config) {
    current = await commitEditModifications(findAndReplaceEdits(current.ast, rule, transformer), current);
  }

  return current;
}
