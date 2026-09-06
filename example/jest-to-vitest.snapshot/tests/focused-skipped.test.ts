// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the jest-to-vitest codemod over example/jest-to-vitest/tests/focused-skipped.test.ts.
// Regenerate with `yarn generate:example-snapshot`; keeping this file in sync is enforced
// by `yarn check:example-snapshot` (part of `yarn quality`).

import { describe, expect, it } from 'vitest';

import { add } from '../src/calculator';

it.skip('should be skipped via xit', () => {
  expect(add(1, 1)).toBe(99);
});

it.skip('should be skipped via xtest', () => {
  expect(add(1, 1)).toBe(99);
});

describe.skip('skipped describe block via xdescribe', () => {
  it('should be skipped', () => {
    expect(add(1, 1)).toBe(99);
  });
});

if (false) {
  it.only('should run as the only test via fit', () => {
    expect(add(1, 1)).toBe(2);
  });

  describe.only('focused describe block via fdescribe', () => {
    it('focused test passes', () => {
      expect(add(2, 3)).toBe(5);
    });
  });
}
