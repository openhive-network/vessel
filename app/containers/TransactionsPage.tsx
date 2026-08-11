import React from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Box, Group, Paper, Text, Title } from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';

import MenuBar from './MenuBar';
import Balances from '../components/Transactions/Balances';
import PendingRewards from '../components/Transactions/PendingRewards';
import ContentBar from '../components/ContentBar';

import * as AccountActions from '../actions/account';
import * as ProcessingActions from '../actions/processing';
import * as KeysActions from '../actions/keys';
import * as HiveActions from '../actions/hive';

const TransactionsPage: React.FC<any> = (props) => {
  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <ContentBar>
      <Paper withBorder p="md" radius={0}>
        <Group gap="xs" mb={4}>
          <IconBolt size={20} />
          <Title order={3}>Account Balances</Title>
        </Group>
        <Text c="dimmed" size="sm">
          The total balance of all accounts and the individual balances of each account.
        </Text>
      </Paper>
      <Box p="md">
        <PendingRewards {...props} />
        <Balances {...props} />
      </Box>
      <MenuBar />
    </ContentBar>
  );
};

function mapStateToProps(state) {
  return {
    account: state.account,
    account_data: state.account_data,
    keys: state.keys,
    processing: state.processing,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...KeysActions,
        ...ProcessingActions,
        ...HiveActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(TransactionsPage);
