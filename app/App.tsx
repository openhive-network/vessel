import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { HashRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { store, persistor } from './store/configureStore';
import Routes from './routes';
import './app.global.css';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      {/* @ts-expect-error - redux-persist types mismatch */}
      <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
        <IntlProvider locale="en" defaultLocale="en">
          <HashRouter>
            <Routes />
          </HashRouter>
        </IntlProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;
