import { parseAsync } from '@ast-grep/napi';
import { expect, test } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiRemoveRequired from '../../../../src/codemods/joi-to-zod/rules/joi-remove-required';

test('removes required from a chained schema property', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.object({ first: Joi.string().required(), second: Joi.string().required().max(10) });",
  );

  const modifications = await joiRemoveRequired(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('first: Joi.string()');
  expect(modifications.ast.root().text()).toContain('second: Joi.string().max(10)');
});

test('removes required from every overlapping schema chain', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.object({ nested: Joi.string().required() }).required();",
  );

  const modifications = await joiRemoveRequired(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toBe(
    "import Joi from 'joi';\n\nconst schema = Joi.object({ nested: Joi.string() });",
  );
});
