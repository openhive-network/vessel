import hive from '@hiveio/hive-js';

// Promisify callback-based API
function promisify<T>(fn: (callback: (err: Error | null, result: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// API Methods
export const hiveApi = {
  setOptions: (options: { url: string }) => hive.api.setOptions(options),

  getDynamicGlobalProperties: (): Promise<any> =>
    promisify((cb) => hive.api.getDynamicGlobalProperties(cb)),

  getAccounts: (accounts: string[]): Promise<any[]> =>
    promisify((cb) => hive.api.getAccounts(accounts, cb)),

  getVestingDelegations: (account: string, from: string | number, limit: number): Promise<any[]> =>
    promisify((cb) => hive.api.getVestingDelegations(account, from, limit, cb)),

  getWithdrawRoutes: (account: string, type: string): Promise<any[]> =>
    promisify((cb) => hive.api.getWithdrawRoutes(account, type, cb)),

  getSavingsWithdrawFrom: (account: string): Promise<any[]> =>
    promisify((cb) => hive.api.getSavingsWithdrawFrom(account, cb)),

  getAccountHistory: (account: string, from: number, limit: number): Promise<any[]> =>
    promisify((cb) => hive.api.getAccountHistory(account, from, limit, cb)),

  getWitnessesByVote: (from: string, limit: number): Promise<any[]> =>
    promisify((cb) => hive.api.getWitnessesByVote(from, limit, cb)),

  getConfig: (): Promise<any> => promisify((cb) => hive.api.getConfig(cb)),

  getConversionRequests: (account: string): Promise<any[]> =>
    promisify((cb) => hive.api.getConversionRequests(account, cb)),
};

/**
 * Transaction-lifecycle primitives — the money path. `app/utils/broadcast.ts` (prepare -> sign ->
 * broadcast) and the main-process keystore go through THESE, so the Phase 4 engine swap (hive-js ->
 * hive-tx) changes only this module. `signTransaction`'s `keys` is a role->wif map or a wif array; the
 * role LABEL is cosmetic to hive-js (it signs with the value), which is what keeps the split in
 * broadcast.ts byte-faithful. Replaces the old dead `hiveBroadcast` named helpers (F5: zero callers —
 * the live path builds ops itself in broadcast.ts).
 */
export const hiveTx = {
  prepareTransaction: (tx: { operations: any[]; extensions?: any[] }): Promise<any> =>
    hive.broadcast._prepareTransaction(tx),

  signTransaction: (preparedTx: any, keys: string[] | Record<string, string>): any =>
    hive.auth.signTransaction(preparedTx, keys),

  broadcastTransaction: (signedTx: any): Promise<any> => hive.api.broadcastTransactionAsync(signedTx),
};

// Auth utilities
export const hiveAuth = {
  isWif: (key: string): boolean => hive.auth.isWif(key),
  wifIsValid: (wif: string, pubKey: string): boolean => hive.auth.wifIsValid(wif, pubKey),
  wifToPublic: (wif: string): string => hive.auth.wifToPublic(wif),
  toWif: (name: string, password: string, type: string): string =>
    hive.auth.toWif(name, password, type),
  getPrivateKeys: (name: string, password: string, roles?: string[]): any =>
    hive.auth.getPrivateKeys(name, password, roles),
  generateKeys: (name: string, password: string, roles?: string[]): any =>
    hive.auth.generateKeys(name, password, roles),
};

// Memo utilities
export const hiveMemo = {
  encode: (privateKey: string, publicKey: string, message: string): string =>
    hive.memo.encode(privateKey, publicKey, message),
  decode: (privateKey: string, encoded: string): string => hive.memo.decode(privateKey, encoded),
};

// Config utilities
export const hiveConfig = {
  get: (key: string): string => hive.config.get(key),
  set: (key: string, value: string): void => hive.config.set(key, value),
};
