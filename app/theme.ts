import { createTheme } from '@mantine/core';

/**
 * Mantine theme (Phase 7 M0 foundation). Kept intentionally small — it only aligns Mantine with the
 * app's existing look (Lato body font, Semantic's blue as the primary) so migrated components match
 * the not-yet-migrated Semantic ones during the incremental sweep. Expanded as batches land.
 */
export const theme = createTheme({
  fontFamily: 'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  primaryColor: 'blue',
});
