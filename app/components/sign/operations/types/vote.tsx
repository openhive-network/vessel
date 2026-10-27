import React from 'react';

import { Box, Grid, Paper, Text, Title } from '@mantine/core';
import { IconThumbUp } from '@tabler/icons-react';

import AccountAvatar from '../../../global/AccountAvatar';
import AccountName from '../../../global/AccountName';
import PostLink from '../../../global/PostLink';

const OperationsPromptVote: React.FC<any> = (props) => {
  const { opData } = props;
  const avatar_author = <AccountAvatar name={opData.author} />;
  const avatar_voter = <AccountAvatar name={opData.voter} />;
  return (
    <Paper withBorder p="md" radius={0}>
      <Grid columns={16}>
        <Grid.Col span={5}>
          <Box ta="center">
            {avatar_voter}
            <Title order={3} m={0}>
              {opData.voter ? <AccountName name={opData.voter} /> : '<sender>'}
            </Title>
          </Box>
        </Grid.Col>
        <Grid.Col span={6}>
          <Box ta="center">
            <IconThumbUp size={48} color="green" style={{ margin: '0.25em 0' }} />
            <Title order={3} c="green" m={0}>
              {(opData.weight / 100).toFixed(2)}%
            </Title>
          </Box>
        </Grid.Col>
        <Grid.Col span={5}>
          <Box ta="center">
            {avatar_author}
            <Title order={3} m={0}>
              <AccountName name={opData.author} />
            </Title>
          </Box>
        </Grid.Col>
      </Grid>
      <Box mt="md">
        <Title order={4}>Voting on:</Title>
        <Text size="sm" c="dimmed">
          <PostLink author={opData.author} permlink={opData.permlink} />
        </Text>
      </Box>
    </Paper>
  );
};

export default OperationsPromptVote;
