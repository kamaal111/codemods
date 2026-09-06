import { JEST_TO_VITEST_LANGUAGE, makeJestToVitestInitialModification } from '../../../../src/codemods/jest-to-vitest';
import addVitestImports from '../../../../src/codemods/jest-to-vitest/rules/add-vitest-imports';
import { doneCallbackToPromise } from '../../../../src/codemods/jest-to-vitest/rules/done-callback-to-promise';
import jestFocusedSkippedToVitest from '../../../../src/codemods/jest-to-vitest/rules/jest-focused-skipped-to-vitest';
import jestHooksToVitest from '../../../../src/codemods/jest-to-vitest/rules/jest-hooks-to-vitest';
import jestMockTypeToVitest from '../../../../src/codemods/jest-to-vitest/rules/jest-mock-type-to-vitest';
import removeJestImport from '../../../../src/codemods/jest-to-vitest/rules/remove-jest-import';
import replaceJestApiWithVi, {
  convertMockImplArrowToFunction,
  fixViCompatIssues,
  normalizeViMockFactories,
  replaceJestDontMock,
  replaceJestRequireActual,
  replaceJestRequireMock,
} from '../../../../src/codemods/jest-to-vitest/rules/replace-jest-api-with-vi';
import { requireToDynamicImport } from '../../../../src/codemods/jest-to-vitest/rules/require-to-dynamic-import';
import type { Modifications } from '../../../../src/kit/types.ts';
import { validRuleSignal } from '../../../test-utils/detection-theory';

type Rule = (modifications: Modifications) => Promise<Modifications>;

const RULES: Array<[string, Rule]> = [
  ['replace-jest-api-with-vi', replaceJestApiWithVi],
  ['replace-jest-dont-mock', replaceJestDontMock],
  ['replace-jest-require-actual', replaceJestRequireActual],
  ['replace-jest-require-mock', replaceJestRequireMock],
  ['normalize-vi-mock-factories', normalizeViMockFactories],
  ['convert-mock-impl-arrow-to-function', convertMockImplArrowToFunction],
  ['done-callback-to-promise', doneCallbackToPromise],
  ['require-to-dynamic-import', requireToDynamicImport],
  ['jest-focused-skipped-to-vitest', jestFocusedSkippedToVitest],
  ['jest-hooks-to-vitest', jestHooksToVitest],
  ['jest-mock-type-to-vitest', jestMockTypeToVitest],
  ['add-vitest-imports', addVitestImports],
  ['remove-jest-import', removeJestImport],
  ['fix-vi-compat-issues', fixViCompatIssues],
];

// Already-migrated source: every name a rule looks for is spelled the Vitest way, so a rule that
// matched here would be rewriting its own output on a second run.
const ALREADY_VITEST = `
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./calculator', () => import('./__mocks__/calculator'));

describe('calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('adds', async () => {
    const actual = await vi.importActual('./calculator');
    expect(vi.fn()).toBeDefined();
    expect(actual).toBeDefined();
  });
});
`;

test.each(RULES)('%s leaves already-migrated Vitest source alone', async (_name, rule) => {
  await validRuleSignal(ALREADY_VITEST, JEST_TO_VITEST_LANGUAGE, ast => rule(makeJestToVitestInitialModification(ast)));
});

test.each(RULES)('%s leaves a file with no test framework calls alone', async (_name, rule) => {
  await validRuleSignal('\nexport const value = 1;\n', JEST_TO_VITEST_LANGUAGE, ast => {
    return rule(makeJestToVitestInitialModification(ast));
  });
});

test('every rule in the pipeline is covered by these guards', () => {
  expect(RULES).toHaveLength(14);
});
