import React from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Paper, Group, Title, Text } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import Settings from '../components/Settings';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';
import * as AccountActions from '../actions/account';
import * as PreferencesActions from '../actions/preferences';

function SettingsPage(props: any) {
  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }
  return (
    <ContentBar>
      <Paper withBorder p="md" radius={0}>
        <Group gap="xs">
          <IconSettings size={20} />
          <Title order={3}>Wallet Settings</Title>
        </Group>
        <Text c="dimmed" size="sm">
          Configuration for Vessel wallets.
        </Text>
      </Paper>
      <Settings {...props} />
      <MenuBar />
    </ContentBar>
  );
}

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...PreferencesActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsPage);
