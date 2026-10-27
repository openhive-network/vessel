import hive from '@hiveio/hive-js';
import CryptoJS from 'crypto-js';
import { addKeyConfirmed, getKeyType, KEY_ADD_CONFIRMED } from '../../app/actions/keys';

const wif = hive.auth.toWif('alice', 'correct horse battery staple', 'active');
const publicKey = hive.auth.wifToPublic(wif);

function authority(keys, threshold = 1) {
  return { weight_threshold: threshold, account_auths: [], key_auths: keys };
}

describe('key actions', () => {
  it('derives a valid key pair with hive-js', () => {
    expect(hive.auth.isWif(wif)).toBe(true);
    expect(publicKey).toMatch(/^STM[1-9A-HJ-NP-Za-km-z]{50}$/);
  });

  it('reports the authorities a public key satisfies', () => {
    const account = {
      owner: authority([['STMother', 1]]),
      active: authority([[publicKey, 1]]),
      posting: authority([[publicKey, 1], ['STMother', 1]], 2)
    };
    expect(getKeyType(publicKey, account)).toEqual(['active']);
  });

  it('stores a key encrypted with the password', () => {
    const dispatch = jest.fn();
    addKeyConfirmed('alice', wif, 'active', true, 'secret')(dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe(KEY_ADD_CONFIRMED);
    const stored = action.payload.alice;
    expect(stored).toMatchObject({ account: 'alice', encrypted: true, type: 'active' });
    expect(stored.key).not.toBe(wif);
    expect(CryptoJS.AES.decrypt(stored.key, 'secret').toString(CryptoJS.enc.Utf8)).toBe(wif);
  });
});
