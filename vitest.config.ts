import { defineConfig, configDefaults } from 'vitest/config';
import { transformSync } from '@babel/core';

/**
 * Phase 2 — Vitest replaces Jest. Phase 5 note: as the RTK slices/tests began importing the legacy
 * `app/actions/*.js` chain, which is still Flow-annotated `.js`, Vitest needed the same Flow/JSX strip
 * the electron-vite build applies (that plugin lives only in electron.vite.config.ts). This pre-transform
 * mirrors it so any test that pulls in a Flow `.js` module parses. Removed once Phase 5 deletes the last
 * `@flow` file.
 */
function flowJsxJs() {
  return {
    name: 'vessel-flow-jsx-js-test',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0];
      if (!file.endsWith('.js') || file.includes('node_modules') || !file.includes('/app/')) {
        return null;
      }
      const result = transformSync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        plugins: ['@babel/plugin-transform-flow-strip-types'],
        sourceMaps: true,
      });
      if (!result || result.code == null) return null;
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [flowJsxJs()],
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.{test,spec}.{ts,tsx}'],
    // The live broadcast smoke (*.smoke.test.ts) is excluded from the default suite so a local .env
    // never makes `npm run verify` broadcast. Run it explicitly with `npm run test:testnet`.
    exclude: [...configDefaults.exclude, '**/*.smoke.test.ts'],
    // Loads a gitignored .env (VESSEL_TESTNET_* for the opt-in mirrornet broadcast smoke) into
    // process.env before any test runs. Absent .env -> those tests just stay skipped.
    setupFiles: ['./vitest.setup.ts'],
  },
});
