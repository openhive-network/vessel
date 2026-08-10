/**
 * hiveParity.fixtures.ts
 *
 * Provenance: captured from @hiveio/hive-js 2.0.4 — the pre-swap baseline for the Phase 4 hive-tx
 * parity proof (T0).
 *
 * These are ground-truth values recorded WHILE @hiveio/hive-js 2.0.4 is the installed Hive client, so
 * that the later swap to hive-tx can be PROVEN to match byte-for-byte. Every value here was computed
 * twice by two independent methods and cross-checked (digests additionally verified by secp256k1
 * public-key recovery from a real hive-js signature; keys by an independent elliptic/@scure
 * reimplementation; memos by an independent Node-crypto ECDH+AES decrypt) before being committed.
 *
 * The companion suite app/utils/__tests__/hiveParity.gen.test.ts re-derives each of these from the
 * LIVE hive-js while it is still installed and asserts equality — so this file is self-proving until
 * hive-js is removed, at which point the hive-tx facade must reproduce every value below.
 *
 * SAFETY: every key/password/seed here is a THROWAWAY generated for this baseline only. No real key,
 * no network call, no broadcast was ever involved.
 *
 * ── Two signing surfaces (see CRITIC notes) ────────────────────────────────────────────────────────
 * The 16 digest fixtures cover Vessel's ACTUAL broadcast/money path (broadcastOps in
 * app/utils/broadcast.ts) in full — every op the wallet emits, both mainnet and testnet — plus vote,
 * comment and account_update. Vessel is ALSO a general-purpose signer (app/utils/signPayload.ts has no
 * op allowlist), so the wider URI/PromptOperation signing surface has ops NOT baselined here
 * (account_create, account_create_with_delegation, feed_publish, witness_update, account_update2,
 * cancel_transfer_from_savings, and an account_update carrying an owner-AUTHORITY object). Those
 * exercise serialization families (authority objects, price objects, in-body public keys, props
 * assets) that none of the fixtures below touch. They are intentionally omitted rather than fabricated
 * — see conductorMustCheck / the T0 scope decision.
 */


export type HiveOperation = [string, Record<string, any>];

export interface ChainConfig {
  /** hive.config chain_id (hex) used for the signing preimage. */
  chainId: string;
  /** hive.config address_prefix. */
  prefix: string;
}

/** Mainnet chain config (hive-js default, Vessel-authoritative). */
export const MAINNET: ChainConfig = {
  chainId: 'beeab0de00000000000000000000000000000000000000000000000000000000',
  prefix: 'STM',
};

/**
 * Testnet chain config. NON-AUTHORITATIVE: Vessel does not hardcode a testnet chain_id — it derives
 * one at runtime from the connected node's getConfig (app/routes.tsx). The value below is a documented
 * Hive testnet chain_id used to capture the baseline; every testnetDigestHex is a pure function of
 * THIS exact chain_id and reproduces exactly with it. If Phase 4 targets a specific testnet, re-confirm
 * its chain_id and recompute the testnet digests. The testnet SYMBOL-REWRITE behavior (below) IS
 * Vessel-authoritative.
 */
export const TESTNET: ChainConfig = {
  chainId: '18dcf0a285365b18d34a1a4d1e2e21bcfdb04b4d5c1e6c9c81a6c4e3d1a99cbf',
  prefix: 'TST',
};

/**
 * The fixed tapos wrapped around every op to build the transaction that gets serialized+hashed. Recorded
 * so each digest is exactly reproducible.
 */
export const FIXED_TAPOS = {
  ref_block_num: 12345,
  ref_block_prefix: 1122334455,
  expiration: '2025-01-01T00:00:00',
} as const;

export interface DigestFixture {
  /** Fixture id. */
  name: string;
  /** Operation name (the op family under test). */
  op: string;
  /**
   * The mainnet operations array (on-the-wire field names). hive-js serializes HIVE as the legacy
   * symbol 'STEEM' and HBD as 'SBD' (VESTS stays VESTS) — visible in mainSerializedTxHex. The hive-tx
   * facade MUST replicate that HIVE->STEEM / HBD->SBD mapping or every asset-bearing mainnet digest
   * diverges.
   */
  mainnetOperations: HiveOperation[];
  /**
   * The testnet operations array. For asset-bearing ops this is Vessel's broadcast.ts rewrite applied
   * to the mainnet ops (' HIVE' -> ' TESTS', ' HBD' -> ' TBD'); for account_update the memo_key public
   * key is re-encoded with the TST prefix (same 33 raw bytes). For ops with no assets/keys it is
   * identical to mainnetOperations (only the chain_id differs, so the two digests differ).
   */
  testnetOperations: HiveOperation[];
  /** serializer.ops.transaction.toBuffer(mainnetTx).toString('hex'). */
  mainSerializedTxHex: string;
  /** serializer.ops.transaction.toBuffer(testnetTx).toString('hex'). */
  testSerializedTxHex: string;
  /** sha256( MAINNET.chainId_bytes || mainSerializedTx_bytes ), hex — the 32-byte hash hive-js signs. */
  mainnetDigestHex: string;
  /** sha256( TESTNET.chainId_bytes || testSerializedTx_bytes ), hex. */
  testnetDigestHex: string;
  /** Optional per-fixture note. */
  note?: string;
}

const A = 'alice1throwaway';
const B = 'bob2throwaway';

/**
 * 16 transaction-signing-digest baselines (each × {mainnet, testnet}). The digest is
 * sha256(chain_id_bytes || serialized_tx_bytes) — exactly the preimage hive-js's Auth.signTransaction
 * hashes (confirmed by recovering the signer pubkey from a real signature over this preimage).
 */
export const DIGEST_FIXTURES: DigestFixture[] = [
  {
    name: 'digest_transfer',
    op: 'transfer',
    mainnetOperations: [['transfer', { from: A, to: B, amount: '1.000 HIVE', memo: 'phase4 baseline' }]],
    testnetOperations: [['transfer', { from: A, to: B, amount: '1.000 TESTS', memo: 'phase4 baseline' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701020f616c696365317468726f77617761790d626f62327468726f7761776179e80300000000000003535445454d00000f70686173653420626173656c696e6500',
    testSerializedTxHex:
      '3930f776e5428085746701020f616c696365317468726f77617761790d626f62327468726f7761776179e80300000000000003544553545300000f70686173653420626173656c696e6500',
    mainnetDigestHex: '6cce356e3a5510c3abb87537fd6b1b007a925740415e09f851cff723508173e3',
    testnetDigestHex: '8f751a20ed9ae355dca33c5d32ca58c21c5fbcde5800030d11276909dcd45da3',
  },
  {
    name: 'digest_transfer_to_savings',
    op: 'transfer_to_savings',
    mainnetOperations: [['transfer_to_savings', { from: A, to: B, amount: '2.000 HBD', memo: 'savings baseline' }]],
    testnetOperations: [['transfer_to_savings', { from: A, to: B, amount: '2.000 TBD', memo: 'savings baseline' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701200f616c696365317468726f77617761790d626f62327468726f7761776179d007000000000000035342440000000010736176696e677320626173656c696e6500',
    testSerializedTxHex:
      '3930f776e5428085746701200f616c696365317468726f77617761790d626f62327468726f7761776179d007000000000000035442440000000010736176696e677320626173656c696e6500',
    mainnetDigestHex: '6472be3ae95b117c2c42841a03342aaa68e6e26ee6c5cc3572105b6efc90b185',
    testnetDigestHex: 'd198616da0305061ef71298330ae0ef22d31185702ab8e93660824e977d10730',
  },
  {
    name: 'digest_transfer_from_savings',
    op: 'transfer_from_savings',
    mainnetOperations: [
      ['transfer_from_savings', { from: A, request_id: 101, to: B, amount: '0.500 HBD', memo: 'from savings' }],
    ],
    testnetOperations: [
      ['transfer_from_savings', { from: A, request_id: 101, to: B, amount: '0.500 TBD', memo: 'from savings' }],
    ],
    mainSerializedTxHex:
      '3930f776e5428085746701210f616c696365317468726f7761776179650000000d626f62327468726f7761776179f40100000000000003534244000000000c66726f6d20736176696e677300',
    testSerializedTxHex:
      '3930f776e5428085746701210f616c696365317468726f7761776179650000000d626f62327468726f7761776179f40100000000000003544244000000000c66726f6d20736176696e677300',
    mainnetDigestHex: '5212cb68d36307031e9ab739ce3d21bd079c817eb9e37741e023cc0cc7221913',
    testnetDigestHex: '0ee830660096b07c08c84d752983a1cb75aa1a2e55ad6373525c6e98623c196a',
  },
  {
    name: 'digest_transfer_to_vesting',
    op: 'transfer_to_vesting',
    mainnetOperations: [['transfer_to_vesting', { from: A, to: B, amount: '5.000 HIVE' }]],
    testnetOperations: [['transfer_to_vesting', { from: A, to: B, amount: '5.000 TESTS' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701030f616c696365317468726f77617761790d626f62327468726f7761776179881300000000000003535445454d000000',
    testSerializedTxHex:
      '3930f776e5428085746701030f616c696365317468726f77617761790d626f62327468726f77617761798813000000000000035445535453000000',
    mainnetDigestHex: 'cd88887b35b74bd4d71965297ebfd9f56a06ebcc0cf3823d160d59fb7b807f0d',
    testnetDigestHex: 'af117ccece6b568693cad9bca3adf1a9506116e7f20ff5aa2a29ad2d0bba4847',
  },
  {
    name: 'digest_delegate_vesting_shares',
    op: 'delegate_vesting_shares',
    mainnetOperations: [['delegate_vesting_shares', { delegator: A, delegatee: B, vesting_shares: '100.000000 VESTS' }]],
    testnetOperations: [['delegate_vesting_shares', { delegator: A, delegatee: B, vesting_shares: '100.000000 VESTS' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701280f616c696365317468726f77617761790d626f62327468726f776177617900e1f50500000000065645535453000000',
    testSerializedTxHex:
      '3930f776e5428085746701280f616c696365317468726f77617761790d626f62327468726f776177617900e1f50500000000065645535453000000',
    mainnetDigestHex: '81989f8d3ae96b08fdc62faba9501bb5ef21117b95f189ca95789627b5656fa1',
    testnetDigestHex: 'c6a6a8f542a0123a953a98bc493862be5f9538f6f78a3cf2abbd589586f9b004',
    note: 'VESTS unchanged by the symbol rewrite; testnet buffer differs from mainnet ONLY in chain_id.',
  },
  {
    name: 'digest_withdraw_vesting',
    op: 'withdraw_vesting',
    mainnetOperations: [['withdraw_vesting', { account: A, vesting_shares: '1000.000000 VESTS' }]],
    testnetOperations: [['withdraw_vesting', { account: A, vesting_shares: '1000.000000 VESTS' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701040f616c696365317468726f776177617900ca9a3b00000000065645535453000000',
    testSerializedTxHex:
      '3930f776e5428085746701040f616c696365317468726f776177617900ca9a3b00000000065645535453000000',
    mainnetDigestHex: 'efcd33a7d4a8fe9be97dccad46dd2da1328c04135db504af59ceb9d500efa614',
    testnetDigestHex: '1d58f6c6a033d411849bc26f4bc338b092c9552c7942a8796cd78616a4e9827e',
  },
  {
    name: 'digest_set_withdraw_vesting_route',
    op: 'set_withdraw_vesting_route',
    mainnetOperations: [
      ['set_withdraw_vesting_route', { from_account: A, to_account: B, percent: 5000, auto_vest: true }],
    ],
    testnetOperations: [
      ['set_withdraw_vesting_route', { from_account: A, to_account: B, percent: 5000, auto_vest: true }],
    ],
    mainSerializedTxHex:
      '3930f776e5428085746701140f616c696365317468726f77617761790d626f62327468726f776177617988130100',
    testSerializedTxHex:
      '3930f776e5428085746701140f616c696365317468726f77617761790d626f62327468726f776177617988130100',
    mainnetDigestHex: '74a4c9d9a8e80c4d2a701a0cd8cd1885849df098e6e3ac0cf5e47190bc520c5b',
    testnetDigestHex: 'dad67c37fb9dd5a5c5bc9b306b7b8be60947a4b2246a1e624621e376d43e164b',
  },
  {
    name: 'digest_account_witness_vote',
    op: 'account_witness_vote',
    mainnetOperations: [['account_witness_vote', { account: A, witness: 'witness3throwaway', approve: true }]],
    testnetOperations: [['account_witness_vote', { account: A, witness: 'witness3throwaway', approve: true }]],
    mainSerializedTxHex:
      '3930f776e54280857467010c0f616c696365317468726f7761776179117769746e657373337468726f77617761790100',
    testSerializedTxHex:
      '3930f776e54280857467010c0f616c696365317468726f7761776179117769746e657373337468726f77617761790100',
    mainnetDigestHex: '18d3a63e4d5f055c7eef8de729d2878e85ac6cf2525ea84ee8fdf629da52f1db',
    testnetDigestHex: 'c1a5ca9c458066d4505cfcdc3b0058cc7e404454d9d5df2fc1a64cd41fb43ebe',
  },
  {
    name: 'digest_account_witness_proxy',
    op: 'account_witness_proxy',
    mainnetOperations: [['account_witness_proxy', { account: A, proxy: 'proxy4throwaway' }]],
    testnetOperations: [['account_witness_proxy', { account: A, proxy: 'proxy4throwaway' }]],
    mainSerializedTxHex:
      '3930f776e54280857467010d0f616c696365317468726f77617761790f70726f7879347468726f776177617900',
    testSerializedTxHex:
      '3930f776e54280857467010d0f616c696365317468726f77617761790f70726f7879347468726f776177617900',
    mainnetDigestHex: '7ace07ec2d641021cc8956de8a693f5704023b867994def46d8326687fbeeb43',
    testnetDigestHex: 'e593ef47a7eda5549292862a05c5e8331ff432206c05d3f98ee7dab6f89cb4d9',
  },
  {
    name: 'digest_convert',
    op: 'convert',
    mainnetOperations: [['convert', { owner: A, requestid: 202, amount: '1.000 HBD' }]],
    testnetOperations: [['convert', { owner: A, requestid: 202, amount: '1.000 TBD' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701080f616c696365317468726f7761776179ca000000e803000000000000035342440000000000',
    testSerializedTxHex:
      '3930f776e5428085746701080f616c696365317468726f7761776179ca000000e803000000000000035442440000000000',
    mainnetDigestHex: '4fd81c51ee3b684ee861e12c0a311332219f7c5fdd2810d75136b43367c2b714',
    testnetDigestHex: 'c5ac08ff9a6e188cf8203ab7b5c9a13d5f503340dd73c8ca84253a85f6991802',
  },
  {
    name: 'digest_collateralized_convert',
    op: 'collateralized_convert',
    mainnetOperations: [['collateralized_convert', { owner: A, requestid: 303, amount: '3.000 HIVE' }]],
    testnetOperations: [['collateralized_convert', { owner: A, requestid: 303, amount: '3.000 TESTS' }]],
    mainSerializedTxHex:
      '3930f776e5428085746701300f616c696365317468726f77617761792f010000b80b00000000000003535445454d000000',
    testSerializedTxHex:
      '3930f776e5428085746701300f616c696365317468726f77617761792f010000b80b000000000000035445535453000000',
    mainnetDigestHex: '9f5285f3f64f53f1ec24b8ed3ff59f9798e591aab3ce42b3695e3038283844d8',
    testnetDigestHex: 'da19705bd8a621c7595dc619b133118f33169ad15667bedcaff4988c49e862fb',
  },
  {
    name: 'digest_custom_json',
    op: 'custom_json',
    mainnetOperations: [
      [
        'custom_json',
        {
          required_auths: [],
          required_posting_auths: [A],
          id: 'follow',
          json: '["follow",{"follower":"alice1throwaway","following":"bob2throwaway","what":["blog"]}]',
        },
      ],
    ],
    testnetOperations: [
      [
        'custom_json',
        {
          required_auths: [],
          required_posting_auths: [A],
          id: 'follow',
          json: '["follow",{"follower":"alice1throwaway","following":"bob2throwaway","what":["blog"]}]',
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e54280857467011200010f616c696365317468726f776177617906666f6c6c6f77555b22666f6c6c6f77222c7b22666f6c6c6f776572223a22616c696365317468726f7761776179222c22666f6c6c6f77696e67223a22626f62327468726f7761776179222c2277686174223a5b22626c6f67225d7d5d00',
    testSerializedTxHex:
      '3930f776e54280857467011200010f616c696365317468726f776177617906666f6c6c6f77555b22666f6c6c6f77222c7b22666f6c6c6f776572223a22616c696365317468726f7761776179222c22666f6c6c6f77696e67223a22626f62327468726f7761776179222c2277686174223a5b22626c6f67225d7d5d00',
    mainnetDigestHex: '9d22268eaec610ff67b80c537f51d0ba98f8bd65f9cfea8d1a032d9dba5d56eb',
    testnetDigestHex: '539b50d20675400b4d2783a6990fe25e1da9cf09b4945d1c753b9750a2dd1c25',
    note: 'The signing DIGEST is role-independent — Vessel signs custom_json with p.role||"posting", but the role only selects the signing key, not the serialized bytes, so this digest holds for any role.',
  },
  {
    name: 'digest_claim_reward_balance',
    op: 'claim_reward_balance',
    mainnetOperations: [
      [
        'claim_reward_balance',
        { account: A, reward_hive: '0.000 HIVE', reward_hbd: '0.000 HBD', reward_vests: '0.000000 VESTS' },
      ],
    ],
    testnetOperations: [
      [
        'claim_reward_balance',
        { account: A, reward_hive: '0.000 TESTS', reward_hbd: '0.000 TBD', reward_vests: '0.000000 VESTS' },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e5428085746701270f616c696365317468726f7761776179000000000000000003535445454d0000000000000000000003534244000000000000000000000000065645535453000000',
    testSerializedTxHex:
      '3930f776e5428085746701270f616c696365317468726f776177617900000000000000000354455354530000000000000000000003544244000000000000000000000000065645535453000000',
    mainnetDigestHex: '5d144514aa943eaad54fbd7fba85f22defd044655a277c14defdb3724c2341f2',
    testnetDigestHex: 'fa49da908ee3c5f180770d1f5132c24ef841482de84e6ed7c53c55f621318b3e',
  },
  {
    name: 'digest_vote',
    op: 'vote',
    mainnetOperations: [['vote', { voter: A, author: B, permlink: 'a-test-post', weight: 10000 }]],
    testnetOperations: [['vote', { voter: A, author: B, permlink: 'a-test-post', weight: 10000 }]],
    mainSerializedTxHex:
      '3930f776e5428085746701000f616c696365317468726f77617761790d626f62327468726f77617761790b612d746573742d706f7374102700',
    testSerializedTxHex:
      '3930f776e5428085746701000f616c696365317468726f77617761790d626f62327468726f77617761790b612d746573742d706f7374102700',
    mainnetDigestHex: 'c103671cafce04a6087dc7fd57fabe4d82e006f9193b451f2e41b36504435034',
    testnetDigestHex: 'f4a6d004ddc44c610864c1c1e8883e2a0fd21ac18a8a0ad3bdfa39b3d0d75f24',
  },
  {
    name: 'digest_comment',
    op: 'comment',
    mainnetOperations: [
      [
        'comment',
        {
          parent_author: '',
          parent_permlink: 'hive-100',
          author: A,
          permlink: 'my-permlink',
          title: 'Title',
          body: 'Body text',
          json_metadata: '{"tags":["test"]}',
        },
      ],
    ],
    testnetOperations: [
      [
        'comment',
        {
          parent_author: '',
          parent_permlink: 'hive-100',
          author: A,
          permlink: 'my-permlink',
          title: 'Title',
          body: 'Body text',
          json_metadata: '{"tags":["test"]}',
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e5428085746701010008686976652d3130300f616c696365317468726f77617761790b6d792d7065726d6c696e6b055469746c6509426f64792074657874117b2274616773223a5b2274657374225d7d00',
    testSerializedTxHex:
      '3930f776e5428085746701010008686976652d3130300f616c696365317468726f77617761790b6d792d7065726d6c696e6b055469746c6509426f64792074657874117b2274616773223a5b2274657374225d7d00',
    mainnetDigestHex: '01dc227a20536caf6aeb71e82fba27cf34fd47b83447f162f98b9c4044c1478d',
    testnetDigestHex: '29691d60bf884b29c52ba41ee6a2a6688bdb460678b6397e48c5878ca55c1678',
  },
  {
    name: 'digest_account_update',
    op: 'account_update',
    mainnetOperations: [
      [
        'account_update',
        {
          account: A,
          memo_key: 'STM6Qsna1iyqApiYUyP5DXJXRVQ6rtppcTxyPZoY9FBiPTcYuaHf3',
          json_metadata: '{"profile":{"name":"A"}}',
        },
      ],
    ],
    testnetOperations: [
      [
        'account_update',
        {
          account: A,
          memo_key: 'TST6Qsna1iyqApiYUyP5DXJXRVQ6rtppcTxyPZoY9FBiPTcYuaHf3',
          json_metadata: '{"profile":{"name":"A"}}',
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e54280857467010a0f616c696365317468726f776177617900000002c8b1673b2a9e5d5855cd758ec61cb92f5761f3cca30a2f816cbf87f4fb0cc757187b2270726f66696c65223a7b226e616d65223a2241227d7d00',
    testSerializedTxHex:
      '3930f776e54280857467010a0f616c696365317468726f776177617900000002c8b1673b2a9e5d5855cd758ec61cb92f5761f3cca30a2f816cbf87f4fb0cc757187b2270726f66696c65223a7b226e616d65223a2241227d7d00',
    mainnetDigestHex: '217bf96f275ed5dc5381f2794d15a29154a013bc6909db628634500cae83c328',
    testnetDigestHex: '1da6bda91cc640be4d90e8a4b070a1a3385cf7f82e87271f5856e3472572ff8c',
    note:
      'NOT in Vessel broadcastOps; only serializes memo_key + json_metadata (no owner/active/posting authority object — that branch is untested here). memo_key prefix (STM/TST) must match address_prefix or the serializer throws; the 33 raw pubkey bytes are identical, so mainSerializedTxHex === testSerializedTxHex and the two digests differ only by chain_id.',
  },
  {
    name: 'digest_account_create',
    op: 'account_create',
    mainnetOperations: [
      [
        'account_create',
        {
          fee: '3.000 HIVE',
          creator: A,
          new_account_name: 'newacct7xthrow',
          owner: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM7y8YBTEPUkrRDPhBCodShYzSxV15t95mftnf9D5XuswBLTfhDk', 1]], // seed: phase4-uri-account_create-authority-seed
          },
          active: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM7y8YBTEPUkrRDPhBCodShYzSxV15t95mftnf9D5XuswBLTfhDk', 1]], // same ac_auth pubkey
          },
          posting: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM7y8YBTEPUkrRDPhBCodShYzSxV15t95mftnf9D5XuswBLTfhDk', 1]], // same ac_auth pubkey
          },
          memo_key: 'STM7T84ybLEiooB16o2AgENZDAL9KYNxXyuvpfsgv2nxDrw1iuoC5', // seed: phase4-uri-account_create-memo-seed
          json_metadata: '',
        },
      ],
    ],
    testnetOperations: [
      [
        'account_create',
        {
          fee: '3.000 TESTS',
          creator: A,
          new_account_name: 'newacct7xthrow',
          owner: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST7y8YBTEPUkrRDPhBCodShYzSxV15t95mftnf9D5XuswBLTfhDk', 1]],
          },
          active: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST7y8YBTEPUkrRDPhBCodShYzSxV15t95mftnf9D5XuswBLTfhDk', 1]],
          },
          posting: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST7y8YBTEPUkrRDPhBCodShYzSxV15t95mftnf9D5XuswBLTfhDk', 1]],
          },
          memo_key: 'TST7T84ybLEiooB16o2AgENZDAL9KYNxXyuvpfsgv2nxDrw1iuoC5',
          json_metadata: '',
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e542808574670109b80b00000000000003535445454d00000f616c696365317468726f77617761790e6e65776163637437787468726f770100000000010395a062e67242048a565723ec4c4aed728a77cf1cfa491e99f4d6dc3e8bf70f0601000100000000010395a062e67242048a565723ec4c4aed728a77cf1cfa491e99f4d6dc3e8bf70f0601000100000000010395a062e67242048a565723ec4c4aed728a77cf1cfa491e99f4d6dc3e8bf70f06010003517d4e5864b731d0243171ac6c3c945ca079913f9b7479944ea8bb1ffd4d56390000',
    testSerializedTxHex:
      '3930f776e542808574670109b80b00000000000003544553545300000f616c696365317468726f77617761790e6e65776163637437787468726f770100000000010395a062e67242048a565723ec4c4aed728a77cf1cfa491e99f4d6dc3e8bf70f0601000100000000010395a062e67242048a565723ec4c4aed728a77cf1cfa491e99f4d6dc3e8bf70f0601000100000000010395a062e67242048a565723ec4c4aed728a77cf1cfa491e99f4d6dc3e8bf70f06010003517d4e5864b731d0243171ac6c3c945ca079913f9b7479944ea8bb1ffd4d56390000',
    mainnetDigestHex: 'e8577e2cb974abd2ebe064431edce78cd34ebb7eea294e108773ab2e292b66c5',
    testnetDigestHex: '6f05427760661c98cd00df2d16eb1f7089c3d01890f325b48da284081d0ebeca',
    note:
      'SERIALIZATION FAMILY: authority objects (owner/active/posting) + fee asset. The one ac_auth pubkey fills all three key_auths (weight_threshold 1, empty account_auths); a separate ac_memo pubkey is memo_key. fee is legacy-symbol STEEM on mainnet (535445454d) / TESTS on testnet. Testnet re-encodes all 4 pubkeys STM->TST (same 33 raw bytes) and fee HIVE->TESTS; digests differ. Serializer did not throw.',
  },
  {
    name: 'digest_account_create_with_delegation',
    op: 'account_create_with_delegation',
    mainnetOperations: [
      [
        'account_create_with_delegation',
        {
          fee: '3.000 HIVE',
          delegation: '100.000000 VESTS',
          creator: A,
          new_account_name: 'newacct8ythrow',
          owner: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM6X4TSGLDzEJdxodkuMvEB4JauWUgfmRquHYei3AHiV23RNFycw', 1]], // seed: phase4-uri-account_create_with_delegation-authority-seed
          },
          active: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM6X4TSGLDzEJdxodkuMvEB4JauWUgfmRquHYei3AHiV23RNFycw', 1]], // same acd_auth pubkey
          },
          posting: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM6X4TSGLDzEJdxodkuMvEB4JauWUgfmRquHYei3AHiV23RNFycw', 1]], // same acd_auth pubkey
          },
          memo_key: 'STM7VDjBScfWG8icuS11Q7HdoNi6NTBPGe7EWHgXhh98cX2J3W5ZX', // seed: phase4-uri-account_create_with_delegation-memo-seed
          json_metadata: '',
          extensions: [],
        },
      ],
    ],
    testnetOperations: [
      [
        'account_create_with_delegation',
        {
          fee: '3.000 TESTS',
          delegation: '100.000000 VESTS',
          creator: A,
          new_account_name: 'newacct8ythrow',
          owner: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST6X4TSGLDzEJdxodkuMvEB4JauWUgfmRquHYei3AHiV23RNFycw', 1]],
          },
          active: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST6X4TSGLDzEJdxodkuMvEB4JauWUgfmRquHYei3AHiV23RNFycw', 1]],
          },
          posting: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST6X4TSGLDzEJdxodkuMvEB4JauWUgfmRquHYei3AHiV23RNFycw', 1]],
          },
          memo_key: 'TST7VDjBScfWG8icuS11Q7HdoNi6NTBPGe7EWHgXhh98cX2J3W5ZX',
          json_metadata: '',
          extensions: [],
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e542808574670129b80b00000000000003535445454d000000e1f5050000000006564553545300000f616c696365317468726f77617761790e6e65776163637438797468726f7701000000000102d6bc03fee63a9870bf5a99668b39d9b6ca7fc0653d9adfe04a10589c2dbef5e2010001000000000102d6bc03fee63a9870bf5a99668b39d9b6ca7fc0653d9adfe04a10589c2dbef5e2010001000000000102d6bc03fee63a9870bf5a99668b39d9b6ca7fc0653d9adfe04a10589c2dbef5e2010003564093913d3e35f703eb12d3f922344b046e33beb1a2b620ae6ed456841a2487000000',
    testSerializedTxHex:
      '3930f776e542808574670129b80b000000000000035445535453000000e1f5050000000006564553545300000f616c696365317468726f77617761790e6e65776163637438797468726f7701000000000102d6bc03fee63a9870bf5a99668b39d9b6ca7fc0653d9adfe04a10589c2dbef5e2010001000000000102d6bc03fee63a9870bf5a99668b39d9b6ca7fc0653d9adfe04a10589c2dbef5e2010001000000000102d6bc03fee63a9870bf5a99668b39d9b6ca7fc0653d9adfe04a10589c2dbef5e2010003564093913d3e35f703eb12d3f922344b046e33beb1a2b620ae6ed456841a2487000000',
    mainnetDigestHex: '8fc1304d102f0bc5cdebcddf3a1043248badbf7ebaedc87e79795e80824efa76',
    testnetDigestHex: '99c499ced878ccdb52159286fd04ee011a8ca08b823ddd68fea498d1869f1d41',
    note:
      'SERIALIZATION FAMILY: authority objects + fee asset + VESTS delegation + explicit extensions:[]. The delegation 100.000000 VESTS (065645535453 = VESTS, 6 decimals) is NOT symbol-rewritten on testnet — like digest_delegate_vesting_shares; only fee (HIVE->TESTS) and the 4 pubkeys (STM->TST) change. Serializer did not throw.',
  },
  {
    name: 'digest_account_update_owner_authority',
    op: 'account_update',
    mainnetOperations: [
      [
        'account_update',
        {
          account: A,
          owner: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['STM4y6ZNNrergRA5j1cahWafqRtafMtg3h5LD6VUU45LPox3s2FgQ', 1]], // seed: phase4-uri-account_update-owner-authority-seed
          },
          memo_key: 'STM7kyXa8Yu3mBbn6SbwZBsSLYQJbZVB1uNQUJSVMgpnag78gGxGG', // seed: phase4-uri-account_update-owner-memo-seed
          json_metadata: '',
        },
      ],
    ],
    testnetOperations: [
      [
        'account_update',
        {
          account: A,
          owner: {
            weight_threshold: 1,
            account_auths: [],
            key_auths: [['TST4y6ZNNrergRA5j1cahWafqRtafMtg3h5LD6VUU45LPox3s2FgQ', 1]],
          },
          memo_key: 'TST7kyXa8Yu3mBbn6SbwZBsSLYQJbZVB1uNQUJSVMgpnag78gGxGG',
          json_metadata: '',
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e54280857467010a0f616c696365317468726f776177617901010000000001020a75f2442387160b6a6711925035d971dbb0b2f47e4d3e78af99b811400b922f01000000037a06bb141455fab84d6e6f93148031d75a281dd45befe672993229657d3f7b470000',
    testSerializedTxHex:
      '3930f776e54280857467010a0f616c696365317468726f776177617901010000000001020a75f2442387160b6a6711925035d971dbb0b2f47e4d3e78af99b811400b922f01000000037a06bb141455fab84d6e6f93148031d75a281dd45befe672993229657d3f7b470000',
    mainnetDigestHex: '9a8b51143d86243c13d0f77a683782d81a0d147da02a22da1b37f3340a0f7086',
    testnetDigestHex: '9d720e5ce68824a883313ddf0869a88e49d11b47a9f091b29349ace416be04f4',
    note:
      'SERIALIZATION FAMILY: authority-object branch of account_update (distinct from the memo-key-only digest_account_update). owner authority is PRESENT (flag byte 01 -> weight_threshold/account_auths/key_auths); active+posting are absent optionals (00 00). Both pubkeys re-encode STM->TST on testnet with identical 33 raw bytes, so mainSerializedTxHex === testSerializedTxHex and the digests differ only by chain_id. Serializer did not throw.',
  },
  {
    name: 'digest_account_update2',
    op: 'account_update2',
    mainnetOperations: [
      [
        'account_update2',
        {
          account: A,
          json_metadata: '',
          posting_json_metadata: '{"profile":{}}',
          extensions: [],
        },
      ],
    ],
    testnetOperations: [
      [
        'account_update2',
        {
          account: A,
          json_metadata: '',
          posting_json_metadata: '{"profile":{}}',
          extensions: [],
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e54280857467012b0f616c696365317468726f776177617900000000000e7b2270726f66696c65223a7b7d7d0000',
    testSerializedTxHex:
      '3930f776e54280857467012b0f616c696365317468726f776177617900000000000e7b2270726f66696c65223a7b7d7d0000',
    mainnetDigestHex: '7323adb7fc4f67356789e683c71981789ddbb775c5fcb76a54ae130e6d504b25',
    testnetDigestHex: '9c3c7f106cfc47a3760cb74cce88c0112eb3095006cd92dca96e1865c8468340',
    note:
      'SERIALIZATION FAMILY: optional-authority elision. hive-js treats owner/active/posting/memo_key as OPTIONAL and accepts them OMITTED (not null, not empty authority): buffer after the account name is 00 00 00 00 (four absent-optional flags) + 00 (empty json_metadata) + 0e{...} (posting_json_metadata {"profile":{}}) + 00 (empty extensions). No assets, no keys => testnetOperations === mainnetOperations; digests differ only by chain_id. Serializer did not throw. See conductorMustCheck re: the hive-tx facade honoring the same optional elision.',
  },
  {
    name: 'digest_feed_publish',
    op: 'feed_publish',
    mainnetOperations: [['feed_publish', { publisher: A, exchange_rate: { base: '0.500 HBD', quote: '1.000 HIVE' } }]],
    testnetOperations: [['feed_publish', { publisher: A, exchange_rate: { base: '0.500 TBD', quote: '1.000 TESTS' } }]],
    mainSerializedTxHex:
      '3930f776e5428085746701070f616c696365317468726f7761776179f4010000000000000353424400000000e80300000000000003535445454d000000',
    testSerializedTxHex:
      '3930f776e5428085746701070f616c696365317468726f7761776179f4010000000000000354424400000000e803000000000000035445535453000000',
    mainnetDigestHex: '95cdccb19ec8f27de8266a550e85bb9cd3223eca6629737ba633255b3d6b932c',
    testnetDigestHex: '697af851786b07d7cd49e02baab3ef1a25d26116d5c8d31d83995cdfcab27c10',
    note:
      'SERIALIZATION FAMILY: price object (nested double-asset). base 0.500 HBD serializes as legacy SBD (0353424400000000) and quote 1.000 HIVE as legacy STEEM (03535445454d0000) on mainnet — same legacy mapping the existing asset fixtures rely on; testnet rewrites BOTH nested assets HBD->TBD and HIVE->TESTS. No keys. Serializer did not throw.',
  },
  {
    name: 'digest_witness_update',
    op: 'witness_update',
    mainnetOperations: [
      [
        'witness_update',
        {
          owner: A,
          url: 'https://throwaway.example',
          block_signing_key: 'STM7PTSZ7NETaJgKPpRsXyVsaKQLWiCvURgfqCA1MVWnuLNHiTc8J', // seed: phase4-uri-witness_update-block-signing-key-seed
          props: { account_creation_fee: '3.000 HIVE', maximum_block_size: 65536, hbd_interest_rate: 1000 },
          fee: '0.000 HIVE',
        },
      ],
    ],
    testnetOperations: [
      [
        'witness_update',
        {
          owner: A,
          url: 'https://throwaway.example',
          block_signing_key: 'TST7PTSZ7NETaJgKPpRsXyVsaKQLWiCvURgfqCA1MVWnuLNHiTc8J',
          props: { account_creation_fee: '3.000 TESTS', maximum_block_size: 65536, hbd_interest_rate: 1000 },
          fee: '0.000 TESTS',
        },
      ],
    ],
    mainSerializedTxHex:
      '3930f776e54280857467010b0f616c696365317468726f77617761791968747470733a2f2f7468726f77617761792e6578616d706c6503492a561d6bc5ca785ad1c42fd3fcca58a3c6184dcda601613394515e5d428be3b80b00000000000003535445454d000000000100e803000000000000000003535445454d000000',
    testSerializedTxHex:
      '3930f776e54280857467010b0f616c696365317468726f77617761791968747470733a2f2f7468726f77617761792e6578616d706c6503492a561d6bc5ca785ad1c42fd3fcca58a3c6184dcda601613394515e5d428be3b80b000000000000035445535453000000000100e8030000000000000000035445535453000000',
    mainnetDigestHex: 'baf13a3d07f22a46010cf4281174a864692b06b761258f533ebf2b36dd436264',
    testnetDigestHex: '4ff998f0dd0d42f16369ef5eed36960563e06752d3eb7c477d7c90ccd45cb9d5',
    note:
      'SERIALIZATION FAMILY: in-body bare public key + props assets. block_signing_key is a raw 33-byte PublicKey (03492a...be3) NOT wrapped in an authority. props.account_creation_fee (3.000 HIVE) and top-level fee (0.000 HIVE) are BOTH assets (legacy STEEM on mainnet); maximum_block_size 65536 (uint32) and hbd_interest_rate 1000 (uint16) are numeric. Testnet rewrites the pubkey STM->TST and both assets HIVE->TESTS. Serializer did not throw.',
  },
  {
    name: 'digest_cancel_transfer_from_savings',
    op: 'cancel_transfer_from_savings',
    mainnetOperations: [['cancel_transfer_from_savings', { from: A, request_id: 101 }]],
    testnetOperations: [['cancel_transfer_from_savings', { from: A, request_id: 101 }]],
    mainSerializedTxHex: '3930f776e5428085746701220f616c696365317468726f77617761796500000000',
    testSerializedTxHex: '3930f776e5428085746701220f616c696365317468726f77617761796500000000',
    mainnetDigestHex: 'a1767f5401074babc7831921e13cbdd7cf379f4d6c7b856655a58651e3b36340',
    testnetDigestHex: '1ca5b32e8a9667f4693b905b620fcdb439705e5a56fb8bd29467e35879a03564',
    note:
      'SERIALIZATION FAMILY: scalar-only (from + request_id uint32 101 = 65000000 LE), op tag 0x22 = 34. Pairs with the existing digest_transfer_from_savings. No assets, no keys => testnetOperations === mainnetOperations; digests differ only by chain_id. Serializer did not throw.',
  },
];

// ── Key derivation ─────────────────────────────────────────────────────────────────────────────────
//
// hive-js derives every key from a brainKey = normalize(name + role + password), where
// normalize = s.trim().split(/[\t\n\v\f\r ]+/).join(' '); priv = sha256(utf8(brainKey)); the WIF is
// base58check(0x80 || priv) and the public key is 'STM' + base58(compressed_point || ripemd160[:4]).
// The hive-tx facade does NOT normalize — replicating this exact transform is Phase 4 finding F4.
// All vectors are mainnet (STM prefix); testnet TST would change every `pub` string.

export interface KeyRoleFixture {
  name: string;
  /** account name fed to hive.auth. */
  account: string;
  /** owner | active | posting | memo. */
  role: string;
  /** the wallet/login password (throwaway). */
  password: string;
  /** the normalized brainKey hive-js hashes (name+role+password after whitespace normalization). */
  brainKey: string;
  /** private key WIF (hive.auth.toWif / getPrivateKeys). */
  wif: string;
  /** public key (hive.auth.generateKeys / wifToPublic). */
  pub: string;
}

/** THROWAWAY login password shared by the four standard-role vectors. */
export const STANDARD_ACCOUNT = 'vesseltest01';
export const STANDARD_PASSWORD = 'Tr0ub4dour&3-throwaway';

export const KEY_ROLE_FIXTURES: KeyRoleFixture[] = [
  {
    name: 'standard-owner',
    account: STANDARD_ACCOUNT,
    role: 'owner',
    password: STANDARD_PASSWORD,
    brainKey: 'vesseltest01ownerTr0ub4dour&3-throwaway',
    wif: '5JkkoX1QuAn2vuUHJkwgHij8NRHyDLCbJTsmGx9vxWiFxHYuZo8',
    pub: 'STM6MVLmnXZrs2MS8GpbJhWRCnyDrk4xFun2cVuunVhhrAxP2PGJD',
  },
  {
    name: 'standard-active',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: STANDARD_PASSWORD,
    brainKey: 'vesseltest01activeTr0ub4dour&3-throwaway',
    wif: '5KkWtmoQ5fo9ytmDcdYqRmgnXRKSeFp7pxZWMCsWxY7vwyngxUZ',
    pub: 'STM7uk25GKoNRGZMkP5ybCtmACA8AeHnVfuXc96JUViGuv3pknjD6',
  },
  {
    name: 'standard-posting',
    account: STANDARD_ACCOUNT,
    role: 'posting',
    password: STANDARD_PASSWORD,
    brainKey: 'vesseltest01postingTr0ub4dour&3-throwaway',
    wif: '5Hq1wus3oUk9RyCxNcECnMBdRQtFdg9rwdgWZ7o7rTKzHWist79',
    pub: 'STM51ztTpfMMoA39EbbukLdrYUKYrkW4NYykA6UABAGE3vHpFxovb',
  },
  {
    name: 'standard-memo',
    account: STANDARD_ACCOUNT,
    role: 'memo',
    password: STANDARD_PASSWORD,
    brainKey: 'vesseltest01memoTr0ub4dour&3-throwaway',
    wif: '5KejhcDnSqQcgrArY5ewJMh8moQZXsMFeGTvYxvo8ctmm124uMb',
    pub: 'STM6VtVFa4HretdeWuQUicw53XRFYBLhXEmhse32w2Pxszu4skawb',
  },
];

export interface MasterChainFixture {
  account: string;
  /**
   * The seedHex passed as the "password" to derive the master key. This is a deterministic THROWAWAY
   * (sha512 of a fixed label), NOT a real BIP39 seed. Create.js supplies mnemonicToSeedHex(mnemonic)
   * here at runtime, but getPrivateKeys treats seedHex purely as its password argument, so this recorded
   * literal reproduces the whole chain without a mnemonic.
   */
  seedHex: string;
  /** Step 1: getPrivateKeys(account, seedHex, ['master']).master + its public key. */
  master: { brainKey: string; wif: string; pub: string };
  /** Step 2: the derived wallet password 'P' + master.wif (Create.js line 94). */
  derivedPassword: string;
  /** Step 3: the four role keys derived from account + derivedPassword. */
  roles: Record<'owner' | 'active' | 'posting' | 'memo', { wif: string; pub: string }>;
}

/**
 * The account-creation key chain from app/components/Keys/Create.js (generateSeed, lines 93-97):
 * seedHex -> master -> password='P'+master -> {owner, active, posting, memo}.
 */
export const MASTER_CHAIN_FIXTURE: MasterChainFixture = {
  account: STANDARD_ACCOUNT,
  seedHex:
    'e4694df1d4c87ea5a29e87de2529c8e8d78ad04e4eacd45c410ae14fe7f73eb4bbe8caf380dd1884bbe0dd5ba64385191c35dab71ba87cb87fb3f126b87deb09',
  master: {
    brainKey:
      'vesseltest01mastere4694df1d4c87ea5a29e87de2529c8e8d78ad04e4eacd45c410ae14fe7f73eb4bbe8caf380dd1884bbe0dd5ba64385191c35dab71ba87cb87fb3f126b87deb09',
    wif: '5KecVc7uhXacxct7ZiMtqvedSrUwKjcLm19qRXn2t4mkaSmd9TM',
    pub: 'STM7ffjYVey5XsADDsTLp1wtAM6JXBRVth7g7LdStB4SNNPpxPJkJ',
  },
  derivedPassword: 'P5KecVc7uhXacxct7ZiMtqvedSrUwKjcLm19qRXn2t4mkaSmd9TM',
  roles: {
    owner: {
      wif: '5JzHo5DDRtH6s1fBvC5p6ZmwcLbg2h5Mgg4qWtXBqSMbrovJoyB',
      pub: 'STM7Jhs5tQSfeHSskhiJLM6bgdLmagSUrgizyUwqib15rXRzGTAD4',
    },
    active: {
      wif: '5K4fT4cFXoiM9JgkNdzpUF3Bay4rcSAed95yEmPqGuZMWj4isuF',
      pub: 'STM89QwfewHwFNtGFtkZ99ip3Wx6RZDr2sAjS2AkQiqSNxpRBgvtv',
    },
    posting: {
      wif: '5KMd3AYCqkBUp1YT8R4B7exGFjRRbJBmjDbtPnwX6z52cz5e66j',
      pub: 'STM88Atip2Joqac5TMnq2nmgkBTMXmoJt5AD7Tdt4kPSYRrAm5vBw',
    },
    memo: {
      wif: '5JR6jMtGi9f93K3ivpmnJPNGTNxpQAvbSzDzSQQVQAGVZ4ehEq7',
      pub: 'STM75JKu8HNE9mLmMcUP4qiRiRPBoBvbLy2Wb58Z4mhTezmAqgQ7X',
    },
  },
};

export interface WhitespaceFixture {
  name: string;
  account: string;
  role: string;
  /**
   * The raw password, with whitespace written as explicit escapes so the bytes are unambiguous.
   * \x20 = space, \t = tab, \n = newline.
   */
  password: string;
  /** what name+role+password normalizes to (the string hive-js actually hashes). */
  normalizedBrainKey: string;
  wif: string;
  pub: string;
  note: string;
}

/**
 * Whitespace-normalization truth table (all account=vesseltest01, role=active). Proves how hive-js's
 * .trim().split(/[\t\n\v\f\r ]+/).join(' ') collapses whitespace in the brainKey. The hive-tx facade
 * MUST replicate this exact transform or login-derived keys diverge.
 */
export const WHITESPACE_FIXTURES: WhitespaceFixture[] = [
  {
    name: 'ws-control-nows',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: 'alphabravo',
    normalizedBrainKey: 'vesseltest01activealphabravo',
    wif: '5HwtDkQDDhfSMecyqtYkuegX3ZoL95MfsC1yaUtnVUNzBMmo7vj',
    pub: 'STM7o6G6s2ZQB4DpUfGxKMdqh9mcVGcQgdtc2hAjXn9AT5ikQ3HyS',
    note: 'Reference: no whitespace.',
  },
  {
    name: 'ws-control-singlespace',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: 'alpha\x20bravo',
    normalizedBrainKey: 'vesseltest01activealpha bravo',
    wif: '5JwJLN13EotD9EHCZVqvtZMTupRLggs7cEYrYvmCqDuajJUPyz2',
    pub: 'STM8VzywB25RHGiGMFLhDm4zDDGsaYFksiAvJ9Xeoo3H8JsDMnirD',
    note: 'Reference: one internal space. The tab/newline/double-space vectors all collapse to THIS value.',
  },
  {
    name: 'ws-leading-space',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: '\x20alphabravo',
    normalizedBrainKey: 'vesseltest01active alphabravo',
    wif: '5KUZ74pdzg2LBU2gYu1YpDrKtsbCTeHiB1neWu8wr3XLvHsLdkk',
    pub: 'STM8YJjwdeoHNARQVtrrx5XcpoJoJohXq5MuDRod9bScv3mPa5pqo',
    note: 'DIFFERS from ws-control-nows: a leading space becomes a real role/password separator (name precedes it, so trim does not remove it).',
  },
  {
    name: 'ws-trailing-space',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: 'alphabravo\x20',
    normalizedBrainKey: 'vesseltest01activealphabravo',
    wif: '5HwtDkQDDhfSMecyqtYkuegX3ZoL95MfsC1yaUtnVUNzBMmo7vj',
    pub: 'STM7o6G6s2ZQB4DpUfGxKMdqh9mcVGcQgdtc2hAjXn9AT5ikQ3HyS',
    note: 'IDENTICAL to ws-control-nows: trailing whitespace is trimmed away.',
  },
  {
    name: 'ws-internal-double-space',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: 'alpha\x20\x20bravo',
    normalizedBrainKey: 'vesseltest01activealpha bravo',
    wif: '5JwJLN13EotD9EHCZVqvtZMTupRLggs7cEYrYvmCqDuajJUPyz2',
    pub: 'STM8VzywB25RHGiGMFLhDm4zDDGsaYFksiAvJ9Xeoo3H8JsDMnirD',
    note: 'IDENTICAL to ws-control-singlespace: an internal whitespace run collapses to one space.',
  },
  {
    name: 'ws-tab',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: 'alpha\tbravo',
    normalizedBrainKey: 'vesseltest01activealpha bravo',
    wif: '5JwJLN13EotD9EHCZVqvtZMTupRLggs7cEYrYvmCqDuajJUPyz2',
    pub: 'STM8VzywB25RHGiGMFLhDm4zDDGsaYFksiAvJ9Xeoo3H8JsDMnirD',
    note: 'IDENTICAL to ws-control-singlespace: \\t collapses to one space.',
  },
  {
    name: 'ws-newline',
    account: STANDARD_ACCOUNT,
    role: 'active',
    password: 'alpha\nbravo',
    normalizedBrainKey: 'vesseltest01activealpha bravo',
    wif: '5JwJLN13EotD9EHCZVqvtZMTupRLggs7cEYrYvmCqDuajJUPyz2',
    pub: 'STM8VzywB25RHGiGMFLhDm4zDDGsaYFksiAvJ9Xeoo3H8JsDMnirD',
    note: 'IDENTICAL to ws-control-singlespace: \\n collapses to one space.',
  },
];

// ── Memo crypto ────────────────────────────────────────────────────────────────────────────────────
//
// hive.memo.encode injects a RANDOM nonce, so the `encoded` blob is NOT reproducible by re-encoding.
// The durable invariant is decode(recipientPriv | senderPriv, encoded) === message. The leading '#' is
// retained on both input and output (encode only encrypts a '#'-prefixed memo; decode returns '#'+text).

export interface MemoFixture {
  name: string;
  senderPriv: string;
  senderPub: string;
  recipientPriv: string;
  recipientPub: string;
  /** the '#'-prefixed plaintext memo. */
  message: string;
  /** a hive-js-produced encrypted blob (captured; random nonce inside). */
  encoded: string;
  /** decode(encoded) under either private key — equals `message`. */
  decodedMessage: string;
}

/** THROWAWAY memo keypairs — never real keys. */
export const MEMO_FIXTURES: MemoFixture[] = [
  {
    name: 'memo-ascii-short',
    senderPriv: '5HyKnYJGjVzsH79JtKBvKLqN2y5vZb2MXp8AUEZFyYq8mTEPLAh',
    senderPub: 'STM8mUCmoD4PTbP68kCWir9Lb9bV9WqhSuRsN5BnZr2SsQXKj1X8o',
    recipientPriv: '5KPrNjNzxwfbbYTEF2yyp3iGJt97SubTMBBZ941SisV6wigLd9r',
    recipientPub: 'STM68swiyJn28A4B8D2u2KBDFpGUdu9g2wbKgfCVgXerqNqCi4puT',
    message: '#Hello Vessel baseline 123',
    encoded:
      '#ArjeZGUjNMDxdAywTr97CwCX18NRDHvCJgGsB1SN9CunXDJPQKHk2ZNmnPoDSHMVQipBqMo8vZowu8vTSVZdpWaR5qrnERoGz7MgGvJDAfDGoYSRocNoNkpKPiLPMvWaNCnTh8LXcgev5uVLkRpLgEG',
    decodedMessage: '#Hello Vessel baseline 123',
  },
  {
    name: 'memo-unicode',
    senderPriv: '5HyKnYJGjVzsH79JtKBvKLqN2y5vZb2MXp8AUEZFyYq8mTEPLAh',
    senderPub: 'STM8mUCmoD4PTbP68kCWir9Lb9bV9WqhSuRsN5BnZr2SsQXKj1X8o',
    recipientPriv: '5KPrNjNzxwfbbYTEF2yyp3iGJt97SubTMBBZ941SisV6wigLd9r',
    recipientPub: 'STM68swiyJn28A4B8D2u2KBDFpGUdu9g2wbKgfCVgXerqNqCi4puT',
    message: '#memo爱 café 🚀 üß Ж',
    encoded:
      '#ArjeZGUjNMDxdAywTr97CwCX18NRDHvCJgGsB1SN9CunXDJPQKHk2ZNmnPoDSHMVQipBqMo8vZowu8vTSVZdpWaR5qtDXbyn8dTHGcakCDEviFhSgBS1BZaQCj8a4CSE5nmRGkNoHtUeFrPXZEwvdja',
    decodedMessage: '#memo爱 café 🚀 üß Ж',
  },
];

// ── isWif truth table ──────────────────────────────────────────────────────────────────────────────
//
// hive.auth.isWif validates ONLY the base58check double-sha256 checksum (no version byte, no length
// check). One entry pins a KNOWN hive-js quirk: it compares the 4 checksum bytes via Buffer.toString()
// (UTF-8), which collapses distinct invalid-UTF-8 lead bytes to U+FFFD and so FALSE-POSITIVES. A
// byte-exact isWif (likely hive-tx) will DIVERGE on that one input — see conductorMustCheck.

export interface IsWifFixture {
  name: string;
  input: string;
  isWif: boolean;
  note?: string;
}

export const ISWIF_FIXTURES: IsWifFixture[] = [
  {
    name: 'iswif-valid-private-wif',
    input: '5HyKnYJGjVzsH79JtKBvKLqN2y5vZb2MXp8AUEZFyYq8mTEPLAh',
    isWif: true,
  },
  {
    name: 'iswif-corrupted-checksum',
    input: '5HyKnYJGjVzsH79JtKBvKLqN2y5vZb2MXp8AUEZFyYq8mLxDqGj',
    isWif: false,
    note: 'Both engines agree false here (checksum bytes differ in ASCII range).',
  },
  {
    name: 'iswif-corrupted-checksum-utf8-collision',
    input: '5HyKnYJGjVzsH79JtKBvKLqN2y5vZb2MXp8AUEZFyYq8mTEPLAA',
    isWif: true,
    note: 'PARITY RISK: valid WIF with only its final base58 char flipped (h->A). Stored checksum byte 0xbf vs computed 0xde; both are invalid UTF-8 lead bytes, so hive-js Buffer.toString() compare false-positives true. A byte-exact isWif (hive-tx) will return false and DIVERGE.',
  },
  {
    name: 'iswif-empty-string',
    input: '',
    isWif: false,
  },
  {
    name: 'iswif-non-base58-string',
    input: 'not a wif!! 0 O I l with spaces',
    isWif: false,
  },
  {
    name: 'iswif-valid-public-key',
    input: 'STM8mUCmoD4PTbP68kCWir9Lb9bV9WqhSuRsN5BnZr2SsQXKj1X8o',
    isWif: false,
    note: 'A valid STM public key: false because public keys use a RIPEMD160 checksum, not double-sha256.',
  },
  {
    name: 'iswif-plausible-but-invalid',
    input: '5Jzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    isWif: false,
  },
  {
    name: 'iswif-random-hex-string',
    input: 'deadbeef00cafebabe0123456789abcdeffedcba9876543210',
    isWif: false,
  },
];
