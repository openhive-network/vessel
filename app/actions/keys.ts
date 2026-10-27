import { hiveApi, hiveAuth } from '../utils/hiveApi';
import * as AccountActions from './account';
import {
  PROCESSING_ACCOUNT_LOADING,
  PROCESSING_ACCOUNT_LOADING_COMPLETE,
  PROCESSING_ACCOUNT_LOADING_FAILED,
} from './processing';
import { encryptKey, decryptKey, isEncrypted, needsReencrypt } from '../utils/keyEnvelope';
import { mainKeystore } from '../utils/keyCustody';
import { verifyPasswordInMain } from '../utils/keystoreVerify';
import { purgeLegacyCiphertext, type Replacement } from '../store/legacyCiphertextPurge';
import {
  requiredRoleForAction,
  keySatisfiesRole,
  MixedAuthorityError,
  NoOperationsError,
} from '../utils/authorityRoles';

export const KEY_REMOVE_CANCEL = 'KEY_REMOVE_CANCEL';
export const KEY_REMOVE_CONFIRM = 'KEY_REMOVE_CONFIRM';
export const KEY_REMOVE_CONFIRMED = 'KEY_REMOVE_CONFIRMED';
export const KEY_USE = 'KEY_USE';
export const KEY_USE_DECRYPT_PROMPT = 'KEY_USE_DECRYPT_PROMPT';
export const KEY_USE_DECRYPT_PROMPT_CLOSE = 'KEY_USE_DECRYPT_PROMPT_CLOSE';
export const KEY_ADD_CANCEL = 'KEY_ADD_CANCEL';
export const KEY_ADD_CONFIRM = 'KEY_ADD_CONFIRM';
export const KEY_ADD_CONFIRMED = 'KEY_ADD_CONFIRMED';
export const KEY_ADD_FAILED = 'KEY_ADD_FAILED';
export const KEY_ADD_FAILED_ACCOUNT_404 = 'KEY_ADD_FAILED_ACCOUNT_404';
export const KEY_ADD_FAILED_WIF_INCORRECT = 'KEY_ADD_FAILED_WIF_INCORRECT';
export const KEY_ADD_FAILED_WIF_INVALID = 'KEY_ADD_FAILED_WIF_INVALID';
export const KEY_ADD_MEMO_CANCEL = 'KEY_ADD_MEMO_CANCEL';
export const KEY_ADD_MEMO_CONFIRM = 'KEY_ADD_MEMO_CONFIRM';
export const KEY_ADD_MEMO_CONFIRMED = 'KEY_ADD_MEMO_CONFIRMED';
export const KEY_ADD_MEMO_PROMPT = 'KEY_ADD_MEMO_PROMPT';
export const KEY_ADD_AUTH_CANCEL = 'KEY_ADD_AUTH_CANCEL';
export const KEY_ADD_AUTH_CONFIRM = 'KEY_ADD_AUTH_CONFIRM';
export const KEY_ADD_AUTH_CONFIRMED = 'KEY_ADD_AUTH_CONFIRMED';
export const KEY_ADD_AUTH_PROMPT = 'KEY_ADD_AUTH_PROMPT';
export const KEY_ADD_PROMPT = 'KEY_ADD_PROMPT';
export const KEY_CREATE_CANCEL = 'KEY_CREATE_CANCEL';
export const KEY_CREATE_PROMPT = 'KEY_CREATE_PROMPT';
export const KEY_ADD_FAILED_PASSWORD_REQUIRED = 'KEY_ADD_FAILED_PASSWORD_REQUIRED';
export const KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH = 'KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH';
export const KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN = 'KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN';
export const KEY_USE_ROLE_MISMATCH = 'KEY_USE_ROLE_MISMATCH';
export const KEY_ERROR_CLEAR = 'KEY_ERROR_CLEAR';
export const KEY_REENCRYPTED = 'KEY_REENCRYPTED';

// Dismiss the in-app operation-error notice (e.g. an authority/role mismatch surfaced to the user).
export function clearKeyError() {
  return { type: KEY_ERROR_CLEAR };
}

export function addKey(account: any, wif: any) {
  const isValidKey = hiveAuth.isWif(wif);
  if (isValidKey) {
    return (dispatch: any) => {
      dispatch({
        type: PROCESSING_ACCOUNT_LOADING,
      });
      hiveApi.getAccounts([account]).then(
        (result: any) => {
          // Account not found
          if (!result.length) {
            dispatch({
              type: KEY_ADD_FAILED_ACCOUNT_404,
            });
            dispatch({
              type: PROCESSING_ACCOUNT_LOADING_COMPLETE,
            });
          }
          if (result && result.length) {
            const derivedKey = hiveAuth.wifToPublic(wif);
            const keyTypes = getKeyType(derivedKey, result[0]);
            if (keyTypes.length > 0) {
              // Correct key + weight, save keyAuths
              const payload = {
                account,
                wif,
                active: keyTypes.indexOf('active') !== -1,
                posting: keyTypes.indexOf('posting') !== -1,
                owner: keyTypes.indexOf('owner') !== -1,
              };
              dispatch({
                type: PROCESSING_ACCOUNT_LOADING_COMPLETE,
              });
              dispatch({
                type: KEY_ADD_CONFIRM,
                payload,
              });
            } else {
              // Incorrect key for account
              dispatch({
                type: PROCESSING_ACCOUNT_LOADING_COMPLETE,
              });
              dispatch({
                type: KEY_ADD_FAILED_WIF_INCORRECT,
              });
            }
          }
        },
        () => {
          dispatch({
            type: KEY_ADD_FAILED_ACCOUNT_404,
          });
          dispatch({
            type: PROCESSING_ACCOUNT_LOADING_COMPLETE,
          });
        }
      );
    };
  }
  return {
    type: KEY_ADD_FAILED_WIF_INVALID,
  };
}

// §5.1 — the main WIF is ALWAYS encrypted (D9a envelope); `key = wif` is never persisted.
// Async thunk: a wallet password is mandatory. Existing `encrypted:false` records stay readable
// (useKey's unencrypted branch) and are upgraded via the §5.3 launch modal.
export function addKeyConfirmed(account: any, wif: any, type: any, password: any) {
  return async (dispatch: any) => {
    if (!password) {
      dispatch({ type: KEY_ADD_FAILED_PASSWORD_REQUIRED });
      return;
    }
    let key: string;
    try {
      key = await sealImportedKey(account, wif, type, password);
    } catch (e) {
      console.error('[keystore] key import failed:', e instanceof Error ? e.message : 'error');
      dispatch({ type: KEY_ADD_FAILED });
      return;
    }
    const payload = { [account]: { account, key, encrypted: true, type } };
    dispatch({ type: KEY_ADD_CONFIRMED, payload });
  };
}

// With a main keystore the WIF is encrypted and stored by main (keystore:importKey) and the renderer
// keeps only the envelope main returns. Re-importing an account replaces main's record: it is how a
// wallet password is changed. Without one (see keyCustody) the renderer encrypts it itself.
async function sealImportedKey(account: string, wif: string, type: string, password: string): Promise<string> {
  const keystore = mainKeystore();
  if (!keystore) return encryptKey(wif, password);
  if (await keystore.hasAccount(account)) await keystore.removeAccount(account);
  await keystore.importKey(account, wif, password, type);
  const envelope = await keystore.getEnvelope(account);
  if (!envelope?.key) throw new Error('main keystore holds no envelope after import');
  return envelope.key;
}

export function addKeyCancel() {
  return {
    type: KEY_ADD_CANCEL,
  };
}

export function addKeyPrompt() {
  return {
    type: KEY_ADD_PROMPT,
  };
}

export function createKeyPrompt() {
  return {
    type: KEY_CREATE_PROMPT,
  };
}

export function createKeyCancel() {
  return {
    type: KEY_CREATE_CANCEL,
  };
}

// Given an account and a keys
// Check if key is encrypted

export function useKeyRequestDecrypt(operation: any, params: any, auth: any) {
  return {
    type: KEY_USE_DECRYPT_PROMPT,
    payload: { operation, params, auth },
  };
}

export function useKeyRequestDecryptClose() {
  return {
    type: KEY_USE_DECRYPT_PROMPT_CLOSE,
  };
}

// §7.2 — the client-side HF28 authority gate. FIRST resolve the role the whole request needs; a
// tx that mixes posting with active/owner (unsatisfiable by one key) or carries no ops is refused
// here, BEFORE any key selection or network call. Then verify the stored key can satisfy that role.
export function useKey(operation: any, params: any, auth: any) {
  return (dispatch: any) => {
    let required;
    try {
      required = requiredRoleForAction(operation, params);
    } catch (e) {
      // requiredRoleForAction throws ONLY MixedAuthorityError / NoOperationsError (D2). Fail closed.
      let reason = 'mixed';
      let message =
        'This request mixes operations that need different key levels and cannot be signed with one key.';
      if (e instanceof NoOperationsError) {
        reason = 'empty';
        message = 'This request contains no operations to sign.';
      } else if (!(e instanceof MixedAuthorityError)) {
        message = 'This request could not be authorized with a single key.';
      }
      dispatch({ type: KEY_USE_ROLE_MISMATCH, payload: { operation, reason, message } });
      return;
    }
    if (!auth || !keySatisfiesRole(auth.type, required, auth.roles)) {
      dispatch({
        type: KEY_USE_ROLE_MISMATCH,
        payload: {
          operation,
          required,
          provided: auth && auth.type,
          account: auth && auth.account,
          message: `This operation requires your ${required.toUpperCase()} key; the stored key for this account is ${
            auth && auth.type ? auth.type.toUpperCase() : 'missing'
          }.`,
        },
      });
      return;
    }
    if (auth.encrypted) {
      dispatch(useKeyRequestDecrypt(operation, params, { ...auth, requiredRole: required }));
    } else {
      // Permanent read path for pre-existing plaintext records. Route the role so account.js
      // signs with the correct authority (D1: account.js send { [role]: wif }).
      dispatch((AccountActions as Record<string, any>)[operation](auth.key, { ...params, role: required }));
      dispatch(useKeyRequestDecryptClose());
    }
  };
}

// §5.3 / §4.4 — replace a record's main key and/or memo with a freshly-encrypted envelope.
export function keyReencrypted(payload: any) {
  return {
    type: KEY_REENCRYPTED,
    payload,
  };
}

const hasWeakField = (rec: any): boolean =>
  !!rec &&
  rec.encrypted !== false &&
  typeof rec.key === 'string' &&
  (needsReencrypt(rec.key) ||
    (typeof rec.memo === 'string' && (needsReencrypt(rec.memo) || !isEncrypted(rec.memo))));

/**
 * Adopt the v2 envelope main re-encrypted `account` into on its first unlock, and purge the account's
 * legacy ciphertext from the renderer's storage (persist:root, its backups, reduxPersist:keys). A no-op
 * when the renderer's copy is already current, when there is no main keystore, or when main has not
 * upgraded the record yet (the next unlock will). Only ciphertext crosses from main.
 */
export function adoptMainEnvelope(account: string) {
  return async (dispatch: any, getState: any) => {
    const keystore = mainKeystore();
    const rec = getState().keys.permissions[account];
    if (!keystore || !hasWeakField(rec)) return;
    let envelope;
    try {
      envelope = await keystore.getEnvelope(account);
    } catch (e) {
      console.error('[keystore] reading the main envelope failed:', e instanceof Error ? e.message : 'error');
      return;
    }
    const current = (v: unknown): v is string => typeof v === 'string' && isEncrypted(v) && !needsReencrypt(v);
    const replacement: Replacement = {};
    if (current(envelope?.key) && needsReencrypt(rec.key)) replacement.key = envelope.key;
    if (current(envelope?.memo) && typeof rec.memo === 'string' && rec.memo !== envelope.memo) {
      replacement.memo = envelope.memo;
    }
    if (!replacement.key && !replacement.memo) return;
    dispatch(keyReencrypted({ account, ...replacement }));
    if (typeof window !== 'undefined' && window.localStorage) {
      purgeLegacyCiphertext(window.localStorage, account, replacement);
    }
  };
}

/** adoptMainEnvelope for every account whose renderer copy is still weak. */
export function adoptMainEnvelopes() {
  return async (dispatch: any, getState: any) => {
    const permissions = getState().keys.permissions || {};
    const weak = Object.keys(permissions).filter((account) => hasWeakField(permissions[account]));
    for (const account of weak) {
      await dispatch(adoptMainEnvelope(account));
    }
  };
}

export function getKeyType(wif: any, account: any) {
  const validFor: any = [];
  ['owner', 'active', 'posting'].forEach((keyType) => {
    const keyAuths = account[keyType].key_auths;
    const weightThreshold = account[keyType].weight_threshold;
    const matchingWeight = keyAuths
      .filter((set: any) => set[0] === wif)
      .map((set: any) => set[1])
      .reduce((a: any, b: any) => a + b, 0);
    if (matchingWeight >= weightThreshold) {
      validFor.push(keyType);
    }
  });
  return validFor;
}

export function removeKey(account: any) {
  return {
    type: KEY_REMOVE_CONFIRM,
    payload: account,
  };
}

export function removeKeyConfirmed(account: any) {
  return {
    type: KEY_REMOVE_CONFIRMED,
    payload: account,
  };
}

export function removeKeyCancel() {
  return {
    type: KEY_REMOVE_CANCEL,
  };
}

/**
 * C6 — seal `wif` as the memo key of `rec`'s account under the wallet password that unlocks its main
 * key. With a main keystore the password is checked and the memo encrypted in main (after the usual
 * self-heal of a missing/stale main record), so the main key's WIF never enters the renderer; without
 * one (see keyCustody) the renderer decrypts its own copy to check the password.
 */
async function sealMemoKey(
  rec: any,
  wif: string,
  password: string
): Promise<{ memo: string } | { failure: string }> {
  // A plaintext (or missing) main key cannot bind a memo — force the §5.3 upgrade first.
  if (!rec || !isEncrypted(rec.key)) return { failure: KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN };
  const keystore = mainKeystore();
  if (keystore) {
    if (!(await verifyPasswordInMain(rec, password))) return { failure: KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH };
    try {
      await keystore.importMemoKey(rec.account, wif, password);
      const envelope = await keystore.getEnvelope(rec.account);
      if (envelope?.memo) return { memo: envelope.memo };
    } catch (e) {
      console.error('[keystore] memo key import failed:', e instanceof Error ? e.message : 'error');
    }
    return { failure: KEY_ADD_FAILED };
  }
  try {
    await decryptKey(rec.key, password); // verify the entered pw unlocks the main key
  } catch {
    return { failure: KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH };
  }
  return { memo: await encryptKey(wif, password) };
}

// §5.2 — store the memo key as a v2 envelope bound to the account's wallet password. C6: refuse
// unless the main key is already encrypted AND the entered password unlocks it, so the memo always
// shares the main key's password (else memo decrypt at send time is impossible).
export function addMemoKey(account: any, wif: any, password: any) {
  const isValidKey = hiveAuth.isWif(wif);
  if (!isValidKey) {
    return { type: KEY_ADD_FAILED_WIF_INVALID };
  }
  return (dispatch: any, getState: any) => {
    hiveApi.getAccounts([account]).then(async (result: any) => {
      if (!result || !result.length) return;
      const derivedKey = hiveAuth.wifToPublic(wif);
      if (derivedKey !== result[0].memo_key) {
        // Incorrect key for account
        return;
      }
      const sealed = await sealMemoKey(getState().keys.permissions[account], wif, password);
      if ('failure' in sealed) {
        dispatch({ type: sealed.failure });
        return;
      }
      dispatch({ type: KEY_ADD_MEMO_CONFIRMED, payload: { account, memo: sealed.memo } });
      dispatch(adoptMainEnvelope(account));
    }, () => {});
  };
}

export function addMemoKeyPrompt(account: any) {
  return (dispatch: any) => {
    hiveApi.getAccounts([account]).then((result: any) => {
      dispatch({
        type: KEY_ADD_MEMO_PROMPT,
        payload: {
          account,
          public: result[0].memo_key,
        },
      });
    }, () => {});
  };
}

export function addMemoKeyConfirmed(payload: any) {
  return {
    type: KEY_ADD_MEMO_CONFIRMED,
    payload,
  };
}

export function addMemoKeyCancel() {
  return {
    type: KEY_ADD_MEMO_CANCEL,
  };
}

// §5.2 — same treatment as addMemoKey (funnels to the same reducer shape), keyed on the auth flow.
export function addAuth(account: any, wif: any, password: any) {
  const isValidKey = hiveAuth.isWif(wif);
  if (!isValidKey) {
    return { type: KEY_ADD_FAILED_WIF_INVALID };
  }
  return (dispatch: any, getState: any) => {
    hiveApi.getAccounts([account]).then(async (result: any) => {
      if (!result || !result.length) return;
      const derivedKey = hiveAuth.wifToPublic(wif);
      if (derivedKey !== result[0].memo_key) {
        // Incorrect key for account
        return;
      }
      const sealed = await sealMemoKey(getState().keys.permissions[account], wif, password);
      if ('failure' in sealed) {
        dispatch({ type: sealed.failure });
        return;
      }
      dispatch({ type: KEY_ADD_AUTH_CONFIRMED, payload: { account, memo: sealed.memo } });
      dispatch(adoptMainEnvelope(account));
    }, () => {});
  };
}

export function addAuthPrompt(account: any) {
  return (dispatch: any) => {
    hiveApi.getAccounts([account]).then((result: any) => {
      dispatch({
        type: KEY_ADD_AUTH_PROMPT,
        payload: {
          account,
          public: result[0].memo_key,
        },
      });
    }, () => {});
  };
}

export function addAuthConfirmed(payload: any) {
  return {
    type: KEY_ADD_AUTH_CONFIRMED,
    payload,
  };
}

export function addAuthCancel() {
  return {
    type: KEY_ADD_AUTH_CANCEL,
  };
}
