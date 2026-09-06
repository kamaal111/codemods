// GENERATED FILE — DO NOT EDIT BY HAND.
// Written by the jest-to-vitest codemod when it is run over example/jest-to-vitest.
// Regenerate with `yarn generate:example-snapshot`; keeping this file in sync is enforced
// by `yarn check:example-snapshot` (part of `yarn quality`).

import path from 'node:path';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@/(.*)': path.resolve(__dirname, './src/$1'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    clearMocks: true,
    mockReset: false,
    restoreMocks: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    coverage: {
      dir: 'coverage',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
