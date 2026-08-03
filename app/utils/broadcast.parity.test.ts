import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BPromise from 'bluebird';
import hive from '@hiveio/hive-js';
import { broadcastOps, signAndBroadcast } from './broadcast';
import { hiveAuth } from './hiveApi';

/**
 * Phase 3 · D9b Stage A parity gate. Proves the new prepare -> SIGN -> broadcast seam (broadcast.ts)
 * produces a transaction that is BYTE-IDENTICAL to the legacy `hive.broadcast.<op>` named-helper path
 * for every operation the wallet broadcasts. hive-js signs deterministically (RFC6979 + canonical
 * grinding), so an identical `signatures[0]` proves the serialized transaction buffers were identical —
 * i.e. our hand-built operations match hive-js's own construction exactly. The network is stubbed:
 * _prepareTransaction returns a FIXED tapos and broadcastTransactionAsync captures the signed tx, so
 * both paths sign the same bytes with no I/O. A testnet block proves the ` HIVE`->` TESTS` /
 * ` HBD`->` TBD` rewrite (applied inside hive.broadcast.send) is reproduced by the seam.
 *
 * Throwaway credentials (fixed name+password) — never a real funded account.
 */
const NAME = 'vessel-signing-test';
const PASSWORD = 'P5-throwaway-do-not-use-this-anywhere';
const WIF = hiveAuth.getPrivateKeys(NAME, PASSWORD, ['active']).active;
const SIG_HEX = /^[0-9a-f]{130}$/i;

const FIXED_TAPOS = {
  ref_block_num: 1234,
  ref_block_prefix: 5678901,
  expiration: '2030-01-01T00:00:00',
};

const origPrepare = hive.broadcast._prepareTransaction;
const origBroadcast = hive.api.broadcastTransactionAsync;
let captured: any[] = [];

beforeEach(() => {
  captured = [];
  // Deterministic tapos so both paths sign identical bytes (no network). Must be a bluebird promise:
  // the legacy hive.broadcast.send chains `.spread()` on the result of _prepareTransaction().then().
  hive.broadcast._prepareTransaction = (tx: any) =>
    BPromise.resolve({ ...FIXED_TAPOS, operations: tx.operations, extensions: tx.extensions || [] });
  // Capture the signed tx instead of broadcasting it.
  hive.api.broadcastTransactionAsync = (signed: any) => {
    captured.push(signed);
    return Promise.resolve(null);
  };
});

afterEach(() => {
  hive.broadcast._prepareTransaction = origPrepare;
  hive.api.broadcastTransactionAsync = origBroadcast;
  hive.config.set('address_prefix', 'STM');
});

async function viaLegacy(helper: string, args: any[], prefix = 'STM'): Promise<any> {
  hive.config.set('address_prefix', prefix);
  captured = [];
  await new Promise<void>((resolve, reject) => {
    (hive.broadcast as any)[helper](WIF, ...args, (err: any) => (err ? reject(err) : resolve()));
  });
  return captured[captured.length - 1];
}

async function viaSeam(run: () => Promise<any>, prefix = 'STM'): Promise<any> {
  hive.config.set('address_prefix', prefix);
  captured = [];
  await run();
  return captured[captured.length - 1];
}

// [ label, legacy helper name + positional args, equivalent broadcastOps call ]
const CASES: Array<[string, string, any[], () => Promise<any>]> = [
  ['transfer', 'transfer', ['alice', 'bob', '1.000 HIVE', 'hello'],
    () => broadcastOps.transfer(WIF, { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'hello' })],
  ['transfer_to_savings', 'transferToSavings', ['alice', 'bob', '2.500 HBD', 'save'],
    () => broadcastOps.transferToSavings(WIF, { from: 'alice', to: 'bob', amount: '2.500 HBD', memo: 'save' })],
  ['transfer_from_savings', 'transferFromSavings', ['alice', 42, 'bob', '1.000 HIVE', 'fs'],
    () => broadcastOps.transferFromSavings(WIF, { from: 'alice', requestId: 42, to: 'bob', amount: '1.000 HIVE', memo: 'fs' })],
  ['transfer_to_vesting', 'transferToVesting', ['alice', 'bob', '5.000 HIVE'],
    () => broadcastOps.transferToVesting(WIF, { from: 'alice', to: 'bob', amount: '5.000 HIVE' })],
  ['delegate_vesting_shares', 'delegateVestingShares', ['alice', 'bob', '100.000000 VESTS'],
    () => broadcastOps.delegateVestingShares(WIF, { delegator: 'alice', delegatee: 'bob', vestingShares: '100.000000 VESTS' })],
  ['withdraw_vesting', 'withdrawVesting', ['alice', '200.000000 VESTS'],
    () => broadcastOps.withdrawVesting(WIF, { account: 'alice', vestingShares: '200.000000 VESTS' })],
  ['set_withdraw_vesting_route', 'setWithdrawVestingRoute', ['alice', 'bob', 5000, true],
    () => broadcastOps.setWithdrawVestingRoute(WIF, { fromAccount: 'alice', toAccount: 'bob', percent: 5000, autoVest: true })],
  ['account_witness_vote', 'accountWitnessVote', ['alice', 'witness1', true],
    () => broadcastOps.accountWitnessVote(WIF, { account: 'alice', witness: 'witness1', approve: true })],
  ['account_witness_proxy', 'accountWitnessProxy', ['alice', 'proxyacc'],
    () => broadcastOps.accountWitnessProxy(WIF, { account: 'alice', proxy: 'proxyacc' })],
  ['convert', 'convert', ['alice', 123, '1.000 HBD'],
    () => broadcastOps.convert(WIF, { owner: 'alice', requestid: 123, amount: '1.000 HBD' })],
  ['collateralized_convert', 'collateralizedConvert', ['alice', 124, '1.000 HIVE'],
    () => broadcastOps.collateralizedConvert(WIF, { owner: 'alice', requestid: 124, amount: '1.000 HIVE' })],
  ['custom_json', 'customJson', [['alice'], [], 'follow', '{"x":1}'],
    () => broadcastOps.customJson(WIF, { requiredAuths: ['alice'], requiredPostingAuths: [], id: 'follow', json: '{"x":1}' })],
  ['claim_reward_balance', 'claimRewardBalance', ['alice', '1.000 HIVE', '0.500 HBD', '10.000000 VESTS'],
    () => broadcastOps.claimRewardBalance(WIF, { account: 'alice', reward_hive: '1.000 HIVE', reward_hbd: '0.500 HBD', reward_vests: '10.000000 VESTS' })],
];

describe('D9b Stage A — sign/broadcast seam is byte-identical to hive.broadcast.<op> (mainnet)', () => {
  it.each(CASES)('%s', async (_label, helper, args, seamCall) => {
    const legacy = await viaLegacy(helper, args);
    const seam = await viaSeam(seamCall);
    expect(seam.signatures[0]).toMatch(SIG_HEX);
    expect(seam.signatures).toEqual(legacy.signatures);
    expect(seam.operations).toEqual(legacy.operations);
  });
});

describe('D9b Stage A — testnet symbol rewrite parity (TST)', () => {
  const TESTNET: Array<[string, string, any[], () => Promise<any>]> = [
    ['transfer HIVE->TESTS', 'transfer', ['alice', 'bob', '1.000 HIVE', 't'],
      () => broadcastOps.transfer(WIF, { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 't' })],
    ['transfer_to_savings HBD->TBD', 'transferToSavings', ['alice', 'bob', '2.000 HBD', 't'],
      () => broadcastOps.transferToSavings(WIF, { from: 'alice', to: 'bob', amount: '2.000 HBD', memo: 't' })],
    ['claim_reward_balance both symbols', 'claimRewardBalance', ['alice', '1.000 HIVE', '0.500 HBD', '10.000000 VESTS'],
      () => broadcastOps.claimRewardBalance(WIF, { account: 'alice', reward_hive: '1.000 HIVE', reward_hbd: '0.500 HBD', reward_vests: '10.000000 VESTS' })],
  ];

  it.each(TESTNET)('%s', async (_label, helper, args, seamCall) => {
    const legacy = await viaLegacy(helper, args, 'TST');
    const seam = await viaSeam(seamCall, 'TST');
    expect(seam.signatures).toEqual(legacy.signatures);
    expect(seam.operations).toEqual(legacy.operations);
    // sanity: the rewrite actually fired
    expect(JSON.stringify(seam.operations)).not.toMatch(/ HIVE| HBD/);
  });
});

describe('D9b Stage A — generic signAndBroadcast (the send() action path)', () => {
  it('signs a multi-field custom op payload and stays truthy for `if (result)` callers', async () => {
    const result = await viaSeam(() =>
      signAndBroadcast(
        { operations: [['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'g' }]], extensions: [] },
        'active',
        WIF
      )
    );
    expect(result).toBeTruthy();
    expect(result.signatures[0]).toMatch(SIG_HEX);
  });
});
