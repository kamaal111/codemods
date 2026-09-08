import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiObjectKeysUnnest from '../../../../src/codemods/joi-to-zod/rules/joi-object-keys-unnest';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi unnest object', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectKeysUnnest(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('keys');
  expect(updatedSource).toContain('Joi.object({');
});

test('Joi unnest object keys declared later in the chain', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().unknown(false).keys({ name: Joi.string().required() });
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectKeysUnnest(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('Joi.object({ name: Joi.string().required() }).unknown(false)');
});

test('Joi unnest object valid', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object({name: Joi.string().alphanum().min(3).max(30).required()});
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectKeysUnnest(makeJoiToZodInitialModification(ast));
  });
});

test('Joi unnest object leaves a keyless object schema alone', async () => {
  const source = `
import Joi from 'joi';

export const anything = Joi.object().required();
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectKeysUnnest(makeJoiToZodInitialModification(ast));
  });
});
