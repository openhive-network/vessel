/**
 * A legacy (pre-2026) wallet record as the shipped app wrote it: THROWAWAY keys encrypted with the
 * real crypto-js 3.3.0, `CryptoJS.AES.encrypt(wif, LEGACY_PASSWORD).toString()` (OpenSSL Salted__,
 * EVP_BytesToKey MD5 x1, AES-256-CBC). Regenerate with crypto-js@3.3.0 and hive-tx:
 *
 *   const wif = PrivateKey.fromLogin('vessel-legacy-fixture', 'legacy-fixture-throwaway-do-not-use', role).toString();
 *   CryptoJS.AES.encrypt(wif, 'legacy-wallet-pw').toString();
 *
 * NEVER fund or reuse these keys.
 */
export const LEGACY_ACCOUNT = 'vessel-legacy-fixture';
export const LEGACY_PASSWORD = 'legacy-wallet-pw';
export const LEGACY_ACTIVE_WIF = '5J28EWMcQ3B6yJRKB4MLRHx1esy1yzssQeZ3j22NrUYb8mpgbwn';
export const LEGACY_MEMO_WIF = '5K6wZXiULRJ6YMKYrxbqqKkByHXJBsh61GNsgquCpV93n1AFiXd';
export const LEGACY_ACTIVE_CIPHERTEXT =
  'U2FsdGVkX1/LSDh6z37qFl0MHsLuqcG/IK6rvtWCVsJg3WwCA31cw7pKwtQtg/weNUO7WTrfQX68ExkNs3YfKMQaYsO0xJ+JvlguaoHSxq4=';
export const LEGACY_MEMO_CIPHERTEXT =
  'U2FsdGVkX1/M6WUkXtGx79SPnYaUEol982ABKTwOINMBkCR+OmINwOZxFYsmX3KrDJ1tTTzt8miuRwtmC7491vvnWZolqtFevC3SStg9oew=';

/** The account's record in the keys slice, exactly as redux-persist v4 stored it. */
export const LEGACY_RECORD = {
  account: LEGACY_ACCOUNT,
  key: LEGACY_ACTIVE_CIPHERTEXT,
  encrypted: true,
  type: 'active',
  memo: LEGACY_MEMO_CIPHERTEXT,
};
