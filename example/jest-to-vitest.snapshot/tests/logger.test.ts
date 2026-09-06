// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the jest-to-vitest codemod over example/jest-to-vitest/tests/logger.test.ts.
// Regenerate with `yarn generate:example-snapshot`; keeping this file in sync is enforced
// by `yarn check:example-snapshot` (part of `yarn quality`).

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { createLogger, type Logger } from '../src/logger';

describe('logger', () => {
  let mockWriter: Mock;
  let logger: Logger;

  beforeEach(() => {
    mockWriter = vi.fn();
    logger = createLogger(mockWriter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should log info messages', () => {
    logger.log('info', 'hello');
    expect(mockWriter).toHaveBeenCalledWith('[INFO] hello');
  });

  it('should log warn messages', () => {
    logger.log('warn', 'be careful');
    expect(mockWriter).toHaveBeenCalledWith('[WARN] be careful');
  });

  it('should log error messages', () => {
    logger.log('error', 'something broke');
    expect(mockWriter).toHaveBeenCalledWith('[ERROR] something broke');
  });

  it('should call writer exactly once per log call', () => {
    logger.log('info', 'test');
    expect(mockWriter).toHaveBeenCalledTimes(1);
  });
});
