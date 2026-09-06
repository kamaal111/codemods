import { parseAsync } from '@ast-grep/napi';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod/index';
import joiValidationsToZodValidations from '../../../../src/codemods/joi-to-zod/rules/joi-validations-to-zod-validations';
import { invalidRuleSignal } from '../../../test-utils/detection-theory';

test('Joi alphanum to Zod regex', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('alphanum');
  expect(updatedSource).contain('regex(/^[a-zA-Z0-9]+$/)');
});

test('Joi integer to Zod int', async () => {
  const source = `
import Joi from 'joi';

import { MAX_YEAR } from './other-source';

const MINIMUM_YEAR = 1970;

export const employee = Joi.object().keys({
  birthyear: Joi.number().integer().min(MINIMUM_YEAR).max(MAX_YEAR),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('integer');
  expect(updatedSource).contain('int()');
});

test('Joi description to Zod describe', async () => {
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
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(modifications.history.length).toBe(2);
  expect(updatedSource).not.contain('description');
  expect(updatedSource).contain("describe('Nickname')");
});

test('Joi allow null to Zod nullable', async () => {
  const source = `
import Joi from 'joi';

const url = Joi.string().allow(null);
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('allow');
  expect(updatedSource).contain('nullable()');
});

test('Joi not required to Zod optional', async () => {
  const source = `
import Joi from 'joi';

const url = Joi.string().required(false);
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('required');
  expect(updatedSource).contain('optional()');
});

test('Joi unknown to Zod passthrough', async () => {
  const source = `
import Joi from 'joi';

const url = Joi.string().required(false).unknown(true);
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(2);
  expect(updatedSource).not.contain('unknown');
  expect(updatedSource).contain('passthrough()');
});

test('Joi no unknowns to Zod strict', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().uri(),
}).allow(null).unknown(false);
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(2);
  expect(updatedSource).not.contain('unknown');
  expect(updatedSource).contain('strict()');
});

test('Joi precision to Zod rounding transform', async () => {
  const source = `
import Joi from 'joi';

import { MAX_YEAR } from './other-source';

const MINIMUM_YEAR = 1970;

export const employee = Joi.object().keys({
  birthyear: Joi.number().integer().min(MINIMUM_YEAR).max(MAX_YEAR).precision(3),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(2);
  expect(updatedSource).not.contain('precision');
  expect(updatedSource, updatedSource).contain('transform(value => Number(value.toFixed(3)))');
});

test('Joi lowercase to Zod toLowerCase', async () => {
  const source = `
import Joi from 'joi';

const username = Joi.string().lowercase();
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('lowercase');
  expect(updatedSource).contain('toLowerCase()');
});

test('Joi uppercase to Zod toUpperCase', async () => {
  const source = `
import Joi from 'joi';

const code = Joi.string().uppercase();
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('uppercase');
  expect(updatedSource).contain('toUpperCase()');
});

test('Joi token to Zod regex', async () => {
  const source = `
import Joi from 'joi';

const apiKey = Joi.string().token();
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('token');
  expect(updatedSource).contain('regex(/^\\w+$/)');
});

test('Joi pattern to Zod regex', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  name: Joi.string().pattern(/^[a-z]+$/),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('pattern');
  expect(updatedSource).contain('regex(/^[a-z]+$/)');
});

test('Joi multiple to Zod multipleOf', async () => {
  const source = `
import Joi from 'joi';

const quantity = Joi.number().multiple(5);
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('multiple(5)');
  expect(updatedSource).contain('multipleOf(5)');
});

test('Joi bool to Zod boolean', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  isActive: Joi.bool(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('bool()');
  expect(updatedSource).contain('boolean()');
});

test('Joi case lower to Zod toLowerCase', async () => {
  const source = `
import Joi from 'joi';

const username = Joi.string().case('lower');
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain("case('lower')");
  expect(updatedSource).contain('toLowerCase()');
});

test('Joi case upper to Zod toUpperCase', async () => {
  const source = `
import Joi from 'joi';

const code = Joi.string().case('upper');
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain("case('upper')");
  expect(updatedSource).contain('toUpperCase()');
});

test('Joi failover to Zod catch', async () => {
  const source = `
import Joi from 'joi';

const field = Joi.string().failover('default');
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('failover');
  expect(updatedSource).contain("catch('default')");
});

test('Joi func to Zod function', async () => {
  const source = `
import Joi from 'joi';

const fn = Joi.func();
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain('func()');
  expect(updatedSource).contain('function()');
});

test('Joi validations convert every overlapping schema chain', async () => {
  const ast = await parseAsync(
    JOI_TO_ZOD_LANGUAGE,
    "import Joi from 'joi';\n\nconst schema = Joi.object({ nested: Joi.string().description('Nested') }).description('Schema');",
  );

  const modifications = await joiValidationsToZodValidations(makeJoiToZodInitialModification(ast));
  const output = modifications.ast.root().text();

  expect(output).toBe(
    "import Joi from 'joi';\n\nconst schema = Joi.object({ nested: Joi.string().describe('Nested') }).describe('Schema');",
  );
});
