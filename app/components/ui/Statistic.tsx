import React from 'react';
import { SimpleGrid, Stack, Text } from '@mantine/core';

/** Row of centered stats. `cols` mirrors Semantic <Statistic.Group widths>. */
export const StatGroup: React.FC<{ cols?: number; children: React.ReactNode }> = ({
  cols = 4,
  children,
}) => (
  <SimpleGrid cols={{ base: 2, sm: cols }} spacing="lg">
    {children}
  </SimpleGrid>
);

/** One stat: big value on top, dimmed uppercase label below (Semantic <Statistic> look). */
export const Statistic: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <Stack gap={2} align="center">
    <Text fw={700} fz={28} ta="center" lh={1.1}>
      {value}
    </Text>
    <Text size="sm" c="dimmed" tt="uppercase" ta="center">
      {label}
    </Text>
  </Stack>
);
