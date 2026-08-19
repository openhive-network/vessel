/**
 * Phase 1 · Task 7 — HF28 client-side authority-role selection & gating.
 *
 * Post-HF28 a single stored key cannot satisfy both posting and active/owner authority, so a tx that
 * would require both is rejected BEFORE any network call. Pure TS — no legacy imports.
 *
 * REVISION overrides: owner-escalation only for account_update{,2} with an `owner` AUTHORITY OBJECT
 * (C4 — not the account-name string used by convert/limit_order/witness_update); requiredRoleForOp
 * returns {roles:Set, unrecognized}; requiredRoleForOps returns a SCALAR role (+unrecognized) with
 * MixedAuthorityError / NoOperationsError (D1/D2); keySatisfiesRole consults a capability object (C8).
 */
export type AuthorityRole = 'posting' | 'active' | 'owner';

export class MixedAuthorityError extends Error {
  roles: AuthorityRole[];

  constructor(roles: AuthorityRole[]) {
    super(`operation requires multiple authorities in one tx: ${roles.join(' + ')}`);
    this.name = 'MixedAuthorityError';
    this.roles = roles;
  }
}

export class NoOperationsError extends Error {
  constructor() {
    super('no operations to authorize');
    this.name = 'NoOperationsError';
  }
}

export interface OpRoleResult {
  roles: Set<AuthorityRole>;
  unrecognized: boolean;
}
export interface TxRoleResult {
  role: AuthorityRole; // the single highest role the whole tx needs
  unrecognized: boolean;
}
/** Capability flags recorded at key-add time (KEY_ADD_CONFIRM); optional, additive (I-2). */
export interface RoleCapabilities {
  owner?: boolean;
  active?: boolean;
  posting?: boolean;
  memo?: boolean;
}

/** Chain-required authority per operation type (Hive protocol, post-HF28). */
export const OPERATION_AUTHORITY: Record<string, AuthorityRole> = {
  vote: 'posting',
  comment: 'posting',
  comment_options: 'posting',
  delete_comment: 'posting',
  claim_reward_balance: 'posting',
  transfer: 'active',
  transfer_to_vesting: 'active',
  transfer_to_savings: 'active',
  transfer_from_savings: 'active',
  cancel_transfer_from_savings: 'active',
  withdraw_vesting: 'active',
  set_withdraw_vesting_route: 'active',
  delegate_vesting_shares: 'active',
  convert: 'active',
  collateralized_convert: 'active',
  limit_order_create: 'active',
  limit_order_create2: 'active',
  limit_order_cancel: 'active',
  account_witness_vote: 'active',
  account_witness_proxy: 'active',
  witness_update: 'active',
  witness_set_properties: 'active',
  account_create: 'active',
  account_create_with_delegation: 'active',
  account_update: 'active', // escalated to owner only when payload.owner is an authority object
  account_update2: 'active', // "
  decline_voting_rights: 'owner',
  change_recovery_account: 'owner',
  recover_account: 'owner',
  request_account_recovery: 'owner',
  reset_account: 'owner',
};

// Only these ops carry a real `owner` AUTHORITY object; every other op's `owner` field is an account name.
const OWNER_ESCALATION_OPS = new Set(['account_update', 'account_update2']);

export function requiredRoleForOp(opName: string, opPayload: any): OpRoleResult {
  if (opName === 'custom_json') {
    const roles = new Set<AuthorityRole>();
    if (Array.isArray(opPayload?.required_auths) && opPayload.required_auths.length > 0) {
      roles.add('active');
    }
    if (Array.isArray(opPayload?.required_posting_auths) && opPayload.required_posting_auths.length > 0) {
      roles.add('posting');
    }
    if (roles.size === 0) roles.add('posting'); // no auths listed -> posting
    return { roles, unrecognized: false };
  }
  if (
    OWNER_ESCALATION_OPS.has(opName) &&
    opPayload &&
    typeof opPayload.owner === 'object' &&
    opPayload.owner !== null
  ) {
    return { roles: new Set<AuthorityRole>(['owner']), unrecognized: false };
  }
  const known = OPERATION_AUTHORITY[opName];
  if (known) return { roles: new Set<AuthorityRole>([known]), unrecognized: false };
  return { roles: new Set<AuthorityRole>(['active']), unrecognized: true }; // unknown -> fail-safe active + flag
}

/**
 * Collapse a whole tx to the single highest role it needs. Throws NoOperationsError on empty input and
 * MixedAuthorityError when posting cannot coexist with active/owner (unsatisfiable by one key post-HF28).
 */
export function requiredRoleForOps(ops: Array<[string, any]>): TxRoleResult {
  if (!Array.isArray(ops) || ops.length === 0) throw new NoOperationsError();
  const union = new Set<AuthorityRole>();
  let unrecognized = false;
  ops.forEach(([name, payload]) => {
    const r = requiredRoleForOp(name, payload);
    r.roles.forEach((x) => union.add(x));
    unrecognized = unrecognized || r.unrecognized;
  });
  if (union.has('posting') && (union.has('active') || union.has('owner'))) {
    throw new MixedAuthorityError([...union]);
  }
  let role: AuthorityRole = 'posting';
  if (union.has('owner')) role = 'owner';
  else if (union.has('active')) role = 'active';
  return { role, unrecognized };
}

/**
 * HF28-conservative satisfaction: posting requires EXACTLY posting (active/owner no longer implicitly
 * satisfy posting); active accepts active or owner; owner requires owner. A recorded capability object
 * (C8) grants a role when explicitly true (a key that is both active AND posting satisfies posting).
 */
export function keySatisfiesRole(
  keyType: string,
  required: AuthorityRole,
  roles?: RoleCapabilities,
): boolean {
  if (roles && roles[required] === true) return true;
  if (required === 'posting') return keyType === 'posting';
  if (required === 'active') return keyType === 'active' || keyType === 'owner';
  return keyType === 'owner';
}

/** App action-creator name -> role for useKey's gate (names are AccountActions exports). */
export function requiredRoleForAction(operation: string, params: any): AuthorityRole {
  switch (operation) {
    case 'claimRewardBalance':
      return 'posting';
    case 'customJson':
      return params?.permission === 'active' ? 'active' : 'posting';
    case 'send':
      return requiredRoleForOps(params?.operations ?? []).role; // may throw Mixed/NoOperations
    case 'transfer':
    case 'transferToSavings':
    case 'transferFromSavings':
    case 'convert':
    case 'collateralizedConvert':
    case 'powerUp':
    case 'withdrawVesting':
    case 'cancelWithdrawVesting':
    case 'setWithdrawVestingRoute':
    case 'setDelegateVestingShares':
    case 'setVotingProxy':
    case 'voteWitness':
    case 'createAccount':
    case 'claimAccountToken':
      return 'active';
    default:
      console.warn(`[authority] unknown operation '${operation}', requiring 'active'`);
      return 'active';
  }
}
