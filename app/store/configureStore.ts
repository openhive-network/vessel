import { createStore, applyMiddleware, compose, Store } from 'redux';
import thunk from 'redux-thunk';
import { createHashHistory } from 'history';
import { createLogger } from 'redux-logger';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import rootReducer from '../reducers';

export const history = createHashHistory();

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['account', 'keys', 'preferences', 'hive']
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const configureStore = () => {
  // Redux Configuration
  const middleware: any[] = [];

  // Thunk Middleware
  middleware.push(thunk);

  // Logging Middleware (only in development)
  if (process.env.NODE_ENV === 'development') {
    const logger = createLogger({
      level: 'info',
      collapsed: true
    });
    middleware.push(logger);
  }

  // Redux DevTools Configuration
  /* eslint-disable no-underscore-dangle */
  const composeEnhancers =
    (typeof window !== 'undefined' &&
      (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) ||
    compose;
  /* eslint-enable no-underscore-dangle */

  // Apply Middleware & Compose Enhancers
  const enhancer = composeEnhancers(applyMiddleware(...middleware));

  // Create Store
  const store = createStore(persistedReducer, enhancer);

  if (process.env.NODE_ENV === 'development' && (module as any).hot) {
    (module as any).hot.accept('../reducers', () => {
      store.replaceReducer(persistReducer(persistConfig, require('../reducers').default));
    });
  }

  return store;
};

export const store = configureStore();
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default { store, persistor, history };
