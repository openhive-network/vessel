// @flow
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
  KEY_ADD_FAILED_ACCOUNT_404,
  KEY_ADD_FAILED_WIF_INCORRECT,
  KEY_ADD_FAILED_WIF_INVALID,
  KEY_ADD_MEMO_PROMPT,
  KEY_ADD_MEMO_CANCEL,
  KEY_ADD_MEMO_CONFIRM,
  KEY_ADD_MEMO_CONFIRMED,
  KEY_ADD_AUTH_PROMPT,
  KEY_ADD_AUTH_CANCEL,
  KEY_ADD_AUTH_CONFIRM,
  KEY_ADD_AUTH_CONFIRMED,
  KEY_ADD_PROMPT,
  KEY_CREATE_CANCEL,
  KEY_CREATE_PROMPT,
} from '../actions/keys';

const defaultState = {
  names: [],
  permissions: {},
};

type actionType = {
  type: string,
  payload: any,
};

export default function keys(state: any = defaultState, action: actionType) {
  // console.log('>>> reducers/account', state, action);
  switch (action.type) {
    case KEY_ADD_PROMPT: {
      return { ...state, addPrompt: true };
    }
    case KEY_ADD_CANCEL: {
      return { ...state, addPrompt: false, confirm: false };
    }
    case KEY_ADD_CONFIRM: {
      return { ...state, addPrompt: true, confirm: action.payload };
    }
    case KEY_ADD_CONFIRMED: {
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
    }
    case KEY_ADD_FAILED_ACCOUNT_404:
      return { ...state, lastError: 'Account not found!' };
    case KEY_ADD_FAILED_WIF_INVALID:
      return { ...state, lastError: 'Invalid WIF Key!' };
    case KEY_ADD_FAILED_WIF_INCORRECT:
      return { ...state, lastError: 'Invalid WIF Key for Account!' };
    case KEY_ADD_MEMO_CANCEL: {
      return { ...state, addMemoPrompt: false, confirmMemo: false };
    }
    case KEY_ADD_MEMO_PROMPT: {
      return { ...state, addMemoPrompt: true, confirmMemo: action.payload };
    }
    case KEY_ADD_MEMO_CONFIRMED: {
      const newPermissions = state.permissions;
      const { account, wif } = action.payload;
      if (newPermissions[account]) {
        newPermissions[account].memo = wif;
      }
      return { ...state, addMemoPrompt: false, confirmMemo: false, permissions: newPermissions };
    }
    case KEY_ADD_AUTH_CANCEL: {
      return { ...state, addAuthPrompt: false, confirmAuth: false };
    }
    case KEY_ADD_AUTH_PROMPT: {
      return { ...state, addAuthPrompt: true, confirmAuth: action.payload };
    }
    case KEY_ADD_AUTH_CONFIRMED: {
      console.log('add new auth');
      const newPermissions = state.permissions;
      const { account, wif } = action.payload;
      if (newPermissions[account]) {
        newPermissions[account].memo = wif;
      }
      return { ...state, addAuthPrompt: false, confirmAuth: false, permissions: newPermissions };
    }
    case KEY_CREATE_PROMPT: {
      return { ...state, createPrompt: true };
    }
    case KEY_CREATE_CANCEL: {
      return { ...state, createPrompt: false };
    }
    case KEY_USE: {
      const { account } = action.payload;
      const { encrypted, key } = state.permissions[account];
      return state;
    }
    case KEY_USE_DECRYPT_PROMPT: {
      const { operation, params, auth } = action.payload;
      return { ...state, decrypt: { operation, params, auth } };
      return state;
    }
    case KEY_USE_DECRYPT_PROMPT_CLOSE: {
      return { ...state, decrypt: false };
      return state;
    }
    case KEY_REMOVE_CANCEL: {
      return { ...state, remove: false };
    }
    case KEY_REMOVE_CONFIRM: {
      return { ...state, remove: action.payload };
    }
    case KEY_REMOVE_CONFIRMED: {
      const newPermissions = { ...state.permissions };
      delete newPermissions[action.payload];
      const newNames = [...Object.keys(newPermissions)].sort();
      return {
        ...state,
        isUser: !!newNames.length,
        names: newNames,
        permissions: newPermissions,
        remove: false,
      };
    }
    default: {
      return state;
    }
  }
}
