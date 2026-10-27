import { createSlice } from '@reduxjs/toolkit';
import {
  KEY_REMOVE_CANCEL,
  KEY_REMOVE_CONFIRM,
  KEY_REMOVE_CONFIRMED,
  KEY_USE,
  KEY_USE_DECRYPT_PROMPT,
  KEY_USE_DECRYPT_PROMPT_CLOSE,
  KEY_ADD_CANCEL,
  KEY_ADD_CONFIRM,
  KEY_ADD_CONFIRMED,
  KEY_ADD_FAILED,
  KEY_ADD_FAILED_ACCOUNT_404,
  KEY_ADD_FAILED_WIF_INCORRECT,
  KEY_ADD_FAILED_WIF_INVALID,
  KEY_ADD_MEMO_PROMPT,
  KEY_ADD_MEMO_CANCEL,
  KEY_ADD_MEMO_CONFIRMED,
  KEY_ADD_AUTH_PROMPT,
  KEY_ADD_AUTH_CANCEL,
  KEY_ADD_AUTH_CONFIRMED,
  KEY_ADD_PROMPT,
  KEY_CREATE_CANCEL,
  KEY_CREATE_PROMPT,
  KEY_ADD_FAILED_PASSWORD_REQUIRED,
  KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH,
  KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN,
  KEY_USE_ROLE_MISMATCH,
  KEY_ERROR_CLEAR,
  KEY_REENCRYPTED,
} from '../actions/keys';

/**
 * Phase 5 (D5) — the keys reducer as an RTK slice. Behavior is byte-identical to the legacy switch
 * reducer: every case ported to extraReducers.addCase keyed on the SAME legacy action constants, so the
 * action creators/thunks in actions/keys.js and every dispatch site are unchanged (zero ripple).
 *
 * PARAMOUNT: the persisted shape stays exactly {names, permissions, isUser, removedLegacy} (the
 * keysSurfaceTransform allowlist). initialState here matches the legacy defaultState, so redux-persist
 * rehydrates a shipped wallet into this slice identically — guarded by keysPersistTransform.test.ts +
 * the named rehydration test.
 */
const initialState: any = {
  names: [],
  permissions: {},
  removedLegacy: [],
};

const keysSlice = createSlice({
  name: 'keys',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(KEY_ADD_PROMPT, (state: any) => ({ ...state, addPrompt: true }))
      .addCase(KEY_ADD_CANCEL, (state: any) => ({ ...state, addPrompt: false, confirm: false }))
      .addCase(KEY_ADD_CONFIRM, (state: any, action: any) => ({
        ...state,
        addPrompt: true,
        confirm: action.payload,
      }))
      .addCase(KEY_ADD_CONFIRMED, (state: any, action: any) => {
        const newPermissions = {
          ...state.permissions,
          ...action.payload,
        };
        return {
          ...state,
          addPrompt: false,
          confirm: false,
          isUser: true,
          names: [...Object.keys(newPermissions)].sort(),
          permissions: newPermissions,
        };
      })
      .addCase(KEY_ADD_FAILED_ACCOUNT_404, (state: any) => ({
        ...state,
        lastError: 'Account not found!',
      }))
      .addCase(KEY_ADD_FAILED_WIF_INVALID, (state: any) => ({
        ...state,
        lastError: 'Invalid WIF Key!',
      }))
      .addCase(KEY_ADD_FAILED_WIF_INCORRECT, (state: any) => ({
        ...state,
        lastError: 'Invalid WIF Key for Account!',
      }))
      .addCase(KEY_ADD_FAILED_PASSWORD_REQUIRED, (state: any) => ({
        ...state,
        lastError: 'A wallet password is required to store a key.',
      }))
      .addCase(KEY_ADD_FAILED, (state: any) => ({
        ...state,
        lastError: 'The key could not be stored in the wallet keystore. Please try again.',
      }))
      .addCase(KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH, (state: any) => ({
        ...state,
        lastError:
          'That password does not unlock this account. The memo key must use the same wallet password as the account.',
      }))
      .addCase(KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN, (state: any) => ({
        ...state,
        lastError: 'Set a wallet password for this account first, then add its encrypted memo key.',
      }))
      .addCase(KEY_ADD_MEMO_CANCEL, (state: any) => ({
        ...state,
        addMemoPrompt: false,
        confirmMemo: false,
      }))
      .addCase(KEY_ADD_MEMO_PROMPT, (state: any, action: any) => ({
        ...state,
        addMemoPrompt: true,
        confirmMemo: action.payload,
      }))
      .addCase(KEY_ADD_MEMO_CONFIRMED, (state: any, action: any) => {
        const { account, memo } = action.payload || {};
        if (!account || !state.permissions[account]) return state;
        return {
          ...state,
          addMemoPrompt: false,
          confirmMemo: false,
          permissions: {
            ...state.permissions,
            [account]: { ...state.permissions[account], memo },
          },
        };
      })
      .addCase(KEY_ADD_AUTH_CANCEL, (state: any) => ({
        ...state,
        addAuthPrompt: false,
        confirmAuth: false,
      }))
      .addCase(KEY_ADD_AUTH_PROMPT, (state: any, action: any) => ({
        ...state,
        addAuthPrompt: true,
        confirmAuth: action.payload,
      }))
      .addCase(KEY_ADD_AUTH_CONFIRMED, (state: any, action: any) => {
        const { account, memo } = action.payload || {};
        if (!account || !state.permissions[account]) return state;
        return {
          ...state,
          addAuthPrompt: false,
          confirmAuth: false,
          permissions: {
            ...state.permissions,
            [account]: { ...state.permissions[account], memo },
          },
        };
      })
      .addCase(KEY_CREATE_PROMPT, (state: any) => ({ ...state, createPrompt: true }))
      .addCase(KEY_CREATE_CANCEL, (state: any) => ({ ...state, createPrompt: false }))
      .addCase(KEY_USE, (state: any, action: any) => {
        const { account } = action.payload;
        // Preserved verbatim from the legacy reducer (no state change on KEY_USE).
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { encrypted, key } = state.permissions[account];
        return state;
      })
      .addCase(KEY_USE_DECRYPT_PROMPT, (state: any, action: any) => {
        const { operation, params, auth } = action.payload;
        return { ...state, decrypt: { operation, params, auth } };
      })
      .addCase(KEY_USE_DECRYPT_PROMPT_CLOSE, (state: any) => ({ ...state, decrypt: false }))
      .addCase(KEY_REENCRYPTED, (state: any, action: any) => {
        const { account, key, memo } = action.payload || {};
        if (!account || !state.permissions[account]) return state;
        const updated = { ...state.permissions[account] };
        if (key !== undefined) {
          updated.key = key;
          updated.encrypted = true;
        }
        if (memo !== undefined) {
          updated.memo = memo;
        }
        return {
          ...state,
          permissions: { ...state.permissions, [account]: updated },
        };
      })
      .addCase(KEY_USE_ROLE_MISMATCH, (state: any, action: any) => ({
        ...state,
        // Dedicated field so the global KeyErrorModal can surface it (lastError is only read by the
        // onboarding key-import screens, which aren't visible when an in-app op fails the gate).
        roleError: action.payload,
        lastError: action.payload.message,
        decrypt: false,
      }))
      .addCase(KEY_ERROR_CLEAR, (state: any) => ({ ...state, roleError: false, lastError: false }))
      .addCase(KEY_REMOVE_CANCEL, (state: any) => ({ ...state, remove: false }))
      .addCase(KEY_REMOVE_CONFIRM, (state: any, action: any) => ({
        ...state,
        remove: action.payload,
      }))
      .addCase(KEY_REMOVE_CONFIRMED, (state: any, action: any) => {
        const newPermissions = { ...state.permissions };
        delete newPermissions[action.payload];
        const newNames = [...Object.keys(newPermissions)].sort();
        // 13.3 — tombstone the removed account so the migration never re-persists it (dedup).
        const removedLegacy = Array.isArray(state.removedLegacy) ? state.removedLegacy : [];
        const nextRemovedLegacy = removedLegacy.includes(action.payload)
          ? removedLegacy
          : [...removedLegacy, action.payload];
        return {
          ...state,
          isUser: !!newNames.length,
          names: newNames,
          permissions: newPermissions,
          removedLegacy: nextRemovedLegacy,
          remove: false,
        };
      });
  },
});

export default keysSlice.reducer;
