import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, LoadingOverlay, Paper, Select, Text, Textarea, TextInput } from '@mantine/core';

const AccountsCustomJSON: React.FC<any> = (props) => {
  const { keys } = props;

  const [account, setAccount] = useState<any>(keys.names[0]);
  const [id, setId] = useState('');
  const [json, setJson] = useState('');
  const [message, setMessage] = useState<any>(false);
  const [permission, setPermission] = useState<any>('posting');

  const { account_custom_json_error, account_custom_json_pending, account_custom_json_resolved } =
    props.processing;

  const resolvedRef = useRef(account_custom_json_resolved);
  useEffect(() => {
    if (resolvedRef.current !== account_custom_json_resolved) {
      if (account_custom_json_resolved) {
        props.actions.customJsonCompleted();
        setId('');
        setJson('');
        setMessage('Your transaction was successfully broadcast.');
      }
    }
    resolvedRef.current = account_custom_json_resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account_custom_json_resolved]);

  const onValidSubmit = (e: any) => {
    setMessage(false);
    props.actions.useKey(
      'customJson',
      { account, id, json, permission },
      keys.permissions[account]
    );
    e.preventDefault();
  };

  const availableFrom = keys.names.map((name: any) => {
    const hasPermission =
      keys.permissions[name].type === 'active' || keys.permissions[name].type === 'owner';
    return hasPermission
      ? {
          value: name,
          label: name,
        }
      : {
          value: name,
          disabled: true,
          label: `${name} (unavailable - active/owner key not loaded)`,
        };
  });
  const availablePermissions = ['active', 'posting'].map((perm) => ({
    value: perm,
    label: perm,
  }));

  return (
    <Paper p="md" withBorder>
      <Text size="sm" c="dimmed">
        Broadcast a Custom JSON operation to the Hive blockchain.
      </Text>
      {message && (
        <Alert color="green" title="Operation Complete" mt="md">
          {message}
        </Alert>
      )}
      <Box pos="relative" component="form" onSubmit={onValidSubmit}>
        <LoadingOverlay visible={account_custom_json_pending} />
        <Select
          mt="md"
          label="Select an account to broadcast with"
          value={account}
          data={availableFrom}
          placeholder="Sending Account..."
          onChange={setAccount}
        />
        <Select
          mt="md"
          label="Select a permission to use"
          value={permission}
          data={availablePermissions}
          placeholder="Permission"
          onChange={setPermission}
        />
        <TextInput
          mt="md"
          label="ID"
          value={id}
          onChange={(e) => setId(e.currentTarget.value)}
          placeholder=""
        />
        <Textarea
          mt="md"
          label="JSON"
          value={json}
          onChange={(e) => setJson(e.currentTarget.value.trim())}
          placeholder=""
        />
        {account_custom_json_error && (
          <Alert color="red" title="Operation Error" mt="md">
            {account_custom_json_error}
          </Alert>
        )}
        <Button type="submit" color="blue" mt="md" disabled={account_custom_json_pending}>
          Broadcast
        </Button>
      </Box>
    </Paper>
  );
};

export default AccountsCustomJSON;
