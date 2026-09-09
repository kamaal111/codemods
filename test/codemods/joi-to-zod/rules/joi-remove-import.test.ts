import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiRemoveImport from '../../../../src/codemods/joi-to-zod/rules/joi-remove-import';
import { invalidRuleSignal } from '../../../test-utils/detection-theory';

test('Joi remove import', async () => {
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
    return joiRemoveImport(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(modifications.report.changesApplied).toBe(1);
  expect(updatedSource).not.contain("'joi'");
});

test.each([
  ["import Joi, { ValidationError } from 'joi';", "import { ValidationError } from 'joi';"],
  ['import { default as Joi, ValidationError } from "joi";', 'import { ValidationError } from "joi";'],
  [
    "import { ValidationError as JoiError, default as Joi } from 'joi';",
    "import { ValidationError as JoiError } from 'joi';",
  ],
])('retains named imports for %s', async (joiImport, expectedImport) => {
  const source = `${joiImport}\n\nexport const value = 1;`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveImport(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.report.changesApplied).toBe(1);
  expect(modifications.ast.root().text()).toContain(expectedImport);
});

test.each([
  [
    'a default import followed by named imports',
    `import Joi, {
  ValidationError,
  ValidationResult,
} from 'joi';`,
  ],
  [
    'a default-as import before named imports',
    `import {
  default as Joi,
  ValidationError,
  ValidationResult,
} from 'joi';`,
  ],
  [
    'a default-as import after named imports',
    `import {
  ValidationError,
  ValidationResult,
  default as Joi,
} from 'joi';`,
  ],
])('retains multiline named imports for %s', async (_name, joiImport) => {
  const source = `${joiImport}\n\nexport const value = 1;`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveImport(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.report.changesApplied).toBe(1);
  expect(modifications.ast.root().text()).toContain("import { ValidationError, ValidationResult } from 'joi';");
});

test('removes a multiline default-only import', async () => {
  const source = `import Joi
  from 'joi';
const value = 1;`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveImport(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).not.toContain("from 'joi'");
  expect(modifications.ast.root().text()).toContain('const value = 1;');
});

test('preserves code following a default import on the same line', async () => {
  const source = "import Joi from 'joi'; const value = 1;";
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveImport(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toBe('const value = 1;');
});

test('preserves a trailing comment attached to the import line', async () => {
  const source = "import Joi from 'joi'; // migration context\nconst value = 1;";
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiRemoveImport(makeJoiToZodInitialModification(ast));
  });

  expect(modifications.ast.root().text()).toContain('// migration context');
  expect(modifications.ast.root().text()).toContain('const value = 1;');
});
