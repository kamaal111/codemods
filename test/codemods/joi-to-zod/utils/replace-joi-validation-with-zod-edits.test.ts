import { Lang, parseAsync } from '@ast-grep/napi';

import replaceJoiValidationWithZodEdits from '../../../../src/codemods/joi-to-zod/utils/replace-joi-validation-with-zod-edits';

test('replaces Joi required with optional edits', async () => {
  const source = `
import Joi from 'joi';

export const employee = Joi.object().keys({
    name: Joi.string().regex(/^[a-z0-9]+$/).min(3).max(30).required()
})
`;
  const ast = await parseAsync(Lang.TypeScript, source);
  const root = ast.root();
  const edits = replaceJoiValidationWithZodEdits(root, {
    primitive: '*',
    validationTargetKey: 'required()',
    zodValidation: 'optional()',
  });

  const updatedSource = root.commitEdits(edits);

  expect(edits.length).toBe(1);
  expect(updatedSource).not.toContain('required');
  expect(updatedSource).toContain('optional');
  expect(updatedSource).toMatchSnapshot();
});

test('substitutes each named meta argument into its corresponding Zod validation', async () => {
  const ast = await parseAsync(Lang.TypeScript, "import Joi from 'joi';\nconst schema = Joi.string().between(2, 5);");
  const root = ast.root();
  const edits = replaceJoiValidationWithZodEdits(root, {
    primitive: 'string',
    validationTargetKey: 'between($MIN, $MAX)',
    zodValidation: 'min($MIN).max($MAX)',
  });

  expect(root.commitEdits(edits)).toContain('Joi.string().min(2).max(5)');
});

test('does not rewrite a validation with different literal arguments', async () => {
  const ast = await parseAsync(Lang.TypeScript, "import Joi from 'joi';\nconst schema = Joi.string().min(3);");
  const root = ast.root();
  const edits = replaceJoiValidationWithZodEdits(root, {
    primitive: 'string',
    validationTargetKey: 'min(5)',
    zodValidation: 'min(5)',
  });

  expect(edits).toEqual([]);
  expect(root.text()).toContain('Joi.string().min(3)');
});
