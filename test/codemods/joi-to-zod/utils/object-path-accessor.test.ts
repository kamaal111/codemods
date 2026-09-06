import {
  buildValueAccessor,
  parseJoiReferencePath,
  referenceToAccessor,
} from '../../../../src/codemods/joi-to-zod/utils/object-path-accessor';

test.each([
  ["'type'", ['type']],
  ['"type"', ['type']],
  ["'.type'", ['type']],
  ["'meta.kind'", ['meta', 'kind']],
  ["'.meta.kind'", ['meta', 'kind']],
  ["Joi.ref('type')", ['type']],
  ["Joi.ref('meta.kind')", ['meta', 'kind']],
  ["  Joi.ref( 'type' )  ", ['type']],
  ["Validator.ref('type')", ['type']],
])('reads the path out of %s', (argument, expected) => {
  expect(parseJoiReferencePath(argument)).toEqual(expected);
});

test.each([['Joi.string()'], ['someVariable'], ["''"], ["'.'"], ['42']])(
  'returns undefined for the non-reference %s',
  argument => {
    expect(parseJoiReferencePath(argument)).toBeUndefined();
  },
);

test('indexes the first segment directly', () => {
  expect(buildValueAccessor(['type'])).toBe("value['type']");
});

test('makes nested steps optional so a missing parent reads as undefined', () => {
  expect(buildValueAccessor(['meta', 'kind'])).toBe("value['meta']?.['kind']");
});

test('accepts a different value identifier', () => {
  expect(buildValueAccessor(['type'], 'parsed')).toBe("parsed['type']");
});

test('turns a reference straight into an accessor', () => {
  expect(referenceToAccessor("Joi.ref('meta.kind')")).toBe("value['meta']?.['kind']");
});

test('returns undefined turning a non-reference into an accessor', () => {
  expect(referenceToAccessor('Joi.string()')).toBeUndefined();
});
