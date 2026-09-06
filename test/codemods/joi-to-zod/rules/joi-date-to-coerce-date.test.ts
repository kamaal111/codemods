import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiDateToCoerceDate from '../../../../src/codemods/joi-to-zod/rules/joi-date-to-coerce-date';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

async function transform(schema: string): Promise<string> {
  const source = `
import Joi from 'joi';

export const schema = ${schema};
`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiDateToCoerceDate(makeJoiToZodInitialModification(ast));
  });

  return modifications.ast.root().text();
}

test('converts Joi.date() to a coercing date', async () => {
  expect(await transform('Joi.date()')).contain('Joi.coerce.date()');
});

test('wraps a string bound in a Date', async () => {
  expect(await transform("Joi.date().min('2020-01-01')")).contain("Joi.coerce.date().min(new Date('2020-01-01'))");
});

test('wraps a numeric bound in a Date', async () => {
  expect(await transform('Joi.date().min(1700000000000)')).contain('.min(new Date(1700000000000))');
});

test('leaves an empty bound empty instead of inventing a value', async () => {
  expect(await transform('Joi.date().min()')).contain('.min()');
});

test("converts the 'now' bound to a Date", async () => {
  expect(await transform("Joi.date().max('now')")).contain('Joi.coerce.date().max(new Date())');
});

test('maps greater and less onto min and max', async () => {
  const updatedSource = await transform("Joi.date().greater('2020-01-01').less('2030-01-01')");

  expect(updatedSource).contain(".min(new Date('2020-01-01'))");
  expect(updatedSource).contain(".max(new Date('2030-01-01'))");
});

test('leaves a non-literal bound for the author to judge', async () => {
  expect(await transform('Joi.date().min(startOfYear)')).contain('.min(startOfYear)');
});

test('leaves non-date schemas untouched', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.number().min(1);
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiDateToCoerceDate(makeJoiToZodInitialModification(ast));
  });
});
