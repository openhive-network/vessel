# Vessel Desktop Wallet - Comprehensive Dependency Upgrade & Modernization Plan

## Executive Summary

**Goal**: Modernize the Vessel Desktop Wallet to use latest dependencies, fix all security vulnerabilities, and adopt modern development patterns (TypeScript, React hooks, Redux Toolkit).

**Current State**:
- Node.js v6.9.5 (EOL 2019)
- Electron 4.2.11 (2019, critical security vulnerabilities)
- React 16.4.0 with deprecated lifecycle methods
- Babel 6 + Webpack 2 (outdated build system)
- Flow type checking (migrating to TypeScript)
- Traditional Redux patterns (migrating to Redux Toolkit)
- 42+ class components (converting to functional components with hooks)

**Risk Level**: HIGH (multi-year old dependencies with critical CVEs)

**Approach**: Phased incremental upgrade with comprehensive testing after each phase

**Estimated Timeline**: 5-7 weeks

---

## Phase 1: Foundation - Node.js, Babel 7, and TypeScript Setup (Week 1-2)

### Objectives
1. Update Node.js runtime to v18 LTS
2. Migrate from Babel 6 to Babel 7
3. Set up TypeScript infrastructure alongside existing code
4. Configure TypeScript with strict mode for gradual migration

### 1.1 Node.js Update

**Files to Modify**:
- `.nvmrc`: Update to `v18.20.0`
- `package.json`: Update `devEngines.node` to `">=18.x"`
- `.travis.yml`: Update Node versions to 18, 20

**Verification**: Run `node --version` to confirm v18.20.0

### 1.2 Babel 6 → Babel 7 Migration

**Dependencies to Install**:
```json
{
  "@babel/core": "^7.24.0",
  "@babel/preset-env": "^7.24.0",
  "@babel/preset-react": "^7.24.0",
  "@babel/preset-typescript": "^7.24.0",
  "@babel/plugin-proposal-class-properties": "^7.18.0",
  "@babel/plugin-transform-runtime": "^7.24.0",
  "@babel/runtime": "^7.24.0",
  "babel-loader": "^9.1.3"
}
```

**Dependencies to Remove**:
```
babel-polyfill, babel-preset-env, babel-preset-stage-0,
babel-preset-react, babel-preset-react-optimize,
babel-register, babel-plugin-flow-runtime
```

**Create**: `babel.config.js` (replace `.babelrc`):
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { node: '18', electron: '28' },
      useBuiltIns: 'usage',
      corejs: 3
    }],
    '@babel/preset-react',
    '@babel/preset-typescript'
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-runtime'
  ],
  env: {
    production: {
      plugins: ['transform-react-remove-prop-types']
    },
    development: {
      plugins: ['react-hot-loader/babel']
    }
  }
};
```

**Migration Tool**: Run `npx babel-upgrade` to automate initial changes

### 1.3 TypeScript Setup

**Dependencies to Install**:
```json
{
  "typescript": "^5.3.3",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@types/react-redux": "^7.1.33",
  "@types/node": "^18.19.0",
  "@types/electron": "^1.6.10",
  "ts-loader": "^9.5.1",
  "ts-node": "^10.9.2"
}
```

**Create**: `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "outDir": "./dist",
    "baseUrl": "./app",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": ["app/**/*"],
  "exclude": ["node_modules", "dist", "dll", "release"]
}
```

**Strategy**: Allow `.js` and `.tsx` files to coexist during migration. Convert files incrementally starting with utilities, then components, then containers.

### 1.4 Update Webpack for TypeScript

**Files to Modify**:
- `webpack.config.base.js`: Add TypeScript support
- All webpack configs: Update babel-loader settings

**Changes in `webpack.config.base.js`**:
```javascript
resolve: {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
},
module: {
  rules: [
    {
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          cacheDirectory: true
        }
      }
    }
  ]
}
```

### Verification Steps (Phase 1)
- [ ] `npm install` completes without errors
- [ ] `node --version` shows v18.20.0
- [ ] `npm run lint` passes (may need ESLint updates)
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] `npm run build-dll` succeeds
- [ ] `npm run build` completes
- [ ] App launches and displays main window

---

## Phase 2: Build System - Webpack 5 (Week 2)

### Objectives
1. Migrate from Webpack 2 to Webpack 5
2. Replace deprecated plugins (BabiliPlugin, ExtractTextPlugin, NamedModulesPlugin)
3. Modernize loaders and asset handling
4. Optimize bundle size and build performance

### 2.1 Update Core Webpack

**Dependencies to Install**:
```json
{
  "webpack": "^5.90.0",
  "webpack-dev-server": "^5.0.0",
  "webpack-merge": "^5.10.0",
  "webpack-bundle-analyzer": "^4.10.0",
  "webpack-cli": "^5.1.4",
  "terser-webpack-plugin": "^5.3.10",
  "mini-css-extract-plugin": "^2.8.0",
  "html-webpack-plugin": "^5.6.0"
}
```

**Dependencies to Remove**:
```
babili-webpack-plugin, extract-text-webpack-plugin
```

### 2.2 Update All Webpack Configs

**Critical Files** (6 files):
1. `webpack.config.base.js`
2. `webpack.config.main.prod.js`
3. `webpack.config.renderer.prod.js`
4. `webpack.config.renderer.dev.js`
5. `webpack.config.renderer.dev.dll.js`
6. `webpack.config.eslint.js`

### Changes for `webpack.config.base.js`:

**Remove**:
```javascript
plugins: [new webpack.NamedModulesPlugin()]
```

**Add**:
```javascript
resolve: {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  fallback: {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/')
  }
}
```

### Changes for `webpack.config.main.prod.js`:

**Replace BabiliPlugin with TerserPlugin**:
```javascript
// Old
import BabiliPlugin from 'babili-webpack-plugin';
plugins: [new BabiliPlugin()]

// New
const TerserPlugin = require('terser-webpack-plugin');
optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      parallel: true,
      terserOptions: {
        compress: { drop_console: true },
        format: { comments: false }
      },
      extractComments: false
    })
  ]
}
```

### Changes for `webpack.config.renderer.prod.js`:

**Replace ExtractTextPlugin with MiniCssExtractPlugin**:
```javascript
// Old
const ExtractTextPlugin = require('extract-text-webpack-plugin');
use: ExtractTextPlugin.extract({
  fallback: 'style-loader',
  use: ['css-loader', 'sass-loader']
})

// New
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']

plugins: [
  new MiniCssExtractPlugin({
    filename: 'style.css'
  })
]
```

**Update Asset Handling (Webpack 5 Asset Modules)**:
```javascript
// Replace file-loader and url-loader with Asset Modules
{
  test: /\.(woff|woff2|eot|ttf|otf)$/i,
  type: 'asset/resource'
},
{
  test: /\.(png|jpg|jpeg|gif|svg)$/i,
  type: 'asset',
  parser: {
    dataUrlCondition: {
      maxSize: 10 * 1024 // 10kb
    }
  }
}
```

### Changes for `webpack.config.renderer.dev.js`:

**Update DevServer config** (breaking changes in webpack-dev-server v5):
```javascript
// Old
devServer: {
  port: 1212,
  compress: true,
  publicPath: `http://localhost:${port}/dist/`,
  setup() { ... }
}

// New
devServer: {
  port: 1212,
  compress: true,
  historyApiFallback: true,
  hot: true,
  static: {
    directory: path.join(__dirname, 'dist'),
    publicPath: '/dist'
  },
  onBeforeSetupMiddleware(devServer) { ... }
}
```

### 2.3 Update Loaders

**Dependencies to Update**:
```json
{
  "css-loader": "^6.10.0",
  "style-loader": "^3.3.4",
  "sass-loader": "^14.1.0",
  "sass": "^1.70.0"
}
```

**Remove**: `node-sass` (deprecated, replaced by `sass`)

**Update CSS Modules syntax**:
```javascript
// Old
{
  test: /^((?!\.global).)*\.css$/,
  use: [{
    loader: 'css-loader',
    options: {
      modules: true,
      importLoaders: 1,
      localIdentName: '[name]__[local]__[hash:base64:5]'
    }
  }]
}

// New
{
  test: /^((?!\.global).)*\.css$/,
  use: [{
    loader: 'css-loader',
    options: {
      modules: {
        localIdentName: '[name]__[local]__[hash:base64:5]'
      },
      importLoaders: 1
    }
  }]
}
```

### 2.4 Update package.json Scripts

**Old**:
```json
"build-renderer": "cross-env NODE_ENV=production node -r babel-register ./node_modules/webpack/bin/webpack --config webpack.config.renderer.prod.js --profile --colors"
```

**New**:
```json
"build-renderer": "cross-env NODE_ENV=production webpack --config webpack.config.renderer.prod.js --color"
```

Remove all `-r babel-register` from scripts.

### Verification Steps (Phase 2)
- [ ] `npm run build-dll` succeeds
- [ ] `npm run build-main` completes without errors
- [ ] `npm run build-renderer` completes without errors
- [ ] Bundle sizes reduced by 15-30%
- [ ] `npm run dev` starts successfully
- [ ] Hot Module Replacement works
- [ ] Source maps generated correctly
- [ ] App launches and all features work

---

## Phase 3: React 18 + Functional Components (Week 3-4)

### Objectives
1. Update React 16.4 to React 18
2. Convert all 42+ class components to functional components with hooks
3. Remove deprecated lifecycle methods
4. Update react-router to v6
5. Add React 18 features (concurrent rendering)

### 3.1 Update React Core

**Dependencies to Install**:
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "react-hot-loader": "^4.13.1"
}
```

### 3.2 Update Root Rendering (Concurrent Mode)

**File**: `app/index.js` → Rename to `app/index.tsx`

**Old**:
```javascript
import { render } from 'react-dom';
render(<App />, document.getElementById('root'));
```

**New**:
```typescript
import { createRoot } from 'react-dom/client';
const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);
root.render(<App />);
```

### 3.3 Component Conversion Strategy

**Priority Order** (42+ components to convert):
1. Leaf components first (no children, pure display)
2. Form components
3. Container components
4. Route components last

**Critical Files with Deprecated Lifecycles** (convert first):
1. `app/routes.js` (lines 51, 57)
2. `app/containers/PromptOperation.js`
3. `app/components/Send.js`
4. `app/components/Keys/Create.js`
5. `app/components/Accounts/Delegation.js`
6. `app/components/Accounts/CustomJSON.js`
7. `app/components/Accounts/Proxy.js`
8. `app/components/Accounts/Voting.js`
9. `app/components/VestingAccounts.js`
10. `app/app.js` (line 17)

### 3.4 Conversion Patterns

#### Pattern 1: componentWillMount → useEffect

**Old** (`app/routes.js` line 51):
```javascript
class Root extends Component {
  componentWillMount() {
    const { hived_node } = this.props.preferences;
    if (hived_node) {
      this.changeNode(hived_node);
    }
  }
}
```

**New**:
```typescript
const Root: React.FC<RootProps> = ({ preferences }) => {
  useEffect(() => {
    const { hived_node } = preferences;
    if (hived_node) {
      changeNode(hived_node);
    }
  }, []); // Empty deps = run once on mount

  return <div>...</div>;
};
```

#### Pattern 2: componentWillReceiveProps → useEffect with deps

**Old** (`app/routes.js` line 57):
```javascript
componentWillReceiveProps(nextProps) {
  const nextNode = nextProps.preferences.hived_node;
  const thisNode = this.props.preferences.hived_node;
  if (nextNode !== thisNode) {
    this.changeNode(nextNode);
  }
}
```

**New**:
```typescript
const Root: React.FC<RootProps> = ({ preferences }) => {
  const prevNodeRef = useRef(preferences.hived_node);

  useEffect(() => {
    if (preferences.hived_node !== prevNodeRef.current) {
      changeNode(preferences.hived_node);
      prevNodeRef.current = preferences.hived_node;
    }
  }, [preferences.hived_node]);

  return <div>...</div>;
};
```

#### Pattern 3: Local State → useState

**Old** (`app/components/Send.js`):
```javascript
class Send extends Component {
  constructor(props) {
    super(props);
    this.state = {
      to: '',
      amount: '',
      memo: ''
    };
  }
}
```

**New**:
```typescript
const Send: React.FC<SendProps> = (props) => {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  return <div>...</div>;
};
```

#### Pattern 4: Redux connect → useSelector + useDispatch

**Old**:
```javascript
class Send extends Component {
  render() {
    const { account, processing } = this.props;
    // ...
  }
}

export default connect(
  (state) => ({
    account: state.account,
    processing: state.processing
  }),
  (dispatch) => ({
    actions: bindActionCreators(AccountActions, dispatch)
  })
)(Send);
```

**New**:
```typescript
const Send: React.FC = () => {
  const account = useSelector((state: RootState) => state.account);
  const processing = useSelector((state: RootState) => state.processing);
  const dispatch = useDispatch();

  const handleTransfer = () => {
    dispatch(AccountActions.transfer(...));
  };

  return <div>...</div>;
};

export default Send;
```

### 3.5 Update React Router v4 → v6

**Dependencies to Install**:
```json
{
  "react-router-dom": "^6.22.0",
  "@types/react-router-dom": "^5.3.3"
}
```

**Dependencies to Remove**:
```
react-router-redux, connected-react-router
```

**File**: `app/routes.js` → `app/routes.tsx`

**Old**:
```javascript
import { Switch, Route } from 'react-router-dom';

<Switch>
  <Route path="/account" component={Account} />
</Switch>
```

**New**:
```typescript
import { Routes, Route } from 'react-router-dom';

<Routes>
  <Route path="/account" element={<Account />} />
</Routes>
```

**Update Navigation**:
```typescript
// Old
import { push } from 'react-router-redux';
dispatch(push('/account'));

// New
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/account');
```

### 3.6 Update Semantic UI React

**Dependencies to Update**:
```json
{
  "semantic-ui-react": "^2.1.5",
  "fomantic-ui-css": "^2.9.3"
}
```

**Note**: semantic-ui-react v2 is compatible with React 18. Check for breaking changes in Button, Form, Modal components.

### 3.7 Convert TypeScript (.js → .tsx)

**Conversion Order**:
1. Utilities first: `app/utils/*.js` → `.ts`
2. Actions: `app/actions/*.js` → `.ts`
3. Reducers: `app/reducers/*.js` → `.ts`
4. Components: `app/components/**/*.js` → `.tsx`
5. Containers: `app/containers/*.js` → `.tsx`

**Create Type Definitions** for Hive.js:

**File**: `app/types/hive.d.ts`
```typescript
declare module '@hiveio/hive-js' {
  export const api: {
    getAccounts(accounts: string[], callback: (err: Error | null, result: any[]) => void): void;
    getDynamicGlobalProperties(callback: (err: Error | null, result: any) => void): void;
    // ... add all other API methods
  };

  export const broadcast: {
    transfer(
      wif: string,
      from: string,
      to: string,
      amount: string,
      memo: string,
      callback: (err: Error | null, result: any) => void
    ): void;
    // ... add all other broadcast methods
  };

  export const config: {
    get(key: string): string;
  };
}
```

### Verification Steps (Phase 3)
- [ ] All components render without React warnings
- [ ] No "componentWillMount", "componentWillReceiveProps" warnings
- [ ] TypeScript compilation succeeds: `npx tsc --noEmit`
- [ ] React Router v6 navigation works
- [ ] Redux state still accessible via hooks
- [ ] HMR still functional
- [ ] All UI components display correctly
- [ ] Run comprehensive functional tests (see Testing Checklist)

---

## Phase 4: Redux Toolkit Migration (Week 4-5)

### Objectives
1. Migrate from traditional Redux to Redux Toolkit
2. Update redux-persist v4 → v6
3. Convert action creators to createAsyncThunk
4. Convert reducers to createSlice
5. Simplify store configuration

### 4.1 Install Redux Toolkit

**Dependencies to Install**:
```json
{
  "@reduxjs/toolkit": "^2.2.0",
  "redux-persist": "^6.0.0",
  "@types/redux-persist": "^4.3.1"
}
```

**Dependencies to Remove**:
```
redux-thunk (built into RTK)
```

### 4.2 Update Store Configuration

**File**: `app/store/configureStore.dev.ts` (formerly .js)

**Old** (redux-persist v4):
```javascript
import { createStore, applyMiddleware, compose } from 'redux';
import { persistStore, autoRehydrate } from 'redux-persist';
import thunk from 'redux-thunk';
import rootReducer from '../reducers';

const enhancer = compose(
  applyMiddleware(thunk),
  autoRehydrate()
);

const store = createStore(rootReducer, initialState, enhancer);
persistStore(store, { whitelist: ['account', 'keys', 'preferences', 'hive'] });
```

**New** (Redux Toolkit + redux-persist v6):
```typescript
import { configureStore } from '@reduxjs/toolkit';
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

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['account', 'keys', 'preferences', 'hive']
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      }
    }),
  devTools: process.env.NODE_ENV !== 'production'
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 4.3 Convert Reducers to Slices

**Example**: `app/reducers/account.js` → `app/slices/accountSlice.ts`

**Old** (traditional reducer):
```javascript
const initialState = {
  data: null,
  loading: false,
  error: null
};

export default function account(state = initialState, action) {
  switch (action.type) {
    case ACCOUNT_LOAD_STARTED:
      return Object.assign({}, state, { loading: true });
    case ACCOUNT_LOAD_RESOLVED:
      return Object.assign({}, state, {
        loading: false,
        data: action.payload
      });
    case ACCOUNT_LOAD_FAILED:
      return Object.assign({}, state, {
        loading: false,
        error: action.payload
      });
    default:
      return state;
  }
}
```

**New** (createSlice):
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface AccountState {
  data: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: AccountState = {
  data: null,
  loading: false,
  error: null
};

export const loadAccount = createAsyncThunk(
  'account/load',
  async (accountName: string, { rejectWithValue }) => {
    try {
      const result = await hiveApi.getAccounts([accountName]);
      return result[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    clearAccount: (state) => {
      state.data = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(loadAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearAccount } = accountSlice.actions;
export default accountSlice.reducer;
```

### 4.4 Convert Actions to createAsyncThunk

**Files to Convert**:
1. `app/actions/account.js` → `app/slices/accountSlice.ts` (move thunks here)
2. `app/actions/hive.js` → `app/slices/hiveSlice.ts`
3. `app/actions/keys.js` → `app/slices/keysSlice.ts`

**Critical File**: `app/actions/account.js` (20+ async actions)

**Old Pattern**:
```javascript
export function transfer(from, to, amount, memo) {
  return (dispatch, getState) => {
    dispatch({ type: ACCOUNT_TRANSFER_STARTED });

    const { keys } = getState();
    const wif = keys.permissions.active;

    hive.broadcast.transfer(wif, from, to, amount, memo, (err, result) => {
      if (err) {
        dispatch({ type: ACCOUNT_TRANSFER_FAILED, payload: err });
      } else {
        dispatch({ type: ACCOUNT_TRANSFER_RESOLVED, payload: result });
      }
    });
  };
}
```

**New Pattern**:
```typescript
export const transfer = createAsyncThunk(
  'account/transfer',
  async (
    params: { from: string; to: string; amount: string; memo: string },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as RootState;
    const wif = state.keys.permissions.active;

    try {
      const result = await hiveBroadcast.transfer(
        wif,
        params.from,
        params.to,
        params.amount,
        params.memo
      );
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

### 4.5 Update Root Reducer

**File**: `app/reducers/index.ts` (formerly index.js)

**Old**:
```javascript
import { combineReducers } from 'redux';
import account from './account';
import keys from './keys';
import preferences from './preferences';
import hive from './hive';
import processing from './processing';

export default combineReducers({
  account,
  keys,
  preferences,
  hive,
  processing
});
```

**New**:
```typescript
import { combineReducers } from '@reduxjs/toolkit';
import accountReducer from '../slices/accountSlice';
import keysReducer from '../slices/keysSlice';
import preferencesReducer from '../slices/preferencesSlice';
import hiveReducer from '../slices/hiveSlice';
import processingReducer from '../slices/processingSlice';

const rootReducer = combineReducers({
  account: accountReducer,
  keys: keysReducer,
  preferences: preferencesReducer,
  hive: hiveReducer,
  processing: processingReducer
});

export default rootReducer;
```

### 4.6 Update Components to Use RTK

**Create Typed Hooks**: `app/hooks/redux.ts`
```typescript
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store/configureStore.dev';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

**Update Components**:
```typescript
// Old
import { useDispatch, useSelector } from 'react-redux';
import * as AccountActions from '../actions/account';

const dispatch = useDispatch();
dispatch(AccountActions.transfer(from, to, amount, memo));

// New
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { transfer } from '../slices/accountSlice';

const dispatch = useAppDispatch();
dispatch(transfer({ from, to, amount, memo }));
```

### 4.7 Update app.js for redux-persist v6

**File**: `app/app.js` → `app/App.tsx`

**Old** (redux-persist v4):
```javascript
componentWillMount() {
  const config = {
    whitelist: ['account', 'keys', 'preferences', 'hive']
  };
  persistStore(store, config, () => {
    this.setState({ rehydrated: true })
  });
}
```

**New** (redux-persist v6 with PersistGate):
```typescript
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/configureStore.dev';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
        <Root />
      </PersistGate>
    </Provider>
  );
};
```

### Verification Steps (Phase 4)
- [ ] Redux DevTools shows Redux Toolkit actions
- [ ] State persists correctly after app restart
- [ ] All async actions work (transfer, delegation, etc.)
- [ ] TypeScript types for state are correct
- [ ] No runtime Redux errors
- [ ] Comprehensive functional tests pass

---

## Phase 5: Electron 28 + Hive.js Modernization (Week 5-6)

### Objectives
1. Update Electron 4.2.11 → 28.x (critical security fixes)
2. Implement secure Electron practices (contextIsolation, preload scripts)
3. Create Promise-based wrapper for @hiveio/hive-js
4. Update electron-builder configuration

### 5.1 Update Electron

**Dependencies to Install**:
```json
{
  "electron": "^28.2.0",
  "electron-builder": "^24.13.0",
  "electron-devtools-installer": "^3.2.0",
  "@types/electron": "^1.6.10"
}
```

**Dependencies to Remove**:
```
electron-config (deprecated), devtron (deprecated)
```

**Update package.json**:
```json
"browserslist": "electron 28"
```

### 5.2 Secure Main Process

**File**: `app/main.dev.js` → `app/main.dev.ts`

**Old** (insecure, no webPreferences):
```javascript
mainWindow = new BrowserWindow({
  show: false,
  width: 970,
  height: 750
});
```

**New** (secure with contextIsolation):
```typescript
import { app, BrowserWindow, protocol } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

mainWindow = new BrowserWindow({
  show: false,
  width: 970,
  height: 750,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: path.join(__dirname, 'preload.js')
  }
});

// Security: Disable navigation to external URLs
mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
    event.preventDefault();
  }
});
```

### 5.3 Create Preload Script

**File**: `app/preload.ts` (new file)

**Purpose**: Safely expose Node.js/Electron APIs to renderer process

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Shell operations for opening external links
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Storage operations
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value)
  }
});

// Type definitions for renderer
export interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

**Update main process to handle IPC**:
```typescript
import { ipcMain, shell } from 'electron';

ipcMain.handle('shell:openExternal', async (event, url: string) => {
  await shell.openExternal(url);
});
```

### 5.4 Update Custom URI Protocol Handlers

**File**: `app/main.dev.ts` (lines 88-100)

**Old**:
```javascript
app.setAsDefaultProtocolClient('hive');
app.setAsDefaultProtocolClient('vessel');
```

**New** (Electron 28 requires different approach):
```typescript
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('hive', process.execPath, [path.resolve(process.argv[1])]);
    app.setAsDefaultProtocolClient('vessel', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('hive');
  app.setAsDefaultProtocolClient('vessel');
}

// Handle protocol URLs
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleCustomProtocol(url);
});
```

### 5.5 Modernize Hive.js Integration

**Create**: `app/utils/hiveApi.ts` (Promise-based wrapper)

```typescript
import hive from '@hiveio/hive-js';

// Promisify callback-based API
function promisify<T>(
  fn: (callback: (err: Error | null, result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// API Methods
export const hiveApi = {
  getDynamicGlobalProperties: (): Promise<any> =>
    promisify((cb) => hive.api.getDynamicGlobalProperties(cb)),

  getAccounts: (accounts: string[]): Promise<any[]> =>
    promisify((cb) => hive.api.getAccounts(accounts, cb)),

  getVestingDelegations: (account: string, from: string | number, limit: number): Promise<any[]> =>
    promisify((cb) => hive.api.getVestingDelegations(account, from, limit, cb)),

  getWithdrawRoutes: (account: string, type: string): Promise<any[]> =>
    promisify((cb) => hive.api.getWithdrawRoutes(account, type, cb)),

  getSavingsWithdrawFrom: (account: string): Promise<any[]> =>
    promisify((cb) => hive.api.getSavingsWithdrawFrom(account, cb))
};

// Broadcast Methods
export const hiveBroadcast = {
  transfer: (
    wif: string,
    from: string,
    to: string,
    amount: string,
    memo: string
  ): Promise<any> =>
    promisify((cb) => hive.broadcast.transfer(wif, from, to, amount, memo, cb)),

  transferToSavings: (
    wif: string,
    from: string,
    to: string,
    amount: string,
    memo: string
  ): Promise<any> =>
    promisify((cb) => hive.broadcast.transferToSavings(wif, from, to, amount, memo, cb)),

  transferFromSavings: (
    wif: string,
    from: string,
    requestId: number,
    to: string,
    amount: string,
    memo: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.transferFromSavings(wif, from, requestId, to, amount, memo, cb)
    ),

  delegateVestingShares: (
    wif: string,
    delegator: string,
    delegatee: string,
    vests: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.delegateVestingShares(wif, delegator, delegatee, vests, cb)
    ),

  withdrawVesting: (wif: string, account: string, vests: string): Promise<any> =>
    promisify((cb) => hive.broadcast.withdrawVesting(wif, account, vests, cb)),

  accountWitnessVote: (
    wif: string,
    account: string,
    witness: string,
    approve: boolean
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.accountWitnessVote(wif, account, witness, approve, cb)
    ),

  accountWitnessProxy: (wif: string, account: string, proxy: string): Promise<any> =>
    promisify((cb) => hive.broadcast.accountWitnessProxy(wif, account, proxy, cb)),

  setWithdrawVestingRoute: (
    wif: string,
    account: string,
    target: string,
    percent: number,
    autoVest: boolean
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.setWithdrawVestingRoute(wif, account, target, percent, autoVest, cb)
    ),

  convert: (wif: string, owner: string, requestId: number, amount: string): Promise<any> =>
    promisify((cb) => hive.broadcast.convert(wif, owner, requestId, amount, cb)),

  collateralizedConvert: (
    wif: string,
    owner: string,
    requestId: number,
    amount: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.collateralizedConvert(wif, owner, requestId, amount, cb)
    ),

  customJson: (
    wif: string,
    requiredAuths: string[],
    requiredPostingAuths: string[],
    id: string,
    json: string
  ): Promise<any> =>
    promisify((cb) =>
      hive.broadcast.customJson(wif, requiredAuths, requiredPostingAuths, id, json, cb)
    ),

  send: (operations: any[], keys: string[]): Promise<any> =>
    promisify((cb) => hive.broadcast.send(operations, keys, cb))
};

// Auth utilities
export const hiveAuth = {
  isWif: (key: string): boolean => hive.auth.isWif(key),
  wifToPublic: (wif: string): string => hive.auth.wifToPublic(wif)
};

// Memo utilities
export const hiveMemo = {
  encode: (privateKey: string, publicKey: string, message: string): string =>
    hive.memo.encode(privateKey, publicKey, message),
  decode: (privateKey: string, encoded: string): string =>
    hive.memo.decode(privateKey, encoded)
};

// Config utilities
export const hiveConfig = {
  get: (key: string): string => hive.config.get(key)
};
```

### 5.6 Update Redux Slices to Use Promisified API

**Example**: Update `app/slices/accountSlice.ts`

**Old**:
```javascript
hive.api.getAccounts(accounts, (err, result) => {
  if (err) {
    dispatch({ type: ACCOUNT_LOAD_FAILED, payload: err });
  } else {
    dispatch({ type: ACCOUNT_LOAD_RESOLVED, payload: result });
  }
});
```

**New**:
```typescript
export const loadAccount = createAsyncThunk(
  'account/load',
  async (accountName: string) => {
    const result = await hiveApi.getAccounts([accountName]);
    return result[0];
  }
);
```

### 5.7 Update Electron Builder Config

**File**: `package.json` (build section)

**Add**:
```json
"build": {
  "productName": "Vessel",
  "appId": "com.vessel.wallet",
  "files": [
    "dist/",
    "node_modules/",
    "app.html",
    "main.prod.js",
    "main.prod.js.map",
    "preload.js",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "assets/",
      "to": "assets/"
    }
  ],
  "dmg": {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ]
  },
  "win": {
    "target": [
      "nsis",
      "msi"
    ]
  },
  "linux": {
    "target": [
      "deb",
      "rpm",
      "AppImage"
    ],
    "category": "Finance"
  }
}
```

### Verification Steps (Phase 5)
- [ ] Electron 28 app launches successfully
- [ ] Context isolation works (no Node.js in renderer)
- [ ] Preload script exposes safe APIs
- [ ] Custom URI handlers work (hive://, vessel://)
- [ ] All Hive API calls work with Promise wrapper
- [ ] DevTools install correctly
- [ ] Security audit passes
- [ ] Cross-platform builds work (macOS, Windows, Linux)

---

## Phase 6: Final Updates & Testing (Week 6-7)

### Objectives
1. Update all remaining dependencies
2. Run comprehensive security audit
3. Perform end-to-end testing
4. Update documentation
5. Performance optimization

### 6.1 Update Remaining Dependencies

**Testing Dependencies**:
```json
{
  "jest": "^29.7.0",
  "babel-jest": "^29.7.0",
  "@testing-library/react": "^14.2.0",
  "@testing-library/jest-dom": "^6.4.0",
  "@testing-library/user-event": "^14.5.2",
  "@types/jest": "^29.5.12"
}
```

**Linting & Type Checking**:
```json
{
  "eslint": "^8.57.0",
  "@typescript-eslint/parser": "^7.0.0",
  "@typescript-eslint/eslint-plugin": "^7.0.0",
  "eslint-config-airbnb": "^19.0.4",
  "eslint-config-airbnb-typescript": "^18.0.0",
  "eslint-plugin-react": "^7.33.0",
  "eslint-plugin-react-hooks": "^4.6.0",
  "eslint-plugin-import": "^2.29.0",
  "prettier": "^3.2.5",
  "eslint-config-prettier": "^9.1.0"
}
```

**Note**: Remove Flow and all Flow-related dependencies:
```
flow-bin, flow-typed, flow-runtime, babel-plugin-flow-runtime,
eslint-plugin-flowtype, eslint-plugin-flowtype-errors
```

**Utilities**:
```json
{
  "concurrently": "^8.2.2",
  "cross-env": "^7.0.3",
  "rimraf": "^5.0.5",
  "chalk": "^5.3.0"
}
```

**Crypto Polyfills** (for Webpack 5):
```json
{
  "crypto-browserify": "^3.12.0",
  "stream-browserify": "^3.0.0",
  "buffer": "^6.0.3"
}
```

### 6.2 Update ESLint Configuration

**Create**: `.eslintrc.json`

**Remove**: `.eslintrc` (old config), `app/.eslintrc`

**New Config**:
```json
{
  "extends": [
    "airbnb",
    "airbnb-typescript",
    "airbnb/hooks",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "project": "./tsconfig.json",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/jsx-filename-extension": ["error", { "extensions": [".tsx"] }],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "no-console": "off",
    "import/prefer-default-export": "off"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### 6.3 Add Prettier

**Create**: `.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

**Add Scripts** to `package.json`:
```json
{
  "format": "prettier --write \"app/**/*.{ts,tsx,js,jsx,json,css,scss}\"",
  "format-check": "prettier --check \"app/**/*.{ts,tsx,js,jsx,json,css,scss}\""
}
```

### 6.4 Update Jest Configuration

**File**: `package.json` (jest section)

**Old**:
```json
"jest": {
  "moduleNameMapper": {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/internals/mocks/fileMock.js",
    "\\.(css|less|sass|scss)$": "identity-obj-proxy"
  }
}
```

**New**:
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "jsdom",
  "roots": ["<rootDir>/app"],
  "testMatch": ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "moduleNameMapper": {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/internals/mocks/fileMock.js",
    "\\.(css|less|sass|scss)$": "identity-obj-proxy"
  },
  "setupFilesAfterEnv": ["<rootDir>/internals/testing/setupTests.ts"],
  "collectCoverageFrom": [
    "app/**/*.{ts,tsx}",
    "!app/**/*.d.ts",
    "!app/dist/**"
  ]
}
```

**Create**: `internals/testing/setupTests.ts`
```typescript
import '@testing-library/jest-dom';
```

### 6.5 Security Audit & Fixes

**Run Security Audit**:
```bash
npm audit
npm audit fix
```

**Check for Critical Vulnerabilities**:
- Electron 4.2.11 → 28.x (FIXED in Phase 5)
- Webpack 2.7.0 → 5.x (FIXED in Phase 2)
- Node.js 6 → 18 (FIXED in Phase 1)
- babel-polyfill vulnerabilities (FIXED in Phase 1)

**Additional Security Measures**:

1. **Content Security Policy** - Add to `app/app.html`:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
```

2. **Disable Node Integration** - Already done in Phase 5 (main.dev.ts)

3. **Enable Context Isolation** - Already done in Phase 5 (main.dev.ts)

4. **Validate External Input** - Add input validation for URI handlers

### 6.6 Performance Optimization

**Webpack Bundle Optimization**:

**File**: `webpack.config.renderer.prod.js`

**Add**:
```javascript
optimization: {
  minimize: true,
  minimizer: [new TerserPlugin()],
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10
      },
      common: {
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true
      }
    }
  },
  runtimeChunk: 'single'
}
```

**Lazy Loading for Routes**:

**File**: `app/routes.tsx`

**Old**:
```typescript
import Account from './containers/Account';
```

**New**:
```typescript
import { lazy, Suspense } from 'react';
const Account = lazy(() => import('./containers/Account'));

// In Routes component
<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    <Route path="/account" element={<Account />} />
  </Routes>
</Suspense>
```

### 6.7 Update Documentation

**Files to Update**:
1. `CLAUDE.md` - Update tech stack versions
2. `README.md` - Update installation instructions
3. `CHANGELOG.md` - Document all changes
4. `.travis.yml` - Update CI configuration for Node 18

**Create**: `UPGRADE_NOTES.md`
```markdown
# Upgrade Notes - v1.0.3 to v2.0.0

## Breaking Changes

1. **Node.js**: Requires Node.js 18+ (previously 6.x)
2. **TypeScript**: All source files migrated to TypeScript
3. **React**: Migrated to React 18 with functional components
4. **Redux**: Now using Redux Toolkit (createSlice, createAsyncThunk)
5. **Electron**: Updated to v28 (requires app rebuild)

## Migration Guide for Developers

### TypeScript
All `.js` files have been converted to `.ts` or `.tsx`. Update imports accordingly.

### React Hooks
All class components converted to functional components with hooks:
- `componentDidMount` → `useEffect(() => {}, [])`
- `this.state` → `useState()`
- Redux connect → `useAppSelector` and `useAppDispatch`

### Redux Toolkit
Actions are now created with `createAsyncThunk`:
```typescript
// Old
dispatch(AccountActions.transfer(from, to, amount, memo));

// New
dispatch(transfer({ from, to, amount, memo }));
```

### Hive API
All Hive API calls now return Promises:
```typescript
// Old
hive.api.getAccounts(['account'], (err, result) => { ... });

// New
const result = await hiveApi.getAccounts(['account']);
```
```

---

## Comprehensive Testing Checklist

### Phase 1 - Foundation
- [ ] `npm install` completes without errors
- [ ] `node --version` shows 18.20.0
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` succeeds (TypeScript compilation)
- [ ] `npm run build-dll` succeeds
- [ ] `npm run build` completes
- [ ] App launches and displays main window

### Phase 2 - Build System
- [ ] `npm run build-dll` with Webpack 5 succeeds
- [ ] `npm run build-main` completes
- [ ] `npm run build-renderer` completes
- [ ] Bundle size reduced (check dist/ folder sizes)
- [ ] `npm run dev` starts dev server
- [ ] Hot Module Replacement works
- [ ] Source maps generated correctly
- [ ] CSS extracted to separate file in production

### Phase 3 - React 18
- [ ] All components render without warnings
- [ ] No deprecated lifecycle warnings in console
- [ ] TypeScript compilation succeeds
- [ ] React Router v6 navigation works
- [ ] Redux state accessible via hooks
- [ ] HMR works with functional components
- [ ] Semantic UI components display correctly

### Phase 4 - Redux Toolkit
- [ ] Redux DevTools shows RTK actions
- [ ] State persists after app restart
- [ ] All async thunks work correctly
- [ ] TypeScript types for RootState work
- [ ] No runtime Redux errors

### Phase 5 - Electron 28
- [ ] Electron app launches
- [ ] Context isolation enabled (check DevTools)
- [ ] Preload script working
- [ ] Custom URI handlers work (test with hive://transfer/@username)
- [ ] Hive API Promise wrapper works
- [ ] All blockchain operations succeed

### Phase 6 - Final Testing

#### Functional Tests (All Features)

**Account Management**:
- [ ] Create new account with recovery phrase (BIP39)
- [ ] Import existing account with active key
- [ ] Import existing account with posting key
- [ ] Import existing account with memo key
- [ ] View account balance (HIVE, HBD, vesting)
- [ ] View account history

**Transfer Operations**:
- [ ] Send HIVE tokens to another account
- [ ] Send HBD tokens to another account
- [ ] Send with memo (encrypted)
- [ ] Send with memo (unencrypted)
- [ ] Send to exchange (test Binance memo format)
- [ ] Transfer validation (insufficient balance)
- [ ] Transfer validation (invalid account name)

**Savings Account**:
- [ ] Transfer HIVE to savings
- [ ] Transfer HBD to savings
- [ ] Withdraw from savings (3-day delay displayed)
- [ ] View pending withdrawals

**Vesting (Power Up/Down)**:
- [ ] Power up HIVE → HIVE POWER
- [ ] Power down (start withdrawal)
- [ ] Set power down destination
- [ ] Change power down percentage
- [ ] Cancel power down
- [ ] View pending power down schedule

**Delegation**:
- [ ] Delegate HIVE POWER to another account
- [ ] View outgoing delegations
- [ ] View incoming delegations
- [ ] Remove delegation
- [ ] Delegation cooldown period displayed

**Witness Voting**:
- [ ] Vote for a witness
- [ ] Unvote a witness
- [ ] Set witness proxy
- [ ] Remove witness proxy
- [ ] View current votes

**Conversion**:
- [ ] Convert HBD to HIVE (3.5 day conversion)
- [ ] Collateralized conversion (instant)
- [ ] View pending conversions

**Custom JSON**:
- [ ] Send custom JSON operation
- [ ] Sign custom JSON with active authority
- [ ] Sign custom JSON with posting authority

**Settings**:
- [ ] Change Hive node (mainnet)
- [ ] Test with custom node URL
- [ ] Switch to testnet
- [ ] Verify testnet token names (TESTS, TBD)

**Address Book**:
- [ ] Add contact
- [ ] Edit contact
- [ ] Delete contact
- [ ] Use contact in transfer

**Export**:
- [ ] Export transaction history (CSV)
- [ ] Export keys (warning displayed)

**State Persistence**:
- [ ] Close and reopen app
- [ ] Verify account data persists
- [ ] Verify settings persist
- [ ] Verify address book persists

**Error Handling**:
- [ ] Invalid password shows error
- [ ] Network error displays message
- [ ] Hive node offline - fallback works
- [ ] Invalid transaction shows error

#### Cross-Platform Tests

**macOS**:
- [ ] Build: `npm run package`
- [ ] DMG installer created
- [ ] App launches from installer
- [ ] All features work
- [ ] macOS notarization passes (if configured)

**Windows**:
- [ ] Build: `npm run package-win`
- [ ] NSIS installer created
- [ ] App launches from installer
- [ ] All features work
- [ ] Windows signing works (if configured)

**Linux**:
- [ ] Build: `npm run package-linux`
- [ ] AppImage created
- [ ] DEB package created
- [ ] RPM package created
- [ ] App launches from AppImage
- [ ] All features work

#### Security Tests
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] Context isolation enabled (no Node.js in renderer DevTools)
- [ ] External navigation blocked
- [ ] Keys stored encrypted (electron-json-storage)
- [ ] No credentials logged to console
- [ ] Content Security Policy enforced

#### Performance Tests
- [ ] App startup time < 3 seconds
- [ ] Bundle size reduced from v1.0.3
- [ ] Memory usage reasonable (< 200MB idle)
- [ ] HMR rebuild time < 2 seconds
- [ ] Production build time < 2 minutes

---

## Critical Files Reference

### Phase 1 Files
1. `package.json` - Update all Babel dependencies
2. `.nvmrc` - Node version
3. `babel.config.js` - New Babel 7 config (create)
4. `tsconfig.json` - TypeScript config (create)
5. `webpack.config.base.js` - Add TypeScript support

### Phase 2 Files
1. `webpack.config.base.js` - Core config
2. `webpack.config.main.prod.js` - Main process build
3. `webpack.config.renderer.prod.js` - Renderer production
4. `webpack.config.renderer.dev.js` - Renderer development
5. `webpack.config.renderer.dev.dll.js` - DLL cache
6. `package.json` - Update webpack dependencies and scripts

### Phase 3 Files
1. `app/index.js` → `app/index.tsx` - React 18 root
2. `app/routes.js` → `app/routes.tsx` - React Router v6
3. `app/components/**/*.js` → `*.tsx` - 42+ components
4. `app/containers/**/*.js` → `*.tsx` - All containers
5. `app/types/hive.d.ts` - Type definitions (create)

### Phase 4 Files
1. `app/store/configureStore.dev.js` → `.ts` - Redux Toolkit store
2. `app/reducers/account.js` → `app/slices/accountSlice.ts` - RTK slice
3. `app/reducers/keys.js` → `app/slices/keysSlice.ts`
4. `app/reducers/preferences.js` → `app/slices/preferencesSlice.ts`
5. `app/reducers/hive.js` → `app/slices/hiveSlice.ts`
6. `app/reducers/processing.js` → `app/slices/processingSlice.ts`
7. `app/reducers/index.js` → `app/reducers/index.ts` - Root reducer
8. `app/app.js` → `app/App.tsx` - PersistGate
9. `app/hooks/redux.ts` - Typed hooks (create)

### Phase 5 Files
1. `app/main.dev.js` → `app/main.dev.ts` - Electron main
2. `app/preload.ts` - Preload script (create)
3. `app/utils/hiveApi.ts` - Promise wrapper (create)
4. `app/slices/accountSlice.ts` - Update to use hiveApi
5. `package.json` - Electron builder config

### Phase 6 Files
1. `.eslintrc.json` - New ESLint config
2. `.prettierrc` - Prettier config (create)
3. `CLAUDE.md` - Update tech stack
4. `README.md` - Update instructions
5. `UPGRADE_NOTES.md` - Migration guide (create)

---

## Risk Mitigation

### Backup Strategy
1. Create feature branch: `git checkout -b feature/modernization-2026`
2. Commit after each phase: `git commit -m "Phase N: Description"`
3. Tag each phase: `git tag v2.0.0-phase1`
4. Keep backup of working v1.0.3 directory

### Rollback Plan
If a phase fails:
1. `git reset --hard HEAD~1` to previous commit
2. `npm install` to restore dependencies
3. Fix issues before proceeding
4. DO NOT skip phases

### Testing Discipline
- Test comprehensively after EACH phase
- Do not proceed to next phase if current phase has issues
- Document any deviations from plan
- If stuck, ask for help rather than skipping steps

---

## Success Criteria

### Technical
- [ ] All dependencies updated to latest stable versions
- [ ] Zero high/critical security vulnerabilities (`npm audit`)
- [ ] TypeScript compilation with no errors
- [ ] All ESLint rules passing
- [ ] All tests passing
- [ ] Bundle size reduced by 15-30%
- [ ] App builds successfully on all platforms

### Functional
- [ ] 100% feature parity with v1.0.3
- [ ] All Hive blockchain operations work
- [ ] State persists correctly
- [ ] No regressions in UI/UX
- [ ] Custom URI handlers work
- [ ] Cross-platform compatibility maintained

### Code Quality
- [ ] Modern TypeScript with strict mode
- [ ] React 18 with functional components and hooks
- [ ] Redux Toolkit with proper typing
- [ ] Secure Electron configuration
- [ ] Proper error handling
- [ ] Clean code (Prettier formatted)

---

## Post-Upgrade Tasks

1. **Version Bump**: Update `package.json` version to `2.0.0`
2. **Changelog**: Create comprehensive CHANGELOG.md
3. **Release Notes**: Document all changes for users
4. **CI/CD**: Update Travis CI configuration
5. **Documentation**: Update all docs with new tech stack
6. **Community**: Announce upgrade on Hive (if applicable)

---

## Conclusion

This comprehensive modernization plan will transform Vessel from a 2018-era codebase to a fully modern 2026 application with:

- **TypeScript** for type safety
- **React 18** with functional components and hooks
- **Redux Toolkit** for simpler state management
- **Electron 28** with secure practices
- **Webpack 5** for optimized builds
- **Zero critical security vulnerabilities**

The phased approach ensures safety while the comprehensive testing ensures quality. Following this plan carefully will result in a maintainable, secure, and modern codebase that's future-proof for the next 3-5 years.
