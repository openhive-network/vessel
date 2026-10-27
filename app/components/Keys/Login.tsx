import React from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  LoadingOverlay,
  PasswordInput,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import KeysConfirm from './Confirm';
import { hiveAuth } from '../../utils/hiveApi';

const permissionOptions = [
  {
    key: 'owner',
    text: 'Owner',
    value: 'owner',
  },
  {
    key: 'active',
    text: 'Active',
    value: 'active',
  },
  {
    key: 'posting',
    text: 'Posting',
    value: 'posting',
  },
];

const permissionData = permissionOptions.map((o) => ({ value: o.value, label: o.text }));

// FROZEN — validate() rules unchanged (§5.1 — password mandatory + match, account required).
const validate = (newState: any) => {
  const errors: any = {};
  const { lock1, lock2 } = newState;
  // Password is now mandatory (§5.1 — no unencrypted opt-out).
  errors.password_error_not_set = !lock1 || !lock2 || lock1 === '' || lock2 === '';
  errors.password_error_no_match = lock1 !== lock2;
  errors.account_name_required = !newState.account || newState.account === '';
  return errors;
};

export default function KeysLogin(props: any) {
  const [account, setAccount] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [permission, setPermission] = React.useState('active');
  const [lock1, setLock1] = React.useState('');
  const [lock2, setLock2] = React.useState('');

  const errors = validate({ account, lock1, lock2 });
  const hasErrors = !!Object.keys(errors).filter((error) => errors[error]).length;

  // FROZEN — Confirm.tsx still supplies (e, data) via Semantic Button onClick; keep signature.
  const handleConfirmAction = (e: any, data: any) => {
    const confirmed = data.value;
    e.preventDefault();
    if (confirmed) {
      const { addKeyConfirmed } = props.actions;
      const keys = hiveAuth.getPrivateKeys(account, password, [permission]);
      const wif = keys[permission];
      // §5.1 — the wallet password is mandatory; the key is always encrypted.
      addKeyConfirmed(account, wif, permission, lock1);
    } else {
      props.actions.addKeyCancel();
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const { addKey } = props.actions;
    const keys = hiveAuth.getPrivateKeys(account, password, [permission]);
    const wif = keys[permission];
    addKey(account, wif);
  };

  const confirmAccount = props.keys.confirm;
  if (confirmAccount) {
    return <KeysConfirm handleConfirmAction={handleConfirmAction} encryptWallet {...props} />;
  }

  const messages = {
    account_name_required: 'An existing account name is required.',
    password_error_not_set: 'You must set a wallet password to encrypt your keys.',
    password_error_no_match: 'The passwords you have entered do not match.',
    wif_error_invalid: 'They WIF Private Key you have entered is invalid.',
  };

  let message: any = false;
  if (hasErrors || props.keys.lastError) {
    if (props.keys.lastError) {
      message = props.keys.lastError;
    }
    if (errors.password_error_not_set) {
      message = messages.password_error_not_set;
    }
    if (errors.password_error_no_match) {
      message = messages.password_error_no_match;
    }
    if (errors.wif_error_invalid) {
      message = messages.wif_error_invalid;
    }
    if (errors.account_name_required) {
      message = messages.account_name_required;
    }
  }

  return (
    <Box pos="relative">
      <LoadingOverlay visible={props.processing.account_loading} />
      <Grid columns={16} gutter="lg">
        <Grid.Col span={{ base: 16, sm: 8 }}>
          <Stack gap="sm">
            <TextInput
              label="Hive Account Name"
              name="account"
              value={account}
              onChange={(e) => setAccount(e.currentTarget.value)}
            />
            <PasswordInput
              label="Hive Password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Select
              name="permission"
              value={permission}
              label="Permissions for Wallet"
              data={permissionData}
              onChange={(value) => value && setPermission(value)}
              placeholder="Specify permission for this wallet..."
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 16, sm: 8 }}>
          <Stack gap="sm">
            <PasswordInput
              label="Wallet Password"
              name="lock1"
              value={lock1}
              onChange={(e) => setLock1(e.currentTarget.value)}
            />
            <PasswordInput
              label="Wallet Password (Repeat)"
              name="lock2"
              value={lock2}
              onChange={(e) => setLock2(e.currentTarget.value)}
            />
            <Alert color="blue" icon={<IconInfoCircle size={18} />} title="Notice about Encryption">
              The wallet password if only used to unlock Vessel during transactions. If you lose your
              password, you will be unable to recover your keys. Please make sure to back up your keys
              and remember your password.
            </Alert>
          </Stack>
        </Grid.Col>
      </Grid>
      <Divider my="lg" />
      {(hasErrors || props.keys.lastError) && message ? (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} mb="md">
          {message}
        </Alert>
      ) : null}
      <Button disabled={hasErrors} fullWidth size="lg" color="green" onClick={handleSubmit}>
        Add to Wallet
      </Button>
      {props.handleMethodReset ? (
        <Box ta="center" mt="md">
          <Button size="lg" color="red" onClick={props.handleMethodReset}>
            Cancel
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
