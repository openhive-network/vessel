import React from 'react';
import { Box, Table, Text, Title } from '@mantine/core';

import AccountName from '../global/AccountName';

export default function AccountsAuths(props: any) {
  const { names } = props.keys;
  const accounts = names.map((name: any) => {
    const account = props.account.accounts[name];
    return (
      <Table.Tr key={name}>
        <Table.Td>
          <Title order={5} fw={500}>
            <p>
              <AccountName name={name} />
            </p>
          </Title>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Table>
            <Table.Tbody>
              {['posting', 'active', 'owner'].map((key_type) =>
                account[key_type].key_auths.map((auth: any) => (
                  <Table.Tr key={`${key_type}-${auth[0]}`}>
                    <Table.Td>{key_type}</Table.Td>
                    <Table.Td>{auth[0]}</Table.Td>
                    <Table.Td>{auth[1]}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Table>
            <Table.Tbody>
              {['posting', 'active', 'owner'].map((key_type) =>
                account[key_type].account_auths.map((auth: any) => (
                  <Table.Tr key={`${key_type}-${auth[0]}`}>
                    <Table.Td>{key_type}</Table.Td>
                    <Table.Td>{auth[0]}</Table.Td>
                    <Table.Td>{auth[1]}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.Td>
      </Table.Tr>
    );
  });
  return (
    <Box p="md">
      <Title order={4} fw={400} mb="sm">
        <Text c="dimmed">
          Each account can grant authority over portions of control to external accounts. These
          authorities for each account are listed below.
        </Text>
      </Title>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ textAlign: 'center' }}>Name</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>Key Auths</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>Account Auths</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{accounts}</Table.Tbody>
      </Table>
    </Box>
  );
}
