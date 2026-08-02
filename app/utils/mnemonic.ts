/**
 * Phase 1 · Task 6 — BIP39 mnemonic helpers on @scure/bip39 (replaces the dead bip39 2.6 API).
 * Same wordlist + derivation, so the user-visible mnemonic UX is unchanged. Pure TS — no legacy imports.
 */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { bytesToHex } from '@noble/hashes/utils';

/** A fresh 12-word (128-bit) mnemonic. */
export function generateMnemonic12(): string {
  return generateMnemonic(wordlist, 128);
}

/** BIP39 seed as a hex string (drop-in for the removed bip39 `mnemonicToSeedHex`). */
export function mnemonicToSeedHex(mnemonic: string, passphrase = ''): string {
  return bytesToHex(mnemonicToSeedSync(mnemonic, passphrase));
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}
