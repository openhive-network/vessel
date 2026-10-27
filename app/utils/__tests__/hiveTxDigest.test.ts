import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { Transaction, config } from 'hive-tx';
import serializer from '@hiveio/hive-js/lib/auth/serializer';

/**
 * patches/hive-tx+7.2.0.patch rewrites how hive-tx computes the transaction digest (the chain id is
 * read from `config.chain_id` at digest time, so Testnet/Mirrornet signing follows the selected node).
 * A regression in that patch would make every signature the wallet produces invalid on chain, so the
 * digest is pinned here: the mainnet digest of a fixed transaction must equal both a recorded value and
 * sha256(chain_id || hive-js serialization) computed independently of hive-tx.
 */
const MAINNET_CHAIN_ID = 'beeab0de00000000000000000000000000000000000000000000000000000000';
const TESTNET_CHAIN_ID = '18dcf0a285365fc58b71f18b3d3fec954aa0c141c44e4e5cb4cf777b9eab274e';

const FIXED_TX = {
  ref_block_num: 1234,
  ref_block_prefix: 5678901,
  expiration: '2030-01-01T00:00:00',
  operations: [['transfer', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'digest pin' }]],
  extensions: [],
};
// sha256(MAINNET_CHAIN_ID || serialized FIXED_TX), recorded from unpatched hive-js.
const MAINNET_DIGEST = '389725919ba89cfa9182e2d3fce74e879f13fe16da84d44265feb8599f3b4f52';

const hiveTxDigest = (): string => {
  const { digest } = new Transaction({ transaction: { ...FIXED_TX, signatures: [] } as any }).digest();
  return Buffer.from(digest).toString('hex');
};

const independentDigest = (chainId: string): string =>
  createHash('sha256')
    .update(Buffer.concat([Buffer.from(chainId, 'hex'), serializer.ops.transaction.toBuffer(FIXED_TX)]))
    .digest('hex');

const originalChainId = config.chain_id;
afterEach(() => {
  config.chain_id = originalChainId;
});

describe('hive-tx transaction digest (patched)', () => {
  it('matches the recorded mainnet digest and the independent hive-js computation', () => {
    config.chain_id = MAINNET_CHAIN_ID;
    expect(independentDigest(MAINNET_CHAIN_ID)).toBe(MAINNET_DIGEST);
    expect(hiveTxDigest()).toBe(MAINNET_DIGEST);
  });

  it('follows config.chain_id, so a testnet node gets a testnet digest', () => {
    config.chain_id = TESTNET_CHAIN_ID;
    expect(hiveTxDigest()).toBe(independentDigest(TESTNET_CHAIN_ID));
    expect(hiveTxDigest()).not.toBe(MAINNET_DIGEST);
  });
});
