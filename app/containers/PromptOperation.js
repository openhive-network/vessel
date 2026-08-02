// @flow
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import hive from '@hiveio/hive-js';
import { Message } from 'semantic-ui-react';

import * as AccountActions from '../actions/account';
import * as KeysActions from '../actions/keys';
import * as ProcessingActions from '../actions/processing';
import {
  requiredRoleForOps,
  keySatisfiesRole,
  MixedAuthorityError,
  NoOperationsError,
} from '../utils/authorityRoles';

import OperationsPrompt from '../components/sign/operations/prompt';

const accountFields = {
  account_create: ['creator'],
  account_create_with_delegation: ['creator'],
  account_update: ['account'],
  account_witness_proxy: ['account'],
  account_witness_vote: ['account'],
  cancel_transfer_from_savings: ['from'],
  claim_reward_balance: ['account'],
  comment: ['author'],
  convert: ['owner'],
  collateralizedConvert: ['owner'],
  decline_voting_rights: ['account'],
  delegate_vesting_shares: ['delegator'],
  set_withdraw_vesting_route: ['from_account'],
  transfer: ['from'],
  transfer_from_savings: ['from'],
  transfer_to_savings: ['from'],
  transfer_to_vesting: ['from'],
  vote: ['voter'],
  withdraw_vesting: ['account'],
  witness_update: ['owner'],
};

class PromptOperation extends Component {
  constructor(props) {
    super(props);
    let meta = {};
    let ops = [];
    try {
      meta = JSON.parse(window.atob(props.query.meta));
    } catch (exception) {
      console.log(exception);
    }
    try {
      ops = JSON.parse(window.atob(props.query.ops));
    } catch (exception) {
      console.log(exception);
    }
    this.state = {
      account: null,
      authorityError: null,
      meta,
      ops,
      opsString: props.query.ops,
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.processing.account_custom_ops_resolved) {
      window.close();
    }
  }

  submitOps = (e) => {
    e.preventDefault();
    const { account, ops } = this.state;
    const { permissions } = this.props.keys;
    // Resolve the single authority the whole tx needs BEFORE any key selection or broadcast.
    // Post-HF28 a tx that mixes posting with active/owner (or has no ops) can never be signed by
    // one key: surface it in the sign window and refuse to dispatch.
    let role;
    try {
      role = requiredRoleForOps(ops).role;
    } catch (err) {
      if (err instanceof MixedAuthorityError || err instanceof NoOperationsError) {
        this.setState({ authorityError: err.message });
        return;
      }
      throw err;
    }
    // Guard the chosen signing account: its stored key type must satisfy the required role. This
    // mirrors the account-picker flag (the Select lives in the child prompt component) and is
    // defense-in-depth over useKey's own KEY_USE_ROLE_MISMATCH gate.
    const auth = permissions[account];
    if (!auth || !keySatisfiesRole(auth.type, role, auth.roles)) {
      const stored = auth ? auth.type : 'unknown';
      this.setState({
        authorityError: `The selected account's stored ${stored} key cannot satisfy the required ${role.toUpperCase()} authority. Import the ${role.toUpperCase()} key for this account before signing.`,
      });
      return;
    }
    this.setState({ authorityError: null });
    this.props.actions.useKey('send', { operations: ops, extensions: [], role }, auth);
  };

  modifyOpsPrompt(e, data) {
    const { ops } = this.state;
    const { index, name, value } = data;
    ops[index][1][name] = value;
    this.setState(ops);
  }

  modifyOpsByAccount(account) {
    const { ops } = this.state;
    const modOps = ops.slice(0);
    const accountFieldTypes = Object.keys(accountFields);
    ops.forEach((op, idx) => {
      const opType = op[0];
      const opData = op[1];
      if (accountFieldTypes.indexOf(opType) > -1) {
        const modData = { ...opData };
        accountFields[opType].forEach((field) => {
          modData[field] = account;
        });
        modOps[idx] = [opType, modData];
      }
    });
    this.setState({
      account,
      ops: modOps,
    });
  }

  render() {
    const { ops, meta, authorityError } = this.state;
    const { account, keys } = this.props;
    return (
      <>
        {authorityError ? (
          <Message
            error
            icon="warning sign"
            header="Cannot sign this transaction"
            content={authorityError}
          />
        ) : null}
        <OperationsPrompt
          account={account}
          accounts={keys.names}
          accountChange={this.modifyOpsByAccount.bind(this)}
          meta={meta}
          modifyOpsPrompt={this.modifyOpsPrompt.bind(this)}
          ops={ops}
          processing={this.props.processing}
          hive={this.props.hive}
          submitOps={this.submitOps.bind(this)}
        />
      </>
    );
  }
}

function mapStateToProps(state) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
    processing: state.processing,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...KeysActions,
        ...ProcessingActions,
      },
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PromptOperation);
