# jest-to-vitest

Rewrites Jest tests into Vitest, and generates the Vitest project configuration to run them.

```bash
codemods jest-to-vitest ./src
```

See the [README](../README.md) for CLI flags, config files, and the rest of the collection.

It only touches files that call a Jest global (`describe`, `it`, `test`, `expect`, the `before*` /
`after*` hooks, or the focused and skipped variants) or reference the `jest` namespace. Files that
match neither are left alone.

- [What it transforms](#what-it-transforms)
  - [The `jest` namespace](#the-jest-namespace)
  - [Module mocking](#module-mocking)
  - [Test structure and callbacks](#test-structure-and-callbacks)
  - [Types](#types)
  - [Imports](#imports)
  - [Vitest compatibility fixes](#vitest-compatibility-fixes)
- [Project configuration](#project-configuration)
- [Example](#example)
- [Current constraints](#current-constraints)
- [Library usage](#library-usage)

## What it transforms

### The `jest` namespace

Everything on `jest` becomes `vi`, with the calls that changed shape handled explicitly:

- `jest.setTimeout(n)` -> `vi.setConfig({ testTimeout: n })`
- `jest.createMockFromModule` / `jest.genMockFromModule` -> `vi.importMock`
- `jest.enableAutomock()` / `jest.disableAutomock()` -> `vi.enableAutoMock()` / `vi.disableAutoMock()`
- `jest.dontMock(path)` -> `vi.doUnmock(path)`
- `jest.isolateModules(callback)` -> `vi.resetModules()` followed by the callback body, inlined
- everything else -> the same name under `vi` (`jest.fn`, `jest.spyOn`, `jest.clearAllMocks`,
  `jest.useFakeTimers`, and so on)

`jest.requireActual` and `jest.requireMock` become `await vi.importActual` and `await import`, and
the function containing them is marked `async`, since the Vitest equivalents are asynchronous.

### Module mocking

`jest.mock`, `jest.doMock` and `jest.setMock` become `vi.mock` / `vi.doMock`, with the factory
rewritten so the mocked module still has a default export — Jest's automatic interop does this for
you and Vitest's does not:

```ts
// before
jest.mock('./calculator', () => ({ ...jest.requireActual('./calculator'), add: jest.fn() }));

// after
vi.mock('./calculator', async () => {
  const mockedModule = { ...(await vi.importActual('./calculator')), add: vi.fn() };
  return { ...mockedModule, default: mockedModule };
});
```

A factory that already declares `default` is left as it is. A mock written inside a function body
becomes `vi.doMock`, which is not hoisted, because `vi.mock` there would run before the function did.

### Test structure and callbacks

- `fit` / `fdescribe` -> `it.only` / `describe.only`; `xit` / `xtest` / `xdescribe` -> `it.skip` /
  `describe.skip`
- `require('x')` -> `await import('x')`, marking the containing function `async`
- an expression-bodied hook gets a block body, because Vitest treats a returned value as a promise
  to await: `beforeEach(() => setup())` -> `beforeEach(() => { setup() })`
- a `done` callback becomes an explicit promise, since Vitest removed callback-style tests:

```ts
// before
it('loads', done => {
  load(() => done());
});

// after
it('loads', () =>
  new Promise<void>((resolve, reject) => {
    const done = (error?: unknown) => (error == null ? resolve() : reject(error));
    load(() => done());
  }));
```

- arrow callbacks passed to `mockImplementation`, `mockImplementationOnce` and `vi.fn` become
  `function` expressions, so `this` behaves as the mocked implementation expects

### Types

- `jest.Mocked` / `jest.MockedFunction` / `jest.MockedClass` -> the bare Vitest names
- `jest.Mock<T>` / `vi.Mock<T>` -> `Mock<(...params: Array<unknown>) => T>`, matching Vitest 5's
  signature-shaped generic
- `jest.SpyInstance` / `vi.SpyInstance` -> `MockInstance`

### Imports

Jest's globals are ambient; Vitest's are not by default. The codemod collects every Vitest name the
file ends up using — values and types alike — and writes a single sorted import, merging it with an
existing `vitest` import if there is one. `@jest/globals` imports are removed.

```ts
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
```

### Vitest compatibility fixes

A handful of rewrites address behaviour that differs at runtime rather than in the API:

- `vi.restoreAllMocks()` in a `beforeEach` / `afterEach`, and `vi.resetModules()`, are paired with
  `vi.clearAllMocks()`, which Jest's equivalents imply and Vitest's do not
- a bare `await import(...)` statement is followed by `await vi.dynamicImportSettled()`
- `expect(import('./x')).rejects` gets a `?vitest-expected-error` query, so Vite does not treat the
  intentional failure as a build error
- `ReactDOM.createRoot = vi.fn().method(...)` -> `vi.mocked(ReactDOM.createRoot).method(...)`
- under fake timers: `waitFor` -> `vi.waitFor`, `userEvent.setup({ delay: null })` gains
  `advanceTimers`, and `vi.runAllTimers()` in an async function becomes
  `await vi.runAllTimersAsync()`

## Project configuration

After the files are rewritten, the codemod migrates the project around them, once per path the run
was pointed at. Nothing here happens on a `--dry` run.

- `jest.config.*` is translated into a generated `vitest.config.ts` — test environment, timeouts,
  `clearMocks` / `mockReset` / `restoreMocks`, `testMatch` as `include`, coverage directory,
  reporters, `collectCoverageFrom` split into `include` and `exclude`, coverage thresholds,
  `globals` as `define` entries, and `moduleNameMapper` as `resolve.alias`. An existing
  `vitest.config.*` is never overwritten.
- each `jest.<name>.config.[jt]s` gets a matching `vitest.<name>.config.ts`
- `paths` from `tsconfig.json` are wired up through `vite-tsconfig-paths`
- setup files are collected into a generated `vitest.config.setup.ts`, and `snapshotSerializers`
  into a `vitest.config.snapshot-serializers.setup.ts` that registers each one
- `__mocks__` directories under the config's `moduleDirectories` are scanned, and a bare
  `vi.mock('module')` is given an explicit factory — Jest resolves those automatically, Vitest does
  not: `vi.mock('calculator', () => import('./__mocks__/calculator'))`
- `package.json` gains `vitest` and `@vitest/coverage-v8`, plus `jsdom`, `vite-tsconfig-paths` and
  `vitest-canvas-mock` when the translated config calls for them

## Example

Input:

```ts
import { describe, expect, it } from '@jest/globals';

jest.mock('./calculator');

describe('calculator', () => {
  let mockedAdd: jest.MockedFunction<typeof add>;

  beforeEach(() => jest.clearAllMocks());

  xit('adds', () => {
    const actual = jest.requireActual('./calculator');
    expect(actual).toBeDefined();
  });
});
```

Output:

```ts
import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

vi.mock('./calculator');

describe('calculator', () => {
  let mockedAdd: MockedFunction<typeof add>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('adds', async () => {
    const actual = await vi.importActual('./calculator');
    expect(actual).toBeDefined();
  });
});
```

The codemod does not format its output. Run your formatter over the changed files afterwards.

## Current constraints

- Files are parsed as TypeScript, or as TSX for `.tsx`, `.jsx` and `.js`. Flow is not supported.
- The codemod migrates test code and project configuration. It does not remove Jest from
  `package.json`, delete `jest.config.*`, drop the TypeScript transform Jest needed (`ts-jest`,
  `@swc/jest`, `babel-jest`), or update your `test` script — Vitest needs none of them, but review
  and remove them yourself once the Vitest run is green.
- Assertion differences are not covered. `expect` matchers that exist only in Jest, and custom
  matchers registered through `expect.extend`, need a manual migration.
- The project configuration translation covers the common Jest options listed above. A custom
  `testEnvironment`, a Babel transform pipeline, `projects`, and bespoke resolvers are not
  translated; the generated `vitest.config.ts` is a starting point to review, not a finished config.
- Coverage is driven by the rules and tests in [`src/codemods/jest-to-vitest`](../src/codemods/jest-to-vitest)
  and [`test/codemods/jest-to-vitest`](../test/codemods/jest-to-vitest). Patterns outside those rules
  may remain unchanged.
- [`example/jest-to-vitest/`](../example/jest-to-vitest) is a live before/after fixture: CI
  type-checks, lints and runs it under Jest, transforms it, then does all three again under Vitest.
  [`example/jest-to-vitest.snapshot/`](../example/jest-to-vitest.snapshot) is a committed
  snapshot of the codemod's current output for it, if you would rather read the result than run it.
- The tool is a codemod, not a semantic migration assistant. Review the output before committing.

## Library usage

### Transform a source string

Pass a filename when you have one: it decides whether the file is parsed as TypeScript or TSX.

```ts
import { jestToVitest } from '@kamaalio/codemods';

const source = "jest.mock('./calculator');\n";
const transformed = await jestToVitest(source, 'src/calculator.test.ts');

// vi.mock('./calculator');
```

Files that call no Jest global and never mention `jest` are returned unchanged.

### Inspect transformation details

`jestToVitestTransformer` returns the AST, the number of edits, and the transformation history
alongside the generated source.

```ts
import { jestToVitestTransformer } from '@kamaalio/codemods';

const result = await jestToVitestTransformer('jest.fn();\n', 'src/calculator.test.ts');

console.log(result.report.changesApplied);
const transformed = result.ast.root().text();
```

### Integrate with a codemod runner

`JEST_TO_VITEST_CODEMOD` is the complete codemod definition — its name, both supported languages,
the string transformer, and the `postTransform` hook that writes the project configuration.
`JEST_TO_VITEST_LANGUAGE` and `JEST_TO_VITEST_TSX_LANGUAGE` are the corresponding ast-grep language
constants.

```ts
import { JEST_TO_VITEST_CODEMOD, JEST_TO_VITEST_LANGUAGE } from '@kamaalio/codemods';

const transformed = await JEST_TO_VITEST_CODEMOD.transformer('jest.fn();\n', 'src/calculator.test.ts');
console.log(JEST_TO_VITEST_LANGUAGE, transformed);
```

`postTransform` writes files, so a runner that supports dry runs should skip it in that mode.
