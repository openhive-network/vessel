import React, { useEffect, useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import * as AccountActions from '../actions/account';
import * as KeysActions from '../actions/keys';
import * as ProcessingActions from '../actions/processing';
import {
  requiredRoleForOps,
  keySatisfiesRole,
  MixedAuthorityError,
  NoOperationsError,
} from '../utils/authorityRoles';
import { parseAndValidateSignOps } from '../utils/signPayload';

import OperationsPrompt from '../components/sign/operations/prompt';
import SignConfirmModal from '../components/sign/SignConfirmModal';

const accountFields: Record<string, any> = {
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

function PromptOperation(props: any) {
  const [meta] = useState<any>(() => {
    let value = {};
    try {
      value = JSON.parse(window.atob(props.query.meta));
    } catch (exception) {
      console.log(exception);
    }
    return value;
  });
  // Task 5 — the ops come from an untrusted URI. Validate SHAPE + SIZE before anything renders,
  // edits, or signs them; a bad payload sets payloadError and blocks the sign UI entirely.
  const [validated] = useState(() => parseAndValidateSignOps(props.query.ops));
  const [account, setAccount] = useState<any>(null);
  const [authorityError, setAuthorityError] = useState<any>(null);
  const [payloadError] = useState<any>(validated.ok ? null : validated.error);
  const [ops, setOps] = useState<any>(validated.ops);
  const [confirming, setConfirming] = useState<any>(null);

  useEffect(() => {
    if (props.processing.account_custom_ops_resolved) {
      window.close();
    }
  }, [props.processing.account_custom_ops_resolved]);

  const submitOps = (e: any) => {
    e.preventDefault();
    // Never sign an invalid/oversized payload, even if something re-enabled the button.
    if (payloadError) return;
    const { permissions } = props.keys;
    // Resolve the single authority the whole tx needs BEFORE any key selection or broadcast.
    // Post-HF28 a tx that mixes posting with active/owner (or has no ops) can never be signed by
    // one key: surface it in the sign window and refuse to dispatch.
    let role;
    try {
      role = requiredRoleForOps(ops).role;
    } catch (err) {
      if (err instanceof MixedAuthorityError || err instanceof NoOperationsError) {
        setAuthorityError(err.message);
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
      setAuthorityError(
        `The selected account's stored ${stored} key cannot satisfy the required ${role.toUpperCase()} authority. Import the ${role.toUpperCase()} key for this account before signing.`
      );
      return;
    }
    // Task 5 — don't dispatch straight to signing. Open the confirm-and-sign modal, which shows the
    // plain-language summary and (for an encrypted key) collects + verifies the wallet password first.
    setAuthorityError(null);
    setConfirming({ role, auth });
  };

  // Approved in the confirm modal. For an encrypted key the modal already verified `password` against
  // main; sign there via a main signer { account, password } (encrypted:false so useKey won't re-prompt).
  // A plaintext legacy key signs with its stored WIF, exactly as before — the modal was just a confirm.
  const handleConfirmSign = (password: any) => {
    if (!confirming) return;
    const { role, auth } = confirming;
    const params = { operations: ops, extensions: [], role };
    const localAuth = auth.encrypted
      ? { ...auth, encrypted: false, key: { account: auth.account, password } }
      : auth;
    props.actions.useKey('send', params, localAuth);
    setConfirming(null);
  };

  const handleCancelSign = () => {
    setConfirming(null);
  };

  const modifyOpsPrompt = (e: any, data: any) => {
    const { index, name, value } = data;
    ops[index][1][name] = value;
    setOps([...ops]);
  };

  const modifyOpsByAccount = (account: any) => {
    const modOps = ops.slice(0);
    const accountFieldTypes = Object.keys(accountFields);
    ops.forEach((op: any, idx: any) => {
      const opType = op[0];
      const opData = op[1];
      if (accountFieldTypes.indexOf(opType) > -1) {
        const modData = { ...opData };
        accountFields[opType].forEach((field: any) => {
          modData[field] = account;
        });
        modOps[idx] = [opType, modData];
      }
    });
    setAccount(account);
    setOps(modOps);
  };

  const { keys } = props;
  // A malformed/oversized/malicious URI payload is refused outright — never rendered or signable.
  if (payloadError) {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle />}
        title="This signing request can't be shown"
      >
        {payloadError}
      </Alert>
    );
  }
  return (
    <>
      {confirming ? (
        <SignConfirmModal
          account={confirming.auth.account}
          ops={ops}
          record={confirming.auth}
          onCancel={handleCancelSign}
          onConfirm={handleConfirmSign}
        />
      ) : null}
      {authorityError ? (
        <Alert
          color="red"
          icon={<IconAlertTriangle />}
          title="Cannot sign this transaction"
        >
          {authorityError}
        </Alert>
      ) : null}
      <OperationsPrompt
        account={props.account}
        accounts={keys.names}
        accountChange={modifyOpsByAccount}
        meta={meta}
        modifyOpsPrompt={modifyOpsPrompt}
        ops={ops}
        processing={props.processing}
        hive={props.hive}
        submitOps={submitOps}
      />
    </>
  );
}

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
    processing: state.processing,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...KeysActions,
        ...ProcessingActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PromptOperation);
