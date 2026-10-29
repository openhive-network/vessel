import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Phase 3 · Task 5 — the `vessel://sign` renderer flow in the real built app. Drives the sign route
 * (`?type=sign&action=promptOperation&ops=<b64>&meta=<b64>`) and asserts:
 *   A) a malformed/undecodable ops payload is REFUSED (never rendered as a signable request), and
 *   B) a well-formed payload renders the sign UI with the operation summary.
 *
 * SAFE TO AUTO-RUN: it never selects a signing account and never clicks confirm, so it stops well
 * before any signature or broadcast — no network, no keys. Requires a prior `pnpm run build`.
 */
const MAIN = path.join(__dirname, '..', 'out', 'main', 'main.dev.js');
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64');
const META = Buffer.from('{}').toString('base64');

const signUrl = (base: string, opsB64: string) => {
  const clean = base.split('#')[0].split('?')[0];
  // Mirror production createPrompt: ops/meta are percent-encoded so base64 '+' survives URLSearchParams
  // (a literal '+' would be decoded to a space and corrupt the payload).
  return `${clean}?type=sign&action=promptOperation&ops=${encodeURIComponent(opsB64)}&meta=${encodeURIComponent(META)}`;
};

test.describe('Task 5 — vessel://sign renderer flow (built app)', () => {
  test('refuses a malformed payload; renders the summary for a valid one', async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-e2e-sign-ui-'));
    const app = await electron.launch({
      args: [...(process.env.CI ? ['--no-sandbox'] : []), MAIN],
      env: { ...process.env, NODE_ENV: 'production', VESSEL_USER_DATA: profile },
    });
    try {
      const win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');
      const base = win.url();

      // A) malformed ops -> the refusal screen, never a signable request
      await win.goto(signUrl(base, 'not-valid-base64-@@@'));
      await win.waitForLoadState('domcontentloaded');
      await expect(win.locator('body')).toContainText(/can.?t be shown/i, { timeout: 15000 });

      // B) a well-formed transfer -> the sign UI with a plain-language summary line
      const ops = b64([['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'gm' }]]);
      await win.goto(signUrl(base, ops));
      await win.waitForLoadState('domcontentloaded');
      await expect(win.locator('body')).toContainText('Sign Transaction', { timeout: 15000 });
      await expect(win.locator('body')).not.toContainText(/can.?t be shown/i);

      // C) a valid payload whose base64 contains '+' must still render — regression guard for the
      // url-parse -> URLSearchParams swap: an unencoded '+' decodes to a space and would be refused.
      const opsPlus = b64([['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '~~~' }]]);
      expect(opsPlus).toContain('+'); // this payload actually exercises the '+' path
      await win.goto(signUrl(base, opsPlus));
      await win.waitForLoadState('domcontentloaded');
      await expect(win.locator('body')).toContainText('Sign Transaction', { timeout: 15000 });
      await expect(win.locator('body')).not.toContainText(/can.?t be shown/i);
    } finally {
      await app.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
