import React from 'react';
import { Button, LoadingOverlay, Paper, Table, Title } from '@mantine/core';
import AccountName from '../global/AccountName';

const PendingReward: React.FC<any> = (props) => {
  const claimRewardBalance = (e: any, data: any) => {
    const { accounts } = props.account;
    const account = data.value;
    const { permissions } = props.keys;
    const reward_hbd = accounts[account].reward_hbd_balance;
    const reward_hive = accounts[account].reward_hive_balance;
    const reward_vests = accounts[account].reward_vesting_balance;
    props.actions.useKey(
      'claimRewardBalance',
      { account, reward_hbd, reward_hive, reward_vests },
      permissions[account]
    );
  };

  let display: any = false;
  const { names } = props.keys;
  const { accounts } = props.account;
  const pendingAccounts = names.filter((name: any) =>
    accounts && accounts[name]
      ? accounts[name].reward_vesting_balance !== '0.000000 VESTS'
      : false
  );
  if (pendingAccounts.length > 0) {
    display = (
      <Paper withBorder p="md" radius={0} pos="relative" ta="center">
        <LoadingOverlay visible={props.processing.reward_claim} />
        <Title order={3} mb="sm">
          Pending Rewards
        </Title>
        <Table withTableBorder withColumnBorders ta="center">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Actions</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>HBD</Table.Th>
              <Table.Th>HIVE</Table.Th>
              <Table.Th>VESTS</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pendingAccounts.map((account: any) => (
              <Table.Tr key={account}>
                <Table.Td>
                  <Button onClick={(e) => claimRewardBalance(e, { value: account })}>
                    Claim Pending Balances
                  </Button>
                </Table.Td>
                <Table.Td>
                  <AccountName name={account} />
                </Table.Td>
                <Table.Td>{props.account.accounts[account].reward_hbd_balance}</Table.Td>
                <Table.Td>{props.account.accounts[account].reward_hive_balance}</Table.Td>
                <Table.Td>{props.account.accounts[account].reward_vesting_balance}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    );
  }
  return display;
};

export default PendingReward;
