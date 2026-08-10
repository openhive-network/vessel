import { defineConfig } from 'vitest/config';

/**
 * Phase 2 — Vitest replaces Jest. The Phase 1 test suite imports ONLY pure-TS modules (envelope,
 * migration, authority, mnemonic) plus redux/redux-persist; Vitest runs ESM natively, so the
 * @scure/@noble packages load without the babel-jest transformIgnorePatterns hack Jest needed.
 * Jest-compatible globals (describe/it/expect) are enabled so the specs need no changes.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.{test,spec}.{ts,tsx}'],
    // Loads a gitignored .env (VESSEL_TESTNET_* for the opt-in mirrornet broadcast smoke) into
    // process.env before any test runs. Absent .env -> those tests just stay skipped.
    setupFiles: ['./vitest.setup.ts'],
  },
});
