import { describe, it, expect } from 'vitest';

import reducer from '../processing';

import {
  PROCESSING_ACCOUNT_CREATE,
  PROCESSING_ACCOUNT_CREATE_CANCEL,
  PROCESSING_ACCOUNT_CREATE_COMPLETE,
  PROCESSING_ACCOUNT_CREATE_FAILED,
  PROCESSING_ACCOUNT_LOADING,
  PROCESSING_ACCOUNT_LOADING_COMPLETE,
  PROCESSING_REWARD_CLAIM,
  PROCESSING_REWARD_CLAIM_COMPLETE,
} from '../../actions/processing';

import {
  ACCOUNT_TRANSFER_STARTED,
  ACCOUNT_TRANSFER_FAILED,
  ACCOUNT_TRANSFER_RESOLVED,
  ACCOUNT_TRANSFER_COMPLETED,
  ACCOUNT_VESTING_WITHDRAW_STARTED,
  ACCOUNT_VESTING_WITHDRAW_FAILED,
  ACCOUNT_VESTING_WITHDRAW_RESOLVED,
  ACCOUNT_POWER_UP_FAILED,
  ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED,
} from '../../actions/account';

const initialState = {
  account_transfer_processing: false,
};

describe('processing reducer', () => {
  it('returns the initial state for an unknown action', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  describe('PROCESSING_ACCOUNT_CREATE family', () => {
    it('PROCESSING_ACCOUNT_CREATE sets pending, clears error/resolved', () => {
      const result = reducer(initialState, { type: PROCESSING_ACCOUNT_CREATE });
      expect(result).toEqual({
        ...initialState,
        account_create_error: false,
        account_create_pending: true,
        account_create_resolved: false,
      });
    });

    it('PROCESSING_ACCOUNT_CREATE_CANCEL clears pending and resolved', () => {
      const prevState = {
        ...initialState,
        account_create_error: false,
        account_create_pending: true,
        account_create_resolved: false,
      };
      const result = reducer(prevState, { type: PROCESSING_ACCOUNT_CREATE_CANCEL });
      expect(result).toEqual({
        ...initialState,
        account_create_error: false,
        account_create_pending: false,
        account_create_resolved: false,
      });
    });

    it('PROCESSING_ACCOUNT_CREATE_COMPLETE marks resolved and clears pending', () => {
      const prevState = {
        ...initialState,
        account_create_error: false,
        account_create_pending: true,
        account_create_resolved: false,
      };
      const result = reducer(prevState, { type: PROCESSING_ACCOUNT_CREATE_COMPLETE });
      expect(result).toEqual({
        ...initialState,
        account_create_error: false,
        account_create_pending: false,
        account_create_resolved: true,
      });
    });

    it('PROCESSING_ACCOUNT_CREATE_FAILED stores action.payload.message verbatim as the error', () => {
      const prevState = {
        ...initialState,
        account_create_error: false,
        account_create_pending: true,
        account_create_resolved: false,
      };
      const result = reducer(prevState, {
        type: PROCESSING_ACCOUNT_CREATE_FAILED,
        payload: { message: 'account name already taken' },
      });
      expect(result).toEqual({
        ...initialState,
        account_create_error: 'account name already taken',
        account_create_pending: false,
        account_create_resolved: false,
      });
    });
  });

  describe('ACCOUNT_TRANSFER family', () => {
    it('ACCOUNT_TRANSFER_STARTED sets pending and clears error/resolved', () => {
      const result = reducer(initialState, { type: ACCOUNT_TRANSFER_STARTED });
      expect(result).toEqual({
        ...initialState,
        account_transfer_error: false,
        account_transfer_resolved: false,
        account_transfer_pending: true,
      });
    });

    it('ACCOUNT_TRANSFER_FAILED formats the hive-js error stack into a message', () => {
      const prevState = {
        ...initialState,
        account_transfer_error: false,
        account_transfer_resolved: false,
        account_transfer_pending: true,
      };
      const action = {
        type: ACCOUNT_TRANSFER_FAILED,
        payload: {
          payload: {
            error: {
              data: {
                stack: [
                  {
                    format: 'Account ${account} does not have enough HIVE',
                    data: { account: 'alice' },
                  },
                ],
              },
            },
          },
        },
      };
      const result = reducer(prevState, action);
      expect(result).toEqual({
        ...prevState,
        account_transfer_error: 'Account alice does not have enough HIVE',
        account_transfer_resolved: false,
        account_transfer_pending: false,
      });
    });

    it('ACCOUNT_TRANSFER_FAILED falls back to a generic message when the error shape is malformed', () => {
      const prevState = {
        ...initialState,
        account_transfer_error: false,
        account_transfer_resolved: false,
        account_transfer_pending: true,
      };
      const result = reducer(prevState, {
        type: ACCOUNT_TRANSFER_FAILED,
        payload: { unexpected: 'shape' },
      });
      expect(result.account_transfer_error).toBe(
        'Unknown Error, check View -> Devtools for more information.',
      );
      expect(result.account_transfer_resolved).toBe(false);
      expect(result.account_transfer_pending).toBe(false);
    });

    it('ACCOUNT_TRANSFER_RESOLVED marks resolved and clears pending/error', () => {
      const prevState = {
        ...initialState,
        account_transfer_error: 'some previous error',
        account_transfer_resolved: false,
        account_transfer_pending: true,
      };
      const result = reducer(prevState, { type: ACCOUNT_TRANSFER_RESOLVED });
      expect(result).toEqual({
        ...initialState,
        account_transfer_error: false,
        account_transfer_resolved: true,
        account_transfer_pending: false,
      });
    });

    it('ACCOUNT_TRANSFER_COMPLETED clears pending/resolved/error entirely', () => {
      const prevState = {
        ...initialState,
        account_transfer_error: false,
        account_transfer_resolved: true,
        account_transfer_pending: false,
      };
      const result = reducer(prevState, { type: ACCOUNT_TRANSFER_COMPLETED });
      expect(result).toEqual({
        ...initialState,
        account_transfer_error: false,
        account_transfer_resolved: false,
        account_transfer_pending: false,
      });
    });
  });

  describe('ACCOUNT_VESTING_WITHDRAW family (boolean error flag, not setError)', () => {
    it('ACCOUNT_VESTING_WITHDRAW_STARTED sets pending', () => {
      const result = reducer(initialState, { type: ACCOUNT_VESTING_WITHDRAW_STARTED });
      expect(result).toEqual({
        ...initialState,
        account_vesting_withdraw_resolved: false,
        account_vesting_withdraw_error: false,
        account_vesting_withdraw_pending: true,
      });
    });

    it('ACCOUNT_VESTING_WITHDRAW_FAILED sets error to a literal true (no message formatting)', () => {
      const prevState = {
        ...initialState,
        account_vesting_withdraw_resolved: false,
        account_vesting_withdraw_error: false,
        account_vesting_withdraw_pending: true,
      };
      const result = reducer(prevState, {
        type: ACCOUNT_VESTING_WITHDRAW_FAILED,
        payload: { anything: 'is ignored' },
      });
      expect(result).toEqual({
        ...initialState,
        account_vesting_withdraw_resolved: false,
        account_vesting_withdraw_error: true,
        account_vesting_withdraw_pending: false,
      });
    });

    it('ACCOUNT_VESTING_WITHDRAW_RESOLVED marks resolved', () => {
      const result = reducer(initialState, { type: ACCOUNT_VESTING_WITHDRAW_RESOLVED });
      expect(result).toEqual({
        ...initialState,
        account_vesting_withdraw_resolved: true,
        account_vesting_withdraw_error: false,
        account_vesting_withdraw_pending: false,
      });
    });
  });

  it('ACCOUNT_POWER_UP_FAILED sets error to a literal true (no setError call)', () => {
    const result = reducer(initialState, { type: ACCOUNT_POWER_UP_FAILED });
    expect(result).toEqual({
      ...initialState,
      account_power_up_resolved: false,
      account_power_up_error: true,
      account_power_up_pending: false,
    });
  });

  it('ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED marks resolved and clears pending/error', () => {
    const prevState = {
      ...initialState,
      account_delegate_vesting_shares_resolved: false,
      account_delegate_vesting_shares_error: 'previous error',
      account_delegate_vesting_shares_pending: true,
    };
    const result = reducer(prevState, { type: ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED });
    expect(result).toEqual({
      ...initialState,
      account_delegate_vesting_shares_resolved: true,
      account_delegate_vesting_shares_error: false,
      account_delegate_vesting_shares_pending: false,
    });
  });

  describe('simple boolean flags (no pending/resolved/error triad)', () => {
    it('PROCESSING_ACCOUNT_LOADING / PROCESSING_ACCOUNT_LOADING_COMPLETE toggle account_loading', () => {
      const loading = reducer(initialState, { type: PROCESSING_ACCOUNT_LOADING });
      expect(loading).toEqual({ ...initialState, account_loading: true });

      const done = reducer(loading, { type: PROCESSING_ACCOUNT_LOADING_COMPLETE });
      expect(done).toEqual({ ...initialState, account_loading: false });
    });

    it('PROCESSING_REWARD_CLAIM / PROCESSING_REWARD_CLAIM_COMPLETE toggle reward_claim', () => {
      const claiming = reducer(initialState, { type: PROCESSING_REWARD_CLAIM });
      expect(claiming).toEqual({ ...initialState, reward_claim: true });

      const done = reducer(claiming, { type: PROCESSING_REWARD_CLAIM_COMPLETE });
      expect(done).toEqual({ ...initialState, reward_claim: false });
    });
  });
});
