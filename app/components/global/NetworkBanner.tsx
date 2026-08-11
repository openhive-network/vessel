import React from 'react';
import { Box, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useAppSelector } from '../../hooks/redux';

/**
 * A prominent, always-visible banner shown whenever the wallet is NOT connected to Hive mainnet — i.e.
 * the node's detected network (set by refreshGlobalProps from the chain_id / virtual_supply) is
 * "Hive Mirrornet", "Hive Testnet", or "Unknown". Mainnet ("Hive") shows nothing. This makes it
 * impossible to miss that you're broadcasting against a test chain. It spans the content area (right of
 * the fixed 92px nav rail) so it never hides the nav.
 */
const NetworkBanner: React.FC = () => {
  const network = useAppSelector((state) => state.hive?.props?.network);
  if (!network || network === 'Hive') return null;

  const isTestnet = /testnet/i.test(network);
  return (
    <Box
      bg={isTestnet ? 'red.7' : 'orange.7'}
      c="white"
      py={6}
      px="md"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 500,
        marginLeft: '92px', // clear the fixed nav rail
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <IconAlertTriangle size={18} />
      <Text fw={700} size="sm" style={{ letterSpacing: 0.5 }}>
        {network.toUpperCase()} — you are not on Hive mainnet. Transactions are broadcast to a test chain.
      </Text>
    </Box>
  );
};

export default NetworkBanner;
