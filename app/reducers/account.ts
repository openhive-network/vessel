import { createSlice } from '@reduxjs/toolkit';
import {
  ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION,
  ACCOUNT_DATA_UPDATE,
  ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE,
  ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE,
  ACCOUNT_GET_TRANSACTIONS_RESOLVED,
  ACCOUNT_CONTACTS_ADD,
  ACCOUNT_CONTACTS_REMOVE,
} from '../actions/account';

const initialState: any = {
  updated: false,
  accounts: {},
};

const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(ACCOUNT_GET_TRANSACTIONS_RESOLVED, (state: any, action: any) => {
        return { ...state, transactions: action.payload.transactions };
      })
      .addCase(ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION, (state: any, action: any) => {
        return { ...state, minimumDelegation: action.payload };
      })
      .addCase(ACCOUNT_DATA_UPDATE, (state: any, action: any) => {
        const accounts = state.accounts ? state.accounts : {};
        const amended = { ...accounts, ...action.payload };
        return { ...state, updated: new Date(), accounts: amended };
      })
      .addCase(ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE, (state: any, action: any) => {
        const withdrawRoutes = state.withdrawRoutes ? state.withdrawRoutes : {};
        const amended = { ...withdrawRoutes, ...action.payload };
        return { ...state, withdrawRoutes: amended };
      })
      .addCase(ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE, (state: any, action: any) => {
        const vestingDelegations = state.vestingDelegations ? state.vestingDelegations : {};
        const amended = { ...vestingDelegations, ...action.payload };
        return { ...state, vestingDelegations: amended };
      })
      .addCase(ACCOUNT_CONTACTS_ADD, (state: any, action: any) => {
        // Copy (not the draft) so pushing + returning a new object doesn't trip Immer's "returned a
        // new value AND mutated its draft" guard — same resulting state as the legacy plain reducer.
        const contacts = state.contacts ? [...state.contacts] : [];
        if (contacts.indexOf(action.payload) < 0) contacts.push(action.payload);
        return { ...state, contacts };
      })
      .addCase(ACCOUNT_CONTACTS_REMOVE, (state: any, action: any) => {
        let contacts = state.contacts ? state.contacts : [];
        contacts = contacts.filter((itm: any) => itm !== action.payload);
        return { ...state, contacts };
      });
  },
});

export default accountSlice.reducer;
