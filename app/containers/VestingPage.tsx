import React from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Group, Paper, Text, Title } from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';
import VestingAccounts from '../components/VestingAccounts';
import * as AccountActions from '../actions/account';
import * as KeysActions from '../actions/keys';

const VestingsPage: React.FC<any> = (props) => {
  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }
  return (
    <ContentBar>
      <Paper withBorder p="md" radius={0}>
        <Group gap="xs">
          <IconBolt size={20} />
          <Title order={3}>Vesting Schedule</Title>
        </Group>
        <Text c="dimmed" size="sm">
          Hive Power (aka HP aka VESTS) can be converted to liquid HIVE using a process called
          'Powering Down' which takes 13 weeks to complete. During the 13 weeks, every 7 days,
          1/13th of the amount choosen to withdraw will be credited to your account. You can
          interrupt this process at any time.
        </Text>
        <Text c="dimmed" size="sm" mt="xs">
          HIVE can be converted to vested HP using a process called 'Powering Up' which is
          instant. Powering up adds to user stake for allocating rewards and witness voting.
        </Text>
      </Paper>
      <VestingAccounts {...props} />
      <MenuBar />
    </ContentBar>
  );
};

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
    processing: state.processing,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch: any) {
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

export default connect(mapStateToProps, mapDispatchToProps)(VestingsPage);
