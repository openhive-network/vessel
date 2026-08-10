import React from 'react';
import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

/**
 * Dark/light color-scheme toggle (Phase 7 M0). Standalone + fixed to the top-right so it works in the
 * main window during the incremental Mantine migration; it will move into the nav once MenuBar is
 * migrated to Mantine (M2). The choice is persisted by the localStorageColorSchemeManager in App.tsx.
 */
const ColorSchemeToggle: React.FC = () => {
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
      style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
};

export default ColorSchemeToggle;
