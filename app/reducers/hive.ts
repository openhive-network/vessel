import { createSlice } from '@reduxjs/toolkit';
import { HIVE_GLOBALPROPS_UPDATE, HIVE_GLOBALPROPS_UPDATE_RESOLVED } from '../actions/hive';

const defaultProps = {
  props: {
    time: null,
  },
};

const initialState: any = defaultProps;

const hiveSlice = createSlice({
  name: 'hive',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(HIVE_GLOBALPROPS_UPDATE_RESOLVED, (state: any, action: any) => {
      return { ...state, props: action.payload };
    });
  },
});

export default hiveSlice.reducer;
