import React, { useMemo, useState } from 'react';
import _ from 'lodash';
import { Badge, Box, Button, Group, Loader, Paper, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

import { generateMnemonic12, mnemonicToSeedHex } from '../../utils/mnemonic';
import { hiveApi, hiveAuth } from '../../utils/hiveApi';

export default function KeysGenerate(props: any) {
  const [requestedName, setRequestedName] = useState<any>(false);
  const [usernameAvailable, setUsernameAvailable] = useState<any>(false);
  const [checkingUsername, setCheckingUsername] = useState<any>(false);
  const [mnemonic, setMnemonic] = useState<any>(false);
  const [pub, setPub] = useState<any>(undefined);
  const [prv, setPrv] = useState<any>(undefined);

  const checkUsername = useMemo(
    () =>
      _.debounce((value: string) => {
        const name = value.trim();
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
      }, 500),
    []
  );

  const generateSeed = () => {
    const newMnemonic = generateMnemonic12();
    const name = requestedName;
    const password = mnemonicToSeedHex(newMnemonic);
    const types = ['owner', 'active', 'posting', 'memo'];
    const newPub = hiveAuth.generateKeys(name, password, types);
    const newPrv = hiveAuth.getPrivateKeys(name, password, types);
    setMnemonic(newMnemonic);
    setPub(newPub);
    setPrv(newPrv);
  };

  function setClipboardText(text: any) {
    const id = 'mycustom-clipboard-textarea-hidden-id';
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

  let sharable = {};
  let privatekeys: any = {};
  if (requestedName && pub) {
    sharable = {
      account: requestedName,
      public_keys: pub,
    };
    privatekeys = {
      account: requestedName,
      keys: prv,
    };
  }

  const statusColor = checkingUsername ? 'teal' : usernameAvailable ? 'green' : 'red';
  const statusLabel = checkingUsername ? 'Checking' : usernameAvailable ? 'Available' : 'Taken';
  const statusIcon = checkingUsername ? (
    <Loader size={12} color="white" />
  ) : usernameAvailable ? (
    <IconCheck size={12} />
  ) : (
    <IconX size={12} />
  );

  return (
    <div>
      <Title order={1}>Experimental - Generating Keys</Title>
      <Text c="dimmed" size="lg" mb="md">
        This feature is for advanced users with a deep understanding of Hive.
      </Text>
      <p>Create a new set of public and private keys for a new Hive account.</p>
      <p>
        This is a multi-step process and requires either using a service or knowing another user to
        complete.
      </p>
      <ul>
        <li>Using Vessel, generate mnemonic phrase along with a set of keys.</li>
        <li>
          Send the <strong>Public Key JSON</strong> to a service or user for account creation.
        </li>
        <li>
          Once the account has been created, use your mnemonic seed to load the wallet with your
          key.
        </li>
      </ul>
      <Paper p="md" withBorder>
        <p>
          In order to generate a set of keys, please specify the username they will be associated
          to. These keys will only work with the specified account. If the username is already
          taken, you will have to generate a new set of keys.
        </p>
        <Group gap="xs" align="center" wrap="nowrap">
          <TextInput
            name="username"
            style={{ flex: 1 }}
            onChange={(e) => checkUsername(e.currentTarget.value)}
          />
          <Badge color={statusColor} size="lg" leftSection={statusIcon}>
            {statusLabel}
          </Badge>
        </Group>
      </Paper>
      <Box py="md">
        <Button color="green" onClick={generateSeed} disabled={!usernameAvailable}>
          Generate Seed + Keys
        </Button>
      </Box>
      <Paper p="md" withBorder>
        <Title order={3}>Generated Seed</Title>
        <Text c="dimmed" size="sm" mb="sm">
          WRITE THIS DOWN. This series of words is your backup to restore your wallet.
        </Text>
        <Paper p="md" withBorder>
          {mnemonic}
        </Paper>
        <Button
          color="green"
          mt="sm"
          onClick={() => setClipboardText(mnemonic)}
          disabled={!mnemonic}
        >
          Copy to clipboard
        </Button>
      </Paper>
      <Paper p="md" withBorder mt="md">
        <Title order={3}>Public Key JSON</Title>
        <Text c="dimmed" size="sm" mb="sm">
          Give this information to the person or service who is creating your account.
        </Text>
        <Paper p="md" withBorder>
          <pre>{JSON.stringify(sharable, null, 2)}</pre>
        </Paper>
        <Button
          color="green"
          mt="sm"
          onClick={() => setClipboardText(JSON.stringify(sharable, null, 2))}
          disabled={!mnemonic}
        >
          Copy to clipboard
        </Button>
      </Paper>
      <Paper p="md" withBorder mt="md">
        <Title order={3}>Key Backup JSON</Title>
        <Text c="dimmed" size="sm" mb="sm">
          NEVER share these keys with anyone and back them up to a safe place.
        </Text>
        <Paper p="md" withBorder>
          <pre>{JSON.stringify(privatekeys, null, 2)}</pre>
        </Paper>
        <Button
          color="green"
          mt="sm"
          onClick={() => setClipboardText(JSON.stringify(privatekeys, null, 2))}
          disabled={!mnemonic}
        >
          Copy to clipboard
        </Button>
      </Paper>
      <Box py="md" ta="center">
        <Button size="lg" color="red" onClick={props.handleMethodReset}>
          Close
        </Button>
      </Box>
    </div>
  );
}
