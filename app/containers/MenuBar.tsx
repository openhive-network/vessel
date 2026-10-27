import React, { useEffect, useRef, useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Link, useLocation } from 'react-router';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import {
  IconArrowsExchange,
  IconBolt,
  IconFlask,
  IconLayoutDashboard,
  IconSend,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import * as AccountActions from '../actions/account';
import * as HiveActions from '../actions/hive';
import * as PreferencesActions from '../actions/preferences';
import ColorSchemeToggle from '../components/global/ColorSchemeToggle';

import srcHive from '../img/hive.png';
import srcTestnet from '../img/testnet.png';

const NAV_ITEMS = [
  { to: '/transactions', label: 'Overview', Icon: IconLayoutDashboard },
  { to: '/send', label: 'Send', Icon: IconSend },
  { to: '/convert', label: 'Convert', Icon: IconArrowsExchange },
  { to: '/vesting', label: 'Vesting', Icon: IconBolt },
  { to: '/accounts', label: 'Accounts', Icon: IconUsers },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
  { to: '/advanced', label: 'Advanced', Icon: IconFlask },
];

/**
 * Primary nav rail. Always dark (Semantic `inverted`), fixed-left, ~92px wide. Migrated
 * class -> function in Phase 7 M2; behavior-identical (same 10s refresh interval, same
 * connect() wiring, same Chain/Height footer).
 */
const MenuBar: React.FC<any> = (props) => {
  const { actions, keys, hive } = props;
  const location = useLocation();

  // Mirrors `this.props` in the original class: the interval always reads the LATEST
  // actions/keys, not what was in scope when the effect first ran.
  const latestRef = useRef({ actions, keys });
  useEffect(() => {
    latestRef.current = { actions, keys };
  });

  useEffect(() => {
    const timer = () => {
      latestRef.current.actions.refreshAccountData(latestRef.current.keys.names);
      latestRef.current.actions.refreshGlobalProps();
    };

    timer();
    const interval = setInterval(timer, 10000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Re-evaluate connection freshness on a local tick, so a stale/dead node flips to "Behind" even when
  // no new props arrive (refreshGlobalProps stops dispatching once the node stops responding).
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  let network = 'Loading';
  let synced: boolean | null = null;
  if (hive.props) {
    network = (hive.props.network || 'Hive').replace(/^Hive\s+/, ''); // "Hive Mirrornet" -> "Mirrornet"
    const headMs = hive.props.time ? new Date(`${hive.props.time}Z`).getTime() : 0;
    synced = headMs > 0 ? (now - headMs) / 1000 < 30 : null;
  }

  const chainClassName = network === 'Hive' ? 'hivered' : 'hivetestnetpink';
  const syncTitle =
    synced === null
      ? 'Connecting to the Hive node…'
      : synced
        ? `Up to date — head block ${hive.props?.head_block_number}`
        : 'Not receiving new blocks — possible node or connection issue';

  return (
    <Box
      bg="dark.8"
      c="gray.3"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '92px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack gap={0} align="center" py="md">
        <img
          alt="Vessel"
          src={network === 'Hive' ? srcHive : srcTestnet}
          style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 1em',
          }}
        />
        <Text size="sm" c="gray.3" mb="sm">
          Vessel
        </Text>
        <ColorSchemeToggle fixed={false} />
        <Divider w="100%" color="dark.5" mt="sm" mb="sm" />
      </Stack>

      <Stack gap={0}>
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textDecoration: 'none',
                padding: '0.7em 0',
                color: active ? '#fff' : 'var(--mantine-color-gray-3)',
                backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <Icon size={20} />
              <Text size="xs" mt={4} c={active ? 'white' : 'gray.3'}>
                {label}
              </Text>
            </Link>
          );
        })}
      </Stack>

      {/* mt="auto" pins this to the bottom of the flex column — no absolute overlap with the nav items */}
      <Box mt="auto" p="sm" ta="center">
        <Text size="xs" c="gray.5">
          Chain
        </Text>
        <Text size="sm" fw={700} mb="xs" className={chainClassName}>
          {network}
        </Text>
        <Group gap={6} justify="center" wrap="nowrap" title={syncTitle}>
          <Box
            w={8}
            h={8}
            style={{
              borderRadius: '50%',
              backgroundColor:
                synced === null
                  ? 'var(--mantine-color-gray-5)'
                  : synced
                    ? 'var(--mantine-color-green-5)'
                    : 'var(--mantine-color-red-5)',
            }}
          />
          <Text size="xs" c={synced === null ? 'gray.5' : synced ? 'green.4' : 'red.4'}>
            {synced === null ? '…' : synced ? 'Latest' : 'Behind'}
          </Text>
        </Group>
      </Box>
    </Box>
  );
};

function mapStateToProps(state: any) {
  return {
    keys: state.keys,
    hive: state.hive,
    preferences: state.preferences,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...HiveActions,
        ...PreferencesActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(MenuBar);
