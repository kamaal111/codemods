import parseCallChain, { findIdentifierCallChains } from '../../../src/codemods/utils/parse-call-chain';

function namesOf(text: string, root = 'Joi'): Array<string> {
  return parseCallChain(text, text.indexOf(root) + root.length).map(segment => segment.name);
}

test('reads every segment of a chain', () => {
  expect(namesOf('Joi.string().min(3).max(5).required()')).toEqual(['string', 'min', 'max', 'required']);
});

test('reads a chain broken across lines', () => {
  expect(namesOf('Joi.string()\n  .min(3)\n  .required()')).toEqual(['string', 'min', 'required']);
});

test('does not descend into a nested chain living in the arguments', () => {
  const text = 'Joi.object().keys({ a: Joi.string().min(1) }).required()';

  expect(namesOf(text)).toEqual(['object', 'keys', 'required']);
});

test('keeps segment arguments verbatim', () => {
  const segments = parseCallChain('Joi.object().keys({ a: Joi.string() })', 'Joi'.length);

  expect(segments[1]?.args).toBe('{ a: Joi.string() }');
});

test('reports a span that covers the segment', () => {
  const text = 'Joi.string().min(3)';
  const segment = parseCallChain(text, 'Joi'.length)[1];

  expect(text.slice(segment?.startIndex, segment?.endIndex)).toBe('.min(3)');
});

test('stops at a property access that is not called', () => {
  expect(namesOf('Joi.string().min(3).description')).toEqual(['string', 'min']);
});

test('returns nothing when the chain does not continue', () => {
  expect(parseCallChain('Joi', 'Joi'.length)).toEqual([]);
});

test('stops at an unbalanced segment', () => {
  expect(namesOf('Joi.string().min(3')).toEqual(['string']);
});

test('stops before syntax that cannot be a JavaScript member call', () => {
  expect(namesOf('Joi . string () . min ( 3 )')).toEqual([]);
});

test('keeps delimiters inside strings and regexes in one call argument', () => {
  const segments = parseCallChain(String.raw`Joi.string().pattern(/[()]/).default(')')`, 'Joi'.length);

  expect(segments.map(segment => segment.args)).toEqual(['', '/[()]/', "')'"]);
});

test('stops at a malformed closing delimiter', () => {
  expect(namesOf('Joi.string([)]).min(3)')).toEqual([]);
});

test('finds every standalone identifier call chain', () => {
  const chains = [...findIdentifierCallChains('Joi.string(); Joi.number().min(1)', 'Joi')];

  expect(
    chains.map(chain => ({
      rootStartIndex: chain.rootStartIndex,
      names: chain.segments.map(segment => segment.name),
    })),
  ).toEqual([
    { rootStartIndex: 0, names: ['string'] },
    { rootStartIndex: 14, names: ['number', 'min'] },
  ]);
});

test('does not find an identifier preceded by an identifier character or property access', () => {
  const chains = [
    ...findIdentifierCallChains('myJoi.string(); $Joi.string(); namespace.Joi.string(); Joi.string()', 'Joi'),
  ];

  expect(chains.map(chain => chain.rootStartIndex)).toEqual([55]);
});
