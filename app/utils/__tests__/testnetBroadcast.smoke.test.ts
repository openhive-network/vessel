/**
 * Phase 4 — the full-round-trip smoke: prepare -> sign -> broadcast -> a REAL hived accepts it.
 *
 * The one thing offline parity can't prove: that hive-tx's serialization, tapos, broadcast shape and
 * error handling are actually accepted by a live node. Exercises the production facade path
 * (broadcast.ts -> hiveApi.ts -> hive-tx) against a testnet/mirrornet node and reads the node's REAL
 * chain_id from get_config (resolving the "testnet chain_id is a guess" caveat).
 *
 * SAFE + ENV-GATED: SKIPS unless VESSEL_TESTNET_NODE + _ACCOUNT + at least one role key are set, so it
 * never runs in normal CI. Targets a TESTNET/MIRRORNET (a separate chain that can never touch mainnet)
 * and refuses to run against the mainnet chain_id. The posting/active ops are custom_json (balance-
 * neutral); the memo op is a 0.001 self-transfer (net-zero) carrying an encrypted memo. Use THROWAWAY
 * keys only — a posting key still has mainnet social privilege.
 *
 *   VESSEL_TESTNET_NODE, VESSEL_TESTNET_ACCOUNT, VESSEL_TESTNET_{ACTIVE,POSTING,MEMO}  (see .env.example)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { hiveApi, hiveConfig, hiveAuth, hiveMemo } from '../hiveApi';
import { broadcastOps } from '../broadcast';

const NODE = process.env.VESSEL_TESTNET_NODE;
const ACCOUNT = process.env.VESSEL_TESTNET_ACCOUNT;
const ACTIVE = process.env.VESSEL_TESTNET_ACTIVE;
const POSTING = process.env.VESSEL_TESTNET_POSTING;
const MEMO = process.env.VESSEL_TESTNET_MEMO;
const CONFIGURED = Boolean(NODE && ACCOUNT && (ACTIVE || POSTING));
const SIG_HEX = /^[0-9a-f]{130}$/i;

describe.skipIf(!CONFIGURED)('Phase 4 — live testnet broadcast round-trip (opt-in)', () => {
  beforeAll(async () => {
    hiveApi.setOptions({ url: NODE as string });
    const cfg = await hiveApi.getConfig();
    hiveConfig.set('chain_id', cfg.HIVE_CHAIN_ID);
    hiveConfig.set('address_prefix', cfg.HIVE_ADDRESS_PREFIX);
    // Never broadcast against mainnet by mistake.
    expect(cfg.HIVE_CHAIN_ID).not.toBe(
      'beeab0de00000000000000000000000000000000000000000000000000000000'
    );
  }, 30000);

  it.skipIf(!POSTING)(
    'posting authority: custom_json is accepted (balance-neutral)',
    async () => {
      const result = await broadcastOps.customJson(POSTING as string, {
        requiredAuths: [],
        requiredPostingAuths: [ACCOUNT],
        id: 'vessel-smoke-posting',
        json: JSON.stringify({ app: 'vessel', role: 'posting' }),
        role: 'posting',
      });
      expect(result).toBeTruthy();
      expect(result.signatures?.[0]).toMatch(SIG_HEX);
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'active authority: custom_json is accepted (balance-neutral)',
    async () => {
      const result = await broadcastOps.customJson(ACTIVE as string, {
        requiredAuths: [ACCOUNT],
        requiredPostingAuths: [],
        id: 'vessel-smoke-active',
        json: JSON.stringify({ app: 'vessel', role: 'active' }),
        role: 'active',
      });
      expect(result).toBeTruthy();
      expect(result.signatures?.[0]).toMatch(SIG_HEX);
    },
    30000
  );

  it.skipIf(!(ACTIVE && MEMO))(
    'money + memo path: a 0.001 self-transfer carrying an encrypted memo is accepted',
    async () => {
      // Encrypt a memo to the account's own memo pubkey (memo key), sign the transfer with active.
      const memoPub = hiveAuth.wifToPublic(MEMO as string);
      const encryptedMemo = hiveMemo.encode(MEMO as string, memoPub, '#vessel phase4 mirrornet smoke');
      const result = await broadcastOps.transfer(ACTIVE as string, {
        from: ACCOUNT,
        to: ACCOUNT, // self-transfer -> net-zero balance change
        amount: '0.001 HIVE',
        memo: encryptedMemo,
      });
      expect(result).toBeTruthy();
      expect(result.signatures?.[0]).toMatch(SIG_HEX);
      // round-trip the memo back with the memo key
      expect(hiveMemo.decode(MEMO as string, encryptedMemo)).toBe('#vessel phase4 mirrornet smoke');
    },
    30000
  );
});
