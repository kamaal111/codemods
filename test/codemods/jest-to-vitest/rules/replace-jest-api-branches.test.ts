import { JEST_TO_VITEST_LANGUAGE, makeJestToVitestInitialModification } from '../../../../src/codemods/jest-to-vitest';
import replaceJestApiWithVi, {
  convertMockImplArrowToFunction,
  fixViCompatIssues,
  normalizeViMockFactories,
  replaceJestRequireActual,
  replaceJestRequireMock,
} from '../../../../src/codemods/jest-to-vitest/rules/replace-jest-api-with-vi';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

describe('vi.mock factory normalization', () => {
  it('wraps a factory whose top-level return is a bare object', async () => {
    const source = "vi.mock('./calculator', () => {\n  return { add: vi.fn() };\n});";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('const mockedModule =');
    expect(modifications.ast.root().text()).toContain('default: mockedModule');
  });

  it('leaves a factory whose returned object already declares default', async () => {
    const source = "vi.mock('./calculator', () => {\n  return { default: stub };\n});";

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves a factory with no top-level return', async () => {
    const source = "vi.mock('./calculator', () => {\n  register({ add: vi.fn() });\n});";

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );
  });

  it('ignores a return nested inside a callback in the factory body', async () => {
    const source = "vi.mock('./calculator', () => {\n  items.map(item => {\n    return item;\n  });\n});";

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );
  });

  it('does not mistake an identifier ending in return for a return statement', async () => {
    const source = "vi.mock('./calculator', () => {\n  const noreturnValue = 1;\n  return { noreturnValue };\n});";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('const noreturnValue = 1;');
  });

  it('leaves an expression-bodied factory alone, having no block to read a return from', async () => {
    await validRuleSignal("vi.mock('./calculator', () => stub);", JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves a factory that is neither an arrow nor a function expression', async () => {
    await validRuleSignal("vi.mock('./calculator', buildMock);", JEST_TO_VITEST_LANGUAGE, ast =>
      normalizeViMockFactories(makeJestToVitestInitialModification(ast)),
    );
  });
});

describe('mock factories that are block bodies', () => {
  it('leaves a jest.mock whose factory is a statement block to the general callback rule', async () => {
    const source = "jest.mock('./calculator', () => {\n  return buildMock();\n});";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.mock('./calculator', () => {");
  });

  it('leaves a jest.doMock whose factory is a statement block to the general callback rule', async () => {
    const source = "function setup() {\n  jest.doMock('./calculator', () => {\n    return buildMock();\n  });\n}";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doMock('./calculator', () => {");
  });

  it('uses vi.doMock for a jest.mock written inside a function, where vi.mock would hoist out', async () => {
    const source = "function setup() {\n  jest.mock('./calculator', () => ({ add: vi.fn() }));\n}";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vi.doMock(');
  });
});

describe('requireActual and requireMock already inside an async function', () => {
  it('does not add a second async keyword to jest.requireActual', async () => {
    const source = "vi.mock('./calculator', async () => ({ ...jest.requireActual('./calculator') }));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestRequireActual(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).not.toContain('async async');
  });

  it('does not add a second async keyword to jest.requireMock', async () => {
    const source = "vi.mock('./calculator', async () => ({ ...jest.requireMock('./calculator') }));";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestRequireMock(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).not.toContain('async async');
  });

  it('rewrites jest.requireMock outside a function without an async wrapper', async () => {
    const source = "const mocked = jest.requireMock('./calculator');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestRequireMock(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("(await import('./calculator'))");
  });
});

describe('isolateModules callback shapes', () => {
  it('unwraps an expression-bodied arrow callback', async () => {
    const source = 'jest.isolateModules(() => load());';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      replaceJestApiWithVi(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vi.resetModules();');
    expect(modifications.ast.root().text()).toContain('load()');
  });
});

describe('mock implementation callbacks', () => {
  it('keeps the async keyword when converting an async arrow to a function', async () => {
    const source = 'mocked.mockImplementation(async () => 1);';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      convertMockImplArrowToFunction(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('async function() { return 1; }');
  });

  it('parenthesizes a single bare parameter', async () => {
    const source = 'mocked.mockImplementationOnce(value => value + 1);';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      convertMockImplArrowToFunction(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('function(value) { return value + 1; }');
  });

  it('keeps an existing block body as it is', async () => {
    const source = 'mocked.mockImplementation(() => { track(); });';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      convertMockImplArrowToFunction(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('function() { track(); }');
  });

  it('leaves a non-arrow implementation alone', async () => {
    await validRuleSignal('mocked.mockImplementation(handler);', JEST_TO_VITEST_LANGUAGE, ast =>
      convertMockImplArrowToFunction(makeJestToVitestInitialModification(ast)),
    );
  });
});

describe('compatibility fixes that should not fire', () => {
  it('leaves vi.restoreAllMocks outside a lifecycle hook alone', async () => {
    await validRuleSignal('vi.restoreAllMocks();', JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });

  it('pairs vi.restoreAllMocks inside afterEach', async () => {
    const source = 'afterEach(() => {\n  vi.restoreAllMocks();\n});';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vi.restoreAllMocks(); vi.clearAllMocks()');
  });

  it('does not pair vi.restoreAllMocks when the hook already clears mocks', async () => {
    const source = 'afterEach(() => {\n  vi.restoreAllMocks();\n  vi.clearAllMocks();\n});';

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves waitFor alone when it is already vi.waitFor', async () => {
    const source = 'vi.useFakeTimers();\nawait vi.waitFor(() => check());';

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });

  it('leaves vi.runAllTimers in a synchronous function alone, having nothing to await it', async () => {
    const source = 'vi.useFakeTimers();\nfunction flush() {\n  vi.runAllTimers();\n}';

    await validRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });

  it('rewrites waitFor under fake timers', async () => {
    const source = 'vi.useFakeTimers();\nawait waitFor(() => check());';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('vi.waitFor(');
  });

  it('advances timers for userEvent under fake timers', async () => {
    const source = 'vi.useFakeTimers();\nconst user = userEvent.setup({ delay: null });';

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain('advanceTimers: vi.advanceTimersByTime');
  });

  it('rewrites vi.dontMock through the compatibility pass as well', async () => {
    const source = "vi.dontMock('./calculator');";

    const modifications = await invalidRuleSignal(source, JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );

    expect(modifications.ast.root().text()).toContain("vi.doUnmock('./calculator')");
  });

  it('leaves a ReactDOM.createRoot assignment that is not a mock chain alone', async () => {
    await validRuleSignal('ReactDOM.createRoot = realCreateRoot;', JEST_TO_VITEST_LANGUAGE, ast =>
      fixViCompatIssues(makeJestToVitestInitialModification(ast)),
    );
  });
});
