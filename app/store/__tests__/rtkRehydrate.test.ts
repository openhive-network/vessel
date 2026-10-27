import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  persistReducer,
  REHYDRATE,
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import rootReducer from '../../reducers';
import { keysSurfaceTransform } from '../keysPersistTransform';
import { KEY_ADD_CONFIRMED, KEY_REMOVE_CONFIRMED } from '../../actions/keys';

/**
 * Phase 5 (D5) — the named keystore-loss guard for the RTK migration. Builds the exact persisted
 * reducer the app uses and rehydrates a redux-persist state blob shaped like a SHIPPED (pre-RTK)
 * wallet's, then asserts the `keys` slice by name: the encrypted envelopes, account names, isUser and
 * the removal tombstones survive rehydration into the createSlice-based store byte-identically, and
 * the slice's own reducers still operate on the rehydrated state. A regression here is a keystore-loss
 * event, per the plan's standing rule.
 */
const persistedReducer = persistReducer(
  {
    key: 'root',
    storage,
    whitelist: ['account', 'keys', 'preferences', 'hive'],
    transforms: [keysSurfaceTransform],
  },
  // redux 5 Reducer (3-param) vs redux-persist 6's stale 2-param signature — behavior-neutral cast.
  rootReducer as any,
);

const makeStore = () =>
  configureStore({
    reducer: persistedReducer,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }),
  });

// A persisted `keys` blob exactly as the shipped app stored it (the keysSurfaceTransform allowlist:
// names, permissions, isUser, removedLegacy). Envelopes are throwaway ciphertext strings.
const PERSISTED_KEYS = {
  names: ['alice', 'bob'],
  permissions: {
    alice: {
      account: 'alice',
      key: '{"v":2,"kdf":"scrypt","ct":"alice-ciphertext"}',
      encrypted: true,
      type: 'active',
      memo: '{"v":2,"kdf":"scrypt","ct":"alice-memo-ciphertext"}',
    },
    bob: {
      account: 'bob',
      key: 'U2FsdGVkX1-legacy-openssl-blob',
      encrypted: true,
      type: 'posting',
    },
  },
  isUser: true,
  removedLegacy: ['charlie'],
};

const rehydrate = (store: ReturnType<typeof makeStore>) =>
  store.dispatch({
    type: REHYDRATE,
    key: 'root',
    payload: {
      keys: PERSISTED_KEYS,
      account: {},
      preferences: { hived_node: 'https://api.hive.blog' },
      hive: {},
    },
  });

describe('RTK rehydration — the keys slice keystore-loss guard', () => {
  it('rehydrates a pre-RTK persisted keys blob byte-identically', () => {
    const store = makeStore();
    rehydrate(store);
    const { keys } = store.getState() as any;
    expect(keys.names).toEqual(['alice', 'bob']);
    expect(keys.permissions).toEqual(PERSISTED_KEYS.permissions);
    expect(keys.permissions.alice.key).toBe('{"v":2,"kdf":"scrypt","ct":"alice-ciphertext"}');
    expect(keys.permissions.bob.encrypted).toBe(true);
    expect(keys.isUser).toBe(true);
    expect(keys.removedLegacy).toEqual(['charlie']);
  });

  it('the rehydrated keys slice still reduces its own actions (add + remove)', () => {
    const store = makeStore();
    rehydrate(store);
    store.dispatch({
      type: KEY_ADD_CONFIRMED,
      payload: { dave: { account: 'dave', key: 'dave-ct', encrypted: true, type: 'active' } },
    });
    let { keys } = store.getState() as any;
    expect(keys.names).toEqual(['alice', 'bob', 'dave']);
    expect(keys.permissions.dave.account).toBe('dave');

    store.dispatch({ type: KEY_REMOVE_CONFIRMED, payload: 'alice' });
    ({ keys } = store.getState() as any);
    expect(keys.names).toEqual(['bob', 'dave']);
    expect(keys.permissions.alice).toBeUndefined();
    expect(keys.removedLegacy).toEqual(['charlie', 'alice']); // tombstone preserved + appended
  });
});
