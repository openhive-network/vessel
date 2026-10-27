import { hiveAuth } from '../hiveApi';
import {
  newAccountAuthorities,
  accountAuthoritiesFromPassword,
  freeClaimFee,
} from '../accountCreation';

describe('accountCreation helpers', () => {
  it('newAccountAuthorities wraps each key as a single-key weight-1 authority + bare memo key', () => {
    const auths = newAccountAuthorities({
      owner: 'STM_OWNER',
      active: 'STM_ACTIVE',
      posting: 'STM_POSTING',
      memo: 'STM_MEMO',
    });
    expect(auths.owner).toEqual({
      weight_threshold: 1,
      account_auths: [],
      key_auths: [['STM_OWNER', 1]],
    });
    expect(auths.active.key_auths).toEqual([['STM_ACTIVE', 1]]);
    expect(auths.posting.key_auths).toEqual([['STM_POSTING', 1]]);
    // memo is a BARE public key, not an authority object
    expect(auths.memoKey).toBe('STM_MEMO');
  });

  it('accountAuthoritiesFromPassword derives the same public keys hiveAuth.generateKeys produces', () => {
    const username = 'vessel-new-acct';
    const password = 'P5KcorrecthorsebatterystaplecorrecthorseXYZ';
    const pub = hiveAuth.generateKeys(username, password, ['owner', 'active', 'posting', 'memo']);
    const auths = accountAuthoritiesFromPassword(username, password);
    expect(auths.owner.key_auths[0][0]).toBe(pub.owner);
    expect(auths.active.key_auths[0][0]).toBe(pub.active);
    expect(auths.posting.key_auths[0][0]).toBe(pub.posting);
    expect(auths.memoKey).toBe(pub.memo);
    // deterministic
    expect(accountAuthoritiesFromPassword(username, password)).toEqual(auths);
  });

  it('freeClaimFee zeroes the amount but keeps the chain fee symbol', () => {
    expect(freeClaimFee('3.000 HIVE')).toBe('0.000 HIVE');
    expect(freeClaimFee('3.000 TESTS')).toBe('0.000 TESTS');
    expect(freeClaimFee('  1.234   HIVE ')).toBe('0.000 HIVE');
  });
});
