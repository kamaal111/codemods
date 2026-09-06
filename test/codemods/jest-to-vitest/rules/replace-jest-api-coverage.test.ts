import { JEST_TO_VITEST_LANGUAGE, makeJestToVitestInitialModification } from '../../../../src/codemods/jest-to-vitest';
import replaceJestApiWithVi, {
  fixViCompatIssues,
  replaceJestDontMock,
  replaceJestRequireActual,
  replaceJestRequireMock,
} from '../../../../src/codemods/jest-to-vitest/rules/replace-jest-api-with-vi';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

describe('isolateModules', () => {
  it('inlines an arrow callback body after a vi.resetModules call', async () => {
    const source = `
    jest.isolateModules(() => {
      const mod = 1;
    });
    `;

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vi.resetModules();');
    expect(modifications.ast.root().text()).toContain('const mod = 1;');
  });

  it('calls a non-arrow callback rather than inlining it', async () => {
    const source = 'vi.isolateModules(loadModules);';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('loadModules();');
  });
});

describe('requireActual and requireMock under the vi namespace', () => {
  it('rewrites vi.requireActual and makes the containing function async', async () => {
    const source = `
    vi.mock('./calculator', () => ({ ...vi.requireActual('./calculator') }));
    `;

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestRequireActual(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("await vi.importActual('./calculator')");
    expect(modifications.ast.root().text()).toContain('async ()');
  });

  it('rewrites vi.requireActual outside a function without an async wrapper', async () => {
    const source = "const actual = vi.requireActual('./calculator');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestRequireActual(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("(await vi.importActual('./calculator'))");
  });

  it('rewrites vi.requireMock into a dynamic import', async () => {
    const source = "const mocked = vi.requireMock('./calculator');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestRequireMock(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("await import('./calculator')");
  });
});

describe('dontMock', () => {
  it('rewrites vi.dontMock, which has no Vitest equivalent under that name', async () => {
    const source = "vi.dontMock('./calculator');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestDontMock(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doUnmock('./calculator')");
  });
});

describe('vi compatibility fixes', () => {
  it('routes a mocked ReactDOM.createRoot assignment through vi.mocked', async () => {
    const source = 'ReactDOM.createRoot = vi.fn().mockReturnValue({ render: vi.fn() });';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vi.mocked(ReactDOM.createRoot).mockReturnValue(');
  });

  it('marks a rejecting dynamic import so Vite does not treat the failure as a build error', async () => {
    const source = "expect(import('./broken')).rejects.toThrow();";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vitest-expected-error');
  });

  it('leaves a rejecting dynamic import with a non-literal path alone', async () => {
    await validRuleSignal('expect(import(modulePath)).rejects.toThrow();', JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });

  it('waits for a bare dynamic import to settle', async () => {
    const source = "await import('./side-effects');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('await vi.dynamicImportSettled()');
  });

  it('does not add a second settle call', async () => {
    const source = "await import('./side-effects');\nawait vi.dynamicImportSettled();";

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });
});

describe('setMock and doMock', () => {
  it('spreads a setMock value over both the namespace and the default export', async () => {
    const source = "jest.setMock('./calculator', calculatorStub);";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain(
      "vi.mock('./calculator', () => ({ ...calculatorStub, default: calculatorStub }))",
    );
  });

  it('uses vi.doMock for a setMock inside a test body, where vi.mock would hoist out', async () => {
    const source = "it('mocks', () => {\n  jest.setMock('./logger', stub);\n});";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doMock('./logger'");
  });

  it('rewrites a bare doMock without a factory', async () => {
    const source = "jest.doMock('./calculator');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doMock('./calculator')");
  });

  it('keeps a doMock factory that already declares a default export', async () => {
    const source = "jest.doMock('./calculator', () => ({ default: stub }));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doMock('./calculator', () => ({ default: stub }))");
  });

  it('adds a default export to a doMock factory that lacks one', async () => {
    const source = "jest.doMock('./calculator', () => ({ add: vi.fn() }));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('default:');
  });

  it('wraps a non-object doMock value as the default export', async () => {
    const source = "jest.doMock('./calculator', () => stub);";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doMock('./calculator', () => ({ default: stub }))");
  });
});
