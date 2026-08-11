import React, { useEffect, useState } from 'react';
import { ActionIcon, Box, Button, Grid, LoadingOverlay, Table, Text } from '@mantine/core';
import {
  IconBan,
  IconBolt,
  IconCircleFilled,
  IconSortDescending,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';

import NumericLabel from '../utils/NumericLabel';
import CancelPowerDownPrompt from './Vesting/CancelPowerDownPrompt';
import PowerDownPrompt from './Vesting/PowerDownPrompt';
import PowerUpPrompt from './Vesting/PowerUpPrompt';
import PowerDownDestinationPrompt from './Vesting/PowerDownDestinationPrompt';
import AccountName from './global/AccountName';

const VestingAccounts: React.FC<any> = (props) => {
  const [powerDown, setPowerDown] = useState<any>(false);
  const [powerDownDestination, setPowerDownDestination] = useState<any>(false);
  const [cancelPowerDown, setCancelPowerDown] = useState<any>(false);
  const [powerUp, setPowerUp] = useState<any>(false);

  const resetState = () => {
    setPowerDown(false);
    setPowerDownDestination(false);
    setCancelPowerDown(false);
    setPowerUp(false);
  };

  useEffect(() => {
    if (props.processing.account_set_withdraw_vesting_route_resolved) {
      props.actions.setWithdrawVestingRouteCompleted();
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.processing.account_set_withdraw_vesting_route_resolved]);

  useEffect(() => {
    if (props.processing.account_vesting_withdraw_resolved) {
      props.actions.withdrawVestingCompleted();
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.processing.account_vesting_withdraw_resolved]);

  const handlePowerDownPrompt = (value) => {
    setPowerDown(value);
  };

  const handlePowerDownDestinationRemove = (e, value) => {
    const { permissions } = props.keys;
    const account = value.route.from_account;
    const target = value.route.to_account;
    const percent = 0;
    const autoVest = false;
    props.actions.useKey(
      'setWithdrawVestingRoute',
      { account, target, percent, autoVest },
      permissions[account]
    );
    e.preventDefault();
  };

  const handlePowerDownDestinationPrompt = (value) => {
    setPowerDownDestination(value);
  };

  const handlePowerDownCancelPrompt = (value) => {
    setCancelPowerDown(value);
  };

  const handlePowerUpPrompt = (value) => {
    setPowerUp(value);
  };

  let powerDownPrompt: any = false;
  let powerUpPrompt: any = false;
  const { names } = props.keys;
  if (powerDownDestination) {
    powerDownPrompt = (
      <PowerDownDestinationPrompt
        handleCancel={resetState}
        targetAccount={powerDownDestination}
        {...props}
      />
    );
  }
  if (powerDown) {
    powerDownPrompt = (
      <PowerDownPrompt handleCancel={resetState} targetAccount={powerDown} {...props} />
    );
  }
  if (cancelPowerDown) {
    powerDownPrompt = (
      <CancelPowerDownPrompt handleCancel={resetState} targetAccount={cancelPowerDown} {...props} />
    );
  }
  if (powerUp) {
    powerUpPrompt = <PowerUpPrompt handleCancel={resetState} targetAccount={powerUp} {...props} />;
  }
  const numberFormat = {
    shortFormat: true,
    shortFormatMinValue: 1000,
  };
  const { account_set_withdraw_vesting_route_pending } = props.processing;
  const hiveProps = props.hive.props;
  const accounts = names.map((name) => {
    const account = props.account.accounts[name];
    const withdrawRoutes = props.account.withdrawRoutes
      ? props.account.withdrawRoutes[name]
      : false;
    const nextPowerDown = new Date(account.next_vesting_withdrawal);
    const isPoweringDown = account.next_vesting_withdrawal != '1969-12-31T23:59:59';
    let nextPowerDownDisplay: any = false;
    let withdrawRoutesDisplay: any = false;
    let withdrawRoutesControl: any = (
      <Button
        fullWidth
        color="dark"
        size="xs"
        leftSection={<IconUser size={14} />}
        onClick={() => handlePowerDownDestinationPrompt(name)}
      >
        Add Withdraw Account
      </Button>
    );
    if (account.withdraw_routes > 0 && withdrawRoutes) {
      let total = 0;
      withdrawRoutesDisplay = (
        <Table>
          <Table.Tbody>
            {withdrawRoutes.map((route) => {
              total += route.percent;
              return (
                <Table.Tr key={route.to_account}>
                  <Table.Td>
                    <AccountName name={route.to_account} />
                  </Table.Td>
                  <Table.Td>{route.percent / 100}%</Table.Td>
                  <Table.Td>{route.auto_vest ? 'VEST' : 'HIVE'}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="orange"
                      onClick={(e) => handlePowerDownDestinationRemove(e, { name, route })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      );
      // Disable addition if we've allocated 100%
      if (total >= 10000) {
        withdrawRoutesControl = false;
      }
    }
    let controls: any = (
      <Button
        color="red"
        size="xs"
        leftSection={<IconSortDescending size={14} />}
        style={{ fontSize: '12px' }}
        onClick={() => handlePowerDownPrompt(name)}
      >
        {'Power Down'}
      </Button>
    );
    if (isPoweringDown) {
      const rate = account.vesting_withdraw_rate;
      const vests = parseFloat(rate.split(' ')[0]);
      const totalVestsHive = parseFloat(hiveProps.total_vesting_fund_hive.split(' ')[0]);
      const totalVests = parseFloat(hiveProps.total_vesting_shares.split(' ')[0]);
      const hive = (totalVestsHive * vests) / totalVests;
      controls = (
        <Button
          color="orange"
          size="xs"
          leftSection={<IconBan size={14} />}
          style={{ fontSize: '12px' }}
          onClick={() => handlePowerDownCancelPrompt(name)}
        >
          {'Stop Power Down'}
        </Button>
      );
      nextPowerDownDisplay = (
        <Text component="div" fw={700}>
          +<NumericLabel params={numberFormat}>{hive}</NumericLabel> HIVE
          <Text component="div" size="xs" c="dimmed">
            &ndash;<NumericLabel params={numberFormat}>{vests}</NumericLabel> VESTS
            {' @ '}
            {new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(
              new Date(nextPowerDown)
            )}
            {' - '}
            {new Intl.DateTimeFormat('en', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }).format(new Date(nextPowerDown))}
          </Text>
        </Text>
      );
    }
    let powerUpControl: any = false;
    if (parseFloat(account.balance.split(' ')[0]) > 0) {
      powerUpControl = (
        <Button
          color="green"
          size="xs"
          leftSection={<IconBolt size={14} />}
          style={{ fontSize: '12px' }}
          onClick={() => handlePowerUpPrompt(name)}
        >
          {'Power Up'}
        </Button>
      );
    }
    return (
      <Table.Tr key={name}>
        <Table.Td>
          <AccountName name={name} />
        </Table.Td>
        <Table.Td ta="center">
          {isPoweringDown ? (
            <IconBolt size={24} color="green" />
          ) : (
            <IconCircleFilled size={16} color="red" />
          )}
        </Table.Td>
        <Table.Td>
          {withdrawRoutesDisplay}
          {withdrawRoutesControl}
        </Table.Td>
        <Table.Td>{nextPowerDownDisplay}</Table.Td>
        <Table.Td ta="right">
          <Grid columns={16}>
            <Grid.Col span={8} style={{ fontSize: '10px' }}>
              {powerUpControl}
            </Grid.Col>
            <Grid.Col span={8} style={{ fontSize: '10px' }}>
              {controls}
            </Grid.Col>
          </Grid>
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <Box pos="relative" p="md">
      <LoadingOverlay visible={account_set_withdraw_vesting_route_pending} />
      {powerDownPrompt}
      {powerUpPrompt}
      <Table withTableBorder withColumnBorders striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Vested Account</Table.Th>
            <Table.Th>Active</Table.Th>
            <Table.Th>Destination Account(s)</Table.Th>
            <Table.Th>Incoming Funds</Table.Th>
            <Table.Th ta="right">Controls</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{accounts}</Table.Tbody>
      </Table>
    </Box>
  );
};

export default VestingAccounts;
