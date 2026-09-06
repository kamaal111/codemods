import { parseAsync } from '@ast-grep/napi';
import { expect, test } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiBinaryToInstanceof from '../../../../src/codemods/joi-to-zod/rules/joi-binary-to-instanceof';

test('rewrites Joi binary to an instanceof schema', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, "import Joi from 'joi';\n\nconst file = Joi.binary().optional();");

  const modifications = await joiBinaryToInstanceof(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.instanceof(Buffer).optional()');
});
