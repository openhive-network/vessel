import { configureStore as rtkConfigureStore, type Middleware } from '@reduxjs/toolkit';
import { createLogger } from 'redux-logger';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import rootReducer from '../reducers';
import { migrateLegacyKeystore } from './legacyKeystoreMigration';
import { keysSurfaceTransform } from './keysPersistTransform';
import { runKeystoreMigration } from './keystoreMainMigration';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['account', 'keys', 'preferences', 'hive'],
  transforms: [keysSurfaceTransform],
};

// redux 5's combineReducers returns a 3-param Reducer (adds PreloadedState); redux-persist 6's types
// still expect redux-4's 2-param Reducer. Behavior-neutral: pin S explicitly so RootState stays precise
// and cast the base reducer past the stale persistReducer signature.
const persistedReducer = persistReducer<ReturnType<typeof rootReducer>>(
  persistConfig,
  rootReducer as any
);

const configureStore = () => {
  // Phase 1 · Task 0: migrate a legacy redux-persist v4 keystore into persist:root BEFORE the store
  // rehydrates, so an existing wallet is never loaded empty. Non-fatal: reduxPersist:* is untouched
  // on any throw, so a skipped migration loses nothing and the next launch retries.
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const result = migrateLegacyKeystore(window.localStorage);
      if (result.status === 'migrated') {
         
        console.log(
          `[keystore] migrated ${result.copiedAccounts.length} account(s) from legacy storage; backup=${result.backupKey}`,
        );
      }
    } catch (e) {
       
      console.error('[keystore] migration skipped (non-fatal):', e && (e as Error).name);
    }
  }

  // Phase 5 (D5): RTK configureStore. Thunk + Redux DevTools are built in; redux-persist's lifecycle
  // actions carry non-serializable payloads (functions/registry), so they are ignored by the
  // serializability check. redux-logger is kept as a dev-only add-on to preserve prior behavior.
  return rtkConfigureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => {
      const extra: Middleware[] =
        process.env.NODE_ENV === 'development'
          ? // redux-logger's types target legacy redux (AnyAction); cast to RTK's Middleware.
            [createLogger({ level: 'info', collapsed: true }) as unknown as Middleware]
          : [];
      return getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }).concat(extra);
    },
    devTools: process.env.NODE_ENV !== 'production',
  });
};

export const store = configureStore();
export const persistor = persistStore(store, null, () => {
  // Phase 3 · D9b Stage B — once rehydration is complete, copy existing encrypted key records into
  // the main-process keystore (non-destructive, idempotent, ciphertext-only; no-op outside Electron).
  // Runs here (not in configureStore) so `permissions` is populated, never an empty pre-rehydration slice.
  runKeystoreMigration(store.getState().keys);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default { store, persistor };
