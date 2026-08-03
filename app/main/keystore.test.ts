import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Keystore } from './keystore';
import { encryptKey } from '../utils/keyEnvelope';
import { hiveAuth } from '../utils/hiveApi';

/**
 * Phase 3 · D9b Stage B (step 1) — additive main-process keystore. These tests run the module in
 * plain Node (no Electron), which is why the storage path is injected. Throwaway credentials only.
 */
const NAME = 'vessel-signing-test';
const PASSWORD = 'P5-throwaway-do-not-use-this-anywhere';
const WALLET_PW = 'wallet-unlock-pw-throwaway';
const SIG_HEX = /^[0-9a-f]{130}$/i;

const keys = hiveAuth.getPrivateKeys(NAME, PASSWORD, ['active', 'memo']);
const ACTIVE_WIF = keys.active;
const MEMO_WIF = keys.memo;
const MEMO_PUB = hiveAuth.wifToPublic(MEMO_WIF);

const FIXED_TX = {
  ref_block_num: 1234,
  ref_block_prefix: 5678901,
  expiration: '2030-01-01T00:00:00',
  operations: [['transfer', { from: 'alice', to: 'bob', amount: '0.001 HIVE', memo: '' }]],
  extensions: [],
};

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-keystore-'));
  file = path.join(dir, 'keystore.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function seedAlice(): Promise<Keystore> {
  const ks = new Keystore(file);
  ks.putRecord({ account: 'alice', key: await encryptKey(ACTIVE_WIF, WALLET_PW), encrypted: true, type: 'active' });
  return ks;
}

describe('main keystore — persistence', () => {
  it('persists a record and reloads it in a fresh instance', async () => {
    await seedAlice();
    const reopened = new Keystore(file);
    expect(reopened.hasAccount('alice')).toBe(true);
    expect(reopened.listAccounts()).toEqual([
      { account: 'alice', encrypted: true, type: 'active', hasMemo: false },
    ]);
  });

  it('starts empty when the file is missing or corrupt', () => {
    fs.writeFileSync(file, 'not json at all');
    const ks = new Keystore(file);
    expect(ks.listAccounts()).toEqual([]);
  });
});

describe('main keystore — no key material escapes', () => {
  it('listAccounts returns metadata only (no key/memo fields)', async () => {
    await seedAlice();
    const [summary] = new Keystore(file).listAccounts();
    expect(summary).not.toHaveProperty('key');
    expect(summary).not.toHaveProperty('memo');
    expect(Object.keys(summary).sort()).toEqual(['account', 'encrypted', 'hasMemo', 'type']);
  });

  it('importKey persists only the envelope; the plaintext WIF is never written to disk', async () => {
    const ks = new Keystore(file);
    await ks.importKey('alice', ACTIVE_WIF, WALLET_PW, 'active');
    const onDisk = fs.readFileSync(file, 'utf8');
    expect(onDisk).not.toContain(ACTIVE_WIF); // at-rest is ciphertext, never the raw key
    expect(ks.listAccounts()[0].encrypted).toBe(true);
    expect(await ks.decryptWif('alice', WALLET_PW)).toBe(ACTIVE_WIF); // still recoverable with the pw
  });
});

describe('main keystore — unlock + sign in main', () => {
  it('decrypts the signing WIF with the right password and rejects the wrong one', async () => {
    const ks = await seedAlice();
    expect(await ks.decryptWif('alice', WALLET_PW)).toBe(ACTIVE_WIF);
    await expect(ks.decryptWif('alice', 'wrong-password')).rejects.toThrow();
  });

  it('signs a fully-formed transaction in main and returns a signed tx (WIF not returned)', async () => {
    const ks = await seedAlice();
    const signed = await ks.signTransaction(FIXED_TX, 'alice', WALLET_PW);
    expect(signed.signatures).toHaveLength(1);
    expect(signed.signatures[0]).toMatch(SIG_HEX);
    expect(JSON.stringify(signed)).not.toContain(ACTIVE_WIF);
  });
});

describe('main keystore — memo custody in main', () => {
  it('round-trips an encrypted memo through the memo key', async () => {
    const ks = new Keystore(file);
    ks.putRecord({
      account: 'alice',
      key: await encryptKey(ACTIVE_WIF, WALLET_PW),
      encrypted: true,
      type: 'active',
      memo: await encryptKey(MEMO_WIF, WALLET_PW),
    });
    expect(ks.listAccounts()[0].hasMemo).toBe(true);

    const encoded = await ks.encodeMemo('alice', WALLET_PW, MEMO_PUB, '#hello vessel');
    expect(encoded.startsWith('#')).toBe(true);
    expect(encoded).not.toContain('hello vessel'); // actually encrypted
    const decoded = await ks.decodeMemo('alice', WALLET_PW, encoded);
    expect(decoded).toBe('#hello vessel');
  });

  it('encodes when the stored memo key matches the expected on-chain pubkey (D9b B4-2b guard)', async () => {
    const ks = new Keystore(file);
    ks.putRecord({
      account: 'alice',
      key: await encryptKey(ACTIVE_WIF, WALLET_PW),
      encrypted: true,
      type: 'active',
      memo: await encryptKey(MEMO_WIF, WALLET_PW),
    });
    // expectedSenderMemoPublic === the memo key's own pubkey -> encodes, and never leaks the memo WIF.
    const encoded = await ks.encodeMemo('alice', WALLET_PW, MEMO_PUB, '#hi', MEMO_PUB);
    expect(encoded.startsWith('#')).toBe(true);
    expect(encoded).not.toContain(MEMO_WIF);
  });

  it('refuses to encode when the stored memo key no longer matches on chain (rotated key)', async () => {
    const ks = new Keystore(file);
    ks.putRecord({
      account: 'alice',
      key: await encryptKey(ACTIVE_WIF, WALLET_PW),
      encrypted: true,
      type: 'active',
      memo: await encryptKey(MEMO_WIF, WALLET_PW),
    });
    const wrongPub = hiveAuth.wifToPublic(ACTIVE_WIF); // a valid pubkey, but not the memo key's
    await expect(ks.encodeMemo('alice', WALLET_PW, MEMO_PUB, '#hi', wrongPub)).rejects.toThrow();
  });
});

describe('main keystore — migrateRecords (Stage B ciphertext copy)', () => {
  it('copies records verbatim and is idempotent (second run skips, file unchanged)', async () => {
    const ks = new Keystore(file);
    const env = await encryptKey(ACTIVE_WIF, WALLET_PW);
    const memoEnv = await encryptKey(MEMO_WIF, WALLET_PW);
    const records = [
      { account: 'alice', key: env, encrypted: true, type: 'active', memo: memoEnv },
      { account: 'bob', key: 'plaintext-wif-placeholder', encrypted: false, type: 'posting' },
    ];

    const first = ks.migrateRecords(records);
    expect(first.migrated.sort()).toEqual(['alice', 'bob']);
    expect(first.skipped).toEqual([]);

    const reopened = new Keystore(file);
    expect(reopened.listAccounts().map((a) => a.account)).toEqual(['alice', 'bob']);
    expect(await reopened.decryptWif('alice', WALLET_PW)).toBe(ACTIVE_WIF); // ciphertext intact

    const before = fs.readFileSync(file, 'utf8');
    const second = ks.migrateRecords(records);
    expect(second.migrated).toEqual([]);
    expect(second.skipped.sort()).toEqual(['alice', 'bob']);
    expect(fs.readFileSync(file, 'utf8')).toBe(before); // idempotent: no rewrite
  });

  it('never overwrites a record main already holds (main-side wins)', async () => {
    const ks = new Keystore(file);
    ks.putRecord({ account: 'alice', key: await encryptKey(ACTIVE_WIF, WALLET_PW), encrypted: true, type: 'active' });
    const res = ks.migrateRecords([{ account: 'alice', key: 'DIFFERENT', encrypted: false, type: 'owner' }]);
    expect(res.migrated).toEqual([]);
    expect(res.skipped).toEqual(['alice']);
    expect(await ks.decryptWif('alice', WALLET_PW)).toBe(ACTIVE_WIF); // original untouched
  });

  it('drops malformed records (missing account or key)', () => {
    const ks = new Keystore(file);
    const res = ks.migrateRecords([
      { account: '', key: 'x', encrypted: false, type: 'active' } as any,
      { account: 'nokey', encrypted: false, type: 'active' } as any,
    ]);
    expect(res.migrated).toEqual([]);
    expect(ks.listAccounts()).toEqual([]);
  });
});

describe('main keystore — Stage B hardening (review follow-ups)', () => {
  it('importKey refuses to overwrite an existing account (F2)', async () => {
    const ks = await seedAlice();
    await expect(ks.importKey('alice', ACTIVE_WIF, WALLET_PW, 'active')).rejects.toThrow();
    expect(await ks.decryptWif('alice', WALLET_PW)).toBe(ACTIVE_WIF); // original untouched
  });

  it('importKey rejects an invalid WIF (F5)', async () => {
    const ks = new Keystore(file);
    await expect(ks.importKey('bob', 'not-a-valid-wif', WALLET_PW, 'active')).rejects.toThrow();
    expect(ks.hasAccount('bob')).toBe(false);
  });

  it('importKey stores a valid WIF as an envelope', async () => {
    const ks = new Keystore(file);
    await ks.importKey('carol', ACTIVE_WIF, WALLET_PW, 'active');
    expect(ks.listAccounts()[0]).toMatchObject({ account: 'carol', encrypted: true });
    expect(await ks.decryptWif('carol', WALLET_PW)).toBe(ACTIVE_WIF);
  });

  it('rejects unsafe account names and never pollutes the prototype (F4)', () => {
    const ks = new Keystore(file);
    expect(() =>
      ks.putRecord({ account: '__proto__', key: 'x', encrypted: false, type: 'active' })
    ).toThrow();
    const res = ks.migrateRecords([
      { account: '__proto__', key: 'x', encrypted: false, type: 'active' },
      { account: 'constructor', key: 'y', encrypted: false, type: 'active' },
    ]);
    expect(res.migrated).toEqual([]);
    expect(ks.listAccounts()).toEqual([]);
    expect(({} as any).x).toBeUndefined(); // no prototype pollution
  });

  it('pruneAccounts removes tombstoned accounts and leaves others (F1)', async () => {
    const ks = new Keystore(file);
    ks.putRecord({ account: 'alice', key: await encryptKey(ACTIVE_WIF, WALLET_PW), encrypted: true, type: 'active' });
    ks.putRecord({ account: 'bob', key: await encryptKey(ACTIVE_WIF, WALLET_PW), encrypted: true, type: 'active' });
    const removed = ks.pruneAccounts(['bob', 'never-existed']);
    expect(removed).toEqual(['bob']);
    expect(ks.listAccounts().map((a) => a.account)).toEqual(['alice']);
    expect(new Keystore(file).hasAccount('bob')).toBe(false); // persisted
  });
});

describe('main keystore — verify (D9b B4-2: password check, no key material)', () => {
  it('returns true for the right password, false for the wrong one — a boolean, never the WIF', async () => {
    const ks = await seedAlice();
    const ok = await ks.verify('alice', WALLET_PW);
    expect(ok).toBe(true);
    expect(typeof ok).toBe('boolean'); // no key material can ride out on a boolean
    expect(await ks.verify('alice', 'wrong-password')).toBe(false);
  });

  it('returns false for an unknown account (no throw)', async () => {
    expect(await new Keystore(file).verify('nobody', WALLET_PW)).toBe(false);
  });
});

describe('main keystore — putEnvelope (D9b B4-2: self-heal sync from the renderer)', () => {
  it('inserts a missing record from a ciphertext envelope', async () => {
    const ks = new Keystore(file);
    ks.putEnvelope({ account: 'alice', key: await encryptKey(ACTIVE_WIF, WALLET_PW), encrypted: true, type: 'active' });
    expect(await ks.verify('alice', WALLET_PW)).toBe(true);
  });

  it('OVERWRITES a stale record (unlike migrateRecords) so a re-imported password re-validates', async () => {
    const ks = await seedAlice(); // envelope bound to WALLET_PW
    const NEW_PW = 'a-different-wallet-password-throwaway';
    ks.putEnvelope({ account: 'alice', key: await encryptKey(ACTIVE_WIF, NEW_PW), encrypted: true, type: 'active' });
    expect(await ks.verify('alice', NEW_PW)).toBe(true); // new envelope took effect
    expect(await ks.verify('alice', WALLET_PW)).toBe(false); // old password no longer unlocks
    expect(await ks.decryptWif('alice', NEW_PW)).toBe(ACTIVE_WIF); // same key, re-wrapped
  });

  it('refuses a plaintext / non-envelope key — no bare WIF may be stashed in main', async () => {
    const ks = new Keystore(file);
    expect(() =>
      ks.putEnvelope({ account: 'mallory', key: ACTIVE_WIF, encrypted: false, type: 'active' })
    ).toThrow();
    expect(() =>
      ks.putEnvelope({ account: 'mallory', key: 'not-an-envelope', encrypted: true, type: 'active' })
    ).toThrow();
    expect(ks.hasAccount('mallory')).toBe(false);
  });

  it('refuses unsafe account names (F4)', async () => {
    const ks = new Keystore(file);
    const env = await encryptKey(ACTIVE_WIF, WALLET_PW);
    expect(() => ks.putEnvelope({ account: '__proto__', key: env, encrypted: true, type: 'active' })).toThrow();
    expect(({} as any).account).toBeUndefined();
  });
});

describe('main keystore — no WIF crosses the main->renderer boundary (D9b B4-2 contract)', () => {
  it('no value returned to the renderer carries a WIF; verify yields only a boolean', async () => {
    const ks = new Keystore(file);
    ks.putRecord({
      account: 'alice',
      key: await encryptKey(ACTIVE_WIF, WALLET_PW),
      encrypted: true,
      type: 'active',
      memo: await encryptKey(MEMO_WIF, WALLET_PW),
    });
    const carries = (v: unknown, secret: string) => JSON.stringify(v ?? null).includes(secret);

    // Every value an IPC handler can return to the renderer must be free of key material:
    const verified = await ks.verify('alice', WALLET_PW);
    expect(verified).toBe(true);
    expect(carries(verified, ACTIVE_WIF)).toBe(false);

    const summaries = ks.listAccounts();
    expect(carries(summaries, ACTIVE_WIF)).toBe(false);
    expect(carries(summaries, MEMO_WIF)).toBe(false);

    const signed = await ks.signTransaction(FIXED_TX, 'alice', WALLET_PW);
    expect(signed.signatures[0]).toMatch(SIG_HEX);
    expect(carries(signed, ACTIVE_WIF)).toBe(false);

    const encoded = await ks.encodeMemo('alice', WALLET_PW, MEMO_PUB, '#secret memo');
    expect(carries(encoded, MEMO_WIF)).toBe(false);
    const decoded = await ks.decodeMemo('alice', WALLET_PW, encoded);
    expect(carries(decoded, MEMO_WIF)).toBe(false);

    // Belt-and-braces: at rest is ciphertext, never the raw keys.
    const onDisk = fs.readFileSync(file, 'utf8');
    expect(onDisk).not.toContain(ACTIVE_WIF);
    expect(onDisk).not.toContain(MEMO_WIF);
  });
});
