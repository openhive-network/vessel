/**
 * Phase 1 · Task 1/2 tests — the v2 envelope + the PERMANENT legacy decrypt (spec §10.3).
 * Pure: imports only the new crypto modules. Legacy vectors are HARDCODED, generated ONCE from the
 * shipped crypto-js (the proof of byte-for-byte equivalence), via:
 *   node -e "const c=require('crypto-js');console.log(c.AES.encrypt('<WIF>','<PW>').toString())"
 */
import {
  encryptKey,
  decryptKey,
  isLegacyFormat,
  isEnvelopeV2,
  isEncrypted,
  needsReencrypt,
  DEFAULT_SCRYPT_PARAMS,
  WrongPasswordError,
  InvalidCiphertextError,
  ScryptParams,
} from '../keyEnvelope';

// THROWAWAY vectors — publicly-known-format WIFs; NEVER real keys.
const WIF_A = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
const PW = 'correct horse battery staple';
const PW_U = 'pässwörd-🔑';
const SANITY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// HARDCODED crypto-js outputs (OpenSSL Salted__ / EVP_BytesToKey MD5,1 / AES-256-CBC):
const ENC_LEGACY_A =
  'U2FsdGVkX1++++GJvAFPd7c8L8al6eizV3eoMxyn4Teauq+I4ATgDFaIACOM9YiUpdJWMtAs9xIRUeW5L8bcHAypSzUUThTSrEwsHW0RL2M=';
const ENC_LEGACY_A_UNICODE =
  'U2FsdGVkX19bzfg7plLc6qGHwHahXdPJxh3b5KuihZHZyPABgqJnBDd037svd8YO8gst8MV4uba0uemALzr9hmKxOkO4T9/ciR0OPpvVPjs=';
const ENC_LEGACY_SANITY =
  'U2FsdGVkX19YzCQcvTAOyoWXWQ2zadvCnZkEw5XAa40zgxItHTV7XGvXRUF1ZfTsrBblXb8g9Hvz1WHKhx0c13RhZC7Hnl7/1M/G/OnmIah9XgOz21cGVnG+Pyv20T/S';

const FAST: ScryptParams = { N: 2 ** 14, r: 8, p: 1, dkLen: 32 }; // fast but >= the 13.5 validation floor

// Cross-version PARAMOUNT proof: a v2 envelope produced by the OLD @noble v1 code (captured once,
// before the v1->v2 bump). AES-GCM + scrypt are standardized, so the ciphertext is library-version
// independent — this asserts it, so an already-migrated profile can't break when we ship @noble v2.
const ENV_V1_PRODUCED =
  '{"v":2,"kdf":"scrypt","params":{"N":16384,"r":8,"p":1,"dkLen":32},"salt":"rFLWC7jrKdYIz+m/9Mhc4Q==","iv":"nlUuZ7YqUkySUshp","ct":"JRyq3cTqkEPqIhMV5xAjSPdK5UT5vXjkSjxDihdJOflOiP2z4KGfCM4JtPc50sZXp941+HBE4CreJY6L1bhkuSCa+g=="}';

describe('legacy OpenSSL-MD5 decrypt (permanent, D9 layer 3)', () => {
  it('decrypts real crypto-js ciphertext byte-for-byte', async () => {
    expect(await decryptKey(ENC_LEGACY_A, PW)).toBe(WIF_A);
    expect(await decryptKey(ENC_LEGACY_A_UNICODE, PW_U)).toBe(WIF_A);
    expect(await decryptKey(ENC_LEGACY_SANITY, PW)).toBe(SANITY);
  });

  it('rejects a wrong password with WrongPasswordError', async () => {
    await expect(decryptKey(ENC_LEGACY_A, 'wrong')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('rejects garbled / non-Salted__ input with InvalidCiphertextError', async () => {
    await expect(decryptKey('U2FsdGVkX1!!!not-base64!!!', PW)).rejects.toBeInstanceOf(
      InvalidCiphertextError,
    );
    // valid base64 but not a Salted__ blob AND not a v2 envelope -> unrecognized format
    await expect(decryptKey('aGVsbG8gd29ybGQ=', PW)).rejects.toBeInstanceOf(InvalidCiphertextError);
  });
});

describe('v2 envelope cross-version (v1-produced -> v2 decrypt)', () => {
  it('decrypts a v1-@noble-produced envelope byte-for-byte under v2', async () => {
    expect(await decryptKey(ENV_V1_PRODUCED, PW)).toBe(WIF_A);
  });

  it('rejects a wrong password against the v1-produced envelope', async () => {
    await expect(decryptKey(ENV_V1_PRODUCED, 'wrong')).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe('v2 envelope round trip', () => {
  it('encrypts and decrypts (ascii + unicode password)', async () => {
    expect(await decryptKey(await encryptKey(WIF_A, PW, FAST), PW)).toBe(WIF_A);
    expect(await decryptKey(await encryptKey(WIF_A, PW_U, FAST), PW_U)).toBe(WIF_A);
  });

  it('rejects empty wif/password with TypeError', async () => {
    await expect(encryptKey('', PW, FAST)).rejects.toBeInstanceOf(TypeError);
    await expect(encryptKey(WIF_A, '', FAST)).rejects.toBeInstanceOf(TypeError);
  });

  it('uses a fresh salt + iv every time (nonce reuse impossible)', async () => {
    const a = JSON.parse(await encryptKey(WIF_A, PW, FAST));
    const b = JSON.parse(await encryptKey(WIF_A, PW, FAST));
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('wrong password -> WrongPasswordError', async () => {
    await expect(decryptKey(await encryptKey(WIF_A, PW, FAST), 'nope')).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
  });

  it('tampering is caught, never garbage output', async () => {
    const env = JSON.parse(await encryptKey(WIF_A, PW, FAST));
    // flip one DATA char (index 4, never the padding) so byte-length is preserved -> auth failure
    const tamper = (b64: string) => `${b64.slice(0, 4)}${b64[4] === 'A' ? 'B' : 'A'}${b64.slice(5)}`;
    await expect(decryptKey(JSON.stringify({ ...env, ct: tamper(env.ct) }), PW)).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
    await expect(decryptKey(JSON.stringify({ ...env, salt: tamper(env.salt) }), PW)).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
    await expect(decryptKey(JSON.stringify({ ...env, iv: tamper(env.iv) }), PW)).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
    // out-of-range / downgraded params -> structural rejection before any KDF work
    await expect(
      decryptKey(JSON.stringify({ ...env, params: { N: 2 ** 25, r: 8, p: 1, dkLen: 32 } }), PW),
    ).rejects.toBeInstanceOf(InvalidCiphertextError);
    await expect(
      decryptKey(JSON.stringify({ ...env, params: { ...env.params, dkLen: 16 } }), PW),
    ).rejects.toBeInstanceOf(InvalidCiphertextError);
    await expect(
      decryptKey(JSON.stringify({ ...env, params: { ...env.params, N: 1000 } }), PW),
    ).rejects.toBeInstanceOf(InvalidCiphertextError);
  });
});

describe('classification', () => {
  it('isLegacyFormat / isEnvelopeV2 / isEncrypted', async () => {
    const v2 = await encryptKey(WIF_A, PW, FAST);
    expect(isLegacyFormat(ENC_LEGACY_A)).toBe(true);
    expect(isLegacyFormat(v2)).toBe(false);
    expect(isEnvelopeV2(v2)).toBe(true);
    expect(isEnvelopeV2(ENC_LEGACY_A)).toBe(false);
    expect(isEnvelopeV2(WIF_A)).toBe(false); // plaintext WIF
    expect(isEncrypted(ENC_LEGACY_A)).toBe(true);
    expect(isEncrypted(v2)).toBe(true);
    expect(isEncrypted(WIF_A)).toBe(false);
  });

  it('needsReencrypt: legacy true; below-default v2 true; current-default v2 false', async () => {
    expect(needsReencrypt(ENC_LEGACY_A)).toBe(true);
    expect(needsReencrypt(await encryptKey(WIF_A, PW, FAST))).toBe(true); // N=2^14 < default 2^16
    const current = await encryptKey(WIF_A, PW, DEFAULT_SCRYPT_PARAMS);
    expect(needsReencrypt(current)).toBe(false);
    expect(needsReencrypt(WIF_A)).toBe(false); // non-envelope input never throws
  }, 30000);
});

describe('default params (real cost path)', () => {
  it('round-trips at DEFAULT_SCRYPT_PARAMS', async () => {
    expect(await decryptKey(await encryptKey(WIF_A, PW), PW)).toBe(WIF_A);
  }, 30000);
});
