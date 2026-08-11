import { createSlice } from '@reduxjs/toolkit';

import {
  PROCESSING_ACCOUNT_CREATE,
  PROCESSING_ACCOUNT_CREATE_CANCEL,
  PROCESSING_ACCOUNT_CREATE_COMPLETE,
  PROCESSING_ACCOUNT_CREATE_FAILED,
  PROCESSING_ACCOUNT_LOADING,
  PROCESSING_ACCOUNT_LOADING_COMPLETE,
  PROCESSING_REWARD_CLAIM,
  PROCESSING_REWARD_CLAIM_COMPLETE,
} from '../actions/processing';

import {
  ACCOUNT_CUSTOM_JSON_STARTED,
  ACCOUNT_CUSTOM_JSON_RESOLVED,
  ACCOUNT_CUSTOM_JSON_FAILED,
  ACCOUNT_CUSTOM_JSON_COMPLETED,
  ACCOUNT_CUSTOM_OPS_STARTED,
  ACCOUNT_CUSTOM_OPS_RESOLVED,
  ACCOUNT_CUSTOM_OPS_FAILED,
  ACCOUNT_CUSTOM_OPS_COMPLETED,
  ACCOUNT_TRANSFER_STARTED,
  ACCOUNT_TRANSFER_FAILED,
  ACCOUNT_TRANSFER_RESOLVED,
  ACCOUNT_TRANSFER_COMPLETED,
  ACCOUNT_DELEGATE_VESTING_SHARES_STARTED,
  ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED,
  ACCOUNT_DELEGATE_VESTING_SHARES_FAILED,
  ACCOUNT_DELEGATE_VESTING_SHARES_COMPLETED,
  ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_STARTED,
  ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_FAILED,
  ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_RESOLVED,
  ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_COMPLETED,
  ACCOUNT_SET_VOTING_PROXY_COMPLETED,
  ACCOUNT_SET_VOTING_PROXY_FAILED,
  ACCOUNT_SET_VOTING_PROXY_STARTED,
  ACCOUNT_SET_VOTING_PROXY_RESOLVED,
  ACCOUNT_VOTE_WITNESS_COMPLETED,
  ACCOUNT_VOTE_WITNESS_FAILED,
  ACCOUNT_VOTE_WITNESS_STARTED,
  ACCOUNT_VOTE_WITNESS_RESOLVED,
  ACCOUNT_VESTING_WITHDRAW_COMPLETED,
  ACCOUNT_VESTING_WITHDRAW_FAILED,
  ACCOUNT_VESTING_WITHDRAW_STARTED,
  ACCOUNT_VESTING_WITHDRAW_RESOLVED,
  ACCOUNT_POWER_UP_COMPLETED,
  ACCOUNT_POWER_UP_FAILED,
  ACCOUNT_POWER_UP_STARTED,
  ACCOUNT_POWER_UP_RESOLVED,
  ACCOUNT_CONVERT_COMPLETED,
  ACCOUNT_CONVERT_STARTED,
  ACCOUNT_CONVERT_RESOLVED,
  ACCOUNT_CONVERT_FAILED,
  ACCOUNT_COLLATERALIZED_CONVERT_COMPLETED,
  ACCOUNT_COLLATERALIZED_CONVERT_STARTED,
  ACCOUNT_COLLATERALIZED_CONVERT_FAILED,
  ACCOUNT_COLLATERALIZED_CONVERT_RESOLVED,
} from '../actions/account';

function setError(response: any) {
  try {
    const stack = response.payload.error.data.stack[0];
    const values = Object.keys(stack.data);
    let message = stack.format;
    if (values.length) {
      values.map((key) => {
        const value = stack.data[key];
        message = message.split(`\${${key}}`).join(value);
      });
    }
    return message;
  } catch (e) {
    console.log(e);
    console.log(response);
    return 'Unknown Error, check View -> Devtools for more information.';
  }
}

const initialState: any = {
  account_transfer_processing: false,
};

const processingSlice = createSlice({
  name: 'processing',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(PROCESSING_ACCOUNT_CREATE, (state: any) => {
        return {
          ...state,
          account_create_error: false,
          account_create_pending: true,
          account_create_resolved: false,
        };
      })
      .addCase(PROCESSING_ACCOUNT_CREATE_CANCEL, (state: any) => {
        return {
          ...state,
          account_create_error: false,
          account_create_pending: false,
          account_create_resolved: false,
        };
      })
      .addCase(PROCESSING_ACCOUNT_CREATE_COMPLETE, (state: any) => {
        return {
          ...state,
          account_create_error: false,
          account_create_pending: false,
          account_create_resolved: true,
        };
      })
      .addCase(PROCESSING_ACCOUNT_CREATE_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_create_error: action.payload.message,
          account_create_pending: false,
          account_create_resolved: false,
        };
      })
      .addCase(ACCOUNT_TRANSFER_STARTED, (state: any) => {
        return {
          ...state,
          account_transfer_error: false,
          account_transfer_resolved: false,
          account_transfer_pending: true,
        };
      })
      .addCase(ACCOUNT_TRANSFER_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_transfer_error: setError(action.payload),
          account_transfer_resolved: false,
          account_transfer_pending: false,
        };
      })
      .addCase(ACCOUNT_TRANSFER_RESOLVED, (state: any) => {
        return {
          ...state,
          account_transfer_error: false,
          account_transfer_resolved: true,
          account_transfer_pending: false,
        };
      })
      .addCase(ACCOUNT_CONVERT_STARTED, (state: any) => {
        return {
          ...state,
          account_convert_error: false,
          account_convert_resolved: false,
          account_convert_pending: true,
        };
      })
      .addCase(ACCOUNT_CONVERT_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_convert_error: setError(action.payload),
          account_convert_resolved: false,
          account_convert_pending: false,
        };
      })
      .addCase(ACCOUNT_CONVERT_RESOLVED, (state: any) => {
        return {
          ...state,
          account_convert_error: false,
          account_convert_resolved: true,
          account_convert_pending: false,
        };
      })
      .addCase(ACCOUNT_COLLATERALIZED_CONVERT_STARTED, (state: any) => {
        return {
          ...state,
          account_collateralized_convert_error: false,
          account_collateralized_convert_resolved: false,
          account_collateralized_convert_pending: true,
        };
      })
      .addCase(ACCOUNT_COLLATERALIZED_CONVERT_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_collateralized_convert_error: setError(action.payload),
          account_collateralized_convert_resolved: false,
          account_collateralized_convert_pending: false,
        };
      })
      .addCase(ACCOUNT_COLLATERALIZED_CONVERT_RESOLVED, (state: any) => {
        return {
          ...state,
          account_collateralized_convert_error: false,
          account_collateralized_convert_resolved: true,
          account_collateralized_convert_pending: false,
        };
      })
      .addCase(ACCOUNT_CUSTOM_JSON_STARTED, (state: any) => {
        return {
          ...state,
          account_custom_json_error: false,
          account_custom_json_resolved: false,
          account_custom_json_pending: true,
        };
      })
      .addCase(ACCOUNT_CUSTOM_JSON_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_custom_json_error: setError(action.payload),
          account_custom_json_resolved: false,
          account_custom_json_pending: false,
        };
      })
      .addCase(ACCOUNT_CUSTOM_JSON_RESOLVED, (state: any) => {
        return {
          ...state,
          account_custom_json_error: false,
          account_custom_json_resolved: true,
          account_custom_json_pending: false,
        };
      })
      .addCase(ACCOUNT_CUSTOM_JSON_COMPLETED, (state: any) => {
        return {
          ...state,
          account_custom_json_error: false,
          account_custom_json_resolved: false,
          account_custom_json_pending: false,
        };
      })
      .addCase(ACCOUNT_CUSTOM_OPS_STARTED, (state: any) => {
        return {
          ...state,
          account_custom_ops_error: false,
          account_custom_ops_resolved: false,
          account_custom_ops_pending: true,
        };
      })
      .addCase(ACCOUNT_CUSTOM_OPS_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_custom_ops_error: setError(action.payload),
          account_custom_ops_resolved: false,
          account_custom_ops_pending: false,
        };
      })
      .addCase(ACCOUNT_CUSTOM_OPS_RESOLVED, (state: any) => {
        return {
          ...state,
          account_custom_ops_error: false,
          account_custom_ops_resolved: true,
          account_custom_ops_pending: false,
        };
      })
      .addCase(ACCOUNT_CUSTOM_OPS_COMPLETED, (state: any) => {
        return {
          ...state,
          account_custom_ops_error: false,
          account_custom_ops_resolved: false,
          account_custom_ops_pending: false,
        };
      })
      .addCase(ACCOUNT_TRANSFER_COMPLETED, (state: any) => {
        return {
          ...state,
          account_transfer_error: false,
          account_transfer_resolved: false,
          account_transfer_pending: false,
        };
      })
      .addCase(ACCOUNT_CONVERT_COMPLETED, (state: any) => {
        return {
          ...state,
          account_convert_error: false,
          account_convert_resolved: false,
          account_convert_pending: false,
        };
      })
      .addCase(ACCOUNT_COLLATERALIZED_CONVERT_COMPLETED, (state: any) => {
        return {
          ...state,
          account_collateralized_convert_error: false,
          account_collateralized_convert_resolved: false,
          account_collateralized_convert_pending: false,
        };
      })
      .addCase(ACCOUNT_DELEGATE_VESTING_SHARES_STARTED, (state: any) => {
        return {
          ...state,
          account_delegate_vesting_shares_resolved: false,
          account_delegate_vesting_shares_error: false,
          account_delegate_vesting_shares_pending: true,
        };
      })
      .addCase(ACCOUNT_DELEGATE_VESTING_SHARES_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_delegate_vesting_shares_resolved: false,
          account_delegate_vesting_shares_error: setError(action.payload),
          account_delegate_vesting_shares_pending: false,
        };
      })
      .addCase(ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED, (state: any) => {
        return {
          ...state,
          account_delegate_vesting_shares_resolved: true,
          account_delegate_vesting_shares_error: false,
          account_delegate_vesting_shares_pending: false,
        };
      })
      .addCase(ACCOUNT_DELEGATE_VESTING_SHARES_COMPLETED, (state: any) => {
        return {
          ...state,
          account_delegate_vesting_shares_resolved: false,
          account_delegate_vesting_shares_error: false,
          account_delegate_vesting_shares_pending: false,
        };
      })
      .addCase(ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_STARTED, (state: any) => {
        return {
          ...state,
          account_set_withdraw_vesting_route_resolved: false,
          account_set_withdraw_vesting_route_error: false,
          account_set_withdraw_vesting_route_pending: true,
        };
      })
      .addCase(ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_set_withdraw_vesting_route_resolved: false,
          account_set_withdraw_vesting_route_error: setError(action.payload),
          account_set_withdraw_vesting_route_pending: false,
        };
      })
      .addCase(ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_RESOLVED, (state: any) => {
        return {
          ...state,
          account_set_withdraw_vesting_route_resolved: true,
          account_set_withdraw_vesting_route_error: false,
          account_set_withdraw_vesting_route_pending: false,
        };
      })
      .addCase(ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_COMPLETED, (state: any) => {
        return {
          ...state,
          account_set_withdraw_vesting_route_resolved: false,
          account_set_withdraw_vesting_route_error: false,
          account_set_withdraw_vesting_route_pending: false,
        };
      })
      .addCase(ACCOUNT_SET_VOTING_PROXY_STARTED, (state: any) => {
        return {
          ...state,
          account_set_voting_proxy_resolved: false,
          account_set_voting_proxy_error: false,
          account_set_voting_proxy_pending: true,
        };
      })
      .addCase(ACCOUNT_SET_VOTING_PROXY_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_set_voting_proxy_resolved: false,
          account_set_voting_proxy_error: setError(action.payload),
          account_set_voting_proxy_pending: false,
        };
      })
      .addCase(ACCOUNT_SET_VOTING_PROXY_RESOLVED, (state: any) => {
        return {
          ...state,
          account_set_voting_proxy_resolved: true,
          account_set_voting_proxy_error: false,
          account_set_voting_proxy_pending: false,
        };
      })
      .addCase(ACCOUNT_SET_VOTING_PROXY_COMPLETED, (state: any) => {
        return {
          ...state,
          account_set_voting_proxy_resolved: false,
          account_set_voting_proxy_error: false,
          account_set_voting_proxy_pending: false,
        };
      })
      .addCase(ACCOUNT_VOTE_WITNESS_STARTED, (state: any) => {
        return {
          ...state,
          account_vote_witness_resolved: false,
          account_vote_witness_error: false,
          account_vote_witness_pending: true,
        };
      })
      .addCase(ACCOUNT_VOTE_WITNESS_FAILED, (state: any, action: any) => {
        return {
          ...state,
          account_vote_witness_resolved: false,
          account_vote_witness_error: setError(action.payload),
          account_vote_witness_pending: false,
        };
      })
      .addCase(ACCOUNT_VOTE_WITNESS_RESOLVED, (state: any) => {
        return {
          ...state,
          account_vote_witness_resolved: true,
          account_vote_witness_error: false,
          account_vote_witness_pending: false,
        };
      })
      .addCase(ACCOUNT_VOTE_WITNESS_COMPLETED, (state: any) => {
        return {
          ...state,
          account_vote_witness_resolved: false,
          account_vote_witness_error: false,
          account_vote_witness_pending: false,
        };
      })
      .addCase(ACCOUNT_VESTING_WITHDRAW_STARTED, (state: any) => {
        return {
          ...state,
          account_vesting_withdraw_resolved: false,
          account_vesting_withdraw_error: false,
          account_vesting_withdraw_pending: true,
        };
      })
      .addCase(ACCOUNT_VESTING_WITHDRAW_FAILED, (state: any) => {
        return {
          ...state,
          account_vesting_withdraw_resolved: false,
          account_vesting_withdraw_error: true,
          account_vesting_withdraw_pending: false,
        };
      })
      .addCase(ACCOUNT_VESTING_WITHDRAW_RESOLVED, (state: any) => {
        return {
          ...state,
          account_vesting_withdraw_resolved: true,
          account_vesting_withdraw_error: false,
          account_vesting_withdraw_pending: false,
        };
      })
      .addCase(ACCOUNT_VESTING_WITHDRAW_COMPLETED, (state: any) => {
        return {
          ...state,
          account_vesting_withdraw_resolved: false,
          account_vesting_withdraw_error: false,
          account_vesting_withdraw_pending: false,
        };
      })
      .addCase(ACCOUNT_POWER_UP_STARTED, (state: any) => {
        return {
          ...state,
          account_power_up_resolved: false,
          account_power_up_error: false,
          account_power_up_pending: true,
        };
      })
      .addCase(ACCOUNT_POWER_UP_FAILED, (state: any) => {
        return {
          ...state,
          account_power_up_resolved: false,
          account_power_up_error: true,
          account_power_up_pending: false,
        };
      })
      .addCase(ACCOUNT_POWER_UP_RESOLVED, (state: any) => {
        return {
          ...state,
          account_power_up_resolved: true,
          account_power_up_error: false,
          account_power_up_pending: false,
        };
      })
      .addCase(ACCOUNT_POWER_UP_COMPLETED, (state: any) => {
        return {
          ...state,
          account_power_up_resolved: false,
          account_power_up_error: false,
          account_power_up_pending: false,
        };
      })
      .addCase(PROCESSING_ACCOUNT_LOADING, (state: any) => {
        return { ...state, account_loading: true };
      })
      .addCase(PROCESSING_ACCOUNT_LOADING_COMPLETE, (state: any) => {
        return { ...state, account_loading: false };
      })
      .addCase(PROCESSING_REWARD_CLAIM, (state: any) => {
        return { ...state, reward_claim: true };
      })
      .addCase(PROCESSING_REWARD_CLAIM_COMPLETE, (state: any) => {
        return { ...state, reward_claim: false };
      });
  },
});

export default processingSlice.reducer;
