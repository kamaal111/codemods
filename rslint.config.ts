import { defineConfig, globalIgnores, importPlugin, ts } from '@rslint/core';

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**', '.yarn/**']),
  ...ts.configs.recommendedTypeChecked,
  importPlugin.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mts', '**/*.mjs'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      'no-underscore-dangle': ['error', { enforceInMethodNames: true }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', ['internal', 'parent', 'sibling', 'index']],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    // The examples are fixtures that get rewritten in place; they play by looser rules.
    files: ['example/**/*.ts'],
    rules: {
      'unicorn/no-thenable': 'off',
    },
  },
  {
    // The jest-to-vitest fixture demonstrates the require() patterns the codemod rewrites, so it
    // has to contain them before the transform runs.
    files: ['example/jest-to-vitest/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
