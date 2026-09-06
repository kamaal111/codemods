import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiAddManualMigrationTodo from '../../../../src/codemods/joi-to-zod/rules/joi-add-manual-migration-todo';

test('adds migration TODOs for unsupported Joi validation APIs', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.object({ value: Joi.string().custom(validateValue) }).when('type', { then: Joi.string() }).assert('value', Joi.string());",
  );

  const modifications = await joiAddManualMigrationTodo(makeJoiToZodInitialModification(ast));
  const output = modifications.ast.root().text();

  expect(output).toContain('TODO(joi-to-zod): Manually migrate when()');
  expect(output).toContain('TODO(joi-to-zod): Manually migrate custom()');
  expect(output).toContain('TODO(joi-to-zod): Manually migrate assert()');
});
