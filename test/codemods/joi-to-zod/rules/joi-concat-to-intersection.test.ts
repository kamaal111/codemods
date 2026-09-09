import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiConcatToIntersection from '../../../../src/codemods/joi-to-zod/rules/joi-concat-to-intersection';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('rewrites Joi concat to an intersection', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.object({ id: Joi.string() }).concat(baseSchema);",
  );

  const modifications = await joiConcatToIntersection(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.intersection(Joi.object({ id: Joi.string() }), baseSchema)');
});

test('rewrites a comment-separated Joi concat chain', async () => {
  const source = "import Joi from 'joi';\nconst schema = Joi /* root */ .object({}).concat /* call */ (baseSchema);";
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiConcatToIntersection(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('Joi.intersection(Joi /* root */ .object({}), baseSchema)');
});

test('does not rewrite a receiver that merely starts with the Joi binding name', async () => {
  const source = "import Joi from 'joi';\nconst schema = JoiHelpers.schema.concat(baseSchema);";

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiConcatToIntersection(makeJoiToZodInitialModification(ast));
  });
});

test('does not capture unrelated receivers for a short Joi import name', async () => {
  const source = "import J from 'joi';\nconst schema = JsonSchema.concat(baseSchema);";

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiConcatToIntersection(makeJoiToZodInitialModification(ast));
  });
});
