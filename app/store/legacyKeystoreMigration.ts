/**
 * Phase 1 · Task 0 — v4 -> v6 keystore storage-layout migration (THE CROWN JEWEL).
 *
 * The shipped app persists with redux-persist v4 (each slice under `reduxPersist:<slice>`); the
 * modernized app reads redux-persist v6 (a single `persist:root`). Without this one-time,
 * PASSWORD-FREE, non-destructive migration, an existing wallet rehydrates EMPTY (already observed
 * on a real profile). This merges the legacy keys per-account into `persist:root`.
 *
 * INVARIANTS (phase1-spec §2 + REVISION v2/v3/v4):
 *  - `reduxPersist:*` is READ-ONLY here: this migration never writes, renames, or deletes it (I-4
 *    rollback). Once main has re-encrypted an account, legacyCiphertextPurge removes that account's
 *    weak ciphertext from it and from the backups below.
 *  - Per-account UNION: copy a legacy account only if it is not already present-with-data in v6;
 *    never overwrite a populated v6 record; a user-removed (tombstoned) account is never resurrected.
 *  - The WIF ciphertext moves VERBATIM — no decryption, no password.
 *  - read-old -> write-new -> VERIFY -> keep-old; a timestamped, sanitized, bounded backup precedes
 *    the single write.
 *
 * Pure TypeScript — imports NOTHING from legacy `.js` (keeps the Jest suite parseable pre-Vitest).
 */

/** Minimal storage surface (a superset of `window.localStorage`; the test fake implements all 5). */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export type MigrationStatus =
  | 'no-legacy' // `reduxPersist:keys` absent -> no-op
  | 'legacy-unparseable' // legacy blob corrupt -> no-op (never guess)
  | 'legacy-empty' // legacy has no usable accounts -> no-op
  | 'noop-all-present' // every legacy account already present in v6, nothing to carry -> no write
  | 'migrated' // wrote a merged persist:root (sanitized backup taken first, verified after)
  | 'verify-failed'; // post-write verification mismatch -> restored/removed; next launch re-migrates

export interface MigrationResult {
  status: MigrationStatus;
  copiedAccounts: string[]; // legacy accounts copied this run
  copiedSettings: string[]; // non-key slices carried this run (subset of account/preferences/hive)
  backupKey: string | null; // set when a backup was written
  rootRecovered: boolean; // outer persist:root was unparseable and rebuilt
  innerKeysRecovered: boolean; // inner keys string was unparseable and rebuilt
}

export const LEGACY_KEYS_KEY = 'reduxPersist:keys';
export const ROOT_KEY = 'persist:root';
export const BACKUP_PREFIX = 'persist:root.keys.backup.';
const NON_KEY_SLICES = ['account', 'preferences', 'hive'] as const;
const MAX_BACKUPS = 3;

/**
 * Reducer INITIAL states, hardcoded to keep this module free of legacy `.js` imports.
 * KEEP IN SYNC with the reducers cited — a drift only fails to CARRY a non-key setting (safe
 * direction), it can never clobber a populated slice or touch a key.
 */
const REDUCER_DEFAULTS: Record<string, unknown> = {
  account: { updated: false, accounts: {} }, // app/reducers/account.js
  preferences: { hived_node: 'https://api.hive.blog' }, // app/reducers/preferences.js
  hive: { props: { time: null } }, // app/reducers/hive.js
};

type Dict = Record<string, unknown>;

const isObj = (v: unknown): v is Dict =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const tryParse = (s: string | null): unknown => {
  if (s == null) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
};

const hasNonEmptyKey = (rec: unknown): rec is Dict =>
  isObj(rec) && typeof rec.key === 'string' && rec.key.length > 0;

/** A v6 sibling may be overwritten from v4 only if it is absent or equals the reducer's initial state. */
const isDefaultOrEmpty = (slice: string, v6Sib: unknown): boolean => {
  if (v6Sib === undefined) return true;
  const def = REDUCER_DEFAULTS[slice];
  if (def !== undefined && deepEqual(v6Sib, def)) return true;
  return isObj(v6Sib) && Object.keys(v6Sib).length === 0;
};

/** The durable keys-slice surface — mirrors keysPersistTransform. Drops ephemeral fields. */
const sanitizeKeysSlice = (slice: Dict): Dict => {
  const permissions = isObj(slice.permissions) ? slice.permissions : {};
  return {
    names: Array.isArray(slice.names) ? slice.names : Object.keys(permissions).sort(),
    permissions,
    isUser: !!slice.isUser,
    removedLegacy: Array.isArray(slice.removedLegacy) ? slice.removedLegacy : [],
  };
};

/** Prune `persist:root.keys.backup.*` to the newest MAX_BACKUPS. Collect first, then delete (index-safe).
 *  Never prunes `keep` (the current run's backup) — guards a backward system clock. */
const pruneBackups = (storage: KVStorage, keep: string | null): void => {
  const backups: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k != null && k.startsWith(BACKUP_PREFIX)) backups.push(k);
  }
  backups.sort().reverse(); // fixed-width ISO suffix: lexical order == chronological; newest first
  const survivors = new Set(backups.slice(0, MAX_BACKUPS));
  if (keep) survivors.add(keep);
  backups.forEach((k) => {
    if (!survivors.has(k)) storage.removeItem(k);
  });
};

export function migrateLegacyKeystore(
  storage: KVStorage,
  now: () => Date = () => new Date(),
): MigrationResult {
  const nil = (status: MigrationStatus): MigrationResult => ({
    status,
    copiedAccounts: [],
    copiedSettings: [],
    backupKey: null,
    rootRecovered: false,
    innerKeysRecovered: false,
  });

  // ---- read + validate legacy v4 keys (never write on any legacy parse failure) ----
  const legacyRaw = storage.getItem(LEGACY_KEYS_KEY);
  if (legacyRaw == null) return nil('no-legacy');
  const legacy = tryParse(legacyRaw);
  if (legacy === undefined) return nil('legacy-unparseable');
  if (!isObj(legacy) || !isObj(legacy.permissions)) return nil('legacy-empty');

  const legacyPerms = legacy.permissions as Dict;
  const legacyEntries = Object.entries(legacyPerms).filter(([, rec]) => hasNonEmptyKey(rec));
  if (legacyEntries.length === 0) return nil('legacy-empty');

  // ---- read v6 persist:root ----
  const rootRaw = storage.getItem(ROOT_KEY);
  let rootObj: Dict = {};
  let keysSlice: Dict = { names: [], permissions: {} };
  let rootRecovered = false;
  let innerKeysRecovered = false;

  if (rootRaw != null) {
    const parsedRoot = tryParse(rootRaw);
    if (isObj(parsedRoot)) {
      rootObj = parsedRoot;
      if (typeof rootObj.keys === 'string') {
        const inner = tryParse(rootObj.keys);
        if (isObj(inner)) keysSlice = inner;
        else innerKeysRecovered = true; // inner keys string corrupt -> rebuild; do NOT carry settings
      }
    } else {
      rootRecovered = true; // corrupt OUTER root (§2.5): rebuild (backed up below)
      rootObj = {};
    }
  }
  if (!isObj(keysSlice.permissions)) keysSlice = { ...keysSlice, permissions: {} };

  const existingPerms = keysSlice.permissions as Dict;
  const removedLegacy: string[] = Array.isArray(keysSlice.removedLegacy)
    ? (keysSlice.removedLegacy as string[])
    : [];
  const tombstoned = new Set(removedLegacy);

  // ---- per-account UNION (never overwrite present-with-data; skip tombstoned; carry a missing memo) ----
  const perms: Dict = { ...existingPerms };
  const toCopy: Array<[string, unknown]> = [];
  let carriedMemo = false;
  legacyEntries.forEach(([name, rec]) => {
    if (tombstoned.has(name)) return; // user removed it — never resurrect (13.3)
    const existing = perms[name];
    if (!hasNonEmptyKey(existing)) {
      toCopy.push([name, rec]);
      return;
    }
    // present-with-data: never touch key/type; but restore a MISSING memo (13.10 — additive only).
    if (existing.memo === undefined && isObj(rec) && rec.memo !== undefined) {
      perms[name] = { ...existing, memo: rec.memo };
      carriedMemo = true;
    }
  });

  // ---- Q6 gated non-key settings carry-over (A6 / C3): only when rescuing a fresh/empty v6 ----
  const v6KeysWasEmpty = !innerKeysRecovered && Object.keys(existingPerms).length === 0;
  const copiedSettings: string[] = [];
  const siblingWrites: Record<string, string> = {};
  if (v6KeysWasEmpty) {
    NON_KEY_SLICES.forEach((s) => {
      const legacyS = tryParse(storage.getItem(`reduxPersist:${s}`));
      if (!isObj(legacyS)) return;
      const v6Sib = typeof rootObj[s] === 'string' ? tryParse(rootObj[s] as string) : undefined;
      if (isDefaultOrEmpty(s, v6Sib)) {
        siblingWrites[s] = JSON.stringify(legacyS); // reduxPersist:{s} itself is NEVER modified
        copiedSettings.push(s);
      }
    });
  }

  const willWrite =
    toCopy.length > 0 || rootRecovered || carriedMemo || copiedSettings.length > 0;
  if (!willWrite) return nil('noop-all-present');

  // ---- FIRST AND ONLY WRITE SEQUENCE (sanitized backup precedes any mutation) ----
  let backupKey: string | null = null;
  if (rootRaw != null) {
    backupKey = BACKUP_PREFIX + now().toISOString();
    // sanitized keys-slice backup (13.2); on outer corruption the slice is unrecoverable -> raw root.
    storage.setItem(backupKey, rootRecovered ? rootRaw : JSON.stringify(sanitizeKeysSlice(keysSlice)));
  }

  toCopy.forEach(([name, rec]) => {
    perms[name] = rec as Dict;
  }); // the parsed legacy record, structurally verbatim
  const merged: Dict = {
    names: Object.keys(perms).sort(),
    permissions: perms,
    isUser: Object.keys(perms).length > 0 ? true : !!keysSlice.isUser,
    removedLegacy,
  };
  rootObj.keys = JSON.stringify(merged); // inner (v6) serialization
  copiedSettings.forEach((s) => {
    rootObj[s] = siblingWrites[s];
  });
  storage.setItem(ROOT_KEY, JSON.stringify(rootObj)); // outer serialization — ONE write

  // ---- VERIFY (I-4): every copied record round-trips byte-for-byte ----
  const verifyOuter = tryParse(storage.getItem(ROOT_KEY));
  const verifyInner = isObj(verifyOuter) && typeof verifyOuter.keys === 'string'
    ? tryParse(verifyOuter.keys)
    : undefined;
  const verifyPerms = isObj(verifyInner) && isObj(verifyInner.permissions)
    ? (verifyInner.permissions as Dict)
    : undefined;
  const verifyOk =
    verifyPerms !== undefined &&
    toCopy.every(([name]) => deepEqual(verifyPerms[name], legacyPerms[name]));

  if (!verifyOk) {
    // restore the KEYS field only (C1) — never overwrite siblings/_persist; or remove a fresh root (D5).
    if (backupKey == null) {
      storage.removeItem(ROOT_KEY);
    } else {
      const backupVal = storage.getItem(backupKey);
      if (backupVal != null) {
        if (rootRecovered) {
          storage.setItem(ROOT_KEY, backupVal); // raw whole-root restore
        } else {
          const cur = tryParse(storage.getItem(ROOT_KEY));
          const base: Dict = isObj(cur) ? cur : {};
          base.keys = backupVal; // backupVal is already the serialized keys slice (string form, C6)
          storage.setItem(ROOT_KEY, JSON.stringify(base));
        }
      }
    }
    return {
      status: 'verify-failed',
      copiedAccounts: [],
      copiedSettings: [],
      backupKey,
      rootRecovered,
      innerKeysRecovered,
    };
  }

  pruneBackups(storage, backupKey); // keep newest MAX_BACKUPS; never the current run's backup (D7)

  return {
    status: 'migrated',
    copiedAccounts: toCopy.map(([name]) => name),
    copiedSettings,
    backupKey,
    rootRecovered,
    innerKeysRecovered,
  };
}
