import hive from '@hiveio/hive-js';

// Promisify callback-based API
function promisify<T>(
  fn: (callback: (err: Error | null, result: T) => void) => void
): Promise<T> {
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

  getConfig: (): Promise<any> =>
    promisify((cb) => hive.api.getConfig(cb)),
};

// Broadcast Methods
export const hiveBroadcast = {
  transfer: (
    wif: string,
    from: string,
    to: string,
    amount: string,
    memo: string
  ): Promise<any> =>
    promisify((cb) => hive.broadcast.transfer(wif, from, to, amount, memo, cb)),

  transferToSavings: (
    wif: string,
    from: string,
    to: string,
    amount: string,
    memo: string
  ): Promise<any> =>
    promisify((cb) => hive.broadcast.transferToSavings(wif, from, to, amount, memo, cb)),

  transferFromSavings: (
    wif: string,
    from: string,
    requestId: number,
    to: string,
    amount: string,
    memo: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.transferFromSavings(wif, from, requestId, to, amount, memo, cb)
    ),

  delegateVestingShares: (
    wif: string,
    delegator: string,
    delegatee: string,
    vests: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.delegateVestingShares(wif, delegator, delegatee, vests, cb)
    ),

  withdrawVesting: (wif: string, account: string, vests: string): Promise<any> =>
    promisify((cb) => hive.broadcast.withdrawVesting(wif, account, vests, cb)),

  accountWitnessVote: (
    wif: string,
    account: string,
    witness: string,
    approve: boolean
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.accountWitnessVote(wif, account, witness, approve, cb)
    ),

  accountWitnessProxy: (wif: string, account: string, proxy: string): Promise<any> =>
    promisify((cb) => hive.broadcast.accountWitnessProxy(wif, account, proxy, cb)),

  setWithdrawVestingRoute: (
    wif: string,
    account: string,
    target: string,
    percent: number,
    autoVest: boolean
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.setWithdrawVestingRoute(wif, account, target, percent, autoVest, cb)
    ),

  convert: (wif: string, owner: string, requestId: number, amount: string): Promise<any> =>
    promisify((cb) => hive.broadcast.convert(wif, owner, requestId, amount, cb)),

  collateralizedConvert: (
    wif: string,
    owner: string,
    requestId: number,
    amount: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.collateralizedConvert(wif, owner, requestId, amount, cb)
    ),

  customJson: (
    wif: string,
    requiredAuths: string[],
    requiredPostingAuths: string[],
    id: string,
    json: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.customJson(wif, requiredAuths, requiredPostingAuths, id, json, cb)
    ),

  send: (operations: any[], keys: string[]): Promise<any> =>
    promisify((cb) => hive.broadcast.send(operations, keys, cb))
};

// Auth utilities
export const hiveAuth = {
  isWif: (key: string): boolean => hive.auth.isWif(key),
  wifToPublic: (wif: string): string => hive.auth.wifToPublic(wif),
  toWif: (name: string, password: string, type: string): string =>
    hive.auth.toWif(name, password, type),
  getPrivateKeys: (name: string, password: string, roles?: string[]): any =>
    hive.auth.getPrivateKeys(name, password, roles)
};

// Memo utilities
export const hiveMemo = {
  encode: (privateKey: string, publicKey: string, message: string): string =>
    hive.memo.encode(privateKey, publicKey, message),
  decode: (privateKey: string, encoded: string): string =>
    hive.memo.decode(privateKey, encoded)
};

// Config utilities
export const hiveConfig = {
  get: (key: string): string => hive.config.get(key),
  set: (key: string, value: string): void => hive.config.set(key, value)
};

// Formatter utilities
export const hiveFormatter = {
  vestToHive: (vestingShares: any, totalVestingShares: any, totalVestingFundHive: any): number =>
    hive.formatter.vestToHive(vestingShares, totalVestingShares, totalVestingFundHive)
};
