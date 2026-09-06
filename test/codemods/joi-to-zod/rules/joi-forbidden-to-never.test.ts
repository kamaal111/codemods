import { parseAsync } from '@ast-grep/napi';
import { expect, test } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiForbiddenToNever from '../../../../src/codemods/joi-to-zod/rules/joi-forbidden-to-never';

test('rewrites Joi forbidden to a never schema', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, "import Joi from 'joi';\n\nconst schema = Joi.forbidden();");

  const modifications = await joiForbiddenToNever(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.never()');
});
