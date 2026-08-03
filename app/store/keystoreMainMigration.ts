/**
 * Phase 3 · D9b Stage B (step 3) — renderer-driven migration into the main-process keystore.
 *
 * Main cannot read Chromium's localStorage LevelDB sanely, so the copy is driven from the renderer:
 * after redux-persist rehydrates, we hand the persisted `permissions` records to main over IPC, which
 * copies them VERBATIM into keystore.json (see Keystore.migrateRecords — ciphertext only, no decrypt,
 * no password). This is NON-DESTRUCTIVE and idempotent: localStorage is untouched, signing still runs
 * the existing renderer path until the Stage B seam rewire (step 4), and re-running never clobbers a
 * record main already holds. Because it runs from the rehydration callback, `permissions` is populated
 * — it can never vacuously "succeed" on an empty pre-rehydration slice.
 */

export interface MigrationRecord {
  account: string;
  key: string;
  encrypted: boolean;
  type: string;
  memo?: string;
}

/**
 * Pure: build the verbatim record set to migrate from a keys-slice state. Excludes removal tombstones
 * (`removedLegacy`) so a removed account never resurrects in main, and drops malformed entries.
 */
export function buildMigrationRecords(keysState: any): MigrationRecord[] {
  const permissions = keysState && keysState.permissions ? keysState.permissions : {};
  const removed = new Set<string>(
    Array.isArray(keysState?.removedLegacy) ? keysState.removedLegacy : []
  );
  return Object.values(permissions)
    .filter(
      (r: any) => r && typeof r.account === 'string' && !removed.has(r.account) && typeof r.key === 'string'
    )
    .map((r: any) => ({
      account: r.account,
      key: r.key,
      encrypted: !!r.encrypted,
      type: r.type,
      ...(r.memo !== undefined ? { memo: r.memo } : {}),
    }));
}

/**
 * Run the migration once (called from the persistor rehydration callback). Guarded so it is a no-op
 * outside Electron or before the preload bridge exists, and non-fatal on any error — a failed copy
 * must never disrupt startup or the existing renderer signing path.
 */
export async function runKeystoreMigration(keysState: any): Promise<void> {
  const api = (typeof window !== 'undefined' ? (window as any).electronAPI : undefined)?.keystore;
  if (!api || typeof api.migrateRecords !== 'function') return;

  const records = buildMigrationRecords(keysState);
  if (!records.length) return;

  try {
    const result = await api.migrateRecords(records);
    // eslint-disable-next-line no-console
    console.log(
      `[keystore] main-process migration: ${result.migrated.length} copied, ${result.skipped.length} already present`
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      '[keystore] main-process migration failed (non-fatal):',
      e instanceof Error ? e.message : 'error'
    );
  }
}
