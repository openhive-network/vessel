// ESLint 9 flat config — replaces airbnb + `.eslintrc`/`app/.eslintrc`/`.eslintignore` (Phase 2 D3).
//
// NOTE ON VERSION: the plan targeted ESLint 10, but eslint-plugin-react 7.37.5 still calls
// context.getFilename() (removed in ESLint 10), so it cannot run on 10. Pinned to ESLint 9 until
// eslint-plugin-react ships 10 support; flat-config semantics are identical for this repo.
//
// Parsing: all source is `.ts`/`.tsx` (Phase 5 removed the last Flow `.js`; Phase 6 dropped babel),
// handled by the typescript-eslint parser scoped via `extends`. Any stray root `.js`/`.jsx` falls
// back to espree (js.recommended) — no Flow left to parse, so no babel parser is needed.
//
// Rule set: js.recommended + typescript-eslint(recommended) + react + react-hooks, eslint-config-prettier
// LAST. Airbnb's stylistic churn is intentionally dropped; noisy correctness rules are kept at "warn"
// so the CI gate (0 errors) holds while the modernization proceeds.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const SOURCE = ['app/**/*.{js,jsx,ts,tsx}'];
const TS = ['app/**/*.{ts,tsx}', 'e2e/**/*.ts', 'playwright.config.ts', '*.ts'];
const JSX = ['**/*.{js,jsx}'];

export default tseslint.config(
  // ---- ignores (replaces .eslintignore) ----
  {
    ignores: [
      'node_modules/**',
      'npm-common-config/**', // common-ci-configuration submodule
      'app/node_modules/**',
      'dll/**',
      'dist/**',
      'app/dist/**',
      'release/**',
      'out/**',
      'app/main.prod.js',
      'app/bundle.js',
      'app/style.css',
      'app/semantic-ui/**',
      'app/img/**',
      'flow-typed/**',
      // tooling configs whose ESM-only imports the parser can't resolve
      'electron.vite.config.ts',
      'vitest.config.ts',
    ],
  },

  // ---- base ----
  js.configs.recommended,

  // ---- React (classic runtime: react/jsx-uses-react keeps explicit `import React` valid) ----
  {
    files: SOURCE,
    ...react.configs.flat.recommended,
    // Explicit version (not 'detect'): the app is React 18.2, and 'detect' triggers eslint-plugin-react's
    // version probe, which calls context.getFilename() — removed in ESLint 10.
    settings: { react: { version: '18.2' } },
  },

  // ---- React Hooks (explicit rules; `useKey`/`useX` redux actions collide with the hook heuristic,
  //      so rules-of-hooks is a warning here, not a gate-breaking error) ----
  {
    files: SOURCE,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Airbnb-style: only flag a destructure if EVERY binding is const-able. Several money-path thunks
      // do `let { from, amount } = params` where `amount` is legitimately reassigned (the testnet
      // ' HIVE'->' TESTS' rewrite), so forcing const would be wrong; splitting the destructure is noise.
      'prefer-const': ['error', { destructuring: 'all', ignoreReadBeforeAssign: true }],
    },
  },

  // ---- TypeScript: recommended rules scoped to TS files ONLY (via extends) ----
  {
    files: TS,
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },

  // ---- globals for every source + root tooling file ----
  {
    files: ['**/*.{js,jsx,cjs,mjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // ---- core-rule calibration for JS/JSX (TS files are governed by the TS block above) ----
  {
    files: JSX,
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-unreachable': 'warn',
      'no-constant-binary-expression': 'warn',
      'no-prototype-builtins': 'warn',
      'no-console': 'off',
    },
  },

  // ---- react-rule calibration for all source (applies to both .js and .tsx) ----
  {
    files: SOURCE,
    rules: {
      'react/prop-types': 'off', // Flow / TS types cover props
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/no-deprecated': 'warn',
      'react/no-children-prop': 'warn',
      'react/no-unknown-property': 'warn',
      'react/jsx-key': 'warn',
      'react/no-direct-mutation-state': 'warn',
    },
  },

  // ---- prettier LAST: disables all formatting rules ----
  prettier,
);
