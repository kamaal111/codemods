import { parseAsync } from '@ast-grep/napi';
import { expect, test } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiConcatToIntersection from '../../../../src/codemods/joi-to-zod/rules/joi-concat-to-intersection';

test('rewrites Joi concat to an intersection', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.object({ id: Joi.string() }).concat(baseSchema);",
  );

  const modifications = await joiConcatToIntersection(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.intersection(Joi.object({ id: Joi.string() }), baseSchema)');
});
