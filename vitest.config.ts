import { defineConfig, configDefaults } from 'vitest/config';

/**
 * Vitest config. Phase 5 removed the last legacy Flow `.js` source, so the Flow/JSX-in-`.js` pre-strip
 * (added transitionally) is gone — all source is `.ts`/`.tsx` that Vitest handles natively.
 */
export default defineConfig({
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
