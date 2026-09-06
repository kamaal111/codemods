import { test, expect } from '@rstest/core';

import splitArguments from '../../../src/codemods/utils/split-arguments';

test.each([
  ['', []],
  ['   ', []],
  ['a', ['a']],
  ['a, b', ['a', ' b']],
])('splits %s', (args, expected) => {
  expect(splitArguments(args)).toEqual(expected);
});

test('does not split a comma inside a call', () => {
  expect(splitArguments('Joi.string(), Joi.number()')).toHaveLength(2);
});

test('does not split a comma inside an object literal', () => {
  expect(splitArguments("/^k/, { name: 'a', invert: true }")).toHaveLength(2);
});

test('does not split a comma inside an array literal', () => {
  expect(splitArguments("'a', ['b', 'c']")).toHaveLength(2);
});

test('does not split a comma inside a string', () => {
  expect(splitArguments("'a,b', 'c'")).toHaveLength(2);
});

test('does not split a comma inside an arrow body', () => {
  expect(splitArguments('value => Math.max(value, 0), 3')).toHaveLength(2);
});
