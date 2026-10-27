/**
 * Phase 1 · Task 7 tests — HF28 authority-role selection (spec §10.4 + REVISION C4/D1/D2/13.8/C8).
 * Pure: imports only authorityRoles.
 */
import {
  requiredRoleForOp,
  requiredRoleForOps,
  keySatisfiesRole,
  requiredRoleForAction,
  MixedAuthorityError,
  NoOperationsError,
  AuthorityRole,
} from '../authorityRoles';

const roleOf = (name: string, payload: any = {}) =>
  [...requiredRoleForOp(name, payload).roles].sort().join('+');

describe('requiredRoleForOp — op table', () => {
  it('active / posting / owner spot checks', () => {
    ['transfer', 'delegate_vesting_shares', 'convert', 'account_witness_vote', 'withdraw_vesting'].forEach(
      (op) => expect(roleOf(op)).toBe('active'),
    );
    ['vote', 'comment', 'claim_reward_balance', 'delete_comment'].forEach((op) =>
      expect(roleOf(op)).toBe('posting'),
    );
    ['decline_voting_rights', 'change_recovery_account', 'recover_account'].forEach((op) =>
      expect(roleOf(op)).toBe('owner'),
    );
  });
  it('unknown op -> active + unrecognized', () => {
    const r = requiredRoleForOp('some_new_op_2030', {});
    expect([...r.roles]).toEqual(['active']);
    expect(r.unrecognized).toBe(true);
  });
});

describe('custom_json + owner escalation (C4/13.8)', () => {
  it('custom_json posting / active / both', () => {
    expect(roleOf('custom_json', {})).toBe('posting');
    expect(roleOf('custom_json', { required_posting_auths: ['a'] })).toBe('posting');
    expect(roleOf('custom_json', { required_auths: ['a'] })).toBe('active');
    expect(roleOf('custom_json', { required_auths: ['a'], required_posting_auths: ['a'] })).toBe(
      'active+posting',
    );
  });
  it('account_update{,2} escalates to owner ONLY for an owner authority OBJECT', () => {
    expect(roleOf('account_update', { owner: { weight_threshold: 1, key_auths: [] } })).toBe('owner');
    expect(roleOf('account_update2', { owner: { weight_threshold: 1 } })).toBe('owner');
    expect(roleOf('account_update', {})).toBe('active'); // no owner field
  });
  it('does NOT escalate ops whose `owner` is the account-NAME string (the C3 regression fix)', () => {
    expect(roleOf('convert', { owner: 'alice', requestid: 1 })).toBe('active');
    expect(roleOf('limit_order_create', { owner: 'alice', orderid: 1 })).toBe('active');
    expect(roleOf('witness_update', { owner: 'alice' })).toBe('active');
    expect(roleOf('account_update', { owner: 'alice' })).toBe('active'); // string, not authority object
  });
});

describe('requiredRoleForOps — collapse / mixed / empty', () => {
  it('single-authority txs collapse to the highest role', () => {
    expect(requiredRoleForOps([['vote', {}]]).role).toBe('posting');
    expect(requiredRoleForOps([['transfer', {}], ['convert', { owner: 'a' }]]).role).toBe('active');
    expect(requiredRoleForOps([['transfer', {}], ['decline_voting_rights', {}]]).role).toBe('owner');
  });
  it('mixed posting + active -> MixedAuthorityError (before any network call)', () => {
    expect(() => requiredRoleForOps([['vote', {}], ['transfer', {}]])).toThrow(MixedAuthorityError);
    // a single custom_json requiring both auths is itself mixed
    expect(() =>
      requiredRoleForOps([['custom_json', { required_auths: ['a'], required_posting_auths: ['a'] }]]),
    ).toThrow(MixedAuthorityError);
  });
  it('empty ops -> NoOperationsError', () => {
    expect(() => requiredRoleForOps([])).toThrow(NoOperationsError);
  });
  it('propagates the unrecognized flag', () => {
    expect(requiredRoleForOps([['brand_new_op', {}]]).unrecognized).toBe(true);
    expect(requiredRoleForOps([['transfer', {}]]).unrecognized).toBe(false);
  });
});

describe('keySatisfiesRole — HF28 9-cell matrix + capabilities', () => {
  const M: Array<[string, AuthorityRole, boolean]> = [
    ['posting', 'posting', true],
    ['active', 'posting', false],
    ['owner', 'posting', false],
    ['posting', 'active', false],
    ['active', 'active', true],
    ['owner', 'active', true],
    ['posting', 'owner', false],
    ['active', 'owner', false],
    ['owner', 'owner', true],
  ];
  it('matrix', () => {
    M.forEach(([keyType, required, expected]) =>
      expect(keySatisfiesRole(keyType, required)).toBe(expected),
    );
  });
  it('capability object grants an explicit role (an active+posting key can post)', () => {
    expect(keySatisfiesRole('active', 'posting', { active: true, posting: true })).toBe(true);
    expect(keySatisfiesRole('active', 'posting', { active: true })).toBe(false);
  });
});

describe('requiredRoleForAction', () => {
  it('claimRewardBalance / customJson / send / transfer', () => {
    expect(requiredRoleForAction('claimRewardBalance', {})).toBe('posting');
    expect(requiredRoleForAction('customJson', { permission: 'active' })).toBe('active');
    expect(requiredRoleForAction('customJson', {})).toBe('posting');
    expect(requiredRoleForAction('send', { operations: [['transfer', {}]] })).toBe('active');
    expect(requiredRoleForAction('transfer', {})).toBe('active');
  });
  it('send with empty operations -> NoOperationsError', () => {
    expect(() => requiredRoleForAction('send', { operations: [] })).toThrow(NoOperationsError);
  });
});
