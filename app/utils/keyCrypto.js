// @flow
import crypto from 'crypto';
import { promisify } from 'util';
import hive from '@hiveio/hive-js';

const CryptoJS = require('crypto-js');

const scrypt = promisify(crypto.scrypt);

const FORMAT_VERSION = 1;
const KDF_NAME = 'scrypt';
const CIPHER_NAME = 'aes-256-gcm';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// OWASP's scrypt recommendation (128 MiB of memory per derivation).
const DEFAULT_SCRYPT = { N: 2 ** 17, r: 8, p: 1 };
// Upper bounds for parameters read back from storage, so a tampered store
// cannot make an unlock allocate unbounded memory.
const MAX_SCRYPT_N = 2 ** 20;
const MAX_SCRYPT_R = 32;
const MAX_SCRYPT_P = 16;

export type EncryptedKey = {
  version: number,
  kdf: { name: string, N: number, r: number, p: number, salt: string },
  cipher: { name: string, iv: string, tag: string },
  ciphertext: string
};

export class KeyDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyDecryptionError';
  }
}

function deriveKey(password: string, salt: Buffer, { N, r, p }) {
  // Node's default maxmem (32 MiB) is below what N=2^17, r=8 needs.
  return scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
}

/**
 * True when `stored` is a key encrypted by the legacy crypto-js passphrase
 * mode (a base64 string), which must be re-encrypted after the next unlock.
 */
export function isLegacyKey(stored: mixed): boolean {
  return typeof stored === 'string';
}

/**
 * Encrypts a WIF with `password` into the current versioned format:
 * scrypt key derivation and AES-256-GCM, with a fresh CSPRNG salt and IV.
 */
export async function encryptKey(wif: string, password: string): Promise<EncryptedKey> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt, DEFAULT_SCRYPT);
  const cipher = crypto.createCipheriv(CIPHER_NAME, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(wif, 'utf8'), cipher.final()]);
  return {
    version: FORMAT_VERSION,
    kdf: { name: KDF_NAME, ...DEFAULT_SCRYPT, salt: salt.toString('base64') },
    cipher: { name: CIPHER_NAME, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') },
    ciphertext: ciphertext.toString('base64')
  };
}

function isBoundedInteger(value, max) {
  return Number.isInteger(value) && value > 0 && value <= max;
}

function decodeBase64(value, length) {
  if (typeof value !== 'string') {
    throw new KeyDecryptionError('Stored key is malformed.');
  }
  const bytes = Buffer.from(value, 'base64');
  if (length !== undefined && bytes.length !== length) {
    throw new KeyDecryptionError('Stored key is malformed.');
  }
  return bytes;
}

async function decryptCurrent(stored: EncryptedKey, password: string): Promise<string> {
  const { version, kdf, cipher } = stored;
  if (version !== FORMAT_VERSION || !kdf || kdf.name !== KDF_NAME || !cipher || cipher.name !== CIPHER_NAME) {
    throw new KeyDecryptionError('Stored key uses an unsupported format.');
  }
  const { N, r, p } = kdf;
  // scrypt requires N to be a power of two.
  if (!isBoundedInteger(N, MAX_SCRYPT_N) || (N & (N - 1)) !== 0 || N < 2
    || !isBoundedInteger(r, MAX_SCRYPT_R) || !isBoundedInteger(p, MAX_SCRYPT_P)) {
    throw new KeyDecryptionError('Stored key has invalid key derivation parameters.');
  }
  const salt = decodeBase64(kdf.salt, SALT_LENGTH);
  const iv = decodeBase64(cipher.iv, IV_LENGTH);
  const tag = decodeBase64(cipher.tag, TAG_LENGTH);
  const ciphertext = decodeBase64(stored.ciphertext);
  const key = await deriveKey(password, salt, { N, r, p });
  const decipher = crypto.createDecipheriv(CIPHER_NAME, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plaintext = decipher.update(ciphertext);
  try {
    return Buffer.concat([plaintext, decipher.final()]).toString('utf8');
  } catch (e) {
    // GCM authentication failure: wrong password or modified data.
    throw new KeyDecryptionError('Incorrect password.');
  }
}

function decryptLegacy(stored: string, password: string): string {
  let wif;
  try {
    wif = CryptoJS.AES.decrypt(stored, password).toString(CryptoJS.enc.Utf8);
  } catch (e) {
    // crypto-js throws "Malformed UTF-8 data" for most wrong passwords.
    throw new KeyDecryptionError('Incorrect password.');
  }
  // The legacy format is unauthenticated; the WIF checksum is the only
  // signal that the password was right.
  if (!hive.auth.isWif(wif)) {
    throw new KeyDecryptionError('Incorrect password.');
  }
  return wif;
}

/**
 * Decrypts a stored key (current or legacy format) with `password` and
 * returns the WIF. Throws KeyDecryptionError on a wrong password, tampered
 * data or an unsupported format; never returns unauthenticated plaintext.
 */
export async function decryptKey(stored: EncryptedKey | string, password: string): Promise<string> {
  if (isLegacyKey(stored)) {
    return decryptLegacy((stored: any), password);
  }
  if (!stored || typeof stored !== 'object') {
    throw new KeyDecryptionError('Stored key is malformed.');
  }
  return decryptCurrent(stored, password);
}
