declare module '@hiveio/hive-js' {
  export const api: {
    setOptions(options: { url: string }): void;
    getConfig(callback: (err: Error | null, result: any) => void): void;
    getAccounts(accounts: string[], callback: (err: Error | null, result: any[]) => void): void;
    getDynamicGlobalProperties(callback: (err: Error | null, result: any) => void): void;
    getVestingDelegations(
      account: string,
      from: string | number,
      limit: number,
      callback: (err: Error | null, result: any[]) => void
    ): void;
    getWithdrawRoutes(
      account: string,
      type: string,
      callback: (err: Error | null, result: any[]) => void
    ): void;
    getSavingsWithdrawFrom(
      account: string,
      callback: (err: Error | null, result: any[]) => void
    ): void;
    getAccountHistory(
      account: string,
      from: number,
      limit: number,
      callback: (err: Error | null, result: any[]) => void
    ): void;
    getWitnessesByVote(
      from: string,
      limit: number,
      callback: (err: Error | null, result: any[]) => void
    ): void;
    getContent(
      author: string,
      permlink: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    broadcastTransactionAsync(signedTransaction: any): Promise<any>;
  };

  export const broadcast: {
    transfer(
      wif: string,
      from: string,
      to: string,
      amount: string,
      memo: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    transferToSavings(
      wif: string,
      from: string,
      to: string,
      amount: string,
      memo: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    transferFromSavings(
      wif: string,
      from: string,
      requestId: number,
      to: string,
      amount: string,
      memo: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    delegateVestingShares(
      wif: string,
      delegator: string,
      delegatee: string,
      vests: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    withdrawVesting(
      wif: string,
      account: string,
      vests: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    accountWitnessVote(
      wif: string,
      account: string,
      witness: string,
      approve: boolean,
      callback: (err: Error | null, result: any) => void
    ): void;
    accountWitnessProxy(
      wif: string,
      account: string,
      proxy: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    setWithdrawVestingRoute(
      wif: string,
      account: string,
      target: string,
      percent: number,
      autoVest: boolean,
      callback: (err: Error | null, result: any) => void
    ): void;
    convert(
      wif: string,
      owner: string,
      requestId: number,
      amount: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    collateralizedConvert(
      wif: string,
      owner: string,
      requestId: number,
      amount: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    customJson(
      wif: string,
      requiredAuths: string[],
      requiredPostingAuths: string[],
      id: string,
      json: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    send(
      operations: any[],
      keys: string[],
      callback: (err: Error | null, result: any) => void
    ): void;
    _prepareTransaction(tx: { operations: any[]; extensions?: any[] }): Promise<any>;
  };

  export const config: {
    get(key: string): string;
    set(key: string, value: string): void;
  };

  export const auth: {
    isWif(key: string): boolean;
    wifToPublic(wif: string): string;
    toWif(name: string, password: string, type: string): string;
    getPrivateKeys(name: string, password: string, roles?: string[]): any;
    generateKeys(name: string, password: string, roles?: string[]): any;
    signTransaction(trx: any, keys: string[] | Record<string, string>): any;
  };

  export const memo: {
    encode(privateKey: string, publicKey: string, message: string): string;
    decode(privateKey: string, encoded: string): string;
    getPubKeys(encoded: string): string[];
  };

  export const formatter: {
    vestToHive(vestingShares: any, totalVestingShares: any, totalVestingFundHive: any): number;
    estimateAccountValue(account: any, globalProperties: any, feedHistory: any): number;
  };

  const hive: {
    api: typeof api;
    broadcast: typeof broadcast;
    config: typeof config;
    auth: typeof auth;
    memo: typeof memo;
    formatter: typeof formatter;
  };

  export default hive;
}

declare module '@hiveio/hive-js/lib/auth/serializer' {
  /** The low-level operation serializers. `ops.transaction.toBuffer(tx)` yields the exact preimage
   * bytes hive-js hashes when signing (used by the Phase 4 parity baseline). */
  const serializer: {
    ops: {
      transaction: { toBuffer(tx: any): Buffer };
      [op: string]: { toBuffer(value: any): Buffer };
    };
  };
  export default serializer;
}
