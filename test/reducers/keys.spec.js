import keys from '../../app/reducers/keys';
import {
  KEY_ADD_CONFIRMED,
  KEY_ADD_FAILED_WIF_INVALID,
  KEY_REMOVE_CONFIRMED
} from '../../app/actions/keys';

describe('keys reducer', () => {
  it('starts with no accounts', () => {
    expect(keys(undefined, { type: '@@INIT' })).toEqual({ names: [], permissions: {} });
  });

  it('adds confirmed keys and keeps the account names sorted', () => {
    let state = keys(undefined, {
      type: KEY_ADD_CONFIRMED,
      payload: {
        zed: {
          account: 'zed', key: 'k1', encrypted: false, type: 'active'
        }
      }
    });
    state = keys(state, {
      type: KEY_ADD_CONFIRMED,
      payload: {
        alice: {
          account: 'alice', key: 'k2', encrypted: true, type: 'posting'
        }
      }
    });
    expect(state.names).toEqual(['alice', 'zed']);
    expect(state.isUser).toBe(true);
    expect(state.permissions.alice.type).toBe('posting');
    expect(state.addPrompt).toBe(false);
  });

  it('removes a key without mutating the previous state', () => {
    const before = keys(undefined, {
      type: KEY_ADD_CONFIRMED,
      payload: { alice: { account: 'alice', key: 'k' } }
    });
    const after = keys(before, { type: KEY_REMOVE_CONFIRMED, payload: 'alice' });
    expect(after.names).toEqual([]);
    expect(after.isUser).toBe(false);
    expect(after.permissions).toEqual({});
    expect(before.permissions.alice.key).toBe('k');
  });

  it('records why adding a key failed', () => {
    const state = keys(undefined, { type: KEY_ADD_FAILED_WIF_INVALID });
    expect(state.lastError).toBe('Invalid WIF Key!');
  });
});
