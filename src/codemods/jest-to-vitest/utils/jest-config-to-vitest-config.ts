import { Lang, parseAsync, type SgNode } from '@ast-grep/napi';
import type { TypesMap } from '@ast-grep/napi/types/staticTypes.js';
import { parse as parseJsonc } from 'jsonc-parser';

function isPlainObject<T extends object>(value: unknown): value is T {
  return typeof value === 'object' && value !== null;
}

// Simple 1-to-1 Jest → Vitest property mappings (setupFiles* and collectCoverageFrom need special handling)
const JEST_TO_VITEST_TEST_PROPERTY_MAPPINGS: Array<[string, string]> = [
  ['testEnvironment', 'environment'],
  ['testTimeout', 'testTimeout'],
  ['clearMocks', 'clearMocks'],
  ['resetMocks', 'mockReset'],
  ['restoreMocks', 'restoreMocks'],
  ['testMatch', 'include'],
];

const JEST_TO_VITEST_COVERAGE_PROPERTY_MAPPINGS: Array<[string, string]> = [
  ['coverageDirectory', 'dir'],
  ['coverageReporters', 'reporter'],
];

const CSS_REGEX_PATTERN = /\\\.?\(?(css|scss|less|sass|styl)/;
const IMAGE_REGEX_PATTERN = /\\\.?\(?(png|jpe?g|gif|svg|ico|bmp|webp)/;

// Locate the top-level Jest config object that is the default export.
// This prevents false matches from nested objects (e.g. globals, coverageThreshold).
function findConfigObjectNode(root: SgNode<TypesMap>): SgNode<TypesMap> | undefined {
  // Pattern: const config = { ... }; export default config;
  const exportDefault = root.find({ rule: { pattern: 'export default $NAME' } });
  if (exportDefault != null) {
    const nameNode = exportDefault.getMatch('NAME');
    if (nameNode != null && nameNode.kind() === 'identifier') {
      const name = nameNode.text();
      const varDecl = root.find({
        rule: {
          kind: 'lexical_declaration',
          has: {
            kind: 'variable_declarator',
            has: { kind: 'identifier', regex: `^${name}$` },
          },
        },
      });
      if (varDecl != null) {
        return varDecl.find({ rule: { kind: 'object' } }) ?? undefined;
      }
    }
  }

  // Pattern: export default { ... };
  const inlineExport = root.find({
    rule: { kind: 'export_statement', has: { kind: 'object' } },
  });
  if (inlineExport != null) {
    return inlineExport.find({ rule: { kind: 'object' } }) ?? undefined;
  }

  // Pattern: module.exports = Object.assign($BASE, $OBJ);
  const objectAssign = root.find({ rule: { pattern: 'module.exports = Object.assign($BASE, $OBJ)' } });
  if (objectAssign != null) {
    const obj = objectAssign.getMatch('OBJ');
    if (obj != null && obj.kind() === 'object') return obj;
  }

  // Pattern: module.exports = { ... };
  const moduleExports = root.find({ rule: { pattern: 'module.exports = $OBJ' } });
  if (moduleExports != null) {
    const obj = moduleExports.getMatch('OBJ');
    if (obj != null && obj.kind() === 'object') return obj;
  }

  return undefined;
}

// Return only the immediate pair children of an object node, avoiding nested objects.
function getDirectPairs(objectNode: SgNode<TypesMap>): Array<SgNode<TypesMap>> {
  return objectNode.children().filter(c => c.kind() === 'pair');
}

// Punctuation node kinds used as delimiters in array and object literals.
const COLLECTION_DELIMITER_KINDS: ReadonlySet<string> = new Set(['[', ']', '{', '}', ',']);

// Use AST node kind + child count to detect empty arrays/objects,
// correctly handling whitespace variants like `[  ]` or `{   }`.
function isEmptyCollectionNode(valueNode: SgNode<TypesMap>): boolean {
  const kind = valueNode.kind();
  if (kind !== 'array' && kind !== 'object') return false;
  const meaningfulChildren = valueNode.children().filter(c => !COLLECTION_DELIMITER_KINDS.has(c.kind() as string));
  return meaningfulChildren.length === 0;
}

function getPairKeyText(pair: SgNode<TypesMap>): string | undefined {
  const children = pair.children();
  const keyNode = children.find(c => c.kind() === 'property_identifier' || c.kind() === 'string');
  if (keyNode == null) return undefined;
  return keyNode.kind() === 'string' ? keyNode.text().replace(/^['"]|['"]$/g, '') : keyNode.text();
}

function findValueNodeInPairs(pairs: Array<SgNode<TypesMap>>, keyName: string): SgNode<TypesMap> | undefined {
  for (const pair of pairs) {
    if (getPairKeyText(pair) !== keyName) continue;
    return pair.children().at(-1) ?? undefined;
  }
  return undefined;
}

function extractLiteralArrayElements(arrayNode: SgNode<TypesMap>): string[] {
  return arrayNode
    .children()
    .filter(c => !COLLECTION_DELIMITER_KINDS.has(c.kind() as string) && c.kind() !== 'spread_element')
    .map(c => c.text().trim());
}

// Merge setupFiles and setupFilesAfterEnv into a single setup file list.
function extractSetupFiles(configPairs: Array<SgNode<TypesMap>>): ReadonlyArray<string> | undefined {
  const setupFilesNode = findValueNodeInPairs(configPairs, 'setupFiles');
  const setupFilesAfterEnvNode = findValueNodeInPairs(configPairs, 'setupFilesAfterEnv');

  const items: string[] = [];
  if (setupFilesNode != null && !isEmptyCollectionNode(setupFilesNode)) {
    items.push(...extractLiteralArrayElements(setupFilesNode));
  }
  if (setupFilesAfterEnvNode != null && !isEmptyCollectionNode(setupFilesAfterEnvNode)) {
    items.push(...extractLiteralArrayElements(setupFilesAfterEnvNode));
  }

  if (items.length === 0) return undefined;

  return items.map(item => item.replace(/['"]jest-canvas-mock['"]/g, "'vitest-canvas-mock'"));
}

// Split collectCoverageFrom: non-negated patterns → coverage.include,
// negated patterns (starting with '!') → coverage.exclude (with '!' removed).
function extractCoverageIncludeAndExclude(configPairs: Array<SgNode<TypesMap>>): {
  include: readonly [string, string] | undefined;
  exclude: readonly [string, string] | undefined;
} {
  const valueNode = findValueNodeInPairs(configPairs, 'collectCoverageFrom');
  if (valueNode == null || isEmptyCollectionNode(valueNode)) return { include: undefined, exclude: undefined };

  const elements = valueNode.children().filter(c => !COLLECTION_DELIMITER_KINDS.has(c.kind() as string));

  const includeItems: string[] = [];
  const excludeItems: string[] = [];

  for (const el of elements) {
    const text = el.text().trim();
    const isNegatedString = el.kind() === 'string' && (text.startsWith("'!") || text.startsWith('"!'));
    if (isNegatedString) {
      const quote = text[0];
      excludeItems.push(`${quote}${text.slice(2)}`);
    } else {
      includeItems.push(text);
    }
  }

  return {
    include: includeItems.length > 0 ? (['include', `[${includeItems.join(', ')}]`] as const) : undefined,
    exclude: excludeItems.length > 0 ? (['exclude', `[${excludeItems.join(', ')}]`] as const) : undefined,
  };
}

function extractCoverageThresholds(configPairs: Array<SgNode<TypesMap>>): string | undefined {
  const coverageThresholdNode = findValueNodeInPairs(configPairs, 'coverageThreshold');
  if (coverageThresholdNode == null) return undefined;

  const thresholdPairs = coverageThresholdNode.children().filter(c => c.kind() === 'pair');
  const globalPair = thresholdPairs.find(pair => getPairKeyText(pair) === 'global');
  if (globalPair == null) return undefined;

  return globalPair.children().at(-1)?.text() ?? undefined;
}

function extractGlobals(configPairs: Array<SgNode<TypesMap>>): ReadonlyArray<readonly [string, string]> {
  const globalsNode = findValueNodeInPairs(configPairs, 'globals');
  if (globalsNode == null || isEmptyCollectionNode(globalsNode)) return [];

  const pairs = getDirectPairs(globalsNode);
  const result: Array<readonly [string, string]> = [];
  for (const pair of pairs) {
    const key = getPairKeyText(pair);
    if (key == null) continue;
    const valueNode = pair.children().at(-1);
    if (valueNode == null) continue;
    const value = valueNode.text().trim();
    result.push([key, value] as const);
  }
  return result;
}

interface ModuleNameMapperResult {
  aliases: ReadonlyArray<readonly [string, string]>;
  hasCssMock: boolean;
}

function extractModuleNameMapper(configPairs: Array<SgNode<TypesMap>>): ModuleNameMapperResult {
  const mapperNode = findValueNodeInPairs(configPairs, 'moduleNameMapper');
  if (mapperNode == null || isEmptyCollectionNode(mapperNode)) return { aliases: [], hasCssMock: false };

  const pairs = getDirectPairs(mapperNode);
  const aliases: Array<readonly [string, string]> = [];
  let hasCssMock = false;

  for (const pair of pairs) {
    const rawKey = getPairKeyText(pair);
    if (rawKey == null) continue;

    const valueNode = pair.children().at(-1);
    if (valueNode == null) continue;
    const rawValue = valueNode
      .text()
      .trim()
      .replace(/^['"]|['"]$/g, '');

    if (CSS_REGEX_PATTERN.test(rawKey)) {
      hasCssMock = true;
      continue;
    }
    if (IMAGE_REGEX_PATTERN.test(rawKey)) {
      continue;
    }

    let aliasKey = rawKey;
    if (aliasKey.startsWith('^') && aliasKey.endsWith('$')) {
      aliasKey = aliasKey.slice(1, -1);
    } else if (aliasKey.startsWith('^')) {
      aliasKey = aliasKey.slice(1);
    }

    const aliasValue = rawValue.replace(/<rootDir>\/?/g, './').replace(/\$1/g, '$1');

    aliases.push([aliasKey, aliasValue] as const);
  }

  return { aliases, hasCssMock };
}

function extractSnapshotSerializers(configPairs: Array<SgNode<TypesMap>>): ReadonlyArray<string> | undefined {
  const node = findValueNodeInPairs(configPairs, 'snapshotSerializers');
  if (node == null || isEmptyCollectionNode(node) || node.kind() !== 'array') return undefined;
  return extractLiteralArrayElements(node);
}

function hasTransformIgnorePatterns(configPairs: Array<SgNode<TypesMap>>): boolean {
  const valueNode = findValueNodeInPairs(configPairs, 'transformIgnorePatterns');
  return valueNode != null && !isEmptyCollectionNode(valueNode);
}

function normalizeTestEnvironment(value: string): string {
  const stripped = value.replace(/^['"]|['"]$/g, '');
  if (stripped === 'jsdom' || stripped === 'node') return value;
  if (stripped.includes('jsdom')) return "'jsdom'";
  return "'jsdom'";
}

export interface VitestConfigMapping {
  testProperties: ReadonlyArray<readonly [string, string]>;
  setupFiles?: ReadonlyArray<string> | undefined;
  coverageProperties: ReadonlyArray<readonly [string, string]>;
  coverageThresholds: string | undefined;
  pathAliases?: ReadonlyArray<readonly [string, string]>;
  moduleNameMapperAliases?: ReadonlyArray<readonly [string, string]>;
  hasCssMock?: boolean;
  globals?: ReadonlyArray<readonly [string, string]>;
  snapshotSerializers?: ReadonlyArray<string> | undefined;
  hasTransformIgnorePatterns?: boolean;
  customExportConditions?: string | undefined;
  moduleDirectories?: ReadonlyArray<string>;
  autoMocks?: ReadonlyArray<{ moduleName: string; mockPath: string }>;
  autoMockSetupFile?: string | undefined;
  additionalSetupFiles?: ReadonlyArray<string>;
  rawTestEnvironment?: string | undefined;
}

export function extractTsconfigPathAliases(tsconfigContent: string): ReadonlyArray<readonly [string, string]> {
  let tsconfig: unknown;
  try {
    tsconfig = parseJsonc(tsconfigContent);
  } catch {
    return [];
  }

  if (!isPlainObject<Record<string, unknown>>(tsconfig)) return [];
  const compilerOptions = tsconfig['compilerOptions'];
  if (!isPlainObject<Record<string, unknown>>(compilerOptions)) return [];
  const paths = compilerOptions['paths'];
  if (!isPlainObject<Record<string, unknown>>(paths)) return [];

  const result: Array<readonly [string, string]> = [];
  for (const [key, value] of Object.entries(paths)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const alias = key.replace(/\/\*$/, '');
    const resolvedPath = String(value[0]).replace(/\/\*$/, '');
    result.push([alias, resolvedPath] as const);
  }
  return result;
}

export async function extractVitestConfigFromJestConfig(jestConfigContent: string): Promise<VitestConfigMapping> {
  const ast = await parseAsync(Lang.TypeScript, jestConfigContent);
  const root = ast.root();

  const configObjectNode = findConfigObjectNode(root);
  const configPairs = configObjectNode != null ? getDirectPairs(configObjectNode) : [];

  const testProperties: Array<readonly [string, string]> = [];
  const coverageProperties: Array<readonly [string, string]> = [];

  let rawTestEnvironment: string | undefined;
  for (const [jestKey, vitestKey] of JEST_TO_VITEST_TEST_PROPERTY_MAPPINGS) {
    const valueNode = findValueNodeInPairs(configPairs, jestKey);
    if (valueNode == null || isEmptyCollectionNode(valueNode)) continue;

    let value = valueNode.text();
    if (jestKey === 'testEnvironment') {
      rawTestEnvironment = value;
      value = normalizeTestEnvironment(value);
    }
    if (jestKey === 'testMatch' && valueNode.kind() === 'array') {
      const hasSpreadElements = valueNode.children().some(c => c.kind() === 'spread_element');
      if (hasSpreadElements) continue;
    }
    testProperties.push([vitestKey, value] as const);
  }

  const setupFiles = extractSetupFiles(configPairs);

  for (const [jestKey, vitestKey] of JEST_TO_VITEST_COVERAGE_PROPERTY_MAPPINGS) {
    const valueNode = findValueNodeInPairs(configPairs, jestKey);
    if (valueNode == null || isEmptyCollectionNode(valueNode)) continue;
    coverageProperties.push([vitestKey, valueNode.text()] as const);
  }

  const { include: coverageInclude, exclude: coverageExclude } = extractCoverageIncludeAndExclude(configPairs);
  if (coverageInclude != null) coverageProperties.push(coverageInclude);
  if (coverageExclude != null) coverageProperties.push(coverageExclude);

  const coverageThresholds = extractCoverageThresholds(configPairs);
  const globals = extractGlobals(configPairs);
  const { aliases: moduleNameMapperAliases, hasCssMock } = extractModuleNameMapper(configPairs);
  const snapshotSerializers = extractSnapshotSerializers(configPairs);

  let customExportConditions: string | undefined;
  const envOptionsNode = findValueNodeInPairs(configPairs, 'testEnvironmentOptions');
  if (envOptionsNode != null && !isEmptyCollectionNode(envOptionsNode)) {
    const envOptionPairs = getDirectPairs(envOptionsNode);
    const conditionsNode = findValueNodeInPairs(envOptionPairs, 'customExportConditions');
    if (conditionsNode != null && !isEmptyCollectionNode(conditionsNode)) {
      customExportConditions = conditionsNode.text();
    }
  }

  const moduleDirsNode = findValueNodeInPairs(configPairs, 'moduleDirectories');
  const moduleDirectories: string[] = [];
  if (moduleDirsNode != null && !isEmptyCollectionNode(moduleDirsNode)) {
    const elements = extractLiteralArrayElements(moduleDirsNode);
    for (const el of elements) {
      const stripped = el.replace(/^['"]|['"]$/g, '');
      if (stripped !== 'node_modules') {
        moduleDirectories.push(stripped);
      }
    }
  }

  return {
    testProperties,
    setupFiles,
    coverageProperties,
    coverageThresholds,
    globals,
    moduleNameMapperAliases,
    hasCssMock,
    snapshotSerializers,
    hasTransformIgnorePatterns: hasTransformIgnorePatterns(configPairs),
    customExportConditions,
    moduleDirectories,
    rawTestEnvironment,
  };
}

function moduleSpecifierOf(importLine: string): string | undefined {
  return /from '([^']+)';$/.exec(importLine)?.[1];
}

export function buildVitestConfigContent(mapping: VitestConfigMapping): string {
  const { testProperties, coverageProperties, coverageThresholds } = mapping;
  const additionalSetupFiles = mapping.additionalSetupFiles ?? [];
  const pathAliases = mapping.pathAliases ?? [];
  const moduleNameMapperAliases = mapping.moduleNameMapperAliases ?? [];
  const globals = mapping.globals ?? [];
  const hasCssMock = mapping.hasCssMock ?? false;
  const hasTransformIgnore = mapping.hasTransformIgnorePatterns ?? false;

  const hasCoverageProps = coverageProperties.length > 0 || coverageThresholds != null;
  const hasPathAliases = pathAliases.length > 0;
  const hasModuleAliases = moduleNameMapperAliases.length > 0;
  const hasGlobals = globals.length > 0;
  const hasGeneratedSetupFiles =
    additionalSetupFiles.length > 0 ||
    mapping.autoMockSetupFile != null ||
    testProperties.some(([key]) => key === 'setupFiles');
  const hasAnyProps =
    testProperties.length > 0 || hasCoverageProps || hasCssMock || hasTransformIgnore || hasGeneratedSetupFiles;

  const needsPluginType = hasCssMock && hasTransformIgnore;

  const builtinImports = hasModuleAliases ? ["import path from 'node:path';"] : [];
  const externalImports = ["import { defineConfig } from 'vitest/config';"];
  if (needsPluginType) {
    externalImports.push("import type { Plugin } from 'vitest/config';");
  }
  if (hasPathAliases) {
    externalImports.push("import tsconfigPaths from 'vite-tsconfig-paths';");
  }
  externalImports.sort((a, b) => (moduleSpecifierOf(a) ?? a).localeCompare(moduleSpecifierOf(b) ?? b));
  const importLines = builtinImports.length > 0 ? [...builtinImports, '', ...externalImports] : externalImports;

  const needsCssMockPlugin = hasCssMock && hasTransformIgnore;

  if (!hasAnyProps && !hasPathAliases && !hasModuleAliases && !hasGlobals) {
    return [
      ...importLines,
      '',
      'export default defineConfig({',
      '  // Configure Vitest (https://vitest.dev/config/)',
      '  test: {},',
      '});',
    ].join('\n');
  }

  const preConfigLines: string[] = [];
  if (needsCssMockPlugin) {
    preConfigLines.push(
      '',
      'const CSS_EXTENSIONS = /\\.(css|scss|sass|less|styl)(\\?.*)?$/;',
      "const CSS_MOCK_PREFIX = '\\0css-mock:';",
      '',
      'function cssMockPlugin(): Plugin {',
      '  return {',
      "    name: 'vitest-css-mock',",
      "    enforce: 'pre',",
      '    resolveId(source: string) {',
      '      if (CSS_EXTENSIONS.test(source)) {',
      "        return CSS_MOCK_PREFIX + source + '.js';",
      '      }',
      '    },',
      '    load(id: string) {',
      '      if (id.startsWith(CSS_MOCK_PREFIX)) {',
      "        return 'export default {};';",
      '      }',
      '    },',
      '  };',
      '}',
    );
  }

  const pluginsEntries: string[] = [];
  if (hasPathAliases) {
    pluginsEntries.push('tsconfigPaths()');
  }
  if (needsCssMockPlugin) {
    pluginsEntries.push('cssMockPlugin()');
  }

  const pluginsLines: string[] = [];
  if (pluginsEntries.length > 0) {
    pluginsLines.push(`  plugins: [${pluginsEntries.join(', ')}],`);
  }

  const hasCustomExportConditions = (mapping.customExportConditions ?? undefined) != null;
  const needsResolveBlock = hasModuleAliases || hasCustomExportConditions;
  const resolveLines: string[] = [];
  if (needsResolveBlock) {
    resolveLines.push('  resolve: {');
    if (hasModuleAliases) {
      resolveLines.push('    alias: {');
      for (const [alias, aliasPath] of moduleNameMapperAliases) {
        const needsPathResolve = aliasPath.startsWith('./') || aliasPath.startsWith('../');
        if (needsPathResolve) {
          resolveLines.push(`      ${JSON.stringify(alias)}: path.resolve(__dirname, ${JSON.stringify(aliasPath)}),`);
        } else {
          resolveLines.push(`      ${JSON.stringify(alias)}: ${JSON.stringify(aliasPath)},`);
        }
      }
      resolveLines.push('    },');
    }
    if (hasCustomExportConditions) {
      resolveLines.push("    conditions: ['import', 'module', 'browser', 'default'],");
    }
    resolveLines.push('  },');
  }

  const defineLines: string[] = [];
  if (hasGlobals) {
    defineLines.push('  define: {');
    for (const [key, value] of globals) {
      const isStringLiteral =
        (value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'));
      if (isStringLiteral) {
        defineLines.push(`    ${key}: JSON.stringify(${value}),`);
      } else {
        defineLines.push(`    ${key}: ${value},`);
      }
    }
    defineLines.push('  },');
  }

  const testLines = ['    globals: true,'];
  if (hasCssMock) {
    testLines.push('    css: false,');
  }

  for (const [key, value] of testProperties) {
    if (key === 'setupFiles') {
      let updatedValue = value;
      for (const extra of additionalSetupFiles) {
        updatedValue = updatedValue.replace(/\]$/, `, '${extra}']`);
      }
      if (mapping.autoMockSetupFile) {
        updatedValue = updatedValue.replace(/\]$/, `, './${mapping.autoMockSetupFile}']`);
      }
      testLines.push(`    ${key}: ${updatedValue},`);
    } else {
      testLines.push(`    ${key}: ${value},`);
    }
  }

  if (!testProperties.some(([key]) => key === 'setupFiles')) {
    const setupEntries: string[] = [];
    for (const extra of additionalSetupFiles) {
      setupEntries.push(`'${extra}'`);
    }
    if (mapping.autoMockSetupFile) {
      setupEntries.push(`'./${mapping.autoMockSetupFile}'`);
    }
    if (setupEntries.length > 0) {
      testLines.push(`    setupFiles: [${setupEntries.join(', ')}],`);
    }
  }

  if (hasTransformIgnore) {
    testLines.push('    server: {');
    testLines.push('      deps: {');
    testLines.push('        inline: true,');
    testLines.push('        fallbackCJS: true,');
    testLines.push('      },');
    testLines.push('    },');
  }

  if (hasCoverageProps) {
    testLines.push('    coverage: {');
    for (const [key, value] of coverageProperties) {
      testLines.push(`      ${key}: ${value},`);
    }
    if (coverageThresholds != null) {
      testLines.push(`      thresholds: ${coverageThresholds},`);
    }
    testLines.push('    },');
  }

  const testBlock = testLines.length > 0 ? ['  test: {', ...testLines, '  },'] : ['  test: {},'];

  return [
    ...importLines,
    ...preConfigLines,
    '',
    'export default defineConfig({',
    ...pluginsLines,
    ...resolveLines,
    ...defineLines,
    ...testBlock,
    '});',
  ].join('\n');
}
