import scanCallArguments, { skipLiteralAt } from '../../../src/codemods/utils/scan-call-arguments';

test.each([
  ['Joi.string().min(3)', 'min', '3'],
  ['Joi.number().min(1.5).max(2.5)', 'min', '1.5'],
  ['Joi.string().valid(...Object.values(Job))', 'valid', '...Object.values(Job)'],
  ['Joi.array().refine(value => value.slice(0, 3).length > 0)', 'refine', 'value => value.slice(0, 3).length > 0'],
  ['Joi.string().default("a(b)c")', 'default', '"a(b)c"'],
  ['Joi.date().min(new Date("2020-01-01"))', 'min', 'new Date("2020-01-01")'],
  ['Joi.string()\n  .min(3)\n  .max(5)', 'max', '5'],
  ['Joi.string() .min (3)', 'min', '3'],
  ['Joi.string().required()', 'required', ''],
])('reads the arguments of .%s in %s', (text, name, expected) => {
  expect(scanCallArguments(text, name)?.args).toBe(expected);
});

test('keeps a regex literal intact', () => {
  expect(scanCallArguments(String.raw`Joi.string().regex(/^a\/b$/)`, 'regex')?.args).toBe(String.raw`/^a\/b$/`);
});

test('does not end a regex on a parenthesis inside a character class', () => {
  expect(scanCallArguments('Joi.string().regex(/[()]/)', 'regex')?.args).toBe('/[()]/');
});

test('reads past a regex to the following arguments', () => {
  expect(scanCallArguments("Joi.string().pattern(/^k/, { name: 'x' })", 'pattern')?.args).toBe("/^k/, { name: 'x' }");
});

test.each([
  ['Joi.string().max(10)', 'maxLength'],
  ['Joi.string().maxLength(10)', 'max'],
])('does not match a partial identifier (%s / %s)', (text, name) => {
  expect(scanCallArguments(text, name)).toBeUndefined();
});

test('does not match a property access without a call', () => {
  expect(scanCallArguments('const value = schema.min;', 'min')).toBeUndefined();
});

test('returns the span covering the whole call', () => {
  const text = 'Joi.string().min(3).max(5)';
  const match = scanCallArguments(text, 'min');

  expect(text.slice(match?.startIndex, match?.endIndex)).toBe('.min(3)');
});

test('resumes the search from the given index', () => {
  const text = 'Joi.string().min(3).min(4)';
  const first = scanCallArguments(text, 'min');
  const second = scanCallArguments(text, 'min', first?.endIndex ?? 0);

  expect(first?.args).toBe('3');
  expect(second?.args).toBe('4');
});

test('returns undefined on an unbalanced call', () => {
  expect(scanCallArguments('Joi.string().min(3', 'min')).toBeUndefined();
});

test('does not treat division as a regex literal', () => {
  expect(scanCallArguments('Joi.number().min(6 / 2)', 'min')?.args).toBe('6 / 2');
});

test('skips quoted, template, and regex literals including escaped delimiters', () => {
  expect(skipLiteralAt(String.raw`'it\'s'`, 0)).toBe(7);
  expect(skipLiteralAt('`template`', 0)).toBe(10);
  expect(skipLiteralAt(String.raw`/[\]]/`, 0)).toBe(6);
});

test('returns the end of an unterminated literal', () => {
  expect(skipLiteralAt("'unterminated", 0)).toBe(13);
});

test('skips a line comment rather than reading it as a regex literal', () => {
  const text = 'Joi.number()\n  // divide / conquer\n  .integer()';

  expect(scanCallArguments(text, 'integer')?.args).toBe('');
});

test('reads a name wedged behind a block comment', () => {
  const text = 'Joi.string()./* an id */guid()';

  expect(scanCallArguments(text, 'guid')?.args).toBe('');
});

test('reads a name separated from its dot by whitespace', () => {
  expect(scanCallArguments('Joi.string() . guid()', 'guid')?.args).toBe('');
});

test('reads arguments past a block comment', () => {
  const text = "Joi.string()\n  /* human readable */\n  .description('a name')";

  expect(scanCallArguments(text, 'description')?.args).toBe("'a name'");
});

test('tolerates an unterminated line comment', () => {
  expect(scanCallArguments('Joi.string() // trailing', 'guid')).toBeUndefined();
});

test('tolerates an unterminated block comment', () => {
  expect(scanCallArguments('Joi.string() /* trailing', 'guid')).toBeUndefined();
});
