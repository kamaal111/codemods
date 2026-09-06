import { parseAsync } from '@ast-grep/napi';
import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiRemoveOptionsFromRegex from '../../../../src/codemods/joi-to-zod/rules/joi-remove-options-from-regex';
import { invalidRuleSignal } from '../../../test-utils/detection-theory';

test('Joi remove options from regex', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  nickname: Joi.string()
    .required()
    .min(3)
    .max(20)
    .description('Nickname')
    .regex(/^[a-z]+$/, { name: 'alpha', invert: true }),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveOptionsFromRegex(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('alpha');
  expect(updatedSource).not.contain('invert');
  expect(updatedSource).toContain('.regex(/^[a-z]+$/)');
});

test('preserves a regex expression when no Joi options are present', async () => {
  const source = "import Joi from 'joi';\nconst schema = Joi.string().regex(/^[a-z]+$/);";
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, source);

  const modifications = await joiRemoveOptionsFromRegex(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('.regex(/^[a-z]+$/)');
  expect(modifications.ast.root().text()).toBe(source);
});

test('removes an empty trailing Joi options argument', async () => {
  const source = "import Joi from 'joi';\nconst schema = Joi.string().regex(/^[a-z]+$/, );";
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveOptionsFromRegex(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('.regex(/^[a-z]+$/)');
});
