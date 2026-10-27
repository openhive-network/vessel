/**
 * The single module that talks to the Hive client. Phase 4 T2b: engine swapped hive-js -> hive-tx 7.2.0
 * (behind this unchanged facade surface). Every method here is the parity-proven logic from
 * app/utils/__tests__/hiveEngineParity.test.ts (47 tests: byte-identical digests, hive-js-normalized
 * key derivation, memo cross-decode, isWif, cross-engine signature verification).
 *
 * Rollback is a one-commit revert of this file (hive-js is kept in package.json one release past the
 * swap; the parity suites keep importing it). Requires patches/hive-tx+7.2.0.patch (F2 chain_id read
 * fresh in digest(); bs58 cjs interop). No Buffer/node polyfills — safe for the T3 polyfill removal.
 */
import { PrivateKey, Transaction, Memo, callRPC, config as hiveTxConfig } from 'hive-tx';

// hive-js's login-seed normalization; hive-tx's fromLogin does NOT do this (finding F4), so the facade
// owns derivation: trim + collapse [\t\n\v\f\r space] runs to a single space, then sha256 (fromSeed).
const normalizeBrainKey = (s: string): string => s.trim().split(/[\t\n\v\f\r ]+/).join(' ');
const prefix = (): string => hiveTxConfig.address_prefix;

// Read API — one condenser_api call each (callRPC returns the result directly; rejects with RPCError).
export const hiveApi = {
  // Renderer owns node selection; pin hive-tx to the one selected node (no quorum — matches hive-js).
  setOptions: (options: { url: string }): void => {
    hiveTxConfig.nodes = [options.url];
  },

  getDynamicGlobalProperties: (): Promise<any> =>
    callRPC('condenser_api.get_dynamic_global_properties', []),

  getAccounts: (accounts: string[]): Promise<any[]> =>
    callRPC('condenser_api.get_accounts', [accounts]),

  getVestingDelegations: (account: string, from: string | number, limit: number): Promise<any[]> =>
    callRPC('condenser_api.get_vesting_delegations', [account, from, limit]),

  getWithdrawRoutes: (account: string, type: string): Promise<any[]> =>
    callRPC('condenser_api.get_withdraw_routes', [account, type]),

  getSavingsWithdrawFrom: (account: string): Promise<any[]> =>
    callRPC('condenser_api.get_savings_withdraw_from', [account]),

  getAccountHistory: (account: string, from: number, limit: number): Promise<any[]> =>
    callRPC('condenser_api.get_account_history', [account, from, limit]),

  getWitnessesByVote: (from: string, limit: number): Promise<any[]> =>
    callRPC('condenser_api.get_witnesses_by_vote', [from, limit]),

  getConfig: (): Promise<any> => callRPC('condenser_api.get_config', []),

  // Median witness chain properties — carries `account_creation_fee` (the fee an account_create /
  // paid claim_account must pay). Returned as the node's own asset string (e.g. "3.000 HIVE").
  getChainProperties: (): Promise<any> => callRPC('condenser_api.get_chain_properties', []),

  getConversionRequests: (account: string): Promise<any[]> =>
    callRPC('condenser_api.get_conversion_requests', [account]),
};

const ZERO_BLOCK_ID = '0000000000000000000000000000000000000000';

// Buffer.from(headBlockId,'hex').readUInt32LE(4) without Buffer (T3 removes the renderer polyfill).
const refBlockPrefixFromId = (headBlockId: string): number => {
  const byteAt = (i: number): number => parseInt(headBlockId.slice(i * 2, i * 2 + 2), 16);
  return (byteAt(4) | (byteAt(5) << 8) | (byteAt(6) << 16) | (byteAt(7) << 24)) >>> 0;
};

/**
 * Transaction lifecycle — the money path. broadcast.ts (prepare -> sign -> broadcast) and the
 * main-process keystore route through these; the engine lives only here.
 */
export const hiveTx = {
  // Replicates hive-js lib/broadcast/index.js _prepareTransaction exactly: ref_block_num from the LIB
  // block - 1, ref_block_prefix from that block's `previous` id, expiration = chain head time + 600s.
  prepareTransaction: async (tx: { operations: any[]; extensions?: any[] }): Promise<any> => {
    const props = await hiveApi.getDynamicGlobalProperties();
    const chainDate = new Date(`${props.time}Z`);
    const refBlockNum = (props.last_irreversible_block_num - 1) & 0xffff;
    const block = await callRPC<any>('condenser_api.get_block_header', [
      props.last_irreversible_block_num,
    ]);
    const headBlockId = block ? block.previous : ZERO_BLOCK_ID;
    return {
      ref_block_num: refBlockNum,
      ref_block_prefix: refBlockPrefixFromId(headBlockId),
      expiration: new Date(chainDate.getTime() + 600 * 1000).toISOString().slice(0, -5),
      operations: tx.operations,
      extensions: tx.extensions || [],
    };
  },

  // keys is a role->wif map (label cosmetic) or a wif array; sign with the value(s). Returns the tx with
  // a `signatures` array attached (non-deterministic per signature, F1, but valid + chain-accepted).
  signTransaction: (preparedTx: any, keys: string[] | Record<string, string>): any => {
    const wifs = Array.isArray(keys) ? keys : Object.values(keys);
    const signers = wifs.map((wif) => PrivateKey.from(wif));
    const t = new Transaction({
      transaction: { ...preparedTx, signatures: preparedTx.signatures || [] } as any,
    });
    return t.sign(signers.length === 1 ? signers[0] : signers);
  },

  broadcastTransaction: async (signedTx: any): Promise<any> => {
    try {
      return await callRPC('condenser_api.broadcast_transaction', [signedTx]);
    } catch (e: any) {
      // processing.js:setError reads err.error.data.stack (hive-js shape); hive-tx RPCError exposes the
      // JSON-RPC error under .data with no .error wrapper. Re-shape so broadcast errors still render.
      if (e && e.name === 'RPCError' && e.data) {
        const normalized: any = new Error(e.message);
        normalized.error = { data: e.data };
        throw normalized;
      }
      throw e;
    }
  },
};

// Auth utilities — derivation + WIF handling on hive-tx PrivateKey/PublicKey.
export const hiveAuth = {
  isWif: (key: string): boolean => {
    try {
      PrivateKey.fromString(key);
      return true;
    } catch {
      return false;
    }
  },
  // True iff `wif` is a valid private key whose public key equals `pubKey` (Keys/Auth + Keys/Memo).
  wifIsValid: (wif: string, pubKey: string): boolean => {
    try {
      return PrivateKey.from(wif).createPublic(prefix()).toString() === pubKey;
    } catch {
      return false;
    }
  },
  wifToPublic: (wif: string): string => PrivateKey.from(wif).createPublic(prefix()).toString(),
  toWif: (name: string, password: string, type: string): string =>
    PrivateKey.fromSeed(normalizeBrainKey(name + type + password)).toString(),
  getPrivateKeys: (name: string, password: string, roles: string[] = []): Record<string, string> => {
    const keys: Record<string, string> = {};
    roles.forEach((role) => {
      keys[role] = PrivateKey.fromSeed(normalizeBrainKey(name + role + password)).toString();
    });
    return keys;
  },
  generateKeys: (name: string, password: string, roles: string[] = []): Record<string, string> => {
    const keys: Record<string, string> = {};
    roles.forEach((role) => {
      keys[role] = PrivateKey.fromSeed(normalizeBrainKey(name + role + password))
        .createPublic(prefix())
        .toString();
    });
    return keys;
  },
};

// Memo utilities — Memo.encode/decode share hive-js's signature and cross-decode its blobs.
export const hiveMemo = {
  encode: (privateKey: string, publicKey: string, message: string): string =>
    Memo.encode(privateKey, publicKey, message),
  decode: (privateKey: string, encoded: string): string => Memo.decode(privateKey, encoded),
};

// Config utilities — a get/set shim over hive-tx's config object (chain_id / address_prefix).
export const hiveConfig = {
  get: (key: string): string => (hiveTxConfig as any)[key],
  set: (key: string, value: string): void => {
    (hiveTxConfig as any)[key] = value;
  },
};
