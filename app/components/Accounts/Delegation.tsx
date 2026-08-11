import React, { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Grid,
  Group,
  LoadingOverlay,
  Modal,
  Slider,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

import NumericLabel from '../../utils/NumericLabel';
import AccountName from '../global/AccountName';

const AccountsProxy: React.FC<any> = (props) => {
  const [editDelegationFor, setEditDelegationFor] = useState<any>(false);
  const [sp, setSp] = useState<any>(0);
  const [vests, setVests] = useState<any>(0);
  const [undelegateError, setUndelegateError] = useState<any>(false);
  // Dynamic per-account delegatee map (class stored this under state[<delegator>]).
  const [delegateeMap, setDelegateeMap] = useState<any>({});

  const resetState = () => {
    setEditDelegationFor(false);
    setSp(0);
    setVests(0);
    setUndelegateError(false);
    // Preserve the DYNAMIC [editDelegationFor]: '' clear from the class resetState.
    setDelegateeMap((m: any) => ({ ...m, [editDelegationFor]: '' }));
  };

  // componentWillReceiveProps(error + resolved branches). useRef seed so the effect fires on
  // the flag transition, not on mount, matching the class's nextProps guard.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (props.processing.account_delegate_vesting_shares_error) {
      setUndelegateError(props.processing.account_delegate_vesting_shares_error);
      props.actions.setDelegateVestingSharesCompleted();
    }
    if (props.processing.account_delegate_vesting_shares_resolved) {
      props.actions.setDelegateVestingSharesCompleted();
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.processing.account_delegate_vesting_shares_error,
    props.processing.account_delegate_vesting_shares_resolved,
  ]);

  const handleCancel = () => {
    resetState();
  };

  // onChange (drag) and onChangeComplete (release) were two byte-identical handlers in the class
  // version; collapsed into one since the bodies were identical (toFixed(6) / toFixed(3)).
  const handleOnChange = (value: any) => {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    const nextVests: any = parsed.toFixed(6);
    const globalProps = props.hive.props;
    const totalVestsHive = parseFloat(globalProps.total_vesting_fund_hive.split(' ')[0]);
    const totalVests = parseFloat(globalProps.total_vesting_shares.split(' ')[0]);
    const nextSp = ((totalVestsHive * nextVests) / totalVests).toFixed(3);
    setVests(nextVests);
    setSp(nextSp);
  };

  const handleVestingSharesRemove = (value: any) => {
    let { delegator, delegatee } = value.delegatee;
    delegatee = delegatee.toLowerCase().replace('@', '');
    const { permissions } = props.keys;
    setUndelegateError(false);
    props.actions.useKey(
      'setDelegateVestingShares',
      { delegator, delegatee, vestingShares: 0.0 },
      permissions[delegator]
    );
  };

  const handleVestingSharesEdit = (value: any) => {
    const { delegator, delegatee, vesting_shares } = value.delegatee;
    setEditDelegationFor(delegator);
    setDelegateeMap((m: any) => ({ ...m, [delegator]: delegatee }));
    handleOnChange(parseFloat(vesting_shares.split(' ')[0]));
  };

  const handleSetDelegateVesting = (value: any) => {
    setEditDelegationFor(value);
  };

  const handleSetDelegateVestingConfirm = (e: any) => {
    const { permissions } = props.keys;
    const delegator = editDelegationFor;
    const delegatee = delegateeMap[delegator];
    props.actions.useKey(
      'setDelegateVestingShares',
      { delegator, delegatee, vestingShares: vests },
      permissions[delegator]
    );
    e.preventDefault();
  };

  const handleOnChangeInput = (name: string, value: any) => {
    const globalProps = props.hive.props;
    const totalVestsHive = parseFloat(globalProps.total_vesting_fund_hive.split(' ')[0]);
    const totalVests = parseFloat(globalProps.total_vesting_shares.split(' ')[0]);
    const parsed = parseFloat(value);
    let nextVests;
    let nextSp;
    if (Number.isNaN(parsed)) {
      if (name === 'sp') {
        setSp(value);
      } else {
        setVests(value);
      }
      return;
    }
    if (name === 'vests') {
      const fixed: any = parsed.toFixed(6);
      nextSp = ((totalVestsHive * fixed) / totalVests).toFixed(3);
      nextVests = value;
    }
    if (name === 'sp') {
      const fixed: any = parsed.toFixed(3);
      nextSp = value;
      nextVests = ((fixed / totalVestsHive) * totalVests).toFixed(6);
    }
    setVests(nextVests);
    setSp(nextSp);
  };

  const handleChangeVestingShares = (value: any) => {
    setDelegateeMap((m: any) => ({ ...m, [editDelegationFor]: value.trim() }));
  };

  const numberFormat = {
    shortFormat: true,
    shortFormatMinValue: 1000,
  };
  const {
    account_delegate_vesting_shares_error,
    account_delegate_vesting_shares_pending,
  } = props.processing;

  let addVesting: any = false;
  if (editDelegationFor) {
    const name = editDelegationFor;
    const account = props.account.accounts[name];
    const delegated = parseFloat(account.delegated_vesting_shares.split(' ')[0]);
    const accountVests = parseFloat(account.vesting_shares.split(' ')[0]);
    let existingDelegation = 0;
    if (props.account.vestingDelegations && props.account.vestingDelegations[name]) {
      const existingDelegations = props.account.vestingDelegations[name];
      existingDelegation = existingDelegations.reduce(
        (a: any, b: any) =>
          b.delegatee === delegateeMap[name] ? a + parseFloat(b.vesting_shares.split(' ')[0]) : 0,
        0
      );
    }
    const available = accountVests - delegated + existingDelegation;
    const target = parseFloat(vests);
    const delegateWarning = target > available - 100;
    addVesting = (
      <Modal opened onClose={resetState} title="Delegate Vests to another Account" size="lg">
        <Box pos="relative" p="md">
          <LoadingOverlay visible={account_delegate_vesting_shares_pending} />
          <p>
            Please enter the name of the target account that you wish to delegate a portion of the{' '}
            {name} account's vested weight to.
          </p>
          <Stack gap="sm">
            <TextInput
              label="Delegatee Account Name"
              name="delegatee"
              placeholder="Delegatee Account Name"
              defaultValue={delegateeMap[name]}
              data-autofocus
              onChange={(e) => handleChangeVestingShares(e.currentTarget.value)}
            />
            <TextInput
              label="Hive Power"
              name="sp"
              value={sp}
              onChange={(e) => handleOnChangeInput('sp', e.currentTarget.value)}
            />
            <TextInput
              label="Vesting Shares"
              name="vests"
              value={vests}
              onChange={(e) => handleOnChangeInput('vests', e.currentTarget.value)}
            />
          </Stack>
          <Grid columns={16} align="center" mt="md">
            <Grid.Col span={12}>
              <Box py="xl">
                <Slider
                  min={0}
                  max={available}
                  step={1}
                  value={Number(vests)}
                  onChange={handleOnChange}
                  onChangeEnd={handleOnChange}
                />
              </Box>
            </Grid.Col>
            <Grid.Col span={4}>
              <Stack align="center" gap={2}>
                <Text size="sm" c="dimmed">
                  Hive Power
                </Text>
                <Text fw={700} size="xl">
                  <NumericLabel params={numberFormat}>{sp}</NumericLabel>
                  {' HP'}
                </Text>
                <Text size="sm" c="dimmed">
                  -<NumericLabel params={numberFormat}>{vests}</NumericLabel>
                  {' VESTS'}
                </Text>
              </Stack>
            </Grid.Col>
          </Grid>
          {delegateWarning && (
            <Alert color="red" title="Warning! Delegating too much HP." mt="md">
              Leaving so little HP in this account may cause it to stop functioning, meaning you may
              have to power up more Hive or Delegate to this account from another in order to even
              undo what you are about to do.
            </Alert>
          )}
          <Alert color="blue" title="Caution! Delegation takes 7 days to revoke." mt="md">
            If you confirm this delegation, it will take effect immediately. When you are ready to
            revoke the delegation, it will take 7 days for that delegated balance to return to your
            account.
          </Alert>
          {account_delegate_vesting_shares_error && (
            <Alert color="red" title="Operation Error" mt="md">
              {account_delegate_vesting_shares_error}
            </Alert>
          )}
        </Box>
        <Group justify="space-between" mt="md">
          <Button
            color="red"
            onClick={handleCancel}
            disabled={account_delegate_vesting_shares_pending}
          >
            Cancel Operation
          </Button>
          <Button
            type="submit"
            color="blue"
            onClick={handleSetDelegateVestingConfirm}
            disabled={account_delegate_vesting_shares_pending}
          >
            Confirm Delegation
          </Button>
        </Group>
      </Modal>
    );
  }

  const { names } = props.keys;
  const accounts = names.map((name: any) => {
    const account = props.account.accounts[name];
    const delegatees = (props.account.vestingDelegations || {})[name];
    const delegated = account.delegated_vesting_shares;
    const hasDelegated = delegated && delegated !== '0.000000 VESTS';
    const hasDelegatees = delegatees && delegatees.length;
    const delegatedAmount = parseFloat(delegated.split(' ')[0]);
    const rowVests = parseFloat(account.vesting_shares.split(' ')[0]);
    const available = rowVests - delegatedAmount;
    return (
      <Table.Tr key={name}>
        <Table.Td>
          <Text fw={700} component="div">
            <AccountName name={name} />
          </Text>
          <Text size="xs" c="dimmed" component="div">
            <strong>
              <NumericLabel params={numberFormat}>{rowVests}</NumericLabel>
            </strong>{' '}
            VESTS
          </Text>
        </Table.Td>
        <Table.Td ta="center">
          <Text fw={700} component="div">
            <NumericLabel params={numberFormat}>{available}</NumericLabel>
          </Text>
          <Text size="xs" c="dimmed" component="div">
            VESTS
          </Text>
        </Table.Td>
        <Table.Td ta="center">
          <Text fw={700} component="div">
            {hasDelegated ? (
              <NumericLabel params={numberFormat}>{delegatedAmount}</NumericLabel>
            ) : (
              0
            )}
          </Text>
          <Text size="xs" c="dimmed" component="div">
            VESTS
          </Text>
        </Table.Td>
        <Table.Td>
          {hasDelegatees ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Delegatee</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {delegatees.map((delegatee: any) => {
                  const dVests = parseFloat(delegatee.vesting_shares.split(' ')[0]);
                  return (
                    <Table.Tr key={delegatee.id}>
                      <Table.Td>
                        <AccountName name={delegatee.delegatee} />
                      </Table.Td>
                      <Table.Td>
                        <NumericLabel params={numberFormat}>{dVests}</NumericLabel>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={0}>
                          <ActionIcon
                            color="dark"
                            size="sm"
                            onClick={() => handleVestingSharesEdit({ delegatee })}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                          <ActionIcon
                            color="orange"
                            size="sm"
                            onClick={() => handleVestingSharesRemove({ delegatee })}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          ) : (
            'No active delegations'
          )}
        </Table.Td>
        <Table.Td>
          <ActionIcon color="green" onClick={() => handleSetDelegateVesting(name)}>
            <IconPlus size={16} />
          </ActionIcon>
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <Box p="md">
      {addVesting}
      <Text c="dimmed" size="sm">
        Each account may delegate a portion of it's voting power to other accounts. This process
        takes place immediately for the target account, and may be revoked on the date shown. Once
        you revoked, the vesting amount will remain locked for exactly 7 days before returning to the
        original account.
      </Text>
      {undelegateError && (
        <Alert color="red" title="Operation Error" mt="md">
          {undelegateError}
        </Alert>
      )}
      <Table withTableBorder withColumnBorders mt="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th ta="center">Name</Table.Th>
            <Table.Th ta="center">Available</Table.Th>
            <Table.Th ta="center">Delegating</Table.Th>
            <Table.Th ta="center">Delegated</Table.Th>
            <Table.Th>Controls</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{accounts}</Table.Tbody>
      </Table>
    </Box>
  );
};

export default AccountsProxy;
