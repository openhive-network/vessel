import { describe, it, expect, afterEach } from 'vitest';
import { verifyPasswordInMain } from '../keystoreVerify';

/** Phase 3 · Task 5 — the sign-window password check + self-heal against the main keystore. */
const REC = { account: 'alice', key: '{"v":2,"ct":"..."}', encrypted: true, type: 'active' };

afterEach(() => {
  delete (globalThis as any).window;
});

function withKeystore(ks: any) {
  (globalThis as any).window = { electronAPI: { keystore: ks } };
}

describe('verifyPasswordInMain', () => {
  it('returns true when main verifies on the first try (no heal push)', async () => {
    let pushed = false;
    withKeystore({
      verify: async () => true,
      putEnvelope: async () => {
        pushed = true;
      },
    });
    expect(await verifyPasswordInMain(REC, 'pw')).toBe(true);
    expect(pushed).toBe(false);
  });

  it('self-heals: verify false, then push the envelope and re-verify true (stale main)', async () => {
    let calls = 0;
    const pushed: any[] = [];
    withKeystore({
      verify: async () => {
        calls += 1;
        return calls > 1; // false first, true after the push
      },
      putEnvelope: async (rec: any) => {
        pushed.push(rec);
      },
    });
    expect(await verifyPasswordInMain(REC, 'pw')).toBe(true);
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({ account: 'alice', encrypted: true, type: 'active' });
  });

  it('returns false for a genuinely wrong password (verify false even after heal)', async () => {
    withKeystore({ verify: async () => false, putEnvelope: async () => {} });
    expect(await verifyPasswordInMain(REC, 'wrong')).toBe(false);
  });

  it('falls back to heal when verify throws, and returns false if heal also fails', async () => {
    withKeystore({
      verify: async () => {
        throw new Error('KEYSTORE_ERROR');
      },
      putEnvelope: async () => {
        throw new Error('KEYSTORE_ERROR');
      },
    });
    expect(await verifyPasswordInMain(REC, 'pw')).toBe(false);
  });

  it('returns false with no keystore bridge (non-Electron)', async () => {
    expect(await verifyPasswordInMain(REC, 'pw')).toBe(false);
  });
});
