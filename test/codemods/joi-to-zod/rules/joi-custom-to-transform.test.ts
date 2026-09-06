import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiCustomToTransform from '../../../../src/codemods/joi-to-zod/rules/joi-custom-to-transform';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

async function transform(body: string, historyLength?: number): Promise<string> {
  const source = `
import Joi from 'joi';

export const schema = ${body};
`;
  const modifications = await invalidRuleSignal(
    source,
    JOI_TO_ZOD_LANGUAGE,
    ast => {
      return joiCustomToTransform(makeJoiToZodInitialModification(ast));
    },
    historyLength,
  );

  return modifications.ast.root().text();
}

async function expectUntouched(body: string): Promise<void> {
  const source = `
import Joi from 'joi';

export const schema = ${body};
`;
  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCustomToTransform(makeJoiToZodInitialModification(ast));
  });
}

test('maps a callback that ignores helpers straight onto transform', async () => {
  const updatedSource = await transform('Joi.string().custom(value => value.trim())');

  expect(updatedSource).contain('Joi.string().transform(value => value.trim())');
  expect(updatedSource).not.contain('helpers');
});

test('maps a two-parameter callback that never uses helpers onto transform', async () => {
  const updatedSource = await transform('Joi.string().custom((value, helpers) => value.trim())');

  expect(updatedSource).contain('.transform((value, helpers) => value.trim())');
  expect(updatedSource).not.contain('ctx.addIssue');
});

test('maps a referenced callback onto transform', async () => {
  const updatedSource = await transform('Joi.string().custom(normalise)');

  expect(updatedSource).contain('.transform(normalise)');
});

test('adapts a callback using helpers.error without rewriting its body', async () => {
  const updatedSource = await transform(
    "Joi.string().custom((value, helpers) => { if (value === 'bad') return helpers.error('any.invalid'); return value; })",
  );

  expect(updatedSource).contain('.transform((value, ctx) => {');
  expect(updatedSource).contain('ctx.addIssue');
  expect(updatedSource).contain('z.NEVER');
  expect(updatedSource).contain("if (value === 'bad') return helpers.error('any.invalid'); return value;");
  expect(updatedSource).contain('(value, helpers)');
});

test('adapts a callback using helpers.message', async () => {
  const updatedSource = await transform('Joi.string().custom((value, helpers) => helpers.message({ custom: "no" }))');

  expect(updatedSource).contain('.transform((value, ctx) => {');
  expect(updatedSource).contain('message: (text: unknown) =>');
});

test('converts a custom followed only by a presence call', async () => {
  const updatedSource = await transform('Joi.string().custom(value => value.trim()).required()');

  expect(updatedSource).contain('.transform(value => value.trim()).required()');
});

test('refuses to convert when a call follows that a transform would remove', async () => {
  await expectUntouched('Joi.string().custom(value => value.trim()).min(3)');
});

test('refuses to convert a callback needing helpers beyond the shim', async () => {
  await expectUntouched('Joi.string().custom((value, helpers) => helpers.state.path)');
});

test('converts a custom on a nested object property', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  outer: Joi.object().keys({ code: Joi.string().custom(value => value.trim()) }),
})`);

  expect(updatedSource).contain('code: Joi.string().transform(value => value.trim())');
});

test('converts every custom in a file', async () => {
  const updatedSource = await transform(
    `Joi.object().keys({
  a: Joi.string().custom(value => value.trim()),
  b: Joi.string().custom(value => value.toUpperCase()),
})`,
    2,
  );

  expect(updatedSource).not.contain('.custom(');
  expect(updatedSource.match(/\.transform\(/g)).toHaveLength(2);
});

test('leaves schemas without a custom untouched', async () => {
  await expectUntouched('Joi.string().min(3)');
});

test('refuses to convert a custom with no callback', async () => {
  await expectUntouched('Joi.string().custom()');
});

test('converts a function-expression callback', async () => {
  const updatedSource = await transform('Joi.string().custom(function (value) { return value.trim(); })');

  expect(updatedSource).contain('.transform(function (value) { return value.trim(); })');
});

test('adapts a function-expression callback that uses helpers', async () => {
  const updatedSource = await transform(
    'Joi.string().custom(function (value, helpers) { return helpers.error("any.invalid"); })',
  );

  expect(updatedSource).contain('.transform((value, ctx) => {');
  expect(updatedSource).contain('ctx.addIssue');
});
