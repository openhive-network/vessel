/**
 * Phase 1 · THE decisive three-layer round-trip (spec §10.2 case 10).
 *
 * Proves an existing shipped wallet survives the whole Phase-1 pipeline:
 *   layer 1 (storage) — migrate reduxPersist:keys -> persist:root
 *   layer 3 (ciphertext) — the shipped crypto-js blob still decrypts after the move
 *   re-encrypt to the v2 envelope, then a REAL redux-persist rehydration (transform + stub reducer)
 *   layer 2 (slice shape) — the rehydrated record keeps {account,key,encrypted,type,memo}
 *   ...and still unlocks, with no cleartext WIF left in persist:root and the legacy blob untouched.
 *
 * Pure: migration + envelope + transform + redux/redux-persist. No legacy .js, no jsdom.
 */
import { createStore, combineReducers } from 'redux';
import { persistStore, persistReducer } from 'redux-persist';
import {
  migrateLegacyKeystore,
  LEGACY_KEYS_KEY,
  ROOT_KEY,
  KVStorage,
} from '../legacyKeystoreMigration';
import { keysSurfaceTransform } from '../keysPersistTransform';
import { decryptKey, encryptKey, WrongPasswordError } from '../../utils/keyEnvelope';

// THROWAWAY vectors. ENC_LEGACY_A is a REAL crypto-js output — CryptoJS.AES.encrypt(WIF_A, PW).
const WIF_A = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
const WIF_PLAIN = '5KJvsngHeMpm884wtkJNzQGaCErckhHJBGFsvd3VyK5qMZXj3hS';
const WIF_MEMO = '5JYkZjmurxXsRznfkVSRV8DsHyp8mUvfKif2XG09ZDrGyc699GG';
const PW = 'correct horse battery staple';
const ENC_LEGACY_A =
  'U2FsdGVkX1++++GJvAFPd7c8L8al6eizV3eoMxyn4Teauq+I4ATgDFaIACOM9YiUpdJWMtAs9xIRUeW5L8bcHAypSzUUThTSrEwsHW0RL2M=';

interface Fake extends KVStorage {
  dump(): Record<string, string>;
}
const makeFake = (seed: Record<string, string>): Fake => {
  const m = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
    key: (i) => {
      const ks = [...m.keys()];
      return i >= 0 && i < ks.length ? ks[i] : null;
    },
    get length() {
      return m.size;
    },
    dump: () => Object.fromEntries(m),
  };
};

// redux-persist storage is async — wrap the sync fake.
const asyncStorage = (fake: Fake) => ({
  getItem: (k: string) => Promise.resolve(fake.getItem(k)),
  setItem: (k: string, v: string) => Promise.resolve(fake.setItem(k, v)),
  removeItem: (k: string) => Promise.resolve(fake.removeItem(k)),
});

// pass-through stub — NEVER the legacy Flow reducer (which cannot be imported here).
const stubKeysReducer = (state = { names: [], permissions: {} }) => state;

const readSlice = (fake: Fake) => JSON.parse(JSON.parse(fake.getItem(ROOT_KEY) as string).keys);

describe('three-layer round trip (the decisive keystore test)', () => {
  it('a shipped wallet migrates, decrypts, re-encrypts, and still unlocks after restart', async () => {
    const fake = makeFake({
      [LEGACY_KEYS_KEY]: JSON.stringify({
        names: ['alice', 'bob'],
        permissions: {
          alice: { account: 'alice', key: ENC_LEGACY_A, encrypted: true, type: 'active', memo: WIF_MEMO },
          bob: { account: 'bob', key: WIF_PLAIN, encrypted: false, type: 'posting' },
        },
      }),
      [ROOT_KEY]: JSON.stringify({
        keys: JSON.stringify({ names: [], permissions: {} }), // the WIP empty-wallet artifact
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    });

    // (a) LAYER 1 — migrate
    expect(migrateLegacyKeystore(fake).status).toBe('migrated');
    const slice = readSlice(fake);
    expect(slice.names).toEqual(['alice', 'bob']);
    expect(slice.permissions.alice.key).toBe(ENC_LEGACY_A); // ciphertext moved verbatim

    // (b) LAYER 3 — the shipped crypto-js ciphertext decrypts after the move
    expect(await decryptKey(slice.permissions.alice.key, PW)).toBe(WIF_A);
    // (c) wrong password rejected
    await expect(decryptKey(slice.permissions.alice.key, 'nope')).rejects.toBeInstanceOf(
      WrongPasswordError,
    );

    // (d) re-encrypt to the v2 envelope, written back through the same double-serialization
    const newKey = await encryptKey(WIF_A, PW);
    const newMemo = await encryptKey(WIF_MEMO, PW);
    const outer = JSON.parse(fake.getItem(ROOT_KEY) as string);
    const inner = JSON.parse(outer.keys);
    inner.permissions.alice = {
      ...inner.permissions.alice,
      key: newKey,
      encrypted: true,
      memo: newMemo,
    };
    outer.keys = JSON.stringify(inner);
    fake.setItem(ROOT_KEY, JSON.stringify(outer));

    // (e) SIMULATED RESTART — a real redux-persist store over the fake storage + the transform
    const store = createStore(
      persistReducer(
        {
          key: 'root',
          storage: asyncStorage(fake),
          whitelist: ['keys'],
          transforms: [keysSurfaceTransform],
        },
        combineReducers({ keys: stubKeysReducer }),
      ),
    );
    let persistor: any = null;
    await new Promise<void>((resolve) => {
      persistor = persistStore(store, null, () => resolve());
    });

    const rehydrated: any = (store.getState() as any).keys;
    expect(rehydrated.names).toEqual(['alice', 'bob']);
    // LAYER 2 — record shape preserved
    expect(Object.keys(rehydrated.permissions.alice).sort()).toEqual([
      'account',
      'encrypted',
      'key',
      'memo',
      'type',
    ]);
    // the v2 envelopes rehydrated and STILL unlock after restart
    expect(rehydrated.permissions.alice.key).toBe(newKey);
    expect(await decryptKey(rehydrated.permissions.alice.key, PW)).toBe(WIF_A);
    expect(await decryptKey(rehydrated.permissions.alice.memo, PW)).toBe(WIF_MEMO);

    // (f) NO cleartext at rest — alice's WIF/memo never appear in persist:root
    const rootStr = fake.getItem(ROOT_KEY) as string;
    expect(rootStr).not.toContain(WIF_A);
    expect(rootStr).not.toContain(WIF_MEMO);

    // (g) the legacy blob is permanent + byte-identical (I-4 rollback)
    expect(fake.getItem(LEGACY_KEYS_KEY)).toContain(ENC_LEGACY_A);

    persistor.pause(); // stop redux-persist's timer so Jest exits cleanly
  }, 30000);
});
