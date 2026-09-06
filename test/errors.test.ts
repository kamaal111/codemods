import { expect, test } from '@rstest/core';

import { CliUsageError } from '../src/errors.ts';

test('identifies command errors as usage errors', () => {
  const error = new CliUsageError('a path is required');

  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('a path is required');
});
