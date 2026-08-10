import { describe, it, expect } from 'vitest';
import { describeOp } from '../signSummary';

/** Phase 3 · Task 5 — plain-language op descriptions shown in the confirm-and-sign modal. */
describe('describeOp', () => {
  it('describes a transfer with amount, parties and memo', () => {
    const s = describeOp(['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'gm' }]);
    expect(s).toContain('1.000 HIVE');
    expect(s).toContain('@alice');
    expect(s).toContain('@bob');
    expect(s).toContain('gm');
  });

  it('omits the memo clause when there is no memo', () => {
    const s = describeOp(['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '' }]);
    expect(s).not.toContain('memo');
  });

  it('describes savings, power-up/down, delegation, witness, vote and reward ops', () => {
    expect(describeOp(['transfer_to_savings', { from: 'a', to: 'b', amount: '2.000 HBD' }])).toMatch(/savings/i);
    expect(describeOp(['transfer_to_vesting', { from: 'a', to: 'b', amount: '5.000 HIVE' }])).toMatch(/power up/i);
    expect(describeOp(['withdraw_vesting', { account: 'a', vesting_shares: '10.0 VESTS' }])).toMatch(/power down/i);
    expect(describeOp(['delegate_vesting_shares', { delegator: 'a', delegatee: 'b', vesting_shares: '3.0 VESTS' }])).toMatch(/delegate/i);
    expect(describeOp(['account_witness_vote', { account: 'a', witness: 'w', approve: true }])).toMatch(/vote for witness @w/i);
    expect(describeOp(['account_witness_vote', { account: 'a', witness: 'w', approve: false }])).toMatch(/unvote/i);
    expect(describeOp(['vote', { voter: 'a', author: 'b', permlink: 'p', weight: 10000 }])).toMatch(/vote on @b\/p/i);
    expect(describeOp(['vote', { voter: 'a', author: 'b', permlink: 'p', weight: -100 }])).toMatch(/downvote/i);
    expect(describeOp(['claim_reward_balance', { account: 'a' }])).toMatch(/claim rewards/i);
  });

  it('flags account authority/key changes explicitly', () => {
    expect(describeOp(['account_update', { account: 'a' }])).toMatch(/authorities\/keys/i);
    expect(describeOp(['account_update2', { account: 'a' }])).toMatch(/authorities\/keys/i);
  });

  it('falls back to the raw op name for unknown types (never throws)', () => {
    expect(describeOp(['some_future_op', { x: 1 }])).toBe('Operation: some_future_op');
    expect(describeOp(['weird', {}])).toBe('Operation: weird');
  });

  it('handles malformed input without throwing', () => {
    expect(describeOp(null as any)).toBe('Unrecognized operation');
    expect(describeOp(['transfer'] as any)).toContain('Transfer'); // missing params -> undefineds, no throw
  });
});
