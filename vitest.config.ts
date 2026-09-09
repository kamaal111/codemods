import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/codemods/joi-to-zod/types.ts', 'src/index.ts'],
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
      thresholds: { statements: 95, branches: 90, functions: 99, lines: 96 },
    },
  },
});
