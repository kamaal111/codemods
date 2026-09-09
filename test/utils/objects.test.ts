import { findRecordValue, objectKeys, omitBy } from '../../src/utils/objects.ts';

test('omits the entries matching the predicate and keeps the rest', () => {
  const dependencies = { vitest: '^4.0.0', jest: undefined, 'ts-jest': undefined, zod: '^4.5.4' };

  expect(omitBy(dependencies, value => value == null)).toEqual({ vitest: '^4.0.0', zod: '^4.5.4' });
});

test('passes the key to the predicate', () => {
  const dependencies = { vitest: '^4.0.0', 'ts-jest': '^29.0.0' };

  expect(omitBy(dependencies, (_value, key) => key.includes('jest'))).toEqual({ vitest: '^4.0.0' });
});

test('finds a record value by key without relying on an unchecked index access', () => {
  const dependencies = { vitest: '^5.0.0', zod: '^4.0.0' };

  expect(findRecordValue(dependencies, 'vitest')).toBe('^5.0.0');
  expect(findRecordValue(dependencies, 'jest')).toBeUndefined();
});

test("returns an object's own enumerable string keys", () => {
  const dependencies = { vitest: '^5.0.0', zod: '^4.0.0' };

  expect(objectKeys(dependencies)).toEqual(['vitest', 'zod']);
});
