/**
 * Phase 4 — the full-round-trip smoke: prepare -> sign -> broadcast -> a REAL hived accepts it.
 *
 * This is the one thing the offline parity suites cannot cover: that hive-tx's serialization, tapos,
 * broadcast shape and error handling are actually accepted by a live node. It exercises the production
 * facade path (broadcast.ts -> hiveApi.ts -> hive-tx) against a testnet/mirrornet node and resolves the
 * "testnet chain_id is a guess" caveat by reading the node's real chain_id from get_config.
 *
 * SAFE + ENV-GATED: it SKIPS unless all three env vars are set, so it never runs in normal CI or on a
 * dev machine without opting in. When it does run it targets a TESTNET/MIRRORNET (valueless TESTS/TBD,
 * a separate chain that can never touch mainnet) and broadcasts a balance-neutral custom_json (no funds
 * moved, minimal RC). NEVER point VESSEL_TESTNET_WIF at a mainnet key.
 *
 *   VESSEL_TESTNET_NODE=https://<testnet-or-mirrornet-node> \
 *   VESSEL_TESTNET_ACCOUNT=<throwaway-testnet-account> \
 *   VESSEL_TESTNET_WIF=<that account's POSTING wif> \
 *     npx vitest run app/utils/__tests__/testnetBroadcast.smoke.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { hiveApi, hiveConfig } from '../hiveApi';
import { broadcastOps } from '../broadcast';

const NODE = process.env.VESSEL_TESTNET_NODE;
const ACCOUNT = process.env.VESSEL_TESTNET_ACCOUNT;
const WIF = process.env.VESSEL_TESTNET_WIF; // POSTING key — custom_json needs only posting authority
const CONFIGURED = Boolean(NODE && ACCOUNT && WIF);

// describe.skipIf keeps the file green (skipped, not failed) when creds are absent — same pattern as
// migration.spec.ts skipping without its profile.
describe.skipIf(!CONFIGURED)('Phase 4 — live testnet broadcast round-trip (opt-in)', () => {
  beforeAll(async () => {
    // Point the facade at the testnet node and adopt ITS real chain id + prefix (not a fixture guess).
    hiveApi.setOptions({ url: NODE as string });
    const cfg = await hiveApi.getConfig();
    hiveConfig.set('chain_id', cfg.HIVE_CHAIN_ID);
    hiveConfig.set('address_prefix', cfg.HIVE_ADDRESS_PREFIX);
    // Fail loudly rather than broadcast against mainnet by mistake.
    expect(cfg.HIVE_CHAIN_ID).not.toBe(
      'beeab0de00000000000000000000000000000000000000000000000000000000'
    );
  }, 30000);

  it(
    'broadcasts a balance-neutral custom_json and the node accepts it',
    async () => {
      const result = await broadcastOps.customJson(WIF as string, {
        requiredAuths: [],
        requiredPostingAuths: [ACCOUNT],
        id: 'vessel-testnet-smoke',
        json: JSON.stringify({ app: 'vessel', t: 'phase4-hive-tx-roundtrip' }),
        role: 'posting',
      });
      // signAndBroadcast returns Object.assign({}, rpcResult, signedTx); a rejected broadcast throws.
      expect(result).toBeTruthy();
      expect(result.signatures?.[0]).toMatch(/^[0-9a-f]{130}$/i);
    },
    30000
  );
});
