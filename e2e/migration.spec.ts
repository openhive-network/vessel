import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Phase 3 · D9b Stage B (step 3) — LIVE migration test against a disposable copy of the real profile
 * (VESSEL_USER_DATA=/tmp/.../vessel-b3-test-profile). Launches the built app, lets the rehydration
 * callback drive runKeystoreMigration over IPC, then proves keystore.json received EVERY persisted key
 * record with byte-identical ciphertext — using the renderer's own localStorage as the independent
 * source-of-truth oracle. Nothing is decrypted; the real profile is never touched (this copy is).
 *
 * Requires: `npm run build` first, and the disposable copy staged by the session. Skips cleanly if the
 * copy is absent so CI (which has no such profile) does not fail.
 */
const PROFILE = '/tmp/claude-501/vessel-b3-test-profile';
const MAIN = path.join(__dirname, '..', 'out', 'main', 'main.dev.js');
const KEYSTORE = path.join(PROFILE, 'keystore.json');

const readSlice = (win: any, field: string) =>
  win.evaluate((f: string) => {
    const root = window.localStorage.getItem('persist:root');
    if (!root) return undefined;
    const slice = JSON.parse(root).keys;
    if (!slice) return undefined;
    return JSON.parse(slice)[f];
  }, field);

test.describe('D9b Stage B — live migration of the real profile copy', () => {
  test.skip(!fs.existsSync(PROFILE), 'disposable real-profile copy not present');

  test('copies every localStorage key record into keystore.json, ciphertext verbatim', async () => {
    if (fs.existsSync(KEYSTORE)) fs.rmSync(KEYSTORE); // exercise a real first migration

    const app = await electron.launch({
      args: [...(process.env.CI ? ['--no-sandbox'] : []), MAIN],
      env: { ...process.env, NODE_ENV: 'production', VESSEL_USER_DATA: PROFILE },
    });
    try {
      const win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');

      const permissions = (await readSlice(win, 'permissions')) || {};
      const removedLegacy: string[] = (await readSlice(win, 'removedLegacy')) || [];
      const expected = Object.keys(permissions).filter((a) => !removedLegacy.includes(a));

      // sanity: the copy really does hold accounts (guards against a vacuous pass)
      expect(expected.length).toBeGreaterThan(0);

      // wait for the rehydration-driven migration to write every account
      await expect
        .poll(
          () => {
            if (!fs.existsSync(KEYSTORE)) return 0;
            return Object.keys(JSON.parse(fs.readFileSync(KEYSTORE, 'utf8')).accounts || {}).length;
          },
          { timeout: 15000 }
        )
        .toBeGreaterThanOrEqual(expected.length);

      const ks = JSON.parse(fs.readFileSync(KEYSTORE, 'utf8'));
      expect(ks.version).toBe(1);

      // every expected account present with BYTE-IDENTICAL ciphertext (never decrypted/re-encrypted)
      for (const account of expected) {
        const src = permissions[account];
        const dst = ks.accounts[account];
        expect(dst, `account ${account} migrated`).toBeTruthy();
        expect(dst.key).toBe(src.key);
        expect(dst.encrypted).toBe(!!src.encrypted);
        expect(dst.type).toBe(src.type);
        if (src.memo !== undefined) expect(dst.memo).toBe(src.memo);
      }

      // tombstoned accounts must NOT leak into main
      for (const account of removedLegacy) {
        expect(ks.accounts[account]).toBeUndefined();
      }

       
      console.log(`[migration test] verified ${expected.length} accounts copied verbatim`);
    } finally {
      await app.close();
    }
  });
});
