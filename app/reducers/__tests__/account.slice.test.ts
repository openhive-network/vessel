import reducer from '../account';
import {
  ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION,
  ACCOUNT_DATA_UPDATE,
  ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE,
  ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE,
  ACCOUNT_GET_TRANSACTIONS_RESOLVED,
  ACCOUNT_CONTACTS_ADD,
  ACCOUNT_CONTACTS_REMOVE,
} from '../../actions/account';

describe('account reducer', () => {
  it('returns the initial state for an unknown action', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      updated: false,
      accounts: {},
    });
  });

  it('ACCOUNT_GET_TRANSACTIONS_RESOLVED stores the transactions payload', () => {
    const prev = { updated: false, accounts: {} };
    const next = reducer(prev, {
      type: ACCOUNT_GET_TRANSACTIONS_RESOLVED,
      payload: { transactions: [{ trx_id: 'abc' }] },
    });
    expect(next).toEqual({
      updated: false,
      accounts: {},
      transactions: [{ trx_id: 'abc' }],
    });
  });

  it('ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION sets minimumDelegation from the payload', () => {
    const prev = { updated: false, accounts: {} };
    const next = reducer(prev, {
      type: ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION,
      payload: '5.000000 VESTS',
    });
    expect(next).toEqual({
      updated: false,
      accounts: {},
      minimumDelegation: '5.000000 VESTS',
    });
  });

  describe('ACCOUNT_DATA_UPDATE', () => {
    it('merges the payload into an empty accounts map and stamps updated with a Date', () => {
      const prev = { updated: false, accounts: {} };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_UPDATE,
        payload: { alice: { balance: '1.000 HIVE' } },
      });
      expect(next.accounts).toEqual({ alice: { balance: '1.000 HIVE' } });
      expect(next.updated).toBeInstanceOf(Date);
    });

    it('merges the payload on top of existing accounts, overwriting matching keys', () => {
      const prev = {
        updated: false,
        accounts: { alice: { balance: '1.000 HIVE' }, bob: { balance: '2.000 HIVE' } },
      };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_UPDATE,
        payload: { alice: { balance: '9.000 HIVE' } },
      });
      expect(next.accounts).toEqual({
        alice: { balance: '9.000 HIVE' },
        bob: { balance: '2.000 HIVE' },
      });
    });

    it('falls back to an empty accounts map when state.accounts is missing', () => {
      const prev: any = { updated: false };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_UPDATE,
        payload: { alice: { balance: '1.000 HIVE' } },
      });
      expect(next.accounts).toEqual({ alice: { balance: '1.000 HIVE' } });
    });
  });

  describe('ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE', () => {
    it('initializes withdrawRoutes when absent and merges the payload', () => {
      const prev = { updated: false, accounts: {} };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE,
        payload: { alice: [{ to: 'bob', percent: 100 }] },
      });
      expect(next.withdrawRoutes).toEqual({ alice: [{ to: 'bob', percent: 100 }] });
    });

    it('merges onto existing withdrawRoutes without dropping other accounts', () => {
      const prev = {
        updated: false,
        accounts: {},
        withdrawRoutes: { bob: [{ to: 'carol', percent: 50 }] },
      };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE,
        payload: { alice: [{ to: 'bob', percent: 100 }] },
      });
      expect(next.withdrawRoutes).toEqual({
        bob: [{ to: 'carol', percent: 50 }],
        alice: [{ to: 'bob', percent: 100 }],
      });
    });
  });

  describe('ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE', () => {
    it('initializes vestingDelegations when absent and merges the payload', () => {
      const prev = { updated: false, accounts: {} };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE,
        payload: { alice: [{ delegatee: 'bob', vesting_shares: '1.000000 VESTS' }] },
      });
      expect(next.vestingDelegations).toEqual({
        alice: [{ delegatee: 'bob', vesting_shares: '1.000000 VESTS' }],
      });
    });

    it('merges onto existing vestingDelegations without dropping other accounts', () => {
      const prev = {
        updated: false,
        accounts: {},
        vestingDelegations: { bob: [{ delegatee: 'carol', vesting_shares: '2.000000 VESTS' }] },
      };
      const next: any = reducer(prev, {
        type: ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE,
        payload: { alice: [{ delegatee: 'bob', vesting_shares: '1.000000 VESTS' }] },
      });
      expect(next.vestingDelegations).toEqual({
        bob: [{ delegatee: 'carol', vesting_shares: '2.000000 VESTS' }],
        alice: [{ delegatee: 'bob', vesting_shares: '1.000000 VESTS' }],
      });
    });
  });

  describe('ACCOUNT_CONTACTS_ADD', () => {
    it('adds a new contact to an empty list', () => {
      const prev = { updated: false, accounts: {} };
      const next: any = reducer(prev, { type: ACCOUNT_CONTACTS_ADD, payload: 'alice' });
      expect(next.contacts).toEqual(['alice']);
    });

    it('appends a new contact to an existing list without mutating the original array', () => {
      const originalContacts = ['alice'];
      const prev = { updated: false, accounts: {}, contacts: originalContacts };
      const next: any = reducer(prev, { type: ACCOUNT_CONTACTS_ADD, payload: 'bob' });
      expect(next.contacts).toEqual(['alice', 'bob']);
      expect(originalContacts).toEqual(['alice']);
    });

    it('does not add a duplicate contact', () => {
      const prev = { updated: false, accounts: {}, contacts: ['alice'] };
      const next: any = reducer(prev, { type: ACCOUNT_CONTACTS_ADD, payload: 'alice' });
      expect(next.contacts).toEqual(['alice']);
    });
  });

  describe('ACCOUNT_CONTACTS_REMOVE', () => {
    it('removes the matching contact from the list', () => {
      const prev = { updated: false, accounts: {}, contacts: ['alice', 'bob'] };
      const next: any = reducer(prev, { type: ACCOUNT_CONTACTS_REMOVE, payload: 'alice' });
      expect(next.contacts).toEqual(['bob']);
    });

    it('leaves the list unchanged when the contact is not present', () => {
      const prev = { updated: false, accounts: {}, contacts: ['alice', 'bob'] };
      const next: any = reducer(prev, { type: ACCOUNT_CONTACTS_REMOVE, payload: 'carol' });
      expect(next.contacts).toEqual(['alice', 'bob']);
    });

    it('falls back to an empty list when state.contacts is missing', () => {
      const prev: any = { updated: false, accounts: {} };
      const next: any = reducer(prev, { type: ACCOUNT_CONTACTS_REMOVE, payload: 'alice' });
      expect(next.contacts).toEqual([]);
    });
  });
});
