import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert, Box, Button, Group, LoadingOverlay, Modal, Text } from '@mantine/core';

import * as KeysActions from '../../actions/keys';

function CancelPowerDownPrompt(props: any) {
  const handleConfirm = (e: any) => {
    const account = props.targetAccount;
    const { permissions } = props.keys;
    props.actions.useKey('cancelWithdrawVesting', { account }, permissions[account]);
    e.preventDefault();
  };

  const {
    account_vesting_withdraw_error,
    account_vesting_withdraw_pending,
  } = props.processing;

  return (
    <Modal opened onClose={props.handleCancel} title="Cancel - Power Down" size="sm">
      <Box pos="relative">
        <LoadingOverlay visible={account_vesting_withdraw_pending} />
        <Text>
          Cancelling this power down cannot be reversed. Any progress on your current week's credit
          will be reset, and if you power down again, you'll have to wait another 7 days for it to
          begin.
        </Text>
        {account_vesting_withdraw_error && (
          <Alert color="red" title="Operation Error" mt="md">
            {account_vesting_withdraw_error}
          </Alert>
        )}
      </Box>
      <Group justify="space-between" mt="md">
        <Button color="red" onClick={props.handleCancel} disabled={account_vesting_withdraw_pending}>
          Cancel Operation
        </Button>
        <Button color="blue" onClick={handleConfirm} disabled={account_vesting_withdraw_pending}>
          Cancel Power Down
        </Button>
      </Group>
    </Modal>
  );
}

function mapStateToProps(state) {
  return {
    account: state.account,
    keys: state.keys,
    hive: state.hive,
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

export default connect(mapStateToProps, mapDispatchToProps)(CancelPowerDownPrompt);
