import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import zodAddImport from '../../../../src/codemods/joi-to-zod/rules/zod-add-import';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

test('adds the zod import after the joi import', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.string();
`;

  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return zodAddImport(makeJoiToZodInitialModification(ast));
  });
  const updatedSource = modifications.ast.root().text();

  expect(updatedSource).contain('zod');
  expect(updatedSource.indexOf('joi')).toBeLessThan(updatedSource.indexOf('zod'));
});

test('does not add a second zod import when one is present', async () => {
  const source = `
import Joi from 'joi';
import { z } from 'zod';

export const schema = Joi.string();
`;

  const modifications = await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return zodAddImport(makeJoiToZodInitialModification(ast));
  });

  expect(
    modifications.ast
      .root()
      .text()
      .match(/from 'zod'|from "zod"/g),
  ).toHaveLength(1);
});

test('does nothing without a joi import', async () => {
  const source = `
export const value = 1;
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return zodAddImport(makeJoiToZodInitialModification(ast));
  });
});
