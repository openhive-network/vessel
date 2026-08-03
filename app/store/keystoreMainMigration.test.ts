import { describe, it, expect } from 'vitest';
import { buildMigrationRecords } from './keystoreMainMigration';

/**
 * Phase 3 · D9b Stage B (step 3) — the pure record-builder that decides what the renderer hands to
 * main. Excludes removal tombstones and malformed entries; copies fields verbatim.
 */
describe('buildMigrationRecords', () => {
  const state = {
    permissions: {
      alice: { account: 'alice', key: 'ENV_A', encrypted: true, type: 'active', memo: 'ENV_M' },
      bob: { account: 'bob', key: 'WIF_B', encrypted: false, type: 'posting' },
      ghost: { account: 'ghost', key: 'ENV_G', encrypted: true, type: 'active' },
      broken: { account: 'broken', encrypted: true, type: 'active' }, // no key
    },
    removedLegacy: ['ghost'],
    names: ['alice', 'bob'],
  };

  it('builds verbatim records, excluding tombstones and malformed entries', () => {
    const byAccount = Object.fromEntries(buildMigrationRecords(state).map((r) => [r.account, r]));
    expect(Object.keys(byAccount).sort()).toEqual(['alice', 'bob']); // ghost tombstoned, broken dropped
    expect(byAccount.alice).toEqual({
      account: 'alice',
      key: 'ENV_A',
      encrypted: true,
      type: 'active',
      memo: 'ENV_M',
    });
    expect(byAccount.bob).toEqual({ account: 'bob', key: 'WIF_B', encrypted: false, type: 'posting' });
    expect(byAccount.bob).not.toHaveProperty('memo');
  });

  it('returns empty for undefined/empty state (never a vacuous migration)', () => {
    expect(buildMigrationRecords(undefined)).toEqual([]);
    expect(buildMigrationRecords({ permissions: {} })).toEqual([]);
  });
});
