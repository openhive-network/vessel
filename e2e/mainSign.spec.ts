import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import hive from '@hiveio/hive-js';
import { encryptKey } from '../app/utils/keyEnvelope';

/**
 * Phase 3 · D9b Stage B4 — SIGNING in the real Electron main process. Companion to memoEncode.spec:
 * seeds a THROWAWAY key into a temp-profile keystore.json, launches the built app, and signs a
 * fully-formed transaction via `window.electronAPI.keystore.sign` over IPC. It asserts main produces a
 * valid signature AND that it is BYTE-IDENTICAL to the same key signing the same tx locally (hive-js is
 * deterministic — RFC6979 — so main-signed must equal local-signed for the same chain_id). This proves
 * the money-path signing works in the real main runtime without any manual test.
 *
 * SAFE TO AUTO-RUN: it signs locally in main and NEVER broadcasts — no network, no funds, throwaway key.
 * Requires a prior `npm run build`.
 */
const MAIN = path.join(__dirname, '..', 'out', 'main', 'main.dev.js');
const PW = 'e2e-throwaway-wallet-pw';
const SEED = 'vessel-e2e-main-sign';
// Hive mainnet chain id — set identically on both sides so the digests (and thus signatures) match.
const CHAIN_ID = 'beeab0de00000000000000000000000000000000000000000000000000000000';
const SIG_HEX = /^[0-9a-f]{130}$/i;

const TX = {
  ref_block_num: 1234,
  ref_block_prefix: 5678901,
  expiration: '2030-01-01T00:00:00',
  operations: [['transfer', { from: 'alice', to: 'bob', amount: '0.001 HIVE', memo: '' }]],
  extensions: [],
};

test.describe('D9b B4 — transaction signing runs in the real main process', () => {
  test('signs a tx in main with a valid signature, byte-identical to local signing (no broadcast)', async () => {
    const activeWif: string = hive.auth.getPrivateKeys(SEED, PW, ['active']).active;
    // hive-js signTransaction MUTATES its tx (attaches `signatures`), so sign a fresh clone each time.
    const freshTx = () => JSON.parse(JSON.stringify(TX));

    // Expected signature: the same key signing the same tx locally, under the same chain id.
    hive.config.set('chain_id', CHAIN_ID);
    const expectedSig: string = hive.auth.signTransaction(freshTx(), { active: activeWif })
      .signatures[0];
    expect(expectedSig).toMatch(SIG_HEX);

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-e2e-sign-'));
    fs.writeFileSync(
      path.join(profile, 'keystore.json'),
      JSON.stringify({
        version: 1,
        accounts: {
          [SEED]: { account: SEED, key: await encryptKey(activeWif, PW), encrypted: true, type: 'active' },
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
        async ({ account, password, chainId, tx }) => {
          const ks = (window as any).electronAPI?.keystore;
          if (!ks) return { error: 'no keystore bridge' };
          try {
            await ks.setChainConfig(chainId); // main defaults to mainnet; be explicit for parity
            const signed = await ks.sign(account, tx, password);
            return { ok: true, signatures: signed.signatures };
          } catch (e: any) {
            return { error: e && e.message ? e.message : String(e) };
          }
        },
        { account: SEED, password: PW, chainId: CHAIN_ID, tx: freshTx() }
      );

      expect(result.error, `sign failed in main: ${result.error}`).toBeUndefined();
      expect(result.ok).toBe(true);
      expect(result.signatures).toHaveLength(1);
      expect(result.signatures[0]).toMatch(SIG_HEX); // main produced a real signature
      expect(result.signatures[0]).toBe(expectedSig); // ...byte-identical to local signing (deterministic)
      // the WIF must never ride back out on the signed tx
      expect(JSON.stringify(result.signatures)).not.toContain(activeWif);
    } finally {
      await app.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
});
