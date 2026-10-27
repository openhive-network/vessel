import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { configureStore } from '@reduxjs/toolkit';
import keysReducer from '../../reducers/keys';
import { adoptMainEnvelope, addKeyConfirmed } from '../../actions/keys';
import { migrateLegacyKeystore, LEGACY_KEYS_KEY, ROOT_KEY, BACKUP_PREFIX, type KVStorage } from '../legacyKeystoreMigration';
import { buildMigrationRecords } from '../keystoreMainMigration';
import { Keystore } from '../../main/keystore';
import { verifyPasswordInMain } from '../../utils/keystoreVerify';
import { signTx } from '../../utils/broadcast';
import { decryptKey, isEnvelopeV2, needsReencrypt } from '../../utils/keyEnvelope';
import { hiveAuth } from '../../utils/hiveApi';
import {
  LEGACY_ACCOUNT,
  LEGACY_ACTIVE_CIPHERTEXT,
  LEGACY_ACTIVE_WIF,
  LEGACY_MEMO_CIPHERTEXT,
  LEGACY_MEMO_WIF,
  LEGACY_PASSWORD,
  LEGACY_RECORD,
} from '../../utils/__tests__/legacyCryptoJs.fixture';

/**
 * A wallet written by the shipped app (real crypto-js 3.3.0 ciphertext) goes through the whole renderer
 * <-> main path: v4 -> v6 storage migration, the ciphertext copy into main, an unlock in main, and the
 * renderer adopting main's v2 envelope. Main runs in-process behind a bridge shaped like the preload's;
 * every value the bridge hands back to the renderer is recorded, so the test can assert no WIF crossed.
 */
const BOB = 'vessel-other-account';
const BOB_RECORD = { account: BOB, key: 'U2FsdGVkX1+bob0other0legacy0blob0kept0as0is==', encrypted: true, type: 'active' };
const LEGACY_MARKER = 'U2FsdGVkX1';

const makeStorage = (seed: Record<string, string>): KVStorage & { dump(): Record<string, string> } => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    dump: () => Object.fromEntries(m),
  };
};

const v4Slice = (records: Record<string, unknown>) =>
  JSON.stringify({ names: Object.keys(records), permissions: records });
const v6Root = (records: Record<string, unknown>) =>
  JSON.stringify({ keys: JSON.stringify({ names: Object.keys(records), permissions: records, isUser: true, removedLegacy: [] }) });

/** Everything the renderer persisted that names the legacy account, flattened to one string per key. */
const legacyLeftovers = (storage: ReturnType<typeof makeStorage>): string[] =>
  Object.entries(storage.dump())
    .filter(([, v]) => v.includes(LEGACY_ACTIVE_CIPHERTEXT) || v.includes(LEGACY_MEMO_CIPHERTEXT))
    .map(([k]) => k);

let dir: string;
let keystoreFile: string;
let returned: unknown[];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-legacy-upgrade-'));
  keystoreFile = path.join(dir, 'keystore.json');
  returned = [];
});

afterEach(() => {
  delete (globalThis as any).window;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A renderer window whose keystore bridge calls an in-process main Keystore, recording its replies. */
function mountRenderer(storage: KVStorage) {
  const keystore = new Keystore(keystoreFile);
  const bridge = new Proxy(
    {},
    {
      get: (_t, method: string) => async (...args: unknown[]) => {
        const fn = method === 'sign' ? (a: string, tx: unknown, pw: string) => keystore.signTransaction(tx, a, pw) : (keystore as any)[method];
        const value = await (method === 'setChainConfig' ? Keystore.setChainConfig(...(args as [string, string])) : fn.apply(keystore, args));
        returned.push(value);
        return value;
      },
    }
  );
  (globalThis as any).window = { electronAPI: { keystore: bridge }, localStorage: storage };

  migrateLegacyKeystore(storage);
  const root = JSON.parse(storage.getItem(ROOT_KEY) as string);
  const store = configureStore({ reducer: { keys: keysReducer }, preloadedState: { keys: JSON.parse(root.keys) } });
  keystore.migrateRecords(buildMigrationRecords(store.getState().keys));
  return { store, keystore };
}

const assertNoWifReturned = () => {
  const replies = JSON.stringify(returned);
  expect(replies).not.toContain(LEGACY_ACTIVE_WIF);
  expect(replies).not.toContain(LEGACY_MEMO_WIF);
};

const current = (v: unknown) => typeof v === 'string' && isEnvelopeV2(v) && !needsReencrypt(v);

describe.each([
  {
    layout: 'redux-persist v4 (reduxPersist:keys only)',
    seed: () => ({ [LEGACY_KEYS_KEY]: v4Slice({ [LEGACY_ACCOUNT]: LEGACY_RECORD, [BOB]: BOB_RECORD }) }),
  },
  {
    layout: 'persist:root with backups (an earlier migration) and the v4 blob still present',
    seed: () => ({
      [LEGACY_KEYS_KEY]: v4Slice({ [LEGACY_ACCOUNT]: LEGACY_RECORD }),
      [ROOT_KEY]: v6Root({ [LEGACY_ACCOUNT]: LEGACY_RECORD, [BOB]: BOB_RECORD }),
      [`${BACKUP_PREFIX}2026-08-01T00:00:00.000Z`]: JSON.parse(v6Root({ [LEGACY_ACCOUNT]: LEGACY_RECORD })).keys,
      [`${BACKUP_PREFIX}2026-08-02T00:00:00.000Z`]: v6Root({ [LEGACY_ACCOUNT]: LEGACY_RECORD }),
      [`${BACKUP_PREFIX}2026-08-03T00:00:00.000Z`]: `{"truncated":"${LEGACY_ACTIVE_CIPHERTEXT}`,
    }),
  },
])('legacy crypto-js key store — $layout', ({ seed }) => {
  it('rejects a wrong password and leaves every copy as it was', async () => {
    const storage = makeStorage(seed());
    const { store } = mountRenderer(storage);
    const before = storage.dump();

    expect(await verifyPasswordInMain(LEGACY_RECORD, 'not-the-password')).toBe(false);
    await store.dispatch(adoptMainEnvelope(LEGACY_ACCOUNT) as any);

    expect(storage.dump()).toEqual(before);
    expect(fs.readFileSync(keystoreFile, 'utf8')).toContain(LEGACY_ACTIVE_CIPHERTEXT);
  });

  it('after one unlock in main, the account exists only as v2 envelopes, everywhere', async () => {
    const storage = makeStorage(seed());
    const { store } = mountRenderer(storage);

    expect(await verifyPasswordInMain(LEGACY_RECORD, LEGACY_PASSWORD)).toBe(true);
    await store.dispatch(adoptMainEnvelope(LEGACY_ACCOUNT) as any);

    // main: v2 only, no legacy-format ciphertext for the account
    const mainRec = JSON.parse(fs.readFileSync(keystoreFile, 'utf8')).accounts[LEGACY_ACCOUNT];
    expect(current(mainRec.key) && current(mainRec.memo)).toBe(true);
    expect(JSON.stringify(mainRec)).not.toContain(LEGACY_MARKER);

    // renderer: redux state, persist:root, its backups and reduxPersist:keys hold no legacy copy
    const rendererRec = store.getState().keys.permissions[LEGACY_ACCOUNT];
    expect(rendererRec.key).toBe(mainRec.key);
    expect(rendererRec.memo).toBe(mainRec.memo);
    expect(legacyLeftovers(storage)).toEqual([]);
    const root = JSON.parse(storage.getItem(ROOT_KEY) as string);
    expect(JSON.parse(root.keys).permissions[LEGACY_ACCOUNT].key).toBe(mainRec.key);
    // another account's record is not touched
    expect(JSON.parse(root.keys).permissions[BOB]).toEqual(BOB_RECORD);

    // the upgraded key still unlocks with the same password (and only with it), and signs in main
    expect(await decryptKey(rendererRec.key, LEGACY_PASSWORD)).toBe(LEGACY_ACTIVE_WIF);
    expect(await verifyPasswordInMain(rendererRec, 'not-the-password')).toBe(false);
    const signed = await signTx(
      { ref_block_num: 1, ref_block_prefix: 2, expiration: '2030-01-01T00:00:00', operations: [['transfer', { from: LEGACY_ACCOUNT, to: 'bob', amount: '0.001 HIVE', memo: '' }]], extensions: [] },
      'active',
      { account: LEGACY_ACCOUNT, password: LEGACY_PASSWORD }
    );
    expect(signed.signatures).toHaveLength(1);

    // a renderer still holding the legacy copy cannot push it back into main
    expect(await verifyPasswordInMain(LEGACY_RECORD, 'not-the-password')).toBe(false);
    expect(fs.readFileSync(keystoreFile, 'utf8')).not.toContain(LEGACY_ACTIVE_CIPHERTEXT);

    assertNoWifReturned();
  });
});

describe('key import goes to main custody', () => {
  it('stores only main\'s envelope in the renderer and never hands a WIF back', async () => {
    const storage = makeStorage({});
    const keystore = new Keystore(keystoreFile);
    const store = configureStore({ reducer: { keys: keysReducer } });
    (globalThis as any).window = {
      localStorage: storage,
      electronAPI: {
        keystore: new Proxy(
          {},
          {
            get: (_t, method: string) => async (...args: unknown[]) => {
              const value = await (keystore as any)[method](...args);
              returned.push(value);
              return value;
            },
          }
        ),
      },
    };
    const wif = hiveAuth.getPrivateKeys('vessel-import-test', 'throwaway-import-pw', ['active']).active;

    await store.dispatch(addKeyConfirmed('vessel-import-test', wif, 'active', 'import-wallet-pw') as any);

    const rec = store.getState().keys.permissions['vessel-import-test'];
    expect(current(rec.key)).toBe(true);
    expect(rec.key).toBe(keystore.getEnvelope('vessel-import-test')?.key);
    expect(await keystore.verify('vessel-import-test', 'import-wallet-pw')).toBe(true);
    expect(JSON.stringify(returned)).not.toContain(wif);
    expect(fs.readFileSync(keystoreFile, 'utf8')).not.toContain(wif);
  });
});
