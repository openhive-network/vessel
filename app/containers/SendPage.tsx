import React from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Box, Group, Paper, Text, Title } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

import * as AccountActions from '../actions/account';
import * as KeysActions from '../actions/keys';
import * as ProcessingActions from '../actions/processing';
import Send from '../components/Send';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';

const SendPage: React.FC<any> = (props) => {
  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <ContentBar>
      <Paper withBorder p="md" radius={0}>
        <Group gap="xs" mb={4}>
          <IconSend size={20} />
          <Title order={3}>Send Funds</Title>
        </Group>
        <Text c="dimmed" size="sm">
          Transfer HIVE or HBD from one of your accounts to another user or exchange.
        </Text>
      </Paper>
      <Box p="md">
        <Send {...props} />
      </Box>
      <MenuBar />
    </ContentBar>
  );
};

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    hive: state.hive,
    preferences: state.preferences,
    processing: state.processing,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...KeysActions,
        ...ProcessingActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SendPage);
