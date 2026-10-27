import React from 'react';

import { useForm } from '@mantine/form';
import { Button, Grid, Paper, Text, TextInput, Title } from '@mantine/core';

// formsy `validations="isUrl"` is NON-required: an empty field is valid, and submitting empty
// clears the node (routes.tsx then resolves the empty value to the api.hive.blog default) — so we
// return null for empty to preserve that reset path. A non-empty value must be an http(s) URL,
// matching the field's own error copy. This is the blessed reference validator for later forms:
// optional fields short-circuit on empty, required ones drop the `v === ''` early return.
const validateNodeUrl = (value: string): string | null => {
  const v = (value ?? '').trim();
  if (v === '') return null;
  return /^https?:\/\/.+/i.test(v)
    ? null
    : 'Requires a valid URL starting with http:// or https://';
};

const PreferredNode: React.FC<any> = ({ actions, preferences }) => {
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { hived_node: preferences.hived_node ?? '' },
    validate: { hived_node: validateNodeUrl },
    validateInputOnChange: true, // mirrors formsy `instantValidation`
  });

  return (
    <form
      onSubmit={form.onSubmit((values) => actions.setPreference('hived_node', values.hived_node))}
    >
      <Title order={3}>Preferred Hive Node</Title>
      <Text c="dimmed" size="sm" mb="sm">
        Configure which Hive node your wallet connects to in order to broadcast transactions.
      </Text>
      <Paper withBorder p="md" radius="md">
        <Grid columns={16} align="flex-end">
          <Grid.Col span={9}>
            <TextInput
              label="Hive RPC Node"
              key={form.key('hived_node')}
              {...form.getInputProps('hived_node')}
            />
          </Grid.Col>
          <Grid.Col span={7}>
            <Text size="sm" mb={4}>
              Currently: {preferences.hived_node}
            </Text>
            <Button type="submit" color="blue">
              Update
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>
    </form>
  );
};

export default PreferredNode;
