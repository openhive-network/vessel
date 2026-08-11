import React, { useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  List,
  LoadingOverlay,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconAsterisk, IconCheck, IconCopy, IconX } from '@tabler/icons-react';

import { generateMnemonic12, mnemonicToSeedHex } from '../../utils/mnemonic';
import { hiveApi, hiveAuth } from '../../utils/hiveApi';

export default function KeysCreate(props: any) {
  const [requestedName, setRequestedName] = useState<any>(false);
  const [requestedOwner, setRequestedOwner] = useState<any>(false);
  const [usernameAvailable, setUsernameAvailable] = useState<any>(false);
  const [mnemonic, setMnemonic] = useState<any>(false);
  // requestedFundingMethod retained (checkFundingMethod frozen) though not rendered.
  const [, setRequestedFundingMethod] = useState<any>(false);
  const [modalPreview, setModalPreview] = useState<any>(false);
  const [lock1, setLock1] = useState<any>('');
  const [lock2, setLock2] = useState<any>('');
  const [checkingUsername, setCheckingUsername] = useState<any>(false);
  const [, setCheckingOwner] = useState<any>(false);
  const [ownerAvailable, setOwnerAvailable] = useState<any>(false);
  const [pub, setPub] = useState<any>(undefined);
  const [prv, setPrv] = useState<any>(undefined);
  const [password, setPassword] = useState<any>(undefined);

  // FROZEN — debounced availability check (this.setState -> setters only).
  const checkUsername = useRef(
    _.debounce((e: any, inputProps: any) => {
      const name = inputProps.value.trim();
      if (name === '') {
        setCheckingUsername(false);
        setRequestedName(false);
        setUsernameAvailable(false);
        return;
      }
      setCheckingUsername(true);
      hiveApi.getAccounts([name]).then(
        (results) => {
          setCheckingUsername(false);
          setRequestedName(!results.length ? name : false);
          setUsernameAvailable(!results.length);
        },
        () => {
          setCheckingUsername(false);
          setRequestedName(false);
          setUsernameAvailable(false);
        }
      );
    }, 500)
  ).current;

  // FROZEN — debounced owner check (this.setState -> setters only).
  const checkOwner = useRef(
    _.debounce((e: any, inputProps: any) => {
      const name = inputProps.value.trim();
      if (name === '') {
        setCheckingOwner(false);
        setRequestedOwner(false);
        setOwnerAvailable(false);
        return;
      }
      setCheckingOwner(true);
      setCheckingOwner(false);
      setRequestedOwner(name);
      setOwnerAvailable(true);
    }, 500)
  ).current;

  // FROZEN — retained verbatim (unused by render, kept per freeze rule).
  const checkFundingMethod = useRef(
    _.debounce((e: any, inputProps: any) => {
      const fundingMethod = inputProps.value.trim();
      setRequestedFundingMethod(fundingMethod);
    }, 500)
  ).current;
  void checkFundingMethod;

  // FROZEN — key derivation (generateMnemonic12/mnemonicToSeedHex/getPrivateKeys/generateKeys + P-master).
  const generateSeed = () => {
    const nextMnemonic = generateMnemonic12();
    const name = requestedName;
    const seed = mnemonicToSeedHex(nextMnemonic);
    const masterKey = hiveAuth.getPrivateKeys(name, seed, ['master']);
    const nextPassword = `P${masterKey.master}`;
    const types = ['owner', 'active', 'posting', 'memo'];
    const nextPub = hiveAuth.generateKeys(name, nextPassword, types);
    const nextPrv = hiveAuth.getPrivateKeys(name, nextPassword, types);
    setMnemonic(nextMnemonic);
    setPub(nextPub);
    setPrv(nextPrv);
    setPassword(nextPassword);
  };

  const createAccount = () => {
    generateSeed();
    props.actions.processingAccountCreateCancel();
    setModalPreview(true);
  };

  const handleCancel = (e: any) => {
    setModalPreview(false);
    if (e && e.preventDefault) e.preventDefault();
  };

  // componentWillReceiveProps(account_create_resolved) -> useEffect on the flag.
  // useRef seed so it fires on the truthy transition, not on mount.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (props.processing.account_create_resolved) {
      const { addKeyConfirmed } = props.actions;
      // §5.1 — encrypt the freshly created account's active key under the wallet password.
      addKeyConfirmed(requestedName, prv.active, 'active', lock1);
      setModalPreview(false);
      setLock1('');
      setLock2('');
      props.handleMethodReset();
      props.actions.processingAccountCreateCancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.processing.account_create_resolved]);

  const handleConfirm = (e: any) => {
    e.preventDefault();
    // Wallet password must be set and matching before the account is created (§5.1).
    if (!lock1 || lock1 !== lock2) return;
    const { useKey } = props.actions;
    const creatorKey = props.keys.permissions[requestedOwner];
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useKey(
      'createAccountDelegated',
      {
        creator: requestedOwner,
        username: requestedName,
        password,
      },
      creatorKey
    );
  };

  let modal: any = false;
  const { keys } = props;
  const errorMessage =
    props.processing && props.processing.account_create_error ? (
      <Alert color="red" icon={<IconAlertTriangle size={18} />} mt="md">
        {props.processing.account_create_error}
      </Alert>
    ) : null;

  const availableOwner = keys.names.map((name: any) => {
    const hasPermission =
      keys.permissions[name].type === 'active' || keys.permissions[name].type === 'owner';
    return hasPermission
      ? { value: name, label: name }
      : {
          value: name,
          label: `${name} (unavailable - active/owner key not loaded)`,
          disabled: true,
        };
  });

  function setClipboardText(text: any) {
    const id = 'vessel-clipboard-textarea-hidden-id';
    let existsTextarea: any = document.getElementById(id);

    if (!existsTextarea) {
      const textarea: any = document.createElement('textarea');
      textarea.id = id;
      // Place in top-left corner of screen regardless of scroll position.
      textarea.style.position = 'fixed';
      textarea.style.top = 0;
      textarea.style.left = 0;

      // Ensure it has a small width and height. Setting to 1px / 1em
      // doesn't work as this gives a negative w/h on some browsers.
      textarea.style.width = '1px';
      textarea.style.height = '1px';

      // We don't need padding, reducing the size if it does flash render.
      textarea.style.padding = 0;

      // Clean up any borders.
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';

      // Avoid flash of white box if rendered for any reason.
      textarea.style.background = 'transparent';
      document.querySelector('body')!.appendChild(textarea);
      existsTextarea = document.getElementById(id);
    }
    existsTextarea.value = text;
    existsTextarea.select();
    try {
      const status = document.execCommand('copy');
      if (!status) {
        console.error('Cannot copy text');
      } else {
        // no-op (copy succeeded)
      }
    } catch (err) {
      // ignore copy failures
    }
  }

  let privatekeys: any = {};
  if (requestedName && pub) {
    privatekeys = {
      account: requestedName,
      keys: (({ owner, active, posting, memo }) => ({ owner, active, posting, memo }))(prv),
    };
  }
  let delegation: any = {};
  if (props.account && props.account.minimumDelegation) {
    delegation = props.account.minimumDelegation;
  }
  const passwordValid = !!lock1 && lock1 === lock2;

  if (modalPreview && delegation) {
    modal = (
      <Modal
        opened
        onClose={() => handleCancel(undefined)}
        title="Please backup the information below and then confirm the new account."
        size="xl"
        withCloseButton={false}
        closeOnEscape={false}
        closeOnClickOutside={false}
      >
        <Box pos="relative" p="md">
          <LoadingOverlay visible={props.processing.account_create_pending} />
          <Grid columns={16}>
            <Grid.Col span={9}>
              <Box>
                <Title order={3}>Final Step - Account not yet created</Title>
                <Text mt="xs">
                  Ensure that all of the data below looks correct before continuing. If everything
                  looks good, click <strong>Create Account</strong> at the bottom of this window.
                </Text>
              </Box>
            </Grid.Col>
            <Grid.Col span={7}>
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td ta="right">Originating Account:</Table.Td>
                    <Table.Td>{requestedOwner}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td ta="right">New Account:</Table.Td>
                    <Table.Td>{requestedName}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Grid.Col>
            <Grid.Col span={16}>
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={4}>New Account Password</Title>
                  <Text size="sm" c="dimmed">
                    WRITE THIS DOWN (or save in a password manager). This password will allow you to
                    log into any Hive related service with full permissions. Use the posting private
                    key if you only wish to grant posting permissions.
                  </Text>
                </Box>
                <Button
                  color="green"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => setClipboardText(password)}
                  disabled={!mnemonic}
                >
                  Copy to clipboard
                </Button>
              </Group>
              <Paper withBorder p="sm" mt="xs">
                {password}
              </Paper>
            </Grid.Col>
            <Grid.Col span={16}>
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={4}>Key Backup JSON</Title>
                  <Text size="sm" c="dimmed">
                    NEVER share these keys with anyone and back them up to a safe place.
                  </Text>
                </Box>
                <Button
                  color="green"
                  leftSection={<IconCopy size={16} />}
                  onClick={() => setClipboardText(JSON.stringify(privatekeys, null, 2))}
                  disabled={!mnemonic}
                >
                  Copy to clipboard
                </Button>
              </Group>
              <Paper withBorder p="sm" mt="xs">
                <pre style={{ margin: 0 }}>{JSON.stringify(privatekeys, null, 2)}</pre>
              </Paper>
            </Grid.Col>
            <Grid.Col span={16}>
              <Box>
                <Title order={4}>Wallet Password</Title>
                <Text size="sm" c="dimmed">
                  Set a password to encrypt this account&apos;s active key inside Vessel. You will
                  enter it to sign transactions from this wallet.
                </Text>
              </Box>
              <PasswordInput
                label="Wallet Password"
                name="lock1"
                value={lock1}
                onChange={(e) => setLock1(e.currentTarget.value)}
                mt="xs"
              />
              <PasswordInput
                label="Wallet Password (Repeat)"
                name="lock2"
                value={lock2}
                onChange={(e) => setLock2(e.currentTarget.value)}
                mt="xs"
              />
              {lock1 && lock2 && lock1 !== lock2 ? (
                <Alert color="red" icon={<IconAlertTriangle size={18} />} mt="xs">
                  The passwords you have entered do not match.
                </Alert>
              ) : null}
            </Grid.Col>
            <Grid.Col span={16}>
              <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Ready to create?">
                Ensure the steps above are completed and the data above has been copied elsewhere.
                The data displayed here can never be retrieved through Vessel again.
              </Alert>
            </Grid.Col>
          </Grid>
          {errorMessage}
        </Box>
        <Group justify="space-between" mt="md">
          <Button color="red" leftSection={<IconX size={16} />} onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            color="green"
            leftSection={<IconCheck size={16} />}
            disabled={!passwordValid}
            onClick={handleConfirm}
          >
            Confirmed - Create Account
          </Button>
        </Group>
      </Modal>
    );
  }

  const usernameBadgeColor = checkingUsername ? 'teal' : usernameAvailable ? 'green' : 'red';
  const usernameBadgeIcon = checkingUsername ? (
    <IconAsterisk size={12} />
  ) : usernameAvailable ? (
    <IconCheck size={12} />
  ) : (
    <IconX size={12} />
  );
  const usernameBadgeText = checkingUsername
    ? 'Checking'
    : usernameAvailable
      ? 'Available'
      : 'Taken';

  return (
    <div>
      <Box mb="md">
        <Title order={1}>Create New Account</Title>
        <Text c="dimmed">This feature is under development. Use at your own risk.</Text>
      </Box>
      <Grid columns={16} gutter="lg">
        <Grid.Col span={7}>
          <Alert color="red" title="New accounts require initial funds">
            <Text>
              New accounts require funding in order to be created, which is transfered from the
              originating account. Currently to create an account, you must fund it initially with a
              minimum of:
            </Text>
            <List mt="xs">
              <List.Item>HIVE: {delegation.fee.amount}</List.Item>
              <List.Item>
                VESTS: {delegation.delegation.amount.toFixed(6)} (~
                {delegation.sp.amount.toFixed(3)} HP)
              </List.Item>
            </List>
          </Alert>
          <Title order={4} mt="md">
            Next steps...
          </Title>
          <List mt="xs">
            <List.Item>Enter an account name to see if it is available.</List.Item>
            <List.Item>
              Click <strong>Generate Account</strong> to create the password and keys, while
              reviewing it&apos;s information.
            </List.Item>
            <List.Item>
              If everything looks good, click <strong>Create</strong> to submit the details to the
              blockchain, as well as funding it&apos;s initial balance.
            </List.Item>
            <List.Item>
              Once the account has been created, it will be automatically imported into Vessel, and
              you can use either the <strong>Master Password</strong> or the{' '}
              <strong>Posting Private Key</strong> to log into any Hive Powered website.
            </List.Item>
          </List>
        </Grid.Col>
        <Grid.Col span={9}>
          <Box>
            <Text>Select the originating account, which will fund the new account.</Text>
            <Select
              value={requestedOwner || null}
              name="owner"
              label="Select the owner account"
              data={availableOwner}
              placeholder="Owner Account..."
              onChange={(value) => checkOwner(null, { value: value || '' })}
              mt="xs"
            />
          </Box>
          <Box mt="md">
            <Text>Specify a name for the new account.</Text>
            <TextInput
              name="username"
              placeholder="account name"
              onChange={(e) => checkUsername(null, { value: e.currentTarget.value })}
              mt="xs"
              rightSectionWidth={110}
              rightSection={
                <Badge color={usernameBadgeColor} leftSection={usernameBadgeIcon} variant="filled">
                  {usernameBadgeText}
                </Badge>
              }
            />
          </Box>
          <Box mt="md">
            <Button
              size="md"
              color="dark"
              onClick={createAccount}
              disabled={!(usernameAvailable && ownerAvailable)}
            >
              Create Account
            </Button>
          </Box>
        </Grid.Col>
      </Grid>
      <Box ta="center" mt="md">
        <Button size="md" color="red" onClick={props.handleMethodReset}>
          Close
        </Button>
      </Box>
      {modal}
    </div>
  );
}
