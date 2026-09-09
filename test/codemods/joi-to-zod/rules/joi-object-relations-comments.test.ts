import joiToZod from '../../../../src/codemods/joi-to-zod';

async function transform(body: string): Promise<string> {
  return joiToZod(`import Joi from 'joi';\n\n${body}\n`);
}

const KEYS = 'Joi.object().keys({ a: Joi.string(), b: Joi.string() })';

test('reads peer keys past a comment', async () => {
  const output = await transform(`export const schema = ${KEYS}.with('a', /* peers */ ['b']);`);

  expect(output).toContain("value['a'] === undefined || [value['b']].every");
  expect(output).not.toContain('/* peers */');
});

test('reads a bare peer list past a comment', async () => {
  const output = await transform(`export const schema = ${KEYS}.or(/* either */ 'a', 'b');`);

  expect(output).toContain("[value['a'], value['b']].some");
});
