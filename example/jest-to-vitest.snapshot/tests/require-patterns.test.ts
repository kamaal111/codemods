// GENERATED FILE — DO NOT EDIT BY HAND.
// Produced by running the jest-to-vitest codemod over example/jest-to-vitest/tests/require-patterns.test.ts.
// Regenerate with `pnpm generate:example-snapshot`; keeping this file in sync is enforced
// by `pnpm check:example-snapshot` (part of `pnpm quality`).

import { describe, expect, it } from 'vitest';

describe('require-patterns', () => {
  it('transforms require inside arrow function to async arrow', async () => {
    const loadCalculator = async () => {
      return await import('../src/calculator');
    };
    const calc = await loadCalculator();
    expect(calc.add(1, 2)).toBe(3);
  });

  it('transforms require inside already-async arrow function without duplicate async', async () => {
    const loadCalculator = async () => {
      return await import('../src/calculator');
    };
    const calc = await loadCalculator();
    expect(calc.subtract(5, 3)).toBe(2);
  });

  it('transforms require inside a function declaration to async function', async () => {
    async function loadCalculator() {
      return await import('../src/calculator');
    }
    const calc = await loadCalculator();
    expect(calc.multiply(4, 3)).toBe(12);
  });

  it('transforms require inside a function expression to async function', async () => {
    const loadCalculator = async function () {
      return await import('../src/calculator');
    };
    const calc = await loadCalculator();
    expect(calc.divide(10, 2)).toBe(5);
  });
});
