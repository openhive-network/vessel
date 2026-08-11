import React, { useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  LoadingOverlay,
  Paper,
  Select,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconBolt, IconCoin, IconThumbUp } from '@tabler/icons-react';

import OperationsPromptFieldAsset from './fields/asset';
import OperationsPromptFieldPercent from './fields/percent';
import OperationsPromptFieldVests from './fields/vests';

import OperationsPromptDelegation from './types/delegation';
import OperationsPromptTransfer from './types/transfer';
import OperationsPromptVote from './types/vote';

const opData = {};

// Templates for Operation Messaging
// Colors indicate level of risk - green, yellow, orange, red
const opTemplates = {
  account_create: {
    color: 'orange',
    message: () => 'Create new account (Review JSON for info).',
  },
  account_create_with_delegation: {
    color: 'orange',
    message: () => 'Create new account (Review JSON for info).',
  },
  account_update: {
    color: 'red',
    message: () => 'Update account info + keys (Review JSON for info).',
  },
  account_witness_vote: {
    color: 'orange',
    message: (op) => `Voting ${op.witness} for witness.`,
  },
  account_witness_proxy: {
    color: 'orange',
    message: (op) => `Set ${op.proxy} as witness voting proxy.`,
  },
  cancel_transfer_from_savings: {
    color: 'orange',
    message: (op) => `Cancel savings withdraw ${op.request_id} from ${op.from}.`,
  },
  claim_reward_balance: {
    color: 'green',
    message: () => 'Claim pending reward balance.',
  },
  comment: {
    color: 'green',
    message: () => 'Creating a post (Review JSON for info).',
  },
  custom_json: {
    color: 'green',
    message: () => 'Custom Operation - Review JSON for more information.',
  },
  convert: {
    color: 'orange',
    message: (op) => `Convert ${op.amount} to equiv HIVE in 3.5 days.`,
  },
  collateralizedConvert: {
    color: 'orange',
    message: (op) =>
      `Collateralized Convert ${op.amount} to equiv HBD and HIVE coll. return in 3.5 days.`,
  },
  delegate_vesting_shares: {
    color: 'orange',
    message: (op) => `Delegate ${op.delegatee} ${op.vesting_shares}.`,
  },
  feed_publish: {
    color: 'green',
    message: (op) => `Publish price feed of ${op.exchange_rate}.`,
  },
  set_withdraw_vesting_route: {
    color: 'orange',
    message: (op) =>
      `Set power down route to ${op.to_account} @ ${(op.percent / 100).toFixed(2)}%.`,
  },
  transfer: {
    color: 'red',
    message: (op) => `Send ${op.to} ${op.amount}.`,
  },
  transfer_from_savings: {
    color: 'orange',
    message: (op) =>
      `Withdraw ${op.amount} from ${op.from}'s savings account to ${op.to}'s account.`,
  },
  transfer_to_savings: {
    color: 'red',
    message: (op) => `Send ${op.amount} from ${op.from}'s account to ${op.to}'s savings account.`,
  },
  transfer_to_vesting: {
    color: 'red',
    message: (op) => `Send ${op.to} ${op.amount} as Hive Power.`,
  },
  vote: {
    color: 'green',
    message: (op) => `${(op.weight / 100).toFixed(2)}% vote for ${op.author}.`,
  },
  withdraw_vesting: {
    color: 'orange',
    message: (op) => `Power down ${op.vesting_shares} from account ${op.account}.`,
  },
  witness_update: {
    color: 'green',
    message: (op) => `Witness info update for ${op.owner}.`,
  },
};

const OperationsPrompt: React.FC<any> = (props) => {
  const [account, setAccount] = useState<any>(null);
  const [displayRawJSON, setDisplayRawJSON] = useState(false);

  const getPromptsFromMeta = (props: any) =>
    Object.keys(props.meta).map((field) => {
      const meta = props.meta[field];
      if (meta.prompt) {
        switch (meta.type) {
          case 'asset':
          case 'hbd':
          case 'hive':
            return (
              <OperationsPromptFieldAsset
                field={field}
                key={field}
                meta={meta}
                modifyOpsPrompt={props.modifyOpsPrompt}
                opData={opData}
              />
            );
          case 'percent':
            return (
              <OperationsPromptFieldPercent
                field={field}
                key={field}
                meta={meta}
                modifyOpsPrompt={props.modifyOpsPrompt}
                opData={opData}
              />
            );
          case 'vests':
            return (
              <OperationsPromptFieldVests
                field={field}
                key={field}
                meta={meta}
                modifyOpsPrompt={props.modifyOpsPrompt}
                opData={opData}
                hive={props.hive}
              />
            );
          default:
            return (
              <TextInput
                key={field}
                required={meta.required || false}
                label={meta.label || field}
                name={field}
                onChange={(e) =>
                  props.modifyOpsPrompt(e, { index: 0, name: field, value: e.currentTarget.value })
                }
              />
            );
        }
      }
    });

  const [prompts] = useState<any>(() => getPromptsFromMeta(props));

  const handleAccountChange = (value: any) => {
    setAccount(value);
    props.accountChange(value);
  };

  const createOpListItem = (op: any, idx: any) => {
    const opType = op[0];
    const opData = op[1];
    const opTemplate = opTemplates[opType];
    if (!opTemplate) {
      return (
        <Paper key={idx} withBorder p="md" radius={0}>
          <Badge color="red" mr="md">
            {op[0]}
          </Badge>
          Review this operation via the JSON.
        </Paper>
      );
    }
    return (
      <Paper key={idx} withBorder p="md" radius={0}>
        <Badge color={opTemplate.color} mr="md">
          {op[0]}
        </Badge>
        {opTemplate.message(opData)}
      </Paper>
    );
  };

  const listOps = (ops: any) => {
    if (ops.length === 1) {
      const op = props.ops[0];
      const opData = op[1];
      switch (ops[0][0]) {
        case 'delegate_vesting_shares':
          return [
            <Title order={4} key="op-header">
              <IconBolt size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Delegate Hive Power
            </Title>,
            <OperationsPromptDelegation
              key="op-body"
              account={props.account}
              opData={opData}
              hive={props.hive}
            />,
          ];
        case 'transfer':
          return [
            <Title order={4} key="op-header">
              <IconCoin size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Transfer Funds
            </Title>,
            <OperationsPromptTransfer key="op-body" opData={opData} />,
          ];
        case 'vote':
          return [
            <Title order={4} key="op-header">
              <IconThumbUp size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Vote on a Post
            </Title>,
            <OperationsPromptVote key="op-body" opData={opData} hive={props.hive} />,
          ];
      }
    }
    return [
      <Title order={4} key="op-header">
        Actions/Operations
      </Title>,
      ops.map(createOpListItem),
    ];
  };

  const { ops } = props;
  const accounts = props.accounts.map((account) => ({
    value: account,
    label: account,
  }));
  const { account_custom_ops_error, account_custom_ops_pending } = props.processing;

  return (
    <Box pos="relative" component="form" onSubmit={props.submitOps}>
      <LoadingOverlay visible={account_custom_ops_pending} />
      <Paper withBorder p="md" radius={0} bg="blue" c="white">
        <Title order={3}>Sign Transaction ({ops.length} operations)</Title>
      </Paper>
      <Paper withBorder p="md" radius={0}>
        <Stack gap="xs">
          {listOps(ops)}
          {prompts.length > 0 ? (
            <Paper withBorder p="md" radius={0}>
              {prompts}
            </Paper>
          ) : (
            false
          )}
          <Paper withBorder p="md" radius={0}>
            <Select
              label="Signing Account"
              data={accounts}
              value={account}
              onChange={handleAccountChange}
              placeholder="The account to sign this transaction."
            />
          </Paper>
          <Paper withBorder p="md" radius={0}>
            <Accordion
              chevronPosition="left"
              value={displayRawJSON ? 'json' : null}
              onChange={(v) => setDisplayRawJSON(v === 'json')}
            >
              <Accordion.Item value="json">
                <Accordion.Control>
                  <Title order={5} style={{ margin: 0 }}>
                    Transaction JSON
                  </Title>
                </Accordion.Control>
                <Accordion.Panel>
                  <Paper p="md" radius={0}>
                    <pre>{JSON.stringify(ops, null, 2)}</pre>
                  </Paper>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Paper>
        </Stack>
        <Alert
          color="yellow"
          icon={<IconAlertTriangle />}
          title="Please review this transaction"
          mt="md"
        >
          Once signed and broadcast - this transaction cannot be reversed. Please review what types
          of operations you are about to perform and confirm the values.
        </Alert>
        {account_custom_ops_error && (
          <Alert color="red" title="Operation Error" mt="md">
            {account_custom_ops_error}
          </Alert>
        )}
        <Button type="submit" disabled={!account} fullWidth color="blue" mt="md">
          Sign + Broadcast
        </Button>
      </Paper>
    </Box>
  );
};

export default OperationsPrompt;
