import * as codemods from '../src/index.ts';

test('exposes only the supported programmatic interface', () => {
  expect(Object.keys(codemods).sort()).toEqual([
    'JEST_TO_VITEST_CODEMOD',
    'JEST_TO_VITEST_LANGUAGE',
    'JEST_TO_VITEST_TSX_LANGUAGE',
    'JOI_TO_ZOD_CODEMOD',
    'JOI_TO_ZOD_LANGUAGE',
    'default',
    'jestToVitest',
    'jestToVitestTransformer',
    'joiToZodTransformer',
    'run',
  ]);
});
