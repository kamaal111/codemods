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
    // The example is a fixture that gets rewritten in place; it plays by looser rules.
    files: ['example/**/*.ts'],
    rules: {
      'unicorn/no-thenable': 'off',
    },
  },
]);
