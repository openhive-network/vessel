import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react';

import NumericLabel from '../../utils/NumericLabel';
import AccountName from '../global/AccountName';

export default function AccountsProxy(props: any) {
  const [editProxyFor, setEditProxyFor] = useState<any>(false);
  // Dynamic per-account proxy input map (class stored this under state[<account>]).
  const [proxyMap, setProxyMap] = useState<any>({});

  const resetState = () => {
    setEditProxyFor(false);
  };

  const {
    account_set_voting_proxy_error,
    account_set_voting_proxy_pending,
    account_set_voting_proxy_resolved,
  } = props.processing;

  // componentWillReceiveProps watched account_set_voting_proxy_resolved. useRef seed so the
  // effect fires on the truthy transition, not on mount, matching the class's nextProps guard.
  const prevResolved = useRef(account_set_voting_proxy_resolved);
  useEffect(() => {
    if (
      account_set_voting_proxy_resolved &&
      account_set_voting_proxy_resolved !== prevResolved.current
    ) {
      props.actions.setVotingProxyCompleted();
      resetState();
    }
    prevResolved.current = account_set_voting_proxy_resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account_set_voting_proxy_resolved]);

  const handleCancel = () => {
    resetState();
  };

  const handleCancelProxy = (name: any) => {
    const account = name;
    const { permissions } = props.keys;
    props.actions.useKey('setVotingProxy', { account, proxy: '' }, permissions[account]);
  };

  const handleEditProxy = (name: any) => {
    setEditProxyFor(name);
  };

  const handleEditProxyConfirm = (e: any) => {
    const account = editProxyFor;
    const { permissions } = props.keys;
    const proxy = proxyMap[account];
    props.actions.useKey('setVotingProxy', { account, proxy }, permissions[account]);
    e.preventDefault();
  };

  const handleChangeProxy = (value: any) => {
    const editing = editProxyFor;
    setProxyMap((prev: any) => ({ ...prev, [editing]: value.trim() }));
  };

  let editProxy: any = false;
  if (editProxyFor) {
    editProxy = (
      <Modal
        opened
        onClose={handleCancel}
        title="Set Account Proxy - Witness Voting"
        size="sm"
        closeOnEscape={false}
        closeOnClickOutside={false}
        withCloseButton={false}
      >
        <Box pos="relative" p="md">
          <LoadingOverlay visible={account_set_voting_proxy_pending} />
          <p>Please enter the name of the account you wish to delegate witness voting power to.</p>
          <TextInput
            name="proxy"
            data-autofocus
            autoFocus
            onChange={(e) => handleChangeProxy(e.currentTarget.value)}
          />
          {account_set_voting_proxy_error && (
            <Alert color="red" title="Operation Error" mt="md">
              {account_set_voting_proxy_error}
            </Alert>
          )}
        </Box>
        <Group justify="space-between" mt="md">
          <Button color="red" onClick={handleCancel} disabled={account_set_voting_proxy_pending}>
            Cancel Operation
          </Button>
          <Button
            type="submit"
            color="blue"
            onClick={handleEditProxyConfirm}
            disabled={account_set_voting_proxy_pending}
          >
            Set Proxy
          </Button>
        </Group>
      </Modal>
    );
  }

  const { names } = props.keys;
  const numberFormat = {
    shortFormat: true,
    shortFormatMinValue: 1000,
  };
  const accounts = names.map((name: any) => {
    const { proxy } = props.account.accounts[name];
    const hasProxy = proxy && proxy !== '';
    const shares = props.account.accounts[name].vesting_shares.split(' ')[0];
    return (
      <Table.Tr key={name}>
        <Table.Td>
          <AccountName name={name} />
        </Table.Td>
        <Table.Td ta="center">
          <NumericLabel params={numberFormat}>{shares}</NumericLabel>
        </Table.Td>
        <Table.Td ta="center">
          {hasProxy ? <IconCheck size={20} color="green" /> : <IconX size={20} color="red" />}
        </Table.Td>
        <Table.Td ta="center">
          <AccountName name={proxy} />
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <Button color="dark" onClick={() => handleEditProxy(name)}>
              <IconPencil size={16} />
            </Button>
            <Button
              color="red"
              disabled={!hasProxy || account_set_voting_proxy_pending}
              onClick={() => handleCancelProxy(name)}
            >
              <IconTrash size={16} />
            </Button>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Box p="md">
      {editProxy}
      <Title order={4} fw={400} mb="sm">
        <Text c="dimmed">
          Each account may proxy it's vested weight to a designated account for witness voting.
        </Text>
      </Title>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th ta="center">Name</Table.Th>
            <Table.Th ta="center">VESTS</Table.Th>
            <Table.Th ta="center">Proxied</Table.Th>
            <Table.Th ta="center">Destination Account</Table.Th>
            <Table.Th>Controls</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{accounts}</Table.Tbody>
      </Table>
    </Box>
  );
}
