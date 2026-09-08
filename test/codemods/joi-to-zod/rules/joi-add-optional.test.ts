import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiAddOptional from '../../../../src/codemods/joi-to-zod/rules/joi-add-optional';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi add optional', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
  birthyear: Joi.number().integer().min(1970).max(2013),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(2);
  expect(updatedSource).not.contain('required().optional');
  expect(updatedSource, updatedSource).contain('birthyear: Joi.number().integer().min(1970).max(2013).optional()');
});

test('Joi add optional leaves an explicitly required object unchanged', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
  birthyear: Joi.number().integer().min(1970).max(2013).required(),
}).required();
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });
});

test('Joi add optional ignores required calls in nested object fields', async () => {
  const source = `
import Joi from 'joi';

export const nested = Joi.object({ id: Joi.string().required() });
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('Joi.object({ id: Joi.string().required() }).optional()');
});

test('Joi add optional ignores closing delimiters inside comments', async () => {
  const source = `
import Joi from 'joi';

export const required = Joi.string() /* ) } ] */ .required();
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });
});

test('Joi add optional does not confuse a nested call with its parent through comments', async () => {
  const source = `
import Joi from 'joi';

export const nested = Joi.object({
  child: Joi.string() /* } */ .required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(updatedSource).toContain('child: Joi.string() /* } */ .required(),');
  expect(updatedSource).toContain('}).optional()');
  expect(updatedSource).not.toContain('.required().optional()');
});

test('Joi add optional reads presence from namespaced intermediate chains', async () => {
  const source = `
import Joi from 'joi';

export const requiredDate = Joi.coerce.date().required();
export const optionalDate = Joi.iso.datetime().optional();
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });
});

test('Joi add optional ignores call-like text inside nested callbacks and literals', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.string().transform(value => \`${'${value}'} .required() /* ) */\`);
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain(
    'Joi.string().transform(value => `${value} .required() /* ) */`).optional()',
  );
});
