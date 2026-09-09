import joiToZod from '../../../../src/codemods/joi-to-zod';

async function transform(body: string): Promise<string> {
  return joiToZod(`import Joi from 'joi';\n\n${body}\n`);
}

test('treats a commented spread of enum values as the enum itself', async () => {
  const output = await transform(`enum Job {
  Developer = 'developer',
}

export const schema = Joi.string().valid(/* every job */ ...Object.values(Job));`);

  expect(output).toContain('z.enum(Job)');
  expect(output).not.toContain('/* every job */,');
});

test('keeps a commented literal list a well formed enum', async () => {
  const output = await transform("export const schema = Joi.string().valid(/* roles */ 'admin', 'user');");

  expect(output).toContain("z.enum(['admin', 'user'])");
});
