import { test, expect } from '@rstest/core';

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

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('required().optional');
  expect(updatedSource, updatedSource).contain('birthyear: Joi.number().integer().min(1970).max(2013).optional()');
});

test('Joi add optional valid', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
  birthyear: Joi.number().integer().min(1970).max(2013).required(),
});
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAddOptional(makeJoiToZodInitialModification(ast));
  });
});
