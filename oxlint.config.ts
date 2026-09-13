import kamaalQualityConfig from '@kamaal111/kamaal-quality-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [kamaalQualityConfig],
  overrides: [
    {
      files: ['example/joi-to-zod/schemas.ts'],
      rules: {
        'unicorn/no-thenable': 'off',
        'anti-slop/no-unknown-parameters': 'off',
      },
    },
    {
      files: ['example/joi-to-zod/validate.ts'],
      rules: {
        'anti-slop/no-runtime-typeof': 'off',
        'anti-slop/no-unknown-parameters': 'off',
        'anti-slop/no-unsafe-dictionary-type': 'off',
      },
    },
    {
      files: ['example/joi-to-zod/schemas.zod.ts'],
      rules: { 'anti-slop/no-unknown-parameters': 'off' },
    },
    {
      files: ['src/kit/result.ts'],
      rules: {
        'anti-slop/no-unknown-parameters': 'off',
        'anti-slop/no-unknown-returns': 'off',
      },
    },
  ],
  ignorePatterns: [
    '.agents/**',
    '.codex/**',
    'dist/**/*',
    'example/jest-to-vitest/**',
    'example/jest-to-vitest.snapshot/**',
  ],
});
