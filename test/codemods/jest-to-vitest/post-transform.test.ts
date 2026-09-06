import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { JEST_TO_VITEST_CODEMOD } from '../../../src/codemods/jest-to-vitest';

async function runPostTransform(root: string): Promise<void> {
  const postTransform = JEST_TO_VITEST_CODEMOD.postTransform;
  if (postTransform == null) {
    throw new Error('Expected the codemod to expose a postTransform hook');
  }

  await postTransform({ root, results: [] }, JEST_TO_VITEST_CODEMOD);
}

describe('jest-to-vitest postTransform', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jtv-post-transform-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('generates a vitest config from the jest config and updates package.json dependencies', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', devDependencies: { jest: '^30.0.0' } }, undefined, 2) + '\n',
    );
    await writeFile(
      join(tempDir, 'jest.config.ts'),
      `export default {
  testEnvironment: 'jsdom',
  testTimeout: 10000,
  setupFilesAfterEnv: ['./jest.setup.ts'],
};`,
    );

    await runPostTransform(tempDir);

    const vitestConfig = await readFile(join(tempDir, 'vitest.config.ts'), 'utf-8');
    const vitestSetup = await readFile(join(tempDir, 'vitest.config.setup.ts'), 'utf-8');
    const packageJson = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf-8')) as {
      devDependencies?: Record<string, string>;
    };

    expect(vitestConfig).toContain("environment: 'jsdom'");
    expect(vitestConfig).toContain('testTimeout: 10000');
    expect(vitestConfig).toContain("setupFiles: ['./vitest.config.setup.ts']");
    expect(vitestSetup).toContain("import './jest.setup.ts';");
    expect(packageJson.devDependencies).toMatchObject({
      '@vitest/coverage-v8': expect.any(String),
      jsdom: '^30.0.1',
      vitest: expect.any(String),
    });
  });

  it('leaves an existing vitest config alone', async () => {
    await writeFile(join(tempDir, 'vitest.config.ts'), '// hand written\n');
    await writeFile(join(tempDir, 'jest.config.ts'), "export default { testEnvironment: 'node' };");

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'vitest.config.ts'), 'utf-8')).toBe('// hand written\n');
  });

  it('does nothing when the root cannot be read', async () => {
    await expect(runPostTransform(join(tempDir, 'does-not-exist'))).resolves.toBeUndefined();
  });

  it('generates additional Vitest configs and setup files from extra Jest configs', async () => {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'fixture' }, undefined, 2) + '\n');
    await writeFile(
      join(tempDir, 'jest.integration.config.js'),
      `module.exports = {
  testMatch: ['**/*.integration.test.ts'],
  testTimeout: 60000,
  setupFilesAfterEnv: ['./jest.integration.setup.js'],
};`,
    );
    await writeFile(join(tempDir, 'jest.integration.setup.js'), 'globalThis.__READY__ = true;\n');

    await runPostTransform(tempDir);

    const vitestConfig = await readFile(join(tempDir, 'vitest.integration.config.ts'), 'utf-8');
    const vitestSetup = await readFile(join(tempDir, 'vitest.integration.config.setup.ts'), 'utf-8');

    expect(vitestConfig).toContain("include: ['**/*.integration.test.ts']");
    expect(vitestConfig).toContain('testTimeout: 60000');
    expect(vitestConfig).toContain("setupFiles: ['./vitest.integration.config.setup.ts']");
    expect(vitestSetup).toContain("import './jest.integration.setup.js';");
  });

  it('generates a snapshot serializer setup file from snapshotSerializers', async () => {
    await writeFile(
      join(tempDir, 'jest.config.ts'),
      `export default {
  snapshotSerializers: ['enzyme-to-json/serializer', 'jest-serializer-html'],
};`,
    );

    await runPostTransform(tempDir);

    const serializerSetup = await readFile(join(tempDir, 'vitest.config.snapshot-serializers.setup.ts'), 'utf-8');
    const vitestSetup = await readFile(join(tempDir, 'vitest.config.setup.ts'), 'utf-8');

    expect(serializerSetup).toContain("import * as snapshotSerializer0Module from 'enzyme-to-json/serializer';");
    expect(serializerSetup).toContain("import * as snapshotSerializer1Module from 'jest-serializer-html';");
    expect(serializerSetup).toContain('expect.addSnapshotSerializer(snapshotSerializer1');
    expect(vitestSetup).toContain("import './vitest.config.snapshot-serializers.setup.ts';");
  });

  it('adds a jest-dom setup import when the project depends on it', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ devDependencies: { '@testing-library/jest-dom': '^6.0.0' } }, undefined, 2) + '\n',
    );

    await runPostTransform(tempDir);

    const vitestSetup = await readFile(join(tempDir, 'vitest.config.setup.ts'), 'utf-8');

    expect(vitestSetup).toContain("import '@testing-library/jest-dom/extend-expect';");
  });

  it('falls back to an empty mapping when the jest config cannot be parsed', async () => {
    await writeFile(join(tempDir, 'jest.config.ts'), 'export default {');

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'vitest.config.ts'), 'utf-8')).toContain('test: {}');
  });

  it('picks up path aliases from tsconfig.json', async () => {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'fixture' }, undefined, 2) + '\n');
    await writeFile(
      join(tempDir, 'tsconfig.json'),
      `{
  // A comment, because tsconfig.json is JSONC.
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } }
}`,
    );

    await runPostTransform(tempDir);

    const vitestConfig = await readFile(join(tempDir, 'vitest.config.ts'), 'utf-8');
    const packageJson = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf-8')) as {
      devDependencies?: Record<string, string>;
    };

    expect(vitestConfig).toContain("import tsconfigPaths from 'vite-tsconfig-paths';");
    expect(packageJson.devDependencies).toMatchObject({ 'vite-tsconfig-paths': '^6.1.1' });
  });

  it('skips an extra jest config whose vitest counterpart already exists', async () => {
    await writeFile(join(tempDir, 'jest.integration.config.js'), 'module.exports = { testTimeout: 1 };');
    await writeFile(join(tempDir, 'vitest.integration.config.ts'), '// hand written\n');

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'vitest.integration.config.ts'), 'utf-8')).toBe('// hand written\n');
  });

  it('finds auto mocks in nested __mocks__ directories', async () => {
    await mkdir(join(tempDir, 'tests', '__mocks__', 'services'), { recursive: true });
    await writeFile(join(tempDir, 'jest.config.ts'), "export default { moduleDirectories: ['tests'] };");
    await writeFile(join(tempDir, 'tests', '__mocks__', 'services', 'api.ts'), 'export const get = () => 1;\n');
    await writeFile(join(tempDir, 'tests', 'api.test.ts'), "vi.mock('services/api');\n");

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'tests', 'api.test.ts'), 'utf-8')).toContain(
      'import("./__mocks__/services/api")',
    );
  });

  it('leaves a vi.mock alone when no auto mock matches its path', async () => {
    await mkdir(join(tempDir, 'tests', '__mocks__'), { recursive: true });
    await writeFile(join(tempDir, 'jest.config.ts'), "export default { moduleDirectories: ['tests'] };");
    await writeFile(join(tempDir, 'tests', '__mocks__', 'calculator.ts'), 'export const add = () => 1;\n');
    await writeFile(join(tempDir, 'tests', 'other.test.ts'), "vi.mock('unrelated');\n");

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'tests', 'other.test.ts'), 'utf-8')).toBe("vi.mock('unrelated');\n");
  });

  it('names a vitest config after the jest config it came from', async () => {
    await writeFile(join(tempDir, 'jest.integration.config.ts'), 'export default { testTimeout: 1 };');
    await writeFile(join(tempDir, 'jest.e2e.config.js'), 'module.exports = { testTimeout: 2 };');

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'vitest.integration.config.ts'), 'utf-8')).toContain('testTimeout: 1');
    expect(await readFile(join(tempDir, 'vitest.e2e.config.ts'), 'utf-8')).toContain('testTimeout: 2');
  });

  it('quotes a bare setup file path when writing the setup file', async () => {
    await writeFile(join(tempDir, 'jest.config.ts'), "export default { setupFilesAfterEnv: ['./jest.setup.ts'] };");

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'vitest.config.setup.ts'), 'utf-8')).toBe("import './jest.setup.ts';\n");
  });

  it('does not repeat a setup file listed twice', async () => {
    await writeFile(
      join(tempDir, 'jest.config.ts'),
      "export default { setupFiles: ['./shared.ts'], setupFilesAfterEnv: ['./shared.ts'] };",
    );

    await runPostTransform(tempDir);

    const vitestSetup = await readFile(join(tempDir, 'vitest.config.setup.ts'), 'utf-8');

    expect(vitestSetup.match(/shared\.ts/g)).toHaveLength(1);
  });

  it('reaches the serializer setup through the generated setup file', async () => {
    await writeFile(
      join(tempDir, 'jest.config.ts'),
      "export default { snapshotSerializers: ['enzyme-to-json/serializer'] };",
    );

    await runPostTransform(tempDir);

    const vitestConfig = await readFile(join(tempDir, 'vitest.config.ts'), 'utf-8');
    const vitestSetup = await readFile(join(tempDir, 'vitest.config.setup.ts'), 'utf-8');

    expect(vitestConfig).toContain("setupFiles: ['./vitest.config.setup.ts']");
    expect(vitestSetup).toContain("import './vitest.config.snapshot-serializers.setup.ts';");
  });

  it('ignores a snapshot serializer that is not a plain string literal', async () => {
    await writeFile(join(tempDir, 'jest.config.ts'), 'export default { snapshotSerializers: [serializer] };');

    await runPostTransform(tempDir);

    await expect(readFile(join(tempDir, 'vitest.config.snapshot-serializers.setup.ts'), 'utf-8')).rejects.toThrow();
  });

  it('preserves the indentation package.json already uses', async () => {
    await writeFile(join(tempDir, 'package.json'), '{\n    "name": "fixture"\n}\n');

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'package.json'), 'utf-8')).toContain('\n    "devDependencies"');
  });

  it('defaults to two-space indentation for a single-line package.json', async () => {
    await writeFile(join(tempDir, 'package.json'), '{"name":"fixture"}\n');

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'package.json'), 'utf-8')).toContain('\n  "devDependencies"');
  });

  it('adds vitest-canvas-mock when the jest setup files pull it in', async () => {
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'fixture' }, undefined, 2) + '\n');
    await writeFile(join(tempDir, 'jest.config.ts'), "export default { setupFiles: ['vitest-canvas-mock'] };");

    await runPostTransform(tempDir);

    const packageJson = JSON.parse(await readFile(join(tempDir, 'package.json'), 'utf-8')) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies).toMatchObject({ 'vitest-canvas-mock': '^1.2.0' });
  });

  it('skips a directory entry while scanning __mocks__ for non-source files', async () => {
    await mkdir(join(tempDir, 'tests', '__mocks__'), { recursive: true });
    await writeFile(join(tempDir, 'jest.config.ts'), "export default { moduleDirectories: ['tests'] };");
    await writeFile(join(tempDir, 'tests', '__mocks__', 'notes.md'), 'not a module\n');
    await writeFile(join(tempDir, 'tests', '__mocks__', 'calculator.ts'), 'export const add = () => 1;\n');
    await writeFile(join(tempDir, 'tests', 'calculator.test.ts'), "vi.mock('calculator');\n");

    await runPostTransform(tempDir);

    expect(await readFile(join(tempDir, 'tests', 'calculator.test.ts'), 'utf-8')).toContain(
      'import("./__mocks__/calculator")',
    );
  });

  it('rewrites vi.mock auto-mock factories using discovered moduleDirectories mocks', async () => {
    await mkdir(join(tempDir, 'tests', '__mocks__'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'fixture' }, undefined, 2) + '\n');
    await writeFile(
      join(tempDir, 'jest.config.ts'),
      `export default {
  moduleDirectories: ['tests', 'node_modules'],
};`,
    );
    await writeFile(join(tempDir, 'tests', '__mocks__', 'calculator.ts'), 'export const add = () => 99;\n');
    await writeFile(
      join(tempDir, 'tests', 'calculator.test.ts'),
      `
      import { vi } from 'vitest';

      vi.mock('calculator');
      `,
    );

    await runPostTransform(tempDir);

    const updatedTest = await readFile(join(tempDir, 'tests', 'calculator.test.ts'), 'utf-8');

    expect(updatedTest).toContain(`vi.mock('calculator', () => import("./__mocks__/calculator"))`);
  });
});
