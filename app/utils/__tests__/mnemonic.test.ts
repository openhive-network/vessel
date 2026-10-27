/**
 * Phase 1 · Task 6 tests — BIP39 equivalence (spec §10.5). Pure: imports only mnemonic.
 */
import { generateMnemonic12, mnemonicToSeedHex, isValidMnemonic } from '../mnemonic';

const TREZOR =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TREZOR_SEED =
  '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4';

describe('mnemonic', () => {
  it('matches the BIP39 reference vector (empty passphrase)', () => {
    expect(mnemonicToSeedHex(TREZOR)).toBe(TREZOR_SEED);
  });
  it('generateMnemonic12 yields 12 valid words, unique per call', () => {
    const m = generateMnemonic12();
    expect(m.split(' ')).toHaveLength(12);
    expect(isValidMnemonic(m)).toBe(true);
    expect(generateMnemonic12()).not.toBe(m);
  });
  it('rejects an invalid mnemonic', () => {
    expect(isValidMnemonic('not a real mnemonic phrase at all zzz')).toBe(false);
  });
});
