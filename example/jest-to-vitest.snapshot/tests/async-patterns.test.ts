// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the jest-to-vitest codemod over example/jest-to-vitest/tests/async-patterns.test.ts.
// Regenerate with `yarn generate:example-snapshot`; keeping this file in sync is enforced
// by `yarn check:example-snapshot` (part of `yarn quality`).

import { describe, expect, it, test } from 'vitest';

import { fetchUser } from '../src/user-service';

describe('async-patterns', () => {
  describe('done callback pattern', () => {
    it('fetches user using done callback', () =>
      new Promise<void>((resolve, reject) => {
        const done = (err?: unknown) => (err ? reject(err) : resolve());
        setTimeout(() => {
          const user = fetchUser(1);
          expect(user.id).toBe(1);
          expect(user.name).toBe('User 1');
          done();
        }, 0);
      }));

    it('handles error via done callback', () =>
      new Promise<void>((resolve, reject) => {
        const done = (err?: unknown) => (err ? reject(err) : resolve());
        setTimeout(() => {
          try {
            const user = fetchUser(2);
            expect(user.email).toBe('user2@example.com');
            done();
          } catch (err) {
            done(err instanceof Error ? err : new Error(String(err)));
          }
        }, 0);
      }));

    test('test() also supports done callback', () =>
      new Promise<void>((resolve, reject) => {
        const done = (err?: unknown) => (err ? reject(err) : resolve());
        setTimeout(() => {
          const user = fetchUser(3);
          expect(user.name).toBe('User 3');
          done();
        }, 0);
      }));

    test(
      'test() with timeout and done callback',
      () =>
        new Promise<void>((resolve, reject) => {
          const done = (err?: unknown) => (err ? reject(err) : resolve());
          setTimeout(() => {
            const user = fetchUser(4);
            expect(user.id).toBe(4);
            done();
          }, 0);
        }),
      5000,
    );
  });
});
