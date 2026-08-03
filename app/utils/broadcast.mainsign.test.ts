import { describe, it, expect, afterEach } from 'vitest';
import { signTx } from './broadcast';
import { hiveAuth } from './hiveApi';

/**
 * Phase 3 · D9b Stage B4 — the signer-routing seam. A raw WIF signs locally; a main-custody signer
 * routes to the main-process keystore over IPC, and falls back to the local WIF when main fails
 * (unavailable, or stale ciphertext after a password change). Throwaway credentials only.
 */
const WIF = hiveAuth.getPrivateKeys(
  'vessel-signing-test',
  'P5-throwaway-do-not-use-this-anywhere',
  ['active']
).active;
const SIG_HEX = /^[0-9a-f]{130}$/i;

const TX = {
  ref_block_num: 1,
  ref_block_prefix: 2,
  expiration: '2030-01-01T00:00:00',
  operations: [['account_witness_vote', { account: 'alice', witness: 'w', approve: true }]],
  extensions: [],
};

afterEach(() => {
  delete (globalThis as any).window;
});

describe('signTx — signer routing (D9b B4)', () => {
  it('signs locally for a raw WIF', async () => {
    const signed = await signTx(TX, 'active', WIF);
    expect(signed.signatures[0]).toMatch(SIG_HEX);
  });

  it('routes to the main keystore for a main signer (and syncs chain config)', async () => {
    const calls: any = {};
    (globalThis as any).window = {
      electronAPI: {
        keystore: {
          setChainConfig: async () => {
            calls.cfg = true;
          },
          sign: async (account: string, tx: any, password: string) => {
            calls.sign = { account, password };
            return { ...tx, signatures: ['MAINSIG'] };
          },
        },
      },
    };
    const signed = await signTx(TX, 'active', { account: 'alice', password: 'pw', wif: WIF });
    expect(calls.cfg).toBe(true);
    expect(calls.sign).toEqual({ account: 'alice', password: 'pw' });
    expect(signed.signatures).toEqual(['MAINSIG']); // main signed — not the local key
  });

  it('falls back to the local WIF when main signing throws', async () => {
    (globalThis as any).window = {
      electronAPI: {
        keystore: {
          setChainConfig: async () => {},
          sign: async () => {
            throw new Error('WRONG_PASSWORD');
          },
        },
      },
    };
    const signed = await signTx(TX, 'active', { account: 'alice', password: 'pw', wif: WIF });
    expect(signed.signatures[0]).toMatch(SIG_HEX); // real local signature produced as fallback
  });

  it('signs with the local WIF when no keystore bridge is present (non-Electron)', async () => {
    const signed = await signTx(TX, 'active', { account: 'alice', password: 'pw', wif: WIF });
    expect(signed.signatures[0]).toMatch(SIG_HEX);
  });
});
