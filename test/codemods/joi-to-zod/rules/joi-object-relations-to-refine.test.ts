import { test, expect } from '@rstest/core';

import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiObjectRelationsToRefine from '../../../../src/codemods/joi-to-zod/rules/joi-object-relations-to-refine';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

function sourceFor(relation: string): string {
  return `
import Joi from 'joi';

export const schema = Joi.object().keys({
  a: Joi.string(),
  b: Joi.string(),
}).${relation};
`;
}

async function transform(relation: string): Promise<string> {
  const modifications = await invalidRuleSignal(sourceFor(relation), JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectRelationsToRefine(makeJoiToZodInitialModification(ast));
  });

  return modifications.ast.root().text();
}

test('converts or to a some refinement', async () => {
  const updatedSource = await transform("or('a', 'b')");

  expect(updatedSource).contain(".refine(value => [value['a'], value['b']].some(field => field !== undefined))");
  expect(updatedSource).not.contain('.or(');
});

test('converts xor to an exactly-one refinement', async () => {
  const updatedSource = await transform("xor('a', 'b')");

  expect(updatedSource).contain('.length === 1');
  expect(updatedSource).not.contain('.xor(');
});

test('converts oxor to an at-most-one refinement', async () => {
  const updatedSource = await transform("oxor('a', 'b')");

  expect(updatedSource).contain('.length <= 1');
  expect(updatedSource).not.contain('.oxor(');
});

test('converts and to an all-or-none refinement', async () => {
  const updatedSource = await transform("and('a', 'b')");

  expect(updatedSource).contain('.every(field => field !== undefined) || ');
  expect(updatedSource).not.contain('.and(');
});

test('converts nand to a not-all refinement', async () => {
  const updatedSource = await transform("nand('a', 'b')");

  expect(updatedSource).contain("![value['a'], value['b']].every(field => field !== undefined)");
  expect(updatedSource).not.contain('.nand(');
});

test('converts with to a dependency refinement', async () => {
  const updatedSource = await transform("with('a', ['b'])");

  expect(updatedSource).contain("value['a'] === undefined || [value['b']].every(field => field !== undefined)");
  expect(updatedSource).not.contain('.with(');
});

test('converts without to an exclusion refinement', async () => {
  const updatedSource = await transform("without('a', ['b'])");

  expect(updatedSource).contain("value['a'] === undefined || [value['b']].every(field => field === undefined)");
  expect(updatedSource).not.contain('.without(');
});

test('converts every relation on one chain', async () => {
  const updatedSource = await transform("or('a', 'b').nand('a', 'b')");

  expect(updatedSource).not.contain('.or(');
  expect(updatedSource).not.contain('.nand(');
  expect(updatedSource.match(/\.refine\(/g)).toHaveLength(2);
});

test('leaves objects without relations untouched', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.object().keys({ a: Joi.string() });
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectRelationsToRefine(makeJoiToZodInitialModification(ast));
  });
});

test('leaves a string pattern call untouched', async () => {
  const source = `
import Joi from 'joi';

export const schema = Joi.string().pattern(/^a/);
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiObjectRelationsToRefine(makeJoiToZodInitialModification(ast));
  });
});
