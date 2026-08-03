import hive from '@hiveio/hive-js';

export type Operation = [string, Record<string, any>];
export interface UnsignedTx {
  operations: Operation[];
  extensions?: any[];
}

/**
 * Phase 3 · D9b Stage A — split hive-js's atomic broadcast into prepare -> SIGN -> broadcast, so a
 * later stage (D9b Stage B) can relocate the single SIGN step into the Electron main process behind an
 * IPC boundary without touching op construction, tapos, the testnet symbol rewrite, or the broadcast
 * call. This mirrors `hive.broadcast.send` (node_modules/@hiveio/hive-js/lib/broadcast/index.js:64-83)
 * exactly; `broadcast.parity.test.ts` asserts every op the wallet emits signs byte-identically to the
 * legacy named-helper path (mainnet + testnet).
 *
 * `signTx()` is the ONLY line D9b Stage B replaces with an IPC round-trip, so it stays a standalone
 * export with a stable shape (prepared tx in, signed tx out).
 */

// The single sign step. hive.auth.signTransaction ignores the key's role LABEL and signs with the WIF
// value only (it iterates `for (key in keys)`), so a single-entry object reproduces the legacy
// `{ [roles[0]]: wif }` signature byte-for-byte regardless of which role name we pass.
export function signTx(preparedTx: any, role: string, wif: string): any {
  return hive.auth.signTransaction(preparedTx, { [role]: wif });
}

export async function signAndBroadcast(tx: UnsignedTx, role: string, wif: string): Promise<any> {
  const prepared = await hive.broadcast._prepareTransaction({
    operations: tx.operations,
    extensions: tx.extensions || [],
  });

  // hive.broadcast.send applies this rewrite AFTER _prepareTransaction (lib/broadcast/index.js:67-70);
  // replicate it verbatim or testnet signatures diverge from the legacy path.
  if (hive.config.get('address_prefix') === 'TST') {
    prepared.operations = JSON.parse(
      JSON.stringify(prepared.operations).replace(/ HIVE/g, ' TESTS')
    );
    prepared.operations = JSON.parse(
      JSON.stringify(prepared.operations).replace(/ HBD/g, ' TBD')
    );
  }

  const signed = signTx(prepared, role, wif);
  const result = await hive.api.broadcastTransactionAsync(signed);
  // Legacy send() returns `Object.assign({ id: trxId }, result, signed)`. No caller reads `.id`
  // (verified across account.js), so we omit the client-side trxId reconstruction; `signed` (which
  // always carries a non-empty `signatures` array) keeps the returned object truthy for the
  // `if (result)` success checks callers rely on.
  return Object.assign({}, result, signed);
}

const op = (name: string, fields: Record<string, any>): UnsignedTx => ({
  operations: [[name, fields]],
  extensions: [],
});

/**
 * One builder per operation the wallet broadcasts. Each maps the caller's plainly-named fields to the
 * exact hive-js operation field names (the error-prone part) and picks the operation's canonical role
 * (roles[0] — the same one the legacy named helper used). Both account.js and the parity test call
 * THESE functions, so the parity test guards the construction account.js actually ships.
 */
export const broadcastOps = {
  transfer: (wif: string, p: any) =>
    signAndBroadcast(op('transfer', { from: p.from, to: p.to, amount: p.amount, memo: p.memo }), 'active', wif),

  transferToSavings: (wif: string, p: any) =>
    signAndBroadcast(
      op('transfer_to_savings', { from: p.from, to: p.to, amount: p.amount, memo: p.memo }),
      'active',
      wif
    ),

  transferFromSavings: (wif: string, p: any) =>
    signAndBroadcast(
      op('transfer_from_savings', {
        from: p.from,
        request_id: p.requestId,
        to: p.to,
        amount: p.amount,
        memo: p.memo,
      }),
      'active',
      wif
    ),

  transferToVesting: (wif: string, p: any) =>
    signAndBroadcast(op('transfer_to_vesting', { from: p.from, to: p.to, amount: p.amount }), 'active', wif),

  delegateVestingShares: (wif: string, p: any) =>
    signAndBroadcast(
      op('delegate_vesting_shares', {
        delegator: p.delegator,
        delegatee: p.delegatee,
        vesting_shares: p.vestingShares,
      }),
      'active',
      wif
    ),

  withdrawVesting: (wif: string, p: any) =>
    signAndBroadcast(
      op('withdraw_vesting', { account: p.account, vesting_shares: p.vestingShares }),
      'active',
      wif
    ),

  setWithdrawVestingRoute: (wif: string, p: any) =>
    signAndBroadcast(
      op('set_withdraw_vesting_route', {
        from_account: p.fromAccount,
        to_account: p.toAccount,
        percent: p.percent,
        auto_vest: p.autoVest,
      }),
      'active',
      wif
    ),

  accountWitnessVote: (wif: string, p: any) =>
    signAndBroadcast(
      op('account_witness_vote', { account: p.account, witness: p.witness, approve: p.approve }),
      'active',
      wif
    ),

  accountWitnessProxy: (wif: string, p: any) =>
    signAndBroadcast(op('account_witness_proxy', { account: p.account, proxy: p.proxy }), 'active', wif),

  convert: (wif: string, p: any) =>
    signAndBroadcast(op('convert', { owner: p.owner, requestid: p.requestid, amount: p.amount }), 'active', wif),

  collateralizedConvert: (wif: string, p: any) =>
    signAndBroadcast(
      op('collateralized_convert', { owner: p.owner, requestid: p.requestid, amount: p.amount }),
      'active',
      wif
    ),

  customJson: (wif: string, p: any) =>
    signAndBroadcast(
      op('custom_json', {
        required_auths: p.requiredAuths,
        required_posting_auths: p.requiredPostingAuths,
        id: p.id,
        json: p.json,
      }),
      p.role || 'posting',
      wif
    ),

  claimRewardBalance: (wif: string, p: any) =>
    signAndBroadcast(
      op('claim_reward_balance', {
        account: p.account,
        reward_hive: p.reward_hive,
        reward_hbd: p.reward_hbd,
        reward_vests: p.reward_vests,
      }),
      'posting',
      wif
    ),
};
