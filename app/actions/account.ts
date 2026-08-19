import { hiveApi, hiveConfig } from '../utils/hiveApi';
import * as ProcessingActions from './processing';
import { requiredRoleForOps } from '../utils/authorityRoles';
import { broadcastOps, signAndBroadcast } from '../utils/broadcast';

export const ACCOUNT_CUSTOM_JSON_STARTED = 'ACCOUNT_CUSTOM_JSON_STARTED';
export const ACCOUNT_CUSTOM_JSON_RESOLVED = 'ACCOUNT_CUSTOM_JSON_RESOLVED';
export const ACCOUNT_CUSTOM_JSON_FAILED = 'ACCOUNT_CUSTOM_JSON_FAILED';
export const ACCOUNT_CUSTOM_JSON_COMPLETED = 'ACCOUNT_CUSTOM_JSON_COMPLETED';
export const ACCOUNT_CUSTOM_OPS_STARTED = 'ACCOUNT_CUSTOM_OPS_STARTED';
export const ACCOUNT_CUSTOM_OPS_RESOLVED = 'ACCOUNT_CUSTOM_OPS_RESOLVED';
export const ACCOUNT_CUSTOM_OPS_FAILED = 'ACCOUNT_CUSTOM_OPS_FAILED';
export const ACCOUNT_CUSTOM_OPS_COMPLETED = 'ACCOUNT_CUSTOM_OPS_COMPLETED';
export const ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION = 'ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION';
export const ACCOUNT_DATA_UPDATE = 'ACCOUNT_DATA_UPDATE';
export const ACCOUNT_DATA_UPDATE_FAILED = 'ACCOUNT_DATA_UPDATE_FAILED';
export const ACCOUNT_DATA_UPDATE_PENDING = 'ACCOUNT_DATA_UPDATE_PENDING';
export const ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE_PENDING =
  'ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE_PENDING';
export const ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE_FAILED =
  'ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE_FAILED';
export const ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE = 'ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE';
export const ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE_PENDING =
  'ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE_PENDING';
export const ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE_FAILED =
  'ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE_FAILED';
export const ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE = 'ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE';
export const ACCOUNT_DELEGATE_VESTING_SHARES_STARTED = 'ACCOUNT_DELEGATE_VESTING_SHARES_STARTED';
export const ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED = 'ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED';
export const ACCOUNT_DELEGATE_VESTING_SHARES_FAILED = 'ACCOUNT_DELEGATE_VESTING_SHARES_FAILED';
export const ACCOUNT_DELEGATE_VESTING_SHARES_COMPLETED =
  'ACCOUNT_DELEGATE_VESTING_SHARES_COMPLETED';
export const ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_STARTED =
  'ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_STARTED';
export const ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_FAILED =
  'ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_FAILED';
export const ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_RESOLVED =
  'ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_RESOLVED';
export const ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_COMPLETED =
  'ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_COMPLETED';
export const ACCOUNT_SET_VOTING_PROXY_STARTED = 'ACCOUNT_SET_VOTING_PROXY_STARTED';
export const ACCOUNT_SET_VOTING_PROXY_FAILED = 'ACCOUNT_SET_VOTING_PROXY_FAILED';
export const ACCOUNT_SET_VOTING_PROXY_RESOLVED = 'ACCOUNT_SET_VOTING_PROXY_RESOLVED';
export const ACCOUNT_SET_VOTING_PROXY_COMPLETED = 'ACCOUNT_SET_VOTING_PROXY_COMPLETED';
export const ACCOUNT_VOTE_WITNESS_STARTED = 'ACCOUNT_VOTE_WITNESS_STARTED';
export const ACCOUNT_VOTE_WITNESS_FAILED = 'ACCOUNT_VOTE_WITNESS_FAILED';
export const ACCOUNT_VOTE_WITNESS_RESOLVED = 'ACCOUNT_VOTE_WITNESS_RESOLVED';
export const ACCOUNT_VOTE_WITNESS_COMPLETED = 'ACCOUNT_VOTE_WITNESS_COMPLETED';
export const ACCOUNT_VESTING_WITHDRAW_COMPLETED = 'ACCOUNT_VESTING_WITHDRAW_COMPLETED';
export const ACCOUNT_VESTING_WITHDRAW_STARTED = 'ACCOUNT_VESTING_WITHDRAW_STARTED';
export const ACCOUNT_VESTING_WITHDRAW_FAILED = 'ACCOUNT_VESTING_WITHDRAW_FAILED';
export const ACCOUNT_VESTING_WITHDRAW_RESOLVED = 'ACCOUNT_VESTING_WITHDRAW_RESOLVED';
export const ACCOUNT_POWER_UP_COMPLETED = 'ACCOUNT_POWER_UP_COMPLETED';
export const ACCOUNT_POWER_UP_STARTED = 'ACCOUNT_POWER_UP_STARTED';
export const ACCOUNT_POWER_UP_FAILED = 'ACCOUNT_POWER_UP_FAILED';
export const ACCOUNT_POWER_UP_RESOLVED = 'ACCOUNT_POWER_UP_RESOLVED';
export const ACCOUNT_TRANSFER_STARTED = 'ACCOUNT_TRANSFER_STARTED';
export const ACCOUNT_TRANSFER_FAILED = 'ACCOUNT_TRANSFER_FAILED';
export const ACCOUNT_TRANSFER_RESOLVED = 'ACCOUNT_TRANSFER_RESOLVED';
export const ACCOUNT_TRANSFER_COMPLETED = 'ACCOUNT_TRANSFER_COMPLETED';
export const ACCOUNT_CONTACTS_ADD = 'ACCOUNT_CONTACTS_ADD';
export const ACCOUNT_CONTACTS_REMOVE = 'ACCOUNT_CONTACTS_REMOVE';

export const ACCOUNT_CONVERT_COMPLETED = 'ACCOUNT_CONVERT_COMPLETED';
export const ACCOUNT_CONVERT_STARTED = 'ACCOUNT_CONVERT_STARTED';
export const ACCOUNT_CONVERT_FAILED = 'ACCOUNT_CONVERT_FAILED';
export const ACCOUNT_CONVERT_RESOLVED = 'ACCOUNT_CONVERT_RESOLVED';
export const ACCOUNT_COLLATERALIZED_CONVERT_COMPLETED = 'ACCOUNT_COLLATERALIZED_CONVERT_COMPLETED';
export const ACCOUNT_COLLATERALIZED_CONVERT_STARTED = 'ACCOUNT_COLLATERALIZED_CONVERT_STARTED';
export const ACCOUNT_COLLATERALIZED_CONVERT_FAILED = 'ACCOUNT_COLLATERALIZED_CONVERT_FAILED';
export const ACCOUNT_COLLATERALIZED_CONVERT_RESOLVED = 'ACCOUNT_COLLATERALIZED_CONVERT_RESOLVED';

export function claimRewardBalance(wif: any, params: any) {
  return (dispatch: any) => {
    let { account, reward_hive, reward_hbd, reward_vests } = params;
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      reward_hive = reward_hive.replace('HIVE', 'TESTS');
      reward_hbd = reward_hbd.replace('HBD', 'TBD');
    }
    // Legacy callback ignored err/result and ran on both outcomes; reproduce that with .then(done, done).
    const done = () => {
      dispatch(ProcessingActions.processingRewardClaimComplete());
      dispatch(refreshAccountData([account]));
    };
    broadcastOps
      .claimRewardBalance(wif, { account, reward_hive, reward_hbd, reward_vests })
      .then(done, done);
    dispatch(ProcessingActions.processingRewardClaim());
  };
}

// This function automatically attempts to use the minimal account creation fee
// and delegation amount.
export function createAccountDelegated(wif: any, params: any, preferences = {}) {
  return (dispatch: any) => {
    // const { creator, username, password } = params;
    // let client
    // if(preferences && preferences.hived_node) {
    //   client = new Client(preferences.hived_node);
    // } else {
    //   client = new Client('https://api.hive.blog');
    // }
    // const dsteem = require('dsteem');
    // const creatorKey = dhive.PrivateKey.fromString(wif);
    dispatch(ProcessingActions.processingAccountCreate());
    // client.broadcast.createAccount({
    //   creator, username, password
    // }, creatorKey).then(function(result) {
    dispatch(ProcessingActions.processingAccountCreateComplete());
    //   client.disconnect()
    // }, function(error) {
    //   dispatch(ProcessingActions.processingAccountCreateFailed(error));
    // });
  };
}

export function getMinimumAccountDelegation(preferences = {}) {
  return async (dispatch: any) => {
    // let client
    // if(preferences && preferences.hived_node) {
    //   client = new Client(preferences.hived_node);
    // } else {
    //   client = new Client('https://api.hive.blog');
    // }
    // const constants = await client.database.getConfig();
    // const chainProps = await client.database.getChainProperties();
    // const dynamicProps = await client.database.getDynamicGlobalProperties();

    // const creationFee = Asset.from(chainProps.account_creation_fee);
    // const sharePrice = Praiice.from({
    //   base: dynamicProps.total_vesting_shares,
    //   quote: dynamicProps.total_vesting_fund_hive
    // });

    // const ratio = constants.HIVE_CREATE_ACCOUNT_DELEGATION_RATIO;
    // const modifier = constants.HIVE_CREATE_ACCOUNT_WITH_HIVE_MODIFIER;

    // const fee = Asset.from('0.200 HIVE');

    // const targetDelegation = sharePrice.convert(creationFee.multiply(modifier * ratio));
    // const delegation = targetDelegation.subtract(sharePrice.convert(fee.multiply(ratio)));
    // const sp = sharePrice.convert(delegation);
    // client.disconnect();
    dispatch({
      type: ACCOUNT_DATA_MINIMUM_ACCOUNT_DELEGATION,
      payload: {},
    });
  };
}

export function getVestingDelegations(account: any) {
  return (dispatch: any) => {
    dispatch({
      type: ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE_PENDING,
    });
    hiveApi.getVestingDelegations(account, -1, 100).then(
      (results) => {
        const payload: Record<string, any> = {};
        payload[account] = results;
        dispatch({
          type: ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE,
          payload,
        });
      },
      (err) => {
        dispatch({
          type: ACCOUNT_DATA_VESTING_DELEGATIONS_UPDATE_FAILED,
          payload: err,
        });
      }
    );
  };
}

export function getWithdrawRoutes(account: any) {
  return (dispatch: any) => {
    dispatch({
      type: ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE_PENDING,
    });
    hiveApi.getWithdrawRoutes(account, 'outgoing').then(
      (results) => {
        const payload: Record<string, any> = {};
        payload[account] = results;
        dispatch({
          type: ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE,
          payload,
        });
      },
      (err) => {
        dispatch({
          type: ACCOUNT_DATA_WITHDRAW_ROUTES_UPDATE_FAILED,
          payload: err,
        });
      }
    );
  };
}

export function refreshAccountData(accounts: any) {
  return (dispatch: any) => {
    dispatch({
      type: ACCOUNT_DATA_UPDATE_PENDING,
    });
    hiveApi.getAccounts(accounts).then(
      (results) => {
        const payload: Record<string, any> = {};
        results.forEach((data) => {
          payload[data.name] = data;
          // If we have withdraw routes, update those as well
          if (data.withdraw_routes > 0) {
            dispatch(getWithdrawRoutes(data.name));
          }
          // If we have delegated HP, update that data
          if (data.delegated_vesting_shares !== '0.000000 VESTS') {
            dispatch(getVestingDelegations(data.name));
          }
        });
        dispatch({
          type: ACCOUNT_DATA_UPDATE,
          payload,
        });
      },
      (err) => {
        dispatch({
          type: ACCOUNT_DATA_UPDATE_FAILED,
          payload: err,
        });
      }
    );
  };
}

export function convert(wif: any, params: any) {
  return (dispatch: any) => {
    let { owner, requestid, amount } = params;
    dispatch({
      type: ACCOUNT_CONVERT_STARTED,
    });
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      amount = amount.replace('HIVE', 'TESTS');
      amount = amount.replace('HBD', 'TBD');
    }
    if (!requestid) requestid = Math.floor(Date.now() / 1000);
    broadcastOps
      .convert(wif, { owner, requestid, amount })
      .then(() => {
        refreshAccountData([owner]);
        dispatch({
          type: ACCOUNT_CONVERT_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_CONVERT_FAILED,
          payload: err,
        });
      });
  };
}

export function convertCompleted() {
  return {
    type: ACCOUNT_CONVERT_COMPLETED,
  };
}

export function collateralizedConvert(wif: any, params: any) {
  return (dispatch: any) => {
    let { owner, requestid, amount } = params;
    dispatch({
      type: ACCOUNT_COLLATERALIZED_CONVERT_STARTED,
    });
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      amount = amount.replace('HIVE', 'TESTS');
      amount = amount.replace('HBD', 'TBD');
    }
    if (!requestid) requestid = Math.floor(Date.now() / 1000);
    broadcastOps
      .collateralizedConvert(wif, { owner, requestid, amount })
      .then(() => {
        refreshAccountData([owner]);
        dispatch({
          type: ACCOUNT_COLLATERALIZED_CONVERT_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_COLLATERALIZED_CONVERT_FAILED,
          payload: err,
        });
      });
  };
}

export function collateralizedConvertCompleted() {
  return {
    type: ACCOUNT_COLLATERALIZED_CONVERT_COMPLETED,
  };
}

export function transfer(wif: any, params: any) {
  return (dispatch: any) => {
    let { from, to, amount, memo } = params;
    dispatch({
      type: ACCOUNT_TRANSFER_STARTED,
    });
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      amount = amount.replace('HIVE', 'TESTS');
      amount = amount.replace('HBD', 'TBD');
    }
    broadcastOps
      .transfer(wif, { from, to, amount, memo })
      .then(() => {
        refreshAccountData([from, to]);
        dispatch({
          type: ACCOUNT_TRANSFER_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_TRANSFER_FAILED,
          payload: err,
        });
      });
  };
}

export function transferCompleted() {
  return {
    type: ACCOUNT_TRANSFER_COMPLETED,
  };
}

export function transferFromSavings(wif: any, params: any) {
  return (dispatch: any) => {
    let { from, requestId, to, amount, memo } = params;
    dispatch({
      type: ACCOUNT_TRANSFER_STARTED,
    });
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      amount = amount.replace('HIVE', 'TESTS');
      amount = amount.replace('HBD', 'TBD');
    }
    broadcastOps
      .transferFromSavings(wif, { from, requestId, to, amount, memo })
      .then(() => {
        refreshAccountData([from, to]);
        dispatch({
          type: ACCOUNT_TRANSFER_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_TRANSFER_FAILED,
          payload: err,
        });
      });
  };
}

export function transferFromSavingsCompleted() {
  return {
    type: ACCOUNT_TRANSFER_COMPLETED,
  };
}

export function transferToSavings(wif: any, params: any) {
  return (dispatch: any) => {
    let { from, to, amount, memo } = params;
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      amount = amount.replace('HIVE', 'TESTS');
      amount = amount.replace('HBD', 'TBD');
    }
    dispatch({
      type: ACCOUNT_TRANSFER_STARTED,
    });
    broadcastOps
      .transferToSavings(wif, { from, to, amount, memo })
      .then(() => {
        refreshAccountData([from, to]);
        dispatch({
          type: ACCOUNT_TRANSFER_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_TRANSFER_FAILED,
          payload: err,
        });
      });
  };
}

export function transferToSavingsCompleted() {
  return {
    type: ACCOUNT_TRANSFER_COMPLETED,
  };
}

export function setDelegateVestingShares(wif: any, params: any) {
  return (dispatch: any) => {
    const { delegator, delegatee, vestingShares } = params;
    dispatch({
      type: ACCOUNT_DELEGATE_VESTING_SHARES_STARTED,
    });
    const formattedVestingShares = [parseFloat(vestingShares).toFixed(6), 'VESTS'].join(' ');
    broadcastOps
      .delegateVestingShares(wif, { delegator, delegatee, vestingShares: formattedVestingShares })
      .then(() => {
        dispatch(refreshAccountData([delegator]));
        dispatch({
          type: ACCOUNT_DELEGATE_VESTING_SHARES_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_DELEGATE_VESTING_SHARES_FAILED,
          payload: err,
        });
      });
  };
}

export function setDelegateVestingSharesCompleted() {
  return {
    type: ACCOUNT_DELEGATE_VESTING_SHARES_COMPLETED,
  };
}

export function setWithdrawVestingRoute(wif: any, params: any) {
  return (dispatch: any) => {
    const { account, target, percent, autoVest } = params;
    dispatch({
      type: ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_STARTED,
    });
    broadcastOps
      .setWithdrawVestingRoute(wif, {
        fromAccount: account,
        toAccount: target,
        percent: percent * 100,
        autoVest,
      })
      .then(() => {
        dispatch(refreshAccountData([account]));
        dispatch({
          type: ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_FAILED,
          payload: err,
        });
      });
  };
}

export function setWithdrawVestingRouteCompleted() {
  return {
    type: ACCOUNT_SET_WITHDRAW_VESTING_ROUTE_COMPLETED,
  };
}

export function setVotingProxy(wif: any, params: any) {
  return (dispatch: any) => {
    const { account, proxy } = params;
    dispatch({
      type: ACCOUNT_SET_VOTING_PROXY_STARTED,
    });
    broadcastOps
      .accountWitnessProxy(wif, { account, proxy })
      .then(() => {
        dispatch(refreshAccountData([account]));
        dispatch({
          type: ACCOUNT_SET_VOTING_PROXY_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_SET_VOTING_PROXY_FAILED,
          payload: err,
        });
      });
  };
}

export function setVotingProxyCompleted() {
  return {
    type: ACCOUNT_SET_VOTING_PROXY_COMPLETED,
  };
}

export function voteWitness(wif: any, params: any) {
  return (dispatch: any) => {
    const { account, witness, approve } = params;
    dispatch({
      type: ACCOUNT_VOTE_WITNESS_STARTED,
    });
    broadcastOps
      .accountWitnessVote(wif, { account, witness, approve })
      .then(() => {
        dispatch(refreshAccountData([account]));
        dispatch({
          type: ACCOUNT_VOTE_WITNESS_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_VOTE_WITNESS_FAILED,
          payload: err,
        });
      });
  };
}

export function voteWitnessCompleted() {
  return {
    type: ACCOUNT_VOTE_WITNESS_COMPLETED,
  };
}

export function withdrawVesting(wif: any, params: any) {
  return (dispatch: any) => {
    const { account, vests } = params;
    const vestsFormat = [vests, 'VESTS'].join(' ');
    dispatch({
      type: ACCOUNT_VESTING_WITHDRAW_STARTED,
    });
    broadcastOps
      .withdrawVesting(wif, { account, vestingShares: vestsFormat })
      .then(() => {
        dispatch(refreshAccountData([account]));
        dispatch({
          type: ACCOUNT_VESTING_WITHDRAW_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_VESTING_WITHDRAW_FAILED,
          payload: err,
        });
      });
  };
}

export function withdrawVestingCompleted() {
  return {
    type: ACCOUNT_VESTING_WITHDRAW_COMPLETED,
  };
}

export function cancelWithdrawVesting(wif: any, params: any) {
  return (dispatch: any) => {
    const { account } = params;
    dispatch({
      type: ACCOUNT_VESTING_WITHDRAW_STARTED,
    });
    broadcastOps
      .withdrawVesting(wif, { account, vestingShares: '0.000000 VESTS' })
      .then(() => {
        dispatch(refreshAccountData([account]));
        dispatch({
          type: ACCOUNT_VESTING_WITHDRAW_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_VESTING_WITHDRAW_FAILED,
          payload: err,
        });
      });
  };
}

export function powerUp(wif: any, params: any) {
  return (dispatch: any) => {
    const { from_account, to_account, hiveAmount } = params;
    let hiveFormat = [hiveAmount, 'HIVE'].join(' ');
    if (hiveConfig.get('address_prefix') === 'TST') {
      // if testnet
      hiveFormat = hiveFormat.replace('HIVE', 'TESTS');
    }
    dispatch({
      type: ACCOUNT_POWER_UP_STARTED,
    });
    broadcastOps
      .transferToVesting(wif, { from: from_account, to: to_account, amount: hiveFormat })
      .then(() => {
        dispatch(refreshAccountData([from_account]));
        dispatch({
          type: ACCOUNT_POWER_UP_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_POWER_UP_FAILED,
          payload: err,
        });
      });
  };
}

export function powerUpCompleted() {
  return {
    type: ACCOUNT_POWER_UP_COMPLETED,
  };
}

export function customJson(wif: any, params: any) {
  return (dispatch: any) => {
    const { account, id, json, permission } = params;
    let auths: any[] = [];
    let postingAuths = [account];
    if (permission === 'active') {
      auths = [account];
      postingAuths = [];
    }
    dispatch({
      type: ACCOUNT_CUSTOM_JSON_STARTED,
    });
    broadcastOps
      .customJson(wif, {
        requiredAuths: auths,
        requiredPostingAuths: postingAuths,
        id,
        json,
      })
      .then(() => {
        dispatch({
          type: ACCOUNT_CUSTOM_JSON_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_CUSTOM_JSON_FAILED,
          payload: err,
        });
      });
  };
}

export function customJsonCompleted() {
  return {
    type: ACCOUNT_CUSTOM_JSON_COMPLETED,
  };
}

export function send(wif: any, params: any) {
  return (dispatch: any) => {
    const { operations, extensions } = params;
    // Route the HF28 authority role onto the broadcast. useKey normally supplies params.role; the
    // requiredRoleForOps fallback covers direct callers and throws on mixed/empty authority (which
    // surfaces as the broadcast error). Post-HF28 a single key satisfies only one role, so the WIF
    // must carry the authority the ops actually require rather than a hardcoded { posting: wif }.
    const role = params.role || requiredRoleForOps(operations).role;
    dispatch({
      type: ACCOUNT_CUSTOM_OPS_STARTED,
    });
    signAndBroadcast({ operations, extensions }, role, wif)
      .then(() => {
        dispatch({
          type: ACCOUNT_CUSTOM_OPS_RESOLVED,
        });
      })
      .catch((err) => {
        dispatch({
          type: ACCOUNT_CUSTOM_OPS_FAILED,
          payload: err,
        });
      });
  };
}

export function addContact(username: any) {
  return (dispatch: any) => {
    dispatch({
      type: ACCOUNT_CONTACTS_ADD,
      payload: username,
    });
  };
}

export function removeContact(username: any) {
  return (dispatch: any) => {
    dispatch({
      type: ACCOUNT_CONTACTS_REMOVE,
      payload: username,
    });
  };
}
