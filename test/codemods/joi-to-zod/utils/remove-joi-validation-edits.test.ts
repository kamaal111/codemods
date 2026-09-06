import { Lang, parseAsync } from '@ast-grep/napi';

import removeJoiValidationEdits from '../../../../src/codemods/joi-to-zod/utils/remove-joi-validation-edits';

test('removes Joi required in multilevel validations edits', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
    name: Joi.string().regex(/^[a-z0-9]+$/).min(3).max(30).required()
})
`;
  const ast = await parseAsync(Lang.TypeScript, source);
  const root = ast.root();
  const edits = removeJoiValidationEdits(root, { primitive: '*', validationTargetKey: 'required()' });

  const updatedSource = root.commitEdits(edits);

  expect(edits.length).toBe(1);
  expect(updatedSource).not.toContain('required');
  expect(updatedSource).toMatchSnapshot();
});

test('removes Joi required in single level validations edits', async () => {
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
  const ast = await parseAsync(Lang.TypeScript, source);
  const root = ast.root();
  const edits = removeJoiValidationEdits(root, { primitive: '*', validationTargetKey: 'required()' });

  const updatedSource = root.commitEdits(edits);

  expect(edits.length).toBe(1);
  expect(updatedSource).not.toContain('required');
  expect(updatedSource).toMatchSnapshot();
});

test('removes Joi required in unchained validations edits', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
  nickname: Joi.string().required(),
});
`;
  const ast = await parseAsync(Lang.TypeScript, source);
  const root = ast.root();
  const edits = removeJoiValidationEdits(root, { primitive: 'string', validationTargetKey: 'required()' });

  const updatedSource = root.commitEdits(edits);

  expect(edits.length).toBe(1);
  expect(updatedSource).not.toContain('required');
  expect(updatedSource).toMatchSnapshot();
});
