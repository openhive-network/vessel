import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // A fresh empty profile → the Getting Started onboarding renders and the real keystore is never
  // opened. NODE_ENV=production makes the main process load out/renderer/index.html over file://.
  const userDataDir = mkdtempSync(join(tmpdir(), 'vessel-e2e-'));
  app = await electron.launch({
    args: ['out/main/main.dev.js'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      VESSEL_USER_DATA: userDataDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
});

test('launches a renderer window', async () => {
  expect(app.windows().length).toBeGreaterThanOrEqual(1);
});

test('window title is Vessel', async () => {
  await expect.poll(() => page.title()).toBe('Vessel');
});

test('renders the Getting Started onboarding on an empty profile', async () => {
  await expect(page.getByText('Getting Started')).toBeVisible();
});

test('dark/light color-scheme toggle flips the scheme (Phase 7 M0)', async () => {
  const root = page.locator('html');
  const toggle = page.getByRole('button', { name: 'Toggle color scheme' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const first = await root.getAttribute('data-mantine-color-scheme');
  expect(['light', 'dark']).toContain(first);
  // a second click flips to the other scheme — proves the toggle drives Mantine's color scheme
  await toggle.click();
  await expect.poll(() => root.getAttribute('data-mantine-color-scheme')).not.toBe(first);
  expect(['light', 'dark']).toContain(await root.getAttribute('data-mantine-color-scheme'));
});
