// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the jest-to-vitest codemod over example/jest-to-vitest/tests/mocks.test.ts.
// Regenerate with `pnpm generate:example-snapshot`; keeping this file in sync is enforced
// by `pnpm check:example-snapshot` (part of `pnpm quality`).

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mocked,
  type MockedClass,
  type MockedFunction,
  type MockInstance,
  vi,
} from 'vitest';

import { add, multiply } from '../src/calculator';
import type { createLogger } from '../src/logger';

vi.mock('../src/calculator', async () => {
  const mockedModule = {
    ...(await vi.importActual('../src/calculator')),
    add: vi.fn(function () {
      return 99;
    }),
  };
  return { ...mockedModule, default: mockedModule };
});

let logSpy: MockInstance;
let mockedAdd: MockedFunction<typeof add>;
let mockedLogger: Mocked<ReturnType<typeof createLogger>>;

class Greeter {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

let mockedGreeter: MockedClass<typeof Greeter>;

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('mock transformation cases', () => {
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
    mockedAdd = add as MockedFunction<typeof add>;
    mockedAdd.mockImplementation(function () {
      return 99;
    });
    mockedLogger = { log: vi.fn() } as Mocked<ReturnType<typeof createLogger>>;
    mockedGreeter = Greeter as unknown as MockedClass<typeof Greeter>;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('mocked add returns 99', () => {
    expect(add(1, 2)).toBe(99);
  });

  it('multiply returns actual result via requireActual', () => {
    expect(multiply(2, 3)).toBe(6);
  });

  it('spyOn captures console.log calls', () => {
    console.log('hello world');
    expect(logSpy).toHaveBeenCalledWith('hello world');
  });

  it('mockedAdd is defined', () => {
    expect(mockedAdd).toBeDefined();
  });

  it('mockedLogger mock methods work', () => {
    mockedLogger.log('info', 'test message');
    expect(mockedLogger.log).toHaveBeenCalledWith('info', 'test message');
  });

  it('mockedGreeter is defined', () => {
    expect(mockedGreeter).toBeDefined();
  });
});

describe.skip('transformation coverage for problematic runtime cases', () => {
  it('jest.setTimeout transformation', () => {
    vi.setConfig({ testTimeout: 50_000 });
  });

  it('jest.createMockFromModule transformation', () => {
    const mock = vi.importMock('../src/calculator');
    expect(mock).toBeDefined();
  });

  it('jest.setMock transformation', () => {
    vi.doMock('../src/logger', () => ({ ...{ createLogger: vi.fn() }, default: { createLogger: vi.fn() } }));
    expect(true).toBe(true);
  });

  it('jest.dontMock transformation', () => {
    vi.doUnmock('../src/logger');
    expect(true).toBe(true);
  });

  it('jest.requireMock transformation inside a helper', async () => {
    const loadCalculator = async () => {
      return await import('../src/calculator');
    };

    const calculator = await loadCalculator();
    expect(calculator).toBeDefined();
  });
});
