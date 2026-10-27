/**
 * Drop an account's weak ciphertext from the renderer's storage once main holds it as a v2 envelope.
 *
 * The v4 -> v6 migration (legacyKeystoreMigration) copies the shipped crypto-js ciphertext verbatim
 * and keeps `reduxPersist:keys` and its `persist:root.keys.backup.*` snapshots for rollback. After main
 * has re-encrypted the account (Keystore.upgradeRecord) and the renderer adopted the new envelope,
 * those copies are the only legacy-format ciphertext left for it, and they unlock with the same
 * password at one MD5 iteration. This rewrites every copy the renderer owns:
 *
 *  - `persist:root`: the account's stale key/memo is replaced by the v2 envelope (the keys slice in
 *    redux holds the same value, so redux-persist's next write agrees);
 *  - `persist:root.keys.backup.*`: the same replacement inside each snapshot (both the sanitized
 *    keys-slice form and the raw-root form a corrupt-root rescue writes);
 *  - `reduxPersist:keys`: the account is removed — the v4 layout exists only to be migrated from, and
 *    the account already lives in `persist:root`; the item is deleted once no account is left.
 *
 * A snapshot or v4 blob that still contains one of the replaced values afterwards (unparseable, or a
 * shape this module does not know) is deleted outright: it is an expendable copy. `persist:root` is
 * never deleted.
 */
import { isEncrypted, needsReencrypt } from '../utils/keyEnvelope';
import { BACKUP_PREFIX, LEGACY_KEYS_KEY, ROOT_KEY, type KVStorage } from './legacyKeystoreMigration';

/** The v2 envelopes main now holds for the account; a field is replaced only when one is given. */
export interface Replacement {
  key?: string;
  memo?: string;
}

type Dict = Record<string, unknown>;

const isObj = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

const tryParse = (s: string | null): unknown => {
  if (s == null) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

/** A stored key/memo value that the replacement supersedes: legacy, below-default-N, or a bare WIF. */
const isWeak = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && (needsReencrypt(v) || !isEncrypted(v));

/** Rewrite the account's record in a keys slice in place; returns the values it replaced. */
const rewriteSlice = (slice: Dict, account: string, replacement: Replacement): string[] => {
  const permissions = slice.permissions;
  if (!isObj(permissions) || !isObj(permissions[account])) return [];
  const rec = { ...(permissions[account] as Dict) };
  const replaced: string[] = [];
  if (replacement.key && rec.key !== replacement.key && isWeak(rec.key) && rec.encrypted !== false) {
    replaced.push(rec.key);
    rec.key = replacement.key;
  }
  if (replacement.memo && rec.memo !== replacement.memo && isWeak(rec.memo)) {
    replaced.push(rec.memo);
    rec.memo = replacement.memo;
  }
  if (replaced.length) slice.permissions = { ...permissions, [account]: rec };
  return replaced;
};

/**
 * Rewrite a root-shaped value (`{ keys: "<slice json>", ... }`) or a bare keys slice. Returns the new
 * serialization and the replaced values, or null when the value has neither shape.
 */
const rewriteStored = (
  raw: string,
  account: string,
  replacement: Replacement
): { value: string; replaced: string[] } | null => {
  const outer = tryParse(raw);
  if (!isObj(outer)) return null;
  if (typeof outer.keys === 'string') {
    const inner = tryParse(outer.keys);
    if (!isObj(inner)) return null;
    const replaced = rewriteSlice(inner, account, replacement);
    return { value: JSON.stringify({ ...outer, keys: JSON.stringify(inner) }), replaced };
  }
  if ('permissions' in outer) {
    const replaced = rewriteSlice(outer, account, replacement);
    return { value: JSON.stringify(outer), replaced };
  }
  return null;
};

const backupKeys = (storage: KVStorage): string[] => {
  const found: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const k = storage.key(i);
    if (k != null && k.startsWith(BACKUP_PREFIX)) found.push(k);
  }
  return found;
};

/** Remove the account from the v4 `reduxPersist:keys` blob; returns the weak values it held. */
const dropFromLegacy = (storage: KVStorage, account: string): string[] => {
  const legacy = tryParse(storage.getItem(LEGACY_KEYS_KEY));
  if (!isObj(legacy) || !isObj(legacy.permissions) || !isObj(legacy.permissions[account])) return [];
  const rec = legacy.permissions[account] as Dict;
  const dropped = [rec.key, rec.memo].filter(isWeak);
  const permissions = { ...legacy.permissions };
  delete permissions[account];
  if (Object.keys(permissions).length === 0) {
    storage.removeItem(LEGACY_KEYS_KEY);
  } else {
    const names = Array.isArray(legacy.names) ? legacy.names.filter((n) => n !== account) : legacy.names;
    storage.setItem(LEGACY_KEYS_KEY, JSON.stringify({ ...legacy, permissions, ...(names ? { names } : {}) }));
  }
  return dropped;
};

/**
 * Purge `account`'s weak ciphertext from `storage`, replacing it with `replacement` where a copy is
 * kept. Returns the storage keys it rewrote or removed.
 */
export function purgeLegacyCiphertext(storage: KVStorage, account: string, replacement: Replacement): string[] {
  if (!replacement.key && !replacement.memo) return [];
  const touched: string[] = [];
  const stale = new Set<string>(dropFromLegacy(storage, account));
  if (stale.size) touched.push(LEGACY_KEYS_KEY);

  for (const k of [ROOT_KEY, ...backupKeys(storage)]) {
    const raw = storage.getItem(k);
    if (raw == null) continue;
    const rewritten = rewriteStored(raw, account, replacement);
    if (rewritten && rewritten.replaced.length) {
      rewritten.replaced.forEach((v) => stale.add(v));
      storage.setItem(k, rewritten.value);
      touched.push(k);
    }
  }

  // Anything still carrying a replaced value is a copy this module could not rewrite.
  const leftovers = [LEGACY_KEYS_KEY, ...backupKeys(storage)].filter((k) => {
    const raw = storage.getItem(k);
    return raw != null && [...stale].some((v) => raw.includes(v));
  });
  leftovers.forEach((k) => {
    storage.removeItem(k);
    if (!touched.includes(k)) touched.push(k);
  });
  return touched;
}
