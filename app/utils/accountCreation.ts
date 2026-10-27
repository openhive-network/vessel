import { hiveAuth } from './hiveApi';

/**
 * Helpers for building account-creation operations (account_create / create_claimed_account /
 * claim_account). Kept pure and separate from broadcast.ts so the authority construction — the
 * error-prone part — is unit-tested. A wrong authority here would create an account whose keys the
 * user can't control, so this is money-path-adjacent.
 */

export interface Authority {
  weight_threshold: number;
  account_auths: [string, number][];
  key_auths: [string, number][];
}

export interface NewAccountAuthorities {
  owner: Authority;
  active: Authority;
  posting: Authority;
  memoKey: string;
}

const singleKeyAuthority = (publicKey: string): Authority => ({
  weight_threshold: 1,
  account_auths: [],
  key_auths: [[publicKey, 1]],
});

/** Wrap a new account's four PUBLIC keys as the authority objects the create ops expect. */
export function newAccountAuthorities(pub: {
  owner: string;
  active: string;
  posting: string;
  memo: string;
}): NewAccountAuthorities {
  return {
    owner: singleKeyAuthority(pub.owner),
    active: singleKeyAuthority(pub.active),
    posting: singleKeyAuthority(pub.posting),
    memoKey: pub.memo,
  };
}

/**
 * Derive the new account's public keys from (username, password) — the SAME derivation Keys/Create
 * uses (`hiveAuth.generateKeys`) — and wrap them as authorities. The password only derives the keys
 * here; it is never persisted or logged by this function.
 */
export function accountAuthoritiesFromPassword(
  username: string,
  password: string
): NewAccountAuthorities {
  const pub = hiveAuth.generateKeys(username, password, ['owner', 'active', 'posting', 'memo']) as {
    owner: string;
    active: string;
    posting: string;
    memo: string;
  };
  return newAccountAuthorities(pub);
}

/**
 * The zero fee for an RC-based (free) claim_account, in the same asset symbol as the chain's
 * account_creation_fee (e.g. "3.000 HIVE" -> "0.000 HIVE"). Using the chain's own symbol avoids
 * hardcoding HIVE vs TESTS across mainnet/mirrornet/testnet.
 */
export function freeClaimFee(accountCreationFee: string): string {
  const symbol = accountCreationFee.trim().split(/\s+/)[1] || 'HIVE';
  return `0.000 ${symbol}`;
}
