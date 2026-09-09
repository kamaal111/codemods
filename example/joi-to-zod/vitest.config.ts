import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['example/joi-to-zod/**/*.test.ts'],
  },
});
