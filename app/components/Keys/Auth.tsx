import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Paper,
  PasswordInput,
  Radio,
  Space,
  Text,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { hiveAuth } from '../../utils/hiveApi';

// FROZEN key logic ported verbatim from the class version (this.state -> local,
// this.props -> props). No WIF is persisted or logged.
const validate = (newState: any) => {
  const errors: any = {};
  errors.wif_error_invalid = !hiveAuth.isWif(newState.wif);
  errors.wif_not_valid = true;
  if (newState.wif && hiveAuth.wifIsValid(newState.wif, newState.public) === true) {
    errors.wif_not_valid = false;
  }
  // §5.2 — the auth key is encrypted under the account's wallet password (non-empty).
  errors.wallet_password_required = !newState.password || newState.password === '';
  return errors;
};

export default function KeysAuth(props: any) {
  const publicKey = props.keys.confirmMemo.public;

  const [action, setAction] = useState<any>('add');
  const [type, setType] = useState<any>(undefined);
  const [wif] = useState<any>('');
  const [password, setPassword] = useState<any>('');
  const [errors, setErrors] = useState<any>(() =>
    validate({ action: 'add', wif: '', password: '', public: publicKey })
  );

  // handleChange (this.setState + validate) ported: rebuild the full newState so
  // validate() sees exactly the same shape it did in the class version.
  const applyChange = (name: string, value: any) => {
    const newState = { action, type, wif, password, public: publicKey, [name]: value };
    setErrors(validate(newState));
    if (name === 'action') setAction(value);
    else if (name === 'type') setType(value);
    else if (name === 'password') setPassword(value);
  };

  const hasErrors = () => !!Object.keys(errors).filter((error) => errors[error]).length;

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const { addAuth } = props.actions;
    // WIP: wire once this flow supplies the target account.
    // addAuth(account, wif, password);
  };

  const errored = hasErrors();
  const messages = {
    wif_error_invalid: 'They WIF Private Key you have is not valid.',
    wif_not_valid: 'The WIF Private Key does not match the memo key of this account.',
    wallet_password_required: "This account's wallet password is required to encrypt the key.",
  };

  let handleMethodReset: any = false;
  if (props.handleMethodReset) {
    handleMethodReset = (
      <Box ta="center" my="md">
        <Button size="lg" color="red" onClick={props.handleMethodReset}>
          Cancel
        </Button>
      </Box>
    );
  }

  let message: any = false;
  let warning: any = false;
  if (errored) {
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
      <Alert color="red" icon={<IconAlertTriangle size={18} />} mt="md">
        {message}
      </Alert>
    );
  }

  return (
    <Paper p="md">
      <Alert color="red" icon={<IconAlertTriangle size={18} />}>
        This feature is intended for advanced users only, please make sure you know what you&apos;re
        doing when changing your account auths. Mistakes can make your account inaccessible.
      </Alert>
      <Space h="md" />
      <Text c="dimmed">
        If you&apos;d like to add or remove an account or key auth, continue with the form below:
      </Text>
      <Space h="md" />
      <form>
        <Grid columns={16}>
          <Grid.Col span={16}>
            <Radio.Group
              label="Action"
              value={action}
              onChange={(value) => applyChange('action', value)}
            >
              <Radio mt="xs" value="add" label="Add" />
              <Radio mt="xs" value="remove" label="Remove" />
            </Radio.Group>
            <Space h="md" />
            <Radio.Group
              label="Type"
              value={type}
              onChange={(value) => applyChange('type', value)}
            >
              <Radio mt="xs" value="key" label="Key" />
              <Radio mt="xs" value="account" label="Account" />
            </Radio.Group>
            <Space h="md" />
            <PasswordInput
              label="Wallet Password"
              name="password"
              value={password}
              onChange={(e) => applyChange('password', e.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>
        {warning}
        <Divider my="md" />
        <Button
          disabled={errored}
          fullWidth
          size="lg"
          color="green"
          onClick={handleSubmit}
        >
          Add Memo Key
        </Button>
        {handleMethodReset}
      </form>
    </Paper>
  );
}
