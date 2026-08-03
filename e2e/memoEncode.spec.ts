import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import hive from '@hiveio/hive-js';
import { encryptKey } from '../app/utils/keyEnvelope';

/**
 * Phase 3 · D9b Stage B4-2b — reproduce memo encode IN THE REAL ELECTRON MAIN (the vite bundle), which
 * the Node/vitest keystore test cannot: it exercises `hive.memo.encode` inside the packaged main
 * process, reached over the SAME IPC bridge the renderer uses. This is the gap that let a green unit
 * test coexist with a KEYSTORE_ERROR at runtime — memo encode needs crypto primitives (a random nonce +
 * AES) that behave differently in the bundled main than in plain Node.
 *
 * Seeds a THROWAWAY key+memo envelope under its own password directly into keystore.json, so no real
 * key or password is involved and the real profile is never touched.
 *
 * Requires a prior `npm run build`.
 */
const MAIN = path.join(__dirname, '..', 'out', 'main', 'main.dev.js');
const PW = 'e2e-throwaway-wallet-pw';
const SEED = 'vessel-e2e-memo-encode';

test.describe('D9b B4-2b — memo encode runs in the real main process', () => {
  test('encodeMemo produces an encrypted memo in main (no runtime/crypto failure)', async () => {
    const keys = hive.auth.getPrivateKeys(SEED, PW, ['active', 'memo']);
    const memoWif: string = keys.memo;
    const memoPub: string = hive.auth.wifToPublic(memoWif);

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-e2e-memo-'));
    fs.writeFileSync(
      path.join(profile, 'keystore.json'),
      JSON.stringify({
        version: 1,
        accounts: {
          [SEED]: {
            account: SEED,
            key: await encryptKey(keys.active, PW),
            encrypted: true,
            type: 'active',
            memo: await encryptKey(memoWif, PW),
          },
        },
      })
    );

    const app = await electron.launch({
      args: [MAIN],
      env: { ...process.env, NODE_ENV: 'production', VESSEL_USER_DATA: profile },
    });
    const proc = app.process();
    proc.stdout?.on('data', (d) => process.stdout.write(`[main:out] ${d}`));
    proc.stderr?.on('data', (d) => process.stdout.write(`[main:err] ${d}`));
    try {
      const win = await app.firstWindow();
      await win.waitForLoadState('domcontentloaded');

      const result = await win.evaluate(
        async ({ account, password, recipientPub, expectedPub }) => {
          const ks = (window as any).electronAPI?.keystore;
          if (!ks) return { stage: 'bridge', error: 'no keystore bridge' };
          try {
            // (a) pure encode — isolates the main-process crypto runtime
            const noGuard = await ks.encodeMemo(account, password, recipientPub, '#hello vessel');
            // (b) full call shape used by Send.js, incl. the stale-key guard
            const withGuard = await ks.encodeMemo(
              account,
              password,
              recipientPub,
              '#hello vessel',
              expectedPub
            );
            // (c) round-trip back through main to prove it decodes
            const decoded = await ks.decodeMemo(account, password, noGuard);
            return { ok: true, noGuard, withGuard, decoded };
          } catch (e: any) {
            return { ok: false, error: e && e.message ? e.message : String(e) };
          }
        },
        { account: SEED, password: PW, recipientPub: memoPub, expectedPub: memoPub }
      );

      // The load-bearing assertion: main did NOT throw — it produced a real encrypted memo.
      expect(result.error, `encodeMemo failed in main: ${result.error}`).toBeUndefined();
      expect(result.ok).toBe(true);
      expect(result.noGuard.startsWith('#')).toBe(true);
      expect(result.withGuard.startsWith('#')).toBe(true);
      expect(result.noGuard).not.toContain('hello vessel'); // actually encrypted
      expect(result.noGuard).not.toContain(memoWif); // no key material in the returned value
      expect(result.decoded).toBe('#hello vessel'); // round-trips
    } finally {
      await app.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
