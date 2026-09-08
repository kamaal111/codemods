import joiToZod from '../../../src/codemods/joi-to-zod';

async function transform(body: string): Promise<string> {
  return joiToZod(`import Joi from 'joi';\n\n${body}\n`);
}

test('unnests array items declared after another array validation', async () => {
  const output = await transform('export const schema = Joi.array().min(1).items(Joi.string()).required();');

  expect(output).contain('z.array(z.string()).min(1)');
  expect(output).not.contain('.items(');
});

test('unions array items when several are allowed', async () => {
  const output = await transform('export const schema = Joi.array().items(Joi.string(), Joi.number()).required();');

  expect(output).contain('z.array(z.union([z.string(), z.number()]))');
  expect(output).not.contain('.items(');
});

test('unnests object keys declared after another object validation', async () => {
  const output = await transform(
    'export const schema = Joi.object().unknown(true).keys({ id: Joi.string().required() });',
  );

  expect(output).contain('z.object({ id: z.string() })');
  expect(output).not.contain('.keys(');
});

test('treats the object literal shorthand like an explicit keys call', async () => {
  const output = await transform('export const schema = Joi.object({ id: Joi.string().required() });');

  expect(output).contain('z.object({ id: z.string() }).strict()');
});

test('leaves a keyless object schema unconstrained', async () => {
  const output = await transform('export const schema = Joi.object().required();');

  expect(output).not.contain('.strict()');
});

test('does not make an unknown-tolerant object strict as well', async () => {
  const output = await transform(
    'export const schema = Joi.object().keys({ id: Joi.string().required() }).unknown(true);',
  );

  expect(output).contain('.passthrough()');
  expect(output).not.contain('.strict()');
});

test('leaves a defaulted key required rather than optional', async () => {
  const output = await transform("export const schema = Joi.object().keys({ role: Joi.string().default('user') });");

  expect(output).contain("role: z.string().default('user')");
  expect(output).not.contain("default('user').optional()");
});

test('rewrites joi schema type annotations to zod types', async () => {
  const output = await transform(`export const schema: Joi.ObjectSchema = Joi.object({ id: Joi.string().required() });
export function validate(candidate: Joi.Schema): Joi.AnySchema {
  return candidate;
}`);

  expect(output).contain('z.ZodType');
  expect(output).not.contain('z.ObjectSchema');
  expect(output).not.contain('z.Schema');
  expect(output).not.contain('z.AnySchema');
});

test('carries a joi schema type argument onto the zod type', async () => {
  const output = await transform(`interface User { id: string }

export const schema: Joi.ObjectSchema<User> = Joi.object({ id: Joi.string().required() });`);

  expect(output).contain('z.ZodType<User>');
});

test('converts object append into a zod extend', async () => {
  const output = await transform(
    'export const schema = Joi.object().keys({ id: Joi.string().required() }).append({ name: Joi.string().required() });',
  );

  expect(output).contain('.extend({ name: z.string() })');
  expect(output).not.contain('.append(');
});

test('converts a string replace into a transform', async () => {
  const output = await transform("export const schema = Joi.string().replace(/-/g, '').required();");

  expect(output).contain("z.string().transform(value => value.replace(/-/g, ''))");
});

test('converts ordered array items into a tuple', async () => {
  const output = await transform('export const schema = Joi.array().ordered(Joi.string(), Joi.number()).required();');

  expect(output).contain('z.tuple([z.string(), z.number()])');
  expect(output).not.contain('.ordered(');
});

const UNSUPPORTED_CASES: Array<[string, string, string]> = [
  ['insensitive', "export const schema = Joi.string().valid('a', 'b').insensitive();", 'insensitive()'],
  ['creditCard', 'export const schema = Joi.string().creditCard();', 'creditCard()'],
  ['truthy', "export const schema = Joi.boolean().truthy('yes');", 'truthy()'],
  ['falsy', "export const schema = Joi.boolean().falsy('no');", 'falsy()'],
  ['empty', "export const schema = Joi.string().empty('');", 'empty()'],
  ['strip', 'export const schema = Joi.string().strip();', 'strip()'],
  ['messages', "export const schema = Joi.string().messages({ 'string.base': 'nope' });", 'messages()'],
  ['link', "export const schema = Joi.link('#node');", 'link()'],
  ['array single', 'export const schema = Joi.array().single().items(Joi.string());', 'single()'],
  [
    'alternatives conditional',
    "export const schema = Joi.alternatives().conditional('kind', { is: 'a', then: Joi.string() });",
    'conditional()',
  ],
];

test.each(UNSUPPORTED_CASES)('flags %s for manual migration', async (_name, body, marker) => {
  const output = await transform(body);

  expect(output).contain('TODO(joi-to-zod)');
  expect(output).contain(marker);
});

test('migrates the legacy @hapi/joi package too', async () => {
  const output = await joiToZod(`import Joi from '@hapi/joi';\n\nexport const schema = Joi.string().required();\n`);

  expect(output).contain(`import { z } from "zod"`);
  expect(output).contain('export const schema = z.string();');
  expect(output).not.contain('@hapi/joi');
});

test('leaves an unrelated package that merely mentions joi alone', async () => {
  const source = `import Joi from 'joi-browser-fork';\n\nexport const schema = Joi.string().required();\n`;

  expect(await joiToZod(source)).toBe(source);
});

test('flags ordered items it cannot turn into a fixed-length tuple', async () => {
  const output = await transform('export const schema = Joi.array().min(2).ordered(Joi.string()).required();');

  expect(output).contain('TODO(joi-to-zod)');
  expect(output).contain('ordered()');
  expect(output).not.contain('z.tuple');
});

test('keeps every level of a nested keys schema strict', async () => {
  const output = await transform(
    'export const schema = Joi.object().keys({ a: Joi.object().keys({ b: Joi.string().required() }).required() });',
  );

  expect(output).contain('z.object({ a: z.object({ b: z.string() }).strict() }).strict()');
});

test('keeps every level of a nested object literal strict', async () => {
  const output = await transform('export const schema = Joi.object({ a: Joi.object({ b: Joi.string() }) });');

  expect(output).contain('}).strict().optional() }).strict()');
});

test.each([
  ['three levels', 'Joi.object({ a: Joi.object({ b: Joi.object({ c: Joi.string() }) }) })', 3],
  ['sibling objects', 'Joi.object({ a: Joi.object({ b: Joi.string() }), c: Joi.object({ d: Joi.string() }) })', 3],
])('makes every object of a %s schema strict', async (_name, expression, objectCount) => {
  const output = await transform(`export const schema = ${expression};`);

  expect(output.match(/z\.object\(/g)).toHaveLength(objectCount);
  expect(output.match(/\.strict\(\)/g)).toHaveLength(objectCount);
});
