// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'src-tauri/**', 'rust_plugins/**', 'python_sdk/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'import-x': importX,
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import-x/no-cycle': ['warn', { ignoreExternal: true }],

      // Existing code base still relies on these; tightened incrementally.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prefer-const': 'warn',

      // docs/RULES.md: use the notify/confirm service instead of blocking browser dialogs.
      'no-alert': 'warn',
    },
  },
  {
    // Layering: only src/api may talk to Tauri directly (docs/ARCHITECTURE.md).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['@tauri-apps/*'],
              message: 'Access Tauri only through the adapters in src/api.',
            },
          ],
        },
      ],
    },
  },
  {
    // Layering: pure utilities must not depend on the store or UI.
    files: ['src/utils/**/*.ts', 'src/types/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/stores/**', '**/components/**'],
              message: 'utils/types must not depend on stores or components.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests: assert behaviour with the real store, not a mocked one (docs/TESTING.md).
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.value=/stores\\/appStore$/]",
          message: 'Do not mock the app store in tests; reset the real store with resetAppStore() instead.',
        },
      ],
    },
  },
  {
    // Node scripts (Playwright helpers evaluate code in the page, hence browser globals too).
    files: ['*.{js,ts}', 'scripts/**/*.js', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  prettier,
);
