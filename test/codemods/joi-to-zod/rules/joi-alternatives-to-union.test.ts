import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiAlternativesToUnion from '../../../../src/codemods/joi-to-zod/rules/joi-alternatives-to-union';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi alternatives try to Zod union', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  value: Joi.alternatives().try(Joi.string(), Joi.number()),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAlternativesToUnion(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('alternatives');
  expect(updatedSource).not.contain('try');
  expect(updatedSource).toContain('Joi.union([Joi.string(), Joi.number()])');
});

test('Joi alternatives try to Zod union valid', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().min(3).max(30),
});
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAlternativesToUnion(makeJoiToZodInitialModification(ast));
  });
});
