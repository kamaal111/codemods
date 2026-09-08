import { parseAsync } from '@ast-grep/napi';

import joiToZod, {
  JOI_TO_ZOD_CODEMOD,
  JOI_TO_ZOD_LANGUAGE,
  joiToZodTransformer,
  makeJoiToZodInitialModification,
} from '../../../src/codemods/joi-to-zod';

async function transform(body: string): Promise<string> {
  return joiToZod(`import Joi from 'joi';\n\n${body}\n`);
}

test('leaves files without a Joi import untouched', async () => {
  const source = `export const MAX_YEAR = 2013;\n`;

  expect(await joiToZod(source)).toBe(source);
});

test('leaves files importing another package untouched', async () => {
  const source = `import { z } from 'zod';\n\nexport const schema = z.string();\n`;

  expect(await joiToZod(source)).toBe(source);
});

test('reports no changes for a file it skips', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, 'export const value = 1;\n');
  const modifications = await joiToZodTransformer('export const value = 1;\n');

  expect(modifications.report.changesApplied).toBe(0);
  expect(modifications.history).toHaveLength(1);
  expect(makeJoiToZodInitialModification(ast).report.changesApplied).toBe(0);
});

test('exposes the codemod definition', () => {
  expect(JOI_TO_ZOD_CODEMOD.name).toBe('joi-to-zod-transformer');
  expect(JOI_TO_ZOD_CODEMOD.languages).toContain(JOI_TO_ZOD_LANGUAGE);
});

test('swaps the joi import for zod', async () => {
  const output = await transform('export const schema = Joi.string().required();');

  expect(output).contain(`import { z } from "zod"`);
  expect(output).not.contain('joi');
  expect(output).not.contain('Joi');
});

test('converts a representative schema end to end', async () => {
  const output = await transform(`export const schema = Joi.object().keys({
  id: Joi.string().guid().required(),
  website: Joi.string().uri(),
  age: Joi.number().integer().min(0).required(),
  tags: Joi.array().items(Joi.string()),
  metadata: Joi.object().pattern(Joi.string(), Joi.number()),
  kind: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
});`);

  expect(output).toMatchSnapshot();
  expect(output).contain('z.uuid()');
  expect(output).contain('z.url().optional()');
  expect(output).contain('z.number().int().min(0)');
  expect(output).contain('z.array(z.string())');
  expect(output).contain('z.record(z.string(), z.number())');
  expect(output).contain('z.union([z.string(), z.number()])');
  expect(output).contain('.strict()');
});

test('converts a representative schema end to end with a renamed default import', async () => {
  const source = `import Validator from 'joi';

export const schema = Validator.object().keys({
  id: Validator.string().guid().required(),
  website: Validator.string().uri(),
  age: Validator.number().integer().min(0).required(),
  tags: Validator.array().items(Validator.string()),
  metadata: Validator.object().pattern(Validator.string(), Validator.number()),
  kind: Validator.alternatives().try(Validator.string(), Validator.number()).required(),
});
`;
  const output = await joiToZod(source);

  expect(output).contain(`import { z } from "zod"`);
  expect(output).contain('z.uuid()');
  expect(output).contain('z.url().optional()');
  expect(output).contain('z.number().int().min(0)');
  expect(output).contain('z.array(z.string())');
  expect(output).contain('z.record(z.string(), z.number())');
  expect(output).contain('z.union([z.string(), z.number()])');
  expect(output).contain('.strict()');
  expect(output).not.contain('Validator');
  expect(output).not.contain('joi');
});

test('converts a default-as joi import while retaining named imports', async () => {
  const source = `import { default as J, ValidationError } from 'joi';

export const schema = J.string().required();
export const error = ValidationError;
`;
  const output = await joiToZod(source);

  expect(output).contain(`import { ValidationError } from 'joi';`);
  expect(output).contain(`import { z } from "zod"`);
  expect(output).contain('export const schema = z.string();');
  expect(output).contain('export const error = ValidationError;');
  expect(output).not.contain('default as J');
});

test('runs object pattern before the string pattern mapping', async () => {
  const output = await transform('export const schema = Joi.object().pattern(Joi.string(), Joi.number());');

  expect(output).contain('z.record(z.string(), z.number())');
  expect(output).not.contain('regex(');
});

test('hoists a format ahead of the enum rewrite', async () => {
  const output = await transform("export const schema = Joi.string().valid('a', 'b').required();");

  expect(output).contain('z.enum(');
  expect(output).not.contain('z.string().enum(');
});

test('keeps nested schemas optional independently of the outer schema', async () => {
  const output = await transform(`export const schema = Joi.object().keys({
  required: Joi.string().required(),
  optional: Joi.string(),
});`);

  expect(output).contain('required: z.string(),');
  expect(output).contain('optional: z.string().optional()');
});

test('does not mark record key and value schemas optional', async () => {
  const output = await transform('export const schema = Joi.object().pattern(Joi.string(), Joi.number());');

  expect(output).not.contain('z.string().optional(), z.number()');
  expect(output).contain('z.record(z.string(), z.number())');
});

test('converts a conditional, an assertion, and a custom callback together', async () => {
  const output = await transform(`export const schema = Joi.object().keys({
  type: Joi.string().required(),
  detail: Joi.string().when('type', { is: 'a', then: Joi.required(), otherwise: Joi.forbidden() }),
  password: Joi.string(),
  confirm: Joi.string(),
  code: Joi.string().custom(value => value.trim()),
}).assert('.confirm', Joi.ref('password'), 'must match');`);

  expect(output).toMatchSnapshot();
  expect(output).not.contain('.when(');
  expect(output).not.contain('.assert(');
  expect(output).not.contain('.custom(');
  expect(output).not.contain('TODO(joi-to-zod)');
  expect(output).not.contain('Joi');
});

test('converts the schema inside a conditional branch to zod', async () => {
  const output = await transform(`export const schema = Joi.object().keys({
  kind: Joi.string(),
  id: Joi.string().when('kind', { is: 'user', then: Joi.string().guid().required() }),
});`);

  expect(output).contain('z.uuid()');
  expect(output).not.contain('Joi');
});

test('still flags a conditional form with no mechanical equivalent', async () => {
  const output = await transform(`export const schema = Joi.object().keys({
  type: Joi.string(),
  detail: Joi.string().when('type', { switch: [{ is: 'a', then: Joi.required() }] }),
});`);

  expect(output).contain('TODO(joi-to-zod)');
  expect(output).contain('when()');
});

test('still flags a custom callback needing helpers beyond the shim', async () => {
  const output = await transform('export const schema = Joi.string().custom((value, helpers) => helpers.state.path);');

  expect(output).contain('TODO(joi-to-zod)');
  expect(output).contain('custom()');
});

test('is idempotent on already-migrated output', async () => {
  const source = `import Joi from 'joi';\n\nexport const schema = Joi.string().required();\n`;
  const once = await joiToZod(source);

  expect(await joiToZod(once)).toBe(once);
});

test('is idempotent on migrated conditional output', async () => {
  const source = `import Joi from 'joi';

export const schema = Joi.object().keys({
  type: Joi.string(),
  detail: Joi.string().when('type', { is: 'a', then: Joi.required() }),
});
`;
  const once = await joiToZod(source);

  expect(await joiToZod(once)).toBe(once);
});
