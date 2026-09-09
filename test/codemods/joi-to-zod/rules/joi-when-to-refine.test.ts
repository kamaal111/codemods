import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiWhenToRefine from '../../../../src/codemods/joi-to-zod/rules/joi-when-to-refine';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

async function transform(body: string): Promise<string> {
  const source = `
import Joi from 'joi';

export const schema = ${body};
`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiWhenToRefine(makeJoiToZodInitialModification(ast));
  });

  return modifications.ast.root().text();
}

async function expectUntouched(body: string): Promise<void> {
  const source = `
import Joi from 'joi';

export const schema = ${body};
`;
  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiWhenToRefine(makeJoiToZodInitialModification(ast));
  });
}

function conditional(branches: string): string {
  return `Joi.object().keys({
  type: Joi.string(),
  detail: Joi.string().when('type', { is: 'a', ${branches} }),
})`;
}

test('converts a required branch into a presence refinement', async () => {
  const updatedSource = await transform(conditional('then: Joi.required()'));

  expect(updatedSource).contain("!(value['type'] === 'a') || value['detail'] !== undefined");
  expect(updatedSource).contain("path: ['detail']");
  expect(updatedSource).not.contain('.when(');
});

test('converts a forbidden branch into an absence refinement', async () => {
  const updatedSource = await transform(conditional('then: Joi.forbidden()'));

  expect(updatedSource).contain("value['detail'] === undefined");
});

test('emits no refinement for an optional branch', async () => {
  const updatedSource = await transform(conditional('then: Joi.optional()'));

  expect(updatedSource).not.contain('.refine(');
  expect(updatedSource).not.contain('.when(');
});

test('converts both branches when otherwise is present', async () => {
  const updatedSource = await transform(conditional('then: Joi.required(), otherwise: Joi.forbidden()'));

  expect(updatedSource.match(/\.refine\(/g)).toHaveLength(2);
  expect(updatedSource).contain("!(value['type'] === 'a') || value['detail'] !== undefined");
  expect(updatedSource).contain("(value['type'] === 'a') || value['detail'] === undefined");
});

test('converts an otherwise-only conditional', async () => {
  const updatedSource = await transform(conditional('otherwise: Joi.required()'));

  expect(updatedSource.match(/\.refine\(/g)).toHaveLength(1);
  expect(updatedSource).contain("(value['type'] === 'a') || value['detail'] !== undefined");
});

test('parses against a full-schema branch', async () => {
  const updatedSource = await transform(conditional('then: Joi.string().min(5)'));

  expect(updatedSource).contain(
    "value['detail'] === undefined || Joi.string().min(5).safeParse(value['detail']).success",
  );
});

test('requires presence for a full-schema branch marked required', async () => {
  const updatedSource = await transform(conditional('then: Joi.string().min(5).required()'));

  expect(updatedSource).contain(
    "value['detail'] !== undefined && Joi.string().min(5).safeParse(value['detail']).success",
  );
  expect(updatedSource).not.contain('.required()');
});

test('compares against a referenced key', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  a: Joi.string(),
  b: Joi.string(),
  c: Joi.string().when('a', { is: Joi.ref('b'), then: Joi.required() }),
})`);

  expect(updatedSource).contain("value['a'] === value['b']");
});

test('treats a bare schema condition as matching an absent reference', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  seats: Joi.number(),
  billing: Joi.string().when('seats', { is: Joi.number().min(2), then: Joi.required() }),
})`);

  expect(updatedSource).contain(
    "(value['seats'] === undefined || Joi.number().min(2).safeParse(value['seats']).success)",
  );
});

test('demands a value for a schema condition marked required', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  seats: Joi.number(),
  billing: Joi.string().when('seats', { is: Joi.number().min(2).required(), then: Joi.required() }),
})`);

  expect(updatedSource).contain(
    "(value['seats'] !== undefined && Joi.number().min(2).safeParse(value['seats']).success)",
  );
});

test('keeps the validations the property already had', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  t: Joi.string(),
  v: Joi.string().min(3).when('t', { is: 'a', then: Joi.required() }),
})`);

  expect(updatedSource).contain('v: Joi.string().min(3)');
  expect(updatedSource).not.contain('.when(');
});

test('converts two conditionals on one object without losing either', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  t: Joi.string(),
  a: Joi.string().when('t', { is: 'x', then: Joi.required() }),
  b: Joi.string().when('t', { is: 'y', then: Joi.required() }),
})`);

  expect(updatedSource.match(/\.refine\(/g)).toHaveLength(2);
  expect(updatedSource).contain("path: ['a']");
  expect(updatedSource).contain("path: ['b']");
  expect(updatedSource).not.contain('.when(');
});

test('attaches the refinement to the object owning the conditional', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  outer: Joi.string(),
  inner: Joi.object().keys({
    t: Joi.string(),
    d: Joi.string().when('t', { is: 'a', then: Joi.required() }),
  }),
})`);

  expect(updatedSource).contain('d: Joi.string(),\n  }).refine(');
});

test('reads a dotted reference as an optional access chain', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  meta: Joi.object().keys({ kind: Joi.string() }),
  code: Joi.string().when('meta.kind', { is: 'x', then: Joi.required() }),
})`);

  expect(updatedSource).contain("value['meta']?.['kind'] === 'x'");
});

test('stacks onto an object that already has a peer rule', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  t: Joi.string(),
  a: Joi.string(),
  b: Joi.string(),
  d: Joi.string().when('t', { is: 'z', then: Joi.required() }),
}).xor('a', 'b')`);

  expect(updatedSource).contain(".xor('a', 'b')");
  expect(updatedSource).contain('.refine(');
});

test('leaves a switch conditional for the manual-migration fallback', async () => {
  await expectUntouched(`Joi.object().keys({
  t: Joi.string(),
  d: Joi.string().when('t', { switch: [{ is: 'a', then: Joi.required() }] }),
})`);
});

test('leaves a not condition for the manual-migration fallback', async () => {
  await expectUntouched(`Joi.object().keys({
  t: Joi.string(),
  d: Joi.string().when('t', { not: 'a', then: Joi.required() }),
})`);
});

test('leaves a conditional that is not an object property', async () => {
  await expectUntouched("Joi.string().when('t', { is: 'a', then: Joi.required() })");
});

test('leaves objects without a conditional untouched', async () => {
  await expectUntouched('Joi.object().keys({ a: Joi.string() })');
});

test('leaves a conditional whose reference is not a plain path', async () => {
  await expectUntouched(`Joi.object().keys({
  t: Joi.string(),
  d: Joi.string().when(someComputedRef, { is: 'a', then: Joi.required() }),
})`);
});

test('leaves a conditional whose condition is not a literal, ref, or schema', async () => {
  await expectUntouched(`Joi.object().keys({
  t: Joi.string(),
  d: Joi.string().when('t', { is: someValue, then: Joi.required() }),
})`);
});

test('leaves a conditional whose branch is not a schema', async () => {
  await expectUntouched(`Joi.object().keys({
  t: Joi.string(),
  d: Joi.string().when('t', { is: 'a', then: someSchema }),
})`);
});

test('leaves a conditional with no branches at all', async () => {
  await expectUntouched(`Joi.object().keys({
  t: Joi.string(),
  d: Joi.string().when('t', { is: 'a' }),
})`);
});

test('treats a boolean condition as a literal comparison', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  flag: Joi.boolean(),
  d: Joi.string().when('flag', { is: true, then: Joi.required() }),
})`);

  expect(updatedSource).contain("value['flag'] === true");
});

test('treats a numeric condition as a literal comparison', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  count: Joi.number(),
  d: Joi.string().when('count', { is: 3, then: Joi.required() }),
})`);

  expect(updatedSource).contain("value['count'] === 3");
});

test('converts a when call separated from its arguments by a comment', async () => {
  const updatedSource = await transform(`Joi.object().keys({
  type: Joi.string(),
  detail: Joi.string().when /* options */ ('type', { is: 'a', then: Joi.required() }),
})`);

  expect(updatedSource).not.contain('.when');
  expect(updatedSource).contain("value['detail'] !== undefined");
});

test('does not treat a similarly prefixed receiver as the imported Joi binding', async () => {
  await expectUntouched(`JoiHelpers.object().keys({
  type: JoiHelpers.string(),
  detail: JoiHelpers.string().when('type', { is: 'a', then: JoiHelpers.required() }),
})`);
});
