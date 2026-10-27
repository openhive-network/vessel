/**
 * Phase 4 · T2a — the both-engines parity proof.
 *
 * Runs hive-tx 7.2.0 (the incoming engine) side-by-side against the committed hive-js baselines in
 * hiveParity.fixtures.ts and asserts hive-tx reproduces them. This is landed BEFORE the facade swap
 * (T2b), so the money-path engine change is proven green before any production file changes. The
 * helpers here (digest, key derivation, memo, isWif) are exactly the logic the T2b facade will move
 * into hiveApi.ts.
 *
 * Signing is NON-deterministic in hive-tx (noble extraEntropy) — Hive signatures are not reproducible
 * byte-for-byte (finding F1). So we assert byte-identical DIGEST (the preimage the chain actually
 * signs, which proves serialization + chain-id handling) + cryptographic signature VERIFICATION, never
 * signature equality.
 *
 * Requires the hive-tx patch (patches/hive-tx+7.2.0.patch): F2 reads config.chain_id fresh inside
 * digest() (else testnet digests are wrong), and the bs58 cjs-interop unwrap (else WIF encode throws).
 * THROWAWAY keys/passwords only; no network, no broadcast.
 */
import { describe, it, expect, afterAll } from 'vitest';
import hive from '@hiveio/hive-js';
import { PrivateKey, PublicKey, Transaction, Memo, config as hiveTxConfig } from 'hive-tx';
import { bytesToHex } from '@noble/hashes/utils.js';

import {
  MAINNET,
  TESTNET,
  FIXED_TAPOS,
  DIGEST_FIXTURES,
  KEY_ROLE_FIXTURES,
  MASTER_CHAIN_FIXTURE,
  WHITESPACE_FIXTURES,
  MEMO_FIXTURES,
  ISWIF_FIXTURES,
  HiveOperation,
} from '../hiveParity.fixtures';

// hive-js's login-seed normalization: trim + collapse [\t\n\v\f\r space] runs to a single space.
// hive-tx's PrivateKey.fromLogin does NOT do this (finding F4), so the facade owns derivation itself.
const normalizeBrainKey = (s: string): string => s.trim().split(/[\t\n\v\f\r ]+/).join(' ');

// --- the exact primitives the T2b facade will implement over hive-tx ---
function hiveTxDigestHex(operations: HiveOperation[], chainId: string, prefix: string): string {
  hiveTxConfig.chain_id = chainId;
  hiveTxConfig.address_prefix = prefix;
  const tx = { ...FIXED_TAPOS, operations, extensions: [], signatures: [] };
  // hive-tx types operations as a strict union; Vessel is a general signer with dynamic ops.
  return bytesToHex(new Transaction({ transaction: tx as any }).digest().digest);
}
const deriveWif = (account: string, password: string, role: string): string =>
  PrivateKey.fromSeed(normalizeBrainKey(account + role + password)).toString();
const derivePub = (wif: string, prefix: string = MAINNET.prefix): string =>
  PrivateKey.from(wif).createPublic(prefix).toString();
const hiveTxIsWif = (input: string): boolean => {
  try {
    PrivateKey.fromString(input);
    return true;
  } catch {
    return false;
  }
};

afterAll(() => {
  hiveTxConfig.chain_id = MAINNET.chainId;
  hiveTxConfig.address_prefix = MAINNET.prefix;
  hive.config.set('chain_id', MAINNET.chainId);
  hive.config.set('address_prefix', MAINNET.prefix);
});

describe('T2a digests — hive-tx reproduces the hive-js signing digest byte-for-byte', () => {
  DIGEST_FIXTURES.forEach((f) => {
    it(`${f.name}: mainnet + testnet digest`, () => {
      expect(hiveTxDigestHex(f.mainnetOperations, MAINNET.chainId, MAINNET.prefix)).toBe(
        f.mainnetDigestHex
      );
      expect(hiveTxDigestHex(f.testnetOperations, TESTNET.chainId, TESTNET.prefix)).toBe(
        f.testnetDigestHex
      );
    });
  });
});

describe('T2a key derivation — hive-tx (facade-normalized) matches hive-js', () => {
  KEY_ROLE_FIXTURES.forEach((f) => {
    it(`${f.name}: brainKey + wif + pub`, () => {
      expect(normalizeBrainKey(f.account + f.role + f.password)).toBe(f.brainKey);
      expect(deriveWif(f.account, f.password, f.role)).toBe(f.wif);
      expect(derivePub(f.wif)).toBe(f.pub);
    });
  });

  it('master chain (Create.js): seedHex -> master -> "P"+master -> {owner,active,posting,memo}', () => {
    const f = MASTER_CHAIN_FIXTURE;
    expect(deriveWif(f.account, f.seedHex, 'master')).toBe(f.master.wif);
    expect(derivePub(f.master.wif)).toBe(f.master.pub);
    const password = `P${f.master.wif}`;
    expect(password).toBe(f.derivedPassword);
    (['owner', 'active', 'posting', 'memo'] as const).forEach((role) => {
      expect(deriveWif(f.account, password, role)).toBe(f.roles[role].wif);
      expect(derivePub(f.roles[role].wif)).toBe(f.roles[role].pub);
    });
  });

  WHITESPACE_FIXTURES.forEach((f) => {
    it(`whitespace ${f.name}: ${f.note}`, () => {
      expect(normalizeBrainKey(f.account + f.role + f.password)).toBe(f.normalizedBrainKey);
      expect(deriveWif(f.account, f.password, f.role)).toBe(f.wif);
      expect(derivePub(f.wif)).toBe(f.pub);
    });
  });
});

describe('T2a memo — cross-engine decode both directions (blobs differ by random nonce)', () => {
  MEMO_FIXTURES.forEach((f) => {
    it(`${f.name}: hive-tx decodes the hive-js blob; hive-js decodes a hive-tx blob`, () => {
      // hive-tx decodes the captured hive-js-produced blob, under both recipient and sender keys.
      expect(Memo.decode(f.recipientPriv, f.encoded)).toBe(f.decodedMessage);
      expect(Memo.decode(f.senderPriv, f.encoded)).toBe(f.decodedMessage);
      // The reverse: hive-js decodes a fresh hive-tx-produced blob (random nonce -> not byte-equal).
      hive.config.set('address_prefix', MAINNET.prefix);
      const txBlob = Memo.encode(f.senderPriv, f.recipientPub, f.message);
      expect(hive.memo.decode(f.recipientPriv, txBlob)).toBe(f.decodedMessage);
    });
  });
});

describe('T2a isWif — hive-tx vs hive-js (documenting the known UTF-8 leniency divergence)', () => {
  ISWIF_FIXTURES.forEach((f) => {
    const isDivergent = /utf-8|collision|leniency/i.test(f.note ?? '');
    it(`${f.name}${isDivergent ? ' (known divergence)' : ''}`, () => {
      if (isDivergent) {
        // hive-js false-positives here (compares the checksum as UTF-8, collapsing bytes to U+FFFD);
        // hive-tx byte-compares and correctly returns false. The facade must decide whether to keep
        // hive-js's leniency for the wrong-password oracle — recorded, not silently changed.
        expect(hive.auth.isWif(f.input)).toBe(true);
        expect(hiveTxIsWif(f.input)).toBe(false);
      } else {
        expect(hiveTxIsWif(f.input)).toBe(f.isWif);
      }
    });
  });
});

describe('T2a signatures — non-deterministic but cryptographically valid + cross-engine verifiable', () => {
  const mainnetDigest = (operations: HiveOperation[]): Uint8Array => {
    hiveTxConfig.chain_id = MAINNET.chainId;
    hiveTxConfig.address_prefix = MAINNET.prefix;
    return new Transaction({
      transaction: { ...FIXED_TAPOS, operations, extensions: [], signatures: [] } as any,
    }).digest().digest;
  };

  it('hive-tx signs a digest to a signature that verifies against the digest + signer pubkey', () => {
    const key = PrivateKey.fromSeed('vessel-parity-throwaway-signer');
    const pub = key.createPublic(MAINNET.prefix);
    const digest = mainnetDigest(DIGEST_FIXTURES[0].mainnetOperations);
    const sig = key.sign(digest);
    expect(pub.verify(digest, sig)).toBe(true);
    // Non-determinism (F1): two signatures over the same digest differ (customToString = 130-char hex),
    // yet both verify.
    const sig2 = key.sign(digest);
    expect(sig.customToString()).not.toBe(sig2.customToString());
    expect(pub.verify(digest, sig2)).toBe(true);
  });

  it('a hive-js signature verifies under a hive-tx PublicKey (engines are signature-interoperable)', () => {
    hive.config.set('chain_id', MAINNET.chainId);
    hive.config.set('address_prefix', MAINNET.prefix);
    const wif = deriveWif('vesselparityx', 'throwaway-pw-123', 'active');
    const pub = derivePub(wif);
    const tx = { ...FIXED_TAPOS, operations: DIGEST_FIXTURES[0].mainnetOperations, extensions: [] };
    const signed = hive.auth.signTransaction(tx, { active: wif });
    const digest = mainnetDigest(DIGEST_FIXTURES[0].mainnetOperations);
    // hive-js attached exactly one signature (deterministic); it must verify under the hive-tx pubkey.
    expect(signed.signatures).toHaveLength(1);
    expect(PublicKey.fromString(pub).verify(digest, signed.signatures[0])).toBe(true);
  });
});
