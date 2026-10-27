import React, { useState } from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Group, Paper, Tabs, Text, Title } from '@mantine/core';
import { IconFlask, IconLock } from '@tabler/icons-react';

import AccountsCustomJson from '../components/Accounts/CustomJSON';
import * as AccountActions from '../actions/account';
import * as KeyActions from '../actions/keys';
import * as ProcessingActions from '../actions/processing';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';

const AccountsPage: React.FC<any> = (props) => {
  const [activeItem, setActiveItem] = useState('custom_json');

  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }

  let activeTab = <AccountsCustomJson {...props} />;
  switch (activeItem) {
    default: {
      activeTab = <AccountsCustomJson {...props} />;
      break;
    }
  }

  return (
    <ContentBar>
      <Paper withBorder p="md" radius={0}>
        <Group gap="xs" mb={4}>
          <IconFlask size={20} />
          <Title order={3}>Advanced Operations</Title>
        </Group>
        <Text c="dimmed" size="sm">
          This section can be used to perform more advanced operations using the loaded accounts.
        </Text>
      </Paper>
      <Tabs value={activeItem} onChange={(value) => setActiveItem(value ?? 'custom_json')}>
        <Tabs.List>
          <Tabs.Tab value="custom_json" leftSection={<IconLock size={16} />}>
            Custom JSON
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {activeTab}
      <MenuBar />
    </ContentBar>
  );
};

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    processing: state.processing,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...KeyActions,
        ...ProcessingActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(AccountsPage);
