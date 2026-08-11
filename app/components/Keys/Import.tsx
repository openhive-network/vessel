import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  LoadingOverlay,
  PasswordInput,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import KeysConfirm from './Confirm';
import { hiveAuth } from '../../utils/hiveApi';

export default function KeysImport(props: any) {
  const validate = (newState) => {
    const errors: any = {};
    const { lock1, lock2 } = newState;
    // Password is now mandatory (§5.1 — no unencrypted opt-out).
    errors.password_error_not_set = !lock1 || !lock2 || lock1 === '' || lock2 === '';
    errors.password_error_no_match = lock1 !== lock2;
    errors.account_name_required = !newState.account || newState.account === '';
    errors.wif_error_invalid = !hiveAuth.isWif(newState.wif);
    return errors;
  };

  const [account, setAccount] = useState('');
  const [wif, setWif] = useState('');
  const [lock1, setLock1] = useState('');
  const [lock2, setLock2] = useState('');
  const [errors, setErrors] = useState<any>(() =>
    validate({ account: '', wif: '', lock1: '', lock2: '' })
  );

  const setters: any = { account: setAccount, wif: setWif, lock1: setLock1, lock2: setLock2 };

  const handleConfirmAction = (e: any, data: any) => {
    const confirmed = data.value;
    e.preventDefault();
    if (confirmed) {
      const { addKeyConfirmed } = props.actions;
      const { active, owner } = props.keys.confirm;
      const type = owner ? 'owner' : active ? 'active' : 'posting';
      // §5.1 — the wallet password is mandatory; the key is always encrypted.
      addKeyConfirmed(account, wif, type, lock1);
    } else {
      props.actions.addKeyCancel();
    }
  };

  const handleChange = (name: string, value: any) => {
    const newState = { account, wif, lock1, lock2, [name]: value };
    setters[name](value);
    setErrors(validate(newState));
  };

  const hasErrors = () => {
    return !!Object.keys(errors).filter((error) => errors[error]).length;
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const { addKey } = props.actions;
    addKey(account, wif);
  };

  const confirmAccount = props.keys.confirm;
  const errored = hasErrors();
  const messages = {
    account_name_required: 'An existing account name is required.',
    password_error_not_set: 'You must set a wallet password to encrypt your keys.',
    password_error_no_match: 'The passwords you have entered do not match.',
    wif_error_invalid: 'They WIF Private Key you have entered is invalid.',
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
  const encryptionWarning = (
    <Alert
      color="blue"
      icon={<IconInfoCircle size={18} />}
      title="Notice about Encryption"
      mt="md"
    >
      The wallet password if only used to unlock Vessel during transactions. If you lose your
      password, you will be unable to recover your keys. Please make sure to back up your keys and
      remember your password.
    </Alert>
  );
  let message: any = false;
  let warning: any = false;
  if (errored || props.keys.lastError) {
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
    warning = (
      <Alert color="red" icon={<IconAlertTriangle size={18} />} mt="md">
        {message}
      </Alert>
    );
  }
  const passwordInput = (
    <div>
      <PasswordInput
        label="Wallet Password"
        name="lock1"
        value={lock1}
        onChange={(e) => handleChange('lock1', e.currentTarget.value)}
      />
      <PasswordInput
        label="Wallet Password (Repeat)"
        name="lock2"
        value={lock2}
        mt="sm"
        onChange={(e) => handleChange('lock2', e.currentTarget.value)}
      />
    </div>
  );
  let display = (
    <div>
      <Text c="dimmed">
        Enter an account name and a WIF private key for the account you would like to add. Different
        permissions will be granted to this wallet based on the type of key used.
      </Text>
      <Box pos="relative" mt="md">
        <LoadingOverlay visible={props.processing.account_loading} />
        <Grid columns={16} gutter="lg">
          <Grid.Col span={8}>
            <TextInput
              label="Account Name"
              name="account"
              value={account}
              onChange={(e) => handleChange('account', e.currentTarget.value)}
            />
            <PasswordInput
              label="WIF Private Key (posting, active or owner)"
              name="wif"
              value={wif}
              mt="sm"
              onChange={(e) => handleChange('wif', e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={8}>
            {passwordInput}
            {encryptionWarning}
          </Grid.Col>
        </Grid>
        <Divider my="md" />
        {warning}
        <Button
          disabled={errored}
          fullWidth
          size="lg"
          color="green"
          mt="md"
          onClick={handleSubmit}
        >
          Add to Wallet
        </Button>
        {handleMethodReset}
      </Box>
    </div>
  );
  if (confirmAccount) {
    display = (
      <KeysConfirm handleConfirmAction={handleConfirmAction} encryptWallet {...props} />
    );
  }
  return display;
}
