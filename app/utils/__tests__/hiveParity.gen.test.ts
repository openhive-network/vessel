/**
 * Phase 4 · T0 — hive-js parity BASELINE self-check.
 *
 * This suite re-derives every constant in hiveParity.fixtures.ts from the LIVE @hiveio/hive-js 2.0.4
 * (still installed at T0) and asserts it matches the committed baseline. It PROVES the fixtures are a
 * faithful snapshot of hive-js today, and it will keep proving so on every CI run until hive-js is
 * removed — at which point the hive-tx facade must reproduce the same fixtures to stay green.
 *
 * Methods mirror exactly what the capture + verify agents validated:
 *  - digests: sha256( chain_id_bytes || serializer.ops.transaction.toBuffer(tx) ), the preimage
 *    hive-js's Auth.signTransaction hashes (serializer imported from the same deep path the capture
 *    used; digest computed with Node crypto — a different hash engine than hive-js's ecc.hash.sha256,
 *    which the verify agent confirmed produces identical bytes).
 *  - keys: hive.auth.toWif / generateKeys / getPrivateKeys (+ the Create.js master chain).
 *  - memos: hive.memo.decode under BOTH the recipient and sender keys (nonce is random, so we assert
 *    decode(blob) === message and never re-encode).
 *  - isWif: hive.auth.isWif.
 *
 * THROWAWAY keys/passwords/seeds only; no network, no broadcast.
 */

import serializer from '@hiveio/hive-js/lib/auth/serializer';
import hive from '@hiveio/hive-js';
import { createHash } from 'crypto';

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

// hive-js and its serializer read chain params from the global hive.config; set them per assertion.
function useChain(chainId: string, prefix: string): void {
  hive.config.set('address_prefix', prefix);
  hive.config.set('chain_id', chainId);
}

function serializeTxHex(operations: HiveOperation[]): string {
  const tx = { ...FIXED_TAPOS, operations, extensions: [] };
  return serializer.ops.transaction.toBuffer(tx).toString('hex');
}

function digestHex(operations: HiveOperation[], chainId: string): string {
  const tx = { ...FIXED_TAPOS, operations, extensions: [] };
  const buf: Buffer = serializer.ops.transaction.toBuffer(tx);
  const cid = Buffer.from(chainId, 'hex');
  return createHash('sha256').update(Buffer.concat([cid, buf])).digest('hex');
}

// Restore the mainnet default after the suite so no other spec inherits a mutated hive.config.
afterAll(() => {
  useChain(MAINNET.chainId, MAINNET.prefix);
});

describe('T0 digests — sha256(chain_id || serialized_tx) matches live hive-js (mainnet + testnet)', () => {
  DIGEST_FIXTURES.forEach((f) => {
    it(`${f.name}: mainnet serialized hex + digest`, () => {
      useChain(MAINNET.chainId, MAINNET.prefix);
      expect(serializeTxHex(f.mainnetOperations)).toBe(f.mainSerializedTxHex);
      expect(digestHex(f.mainnetOperations, MAINNET.chainId)).toBe(f.mainnetDigestHex);
    });

    it(`${f.name}: testnet serialized hex + digest`, () => {
      useChain(TESTNET.chainId, TESTNET.prefix);
      expect(serializeTxHex(f.testnetOperations)).toBe(f.testSerializedTxHex);
      expect(digestHex(f.testnetOperations, TESTNET.chainId)).toBe(f.testnetDigestHex);
    });
  });
});

describe('T0 key derivation — standard roles match live hive-js', () => {
  beforeEach(() => useChain(MAINNET.chainId, MAINNET.prefix));

  KEY_ROLE_FIXTURES.forEach((f) => {
    it(`${f.name}: wif + pub`, () => {
      expect(hive.auth.toWif(f.account, f.password, f.role)).toBe(f.wif);
      expect(hive.auth.getPrivateKeys(f.account, f.password, [f.role])[f.role]).toBe(f.wif);
      expect(hive.auth.generateKeys(f.account, f.password, [f.role])[f.role]).toBe(f.pub);
      expect(hive.auth.wifToPublic(f.wif)).toBe(f.pub);
    });
  });
});

describe('T0 key derivation — account-creation master chain (Create.js generateSeed)', () => {
  beforeEach(() => useChain(MAINNET.chainId, MAINNET.prefix));

  it('reproduces the seedHex -> master -> "P"+master -> {owner,active,posting,memo} chain', () => {
    const f = MASTER_CHAIN_FIXTURE;

    // Step 1 — master key from the seedHex (used purely as the password argument).
    const master = hive.auth.getPrivateKeys(f.account, f.seedHex, ['master']).master;
    expect(master).toBe(f.master.wif);
    expect(hive.auth.wifToPublic(master)).toBe(f.master.pub);

    // Step 2 — derived wallet password.
    const password = `P${master}`;
    expect(password).toBe(f.derivedPassword);

    // Step 3 — the four role keys (Create.js: generateKeys for pubs, getPrivateKeys for wifs).
    const roles = ['owner', 'active', 'posting', 'memo'] as const;
    const prv = hive.auth.getPrivateKeys(f.account, password, roles as unknown as string[]);
    const pub = hive.auth.generateKeys(f.account, password, roles as unknown as string[]);
    roles.forEach((role) => {
      expect(prv[role]).toBe(f.roles[role].wif);
      expect(pub[role]).toBe(f.roles[role].pub);
    });
  });
});

describe('T0 key derivation — whitespace normalization truth table', () => {
  beforeEach(() => useChain(MAINNET.chainId, MAINNET.prefix));

  WHITESPACE_FIXTURES.forEach((f) => {
    it(`${f.name}: ${f.note}`, () => {
      expect(hive.auth.toWif(f.account, f.password, f.role)).toBe(f.wif);
      expect(hive.auth.generateKeys(f.account, f.password, [f.role])[f.role]).toBe(f.pub);
    });
  });

  it('collapse equivalences hold (tab/newline/double-space === single-space; trailing === none)', () => {
    const wifOf = (name: string) => WHITESPACE_FIXTURES.find((f) => f.name === name)!.wif;
    expect(wifOf('ws-tab')).toBe(wifOf('ws-control-singlespace'));
    expect(wifOf('ws-newline')).toBe(wifOf('ws-control-singlespace'));
    expect(wifOf('ws-internal-double-space')).toBe(wifOf('ws-control-singlespace'));
    expect(wifOf('ws-trailing-space')).toBe(wifOf('ws-control-nows'));
    // A leading space is a real separator, so it must NOT collapse to the no-whitespace value.
    expect(wifOf('ws-leading-space')).not.toBe(wifOf('ws-control-nows'));
  });
});

describe('T0 memo crypto — captured blob decodes to the plaintext under both keys', () => {
  MEMO_FIXTURES.forEach((f) => {
    it(`${f.name}: decode(recipient) and decode(sender) both return the message`, () => {
      // Decrypt with the recipient key (the normal path).
      expect(hive.memo.decode(f.recipientPriv, f.encoded)).toBe(f.decodedMessage);
      // Decrypt with the sender key (the other otherpub branch inside decode) — same plaintext.
      expect(hive.memo.decode(f.senderPriv, f.encoded)).toBe(f.decodedMessage);
      // The blob's embedded from/to public keys are exactly [sender, recipient].
      expect(hive.memo.getPubKeys(f.encoded)).toEqual([f.senderPub, f.recipientPub]);
      // Sanity: the recorded keypairs are internally consistent.
      expect(hive.auth.wifToPublic(f.senderPriv)).toBe(f.senderPub);
      expect(hive.auth.wifToPublic(f.recipientPriv)).toBe(f.recipientPub);
      // Round-trip invariant that survives the swap: a freshly (random-nonce) encoded blob still
      // decodes to the message. We do NOT byte-compare blobs — the nonce makes each encode unique.
      const fresh = hive.memo.encode(f.senderPriv, f.recipientPub, f.message);
      expect(hive.memo.decode(f.recipientPriv, fresh)).toBe(f.decodedMessage);
    });
  });
});

describe('T0 isWif truth table matches live hive-js', () => {
  ISWIF_FIXTURES.forEach((f) => {
    it(`${f.name} -> ${f.isWif}`, () => {
      expect(hive.auth.isWif(f.input)).toBe(f.isWif);
    });
  });
});
