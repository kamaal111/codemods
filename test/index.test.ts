import { expect, test } from '@rstest/core';

import * as codemods from '../src/index.ts';

test('exposes only the supported programmatic interface', () => {
  expect(Object.keys(codemods).sort()).toEqual([
    'JOI_TO_ZOD_CODEMOD',
    'JOI_TO_ZOD_LANGUAGE',
    'default',
    'joiToZodTransformer',
    'run',
  ]);
});
