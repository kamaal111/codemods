import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiReferenceToZod from '../../../../src/codemods/joi-to-zod/rules/joi-reference-to-zod';
import { invalidRuleSignal } from '../../../test-utils/detection-theory';

test('Joi references to Zod', async () => {
  const source = `
import Joi from 'joi';

import { MAX_YEAR } from './other-source';

const MINIMUM_YEAR = 1970;

enum Job {
  Developer = 'developer',
  DevOps = 'devops',
  Designer = 'designer',
}

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
  birthyear: Joi.number().integer().min(MINIMUM_YEAR).max(MAX_YEAR),
  job: Joi.string().valid(...Object.values(Job)),
  nickname: Joi.string()
    .required()
    .min(3)
    .max(20)
    .description('Nickname')
    .regex(/^[a-z]+$/, { name: 'alpha', invert: true }),
});
`;

  const modifications = await invalidRuleSignal(
    source,
    JOI_TO_ZOD_LANGUAGE,
    ast => {
      return joiReferenceToZod(makeJoiToZodInitialModification(ast));
    },
    2,
  );
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(5);
  expect(updatedSource.split('\n').slice(2)).not.contain('Joi');
});
