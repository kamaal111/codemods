import {
  buildVitestConfigContent,
  extractTsconfigPathAliases,
  extractVitestConfigFromJestConfig,
} from '../../../../src/codemods/jest-to-vitest/utils/jest-config-to-vitest-config';

describe('locating the config object', () => {
  it('reads a CommonJS module.exports object', async () => {
    const mapping = await extractVitestConfigFromJestConfig("module.exports = { testEnvironment: 'node' };");

    expect(mapping.testProperties).toContainEqual(['environment', "'node'"]);
  });

  it('reads the second argument of a module.exports = Object.assign(...) config', async () => {
    const config = "module.exports = Object.assign(baseConfig, { testEnvironment: 'node', testTimeout: 42 });";
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.testProperties).toContainEqual(['testTimeout', '42']);
  });

  it('ignores a module.exports that is not an object literal', async () => {
    const mapping = await extractVitestConfigFromJestConfig('module.exports = buildConfig();');

    expect(mapping.testProperties).toHaveLength(0);
  });

  it('ignores an Object.assign whose second argument is not an object literal', async () => {
    const mapping = await extractVitestConfigFromJestConfig('module.exports = Object.assign(base, extra);');

    expect(mapping.testProperties).toHaveLength(0);
  });

  it('returns an empty mapping when there is no config object at all', async () => {
    const mapping = await extractVitestConfigFromJestConfig('const unrelated = 1;');

    expect(mapping.testProperties).toHaveLength(0);
    expect(mapping.coverageProperties).toHaveLength(0);
  });
});

describe('test environment normalization', () => {
  it('keeps a plain node environment', async () => {
    const mapping = await extractVitestConfigFromJestConfig("export default { testEnvironment: 'node' };");

    expect(mapping.testProperties).toContainEqual(['environment', "'node'"]);
  });

  it('normalizes a jest-environment-jsdom package name to jsdom', async () => {
    const config = "export default { testEnvironment: 'jest-environment-jsdom' };";
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.testProperties).toContainEqual(['environment', "'jsdom'"]);
    expect(mapping.rawTestEnvironment).toBe("'jest-environment-jsdom'");
  });

  it('falls back to jsdom for a custom environment path, and keeps the raw value', async () => {
    const mapping = await extractVitestConfigFromJestConfig("export default { testEnvironment: './config/env.js' };");

    expect(mapping.testProperties).toContainEqual(['environment', "'jsdom'"]);
    expect(mapping.rawTestEnvironment).toBe("'./config/env.js'");
  });
});

describe('moduleNameMapper aliases', () => {
  it('strips anchors from a fully anchored alias key', async () => {
    const config = `export default { moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' } };`;
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.moduleNameMapperAliases).toEqual([['@/(.*)', './src/$1']]);
  });

  it('strips a leading anchor from a prefix-only alias key', async () => {
    const config = `export default { moduleNameMapper: { '^lodash-es': 'lodash' } };`;
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.moduleNameMapperAliases).toEqual([['lodash-es', 'lodash']]);
  });

  it('routes style and asset mappings to the css mock rather than an alias', async () => {
    const config = `export default { moduleNameMapper: { '\\\\.(css|less)$': 'identity-obj-proxy' } };`;
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.hasCssMock).toBe(true);
    expect(mapping.moduleNameMapperAliases ?? []).toHaveLength(0);
  });
});

describe('options that are skipped rather than mistranslated', () => {
  it('skips a testMatch built with a spread, whose value cannot be read statically', async () => {
    const config = 'export default { testMatch: [...sharedPatterns, "**/*.test.ts"], testTimeout: 1 };';
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.testProperties.map(([key]) => key)).not.toContain('include');
    expect(mapping.testProperties).toContainEqual(['testTimeout', '1']);
  });

  it('reads customExportConditions out of testEnvironmentOptions', async () => {
    const config = "export default { testEnvironmentOptions: { customExportConditions: ['worker'] } };";
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.customExportConditions).toBe("['worker']");
  });

  it('ignores empty testEnvironmentOptions', async () => {
    const mapping = await extractVitestConfigFromJestConfig('export default { testEnvironmentOptions: {} };');

    expect(mapping.customExportConditions).toBeUndefined();
  });

  it('reads moduleDirectories, dropping node_modules which has no __mocks__ to scan', async () => {
    const config = "export default { moduleDirectories: ['tests', 'node_modules'] };";
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.moduleDirectories).toEqual(['tests']);
  });

  it('detects transformIgnorePatterns, which needs inlined deps under Vitest', async () => {
    const config = "export default { transformIgnorePatterns: ['/node_modules/(?!lodash-es)'] };";
    const mapping = await extractVitestConfigFromJestConfig(config);

    expect(mapping.hasTransformIgnorePatterns).toBe(true);
  });

  it('treats empty transformIgnorePatterns as absent', async () => {
    const mapping = await extractVitestConfigFromJestConfig('export default { transformIgnorePatterns: [] };');

    expect(mapping.hasTransformIgnorePatterns).toBe(false);
  });

  it('maps only non-negated collectCoverageFrom entries when there are no negations', async () => {
    const mapping = await extractVitestConfigFromJestConfig("export default { collectCoverageFrom: ['src/**/*.ts'] };");

    expect(mapping.coverageProperties).toContainEqual(['include', "['src/**/*.ts']"]);
    expect(mapping.coverageProperties.map(([key]) => key)).not.toContain('exclude');
  });
});

describe('tsconfig path aliases', () => {
  it('returns nothing when the tsconfig is not an object', () => {
    expect(extractTsconfigPathAliases('[]')).toEqual([]);
  });

  it('returns nothing when the tsconfig cannot be parsed', () => {
    expect(extractTsconfigPathAliases('{ not json')).toEqual([]);
  });

  it('returns nothing when there are no paths', () => {
    expect(extractTsconfigPathAliases('{ "compilerOptions": {} }')).toEqual([]);
  });

  it('reads paths as bare prefixes, tolerating comments', () => {
    const tsconfig = '{\n  // a comment\n  "compilerOptions": { "paths": { "@/*": ["src/*"] } }\n}';

    expect(extractTsconfigPathAliases(tsconfig)).toEqual([['@', 'src']]);
  });
});

describe('building the config content', () => {
  it('emits an empty test block when there is nothing to configure', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: undefined,
    });

    expect(content).toContain('test: {}');
  });

  it('appends generated setup files to an existing setupFiles entry', () => {
    const content = buildVitestConfigContent({
      testProperties: [['setupFiles', "['./existing.ts']"]],
      coverageProperties: [],
      coverageThresholds: undefined,
      additionalSetupFiles: ['./generated.ts'],
    });

    expect(content).toContain("setupFiles: ['./existing.ts', './generated.ts']");
  });

  it('appends the auto-mock setup file to an existing setupFiles entry', () => {
    const content = buildVitestConfigContent({
      testProperties: [['setupFiles', "['./existing.ts']"]],
      coverageProperties: [],
      coverageThresholds: undefined,
      autoMockSetupFile: 'automocks.ts',
    });

    expect(content).toContain("setupFiles: ['./existing.ts', './automocks.ts']");
  });

  it('creates a setupFiles entry from the auto-mock setup file alone', () => {
    const content = buildVitestConfigContent({
      testProperties: [['environment', "'node'"]],
      coverageProperties: [],
      coverageThresholds: undefined,
      autoMockSetupFile: 'automocks.ts',
    });

    expect(content).toContain("setupFiles: ['./automocks.ts']");
  });

  it('emits coverage thresholds', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: '{ branches: 80 }',
    });

    expect(content).toContain('thresholds: { branches: 80 }');
  });

  it('emits define entries for jest globals', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: undefined,
      globals: [['__DEV__', 'true']],
    });

    expect(content).toContain('define: {');
    expect(content).toContain('__DEV__: true');
  });

  it('resolves a relative module alias against the config directory', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: undefined,
      moduleNameMapperAliases: [['@/(.*)', './src/$1']],
    });

    expect(content).toContain('path.resolve(__dirname,');
  });

  it('leaves a bare package alias unresolved', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: undefined,
      moduleNameMapperAliases: [['lodash-es', 'lodash']],
    });

    expect(content).toContain('"lodash-es": "lodash"');
    expect(content).not.toContain('path.resolve(__dirname,');
  });
});

describe('generated config import ordering', () => {
  it('puts node builtins in their own group ahead of external packages', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: undefined,
      pathAliases: [['@/*', 'src/*']],
      moduleNameMapperAliases: [['@/(.*)', './src/$1']],
    });
    const imports = content.slice(0, content.indexOf('export default')).trimEnd();

    expect(imports).toBe(
      [
        "import path from 'node:path';",
        '',
        "import tsconfigPaths from 'vite-tsconfig-paths';",
        "import { defineConfig } from 'vitest/config';",
      ].join('\n'),
    );
  });

  it('alphabetizes the external imports', () => {
    const content = buildVitestConfigContent({
      testProperties: [],
      coverageProperties: [],
      coverageThresholds: undefined,
      pathAliases: [['@/*', 'src/*']],
    });

    expect(content.indexOf("'vite-tsconfig-paths'")).toBeLessThan(content.indexOf("'vitest/config'"));
  });

  it('emits no builtin group when there is no module alias to resolve', () => {
    const content = buildVitestConfigContent({
      testProperties: [['environment', "'node'"]],
      coverageProperties: [],
      coverageThresholds: undefined,
    });

    expect(content).not.toContain('node:path');
    expect(content.startsWith("import { defineConfig } from 'vitest/config';")).toBe(true);
  });
});
