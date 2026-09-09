import { JOI_TO_ZOD_LANGUAGE, makeJoiToZodInitialModification } from '../../../../src/codemods/joi-to-zod';
import joiAssertToRefine from '../../../../src/codemods/joi-to-zod/rules/joi-assert-to-refine';
import { invalidRuleSignal, validRuleSignal } from '../../../test-utils/detection-theory';

const KEYS = 'Joi.object().keys({ password: Joi.string(), confirm: Joi.string() })';

async function transform(body: string): Promise<string> {
  const source = `
import Joi from 'joi';

export const schema = ${body};
`;
  const modifications = await invalidRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAssertToRefine(makeJoiToZodInitialModification(ast));
  });

  return modifications.ast.root().text();
}

test('converts a reference assertion into an equality refinement', async () => {
  const updatedSource = await transform(`${KEYS}.assert('.confirm', Joi.ref('password'), 'must match')`);

  expect(updatedSource).contain(
    "refine(value => value['confirm'] === value['password'], { message: 'must match', path: ['confirm'] })",
  );
  expect(updatedSource).not.contain('.assert(');
});

test('omits the message when the assertion has none', async () => {
  const updatedSource = await transform(`${KEYS}.assert('.confirm', Joi.ref('password'))`);

  expect(updatedSource).contain("{ path: ['confirm'] }");
  expect(updatedSource).not.contain('message:');
});

test('parses the subject against a schema assertion', async () => {
  const updatedSource = await transform(`${KEYS}.assert('.confirm', Joi.string().min(8), 'too short')`);

  expect(updatedSource).contain("Joi.string().min(8).safeParse(value['confirm']).success");
});

test('accepts a reference subject as well as a path string', async () => {
  const updatedSource = await transform(`${KEYS}.assert(Joi.ref('confirm'), Joi.ref('password'))`);

  expect(updatedSource).contain("value['confirm'] === value['password']");
});

test('reads a dotted subject as an optional access chain', async () => {
  const updatedSource = await transform(
    "Joi.object().keys({ meta: Joi.object().keys({ code: Joi.string() }) }).assert('.meta.code', Joi.ref('other'))",
  );

  expect(updatedSource).contain("value['meta']?.['code']");
  expect(updatedSource).contain("path: ['meta', 'code']");
});

test('converts every assertion on one object', async () => {
  const updatedSource = await transform(
    "Joi.object().keys({ a: Joi.string(), b: Joi.string(), c: Joi.string() }).assert('.b', Joi.ref('a')).assert('.c', Joi.ref('a'))",
  );

  expect(updatedSource).not.contain('.assert(');
  expect(updatedSource.match(/\.refine\(/g)).toHaveLength(2);
});

test('leaves objects without an assertion untouched', async () => {
  const source = `
import Joi from 'joi';

export const schema = ${KEYS};
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAssertToRefine(makeJoiToZodInitialModification(ast));
  });
});

test('leaves an assertion whose subject is not a plain reference', async () => {
  const source = `
import Joi from 'joi';

export const schema = ${KEYS}.assert(computedSubject, Joi.ref('password'));
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAssertToRefine(makeJoiToZodInitialModification(ast));
  });
});

test('leaves an assertion whose schema is neither a reference nor a joi schema', async () => {
  const source = `
import Joi from 'joi';

export const schema = ${KEYS}.assert('.confirm', someSchema);
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAssertToRefine(makeJoiToZodInitialModification(ast));
  });
});

test('leaves an assertion missing its schema argument', async () => {
  const source = `
import Joi from 'joi';

export const schema = ${KEYS}.assert('.confirm');
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAssertToRefine(makeJoiToZodInitialModification(ast));
  });
});

test('converts an assert call separated from its arguments by a comment', async () => {
  const updatedSource = await transform(`${KEYS}.assert /* args */ ('.confirm', Joi.ref('password'))`);

  expect(updatedSource).not.contain('.assert');
  expect(updatedSource).contain("value['confirm'] === value['password']");
});

test('does not accept a similarly prefixed receiver as the assertion schema', async () => {
  const source = `
import Joi from 'joi';

export const schema = ${KEYS}.assert('.confirm', JoiHelpers.string());
`;

  await validRuleSignal(source, JOI_TO_ZOD_LANGUAGE, ast => {
    return joiAssertToRefine(makeJoiToZodInitialModification(ast));
  });
});
