import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiObjectBaseToZodObject from '../../../../src/codemods/joi-to-zod/rules/joi-object-base-to-zod-object';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('converts direct and unconstrained Joi object bases', async () => {
  const source = `
import Joi from 'joi';

export const direct = Joi.object({ id: Joi.string() });
export const unconstrained = Joi.object();
`;

  const modifications = await invalidRuleSignal(
    source,
    JOI_TO_ZOD_LANGUAGE,
    ast => joiObjectBaseToZodObject(makeJoiToZodInitialModification(ast)),
    2,
  );
  const updatedSource = modifications.ast.root().text();

  expect(updatedSource).toContain('Joi.object({ id: Joi.string() }).strict()');
  expect(updatedSource).toContain('Joi.looseObject({})');
});

test('converts an append on an empty object to a strict shaped object', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.object().extend({ id: Joi.string() });
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectBaseToZodObject(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('Joi.object({ id: Joi.string() }).strict()');
});

test('leaves an already strict Joi object base unchanged', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.object({ id: Joi.string() }).strict();
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectBaseToZodObject(makeJoiToZodInitialModification(ast));
  });
});

test('converts nested unconstrained objects before their containing object', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.object({ metadata: Joi.object() });
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectBaseToZodObject(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('Joi.object({ metadata: Joi.looseObject({}) }).strict()');
});

test('converts a comment-separated object call', async () => {
  const source = `import Joi from 'joi';
const schema = Joi /* root */ .object /* args */ ({ id: Joi.string() });`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectBaseToZodObject(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain(
    'Joi /* root */ .object /* args */ ({ id: Joi.string() }).strict()',
  );
});
