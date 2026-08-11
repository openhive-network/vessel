import React, { useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Slider,
  Text,
  TextInput,
} from '@mantine/core';

import * as KeysActions from '../../actions/keys';

function PowerDownDestinationPrompt(props: any) {
  const [target, setTarget] = useState('');
  const [percent, setPercent] = useState(100);
  const [autoVest, setAutoVest] = useState(false);

  const {
    account_set_withdraw_vesting_route_error,
    account_set_withdraw_vesting_route_pending,
  } = props.processing;

  const handleSubmit = (e: any) => {
    const account = props.targetAccount;
    const { permissions } = props.keys;
    props.actions.useKey(
      'setWithdrawVestingRoute',
      { account, target, percent, autoVest },
      permissions[account]
    );
    e.preventDefault();
  };

  return (
    <Modal opened onClose={props.handleCancel} title="Power Down - Destination Account" size="sm">
      <Box pos="relative">
        <LoadingOverlay visible={account_set_withdraw_vesting_route_pending} />
        <TextInput
          label="Destination Account"
          name="target"
          data-autofocus
          value={target}
          onChange={(e) => setTarget(e.currentTarget.value)}
        />
        <Box mt="md">
          <Text>Percentage of Power Down to this account.</Text>
          <Slider
            min={0}
            max={100}
            step={1}
            name="percent"
            value={percent}
            onChange={setPercent}
          />
          <Divider my="md" style={{ visibility: 'hidden' }} />
        </Box>
        <Checkbox
          mt="md"
          name="autoVest"
          checked={autoVest}
          onChange={(e) => setAutoVest(e.currentTarget.checked)}
          label="Should it automatically power up the target account?"
        />
        {account_set_withdraw_vesting_route_error && (
          <Alert color="red" title="Operation Error" mt="md">
            {account_set_withdraw_vesting_route_error}
          </Alert>
        )}
      </Box>
      <Group justify="space-between" mt="md">
        <Button
          color="red"
          onClick={props.handleCancel}
          disabled={account_set_withdraw_vesting_route_pending}
        >
          Cancel Operation
        </Button>
        <Button
          type="submit"
          color="blue"
          onClick={handleSubmit}
          disabled={account_set_withdraw_vesting_route_pending}
        >
          Set Withdraw Route
        </Button>
      </Group>
    </Modal>
  );
}

function mapStateToProps(state) {
  return {
    account: state.account,
    keys: state.keys,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(
      {
        ...KeysActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PowerDownDestinationPrompt);
