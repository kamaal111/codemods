import { Lang, parseAsync, type SgNode, type SgRoot } from '@ast-grep/napi';
import type { Kinds, TypesMap } from '@ast-grep/napi/types/staticTypes.js';

import joiAddManualMigrationTodo from './rules/joi-add-manual-migration-todo.ts';
import joiAddOptional from './rules/joi-add-optional.ts';
import joiAlternativesToUnion from './rules/joi-alternatives-to-union.ts';
import joiArrayItemsUnnest from './rules/joi-array-items-unnest.ts';
import joiAssertToRefine from './rules/joi-assert-to-refine.ts';
import joiBinaryToInstanceof from './rules/joi-binary-to-instanceof.ts';
import joiCheckToEnum from './rules/joi-check-to-enum.ts';
import joiConcatToIntersection from './rules/joi-concat-to-intersection.ts';
import joiCustomToTransform from './rules/joi-custom-to-transform.ts';
import joiDateToCoerceDate from './rules/joi-date-to-coerce-date.ts';
import joiForbiddenToNever from './rules/joi-forbidden-to-never.ts';
import joiFormatsToZodBase from './rules/joi-formats-to-zod-base.ts';
import joiObjectBaseToZodObject from './rules/joi-object-base-to-zod-object.ts';
import joiObjectKeysUnnest from './rules/joi-object-keys-unnest.ts';
import joiObjectPatternToRecord from './rules/joi-object-pattern-to-record.ts';
import joiObjectRelationsToRefine from './rules/joi-object-relations-to-refine.ts';
import joiReferenceToZod from './rules/joi-reference-to-zod.ts';
import joiRemoveImport from './rules/joi-remove-import.ts';
import joiRemoveOptionsFromRegex from './rules/joi-remove-options-from-regex.ts';
import joiRemovePrimitiveForEnum from './rules/joi-remove-primitive-for-enum.ts';
import joiRemoveRequired from './rules/joi-remove-required.ts';
import joiSchemaTypesToZodTypes from './rules/joi-schema-types-to-zod-types.ts';
import joiValidationsToZodValidations from './rules/joi-validations-to-zod-validations.ts';
import joiWhenToRefine from './rules/joi-when-to-refine.ts';
import zodAddImport from './rules/zod-add-import.ts';
import hasJoiImport from './utils/has-joi-import.ts';
import type { Codemod, Modifications } from '../../kit/types.ts';

export const JOI_TO_ZOD_LANGUAGE = Lang.TypeScript;

function joiToZodFilter(root: SgNode<TypesMap, Kinds<TypesMap>>): boolean {
  return hasJoiImport(root);
}

export async function joiToZodModifications(modifications: Modifications): Promise<Modifications> {
  const root = modifications.ast.root();
  if (!joiToZodFilter(root)) {
    return modifications;
  }

  return zodAddImport(modifications)
    .then(joiRemoveOptionsFromRegex)
    .then(joiObjectPatternToRecord)
    .then(joiWhenToRefine)
    .then(joiAssertToRefine)
    .then(joiCustomToTransform)
    .then(joiBinaryToInstanceof)
    .then(joiConcatToIntersection)
    .then(joiForbiddenToNever)
    .then(joiFormatsToZodBase)
    .then(joiDateToCoerceDate)
    .then(joiObjectRelationsToRefine)
    .then(joiValidationsToZodValidations)
    .then(joiCheckToEnum)
    .then(joiRemovePrimitiveForEnum)
    .then(joiObjectKeysUnnest)
    .then(joiObjectBaseToZodObject)
    .then(joiArrayItemsUnnest)
    .then(joiAlternativesToUnion)
    .then(joiAddOptional)
    .then(joiRemoveRequired)
    .then(joiAddManualMigrationTodo)
    .then(joiSchemaTypesToZodTypes)
    .then(joiReferenceToZod)
    .then(joiRemoveImport);
}

export function makeJoiToZodInitialModification(ast: SgRoot<TypesMap>, filename?: string): Modifications {
  return {
    lang: JOI_TO_ZOD_LANGUAGE,
    report: { changesApplied: 0 },
    ast,
    filename,
    history: [ast],
  };
}

async function joiToZod(content: string, filename?: string): Promise<string> {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, content);

  return joiToZodModifications(makeJoiToZodInitialModification(ast, filename)).then(modifications => {
    return modifications.ast.root().text();
  });
}

export async function joiToZodTransformer(content: string, filename?: string): Promise<Modifications> {
  const ast = await parseAsync(JOI_TO_ZOD_LANGUAGE, content);

  return joiToZodModifications(makeJoiToZodInitialModification(ast, filename));
}

export const JOI_TO_ZOD_CODEMOD: Codemod = {
  name: 'joi-to-zod-transformer',
  languages: [JOI_TO_ZOD_LANGUAGE],
  transformer: joiToZod,
};

export default joiToZod;
