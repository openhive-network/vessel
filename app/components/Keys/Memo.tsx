import React, { useState } from 'react';
import { Alert, Box, Button, Divider, Grid, Paper, Text, TextInput, PasswordInput } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { hiveAuth } from '../../utils/hiveApi';

const KeysMemo: React.FC<any> = (props) => {
  const account = props.keys.confirmMemo.account;
  const publicKey = props.keys.confirmMemo.public;
  const [wif, setWif] = useState<any>('');
  const [password, setPassword] = useState<any>('');

  const validate = (newState) => {
    const errors: any = {};
    errors.wif_error_invalid = !hiveAuth.isWif(newState.wif);
    errors.wif_not_valid = true;
    if (newState.wif && hiveAuth.wifIsValid(newState.wif, newState.public) === true) {
      errors.wif_not_valid = false;
    }
    // §5.2 — the memo is encrypted under the account's wallet password (non-empty).
    errors.wallet_password_required = !newState.password || newState.password === '';
    return errors;
  };

  const errors = validate({ wif, public: publicKey, password });

  const hasErrors = !!Object.keys(errors).filter((error) => errors[error]).length;

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const { addMemoKey } = props.actions;
    addMemoKey(account, wif, password);
  };

  const messages = {
    wif_error_invalid: 'They WIF Private Key you have is not valid.',
    wif_not_valid: 'The WIF Private Key does not match the memo key of this account.',
    wallet_password_required: "This account's wallet password is required to encrypt the memo key.",
  };
  let handleMethodReset: any = false;
  if (props.handleMethodReset) {
    handleMethodReset = (
      <Box ta="center" mt="md">
        <Button size="lg" color="red" onClick={props.handleMethodReset}>
          Cancel
        </Button>
      </Box>
    );
  }
  let message: any = false;
  let warning: any = false;
  if (hasErrors) {
    if (errors.wallet_password_required) {
      message = messages.wallet_password_required;
    }
    if (errors.wif_not_valid) {
      message = messages.wif_not_valid;
    }
    if (errors.wif_error_invalid) {
      message = messages.wif_error_invalid;
    }
    warning = (
      <Alert color="red" icon={<IconAlertTriangle />} mt="md">
        {message}
      </Alert>
    );
  }
  return (
    <Paper p="lg" withBorder>
      <Alert color="red" icon={<IconAlertTriangle />}>
        This feature is intended for advanced users only, please make sure you know what you&apos;re
        doing while encrypting memos. Using this feature incorrectly may cause the loss of funds
        deposited to an exchange.
      </Alert>
      <Text c="dimmed" mt="md">
        If you&apos;d like to encrypt transaction memos from this account, please add the memo
        private key associated to the specified account:
      </Text>
      <Divider my="md" variant="dashed" />
      <form>
        <Grid columns={16}>
          <Grid.Col span={16}>
            <TextInput label="Account Name" name="account" value={account} readOnly />
            <TextInput label="Public Memo Key" name="public" value={publicKey} readOnly mt="sm" />
            <PasswordInput
              label="WIF Memo Private Key"
              name="wif"
              value={wif}
              onChange={(e) => setWif(e.currentTarget.value)}
              mt="sm"
            />
            <PasswordInput
              label="Wallet Password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              mt="sm"
            />
          </Grid.Col>
        </Grid>
        {warning}
        <Divider my="md" />
        <Button disabled={hasErrors} fullWidth size="lg" color="green" onClick={handleSubmit}>
          Add Memo Key
        </Button>
        {handleMethodReset}
      </form>
    </Paper>
  );
};

export default KeysMemo;
