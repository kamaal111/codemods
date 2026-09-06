import { JEST_TO_VITEST_LANGUAGE, makeJestToVitestInitialModification } from '../../../../src/codemods/jest-to-vitest';
import addVitestImports from '../../../../src/codemods/jest-to-vitest/rules/add-vitest-imports';
import { doneCallbackToPromise } from '../../../../src/codemods/jest-to-vitest/rules/done-callback-to-promise';
import jestMockTypeToVitest from '../../../../src/codemods/jest-to-vitest/rules/jest-mock-type-to-vitest';
import { requireToDynamicImport } from '../../../../src/codemods/jest-to-vitest/rules/require-to-dynamic-import';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

describe('add-vitest-imports', () => {
  it('collapses several vitest imports into one when the used names differ', async () => {
    const source = [
      "import { describe } from 'vitest';",
      "import { it } from 'vitest';",
      "describe('x', () => { it('y', () => { expect(1).toBe(1); }); });",
    ].join('\n');

    // Replacing the first import and deleting the second are two edits in one commit, so the
    // history grows by one rather than by two.
    const modifications = await invalidRuleSignal(
      source,
      JEST_TO_VITEST_LANGUAGE,
      ast => addVitestImports(makeJestToVitestInitialModification(ast)),
      2,
    );
    const updatedSource = modifications.ast.root().text();

    expect(updatedSource).toContain("import { describe, expect, it } from 'vitest'");
    expect(updatedSource.match(/from 'vitest'/g)).toHaveLength(1);
  });

  it('leaves duplicate imports alone when together they already name what is used', async () => {
    const source = [
      "import { describe } from 'vitest';",
      "import { it } from 'vitest';",
      "describe('x', () => { it('y', () => {}); });",
    ].join('\n');

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves an existing import alone when it already names exactly what is used', async () => {
    const source = ["import { describe, it } from 'vitest';", "describe('x', () => { it('y', () => {}); });"].join(
      '\n',
    );

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );
  });

  it('writes a type-only import when only types are used', async () => {
    const source = 'let mocked: Mock;';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("import type { Mock } from 'vitest'");
  });

  it('does nothing for a file that uses no vitest names', async () => {
    await validRuleSignal('export const value = 1;', JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );
  });
});

describe('jest-mock-type-to-vitest', () => {
  it('rewrites a bare jest.Mock with no generic parameters', async () => {
    const source = 'let mocked: jest.Mock;';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      jestMockTypeToVitest(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('let mocked: Mock;');
  });

  it('wraps a non-function generic in a call signature', async () => {
    const source = 'let mocked: jest.Mock<string>;';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      jestMockTypeToVitest(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('Mock<(...params: Array<unknown>) => string>');
  });

  it('keeps a generic that is already a function type', async () => {
    const source = 'let mocked: jest.Mock<(value: number) => string>;';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      jestMockTypeToVitest(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('Mock<(value: number) => string>');
  });

  it('rewrites the vi-namespaced spellings too', async () => {
    const source = 'let spy: vi.SpyInstance;\nlet mocked: vi.Mock<string>;';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      jestMockTypeToVitest(makeJestToVitestInitialModification(ast)),
    );
    const updatedSource = modifications.ast.root().text();

    expect(updatedSource).toContain('let spy: MockInstance;');
    expect(updatedSource).toContain('Mock<(...params: Array<unknown>) => string>');
  });
});

describe('require-to-dynamic-import', () => {
  it('leaves a require with a computed path alone, as it cannot be statically imported', async () => {
    await validRuleSignal('function load() {\n  return require(modulePath);\n}', JEST_TO_VITEST_LANGUAGE, ast =>
      requireToDynamicImport(makeJestToVitestInitialModification(ast)),
    );
  });

  it('rewrites a require in a function declaration and marks it async', async () => {
    const source = "function load() {\n  return require('../src/calculator');\n}";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      requireToDynamicImport(makeJestToVitestInitialModification(ast)),
    );
    const updatedSource = modifications.ast.root().text();

    expect(updatedSource).toContain("(await import('../src/calculator'))");
    expect(updatedSource).toContain('async function load()');
  });
});

describe('done-callback-to-promise', () => {
  it('leaves a test whose callback takes no parameters alone', async () => {
    await validRuleSignal("it('works', () => {\n  check();\n});", JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves a test whose callback parameter is not named done alone', async () => {
    await validRuleSignal("it('works', ctx => {\n  check(ctx);\n});", JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves a test with more than one callback parameter alone', async () => {
    await validRuleSignal("it('works', (done, extra) => {\n  done(extra);\n});", JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves an expression-bodied callback alone, having no block to wrap', async () => {
    await validRuleSignal("it('works', done => done());", JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves a non-arrow callback alone', async () => {
    await validRuleSignal("it('works', function (done) {\n  done();\n});", JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );
  });

  it('handles a typed done parameter', async () => {
    const source = "it('works', (done: jest.DoneCallback) => {\n  done();\n});";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('new Promise<void>');
  });

  it('converts a done callback in a test() call as well as an it() call', async () => {
    const source = "test('works', done => {\n  done();\n});";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      doneCallbackToPromise(makeJestToVitestInitialModification(ast)),
    );
    const updatedSource = modifications.ast.root().text();

    expect(updatedSource).toContain('new Promise<void>((resolve, reject)');
    expect(updatedSource).toContain('const done =');
  });
});

describe('add-vitest-imports grouping', () => {
  it('separates the vitest import from the relative imports that follow it', async () => {
    const source = "import { add } from '../src/calculator';\n\nit('adds', () => expect(add(1, 2)).toBe(3));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain(
      "import { expect, it } from 'vitest';\n\nimport { add } from '../src/calculator';",
    );
  });

  it('does not add a blank line when merging into an existing vitest import', async () => {
    const source = "import { it } from 'vitest';\nit('adds', () => expect(1).toBe(1));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("import { expect, it } from 'vitest';\nit(");
  });

  it('separates a generated import from a file that has no imports at all', async () => {
    const source = "it('adds', () => expect(1).toBe(1));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      addVitestImports(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("from 'vitest';\n\nit(");
  });
});
