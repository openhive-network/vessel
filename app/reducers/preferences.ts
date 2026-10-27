import { createSlice } from '@reduxjs/toolkit';
import { SET_PREFERENCE } from '../actions/preferences';

const initialState: any = {
  hived_node: 'https://api.hive.blog',
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(SET_PREFERENCE, (state: any, action: any) => {
      return { ...state, [action.payload.key]: action.payload.value };
    });
  },
});

export default preferencesSlice.reducer;
