import React from 'react';
import { Box, Divider, Loader, Paper, Table, Title } from '@mantine/core';
import _ from 'lodash';
import NumericLabel from '../../utils/NumericLabel';
import AccountName from '../global/AccountName';
import { StatGroup, Statistic } from '../ui/Statistic';

const Balances: React.FC<any> = (props) => {
  const getBalances = (data: any) => {
    const hiveProps = props.hive.props;
    const totalVestsHive = parseFloat(hiveProps.total_vesting_fund_hive.split(' ')[0]);
    const totalVests = parseFloat(hiveProps.total_vesting_shares.split(' ')[0]);
    const mapping = {
      HBD: ['hbd_balance'],
      HBD_SAVINGS: ['savings_hbd_balance'],
      HIVE: ['balance'],
      HIVE_SAVINGS: ['savings_balance'],
      VESTS: ['vesting_shares'],
    };
    const balances: Record<string, any> = {
      HBD: 0,
      HBD_SAVINGS: 0,
      HIVE: 0,
      HIVE_SAVINGS: 0,
      VESTS: 0,
      HP: 0,
    };
    if (!data) {
      return {
        HBD: <Loader size="xs" />,
        HIVE: <Loader size="xs" />,
        VESTS: <Loader size="xs" />,
        HP: <Loader size="xs" />,
      };
    }
    _.forOwn(mapping, (fields: any, assignment: any) => {
      _.forEach(fields, (field) => {
        const [value] = data[field] ? data[field].split(' ') : [0];
        balances[assignment] += parseFloat(value);
      });
    });
    balances.HP = (totalVestsHive * balances.VESTS) / totalVests;
    return balances;
  };

  let display: any = false;
  if (props.hive.props) {
    const { accounts } = props.account;
    const { names } = props.keys;
    const balances = names.map((account: any) =>
      accounts && accounts[account] ? getBalances(accounts[account]) : {}
    );
    const totals = {
      HBD: balances.reduce(
        (HBD: any, balance: any) => HBD + parseFloat(balance.HBD) + parseFloat(balance.HBD_SAVINGS),
        0
      ),
      HIVE: balances.reduce(
        (HIVE: any, balance: any) => HIVE + parseFloat(balance.HIVE) + parseFloat(balance.HIVE_SAVINGS),
        0
      ),
      VESTS: balances.reduce((VESTS: any, balance: any) => VESTS + parseFloat(balance.VESTS), 0),
      HP: balances.reduce((HP: any, balance: any) => HP + parseFloat(balance.HP), 0),
    };
    const numberFormat = {
      shortFormat: true,
      shortFormatMinValue: 1000,
    };
    const network = props.hive.props.network || 'Hive';
    display = (
      <Box p="md">
        <Title order={3}>Total Wallet Balance</Title>
        <Paper withBorder p="md" radius="md" mt="md">
          <StatGroup cols={4}>
            <Statistic
              label={network === 'Hive' || network === 'Hive Mirrornet' ? 'HBD' : 'TBD'}
              value={<NumericLabel params={numberFormat}>{totals.HBD}</NumericLabel>}
            />
            <Statistic
              label={network === 'Hive' || network === 'Hive Mirrornet' ? 'HIVE' : 'TESTS'}
              value={<NumericLabel params={numberFormat}>{totals.HIVE}</NumericLabel>}
            />
            <Statistic
              label={network === 'Hive' || network === 'Hive Mirrornet' ? 'HP' : 'TP'}
              value={<NumericLabel params={numberFormat}>{totals.HP}</NumericLabel>}
            />
            <Statistic
              label="VESTS"
              value={<NumericLabel params={numberFormat}>{totals.VESTS}</NumericLabel>}
            />
          </StatGroup>
        </Paper>
        <Divider my="md" />
        <Title order={3}>Account Balances</Title>
        <Table withTableBorder withColumnBorders mt="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th ta="right">Account</Table.Th>
              <Table.Th colSpan={2} ta="right">
                Available to Spend
              </Table.Th>
              <Table.Th colSpan={2} ta="right">
                Savings Account
              </Table.Th>
              <Table.Th colSpan={2} ta="right">
                Locked
              </Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th ta="right">
                {network === 'Hive' || network === 'Hive Mirrornet' ? 'HBD' : 'TBD'}
              </Table.Th>
              <Table.Th ta="right">
                {network === 'Hive' || network === 'Hive Mirrornet' ? 'HIVE' : 'TESTS'}
              </Table.Th>
              <Table.Th ta="right">
                {network === 'Hive' || network === 'Hive Mirrornet' ? 'HBD' : 'TBD'}
              </Table.Th>
              <Table.Th ta="right">
                {network === 'Hive' || network === 'Hive Mirrornet' ? 'HIVE' : 'TESTS'}
              </Table.Th>
              <Table.Th ta="right">
                {network === 'Hive' || network === 'Hive Mirrornet' ? 'HP' : 'TP'}
              </Table.Th>
              <Table.Th ta="right">VESTS</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {names.map((account: any, i: any) => (
              <Table.Tr key={account}>
                <Table.Td>
                  <AccountName name={account} />
                </Table.Td>
                <Table.Td ta="right">
                  <NumericLabel params={numberFormat}>{balances[i].HBD}</NumericLabel>
                </Table.Td>
                <Table.Td ta="right">
                  <NumericLabel params={numberFormat}>{balances[i].HIVE}</NumericLabel>
                </Table.Td>
                <Table.Td ta="right">
                  <NumericLabel params={numberFormat}>{balances[i].HBD_SAVINGS}</NumericLabel>
                </Table.Td>
                <Table.Td ta="right">
                  <NumericLabel params={numberFormat}>{balances[i].HIVE_SAVINGS}</NumericLabel>
                </Table.Td>
                <Table.Td ta="right">
                  <NumericLabel params={numberFormat}>{balances[i].HP}</NumericLabel>
                </Table.Td>
                <Table.Td ta="right">
                  <NumericLabel params={numberFormat}>{balances[i].VESTS}</NumericLabel>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    );
  }
  return display;
};

export default Balances;
