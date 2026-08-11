import React, { useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  SimpleGrid,
  Slider,
  Stack,
  Text,
} from '@mantine/core';
import NumericLabel from '../../utils/NumericLabel';
import AccountName from '../global/AccountName';

import * as KeysActions from '../../actions/keys';

function PowerDownPrompt(props: any) {
  const name = props.targetAccount;
  const account = props.account.accounts[name];
  const initialVests = parseFloat(account.vesting_shares.split(' ')[0]);
  const maximum = initialVests;

  const hiveProps = props.hive.props;
  const initialTotalVestsHive = parseFloat(hiveProps.total_vesting_fund_hive.split(' ')[0]);
  const initialTotalVests = parseFloat(hiveProps.total_vesting_shares.split(' ')[0]);
  const initialSp = (initialTotalVestsHive * initialVests) / initialTotalVests;
  const initialPerWeek = Math.round((initialSp / 13) * 1000) / 1000;

  const [vests, setVests] = useState<any>(initialVests);
  const [sp, setSp] = useState<any>(initialSp);
  const [perWeek, setPerWeek] = useState<any>(initialPerWeek);

  const handleSubmit = (e: any) => {
    const account = props.targetAccount;
    const { permissions } = props.keys;
    props.actions.useKey('withdrawVesting', { account, vests }, permissions[account]);
    e.preventDefault();
  };

  // onChange (drag) and onChangeComplete (release) were two identical handlers in the
  // class version; collapsed into one since the bodies were byte-identical.
  const applyChange = (value: any) => {
    const nextVests: any = parseFloat(value).toFixed(6);
    const { props: p } = props.hive;
    const totalVestsHive = parseFloat(p.total_vesting_fund_hive.split(' ')[0]);
    const totalVests = parseFloat(p.total_vesting_shares.split(' ')[0]);
    const nextSp = (totalVestsHive * nextVests) / totalVests;
    const nextPerWeek = Math.round((nextSp / 13) * 1000) / 1000;
    setVests(nextVests);
    setSp(nextSp);
    setPerWeek(nextPerWeek);
  };

  const numberFormat = {
    shortFormat: true,
    shortFormatMinValue: 1000,
  };
  const { account_vesting_withdraw_error, account_vesting_withdraw_pending } = props.processing;

  if (!sp) {
    return null;
  }

  return (
    <Modal
      opened
      onClose={props.handleCancel}
      title="Power Down Account"
      size="sm"
    >
      <Box pos="relative" p="md">
        <LoadingOverlay visible={account_vesting_withdraw_pending} />
        <SimpleGrid cols={3}>
          <Stack align="center" gap={2}>
            <Text size="sm" c="dimmed">
              Power Down Target
            </Text>
            <AccountName name={props.targetAccount} />
            <Text size="sm" c="dimmed">
              over 13 weeks
            </Text>
          </Stack>
          <Stack align="center" gap={2}>
            <Text size="sm" c="dimmed">
              Power Down Amount
            </Text>
            <Text c="red" fw={700} size="xl">
              -<NumericLabel params={numberFormat}>{sp}</NumericLabel>
              {' HP'}
            </Text>
            <Text size="sm" c="dimmed">
              -<NumericLabel params={numberFormat}>{vests}</NumericLabel>
              {' VESTS'}
            </Text>
          </Stack>
          <Stack align="center" gap={2}>
            <Text size="sm" c="dimmed">
              Estimated Weekly
            </Text>
            <Text c="green" fw={700} size="xl">
              +{perWeek}
            </Text>
            <Text size="sm" c="dimmed">
              HIVE
            </Text>
          </Stack>
        </SimpleGrid>
        <Divider my="md" />
        <Box py="xl">
          <Slider
            min={0.000001}
            max={maximum}
            step={1}
            value={Number(vests)}
            onChange={applyChange}
            onChangeEnd={applyChange}
          />
        </Box>
        <Alert color="gray" variant="light">
          Drag the slider to adjust the amount of HP/VESTS to convert to HIVE over the next 13 weeks.
        </Alert>
        {account_vesting_withdraw_error && (
          <Alert color="red" title="Operation Error" mt="md">
            {account_vesting_withdraw_error}
          </Alert>
        )}
      </Box>
      <Group justify="space-between" mt="md">
        <Button
          color="red"
          onClick={props.handleCancel}
          disabled={account_vesting_withdraw_pending}
        >
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={handleSubmit}
          disabled={account_vesting_withdraw_pending}
        >
          Begin Power Down
        </Button>
      </Group>
    </Modal>
  );
}

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...KeysActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PowerDownPrompt);
