import { defineConfig } from '@playwright/test';

/**
 * Playwright `_electron` smoke suite (Phase 2 D4). Launches the electron-vite production build
 * (out/main/main.dev.js) against a DISPOSABLE profile — never the real keystore. Requires a prior
 * `npm run build`; CI runs the build stage first, then this suite under xvfb-run.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
});
