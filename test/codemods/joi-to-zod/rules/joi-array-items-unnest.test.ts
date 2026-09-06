import { parseAsync } from '@ast-grep/napi';
import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiArrayItemsUnnest from '../../../../src/codemods/joi-to-zod/rules/joi-array-items-unnest';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi array items unnest', async () => {
  const source = `
import Joi from 'joi';

export const tags = Joi.array().items(Joi.string());
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiArrayItemsUnnest(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('items');
  expect(updatedSource).toContain('Joi.array(Joi.string())');
});

test('Joi array items unnest valid', async () => {
  const source = `
import Joi from 'joi';

export const tags = Joi.array(Joi.string());
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiArrayItemsUnnest(makeJoiToZodInitialModification(ast));
  });
});

test('Joi array items unnest converts every overlapping schema chain', async () => {
  const source = `
import Joi from 'joi';

export const schemas = {
  tags: Joi.array().items(Joi.string()),
  ids: Joi.array().items(Joi.number()),
};
`;
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, source);

  const modifications = await joiArrayItemsUnnest(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('tags: Joi.array(Joi.string())');
  expect(modifications.ast.root().text()).toContain('ids: Joi.array(Joi.number())');
});
