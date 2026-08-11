import React, { useState } from 'react';

import { Button, Paper, Stack, Title, Text } from '@mantine/core';
import { IconKey, IconFileImport, IconWand } from '@tabler/icons-react';

import KeysGenerate from './Generate';
import KeysImport from './Import';
import KeysLogin from './Login';
import KeysCreate from './Create';

const Add: React.FC<any> = (props) => {
  const [importMethod, setImportMethod] = useState<any>(false);

  const handleMethodChange = (_e: any, value: any) => setImportMethod(value);

  const handleMethodReset = (_e?: any, _props?: any) => setImportMethod(false);

  let display = (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">
          I have a password
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          Choose this option if your account was created with a password.
        </Text>
        <Button
          color="green"
          size="lg"
          leftSection={<IconKey size={18} />}
          onClick={(e) => handleMethodChange(e, 'login-hive')}
        >
          Import Account with Password
        </Button>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">
          Specific Private Key
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          Choose this option if you want to import only a specific key. Possible keys: Posting,
          Active, Owner, Memo.
        </Text>
        <Button
          color="green"
          size="lg"
          leftSection={<IconFileImport size={18} />}
          onClick={(e) => handleMethodChange(e, 'import-private-key')}
        >
          Import Private Key
        </Button>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">
          Experimental: Generate New Private Keys
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          For advanced users. Create a new set of public and private keys for a new Hive account.
          These <strong>public</strong> keys can then be given to another user or service allowing
          the creation of an account.
        </Text>
        <Button
          color="dark"
          size="lg"
          leftSection={<IconWand size={18} />}
          onClick={(e) => handleMethodChange(e, 'generate-private-key')}
        >
          Generate new private keys
        </Button>
      </Paper>
    </Stack>
  );
  switch (importMethod) {
    case 'import-private-key':
      display = <KeysImport handleMethodReset={handleMethodReset} {...props} />;
      break;
    case 'login-hive':
      display = <KeysLogin handleMethodReset={handleMethodReset} {...props} />;
      break;
    case 'generate-private-key':
      display = <KeysGenerate handleMethodReset={handleMethodReset} {...props} />;
      break;
    default: {
      break;
    }
  }
  return display;
};

export default Add;
