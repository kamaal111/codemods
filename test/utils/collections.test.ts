import { uniques } from '../../src/utils/arrays.ts';

test('drops duplicate values while keeping first-seen order', () => {
  expect(uniques(['vi', 'expect', 'vi', 'describe', 'expect'])).toEqual(['vi', 'expect', 'describe']);
  expect(uniques([])).toEqual([]);
});
