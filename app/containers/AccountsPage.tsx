import React, { useState } from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Box, Button, Group, Modal, Paper, Tabs, Text, Title } from '@mantine/core';
import {
  IconCheck,
  IconChecklist,
  IconLock,
  IconPlus,
  IconSitemap,
  IconUsers,
} from '@tabler/icons-react';

import Accounts from '../components/Accounts';
import AccountsAuths from '../components/Accounts/Auths';
import AccountsDelegation from '../components/Accounts/Delegation';
import AccountsProxy from '../components/Accounts/Proxy';
import AccountsVoting from '../components/Accounts/Voting';
import * as AccountActions from '../actions/account';
import * as KeyActions from '../actions/keys';
import * as ProcessingActions from '../actions/processing';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';
import KeysAdd from '../components/Keys/Add';
import KeysCreate from '../components/Keys/Create';
import KeysMemo from '../components/Keys/Memo';
import KeysAuth from '../components/Keys/Auth';

const AccountsPage: React.FC<any> = (props) => {
  const [activeItem, setActiveItem] = useState('keys');

  const handleItemClick = (name: any) => setActiveItem(name);

  const handleAddAccount = () => {
    props.actions.addKeyPrompt();
  };

  const handleAddAccountCancel = () => {
    props.actions.addKeyCancel();
  };

  const handleAddMemoKeyCancel = () => {
    props.actions.addMemoKeyCancel();
  };

  const handleCreateAccountCancel = () => {
    props.actions.createKeyCancel();
  };

  const handleRemoveKeyCancel = () => {
    props.actions.removeKeyCancel();
  };

  const handleRemoveKeyConfirmed = () => {
    props.actions.removeKeyConfirmed(props.keys.remove);
  };

  const handleAddAuthCancel = () => {
    props.actions.addAuthCancel();
  };

  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }

  let modal: any = false;
  if (props.keys.addPrompt) {
    modal = (
      <Modal opened onClose={handleAddAccountCancel} size="lg" title="Add Account">
        <KeysAdd {...props} />
      </Modal>
    );
  }
  if (props.keys.createPrompt) {
    modal = (
      <Modal opened onClose={handleCreateAccountCancel} size="lg" title="Create Account">
        <KeysCreate handleMethodReset={handleCreateAccountCancel} {...props} />
      </Modal>
    );
  }
  let activeTab = <Accounts {...props} />;
  switch (activeItem) {
    case 'auths': {
      activeTab = <AccountsAuths {...props} />;
      break;
    }
    case 'delegation': {
      activeTab = <AccountsDelegation {...props} />;
      break;
    }
    case 'proxy': {
      activeTab = <AccountsProxy {...props} />;
      break;
    }
    case 'voting': {
      activeTab = <AccountsVoting {...props} />;
      break;
    }
    default: {
      activeTab = <Accounts {...props} />;
      break;
    }
  }

  if (props.keys.remove) {
    modal = (
      <Modal
        opened
        onClose={handleRemoveKeyCancel}
        title="Remove this account?"
        closeOnEscape={false}
        closeOnClickOutside={false}
        withCloseButton={false}
      >
        <Text>
          Are you sure you want to remove this account? All keys associated to this account will be
          removed from the wallet. If you do not have backups, your account may be lost.
        </Text>
        <Title order={5} mt="md">
          Account: {props.keys.remove}
        </Title>
        <Group justify="flex-end" mt="md">
          <Button color="red" onClick={handleRemoveKeyCancel}>
            No
          </Button>
          <Button color="green" onClick={handleRemoveKeyConfirmed}>
            Yes
          </Button>
        </Group>
      </Modal>
    );
  }
  if (props.keys.addMemoPrompt) {
    modal = (
      <Modal
        opened
        onClose={handleAddMemoKeyCancel}
        title="Add a Memo Key"
        closeOnEscape={false}
        closeOnClickOutside={false}
        withCloseButton={false}
      >
        <KeysMemo actions={props.actions} keys={props.keys} />
        <Group justify="flex-end" mt="md">
          <Button color="red" onClick={handleAddMemoKeyCancel}>
            Cancel
          </Button>
        </Group>
      </Modal>
    );
  }
  if (props.keys.addAuthPrompt) {
    modal = (
      <Modal
        opened
        onClose={handleAddAuthCancel}
        title="Add a Key or Account Auth"
        closeOnEscape={false}
        closeOnClickOutside={false}
        withCloseButton={false}
      >
        <KeysAuth actions={props.actions} keys={props.keys} />
        <Group justify="flex-end" mt="md">
          <Button color="red" onClick={handleAddAuthCancel}>
            Cancel
          </Button>
        </Group>
      </Modal>
    );
  }
  if (props.keys.removeAuthPrompt) {
    modal = (
      <Modal
        opened
        // No onClose in the original (no handleRemoveAuthCancel method existed on the class;
        // the Cancel button's onClick resolved to undefined there too). Preserved as-is.
        onClose={() => {}}
        title="Remove a Key or Account Auth"
        closeOnEscape={false}
        closeOnClickOutside={false}
        withCloseButton={false}
      >
        <KeysAuth actions={props.actions} keys={props.keys} />
        <Group justify="flex-end" mt="md">
          <Button color="red" onClick={undefined}>
            Cancel
          </Button>
        </Group>
      </Modal>
    );
  }
  return (
    <ContentBar>
      {modal}
      <Paper withBorder p="md" radius={0}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconUsers size={20} />
            <Box>
              <Title order={3}>Accounts</Title>
              <Text c="dimmed" size="sm">
                The accounts imported into this wallet and their permissions.
              </Text>
            </Box>
          </Group>
          <Button color="green" leftSection={<IconPlus size={16} />} onClick={handleAddAccount}>
            Add account
          </Button>
        </Group>
      </Paper>
      <Tabs value={activeItem} onChange={handleItemClick}>
        <Tabs.List>
          <Tabs.Tab value="keys" leftSection={<IconLock size={16} />}>
            Account Keys
          </Tabs.Tab>
          <Tabs.Tab value="auths" leftSection={<IconUsers size={16} />}>
            Account Auths
          </Tabs.Tab>
          <Tabs.Tab value="delegation" leftSection={<IconChecklist size={16} />}>
            HP Delegation
          </Tabs.Tab>
          <Tabs.Tab value="proxy" leftSection={<IconSitemap size={16} />}>
            Witness Proxy
          </Tabs.Tab>
          <Tabs.Tab value="voting" leftSection={<IconCheck size={16} />}>
            Witness Voting
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
    preferences: state.preferences,
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
