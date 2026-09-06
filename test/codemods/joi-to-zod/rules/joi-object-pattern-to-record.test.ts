import { parseAsync } from '@ast-grep/napi';

import {
  JOI_TO_ZOD_LANGUAGE,
  makeJoiToZodInitialModification,
  joiToZodModifications,
} from '../../../../src/codemods/joi-to-zod';
import joiObjectPatternToRecord from '../../../../src/codemods/joi-to-zod/rules/joi-object-pattern-to-record';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi object pattern to Zod record', async () => {
  const source = `
import Joi from 'joi';

export const config = Joi.object().pattern(Joi.string(), Joi.number());
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectPatternToRecord(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.toContain('object().pattern');
  expect(updatedSource).toContain('Joi.record(Joi.string(), Joi.number())');
});

test('Joi object multiline pattern to Zod record', async () => {
  const source = `
import Joi from 'joi';

export const config = Joi
  .object()
  .pattern(Joi.string(), Joi.number());
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectPatternToRecord(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.toContain('object()');
  expect(updatedSource).toContain('Joi.record(Joi.string(), Joi.number())');
});

test('Joi object pattern with regex key rewrites key to Joi.string().regex()', async () => {
  const source = `
import Joi from 'joi';

export const config = Joi.object().pattern(/^key/, Joi.string());
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectPatternToRecord(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.toContain('object().pattern');
  expect(updatedSource).toContain('Joi.record(Joi.string().regex(/^key/), Joi.string())');
});

test('Joi object pattern with regex key with flags rewrites key to Joi.string().regex()', async () => {
  const source = `
import Joi from 'joi';

export const config = Joi.object().pattern(/^key/gi, Joi.string());
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectPatternToRecord(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.toContain('object().pattern');
  expect(updatedSource).toContain('Joi.record(Joi.string().regex(/^key/gi), Joi.string())');
});

test('Joi object pattern with regex key with escaped slash rewrites key to Joi.string().regex()', async () => {
  const source = String.raw`
import Joi from 'joi';

export const config = Joi.object().pattern(/^key\/value/, Joi.string());
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectPatternToRecord(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.toContain('object().pattern');
  expect(updatedSource).toContain(String.raw`Joi.record(Joi.string().regex(/^key\/value/), Joi.string())`);
});

test('Joi object pattern with regex key produces valid Zod via full pipeline', async () => {
  const source = `
import Joi from 'joi';

export const config = Joi.object().pattern(/^key/, Joi.string());
`;

  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, source);
  const modifications = await joiToZodModifications(makeJoiToZodInitialModification(ast));
  const updatedSource = modifications.ast.root().text();

  expect(source.trim()).not.toEqual(updatedSource.trim());
  expect(updatedSource).toContain('z.record(z.string().regex(/^key/), z.string())');
});

test('Joi object without pattern is unchanged', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object({ name: Joi.string() });
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectPatternToRecord(makeJoiToZodInitialModification(ast));
  });
});
