import React from 'react';
import { ActionIcon, Box, Table, Text, Title } from '@mantine/core';
import { IconCheck, IconCirclePlus, IconTrash, IconX } from '@tabler/icons-react';

import AccountName from './global/AccountName';

export default function Accounts(props: any) {
  const handleRemoveKey = (value: any) => {
    props.actions.removeKey(value);
  };

  const handleAddMemoKey = (value: any) => {
    props.actions.addMemoKeyPrompt(value);
  };

  const { names } = props.keys;
  const accounts = names.map((name: any) => {
    const permissions = ['posting', 'active', 'owner'].map((permission) => (
      <Table.Td key={permission} ta="center">
        {props.keys.permissions[name].type === permission ? (
          <IconCheck size={20} color="var(--mantine-color-green-6)" />
        ) : (
          <IconX size={20} color="var(--mantine-color-red-6)" />
        )}
      </Table.Td>
    ));
    return (
      <Table.Tr key={name}>
        <Table.Td>
          <AccountName name={name} />
        </Table.Td>
        <Table.Td ta="center">
          {props.keys.permissions[name].encrypted ? (
            <IconCheck size={20} color="var(--mantine-color-green-6)" />
          ) : (
            <IconX size={20} color="var(--mantine-color-red-6)" />
          )}
        </Table.Td>
        {permissions}
        <Table.Td ta="center">
          {props.keys.permissions[name].memo ? (
            <IconCheck size={20} color="var(--mantine-color-green-6)" />
          ) : (
            <ActionIcon
              variant="subtle"
              color="dark"
              onClick={() => handleAddMemoKey(name)}
            >
              <IconCirclePlus size={20} />
            </ActionIcon>
          )}
        </Table.Td>
        <Table.Td>
          <ActionIcon color="orange" onClick={() => handleRemoveKey(name)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <Box p="md">
      <Title order={4} fw={400} mb="sm" mih={30}>
        <Text c="dimmed">
          Each account within the wallet can have a different set of permissions and a different
          password encryption.
        </Text>
      </Title>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th colSpan={1} ta="center">
              Account
            </Table.Th>
            <Table.Th colSpan={1} ta="center">
              Wallet
            </Table.Th>
            <Table.Th colSpan={4} ta="center">
              Key Types
            </Table.Th>
            <Table.Th colSpan={1} />
          </Table.Tr>
          <Table.Tr>
            <Table.Th ta="center">Name</Table.Th>
            <Table.Th ta="center">Encrypted</Table.Th>
            <Table.Th ta="center">Posting</Table.Th>
            <Table.Th ta="center">Active</Table.Th>
            <Table.Th ta="center">Owner</Table.Th>
            <Table.Th ta="center">Memo</Table.Th>
            <Table.Th>Controls</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{accounts}</Table.Tbody>
      </Table>
    </Box>
  );
}
