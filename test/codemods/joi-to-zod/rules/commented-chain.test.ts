import joiToZod from '../../../../src/codemods/joi-to-zod';

async function transform(expression: string): Promise<string> {
  const output = await joiToZod(`import Joi from 'joi';\n\nexport const schema = ${expression};\n`);

  return output.replace(/^import.*$/m, '').trim();
}

test('hoists a string format declared after a line comment', async () => {
  const output = await transform('Joi.string()\n  // the primary key\n  .guid()\n  .required()');

  expect(output).toContain('z.uuid()');
  expect(output).not.toContain('.guid()');
  expect(output).not.toContain('.required()');
});

test('coerces a date bound declared after a line comment', async () => {
  const output = await transform("Joi.date()\n  // launch day\n  .min('2020-01-01')\n  .required()");

  expect(output).toContain("min(new Date('2020-01-01'))");
  expect(output).not.toContain('.required()');
});

test('maps a validation declared after a line comment', async () => {
  const output = await transform('Joi.number()\n  // must be whole\n  .integer()\n  .required()');

  expect(output).toContain('.int()');
  expect(output).not.toContain('.integer()');
  expect(output).not.toContain('.required()');
});

test('maps a validation carrying arguments after a line comment', async () => {
  const output = await transform("Joi.string()\n  // human readable\n  .description('a name')\n  .required()");

  expect(output).toContain("describe('a name')");
  expect(output).not.toContain('.description(');
});

test('keeps a block comment between chain links', async () => {
  const output = await transform('Joi.string()./* an id */guid().required()');

  expect(output).toContain('z.uuid()');
  expect(output).not.toContain('.guid()');
});

test('does not treat a method name inside a string argument as a chain link', async () => {
  const output = await transform("Joi.string().description('call .guid() first').required()");

  expect(output).toContain("describe('call .guid() first')");
  expect(output).toContain('z.string()');
  expect(output).not.toContain('z.uuid()');
});

test('maps a validation whose name is wedged behind a block comment', async () => {
  const output = await transform('Joi.number()./* whole */integer().required()');

  expect(output).toContain('.int()');
  expect(output).not.toContain('.integer()');
});
