import processing from '../../app/reducers/processing';
import {
  ACCOUNT_TRANSFER_FAILED,
  ACCOUNT_TRANSFER_RESOLVED,
  ACCOUNT_TRANSFER_STARTED
} from '../../app/actions/account';

// A `${name}` placeholder of a node error's format string.
const placeholder = name => `$\{${name}}`;

describe('processing reducer', () => {
  it('tracks a transfer from pending to resolved', () => {
    let state = processing(undefined, { type: ACCOUNT_TRANSFER_STARTED });
    expect(state.account_transfer_pending).toBe(true);
    state = processing(state, { type: ACCOUNT_TRANSFER_RESOLVED });
    expect(state).toMatchObject({
      account_transfer_error: false,
      account_transfer_pending: false,
      account_transfer_resolved: true
    });
  });

  it('formats a node error from its stack template', () => {
    const payload = {
      payload: {
        error: {
          data: {
            stack: [{
              format: `Account ${placeholder('a')} has insufficient balance ${placeholder('b')}`,
              data: { a: 'alice', b: '1.000 HIVE' }
            }]
          }
        }
      }
    };
    const state = processing(undefined, { type: ACCOUNT_TRANSFER_FAILED, payload });
    expect(state.account_transfer_error).toBe('Account alice has insufficient balance 1.000 HIVE');
    expect(state.account_transfer_pending).toBe(false);
  });
});
