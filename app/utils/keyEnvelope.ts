/**
 * Phase 1 · Task 1 — the v2 key envelope (D9a): scrypt + AES-256-GCM, versioned JSON.
 *
 * Public crypto API for the keystore. `decryptKey` dispatches to the PERMANENT legacy OpenSSL-MD5
 * path (§4) for shipped ciphertext, so an existing wallet always unlocks. Pure TS — imports only
 * @noble primitives + local pure helpers; nothing from legacy `.js`.
 *
 * Operator decisions (REVISION v2/v3/v4): scrypt N=2^16; envelope params are strictly validated with
 * a CONSTANT maxmem and pinned dkLen (no OOM / AES-128 downgrade); base64 boundaries mapped precisely.
 */
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { b64encode, b64decode, utf8encode, utf8decode } from './bytes';
import { WrongPasswordError, InvalidCiphertextError } from './errors';
import { legacyAesDecrypt } from './legacyAesDecrypt';

// Re-export so consumers keep importing the errors from the envelope's public surface (§3.3).
export { WrongPasswordError, InvalidCiphertextError } from './errors';

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  dkLen: number;
}

/** Operator decision (§12 1+3): 2^16 — ~64 MiB, snappier unlock, still strongly GPU/ASIC-resistant. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 65536, r: 8, p: 1, dkLen: 32 };

// Constant memory bound — NEVER derived from the (untrusted) envelope params (13.5). Ample for N<=2^18.
const MAXMEM = 512 * 1024 * 1024;
const N_MIN = 2 ** 14;
const N_MAX = 2 ** 18;

interface KeyEnvelopeV2 {
  v: 2;
  kdf: 'scrypt';
  params: ScryptParams;
  salt: string;
  iv: string;
  ct: string;
}

const isPow2 = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

/** Parse a candidate v2 string; returns the object only if it is shaped like an envelope (v===2, kdf). */
const parseV2 = (s: string): KeyEnvelopeV2 | null => {
  if (typeof s !== 'string' || s.length === 0 || s[0] !== '{') return null;
  let o: unknown;
  try {
    o = JSON.parse(s);
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null) return null;
  const e = o as Record<string, unknown>;
  if (e.v !== 2 || e.kdf !== 'scrypt') return null;
  return e as unknown as KeyEnvelopeV2;
};

/** Full structural validation before any KDF work (13.5): pinned r/p/dkLen, power-of-two N in range. */
const isValidEnvelope = (env: KeyEnvelopeV2): boolean => {
  const p = env.params as unknown as Record<string, unknown> | undefined;
  return (
    !!p &&
    typeof p === 'object' &&
    isPow2(p.N) &&
    (p.N as number) >= N_MIN &&
    (p.N as number) <= N_MAX &&
    p.r === 8 &&
    p.p === 1 &&
    p.dkLen === 32 &&
    typeof env.salt === 'string' &&
    typeof env.iv === 'string' &&
    typeof env.ct === 'string'
  );
};

export function isLegacyFormat(s: string): boolean {
  return typeof s === 'string' && s.startsWith('U2FsdGVkX1');
}

export function isEnvelopeV2(s: string): boolean {
  return parseV2(s) !== null;
}

export function isEncrypted(s: string): boolean {
  return isLegacyFormat(s) || isEnvelopeV2(s);
}

/** True for legacy, or a v2 envelope whose N is below the current default (lazy upgrade on unlock). */
export function needsReencrypt(s: string): boolean {
  if (isLegacyFormat(s)) return true;
  const env = parseV2(s); // guarded: non-envelope inputs return false (D4 — never read params off a string)
  return env !== null && isPow2(env.params?.N) && env.params.N < DEFAULT_SCRYPT_PARAMS.N;
}

export async function encryptKey(
  wif: string,
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<string> {
  if (typeof wif !== 'string' || wif.length === 0) throw new TypeError('wif required');
  if (typeof password !== 'string' || password.length === 0) throw new TypeError('password required');

  const salt = randomBytes(16); // fresh per encryption -> nonce reuse structurally impossible
  const iv = randomBytes(12);
  const key = await scryptAsync(utf8encode(password), salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: params.dkLen,
    maxmem: MAXMEM,
  });
  const pt = utf8encode(wif);
  const ct = gcm(key, iv).encrypt(pt);
  key.fill(0); // best-effort hygiene (non-guaranteed in JS)
  pt.fill(0);

  const env: KeyEnvelopeV2 = {
    v: 2,
    kdf: 'scrypt',
    params: { N: params.N, r: params.r, p: params.p, dkLen: params.dkLen },
    salt: b64encode(salt),
    iv: b64encode(iv),
    ct: b64encode(ct),
  };
  return JSON.stringify(env);
}

async function decryptV2(s: string, password: string): Promise<string> {
  const env = parseV2(s);
  if (env === null || !isValidEnvelope(env)) throw new InvalidCiphertextError('invalid v2 envelope');

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ct: Uint8Array;
  try {
    salt = b64decode(env.salt);
    iv = b64decode(env.iv);
    ct = b64decode(env.ct);
  } catch {
    throw new InvalidCiphertextError('invalid base64 in envelope');
  }
  if (salt.length !== 16 || iv.length !== 12 || ct.length < 17) {
    throw new InvalidCiphertextError('bad field lengths');
  }

  const key = await scryptAsync(utf8encode(password), salt, {
    N: env.params.N,
    r: env.params.r,
    p: env.params.p,
    dkLen: env.params.dkLen,
    maxmem: MAXMEM,
  });
  let plain: Uint8Array;
  try {
    plain = gcm(key, iv).decrypt(ct); // GCM tag mismatch throws -> wrong password
  } catch {
    key.fill(0);
    throw new WrongPasswordError('decrypt failed');
  }
  key.fill(0);
  try {
    return utf8decode(plain);
  } catch {
    throw new WrongPasswordError('decrypt produced invalid utf-8');
  }
}

/**
 * Decrypt a stored key. v2 envelope -> v2 path; shipped legacy blob -> the PERMANENT OpenSSL-MD5 path
 * (D9 layer 3 — NEVER remove); anything else -> InvalidCiphertextError.
 */
export async function decryptKey(ciphertext: string, password: string): Promise<string> {
  if (isEnvelopeV2(ciphertext)) return decryptV2(ciphertext, password);
  if (isLegacyFormat(ciphertext)) return legacyAesDecrypt(ciphertext, password);
  throw new InvalidCiphertextError('unrecognized ciphertext format');
}
