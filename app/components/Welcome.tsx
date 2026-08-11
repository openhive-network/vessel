import React from 'react';

import { Box, Grid, Paper, Title, Text } from '@mantine/core';

import KeysAdd from './Keys/Add';
import PreferredNode from './global/PreferredNode';
import logo from '../img/hive.png';

const Welcome: React.FC<any> = (props) => {
  return (
    <Grid columns={16}>
      <Grid.Col span={5}>
        <Box
          p="md"
          ta="center"
          style={{
            // NB: the original had a typo'd `alignitems` key that the browser ignored, so the
            // effective align-items was the flex default (stretch). Omit it to keep that rendering.
            display: 'flex',
            justifyContent: 'center',
            flexFlow: 'column',
            maxHeight: '100vh',
          }}
        >
          <img
            alt="logo"
            src={logo}
            style={{
              width: '80px', // was Semantic's "ui tiny image" (80px); inlined now that Semantic CSS is gone
              margin: '-1em auto 1em',
            }}
          />
          <Title order={2} style={{ marginTop: '0px' }}>
            Vessel
          </Title>
          <Text c="dimmed" size="sm">
            Your Desktop Wallet for Hive
          </Text>
        </Box>
      </Grid.Col>
      <Grid.Col span={11}>
        <Box p="md">
          <Paper withBorder p="md" radius="md">
            <Title order={3}>Getting Started</Title>
            <Text c="dimmed" size="sm" mb="sm">
              To get started with Vessel, an account must be added to the wallet.
            </Text>

            <KeysAdd {...props} />
            <PreferredNode {...props} />
          </Paper>
        </Box>
      </Grid.Col>
    </Grid>
  );
};

export default Welcome;
