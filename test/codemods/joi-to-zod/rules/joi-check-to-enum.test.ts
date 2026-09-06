import { parseAsync } from '@ast-grep/napi';
import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiCheckToEnum from '../../../../src/codemods/joi-to-zod/rules/joi-check-to-enum';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('Joi check to Zod enum', async () => {
  const source = `
import Joi from 'joi';

enum Job {
  Developer = 'developer',
  DevOps = 'devops',
  Designer = 'designer',
}

export const employee = Joi.object().keys({
  job: Joi.string().valid(...Object.values(Job)),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('check');
  expect(updatedSource, updatedSource).contain(
    'job: Joi.string().enum(Object.values(Job) as [string, ...Array<string>])',
  );
});

test('Joi check to Zod enum with required', async () => {
  const source = `
import Joi from 'joi';

enum Job {
  Developer = 'developer',
  DevOps = 'devops',
  Designer = 'designer',
}

export const employee = Joi.object().keys({
  job: Joi.string().valid(...Object.values(Job)).required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource, updatedSource).contain(
    'job: Joi.string().enum(Object.values(Job) as [string, ...Array<string>]).required()',
  );
});

test('Joi check to Zod enum with literal values', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  status: Joi.string().valid('active', 'inactive', 'pending'),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource, updatedSource).contain(
    "status: Joi.string().enum(['active', 'inactive', 'pending'] as [string, ...Array<string>])",
  );
});

test('Joi check to Zod enum with literal values and required', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  status: Joi.string().valid('active', 'inactive', 'pending').required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource, updatedSource).contain(
    "status: Joi.string().enum(['active', 'inactive', 'pending'] as [string, ...Array<string>]).required()",
  );
});

test('Joi check to Zod enum valid', async () => {
  const source = `
import Joi from 'joi';

enum Job {
  Developer = 'developer',
  DevOps = 'devops',
  Designer = 'designer',
}

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
});
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
});

test('Joi check to Zod enum with multiline literal values', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  status: Joi.string().valid(
    'active',
    'inactive',
    'pending',
  ).required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource, updatedSource).contain(
    "status: Joi.string().enum(['active', 'inactive', 'pending'] as [string, ...Array<string>]).required()",
  );
});

test('Joi check to Zod enum with whitespace in spread', async () => {
  const source = `
import Joi from 'joi';

enum Job {
  Developer = 'developer',
  DevOps = 'devops',
  Designer = 'designer',
}

export const employee = Joi.object().keys({
  job: Joi.string().valid(
    ...Object.values(Job),
  ).required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource, updatedSource).contain(
    'job: Joi.string().enum(Object.values(Job) as [string, ...Array<string>]).required()',
  );
});

test('Joi boolean valid becomes a Zod literal', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.boolean().valid(true);",
  );

  const modifications = await joiCheckToEnum(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.literal(true)');
});

test('Joi number valid with one literal becomes a Zod literal', async () => {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, "import Joi from 'joi';\n\nconst schema = Joi.number().valid(42);");

  const modifications = await joiCheckToEnum(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.literal(42)');
});

test('Joi number valid with multiple literals becomes a Zod union', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.number().valid(1, 2);",
  );

  const modifications = await joiCheckToEnum(makeJoiToZodInitialModification(ast));

  expect(modifications.ast.root().text()).toContain('Joi.union([Joi.literal(1), Joi.literal(2)])');
});

test('does not convert a lookalike validation chain', async () => {
  const source = `
import Joi from 'joi';

const Other = { string: () => ({ valid: () => ({}) }) };
const schema = Other.string().valid('value');
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiCheckToEnum(makeJoiToZodInitialModification(ast));
  });
});

test('Joi check to Zod enum converts every overlapping schema chain', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.string().valid('active').custom(validateValue).valid('inactive');",
  );

  const modifications = await joiCheckToEnum(makeJoiToZodInitialModification(ast));
  const output = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(2);
  expect(output).toContain("Joi.string().enum(['active'] as [string, ...Array<string>])");
  expect(output).toContain("custom(validateValue).enum(['inactive'] as [string, ...Array<string>])");
});
