import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Lang, parseAsync, type SgNode, type SgRoot } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Codemod, Modifications, RunCodemodOkResult } from '../../kit/types.ts';
import { omitBy } from '../../utils/objects.ts';
import { findAndReplaceConfigModifications } from '../utils/find-and-replace.ts';
import addVitestImports from './rules/add-vitest-imports.ts';
import { doneCallbackToPromise } from './rules/done-callback-to-promise.ts';
import jestFocusedSkippedToVitest from './rules/jest-focused-skipped-to-vitest.ts';
import jestHooksToVitest from './rules/jest-hooks-to-vitest.ts';
import jestMockTypeToVitest from './rules/jest-mock-type-to-vitest.ts';
import removeJestImport from './rules/remove-jest-import.ts';
import replaceJestApiWithVi, {
  convertMockImplArrowToFunction,
  fixViCompatIssues,
  normalizeViMockFactories,
  replaceJestDontMock,
  replaceJestRequireActual,
  replaceJestRequireMock,
} from './rules/replace-jest-api-with-vi.ts';
import { requireToDynamicImport } from './rules/require-to-dynamic-import.ts';
import hasAnyJestGlobalAPI from './utils/has-any-jest-global-api.ts';
import {
  buildVitestConfigContent,
  extractTsconfigPathAliases,
  extractVitestConfigFromJestConfig,
  type VitestConfigMapping,
} from './utils/jest-config-to-vitest-config.ts';

type AutoMockEntry = { moduleName: string; mockPath: string };

const TEST_FILE_REGEX = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const SOURCE_FILE_REGEX = /\.(ts|tsx|js|jsx)$/;

export const JEST_TO_VITEST_LANGUAGE = Lang.TypeScript;
export const JEST_TO_VITEST_TSX_LANGUAGE = Lang.Tsx;

function detectLanguageFromFilename(filename?: string): Lang {
  if (filename == null) return JEST_TO_VITEST_LANGUAGE;
  if (filename.endsWith('.tsx') || filename.endsWith('.jsx') || filename.endsWith('.js')) {
    return JEST_TO_VITEST_TSX_LANGUAGE;
  }

  return JEST_TO_VITEST_LANGUAGE;
}

function jestToVitestFilter(root: SgNode<TypesMap, Kinds<TypesMap>>): boolean {
  if (hasAnyJestGlobalAPI(root)) return true;

  return root.find({ rule: { pattern: 'jest.$REST' } }) != null;
}

export function makeJestToVitestInitialModification(ast: SgRoot<TypesMap>, filename?: string): Modifications {
  return {
    lang: detectLanguageFromFilename(filename),
    report: { changesApplied: 0 },
    ast,
    filename,
    history: [ast],
  };
}

export async function jestToVitestModifications(modifications: Modifications): Promise<Modifications> {
  if (!jestToVitestFilter(modifications.ast.root())) return fixViCompatIssues(modifications);

  return replaceJestApiWithVi(modifications)
    .then(replaceJestDontMock)
    .then(replaceJestRequireActual)
    .then(replaceJestRequireMock)
    .then(normalizeViMockFactories)
    .then(convertMockImplArrowToFunction)
    .then(doneCallbackToPromise)
    .then(requireToDynamicImport)
    .then(jestFocusedSkippedToVitest)
    .then(jestHooksToVitest)
    .then(jestMockTypeToVitest)
    .then(addVitestImports)
    .then(removeJestImport)
    .then(fixViCompatIssues);
}

export async function jestToVitestTransformer(
  content: SgRoot<TypesMap> | string,
  filename?: string,
): Promise<Modifications> {
  const ast = typeof content === 'string' ? await parseAsync(detectLanguageFromFilename(filename), content) : content;

  return jestToVitestModifications(makeJestToVitestInitialModification(ast, filename));
}

export async function jestToVitest(content: SgRoot<TypesMap> | string, filename?: string): Promise<string> {
  const modifications = await jestToVitestTransformer(content, filename);

  return modifications.ast.root().text();
}

const ALWAYS_VITEST_DEV_DEPENDENCIES: Record<string, string> = {
  vitest: '^5.0.0',
  '@vitest/coverage-v8': '^5.0.0',
};

const CONDITIONAL_DEV_DEPENDENCIES: Record<
  string,
  { version: string; condition: (mapping: VitestConfigMapping) => boolean }
> = {
  jsdom: {
    version: '^30.0.1',
    condition: mapping =>
      mapping.testProperties.some(([key, value]) => key === 'environment' && value.includes('jsdom')),
  },
  'vite-tsconfig-paths': {
    version: '^6.1.1',
    condition: mapping => (mapping.pathAliases ?? []).length > 0,
  },
  'vitest-canvas-mock': {
    version: '^1.2.0',
    condition: mapping => mapping.setupFiles?.some(setupFile => setupFile.includes('vitest-canvas-mock')) ?? false,
  },
};

function vitestConfigNameToSnapshotSerializerSetupName(vitestConfigName: string): string {
  return vitestConfigName.replace(/\.ts$/, '.snapshot-serializers.setup.ts');
}

function vitestConfigNameToSetupFileName(vitestConfigName: string): string {
  return vitestConfigName.replace(/\.ts$/, '.setup.ts');
}

function isQuotedStringLiteral(value: string): boolean {
  return (
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2) ||
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
  );
}

function toImportStringLiteral(value: string): string {
  return isQuotedStringLiteral(value) ? value : JSON.stringify(value);
}

async function generateSnapshotSerializerSetup(
  root: string,
  setupFileName: string,
  snapshotSerializers?: ReadonlyArray<string>,
): Promise<string | undefined> {
  const serializerLiterals = (snapshotSerializers ?? []).filter(isQuotedStringLiteral);
  if (serializerLiterals.length === 0) return undefined;

  const setupLines = serializerLiterals.map(
    (serializer, index) => `import * as snapshotSerializer${index}Module from ${serializer};`,
  );
  setupLines.push('');
  for (const [index] of serializerLiterals.entries()) {
    setupLines.push(
      `const snapshotSerializer${index} = 'default' in snapshotSerializer${index}Module ? snapshotSerializer${index}Module.default : snapshotSerializer${index}Module;`,
      `expect.addSnapshotSerializer(snapshotSerializer${index} as Parameters<typeof expect.addSnapshotSerializer>[0]);`,
    );
    if (index < serializerLiterals.length - 1) setupLines.push('');
  }

  await fs.writeFile(path.join(root, setupFileName), `${setupLines.join('\n')}\n`);

  return setupFileName;
}

async function generateVitestSetupFile(
  root: string,
  setupFileName: string,
  setupEntries: ReadonlyArray<string>,
): Promise<string | undefined> {
  const uniqueSetupEntries = [...new Set(setupEntries.map(toImportStringLiteral))];
  if (uniqueSetupEntries.length === 0) return undefined;

  await fs.writeFile(path.join(root, setupFileName), `${uniqueSetupEntries.map(e => `import ${e};`).join('\n')}\n`);

  return setupFileName;
}

function jestConfigNameToVitestConfigName(jestConfigName: string): string {
  const match = jestConfigName.match(/^jest\.(.+\.config)\.[jt]s$/);

  return match?.[1] == null ? 'vitest.config.ts' : `vitest.${match[1]}.ts`;
}

async function loadVitestConfigMapping(
  root: string,
  jestConfigName: string | undefined,
  pathAliases: ReadonlyArray<readonly [string, string]>,
): Promise<VitestConfigMapping> {
  const defaultMapping: VitestConfigMapping = {
    testProperties: [],
    coverageProperties: [],
    coverageThresholds: undefined,
    pathAliases,
  };
  if (jestConfigName == null) return defaultMapping;

  try {
    const jestConfigContent = await fs.readFile(path.join(root, jestConfigName), { encoding: 'utf-8' });
    const mapping = await extractVitestConfigFromJestConfig(jestConfigContent);

    return { ...mapping, pathAliases: pathAliases.length > 0 ? pathAliases : (mapping.pathAliases ?? []) };
  } catch {
    return defaultMapping;
  }
}

async function withGeneratedSetupFiles(
  root: string,
  vitestConfigName: string,
  mapping: VitestConfigMapping,
  hasJestDom: boolean,
): Promise<VitestConfigMapping> {
  const snapshotSerializerSetupFile = await generateSnapshotSerializerSetup(
    root,
    vitestConfigNameToSnapshotSerializerSetupName(vitestConfigName),
    mapping.snapshotSerializers,
  );
  const setupEntries = [...(mapping.setupFiles ?? []), ...(mapping.additionalSetupFiles ?? [])];
  if (hasJestDom) setupEntries.push("'@testing-library/jest-dom/extend-expect'");
  if (snapshotSerializerSetupFile != null) setupEntries.push(`'./${snapshotSerializerSetupFile}'`);

  const generatedSetupFile = await generateVitestSetupFile(
    root,
    vitestConfigNameToSetupFileName(vitestConfigName),
    setupEntries,
  );
  const additionalSetupFiles = generatedSetupFile == null ? [] : [`./${generatedSetupFile}`];

  return { ...mapping, snapshotSerializers: undefined, additionalSetupFiles };
}

async function scanAutoMocks(dir: string, prefix: string, results: Array<AutoMockEntry>, moduleDir: string) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await scanAutoMocks(
        path.join(dir, entry.name),
        prefix ? `${prefix}/${entry.name}` : entry.name,
        results,
        moduleDir,
      );
      continue;
    }
    if (!entry.isFile() || !SOURCE_FILE_REGEX.test(entry.name)) continue;

    const nameWithoutExtension = entry.name.replace(SOURCE_FILE_REGEX, '');
    const moduleName = prefix ? `${prefix}/${nameWithoutExtension}` : nameWithoutExtension;
    results.push({ moduleName, mockPath: `./${moduleDir}/__mocks__/${moduleName}` });
  }
}

async function collectAutoMocks(root: string, moduleDirectories: ReadonlyArray<string>): Promise<Array<AutoMockEntry>> {
  const autoMocks: Array<AutoMockEntry> = [];
  for (const moduleDir of moduleDirectories) {
    try {
      await scanAutoMocks(path.join(root, moduleDir, '__mocks__'), '', autoMocks, moduleDir);
    } catch {}
  }

  return autoMocks;
}

async function rewriteAutoMockFactoriesInFile(
  filePath: string,
  autoMocks: ReadonlyMap<string, string>,
  projectRoot: string,
): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(filePath, { encoding: 'utf-8' });
  } catch {
    return;
  }

  const ast = await parseAsync(detectLanguageFromFilename(filePath), content);
  const modifications = await findAndReplaceConfigModifications(makeJestToVitestInitialModification(ast, filePath), [
    {
      rule: { pattern: 'vi.mock($PATH)' },
      transformer: node => {
        const pathMatch = node.getMatch('PATH')?.text().trim();
        if (pathMatch == null) return undefined;

        const mockPath = autoMocks.get(pathMatch.replace(/^['"]|['"]$/g, ''));
        if (mockPath == null) return undefined;

        const absoluteMockPath = path.resolve(projectRoot, mockPath.replace(/^\.\//, ''));
        const relativeMockPath = path.relative(path.dirname(filePath), absoluteMockPath);
        const importPath = relativeMockPath.startsWith('.') ? relativeMockPath : `./${relativeMockPath}`;

        return `vi.mock(${pathMatch}, () => import(${JSON.stringify(importPath)}))`;
      },
    },
  ]);

  const updatedSource = modifications.ast.root().text();
  if (updatedSource !== content) await fs.writeFile(filePath, updatedSource);
}

async function rewriteAutoMockFactoriesInTransformedFiles(
  root: string,
  autoMocks: Array<AutoMockEntry>,
): Promise<void> {
  const autoMockMap = new Map(autoMocks.map(entry => [entry.moduleName, entry.mockPath]));

  async function walkDir(dir: string): Promise<void> {
    let entries: Array<Dirent>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '__mocks__') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && TEST_FILE_REGEX.test(entry.name)) {
        await rewriteAutoMockFactoriesInFile(fullPath, autoMockMap, root);
      }
    }
  }

  await walkDir(root);
}

async function updatePackageJSONDevDependencies(
  root: string,
  packageJSONContent: string,
  packageJSON: Record<string, unknown>,
  mapping: VitestConfigMapping,
): Promise<void> {
  const conditionalDependencies = Object.fromEntries(
    Object.entries(CONDITIONAL_DEV_DEPENDENCIES)
      .filter(([, { condition }]) => condition(mapping))
      .map(([name, { version }]) => [name, version]),
  );
  const devDependencies = omitBy(
    Object.fromEntries(
      Object.entries({
        ...((packageJSON['devDependencies'] as Record<string, string> | undefined) ?? {}),
        ...ALWAYS_VITEST_DEV_DEPENDENCIES,
        ...conditionalDependencies,
      }).sort(([a], [b]) => a.localeCompare(b)),
    ),
    value => value == null,
  );

  const indentMatch = packageJSONContent.match(/^(\s+)"/m);
  const indent = indentMatch?.[1]?.length ?? 2;
  const updated = { ...packageJSON, devDependencies };
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify(updated, undefined, indent)}\n`);
}

async function jestToVitestPostTransform({
  root,
}: {
  root: string;
  results: Array<RunCodemodOkResult>;
}): Promise<void> {
  let content: Array<Dirent>;
  try {
    content = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  let pathAliases: ReadonlyArray<readonly [string, string]> = [];
  try {
    pathAliases = extractTsconfigPathAliases(
      await fs.readFile(path.join(root, 'tsconfig.json'), { encoding: 'utf-8' }),
    );
  } catch {}

  let packageJSONContent: string | undefined;
  try {
    packageJSONContent = await fs.readFile(path.join(root, 'package.json'), { encoding: 'utf-8' });
  } catch {}
  const packageJSON =
    packageJSONContent == null ? undefined : (JSON.parse(packageJSONContent) as Record<string, unknown> | undefined);
  const allDependencies = {
    ...((packageJSON?.['dependencies'] as Record<string, string> | undefined) ?? {}),
    ...((packageJSON?.['devDependencies'] as Record<string, string> | undefined) ?? {}),
  };
  const hasJestDom = allDependencies['@testing-library/jest-dom'] != null;

  const primaryJestConfig = content.find(item => item.isFile() && item.name.startsWith('jest.config.'));
  const primaryMapping = await withGeneratedSetupFiles(
    root,
    'vitest.config.ts',
    await loadVitestConfigMapping(root, primaryJestConfig?.name, pathAliases),
    hasJestDom,
  );

  if (!content.some(item => item.isFile() && item.name.startsWith('vitest.config.'))) {
    await fs.writeFile(path.join(root, 'vitest.config.ts'), buildVitestConfigContent(primaryMapping));
  }

  const additionalJestConfigs = content.filter(item => item.isFile() && /^jest\..+\.config\.[jt]s$/.test(item.name));
  for (const jestConfig of additionalJestConfigs) {
    const vitestConfigName = jestConfigNameToVitestConfigName(jestConfig.name);
    if (content.some(item => item.isFile() && item.name === vitestConfigName)) continue;

    const mapping = await withGeneratedSetupFiles(
      root,
      vitestConfigName,
      await loadVitestConfigMapping(root, jestConfig.name, pathAliases),
      hasJestDom,
    );
    await fs.writeFile(path.join(root, vitestConfigName), buildVitestConfigContent(mapping));
  }

  const autoMocks = await collectAutoMocks(root, primaryMapping.moduleDirectories ?? []);
  if (autoMocks.length > 0) await rewriteAutoMockFactoriesInTransformedFiles(root, autoMocks);

  if (packageJSON != null && packageJSONContent != null) {
    await updatePackageJSONDevDependencies(root, packageJSONContent, packageJSON, primaryMapping);
  }
}

export const JEST_TO_VITEST_CODEMOD: Codemod = {
  name: 'jest-to-vitest-transformer',
  languages: [JEST_TO_VITEST_LANGUAGE, JEST_TO_VITEST_TSX_LANGUAGE],
  transformer: jestToVitest,
  postTransform: jestToVitestPostTransform,
};

export default jestToVitest;
