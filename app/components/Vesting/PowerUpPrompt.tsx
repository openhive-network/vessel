import React, { useEffect, useRef, useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  LoadingOverlay,
  Modal,
  Slider,
  Text,
  TextInput,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import NumericLabel from '../../utils/NumericLabel';
import AccountName from '../global/AccountName';

import * as AccountActions from '../../actions/account';
import * as KeysActions from '../../actions/keys';

const PowerUpPrompt: React.FC<any> = (props) => {
  const account = props.account.accounts[props.targetAccount];
  const maximum = parseFloat(account.balance.split(' ')[0]);

  const [hiveAmount, setHiveAmount] = useState<any>(0.001);
  const [toAccount, setToAccount] = useState<any>(false);
  const [editAccount, setEditAccount] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const numberFormat = {
    shortFormat: true,
    shortFormatMinValue: 1000,
  };

  const { account_power_up_error, account_power_up_pending, account_power_up_resolved } =
    props.processing;

  const resolvedRef = useRef(account_power_up_resolved);
  useEffect(() => {
    if (resolvedRef.current !== account_power_up_resolved) {
      if (account_power_up_resolved) {
        props.actions.powerUpCompleted();
        props.handleCancel();
        setShowPreview(false);
      }
    }
    resolvedRef.current = account_power_up_resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account_power_up_resolved]);

  const handlePreview = (e: any) => {
    setShowPreview(true);
    e.preventDefault();
  };

  const handleSubmit = (e: any) => {
    const from_account = props.targetAccount;
    const to_account = toAccount ? toAccount : props.targetAccount;
    const { permissions } = props.keys;
    props.actions.useKey(
      'powerUp',
      { from_account, to_account, hiveAmount },
      permissions[from_account]
    );
    e.preventDefault();
  };

  const handleOnChange = (value) => {
    setHiveAmount(parseFloat(String(value)).toFixed(3));
  };

  const handleOnChangeComplete = (value) => {
    setHiveAmount(parseFloat(String(value)).toFixed(3));
  };

  const handleAccountChange = (event) => {
    setToAccount(event.currentTarget.value);
  };

  let prompt: any = false;
  if (hiveAmount) {
    prompt = !showPreview ? (
      <Modal
        size="sm"
        opened={!account_power_up_resolved}
        onClose={props.handleCancel}
        title="Power Up Account"
      >
        <Box pos="relative">
          <LoadingOverlay visible={account_power_up_pending} />
          <Grid columns={16}>
            <Grid.Col span={8}>
              <Box ta="center">
                <Text size="sm" c="dimmed">
                  Power Up From
                </Text>
                <AccountName name={props.targetAccount} />
                <Text size="sm" c="dimmed">
                  Power Up To
                </Text>
                {editAccount ? (
                  <TextInput
                    name="to_account"
                    value={toAccount || ''}
                    onChange={handleAccountChange}
                    placeholder="Account to Power Up"
                  />
                ) : (
                  <AccountName name={toAccount ? toAccount : props.targetAccount} />
                )}
                {!editAccount && (
                  <Button
                    color="orange"
                    mt="xs"
                    onClick={() => {
                      setEditAccount(true);
                    }}
                  >
                    <IconEdit size={15} />
                  </Button>
                )}
              </Box>
            </Grid.Col>
            <Grid.Col span={8}>
              <Box ta="center">
                <Text size="sm" c="dimmed">
                  Power Up Amount
                </Text>
                <Text c="green" size="lg" fw={700}>
                  +<NumericLabel params={numberFormat}>{hiveAmount}</NumericLabel>
                  {' HIVE'}
                </Text>
              </Box>
            </Grid.Col>
          </Grid>
          <Divider my="md" />
          <Box p="xl">
            <Slider
              max={maximum}
              step={0.001}
              min={0.001}
              value={Number(hiveAmount)}
              onChange={handleOnChange}
              onChangeEnd={handleOnChangeComplete}
            />
          </Box>
          <Alert color="blue">
            Drag the slider to adjust the amount of HIVE to power up as HP.
          </Alert>
          {account_power_up_error && (
            <Alert color="red" title="Operation Error" mt="md">
              {account_power_up_error}
            </Alert>
          )}
          <Group justify="space-between" mt="md">
            <Button color="red" onClick={props.handleCancel} disabled={account_power_up_pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              onClick={handlePreview}
              disabled={account_power_up_pending}
            >
              Power Up
            </Button>
          </Group>
        </Box>
      </Modal>
    ) : (
      <Modal size="sm" opened onClose={props.handleCancel} title="Power Up Account">
        <Box pos="relative">
          <LoadingOverlay visible={account_power_up_pending} />
          <Grid columns={16}>
            <Grid.Col span={8}>
              <Box ta="center">
                <Text size="sm" c="dimmed">
                  Power Up From
                </Text>
                <AccountName name={props.targetAccount} />
                <Text size="sm" c="dimmed">
                  Power Up To
                </Text>
                <AccountName name={toAccount ? toAccount : props.targetAccount} />
              </Box>
            </Grid.Col>
            <Grid.Col span={8}>
              <Box ta="center">
                <Text size="sm" c="dimmed">
                  Power Up Amount
                </Text>
                <Text c="green" size="lg" fw={700}>
                  +<NumericLabel params={numberFormat}>{hiveAmount}</NumericLabel>
                  {' HIVE'}
                </Text>
              </Box>
            </Grid.Col>
          </Grid>
          <Divider my="md" />
          {account_power_up_error && (
            <Alert color="red" title="Operation Error" mt="md">
              {account_power_up_error}
            </Alert>
          )}
          <Group justify="space-between" mt="md">
            <Button color="red" onClick={props.handleCancel} disabled={account_power_up_pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              onClick={handleSubmit}
              disabled={account_power_up_pending}
            >
              Confirm - Power Up
            </Button>
          </Group>
        </Box>
      </Modal>
    );
  }
  return prompt;
};

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
        ...AccountActions,
        ...KeysActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PowerUpPrompt);
