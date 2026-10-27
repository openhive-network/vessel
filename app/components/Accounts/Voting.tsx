import React, { useEffect, useRef, useState } from 'react';
import {
  Accordion,
  ActionIcon,
  Alert,
  Box,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

import AccountName from '../global/AccountName';

export default function AccountsVoting(props: any) {
  const [addVoteFor, setAddVoteFor] = useState<any>(false);
  const [removeVoteFor, setRemoveVoteFor] = useState<any>(false);
  const [voteError, setVoteError] = useState<any>(false);
  const [witnessInputs, setWitnessInputs] = useState<any>({});

  const resetState = () => {
    setAddVoteFor(false);
    setRemoveVoteFor(false);
  };

  const {
    account_vote_witness_pending,
    account_vote_witness_error,
    account_vote_witness_resolved,
  } = props.processing;

  // componentWillReceiveProps watched these processing flags; seed refs so the
  // effects fire on the truthy transition, not on mount.
  const prevError = useRef(account_vote_witness_error);
  const prevResolved = useRef(account_vote_witness_resolved);

  useEffect(() => {
    if (account_vote_witness_error && account_vote_witness_error !== prevError.current) {
      setVoteError(account_vote_witness_error);
      props.actions.voteWitnessCompleted();
      resetState();
    }
    prevError.current = account_vote_witness_error;
  }, [account_vote_witness_error]);

  useEffect(() => {
    if (account_vote_witness_resolved && account_vote_witness_resolved !== prevResolved.current) {
      props.actions.voteWitnessCompleted();
      resetState();
    }
    prevResolved.current = account_vote_witness_resolved;
  }, [account_vote_witness_resolved]);

  const handleCancel = () => {
    resetState();
  };

  const handleVoteWitness = (value: any) => {
    setAddVoteFor(value);
  };

  const handleVoteWitnessConfirm = (e: any) => {
    const { permissions } = props.keys;
    const account = addVoteFor;
    const witness = witnessInputs[account];
    props.actions.useKey(
      'voteWitness',
      { account, witness, approve: true },
      permissions[account]
    );
    e.preventDefault();
  };

  const handleVoteWitnessRemove = (value: any) => {
    setRemoveVoteFor(value);
  };

  const handleVoteWitnessRemoveConfirm = (e: any) => {
    const { permissions } = props.keys;
    const { account, witness } = removeVoteFor;
    props.actions.useKey(
      'voteWitness',
      { account, witness, approve: false },
      permissions[account]
    );
    e.preventDefault();
  };

  const handleSetWitness = (value: any) => {
    const editing = addVoteFor;
    setWitnessInputs((prev: any) => ({ ...prev, [editing]: value.trim() }));
  };

  const { names } = props.keys;
  const accounts = names.map((name: any) => {
    const account = props.account.accounts[name];
    const witnesses = account.witness_votes || [];
    const hasActiveVotes = witnesses && witnesses.length;
    const votesLeft = 30 - witnesses.length;
    return (
      <Table.Tr key={name}>
        <Table.Td>
          <div>
            <AccountName name={name} />
            <Text size="sm" c="dimmed">
              <strong>{votesLeft}</strong> Votes Left
            </Text>
          </div>
        </Table.Td>
        <Table.Td>
          {hasActiveVotes ? (
            <Accordion variant="contained">
              <Accordion.Item value="votes">
                <Accordion.Control>Votes Table </Accordion.Control>
                <Accordion.Panel>
                  <Divider mb="sm" />
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Witness</Table.Th>
                        <Table.Th>Remove</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {witnesses.map((witness: any) => (
                        <Table.Tr key={witness}>
                          <Table.Td>
                            <AccountName name={witness} />
                          </Table.Td>
                          <Table.Td style={{ width: 75, textAlign: 'center' }}>
                            <ActionIcon
                              color="orange"
                              onClick={() => handleVoteWitnessRemove({ account: name, witness })}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          ) : (
            'No active witness votes'
          )}
        </Table.Td>
        <Table.Td style={{ width: 75, textAlign: 'center' }}>
          <ActionIcon color="green" onClick={() => handleVoteWitness(name)}>
            <IconPlus size={16} />
          </ActionIcon>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Box p="md">
      {addVoteFor && (
        <Modal opened onClose={handleCancel} title="Vote for a Hive Witness" size="sm">
          <Box pos="relative" p="md">
            <LoadingOverlay visible={account_vote_witness_pending} />
            <p>Please enter the name of the Witness you wish to vote for.</p>
            <TextInput
              name="witness"
              placeholder="Witness Account Name"
              onChange={(e) => handleSetWitness(e.currentTarget.value)}
              data-autofocus
              autoFocus
            />
            <Divider mt="md" />
          </Box>
          <Group justify="space-between" mt="md">
            <Button color="red" onClick={handleCancel} disabled={account_vote_witness_pending}>
              Cancel Operation
            </Button>
            <Button
              color="blue"
              onClick={handleVoteWitnessConfirm}
              disabled={account_vote_witness_pending}
            >
              Confirm Witness Vote
            </Button>
          </Group>
        </Modal>
      )}
      {removeVoteFor && (
        <Modal opened onClose={handleCancel} title="Remove vote for a Hive Witness" size="sm">
          <Box pos="relative" p="md">
            <LoadingOverlay visible={account_vote_witness_pending} />
            <p>
              Are you sure you wish to unvote <strong>{removeVoteFor.witness}</strong>?
            </p>
          </Box>
          <Group justify="space-between" mt="md">
            <Button color="blue" onClick={handleCancel} disabled={account_vote_witness_pending}>
              Cancel Operation
            </Button>
            <Button
              color="red"
              onClick={handleVoteWitnessRemoveConfirm}
              disabled={account_vote_witness_pending}
            >
              Confirm Witness Unvote
            </Button>
          </Group>
        </Modal>
      )}
      <Title order={4} fw={400} mb="sm">
        <Text c="dimmed">Each account may vote for 30 witnesses at a time.</Text>
      </Title>
      {voteError && (
        <Alert color="red" title="Operation Error" mb="md">
          {voteError}
        </Alert>
      )}
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ textAlign: 'center' }}>Name</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>Active Votes</Table.Th>
            <Table.Th>Controls</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{accounts}</Table.Tbody>
      </Table>
    </Box>
  );
}
