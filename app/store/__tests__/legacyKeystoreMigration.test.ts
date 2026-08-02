/**
 * Phase 1 · Task 0 tests — the v4->v6 migration (crown jewel), spec §10.2 cases 1-9
 * plus the removal-tombstone (13.3) and gated settings carry-over (A6/C3).
 * The three-layer crypto round-trip (case 10) lands in Commit C once the envelope exists.
 *
 * Pure: imports ONLY the migration module + a Map-backed KVStorage fake (no jsdom, no legacy .js).
 */
import {
  migrateLegacyKeystore,
  LEGACY_KEYS_KEY,
  ROOT_KEY,
  BACKUP_PREFIX,
  KVStorage,
} from '../legacyKeystoreMigration';

// THROWAWAY vectors — opaque strings; the migration never decrypts. NEVER use real keys.
const ENC_LEGACY_A = 'U2FsdGVkX19throwaway0ciphertext0alice==';
const WIF_PLAIN = '5KJvsngHeMpm884wtkJNzQGaCErckhHJBGFsvd3VyK5qMZXj3hS'; // throwaway
const WIF_MEMO = '5JYkZjmurxXsRznfkVSRV8DsHyp8mUvfKif2XG09ZDrGyc699GG'; // throwaway

interface FakeStorage extends KVStorage {
  dump(): Record<string, string>;
  writes: Array<[string, string]>;
  removes: string[];
}

const makeFakeStorage = (seed: Record<string, string> = {}): FakeStorage => {
  const m = new Map<string, string>(Object.entries(seed));
  const writes: Array<[string, string]> = [];
  const removes: string[] = [];
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      m.set(k, v);
      writes.push([k, v]);
    },
    removeItem: (k) => {
      m.delete(k);
      removes.push(k);
    },
    key: (i) => {
      const ks = [...m.keys()];
      return i >= 0 && i < ks.length ? ks[i] : null;
    },
    get length() {
      return m.size;
    },
    dump: () => Object.fromEntries(m),
    writes,
    removes,
  };
};

const CLOCK = () => new Date('2026-08-02T12:00:00.000Z'); // deterministic backup key

const aliceV4 = { account: 'alice', key: ENC_LEGACY_A, encrypted: true, type: 'active', memo: WIF_MEMO };
const bobV4 = { account: 'bob', key: WIF_PLAIN, encrypted: false, type: 'posting' };
const legacyBlob = (perms: Record<string, unknown> = { alice: aliceV4, bob: bobV4 }) =>
  JSON.stringify({ names: Object.keys(perms), permissions: perms });

const v6Root = (keysSlice: unknown, extra: Record<string, string> = {}) =>
  JSON.stringify({
    keys: JSON.stringify(keysSlice),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
    ...extra,
  });
const emptyV6 = () => v6Root({ names: [], permissions: {} });

const seeded = (over: Record<string, string> = {}) =>
  makeFakeStorage({
    [LEGACY_KEYS_KEY]: legacyBlob(),
    'reduxPersist:account': '{"updated":false,"accounts":{}}',
    'reduxPersist:steem': '{"names":[]}',
    [ROOT_KEY]: emptyV6(),
    ...over,
  });

const readKeysSlice = (s: FakeStorage) => JSON.parse(JSON.parse(s.getItem(ROOT_KEY) as string).keys);
const backupKeys = (s: FakeStorage) => Object.keys(s.dump()).filter((k) => k.startsWith(BACKUP_PREFIX));

describe('migrateLegacyKeystore', () => {
  it('1 — per-account merge over an empty v6 slice (the real bug)', () => {
    const s = seeded();
    const r = migrateLegacyKeystore(s, CLOCK);
    expect(r.status).toBe('migrated');
    expect(r.copiedAccounts.sort()).toEqual(['alice', 'bob']);
    const slice = readKeysSlice(s);
    expect(slice.names).toEqual(['alice', 'bob']);
    expect(slice.permissions.alice).toEqual(aliceV4); // verbatim incl. ciphertext + memo
    expect(slice.permissions.bob).toEqual(bobV4);
    expect(slice.isUser).toBe(true);
    // _persist preserved verbatim
    // eslint-disable-next-line no-underscore-dangle
    expect(JSON.parse(s.getItem(ROOT_KEY) as string)._persist).toBe(
      JSON.stringify({ version: -1, rehydrated: true }),
    );
  });

  it('2 — sanitized backup taken before the root write', () => {
    const s = seeded();
    migrateLegacyKeystore(s, CLOCK);
    const bks = backupKeys(s);
    expect(bks).toHaveLength(1);
    // 13.2: backup is the SANITIZED pre-migration keys slice, not the raw root
    expect(JSON.parse(s.dump()[bks[0]])).toEqual({
      names: [],
      permissions: {},
      isUser: false,
      removedLegacy: [],
    });
    // backup write precedes the root write
    const idxBackup = s.writes.findIndex(([k]) => k.startsWith(BACKUP_PREFIX));
    const idxRoot = s.writes.findIndex(([k]) => k === ROOT_KEY);
    expect(idxBackup).toBeGreaterThanOrEqual(0);
    expect(idxBackup).toBeLessThan(idxRoot);
  });

  it('3 — non-destructive: every reduxPersist:* is byte-identical afterwards', () => {
    const s = seeded();
    const before = {
      keys: s.getItem(LEGACY_KEYS_KEY),
      account: s.getItem('reduxPersist:account'),
      steem: s.getItem('reduxPersist:steem'),
    };
    migrateLegacyKeystore(s, CLOCK);
    expect(s.getItem(LEGACY_KEYS_KEY)).toBe(before.keys);
    expect(s.getItem('reduxPersist:account')).toBe(before.account);
    expect(s.getItem('reduxPersist:steem')).toBe(before.steem);
  });

  it('4 — idempotent: second run is noop-all-present with zero writes', () => {
    const s = seeded();
    migrateLegacyKeystore(s, CLOCK);
    const dumpAfterFirst = JSON.stringify(s.dump());
    const s2 = makeFakeStorage(s.dump()); // fresh spies
    const r2 = migrateLegacyKeystore(s2, CLOCK);
    expect(r2.status).toBe('noop-all-present');
    expect(s2.writes).toHaveLength(0);
    expect(s2.removes).toHaveLength(0);
    expect(JSON.stringify(s2.dump())).toBe(dumpAfterFirst);
  });

  it('5 — union never overwrites a populated v6 record', () => {
    const s = seeded({
      [ROOT_KEY]: v6Root({
        names: ['alice', 'carol'],
        permissions: {
          alice: { account: 'alice', key: 'v6-different-ciphertext', encrypted: true, type: 'active' },
          carol: { account: 'carol', key: 'carol-ciphertext', encrypted: true, type: 'active' },
        },
      }),
    });
    const r = migrateLegacyKeystore(s, CLOCK);
    expect(r.status).toBe('migrated');
    expect(r.copiedAccounts).toEqual(['bob']);
    const slice = readKeysSlice(s);
    expect(slice.permissions.alice.key).toBe('v6-different-ciphertext'); // v6 wins
    expect(slice.permissions.carol.key).toBe('carol-ciphertext'); // untouched
    expect(slice.permissions.bob).toEqual(bobV4); // copied
    expect(slice.names).toEqual(['alice', 'bob', 'carol']);
  });

  it('6 — a keyless v6 stub is repaired from v4', () => {
    const s = seeded({
      [ROOT_KEY]: v6Root({ names: ['alice'], permissions: { alice: { account: 'alice' } } }),
    });
    const r = migrateLegacyKeystore(s, CLOCK);
    expect(r.status).toBe('migrated');
    expect(readKeysSlice(s).permissions.alice).toEqual(aliceV4);
  });

  it('7 — no-op cases write nothing', () => {
    // absent legacy
    const a = makeFakeStorage({ [ROOT_KEY]: emptyV6() });
    expect(migrateLegacyKeystore(a, CLOCK).status).toBe('no-legacy');
    expect(a.writes).toHaveLength(0);
    // empty permissions
    const b = makeFakeStorage({ [LEGACY_KEYS_KEY]: JSON.stringify({ names: [], permissions: {} }) });
    expect(migrateLegacyKeystore(b, CLOCK).status).toBe('legacy-empty');
    expect(b.writes).toHaveLength(0);
    // corrupt legacy JSON
    const c = makeFakeStorage({ [LEGACY_KEYS_KEY]: '{not json' });
    expect(migrateLegacyKeystore(c, CLOCK).status).toBe('legacy-unparseable');
    expect(c.writes).toHaveLength(0);
  });

  it('8 — absent persist:root: migrated with backupKey null and a fresh root', () => {
    const s = makeFakeStorage({ [LEGACY_KEYS_KEY]: legacyBlob() });
    const r = migrateLegacyKeystore(s, CLOCK);
    expect(r.status).toBe('migrated');
    expect(r.backupKey).toBeNull();
    expect(backupKeys(s)).toHaveLength(0);
    expect(readKeysSlice(s).names).toEqual(['alice', 'bob']);
  });

  it('9 — corrupt persist:root: rebuilt with rootRecovered, corrupt raw backed up', () => {
    const s = seeded({ [ROOT_KEY]: '{not json' });
    const r = migrateLegacyKeystore(s, CLOCK);
    expect(r.status).toBe('migrated');
    expect(r.rootRecovered).toBe(true);
    const bks = backupKeys(s);
    expect(bks).toHaveLength(1);
    expect(s.dump()[bks[0]]).toBe('{not json'); // raw corrupt value preserved
    expect(readKeysSlice(s).names).toEqual(['alice', 'bob']);
  });

  it('13.3 — a tombstoned (removed) legacy account is never resurrected', () => {
    const s = seeded({
      [ROOT_KEY]: v6Root({ names: ['alice'], permissions: { alice: aliceV4 }, removedLegacy: ['bob'] }),
    });
    const r = migrateLegacyKeystore(s, CLOCK);
    // alice already present-with-data, bob tombstoned -> nothing to do
    expect(r.status).toBe('noop-all-present');
    expect(readKeysSlice(s).permissions.bob).toBeUndefined();
    expect(readKeysSlice(s).names).toEqual(['alice']);
  });

  it('13.3b — tombstone is preserved through a real merge', () => {
    // alice absent in v6 (fresh), bob tombstoned -> alice copied, bob stays gone, tombstone kept
    const s = seeded({
      [ROOT_KEY]: v6Root({ names: [], permissions: {}, removedLegacy: ['bob'] }),
    });
    const r = migrateLegacyKeystore(s, CLOCK);
    expect(r.status).toBe('migrated');
    expect(r.copiedAccounts).toEqual(['alice']);
    const slice = readKeysSlice(s);
    expect(slice.permissions.bob).toBeUndefined();
    expect(slice.removedLegacy).toEqual(['bob']);
  });

  it('A6/C3 — carries a customized non-key sibling into a fresh v6, never overwrites a populated one', () => {
    const customPrefs = '{"hived_node":"https://my.custom.node","contacts":{"x":"@ex"}}';
    // fresh v6 (empty keys) + default v6 preferences -> carry the v4 custom prefs
    const carry = seeded({ 'reduxPersist:preferences': customPrefs });
    migrateLegacyKeystore(carry, CLOCK);
    const outer = JSON.parse(carry.getItem(ROOT_KEY) as string);
    expect(JSON.parse(outer.preferences)).toEqual(JSON.parse(customPrefs));
    expect(carry.getItem('reduxPersist:preferences')).toBe(customPrefs); // source untouched

    // populated v6 preferences (user already set a node in v6) -> NOT overwritten
    const keep = seeded({
      'reduxPersist:preferences': customPrefs,
      [ROOT_KEY]: v6Root({ names: [], permissions: {} }, {
        preferences: JSON.stringify({ hived_node: 'https://v6.node' }),
      }),
    });
    migrateLegacyKeystore(keep, CLOCK);
    expect(JSON.parse(JSON.parse(keep.getItem(ROOT_KEY) as string).preferences)).toEqual({
      hived_node: 'https://v6.node',
    });
  });

  it('A6/C3 — settings are NOT carried when v6 already has keys (v6 in real use)', () => {
    const s = seeded({
      'reduxPersist:preferences': '{"hived_node":"https://my.custom.node"}',
      [ROOT_KEY]: v6Root({
        names: ['carol'],
        permissions: { carol: { account: 'carol', key: 'c', encrypted: true, type: 'active' } },
      }),
    });
    migrateLegacyKeystore(s, CLOCK);
    // v6 had a key -> not a fresh rescue -> preferences slice absent from root (never carried)
    expect(JSON.parse(s.getItem(ROOT_KEY) as string).preferences).toBeUndefined();
  });
});
