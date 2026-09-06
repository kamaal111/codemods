import { uniques } from '../../src/utils/arrays.ts';
import { omitBy } from '../../src/utils/objects.ts';

test('drops duplicate values while keeping first-seen order', () => {
  expect(uniques(['vi', 'expect', 'vi', 'describe', 'expect'])).toEqual(['vi', 'expect', 'describe']);
  expect(uniques([])).toEqual([]);
});

test('omits the entries matching the predicate and keeps the rest', () => {
  const dependencies = { vitest: '^4.0.0', jest: undefined, 'ts-jest': undefined, zod: '^4.5.4' };

  expect(omitBy(dependencies, value => value == null)).toEqual({ vitest: '^4.0.0', zod: '^4.5.4' });
});

test('passes the key to the predicate', () => {
  const dependencies = { vitest: '^4.0.0', 'ts-jest': '^29.0.0' };

  expect(omitBy(dependencies, (_value, key) => key.includes('jest'))).toEqual({ vitest: '^4.0.0' });
});
