import { defineConfig } from '@rstest/core';

export default defineConfig({
  exclude: ['**/node_modules/**', '**/dist/**', 'example/**'],
  disableConsoleIntercept: true,
  coverage: {
    provider: 'istanbul',
    include: ['src/**'],
    exclude: ['src/codemods/joi-to-zod/types.ts', 'src/index.ts'],
    reporters: ['text', 'html', 'clover', 'json', 'lcovonly'],
    thresholds: { statements: 95, branches: 90, functions: 99, lines: 99 },
  },
});
