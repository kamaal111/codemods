import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@rstest/core';
import z from 'zod';

import { collectionIsEmpty } from '../../src/kit/collections.ts';
import {
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
  loadCodemodConfig,
} from '../../src/kit/config.ts';
import { toError, tryCatch, tryCatchAsync } from '../../src/kit/result.ts';
import { invariant } from '../../src/utils/asserts.ts';

test('loads a valid config with a supplied schema and reports each config input failure precisely', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codemods-config-'));
  const validPath = path.join(directory, 'valid.json');
  const malformedPath = path.join(directory, 'malformed.json');
  const invalidPath = path.join(directory, 'invalid.json');
  try {
    await fs.writeFile(validPath, JSON.stringify({ paths: ['src'], dry_run: true }));
    await fs.writeFile(malformedPath, '{');
    await fs.writeFile(invalidPath, JSON.stringify({ paths: [] }));

    await expect(
      loadCodemodConfig(validPath, z.object({ paths: z.array(z.string()), dry_run: z.boolean() })),
    ).resolves.toEqual({
      paths: ['src'],
      dry_run: true,
    });
    await expect(loadCodemodConfig(path.join(directory, 'missing.json'))).rejects.toBeInstanceOf(ConfigNotFoundError);
    await expect(loadCodemodConfig(malformedPath)).rejects.toBeInstanceOf(ConfigParseError);
    await expect(loadCodemodConfig(invalidPath)).rejects.toBeInstanceOf(ConfigValidationError);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('preserves values and errors through result helpers and recognizes arrays and sets', async () => {
  expect(
    tryCatch(() => 'value').match(
      value => value,
      () => '',
    ),
  ).toBe('value');
  expect(
    tryCatch(() => {
      throw 'failure';
    }).match(
      () => '',
      error => String(error),
    ),
  ).toBe('failure');
  expect(
    (await tryCatchAsync(async () => 'async value')).match(
      value => value,
      () => '',
    ),
  ).toBe('async value');
  expect(
    (await tryCatchAsync(async () => Promise.reject('async failure'))).match(
      () => '',
      error => String(error),
    ),
  ).toBe('async failure');
  expect(toError(new Error('known')).message).toBe('known');
  expect(toError('unknown').message).toBe('unknown');
  expect(collectionIsEmpty([])).toBe(true);
  expect(collectionIsEmpty(['value'])).toBe(false);
  expect(collectionIsEmpty(new Set())).toBe(true);
  expect(collectionIsEmpty(new Set(['value']))).toBe(false);
});

test('throws the supplied invariant message when a required condition is false', () => {
  expect(() => invariant(false, 'required value missing')).toThrow('required value missing');
  expect(() => invariant(false)).toThrow('Assertion failed');
  invariant(true);
  expect(true).toBe(true);
});
