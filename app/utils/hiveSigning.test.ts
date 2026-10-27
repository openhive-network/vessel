import { describe, it, expect } from 'vitest';
import hive from '@hiveio/hive-js';
import { hiveAuth } from './hiveApi';

/**
 * MR-B de-risk (Phase 2): proves @hiveio/hive-js key-derivation + transaction SIGNING run under the
 * Vitest/ESM toolchain — the same `import hive from '@hiveio/hive-js'` path the renderer uses — so
 * removing the webpack build in MR-B won't silently break the wallet's signing path. No network: we
 * sign locally via hive.auth.signTransaction and never broadcast. A final in-app confirmation on the
 * production vite build still gates MR-B (rollup browser bundle runtime), per the plan.
 *
 * Credentials are THROWAWAY (derived locally from a fixed name+password) — never a real funded account.
 */
const NAME = 'vessel-signing-test';
const PASSWORD = 'P5-throwaway-do-not-use-this-anywhere';
const SIG_HEX = /^[0-9a-f]{130}$/i; // 65-byte compact ECDSA sig (1 recovery + r + s), hex-encoded

const txWith = (operations: unknown[]) => ({
  ref_block_num: 1234,
  ref_block_prefix: 5678901,
  expiration: '2030-01-01T00:00:00',
  operations,
  extensions: [],
});

describe('hive-js signing (ESM/vite toolchain)', () => {
  it('derives valid WIF keys from name+password (the "I have a password" import path)', () => {
    const keys = hiveAuth.getPrivateKeys(NAME, PASSWORD, ['active', 'posting', 'owner', 'memo']);
    expect(hiveAuth.isWif(keys.active)).toBe(true);
    expect(hiveAuth.wifToPublic(keys.active)).toMatch(/^STM[1-9A-HJ-NP-Za-km-z]{40,}$/);
  });

  it('signs a transfer transaction into a canonical signature (no broadcast)', () => {
    const { active } = hiveAuth.getPrivateKeys(NAME, PASSWORD, ['active']);
    const signed = hive.auth.signTransaction(
      txWith([['transfer', { from: 'alice', to: 'bob', amount: '0.001 HIVE', memo: 'vessel-test' }]]),
      [active],
    );
    expect(signed.signatures).toHaveLength(1);
    expect(signed.signatures[0]).toMatch(SIG_HEX);
  });

  it('signs a second op type (account_witness_vote) — op serialization works end to end', () => {
    const { active } = hiveAuth.getPrivateKeys(NAME, PASSWORD, ['active']);
    const signed = hive.auth.signTransaction(
      txWith([['account_witness_vote', { account: 'alice', witness: 'somewitness', approve: true }]]),
      [active],
    );
    expect(signed.signatures[0]).toMatch(SIG_HEX);
  });
});
