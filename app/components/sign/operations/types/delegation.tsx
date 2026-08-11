import React from 'react';
import { Alert, Grid, Paper, Text, Title } from '@mantine/core';
import { IconCircleArrowRight } from '@tabler/icons-react';
import NumericLabel from '../../../../utils/NumericLabel';

import AccountAvatar from '../../../global/AccountAvatar';
import AccountName from '../../../global/AccountName';

export default function OperationsPromptDelegation(props: any) {
  const { opData } = props;
  const { vesting_shares } = opData;
  const avatar_delegator = <AccountAvatar name={opData.delegator} />;
  const avatar_delegatee = <AccountAvatar name={opData.delegatee} />;
  const vests = parseFloat(vesting_shares.split(' ')[0]);
  const totalVestsHive = parseFloat(props.hive.props.total_vesting_fund_hive.split(' ')[0]);
  const totalVests = parseFloat(props.hive.props.total_vesting_shares.split(' ')[0]);
  const hp = vests > 0 ? ((totalVestsHive * vests) / totalVests).toFixed(3) : 0;
  let existingDelegation = 0;
  let existingDelegationWarning: any = false;
  if (props.account.vestingDelegations && props.account.vestingDelegations[opData.delegator]) {
    const existingDelegations = props.account.vestingDelegations[opData.delegator];
    existingDelegation = existingDelegations.reduce(
      (a, b) =>
        b.delegator === opData.delegator && b.delegatee === opData.delegatee
          ? a + parseFloat(b.vesting_shares.split(' ')[0])
          : 0,
      0
    );
    if (existingDelegation > 0) {
      const existingSp = ((totalVestsHive * existingDelegation) / totalVests).toFixed(3);
      existingDelegationWarning = (
        <Grid.Col span={16}>
          <Alert color="blue">
            A delegation of <strong>{existingSp} HP</strong> ({existingDelegation} VESTS) is
            already active from <AccountName name={opData.delegator} /> to{' '}
            <AccountName name={opData.delegatee} />. This new delegation will{' '}
            <strong>overwrite</strong> the existing delegation (not add to it).
          </Alert>
        </Grid.Col>
      );
    }
  }
  const numberFormat = {
    shortFormat: true,
    shortFormatMinValue: 1000,
  };
  return (
    <Paper withBorder radius={0} p="md">
      <Grid columns={16}>
        <Grid.Col span={5} ta="center">
          {avatar_delegator}
          <Title order={4} style={{ margin: 0 }}>
            {opData.delegator ? <AccountName name={opData.delegator} /> : '<sender>'}
          </Title>
          {opData.amount ? (
            <Text size="sm" c="orange">
              -{opData.amount}
            </Text>
          ) : (
            false
          )}
        </Grid.Col>
        <Grid.Col span={6} ta="center">
          <Title order={4} c="green" style={{ margin: 0 }}>
            <IconCircleArrowRight size={48} style={{ margin: '0.25em 0' }} />
            <div>{hp} HP</div>
          </Title>
          <Text size="sm" c="dimmed">
            <NumericLabel params={numberFormat}>{vests}</NumericLabel> VESTS
          </Text>
        </Grid.Col>
        <Grid.Col span={5} ta="center">
          {avatar_delegatee}
          <Title order={4} style={{ margin: 0 }}>
            <AccountName name={opData.delegatee} />
          </Title>
          {opData.amount ? (
            <Text size="sm" c="green">
              +{opData.amount}
            </Text>
          ) : (
            false
          )}
        </Grid.Col>
        {existingDelegationWarning}
      </Grid>
    </Paper>
  );
}
