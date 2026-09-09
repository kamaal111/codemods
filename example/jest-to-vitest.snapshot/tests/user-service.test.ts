// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the jest-to-vitest codemod over example/jest-to-vitest/tests/user-service.test.ts.
// Regenerate with `pnpm generate:example-snapshot`; keeping this file in sync is enforced
// by `pnpm check:example-snapshot` (part of `pnpm quality`).

import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { fetchUser, formatUser, createNotifier } from '../src/user-service';

describe('user-service', () => {
  describe('fetchUser', () => {
    it('should return a user with the given id', () => {
      const user = fetchUser(1);
      expect(user.id).toBe(1);
      expect(user.name).toBe('User 1');
      expect(user.email).toBe('user1@example.com');
    });
  });

  describe('formatUser', () => {
    it('should format user as name and email', () => {
      const user = { id: 1, name: 'Alice', email: 'alice@example.com' };
      expect(formatUser(user)).toBe('Alice <alice@example.com>');
    });
  });

  describe('createNotifier', () => {
    let mockCallback: Mock;

    beforeEach(() => {
      mockCallback = vi.fn();
    });

    it('should call the callback with a greeting', () => {
      const notifier = createNotifier(mockCallback);
      notifier.notify({ id: 1, name: 'Bob', email: 'bob@example.com' });

      expect(mockCallback).toHaveBeenCalledWith('Hello, Bob!');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
});
