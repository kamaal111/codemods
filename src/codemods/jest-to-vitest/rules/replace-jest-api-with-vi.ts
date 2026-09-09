import type { SgNode } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import type { Modifications } from '../../../kit/types.ts';
import { invariant } from '../../../utils/asserts.ts';
import { type FindAndReplaceConfig, findAndReplaceConfigModifications } from '../../utils/find-and-replace.ts';
import traverseUp from '../../utils/traverse-up.ts';

const PATH_MATCH_KEY = 'PATH';
const MODULE_MATCH_KEY = 'MODULE';
type AstNode = SgNode<TypesMap, Kinds<TypesMap>>;

function normalizeObjectExpressionText(moduleText: string): string {
  if (moduleText.startsWith('({') && moduleText.endsWith('})')) {
    return moduleText.slice(1, -1).trim();
  }

  return moduleText;
}

function buildExplicitMockedModuleFactory(moduleText: string): string {
  const normalizedObject = normalizeObjectExpressionText(moduleText);
  return `() => { const mockedModule = ${normalizedObject}; return { ...mockedModule, default: mockedModule }; }`;
}

function appendVitestExpectedErrorQuery(pathLiteral: string): string {
  const quote = pathLiteral[0];
  const rawPath = pathLiteral.slice(1, -1);
  const separator = rawPath.includes('?') ? '&' : '?';
  return `${quote}${rawPath}${separator}vitest-expected-error${quote}`;
}

function shouldUseViDoMock(node: AstNode): boolean {
  return (
    traverseUp(node, currentNode => {
      const kind = currentNode.kind();
      return (
        kind === 'arrow_function' ||
        kind === 'function_expression' ||
        kind === 'function_declaration' ||
        kind === 'function'
      );
    }) != null
  );
}

function objectExpressionFrom(node: AstNode): AstNode | undefined {
  if (node.kind() === 'object') return node;
  if (node.kind() !== 'parenthesized_expression') return undefined;

  const inner = node.namedChildren().find(child => child.kind() !== 'comment');

  return inner?.kind() === 'object' ? inner : undefined;
}

function hasDefaultKey(objectNode: AstNode): boolean {
  return objectNode.children().some(child => {
    if (child.kind() !== 'pair') return false;

    const key = child.field('key');

    return key != null && ['default', "'default'", '"default"'].includes(key.text());
  });
}

function spliceNodeText(outer: AstNode, inner: AstNode, replacement: string): string {
  const offset = outer.range().start.index;
  const outerText = outer.text();

  return (
    outerText.slice(0, inner.range().start.index - offset) +
    replacement +
    outerText.slice(inner.range().end.index - offset)
  );
}

function normalizeViMockFactoryCallback(callback: AstNode): string | undefined {
  const body = callback.field('body');
  if (body?.kind() !== 'statement_block') return undefined;

  const returnStatement = body.children().find(child => child.kind() === 'return_statement');
  if (returnStatement == null) return undefined;

  const returned = returnStatement.namedChildren().find(child => child.kind() !== 'comment');
  if (returned == null) return undefined;

  const objectNode = objectExpressionFrom(returned);
  if (objectNode == null || hasDefaultKey(objectNode)) return undefined;

  return spliceNodeText(
    callback,
    returnStatement,
    `const mockedModule = ${objectNode.text()}; return { ...mockedModule, default: mockedModule };`,
  );
}

const SIMPLE_JEST_TO_VITEST_API_MAPPING: Array<FindAndReplaceConfig> = Object.entries({
  'jest.setTimeout($ARGS)': 'vi.setConfig({ testTimeout: $ARGS })',
  'jest.createMockFromModule': 'vi.importMock',
  'jest.genMockFromModule': 'vi.importMock',
  'jest.fn': 'vi.fn',
  'jest.enableAutomock()': 'vi.enableAutoMock()',
  'jest.disableAutomock()': 'vi.disableAutoMock()',
}).map(([jestApi, vitestApi]) => ({ rule: { pattern: jestApi }, transformer: vitestApi }));

const JEST_DONTMOCK_MAPPING: Array<FindAndReplaceConfig> = [
  {
    rule: {
      any: [{ pattern: 'jest.dontMock($ARG)' }, { pattern: 'vi.dontMock($ARG)' }],
    },
    transformer: node => {
      const argMatch = node.getMatch('ARG')?.text();
      if (argMatch == null) return undefined;
      return `vi.doUnmock(${argMatch})`;
    },
  },
];

const JEST_REQUIRE_ACTUAL_MAPPING: Array<FindAndReplaceConfig> = [
  {
    rule: { pattern: 'jest.requireActual($ARG)' },
    transformer: node => {
      const argMatch = node.getMatch('ARG');
      if (argMatch == null) return undefined;
      const argText = argMatch.text().trim();

      const containingFn = traverseUp(node, n => {
        const kind = n.kind();
        return kind === 'arrow_function' || kind === 'function_declaration' || kind === 'function';
      });
      if (containingFn != null) {
        const fnText = containingFn.text();
        const nodeText = node.text();
        const newFnText = fnText.replace(nodeText, `(await vi.importActual(${argText}))`);
        const asyncFnText = newFnText.startsWith('async ') ? newFnText : `async ${newFnText}`;
        return containingFn.replace(asyncFnText);
      }
      return `(await vi.importActual(${argText}))`;
    },
  },
  {
    rule: { pattern: 'vi.requireActual($ARG)' },
    transformer: node => {
      const argMatch = node.getMatch('ARG');
      if (argMatch == null) return undefined;
      const argText = argMatch.text().trim();

      const containingFn = traverseUp(node, n => {
        const kind = n.kind();
        return kind === 'arrow_function' || kind === 'function_declaration' || kind === 'function';
      });
      if (containingFn != null) {
        const fnText = containingFn.text();
        const nodeText = node.text();
        const newFnText = fnText.replace(nodeText, `(await vi.importActual(${argText}))`);
        const asyncFnText = newFnText.startsWith('async ') ? newFnText : `async ${newFnText}`;
        return containingFn.replace(asyncFnText);
      }
      return `(await vi.importActual(${argText}))`;
    },
  },
];

const JEST_REQUIRE_MOCK: Array<FindAndReplaceConfig> = [
  {
    rule: { pattern: 'jest.requireMock($ARG)' },
    transformer: node => {
      const argMatch = node.getMatch('ARG');
      if (argMatch == null) return undefined;
      const argText = argMatch.text().trim();

      const containingFn = traverseUp(node, n => {
        const kind = n.kind();
        return kind === 'arrow_function' || kind === 'function_declaration' || kind === 'function';
      });
      if (containingFn != null) {
        const fnText = containingFn.text();
        const nodeText = node.text();
        const newFnText = fnText.replace(nodeText, `(await import(${argText}))`);
        const asyncFnText = newFnText.startsWith('async ') ? newFnText : `async ${newFnText}`;
        return containingFn.replace(asyncFnText);
      }
      return `(await import(${argText}))`;
    },
  },
  {
    rule: { pattern: 'vi.requireMock($ARG)' },
    transformer: node => {
      const argMatch = node.getMatch('ARG');
      if (argMatch == null) return undefined;
      const argText = argMatch.text().trim();

      const containingFn = traverseUp(node, n => {
        const kind = n.kind();
        return kind === 'arrow_function' || kind === 'function_declaration' || kind === 'function';
      });
      if (containingFn != null) {
        const fnText = containingFn.text();
        const nodeText = node.text();
        const newFnText = fnText.replace(nodeText, `(await import(${argText}))`);
        const asyncFnText = newFnText.startsWith('async ') ? newFnText : `async ${newFnText}`;
        return containingFn.replace(asyncFnText);
      }
      return `(await import(${argText}))`;
    },
  },
];

const JEST_ISOLATE_MODULES: Array<FindAndReplaceConfig> = [
  {
    rule: {
      any: [{ pattern: 'jest.isolateModules($CALLBACK)' }, { pattern: 'vi.isolateModules($CALLBACK)' }],
    },
    transformer: node => {
      const callbackMatch = node.getMatch('CALLBACK');
      if (callbackMatch == null) return undefined;

      const callbackText = callbackMatch.text().trim();
      const kind = callbackMatch.kind();

      let bodyContent: string;
      if (kind === 'arrow_function') {
        const children = callbackMatch.children();
        const arrowToken = children.find(c => c.kind() === '=>');
        if (arrowToken == null) return undefined;
        const arrowOffset = arrowToken.range().start.index - callbackMatch.range().start.index;
        bodyContent = callbackText.substring(arrowOffset + 2).trim();
        if (bodyContent.startsWith('{')) {
          bodyContent = bodyContent.substring(1, bodyContent.length - 1);
        }
      } else {
        bodyContent = `${callbackText}();`;
      }

      return `vi.resetModules();\n${bodyContent}`;
    },
  },
];

const JEST_TO_VITEST_API_MAPPING: Array<FindAndReplaceConfig> = [
  ...SIMPLE_JEST_TO_VITEST_API_MAPPING,
  ...JEST_ISOLATE_MODULES,
  {
    rule: {
      any: [
        { pattern: `jest.mock($${PATH_MATCH_KEY}, () => $${MODULE_MATCH_KEY})` },
        { pattern: `jest.mock($${PATH_MATCH_KEY})` },
      ],
    },
    transformer: node => {
      const pathMatch = node.getMatch(PATH_MATCH_KEY)?.text();
      invariant(pathMatch != null, 'There should be a path match');
      const mockApi = shouldUseViDoMock(node) ? 'vi.doMock' : 'vi.mock';

      const moduleMatchNode = node.getMatch(MODULE_MATCH_KEY);
      if (moduleMatchNode == null) return `${mockApi}(${pathMatch})`;

      if (moduleMatchNode.kind() === 'statement_block') return undefined;

      const moduleMatch = moduleMatchNode.text().trim();
      const moduleObject = objectExpressionFrom(moduleMatchNode);

      if (moduleObject != null) {
        if (hasDefaultKey(moduleObject)) {
          return `${mockApi}(${pathMatch}, () => ${moduleMatch})`;
        }
        return `${mockApi}(${pathMatch}, ${buildExplicitMockedModuleFactory(moduleMatch)})`;
      }

      return `${mockApi}(${pathMatch}, () => ({ default: ${moduleMatch} }))`;
    },
  },
  {
    rule: { pattern: 'jest.mock($PATH, $CALLBACK)' },
    transformer: node => {
      const pathMatch = node.getMatch('PATH')?.text();
      const callbackMatch = node.getMatch('CALLBACK');
      if (pathMatch == null || callbackMatch == null) return undefined;

      const mockApi = shouldUseViDoMock(node) ? 'vi.doMock' : 'vi.mock';
      return `${mockApi}(${pathMatch}, ${callbackMatch.text().trim()})`;
    },
  },
  {
    rule: {
      any: [
        { pattern: `jest.doMock($${PATH_MATCH_KEY}, () => $${MODULE_MATCH_KEY})` },
        { pattern: `jest.doMock($${PATH_MATCH_KEY})` },
      ],
    },
    transformer: node => {
      const pathMatch = node.getMatch(PATH_MATCH_KEY)?.text();
      invariant(pathMatch != null, 'There should be a path match');

      const moduleMatchNode = node.getMatch(MODULE_MATCH_KEY);
      if (moduleMatchNode == null) return `vi.doMock(${pathMatch})`;

      if (moduleMatchNode.kind() === 'statement_block') return undefined;

      const moduleMatch = moduleMatchNode.text().trim();
      const moduleObject = objectExpressionFrom(moduleMatchNode);

      if (moduleObject != null) {
        if (hasDefaultKey(moduleObject)) {
          return `vi.doMock(${pathMatch}, () => ${moduleMatch})`;
        }
        return `vi.doMock(${pathMatch}, ${buildExplicitMockedModuleFactory(moduleMatch)})`;
      }

      return `vi.doMock(${pathMatch}, () => ({ default: ${moduleMatch} }))`;
    },
  },
  {
    rule: { pattern: 'jest.doMock($PATH, $CALLBACK)' },
    transformer: node => {
      const pathMatch = node.getMatch('PATH')?.text();
      const callbackMatch = node.getMatch('CALLBACK');
      if (pathMatch == null || callbackMatch == null) return undefined;

      return `vi.doMock(${pathMatch}, ${callbackMatch.text().trim()})`;
    },
  },
  {
    rule: { pattern: 'jest.setMock($PATH, $VALUE)' },
    transformer: node => {
      const pathMatch = node.getMatch('PATH')?.text();
      const valueMatch = node.getMatch('VALUE')?.text();
      invariant(pathMatch != null && valueMatch != null, 'setMock requires path and value');
      const mockApi = shouldUseViDoMock(node) ? 'vi.doMock' : 'vi.mock';

      return `${mockApi}(${pathMatch}, () => ({ ...${valueMatch}, default: ${valueMatch} }))`;
    },
  },
  {
    rule: { pattern: 'jest.$REST' },
    transformer: node => {
      const rest = node.getMatch('REST');
      invariant(rest != null, 'rest should be present at this point');

      return node.replace(`vi.${rest.text()}`);
    },
  },
];

const NORMALIZE_VI_MOCK_FACTORIES: Array<FindAndReplaceConfig> = [
  {
    rule: { pattern: 'vi.mock($PATH, $CALLBACK)' },
    transformer: node => {
      const callbackMatch = node.getMatch('CALLBACK');
      if (callbackMatch == null) return undefined;

      const callbackKind = callbackMatch.kind();
      if (callbackKind !== 'arrow_function' && callbackKind !== 'function_expression') {
        return undefined;
      }

      const normalizedCallback = normalizeViMockFactoryCallback(callbackMatch);
      if (normalizedCallback == null || normalizedCallback === callbackMatch.text()) {
        return undefined;
      }

      return spliceNodeText(node, callbackMatch, normalizedCallback);
    },
  },
];

function blockAlreadyClearsAllMocks(node: AstNode): boolean {
  const enclosing =
    traverseUp(node, currentNode => currentNode.kind() === 'statement_block') ??
    traverseUp(node, currentNode => currentNode.kind() === 'expression_statement');

  if (enclosing == null) return true;

  return (
    enclosing.findAll({
      rule: { any: [{ pattern: 'vi.clearAllMocks()' }, { pattern: 'jest.clearAllMocks()' }] },
    }).length > 0
  );
}

const VI_COMPAT_FIXES: Array<FindAndReplaceConfig> = [
  {
    rule: { pattern: 'vi.restoreAllMocks()' },
    transformer: node => {
      if (blockAlreadyClearsAllMocks(node)) return undefined;

      const containingHook = traverseUp(node, currentNode => {
        if (currentNode.kind() !== 'call_expression') return false;
        const callText = currentNode.text().trim();
        return callText.startsWith('afterEach(') || callText.startsWith('beforeEach(');
      });
      if (containingHook == null) {
        return undefined;
      }

      return node.replace('vi.restoreAllMocks(); vi.clearAllMocks()');
    },
  },
  {
    rule: { pattern: 'vi.dontMock($ARG)' },
    transformer: node => {
      const argMatch = node.getMatch('ARG')?.text();
      if (argMatch == null) return undefined;
      return `vi.doUnmock(${argMatch})`;
    },
  },
  {
    rule: { pattern: 'ReactDOM.createRoot = vi.fn().$METHOD($$$ARGS)' },
    transformer: node => {
      const methodMatch = node.getMatch('METHOD')?.text();
      const argsText = node
        .getMultipleMatches('ARGS')
        .map(match => match.text())
        .join(', ');
      if (methodMatch == null) {
        return undefined;
      }

      return `vi.mocked(ReactDOM.createRoot).${methodMatch}(${argsText})`;
    },
  },
  {
    rule: { pattern: 'expect(import($PATH)).rejects.$METHOD($$$ARGS)' },
    transformer: node => {
      const pathMatch = node.getMatch('PATH')?.text();
      if (pathMatch == null || !/^['"].+['"]$/.test(pathMatch)) {
        return undefined;
      }

      return node.text().replace(`import(${pathMatch})`, `import(${appendVitestExpectedErrorQuery(pathMatch)})`);
    },
  },
  {
    rule: { kind: 'expression_statement', has: { pattern: 'await import($PATH)' } },
    transformer: node => {
      const enclosing = traverseUp(node, currentNode => {
        const kind = currentNode.kind();
        return kind === 'statement_block' || kind === 'program';
      });
      if (enclosing != null && enclosing.text().includes('vi.dynamicImportSettled()')) {
        return undefined;
      }

      const awaitImport = node.find({ rule: { pattern: 'await import($PATH)' } });
      if (awaitImport == null) {
        return undefined;
      }

      return `${node.text()}\nawait vi.dynamicImportSettled()`;
    },
  },
  {
    rule: { pattern: 'vi.resetModules()' },
    transformer: node => {
      if (blockAlreadyClearsAllMocks(node)) return undefined;

      return node.replace('vi.resetModules(); vi.clearAllMocks()');
    },
  },
];

const FAKE_TIMER_COMPAT_FIXES: Array<FindAndReplaceConfig> = [
  {
    rule: { pattern: 'waitFor($$$ARGS)' },
    transformer: node => {
      const callText = node.text();
      if (callText.startsWith('vi.waitFor(')) {
        return undefined;
      }

      return callText.replace(/^waitFor\(/, 'vi.waitFor(');
    },
  },
  {
    rule: { pattern: 'userEvent.setup({ delay: null })' },
    transformer: `userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime })`,
  },
  {
    rule: { kind: 'expression_statement', has: { pattern: 'vi.runAllTimers()' } },
    transformer: node => {
      const containingFunction = traverseUp(node, currentNode => {
        const kind = currentNode.kind();
        return (
          kind === 'arrow_function' ||
          kind === 'function_expression' ||
          kind === 'function_declaration' ||
          kind === 'function'
        );
      });
      if (containingFunction == null || !containingFunction.text().trim().startsWith('async ')) {
        return undefined;
      }

      return node.text().replace('vi.runAllTimers()', 'await vi.runAllTimersAsync()');
    },
  },
];

const MOCK_IMPL_ARROW_TO_FUNCTION: Array<FindAndReplaceConfig> = [
  {
    rule: {
      any: [
        { pattern: '$OBJ.mockImplementation($FN)' },
        { pattern: '$OBJ.mockImplementationOnce($FN)' },
        { pattern: 'vi.fn($FN)' },
      ],
    },
    transformer: node => {
      const fnMatch = node.getMatch('FN');
      if (fnMatch == null || fnMatch.kind() !== 'arrow_function') return undefined;

      const arrowText = fnMatch.text();
      const children = fnMatch.children();
      const arrowToken = children.find(c => c.kind() === '=>');
      if (arrowToken == null) return undefined;

      const arrowOffset = arrowToken.range().start.index - fnMatch.range().start.index;
      const paramsPart = arrowText.substring(0, arrowOffset).trim();
      const bodyPart = arrowText.substring(arrowOffset + 2).trim();

      const asyncPrefix = paramsPart.startsWith('async ') ? 'async ' : '';
      const rawParams = asyncPrefix ? paramsPart.slice(6).trim() : paramsPart;
      const normalizedParams = rawParams.startsWith('(') ? rawParams : `(${rawParams})`;

      let functionBody: string;
      if (bodyPart.startsWith('{')) {
        functionBody = bodyPart;
      } else {
        functionBody = `{ return ${bodyPart}; }`;
      }

      const regularFn = `${asyncPrefix}function${normalizedParams} ${functionBody}`;
      const fullText = node.text();
      return fullText.replace(arrowText, regularFn);
    },
  },
];

async function replaceJestApiWithViModification(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, JEST_TO_VITEST_API_MAPPING);
}

export async function replaceJestRequireMock(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, JEST_REQUIRE_MOCK);
}

export async function convertMockImplArrowToFunction(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, MOCK_IMPL_ARROW_TO_FUNCTION);
}

export async function fixViCompatIssues(modifications: Modifications): Promise<Modifications> {
  const updatedModifications = await findAndReplaceConfigModifications(modifications, VI_COMPAT_FIXES);
  if (!updatedModifications.ast.root().text().includes('vi.useFakeTimers(')) return updatedModifications;

  return findAndReplaceConfigModifications(updatedModifications, FAKE_TIMER_COMPAT_FIXES);
}

export async function normalizeViMockFactories(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, NORMALIZE_VI_MOCK_FACTORIES);
}

export async function replaceJestDontMock(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, JEST_DONTMOCK_MAPPING);
}

export async function replaceJestRequireActual(modifications: Modifications): Promise<Modifications> {
  return findAndReplaceConfigModifications(modifications, JEST_REQUIRE_ACTUAL_MAPPING);
}

export default replaceJestApiWithViModification;
