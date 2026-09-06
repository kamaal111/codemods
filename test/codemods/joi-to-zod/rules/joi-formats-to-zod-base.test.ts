import joiToZod, { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiFormatsToZodBase from '../../../../src/codemods/joi-to-zod/rules/joi-formats-to-zod-base';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

const FORMATS: Array<{ joi: string; zod: string }> = [
  { joi: 'guid()', zod: 'Joi.uuid()' },
  { joi: 'uuid()', zod: 'Joi.uuid()' },
  { joi: 'uri()', zod: 'Joi.url()' },
  { joi: 'url()', zod: 'Joi.url()' },
  { joi: 'email()', zod: 'Joi.email()' },
  { joi: 'domain()', zod: 'Joi.hostname()' },
  { joi: 'hostname()', zod: 'Joi.hostname()' },
  { joi: 'hex()', zod: 'Joi.hex()' },
  { joi: 'base64()', zod: 'Joi.base64()' },
  { joi: 'isoDate()', zod: 'Joi.iso.datetime()' },
  { joi: 'datetime()', zod: 'Joi.iso.datetime()' },
  { joi: 'isoDuration()', zod: 'Joi.iso.duration()' },
];

FORMATS.forEach(({ joi, zod }) => {
  test(`hoists Joi.string().${joi} to ${zod}`, async () => {
    const source = `
import Joi from 'joi';

const schema = Joi.string().${joi};
`;

    const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
      return joiFormatsToZodBase(makeJoiToZodInitialModification(ast));
    });
    const updatedSource = modifications.ast.root().text();

    expect(updatedSource).contain(zod);
    expect(updatedSource).not.contain('Joi.string()');
  });
});

test('hoists the format even when it is not adjacent to the primitive', async () => {
  const source = `
import Joi from 'joi';

const schema = Joi.string().min(3).max(64).hex();
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiFormatsToZodBase(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(updatedSource).contain('Joi.hex().min(3).max(64)');
  expect(updatedSource).not.contain('.hex().hex()');
});

test('hoists each nested schema format independently', async () => {
  const source = `
import Joi from 'joi';

const schema = Joi.object().keys({
  id: Joi.string().guid(),
  colour: Joi.string().min(6).hex(),
  contact: Joi.string().email(),
});
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiFormatsToZodBase(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(updatedSource).contain('id: Joi.uuid()');
  expect(updatedSource).contain('colour: Joi.hex().min(6)');
  expect(updatedSource).contain('contact: Joi.email()');
});

test('leaves chains without a hoistable format untouched', async () => {
  const source = `
import Joi from 'joi';

const schema = Joi.string().min(3).max(64);
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiFormatsToZodBase(makeJoiToZodInitialModification(ast));
  });
});

test('emits a mid-chain format as valid Zod through the full pipeline', async () => {
  const source = `import Joi from 'joi';

export const schema = Joi.object().keys({
  colour: Joi.string().min(6).hex().required(),
});
`;

  const output = await joiToZod(source);

  expect(output).contain('z.hex()');
  expect(output).not.contain('z.string().hex()');
  expect(output).not.contain('Joi');
});
