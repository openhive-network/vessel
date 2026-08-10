import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { HashRouter } from 'react-router';
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { store, persistor } from './store/configureStore';
import Routes from './routes';
import { theme } from './theme';
// Self-host Lato (the Semantic UI body font). The vendored semantic.min.css used to @import it from
// fonts.googleapis.com; the Phase 3 production CSP (style-src 'self') blocks that remote stylesheet, so
// the font is bundled locally instead — keeps the strict CSP, works offline, no request to Google.
// Mantine base styles first (they register @layer mantine); the unlayered vendored Semantic CSS in
// app.global.css intentionally still wins during the incremental migration.
import '@mantine/core/styles.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/700-italic.css';
import './app.global.css';
// Last: make the app shell follow the light/dark scheme (must beat Semantic + Mantine's layer).
import './colorScheme.css';

// Persist the light/dark choice per-user; 'auto' follows the OS until the user first toggles.
const colorSchemeManager = localStorageColorSchemeManager({ key: 'vessel-color-scheme' });

const App: React.FC = () => (
  <MantineProvider theme={theme} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
    <Provider store={store}>
      <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
        <HashRouter>
          <Routes />
        </HashRouter>
      </PersistGate>
    </Provider>
  </MantineProvider>
);

export default App;
