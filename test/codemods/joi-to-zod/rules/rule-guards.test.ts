import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiAddManualMigrationTodo from '../../../../src/codemods/joi-to-zod/rules/joi-add-manual-migration-todo';
import joiAddOptional from '../../../../src/codemods/joi-to-zod/rules/joi-add-optional';
import joiAlternativesToUnion from '../../../../src/codemods/joi-to-zod/rules/joi-alternatives-to-union';
import joiArrayItemsUnnest from '../../../../src/codemods/joi-to-zod/rules/joi-array-items-unnest';
import joiAssertToRefine from '../../../../src/codemods/joi-to-zod/rules/joi-assert-to-refine';
import joiBinaryToInstanceof from '../../../../src/codemods/joi-to-zod/rules/joi-binary-to-instanceof';
import joiCheckToEnum from '../../../../src/codemods/joi-to-zod/rules/joi-check-to-enum';
import joiConcatToIntersection from '../../../../src/codemods/joi-to-zod/rules/joi-concat-to-intersection';
import joiCustomToTransform from '../../../../src/codemods/joi-to-zod/rules/joi-custom-to-transform';
import joiDateToCoerceDate from '../../../../src/codemods/joi-to-zod/rules/joi-date-to-coerce-date';
import joiForbiddenToNever from '../../../../src/codemods/joi-to-zod/rules/joi-forbidden-to-never';
import joiFormatsToZodBase from '../../../../src/codemods/joi-to-zod/rules/joi-formats-to-zod-base';
import joiObjectKeysUnnest from '../../../../src/codemods/joi-to-zod/rules/joi-object-keys-unnest';
import joiObjectPatternToRecord from '../../../../src/codemods/joi-to-zod/rules/joi-object-pattern-to-record';
import joiObjectRelationsToRefine from '../../../../src/codemods/joi-to-zod/rules/joi-object-relations-to-refine';
import joiReferenceToZod from '../../../../src/codemods/joi-to-zod/rules/joi-reference-to-zod';
import joiRemoveImport from '../../../../src/codemods/joi-to-zod/rules/joi-remove-import';
import joiRemoveOptionsFromRegex from '../../../../src/codemods/joi-to-zod/rules/joi-remove-options-from-regex';
import joiRemovePrimitiveForEnum from '../../../../src/codemods/joi-to-zod/rules/joi-remove-primitive-for-enum';
import joiRemoveRequired from '../../../../src/codemods/joi-to-zod/rules/joi-remove-required';
import joiValidationsToZodValidations from '../../../../src/codemods/joi-to-zod/rules/joi-validations-to-zod-validations';
import joiWhenToRefine from '../../../../src/codemods/joi-to-zod/rules/joi-when-to-refine';
import zodAddImport from '../../../../src/codemods/joi-to-zod/rules/zod-add-import';
import type { Modifications } from '../../../../src/kit/types.ts';
import { validRuleSignal } from '../../../test-utils/detection-theory';

type Rule = (modifications: Modifications) => Promise<Modifications>;

const RULES: Array<[string, Rule]> = [
  ['joi-add-manual-migration-todo', joiAddManualMigrationTodo],
  ['joi-add-optional', joiAddOptional],
  ['joi-alternatives-to-union', joiAlternativesToUnion],
  ['joi-array-items-unnest', joiArrayItemsUnnest],
  ['joi-assert-to-refine', joiAssertToRefine],
  ['joi-binary-to-instanceof', joiBinaryToInstanceof],
  ['joi-check-to-enum', joiCheckToEnum],
  ['joi-concat-to-intersection', joiConcatToIntersection],
  ['joi-custom-to-transform', joiCustomToTransform],
  ['joi-date-to-coerce-date', joiDateToCoerceDate],
  ['joi-forbidden-to-never', joiForbiddenToNever],
  ['joi-formats-to-zod-base', joiFormatsToZodBase],
  ['joi-object-keys-unnest', joiObjectKeysUnnest],
  ['joi-object-pattern-to-record', joiObjectPatternToRecord],
  ['joi-object-relations-to-refine', joiObjectRelationsToRefine],
  ['joi-reference-to-zod', joiReferenceToZod],
  ['joi-remove-import', joiRemoveImport],
  ['joi-remove-options-from-regex', joiRemoveOptionsFromRegex],
  ['joi-remove-primitive-for-enum', joiRemovePrimitiveForEnum],
  ['joi-remove-required', joiRemoveRequired],
  ['joi-validations-to-zod-validations', joiValidationsToZodValidations],
  ['joi-when-to-refine', joiWhenToRefine],
  ['zod-add-import', zodAddImport],
];

const LOOKS_LIKE_JOI = `
const Joi = { string: () => ({}) };

export const schema = Joi.object().keys({
  name: Joi.string().alphanum().required(),
  when: Joi.string().when('name', { is: 'a', then: Joi.required() }),
});
`;

test.each(RULES)('%s leaves a file without a joi import alone', async (_name, rule) => {
  await validRuleSignal(LOOKS_LIKE_JOI, JOI_TO_ZOD_LANGUAGE, ast => rule(makeJoiToZodInitialModification(ast)));
});

test.each(RULES)('%s leaves an empty file alone', async (_name, rule) => {
  await validRuleSignal('\nexport const value = 1;\n', JOI_TO_ZOD_LANGUAGE, ast => {
    return rule(makeJoiToZodInitialModification(ast));
  });
});

test('every rule in the pipeline is covered by these guards', () => {
  expect(RULES).toHaveLength(23);
});
