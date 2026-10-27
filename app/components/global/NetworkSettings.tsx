import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCheck, IconRefresh } from '@tabler/icons-react';
import { useAppSelector } from '../../hooks/redux';
import { fetchBeaconNodes, BeaconNode } from '../../utils/hiveBeacon';

const MAINNET_DEFAULT = 'https://api.hive.blog';
// A well-known public Hive Mirrornet endpoint, so the testnet toggle works out of the box; the user
// can replace it with any test/mirror node in the field below.
const TESTNET_DEFAULT = 'https://api.fake.openhive.network';
const isHttpUrl = (v: string) => /^https?:\/\/.+/i.test((v ?? '').trim());

/**
 * The Settings "Hive Network" section. Three ways to manage the node your wallet broadcasts through:
 *  1. See the current node + the detected network (mainnet / mirrornet / testnet) at a glance.
 *  2. Pick a healthy node from Hive Beacon (peakd.com), which scores the public mainnet nodes 0-100 —
 *     so when your node is failing you can switch to a working one in one click.
 *  3. A Testnet/Mirrornet toggle that points the wallet at a configured test node (with a global banner
 *     making it obvious you're off mainnet).
 *
 * Setting `hived_node` is all that's needed to switch: routes.tsx watches that preference and re-points
 * hive-tx + refreshes the chain config. `props`: { actions: { setPreference }, preferences }.
 */
const NetworkSettings: React.FC<any> = ({ actions, preferences }) => {
  const network = useAppSelector((state) => state.hive?.props?.network);
  const currentNode: string = preferences.hived_node || '';
  // Default to a known mirrornet so the toggle is usable immediately; '' (user cleared it) disables it.
  const testnetNode: string =
    preferences.testnet_node !== undefined ? preferences.testnet_node : TESTNET_DEFAULT;

  const [custom, setCustom] = useState(currentNode);
  const [nodes, setNodes] = useState<BeaconNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setNode = (url: string) => actions.setPreference('hived_node', url);

  const loadBeacon = async () => {
    setLoading(true);
    setError(null);
    try {
      setNodes(await fetchBeaconNodes());
    } catch (e: any) {
      setError(e?.message || 'Could not reach Hive Beacon.');
    } finally {
      setLoading(false);
    }
  };

  const onTestnet = !!network && network !== 'Hive';
  const toggleTestnet = (checked: boolean) => {
    if (checked) {
      if (testnetNode) setNode(testnetNode.trim());
    } else {
      setNode(MAINNET_DEFAULT);
      setCustom(MAINNET_DEFAULT);
    }
  };

  const netColor = !network || network === 'Hive' ? 'green' : /testnet/i.test(network) ? 'red' : 'orange';

  return (
    <Box>
      <Title order={3}>Hive Network</Title>
      <Text c="dimmed" size="sm" mb="sm">
        Choose which Hive node your wallet connects to in order to broadcast transactions.
      </Text>

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text size="xs" c="dimmed">
              Connected to
            </Text>
            <Text fw={600}>{currentNode || '—'}</Text>
          </div>
          <Badge color={netColor} size="lg" variant="filled">
            {network || 'Connecting…'}
          </Badge>
        </Group>

        <Divider my="md" />

        {/* Manual entry */}
        <Text fw={600} size="sm" mb={4}>
          Custom node
        </Text>
        <Group align="flex-end" gap="sm">
          <TextInput
            style={{ flex: 1 }}
            placeholder="https://api.hive.blog"
            value={custom}
            onChange={(e) => setCustom(e.currentTarget.value)}
            error={custom && !isHttpUrl(custom) ? 'Requires an http(s) URL' : undefined}
          />
          <Button
            color="blue"
            disabled={!isHttpUrl(custom) || custom.trim() === currentNode}
            onClick={() => setNode(custom.trim())}
          >
            Update
          </Button>
        </Group>

        <Divider my="md" />

        {/* Beacon picker */}
        <Group justify="space-between" mb="xs">
          <div>
            <Text fw={600} size="sm">
              Recommended nodes
            </Text>
            <Text c="dimmed" size="xs">
              Live health scores from Hive Beacon (beacon.peakd.com).
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            loading={loading}
            onClick={loadBeacon}
          >
            {nodes.length ? 'Refresh' : 'Load'}
          </Button>
        </Group>
        {error ? (
          <Alert color="red" mb="xs">
            {error}
          </Alert>
        ) : null}
        {nodes.length > 0 ? (
          <Table.ScrollContainer minWidth={480} mah={280} type="native">
            <Table stickyHeader withRowBorders={false} verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Node</Table.Th>
                  <Table.Th ta="center">Score</Table.Th>
                  <Table.Th ta="center">Version</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {nodes.map((n) => {
                  const active = n.endpoint === currentNode;
                  return (
                    <Table.Tr key={n.endpoint}>
                      <Table.Td>{n.name}</Table.Td>
                      <Table.Td ta="center">
                        <Badge color={n.score >= 90 ? 'green' : n.score >= 50 ? 'yellow' : 'red'}>
                          {n.score}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center" c="dimmed">
                        {n.version}
                      </Table.Td>
                      <Table.Td ta="right">
                        {active ? (
                          <Badge variant="light" color="blue" leftSection={<IconCheck size={12} />}>
                            Active
                          </Badge>
                        ) : (
                          <Button
                            size="compact-xs"
                            variant="default"
                            onClick={() => {
                              setNode(n.endpoint);
                              setCustom(n.endpoint);
                            }}
                          >
                            Use
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : null}

        <Divider my="md" />

        {/* Testnet toggle */}
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text fw={600} size="sm">
              Testnet / Mirrornet
            </Text>
            <Text c="dimmed" size="xs">
              Point the wallet at a test chain (no real funds). A banner shows while it's active.
            </Text>
          </div>
          <Switch
            checked={onTestnet}
            onChange={(e) => toggleTestnet(e.currentTarget.checked)}
            disabled={!isHttpUrl(testnetNode) && !onTestnet}
            aria-label="Toggle testnet"
          />
        </Group>
        <TextInput
          mt="xs"
          label="Testnet / Mirrornet node URL"
          placeholder="https://your-mirrornet-node…"
          value={testnetNode}
          onChange={(e) => actions.setPreference('testnet_node', e.currentTarget.value)}
          error={testnetNode && !isHttpUrl(testnetNode) ? 'Requires an http(s) URL' : undefined}
        />
      </Paper>
    </Box>
  );
};

export default NetworkSettings;
