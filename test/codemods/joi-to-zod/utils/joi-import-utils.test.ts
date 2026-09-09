import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE } from '../../../../src/codemods/joi-to-zod';
import getJoiIdentifierName from '../../../../src/codemods/joi-to-zod/utils/get-joi-identifier-name';
import getJoiPrimitive from '../../../../src/codemods/joi-to-zod/utils/get-joi-primitive';
import getJoiProperties from '../../../../src/codemods/joi-to-zod/utils/get-joi-properties';
import hasJoiImport from '../../../../src/codemods/joi-to-zod/utils/has-joi-import';
import hasZodImport from '../../../../src/codemods/joi-to-zod/utils/has-zod-import';

async function rootOf(source: string) {
  return (await parseAsync(JOI_TO_ZOD_LANGUAGE, source)).root();
}

test.each([
  ["import Joi from 'joi';", true],
  ['import Joi from "joi";', true],
  ['import { ValidationError } from "joi";', false],
  ['import type { ValidationError } from "joi";', false],
  ["import { z } from 'zod';", false],
  ["import Joi from 'not-joi';", false],
  ['const value = 1;', false],
])('detects a joi import in %s', async (source, expected) => {
  expect(hasJoiImport(await rootOf(source))).toBe(expected);
});

test('reads a renamed joi identifier', async () => {
  expect(getJoiIdentifierName(await rootOf("import Validator from 'joi';"))).toBe('Validator');
});

test.each([
  ["import Validator, { ValidationError } from 'joi';", 'Validator'],
  ["import { default as Validator, ValidationError } from 'joi';", 'Validator'],
  ['import { default as Validator, ValidationError } from "joi";', 'Validator'],
  ["import { ValidationError, default as Validator } from 'joi';", 'Validator'],
])('reads a default joi identifier alongside named imports in %s', async (source, expected) => {
  expect(getJoiIdentifierName(await rootOf(source))).toBe(expected);
});

test('returns undefined for named-only joi imports', async () => {
  expect(getJoiIdentifierName(await rootOf("import { ValidationError } from 'joi';"))).toBeUndefined();
});

test('returns undefined for the joi identifier when there is no joi import', async () => {
  expect(getJoiIdentifierName(await rootOf('const value = 1;'))).toBeUndefined();
});

test.each([
  ["import { z } from 'zod';", true],
  ["import z from 'zod';", true],
  ["import Joi from 'joi';", false],
])('detects a zod import in %s', async (source, expected) => {
  expect(hasZodImport(await rootOf(source))).toBe(expected);
});

test.each([
  ['Joi.string().min(3)', 'string'],
  ['Joi.number().integer()', 'number'],
  ['Joi.object().keys({})', 'object'],
])('reads the primitive of %s', async (chain, expected) => {
  const root = await rootOf(`import Joi from 'joi';\n\nconst schema = ${chain};`);
  const [property] = getJoiProperties(root, { primitive: '*' });
  if (property == null) throw new Error('expected a joi property');

  expect(getJoiPrimitive(property, 'Joi')).toBe(expected);
});

test('finds no properties without a joi import', async () => {
  expect(getJoiProperties(await rootOf('const schema = Joi.string();'), { primitive: '*' })).toEqual([]);
});

test('finds the chains matching a validation name', async () => {
  const root = await rootOf(`import Joi from 'joi';

const schema = Joi.object().keys({
  a: Joi.string().required(),
  b: Joi.number(),
});`);
  const properties = getJoiProperties(root, { primitive: 'string', validationName: 'required()' });

  expect(properties).toHaveLength(1);
  expect(properties[0]?.text()).toBe('Joi.string().required()');
});

test('filters chains by primitive', async () => {
  const root = await rootOf(`import Joi from 'joi';

const a = Joi.string().min(1);
const b = Joi.number().min(1);`);
  const properties = getJoiProperties(root, { primitive: 'number', validationName: 'min($ARGS)' });

  expect(properties.map(property => property.text())).toEqual(['Joi.number().min(1)']);
});

test('matches the exact imported Joi receiver', async () => {
  const root = await rootOf(`import Joi from 'joi';

const schema = JoiHelpers.string().required();`);

  expect(getJoiProperties(root, { primitive: '*' })).toEqual([]);
});

test('reads call chains through comments and line breaks', async () => {
  const root = await rootOf(`import Joi from 'joi';

const schema = Joi /* receiver */
  .string /* primitive */ ()
  .required();`);
  const properties = getJoiProperties(root, { primitive: 'string', validationName: 'required()' });

  expect(properties).toHaveLength(1);
  const [property] = properties;
  if (property == null) throw new Error('expected a Joi property');
  expect(getJoiPrimitive(property, 'Joi')).toBe('string');
});

test('does not infer an outer primitive or validation from a nested argument', async () => {
  const root = await rootOf(`import Joi from 'joi';

const schema = Joi.any().custom(value => Joi.string().min(2));`);

  expect(getJoiProperties(root, { primitive: 'string', validationName: 'custom($ARGS)' })).toEqual([]);
  expect(
    getJoiProperties(root, { primitive: 'string', validationName: 'min($ARGS)' }).map(property => property.text()),
  ).toEqual(['Joi.string().min(2)']);
});

test('keeps recognizing generated namespaced Zod chains before import replacement', async () => {
  const root = await rootOf(`import Joi from 'joi';

const schema = Joi.iso.datetime().required();`);

  expect(getJoiProperties(root, { primitive: '*', validationName: 'required()' })).toHaveLength(1);
});
