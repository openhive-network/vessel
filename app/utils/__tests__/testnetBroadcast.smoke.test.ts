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
import { accountAuthoritiesFromPassword, freeClaimFee } from '../accountCreation';

const NODE = process.env.VESSEL_TESTNET_NODE;
const ACCOUNT = process.env.VESSEL_TESTNET_ACCOUNT;
const ACTIVE = process.env.VESSEL_TESTNET_ACTIVE;
const POSTING = process.env.VESSEL_TESTNET_POSTING;
const MEMO = process.env.VESSEL_TESTNET_MEMO;
const CONFIGURED = Boolean(NODE && ACCOUNT && (ACTIVE || POSTING));
const SIG_HEX = /^[0-9a-f]{130}$/i;

// Money-path ops (vesting/savings/convert/transfer) need a small HIVE balance; skip them if the
// account is unfunded rather than fail. custom_json + witness_vote need only RC. A unique requestid per
// run avoids "conversion request already exists" on re-runs (no Math.random in this env — derive it).
let hiveAvailable = 0;
let uniqueId = 100;
let alreadyVotingGtg = false;
let vestsAvailable = 0;
let savingsAvailable = 0;
let creationFee = '3.000 HIVE';

// Proves an op serialized + signed + SUBMITTED end-to-end: hived either APPLIED it (returns a
// signature) or declined it AT THE EVALUATOR, which arrives via the facade error adapter as
// err.error.data.stack. A local serialize/sign failure throws WITHOUT that stack and fails here. Used
// for the state-changing vesting/savings ops so re-runs (which hived may reject as "no change") stay
// valid. Serialization EQUIVALENCE to hive-js is separately proven byte-for-byte by the offline parity
// suite; this only exercises the live submit path.
async function expectSubmitted(broadcast: () => Promise<any>): Promise<void> {
  try {
    const r = await broadcast();
    expect(r?.signatures?.[0]).toMatch(/^[0-9a-f]{130}$/i);
  } catch (e: any) {
    expect(e?.error?.data?.stack?.[0]).toBeTruthy();
  }
}

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
    const [acc] = await hiveApi.getAccounts([ACCOUNT as string]);
    hiveAvailable = acc ? parseFloat(String(acc.balance)) : 0;
    vestsAvailable = acc ? parseFloat(String(acc.vesting_shares)) : 0;
    savingsAvailable = acc ? parseFloat(String(acc.savings_balance)) : 0;
    alreadyVotingGtg = !!(acc && Array.isArray(acc.witness_votes) && acc.witness_votes.includes('gtg'));
    // seed a per-run-unique convert requestid from the head block number
    const props = await hiveApi.getDynamicGlobalProperties();
    uniqueId = Number(props.head_block_number) % 2000000000;
    // the chain's own account_creation_fee string (symbol included), for the account-creation ops
    const cp = await hiveApi.getChainProperties();
    if (cp?.account_creation_fee) creationFee = String(cp.account_creation_fee);
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

  it.skipIf(!ACTIVE)(
    'vesting family: transfer_to_vesting (power up 0.001 HIVE) is accepted',
    async (ctx) => {
      if (hiveAvailable < 0.05) {
        ctx.skip();
        return;
      }
      const result = await broadcastOps.transferToVesting(ACTIVE as string, {
        from: ACCOUNT,
        to: ACCOUNT,
        amount: '0.001 HIVE',
      });
      expect(result?.signatures?.[0]).toMatch(SIG_HEX);
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'savings family: transfer_to_savings (0.001 HIVE to own savings) is accepted',
    async (ctx) => {
      if (hiveAvailable < 0.05) {
        ctx.skip();
        return;
      }
      const result = await broadcastOps.transferToSavings(ACTIVE as string, {
        from: ACCOUNT,
        to: ACCOUNT,
        amount: '0.001 HIVE',
        memo: 'vessel smoke',
      });
      expect(result?.signatures?.[0]).toMatch(SIG_HEX);
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'convert family: collateralized_convert serializes + submits (chain may decline HBD creation)',
    async (ctx) => {
      if (hiveAvailable < 0.05) {
        ctx.skip();
        return;
      }
      try {
        const result = await broadcastOps.collateralizedConvert(ACTIVE as string, {
          owner: ACCOUNT,
          requestid: uniqueId,
          amount: '0.001 HIVE',
        });
        expect(result?.signatures?.[0]).toMatch(SIG_HEX);
      } catch (e: any) {
        // hived parsed + evaluated the op (serialization + signature ACCEPTED) but can decline new-HBD
        // creation for an economic reason (hbd_print_rate == 0). That still proves hive-tx built a
        // well-formed, signed, submittable tx, and it exercises the facade error adapter (F6) live: the
        // rejection must arrive with a hive-js-shaped err.error.data.stack. Any OTHER error (e.g. a
        // serialize/parse failure) is a real bug and rethrows.
        const format = e?.error?.data?.stack?.[0]?.format ?? e?.message ?? '';
        expect(format).toMatch(/HBD|hbd_print_rate/i);
      }
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'witness family: account_witness_vote is submitted (RC only, no funds)',
    async () => {
      // Toggle vs current on-chain state so it APPLIES when possible; expectSubmitted keeps it re-run
      // safe when a prior run's vote hasn't confirmed yet (hived then rejects the unchanged vote, which
      // still proves serialize + submit). gtg is a long-standing witness, mirrored from mainnet.
      await expectSubmitted(() =>
        broadcastOps.accountWitnessVote(ACTIVE as string, {
          account: ACCOUNT,
          witness: 'gtg',
          approve: !alreadyVotingGtg,
        })
      );
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'vesting family: delegate_vesting_shares is submitted',
    async (ctx) => {
      if (vestsAvailable < 500) {
        ctx.skip();
        return;
      }
      await expectSubmitted(() =>
        broadcastOps.delegateVestingShares(ACTIVE as string, {
          delegator: ACCOUNT,
          delegatee: 'gtg',
          vestingShares: `${(100 + (uniqueId % 400)).toFixed(6)} VESTS`, // vary per run
        })
      );
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'vesting family: withdraw_vesting (power down) is submitted',
    async (ctx) => {
      if (vestsAvailable < 100) {
        ctx.skip();
        return;
      }
      await expectSubmitted(() =>
        broadcastOps.withdrawVesting(ACTIVE as string, {
          account: ACCOUNT,
          vestingShares: `${(20 + (uniqueId % 30)).toFixed(6)} VESTS`,
        })
      );
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'vesting family: set_withdraw_vesting_route is submitted',
    async (ctx) => {
      if (vestsAvailable < 100) {
        ctx.skip();
        return;
      }
      await expectSubmitted(() =>
        broadcastOps.setWithdrawVestingRoute(ACTIVE as string, {
          fromAccount: ACCOUNT,
          toAccount: 'gtg',
          percent: 100 + (uniqueId % 99) * 100, // 100..9900, varies per run
          autoVest: false,
        })
      );
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'savings family: transfer_from_savings is submitted',
    async (ctx) => {
      if (savingsAvailable < 0.001) {
        ctx.skip();
        return;
      }
      await expectSubmitted(() =>
        broadcastOps.transferFromSavings(ACTIVE as string, {
          from: ACCOUNT,
          requestId: uniqueId % 100000, // unique per run
          to: ACCOUNT,
          amount: '0.001 HIVE',
          memo: 'vessel smoke',
        })
      );
    },
    30000
  );

  // --- Account creation (claim token / free create / paid create). All signed by the creator's
  // active key. expectSubmitted: the creator may lack RC (claim), a pending token (free create), or
  // funds (paid create) — a decline AT THE EVALUATOR still proves the op serialized + signed + built
  // correctly (a bad authority/field would fail to parse, not reach the evaluator). Fresh account
  // names per run (derived from the head block) avoid "account already exists".
  const base = uniqueId.toString(36).replace(/[^a-z0-9]/g, '');

  it.skipIf(!ACTIVE)(
    'account creation: claim_account (free, RC-based) is submitted',
    async () => {
      await expectSubmitted(() =>
        broadcastOps.claimAccount(ACTIVE as string, {
          creator: ACCOUNT,
          fee: freeClaimFee(creationFee), // "0.000 <symbol>" -> claim via Resource Credits
        })
      );
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'account creation: create_claimed_account (free, spends a token) is submitted',
    async () => {
      const newAccountName = `vsl${base}c`.slice(0, 16);
      const auths = accountAuthoritiesFromPassword(newAccountName, `vessel-smoke-${base}-c`);
      await expectSubmitted(() =>
        broadcastOps.createClaimedAccount(ACTIVE as string, {
          creator: ACCOUNT,
          newAccountName,
          owner: auths.owner,
          active: auths.active,
          posting: auths.posting,
          memoKey: auths.memoKey,
        })
      );
    },
    30000
  );

  it.skipIf(!ACTIVE)(
    'account creation: account_create (paid, account_creation_fee) is submitted',
    async () => {
      const newAccountName = `vsl${base}p`.slice(0, 16);
      const auths = accountAuthoritiesFromPassword(newAccountName, `vessel-smoke-${base}-p`);
      await expectSubmitted(() =>
        broadcastOps.accountCreate(ACTIVE as string, {
          creator: ACCOUNT,
          newAccountName,
          fee: creationFee,
          owner: auths.owner,
          active: auths.active,
          posting: auths.posting,
          memoKey: auths.memoKey,
        })
      );
    },
    30000
  );
});
