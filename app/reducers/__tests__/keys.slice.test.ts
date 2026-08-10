import reducer from '../keys';
import {
  KEY_ADD_PROMPT,
  KEY_ADD_CANCEL,
  KEY_ADD_CONFIRM,
  KEY_ADD_CONFIRMED,
  KEY_ADD_FAILED_ACCOUNT_404,
  KEY_ADD_FAILED_WIF_INVALID,
  KEY_ADD_FAILED_WIF_INCORRECT,
  KEY_ADD_FAILED_PASSWORD_REQUIRED,
  KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH,
  KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN,
  KEY_ADD_MEMO_CANCEL,
  KEY_ADD_MEMO_PROMPT,
  KEY_ADD_MEMO_CONFIRMED,
  KEY_ADD_AUTH_CANCEL,
  KEY_ADD_AUTH_PROMPT,
  KEY_ADD_AUTH_CONFIRMED,
  KEY_CREATE_PROMPT,
  KEY_CREATE_CANCEL,
  KEY_USE,
  KEY_USE_DECRYPT_PROMPT,
  KEY_USE_DECRYPT_PROMPT_CLOSE,
  KEY_USE_ROLE_MISMATCH,
  KEY_REENCRYPTED,
  KEY_REMOVE_CANCEL,
  KEY_REMOVE_CONFIRM,
  KEY_REMOVE_CONFIRMED,
} from '../../actions/keys';

const initialState = {
  names: [],
  permissions: {},
  removedLegacy: [],
};

describe('keys reducer', () => {
  it('returns the initial state for an unknown action', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  it('KEY_ADD_PROMPT sets addPrompt true', () => {
    const state = reducer(initialState, { type: KEY_ADD_PROMPT });
    expect(state.addPrompt).toBe(true);
  });

  it('KEY_ADD_CANCEL clears addPrompt and confirm', () => {
    const prev = { ...initialState, addPrompt: true, confirm: { account: 'foo' } };
    const state = reducer(prev, { type: KEY_ADD_CANCEL });
    expect(state.addPrompt).toBe(false);
    expect(state.confirm).toBe(false);
  });

  it('KEY_ADD_CONFIRM sets addPrompt true and stashes the confirm payload', () => {
    const payload = { account: 'alice', wif: 'wif-1' };
    const state = reducer(initialState, { type: KEY_ADD_CONFIRM, payload });
    expect(state.addPrompt).toBe(true);
    expect(state.confirm).toEqual(payload);
  });

  it('KEY_ADD_CONFIRMED merges permissions, sorts names, and flags isUser', () => {
    const prev = {
      ...initialState,
      addPrompt: true,
      confirm: { account: 'zeta' },
      permissions: { zeta: { account: 'zeta', key: 'enc-z', encrypted: true } },
      names: ['zeta'],
    };
    const payload = { alice: { account: 'alice', key: 'enc-a', encrypted: true, type: 'active' } };
    const state = reducer(prev, { type: KEY_ADD_CONFIRMED, payload });

    expect(state.addPrompt).toBe(false);
    expect(state.confirm).toBe(false);
    expect(state.isUser).toBe(true);
    // sorted alphabetically, not insertion order
    expect(state.names).toEqual(['alice', 'zeta']);
    expect(state.permissions).toEqual({
      zeta: { account: 'zeta', key: 'enc-z', encrypted: true },
      alice: { account: 'alice', key: 'enc-a', encrypted: true, type: 'active' },
    });
  });

  it('KEY_ADD_FAILED_ACCOUNT_404 sets lastError', () => {
    const state = reducer(initialState, { type: KEY_ADD_FAILED_ACCOUNT_404 });
    expect(state.lastError).toBe('Account not found!');
  });

  it('KEY_ADD_FAILED_WIF_INVALID sets lastError', () => {
    const state = reducer(initialState, { type: KEY_ADD_FAILED_WIF_INVALID });
    expect(state.lastError).toBe('Invalid WIF Key!');
  });

  it('KEY_ADD_FAILED_WIF_INCORRECT sets lastError', () => {
    const state = reducer(initialState, { type: KEY_ADD_FAILED_WIF_INCORRECT });
    expect(state.lastError).toBe('Invalid WIF Key for Account!');
  });

  it('KEY_ADD_FAILED_PASSWORD_REQUIRED sets lastError', () => {
    const state = reducer(initialState, { type: KEY_ADD_FAILED_PASSWORD_REQUIRED });
    expect(state.lastError).toBe('A wallet password is required to store a key.');
  });

  it('KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH sets lastError', () => {
    const state = reducer(initialState, { type: KEY_ADD_MEMO_FAILED_PASSWORD_MISMATCH });
    expect(state.lastError).toBe(
      'That password does not unlock this account. The memo key must use the same wallet password as the account.'
    );
  });

  it('KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN sets lastError', () => {
    const state = reducer(initialState, { type: KEY_ADD_MEMO_FAILED_PLAINTEXT_MAIN });
    expect(state.lastError).toBe(
      'Set a wallet password for this account first, then add its encrypted memo key.'
    );
  });

  it('KEY_ADD_MEMO_PROMPT / KEY_ADD_MEMO_CANCEL toggle the memo prompt flags', () => {
    const opened = reducer(initialState, {
      type: KEY_ADD_MEMO_PROMPT,
      payload: { account: 'alice', public: 'pub-key' },
    });
    expect(opened.addMemoPrompt).toBe(true);
    expect(opened.confirmMemo).toEqual({ account: 'alice', public: 'pub-key' });

    const closed = reducer(opened, { type: KEY_ADD_MEMO_CANCEL });
    expect(closed.addMemoPrompt).toBe(false);
    expect(closed.confirmMemo).toBe(false);
  });

  it('KEY_ADD_MEMO_CONFIRMED attaches the memo to an existing permission record', () => {
    const prev = {
      ...initialState,
      addMemoPrompt: true,
      confirmMemo: { account: 'alice' },
      permissions: { alice: { account: 'alice', key: 'enc-a', encrypted: true } },
    };
    const state = reducer(prev, {
      type: KEY_ADD_MEMO_CONFIRMED,
      payload: { account: 'alice', memo: 'enc-memo' },
    });
    expect(state.addMemoPrompt).toBe(false);
    expect(state.confirmMemo).toBe(false);
    expect(state.permissions.alice).toEqual({
      account: 'alice',
      key: 'enc-a',
      encrypted: true,
      memo: 'enc-memo',
    });
  });

  it('KEY_ADD_MEMO_CONFIRMED is a no-op when the account has no existing permissions', () => {
    const state = reducer(initialState, {
      type: KEY_ADD_MEMO_CONFIRMED,
      payload: { account: 'ghost', memo: 'enc-memo' },
    });
    expect(state).toBe(initialState);
  });

  it('KEY_ADD_MEMO_CONFIRMED is a no-op when payload has no account', () => {
    const state = reducer(initialState, { type: KEY_ADD_MEMO_CONFIRMED, payload: {} });
    expect(state).toBe(initialState);
  });

  it('KEY_ADD_AUTH_PROMPT / KEY_ADD_AUTH_CANCEL toggle the auth prompt flags', () => {
    const opened = reducer(initialState, {
      type: KEY_ADD_AUTH_PROMPT,
      payload: { account: 'alice', public: 'pub-key' },
    });
    expect(opened.addAuthPrompt).toBe(true);
    expect(opened.confirmAuth).toEqual({ account: 'alice', public: 'pub-key' });

    const closed = reducer(opened, { type: KEY_ADD_AUTH_CANCEL });
    expect(closed.addAuthPrompt).toBe(false);
    expect(closed.confirmAuth).toBe(false);
  });

  it('KEY_ADD_AUTH_CONFIRMED attaches the memo to an existing permission record', () => {
    const prev = {
      ...initialState,
      permissions: { alice: { account: 'alice', key: 'enc-a', encrypted: true } },
    };
    const state = reducer(prev, {
      type: KEY_ADD_AUTH_CONFIRMED,
      payload: { account: 'alice', memo: 'enc-auth-memo' },
    });
    expect(state.addAuthPrompt).toBe(false);
    expect(state.confirmAuth).toBe(false);
    expect(state.permissions.alice).toEqual({
      account: 'alice',
      key: 'enc-a',
      encrypted: true,
      memo: 'enc-auth-memo',
    });
  });

  it('KEY_CREATE_PROMPT / KEY_CREATE_CANCEL toggle createPrompt', () => {
    const opened = reducer(initialState, { type: KEY_CREATE_PROMPT });
    expect(opened.createPrompt).toBe(true);
    const closed = reducer(opened, { type: KEY_CREATE_CANCEL });
    expect(closed.createPrompt).toBe(false);
  });

  it('KEY_USE reads permissions but never changes state (returns the same reference)', () => {
    const prev = {
      ...initialState,
      permissions: { alice: { account: 'alice', key: 'enc-a', encrypted: true } },
    };
    const state = reducer(prev, { type: KEY_USE, payload: { account: 'alice' } });
    expect(state).toBe(prev);
  });

  it('KEY_USE_DECRYPT_PROMPT stores the pending decrypt request', () => {
    const payload = { operation: 'transfer', params: { amount: '1.000 HIVE' }, auth: { type: 'active' } };
    const state = reducer(initialState, { type: KEY_USE_DECRYPT_PROMPT, payload });
    expect(state.decrypt).toEqual({
      operation: 'transfer',
      params: { amount: '1.000 HIVE' },
      auth: { type: 'active' },
    });
  });

  it('KEY_USE_DECRYPT_PROMPT_CLOSE clears the pending decrypt request', () => {
    const prev = { ...initialState, decrypt: { operation: 'transfer', params: {}, auth: {} } };
    const state = reducer(prev, { type: KEY_USE_DECRYPT_PROMPT_CLOSE });
    expect(state.decrypt).toBe(false);
  });

  it('KEY_USE_ROLE_MISMATCH records the error message and closes any decrypt prompt', () => {
    const prev = { ...initialState, decrypt: { operation: 'transfer', params: {}, auth: {} } };
    const state = reducer(prev, {
      type: KEY_USE_ROLE_MISMATCH,
      payload: { operation: 'transfer', message: 'This request requires your ACTIVE key.' },
    });
    expect(state.lastError).toBe('This request requires your ACTIVE key.');
    expect(state.decrypt).toBe(false);
  });

  it('KEY_REENCRYPTED updates key+encrypted and memo on an existing record', () => {
    const prev = {
      ...initialState,
      permissions: {
        alice: { account: 'alice', key: 'plain-wif', encrypted: false },
      },
    };
    const state = reducer(prev, {
      type: KEY_REENCRYPTED,
      payload: { account: 'alice', key: 'new-enc-key', memo: 'new-enc-memo' },
    });
    expect(state.permissions.alice).toEqual({
      account: 'alice',
      key: 'new-enc-key',
      encrypted: true,
      memo: 'new-enc-memo',
    });
  });

  it('KEY_REENCRYPTED is a no-op when the account has no existing permissions', () => {
    const state = reducer(initialState, {
      type: KEY_REENCRYPTED,
      payload: { account: 'ghost', key: 'k' },
    });
    expect(state).toBe(initialState);
  });

  it('KEY_REMOVE_CANCEL clears the remove flag', () => {
    const prev = { ...initialState, remove: 'alice' };
    const state = reducer(prev, { type: KEY_REMOVE_CANCEL });
    expect(state.remove).toBe(false);
  });

  it('KEY_REMOVE_CONFIRM stashes the pending removal account', () => {
    const state = reducer(initialState, { type: KEY_REMOVE_CONFIRM, payload: 'alice' });
    expect(state.remove).toBe('alice');
  });

  it('KEY_REMOVE_CONFIRMED deletes the permission, re-sorts names, and tombstones into removedLegacy', () => {
    const prev = {
      ...initialState,
      remove: 'bob',
      names: ['alice', 'bob'],
      permissions: {
        alice: { account: 'alice', key: 'enc-a', encrypted: true },
        bob: { account: 'bob', key: 'enc-b', encrypted: true },
      },
      removedLegacy: [],
    };
    const state = reducer(prev, { type: KEY_REMOVE_CONFIRMED, payload: 'bob' });

    expect(state.permissions).toEqual({ alice: { account: 'alice', key: 'enc-a', encrypted: true } });
    expect(state.names).toEqual(['alice']);
    expect(state.isUser).toBe(true);
    expect(state.removedLegacy).toEqual(['bob']);
    expect(state.remove).toBe(false);
  });

  it('KEY_REMOVE_CONFIRMED sets isUser false once the last account is removed', () => {
    const prev = {
      ...initialState,
      names: ['alice'],
      permissions: { alice: { account: 'alice', key: 'enc-a', encrypted: true } },
    };
    const state = reducer(prev, { type: KEY_REMOVE_CONFIRMED, payload: 'alice' });
    expect(state.names).toEqual([]);
    expect(state.isUser).toBe(false);
    expect(state.permissions).toEqual({});
  });

  it('KEY_REMOVE_CONFIRMED does not duplicate an account already tombstoned', () => {
    const prev = {
      ...initialState,
      names: ['alice'],
      permissions: { alice: { account: 'alice', key: 'enc-a', encrypted: true } },
      removedLegacy: ['alice'],
    };
    const state = reducer(prev, { type: KEY_REMOVE_CONFIRMED, payload: 'alice' });
    expect(state.removedLegacy).toEqual(['alice']);
  });
});
