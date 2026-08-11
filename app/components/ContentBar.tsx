import React from 'react';

/**
 * Left-offset content wrapper (clears the fixed 92px MenuBar rail). Migrated class -> function in
 * Phase 7 M1; behavior-identical.
 */
const ContentBar: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ marginLeft: '92px' }}>{children}</div>
);

export default ContentBar;
