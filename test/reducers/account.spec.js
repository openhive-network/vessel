import account from '../../app/reducers/account';
import {
  ACCOUNT_CONTACTS_ADD,
  ACCOUNT_CONTACTS_REMOVE,
  ACCOUNT_DATA_UPDATE
} from '../../app/actions/account';

describe('account reducer', () => {
  it('merges account data and stamps the update time', () => {
    let state = account(undefined, { type: ACCOUNT_DATA_UPDATE, payload: { alice: { balance: '1.000 HIVE' } } });
    state = account(state, { type: ACCOUNT_DATA_UPDATE, payload: { bob: { balance: '2.000 HIVE' } } });
    expect(Object.keys(state.accounts).sort()).toEqual(['alice', 'bob']);
    expect(state.updated).toBeInstanceOf(Date);
  });

  it('adds a contact once and removes it again', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    let state = account(undefined, { type: ACCOUNT_CONTACTS_ADD, payload: 'binance-hot' });
    state = account(state, { type: ACCOUNT_CONTACTS_ADD, payload: 'binance-hot' });
    expect(state.contacts).toEqual(['binance-hot']);
    state = account(state, { type: ACCOUNT_CONTACTS_REMOVE, payload: 'binance-hot' });
    expect(state.contacts).toEqual([]);
    console.log.mockRestore();
  });
});
