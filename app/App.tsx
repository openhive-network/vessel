import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { HashRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { store, persistor } from './store/configureStore';
import Routes from './routes';
// Self-host Lato (the Semantic UI body font). The vendored semantic.min.css used to @import it from
// fonts.googleapis.com; the Phase 3 production CSP (style-src 'self') blocks that remote stylesheet, so
// the font is bundled locally instead — keeps the strict CSP, works offline, no request to Google.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/700-italic.css';
import './app.global.css';

const App: React.FC = () => (
  <Provider store={store}>
    <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
      <IntlProvider locale="en" defaultLocale="en">
        <HashRouter>
          <Routes />
        </HashRouter>
      </IntlProvider>
    </PersistGate>
  </Provider>
);

export default App;
