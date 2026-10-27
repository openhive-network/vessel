import { defineConfig } from 'vitest/config';

/**
 * Dedicated config for the opt-in LIVE broadcast smoke (*.smoke.test.ts). The default vitest.config.ts
 * EXCLUDES those so `npm run verify` / `npm test` never broadcast even with a local .env. This config
 * runs only the smoke, loading .env via the shared setup. Invoked by `npm run test:testnet`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.smoke.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
