import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiSchemaTypesToZodTypes from '../../../../src/codemods/joi-to-zod/rules/joi-schema-types-to-zod-types';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi schema types to Zod types', async () => {
  const source = `
import Joi from 'joi';

export const employee: Joi.ObjectSchema = Joi.object({ name: Joi.string().required() });

export function extend(schema: Joi.Schema, shape: Joi.SchemaMap): Joi.AnySchema {
  return schema.keys(shape);
}
`;

  const modifications = await invalidRuleSignal(
    source,
    JOI_TO_ZOD_LANGUAGE,
    ast => joiSchemaTypesToZodTypes(makeJoiToZodInitialModification(ast)),
    2,
  );
  const updatedSource = modifications.ast.root().text();

  expect(updatedSource).toContain('employee: z.ZodType =');
  expect(updatedSource).toContain('schema: z.ZodType, shape: z.ZodRawShape');
  expect(updatedSource).toContain('): z.ZodType {');
});

test('Joi schema types to Zod types keeps the validated type argument', async () => {
  const source = `
import Joi from 'joi';

interface User {
  name: string;
}

export const user: Joi.ObjectSchema<User> = Joi.object({ name: Joi.string().required() });
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiSchemaTypesToZodTypes(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('user: z.ZodType<User> =');
});

test('Joi schema types to Zod types valid', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object({ name: Joi.string().required() });
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiSchemaTypesToZodTypes(makeJoiToZodInitialModification(ast));
  });
});

test('Joi schema types to Zod types leaves unrelated joi types alone', async () => {
  const source = `
import Joi from 'joi';

export function report(error: Joi.ValidationError): Joi.ValidationResult {
  throw error;
}
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiSchemaTypesToZodTypes(makeJoiToZodInitialModification(ast));
  });
});
