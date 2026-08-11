import React from 'react';
import { Grid, Paper, Text, Title } from '@mantine/core';
import { IconCircleArrowRight } from '@tabler/icons-react';

import AccountAvatar from '../../../global/AccountAvatar';
import AccountName from '../../../global/AccountName';

export default function OperationsPromptTransfer(props: any) {
  const { opData } = props;
  const avatar_from = <AccountAvatar name={opData.from} />;
  const avatar_to = <AccountAvatar name={opData.to} />;
  return (
    <Paper withBorder radius={0} p="md">
      <Grid columns={16}>
        <Grid.Col span={5} ta="center">
          {avatar_from}
          <Title order={4} style={{ margin: 0 }}>
            {opData.from ? <AccountName name={opData.from} /> : '<sender>'}
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
            <div>{opData.amount}</div>
          </Title>
        </Grid.Col>
        <Grid.Col span={5} ta="center">
          {avatar_to}
          <Title order={4} style={{ margin: 0 }}>
            <AccountName name={opData.to} />
          </Title>
          {opData.amount ? (
            <Text size="sm" c="green">
              +{opData.amount}
            </Text>
          ) : (
            false
          )}
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
