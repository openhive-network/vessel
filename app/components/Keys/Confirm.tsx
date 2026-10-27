import React from 'react';
import { Box, Button, Group, List, Table, Text, Title } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

export default function KeysConfirm(props: any) {
  const confirmAccount = props.keys.confirm;
  const { encryptWallet } = props;
  const { handleConfirmAction } = props;

  const renderStatusIcon = (granted: boolean) =>
    granted ? (
      <IconCheck size={22} color="var(--mantine-color-green-6)" />
    ) : (
      <IconX size={22} color="var(--mantine-color-red-6)" />
    );

  return (
    <Box p="md">
      <Title order={3}>Confirm Account Information</Title>
      <Text size="sm" c="dimmed">
        The key entered corresponds to the following account and permissions to perform the
        following actions:
      </Text>
      <Table withTableBorder withColumnBorders mt="md">
        <Table.Tbody>
          <Table.Tr>
            <Table.Td w="40%" ta="right">
              Account Name
            </Table.Td>
            <Table.Td>{confirmAccount.account}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td ta="right">Password Encrypted Wallet</Table.Td>
            <Table.Td>{renderStatusIcon(!!encryptWallet)}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td ta="right">
              <List>
                <List.Item>Vote</List.Item>
                <List.Item>Create Posts</List.Item>
                <List.Item>Claim Rewards</List.Item>
              </List>
            </Table.Td>
            <Table.Td>
              {renderStatusIcon(
                !!(confirmAccount.posting || confirmAccount.active || confirmAccount.owner)
              )}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td ta="right">
              <List>
                <List.Item>Transfer Funds</List.Item>
                <List.Item>Witness Voting</List.Item>
              </List>
            </Table.Td>
            <Table.Td>
              {renderStatusIcon(!!(confirmAccount.active || confirmAccount.owner))}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td ta="right">
              <List>
                <List.Item>Change Account Keys</List.Item>
                <List.Item>Transfer Ownership</List.Item>
              </List>
            </Table.Td>
            <Table.Td>{renderStatusIcon(!!confirmAccount.owner)}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
      <Text mt="md">
        Please confirm you would like to save this account with these permissions to this wallet.
      </Text>
      <Group mt="md" justify="space-between">
        <Button
          color="red"
          onClick={(e: any) => handleConfirmAction(e, { value: false })}
        >
          Cancel
        </Button>
        <Button
          color="green"
          onClick={(e: any) => handleConfirmAction(e, { value: true })}
        >
          Confirm Save
        </Button>
      </Group>
    </Box>
  );
}
