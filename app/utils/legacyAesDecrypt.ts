/**
 * Phase 1 · Task 2 — PERMANENT legacy decrypt path (D9 layer 3). NEVER remove this.
 *
 * Decrypts the shipped crypto-js ciphertext `CryptoJS.AES.encrypt(wif, password).toString()`, i.e.
 * OpenSSL passphrase format: base64( "Salted__" || salt[8] || AES-256-CBC(pkcs7(pt)) ), with key+iv
 * derived by EVP_BytesToKey(MD5, 1 iteration). Reimplemented on @noble (crypto-js removed in Commit E);
 * exact equivalence is proven by hardcoded vectors in keyEnvelope.test.ts.
 */
import { md5 } from '@noble/hashes/legacy'; // v1.x path (verified; '@noble/hashes/md5' is NOT exported)
import { cbc } from '@noble/ciphers/aes';
import { b64decode, utf8encode, utf8decode, concat } from './bytes';
import { WrongPasswordError, InvalidCiphertextError } from './errors';

const SALTED = [0x53, 0x61, 0x6c, 0x74, 0x65, 0x64, 0x5f, 0x5f]; // "Salted__"

export function legacyAesDecrypt(ciphertextB64: string, password: string): string {
  // structural: base64 decode + Salted__ header + block length -> InvalidCiphertextError (13.10 boundary)
  let data: Uint8Array;
  try {
    data = b64decode(ciphertextB64);
  } catch {
    throw new InvalidCiphertextError('not valid base64');
  }
  if (data.length < 17 || !SALTED.every((b, i) => data[i] === b)) {
    throw new InvalidCiphertextError('not OpenSSL Salted__ format');
  }
  if ((data.length - 16) % 16 !== 0) {
    throw new InvalidCiphertextError('bad block length');
  }

  const salt = data.slice(8, 16);
  const payload = data.slice(16);
  const pw = utf8encode(password);
  const d0 = md5(concat(pw, salt));
  const d1 = md5(concat(d0, pw, salt));
  const d2 = md5(concat(d1, pw, salt));
  const key = concat(d0, d1); // 32 bytes -> AES-256
  const iv = d2; // 16 bytes

  // auth/padding + strict UTF-8 -> WrongPasswordError (the caller's hive.auth.isWif closes the last gap, §3.4)
  let plain: Uint8Array;
  try {
    plain = cbc(key, iv).decrypt(payload); // noble validates + strips PKCS#7
  } catch {
    throw new WrongPasswordError('legacy decrypt failed');
  }
  try {
    return utf8decode(plain);
  } catch {
    throw new WrongPasswordError('legacy decrypt produced invalid utf-8');
  }
}
