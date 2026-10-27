import React from 'react';
import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

/**
 * Dark/light color-scheme toggle (Phase 7 M0). In the migrated nav (M2) it renders inline
 * (`fixed={false}`); on the pre-auth onboarding screen, which has no nav rail, it falls back to the
 * fixed top-right position. The choice is persisted by the localStorageColorSchemeManager in App.tsx.
 */
const ColorSchemeToggle: React.FC<{ fixed?: boolean }> = ({ fixed = true }) => {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = computed === 'dark';

  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="md"
      aria-label="Toggle color scheme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      style={fixed ? { position: 'fixed', top: 10, right: 10, zIndex: 1000 } : undefined}
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
};

export default ColorSchemeToggle;
