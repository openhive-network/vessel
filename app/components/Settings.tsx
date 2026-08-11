import React, { useState } from 'react';

import {
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import PreferredNode from './global/PreferredNode';

const Settings: React.FC<any> = (props) => {
  const { actions, account, preferences } = props;

  const [addContactModal, setAddContactModal] = useState(false);
  const [newContact, setNewContact] = useState('');

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.currentTarget.value.replace(/(@|\s)+/gim, ' ');
    setNewContact(cleaned);
  };

  const handleCancelContact = () => {
    setAddContactModal(false);
  };

  const handleConfirmContact = () => {
    if (newContact !== '') actions.addContact(newContact);
    setAddContactModal(false);
    setNewContact('');
  };

  const contactList =
    account.contacts &&
    account.contacts.map((contact: any) => (
      <Table.Tr key={contact}>
        <Table.Td>{contact}</Table.Td>
        <Table.Td>
          <Button onClick={() => actions.removeContact(contact)} variant="default">
            Remove
          </Button>
        </Table.Td>
      </Table.Tr>
    ));

  return (
    <Box p="md">
      <PreferredNode {...props} />

      <Divider my="md" />

      <Title order={3}>Exchange Configuration</Title>
      <Text c="dimmed" size="sm" mb="sm">
        Configure the required <strong>unencrypted memo</strong> for each individual currency and
        exchange. Do <strong>NOT</strong> add the
        <strong>#</strong> prefix for encryption, only the memo that the exchange specifies.
      </Text>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>Binance (@bdhivesteem)</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.binance_bdhivesteem_hive ?? ''}
            onChange={(e) =>
              actions.setPreference('binance_bdhivesteem_hive', e.currentTarget.value)
            }
            placeholder="Enter your HIVE Memo for Binance"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>Binance (DEPRECATED - @deepcrypto8)</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.binance_hive ?? ''}
            onChange={(e) => actions.setPreference('binance_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for Binance"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>Bittrex</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.bittrex_hive ?? ''}
            onChange={(e) => actions.setPreference('bittrex_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for Bittrex"
          />
          <TextInput
            label="HBD Memo (Unencrypted)"
            value={preferences.bittrex_hbd ?? ''}
            onChange={(e) => actions.setPreference('bittrex_hbd', e.currentTarget.value)}
            placeholder="Enter your HBD Memo for Bittrex"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>Huobi</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.huobi_hive ?? ''}
            onChange={(e) => actions.setPreference('huobi_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for Huobi"
          />
          <TextInput
            label="HBD Memo (Unencrypted)"
            value={preferences.huobi_hbd ?? ''}
            onChange={(e) => actions.setPreference('huobi_hbd', e.currentTarget.value)}
            placeholder="Enter your HBD Unencrypted Memo for Huobi"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>Gate.io</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.gateio_hive ?? ''}
            onChange={(e) => actions.setPreference('gateio_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for Gate.io"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>Ionomy</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.ionomy_hive ?? ''}
            onChange={(e) => actions.setPreference('ionomy_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for Ionomy"
          />
          <TextInput
            label="HBD Memo (Unencrypted)"
            value={preferences.ionomy_hbd ?? ''}
            onChange={(e) => actions.setPreference('ionomy_hbd', e.currentTarget.value)}
            placeholder="Enter your HBD Memo for Ionomy"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>ProBit</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.probit_hive ?? ''}
            onChange={(e) => actions.setPreference('probit_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for ProBit"
          />
          <TextInput
            label="HBD Memo (Unencrypted)"
            value={preferences.probit_hbd ?? ''}
            onChange={(e) => actions.setPreference('probit_hbd', e.currentTarget.value)}
            placeholder="Enter your HBD Memo for ProBit"
          />
        </Group>
      </Paper>

      <Paper withBorder p="md" radius={0}>
        <Title order={5}>MXC</Title>
        <Group grow mt="sm">
          <TextInput
            label="HIVE Memo (Unencrypted)"
            value={preferences.mxc_hive ?? ''}
            onChange={(e) => actions.setPreference('mxc_hive', e.currentTarget.value)}
            placeholder="Enter your HIVE Memo for MXC"
          />
          <TextInput
            label="HBD Memo (Unencrypted)"
            value={preferences.mxc_hbd ?? ''}
            onChange={(e) => actions.setPreference('mxc_hbd', e.currentTarget.value)}
            placeholder="Enter your HBD Memo for MXC"
          />
        </Group>
      </Paper>

      <Divider my="md" />

      <Title order={3}>Contact List</Title>
      <Text c="dimmed" size="sm" mb="sm">
        Add or remove users from your contact list.
      </Text>

      <Paper withBorder p="md" radius={0}>
        <Table style={{ minWidth: '300px', margin: '0 auto', width: '100%' }}>
          <Table.Tbody>
            {contactList}
            <Table.Tr>
              <Table.Td colSpan={2} align="center">
                <Button onClick={() => setAddContactModal(true)}>Add New Contact</Button>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={addContactModal} onClose={handleCancelContact} title="Add a New Contact">
        <Box p="md">
          <TextInput
            label="Username to add to contact list"
            placeholder="username (without @)"
            data-autofocus
            value={newContact}
            onChange={handleContactChange}
          />
        </Box>
        <Group justify="flex-end" mt="md">
          <Button color="red" onClick={handleCancelContact}>
            Cancel
          </Button>
          <Button color="green" onClick={handleConfirmContact}>
            Confirmed - add contact
          </Button>
        </Group>
      </Modal>
    </Box>
  );
};

export default Settings;
