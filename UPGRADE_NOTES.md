# Vessel v2.0.0 Upgrade Notes

This document describes the major changes in the v2.0.0 modernization upgrade.

## Breaking Changes

### Node.js Version
- **Before**: Node.js 6.x
- **After**: Node.js 18.x or higher

Update your Node.js installation before running `npm install`.

### React Version
- **Before**: React 16.4.0 (class components)
- **After**: React 18.2.0 (functional components with hooks)

Key changes:
- `ReactDOM.render()` → `createRoot().render()`
- `componentWillMount` → `useEffect` with empty deps
- `componentWillReceiveProps` → `useEffect` with deps
- Class components → Functional components with hooks

### React Router
- **Before**: React Router v4 with `react-router-redux` and `connected-react-router`
- **After**: React Router v6

Key changes:
- `<Switch>` → `<Routes>`
- `<Route component={X}>` → `<Route element={<X />}>`
- `withRouter` HOC → `useNavigate`, `useLocation`, `useParams` hooks
- No more `connected-react-router` - use React Router hooks directly

### Redux Persist
- **Before**: redux-persist v4 with `autoRehydrate`
- **After**: redux-persist v6 with `PersistGate`

Key changes:
- `autoRehydrate()` enhancer removed
- Use `persistReducer()` wrapper
- Use `<PersistGate>` component in React tree

### Webpack
- **Before**: Webpack 2.7.0
- **After**: Webpack 5.90.0

Key changes:
- `extract-text-webpack-plugin` → `mini-css-extract-plugin`
- `babili-webpack-plugin` → `terser-webpack-plugin`
- `url-loader`/`file-loader` → Asset modules (`type: 'asset'`)
- `webpack-merge` uses named export: `{ merge }`
- DevServer config restructured (`contentBase` → `static`)

### Babel
- **Before**: Babel 6 with `.babelrc`
- **After**: Babel 7 with `babel.config.js`

Key changes:
- All packages renamed `babel-*` → `@babel/*`
- `babel-polyfill` removed (use `core-js` with `useBuiltIns: 'usage'`)
- `babel-register` removed
- `@babel/preset-typescript` added for TypeScript support

### Electron
- **Before**: Electron 4.2.11
- **After**: Electron 28.2.0

Key changes:
- BrowserWindow requires `webPreferences` object
- `nodeIntegration` must be explicitly set
- Preload script recommended for secure IPC
- `shell.openExternal()` via IPC instead of direct access

### TypeScript Added
New TypeScript support throughout:
- `tsconfig.json` configuration
- `.tsx` files for React components
- `.ts` files for utilities and store
- Type definitions in `app/types/`

## Removed Dependencies

- `babel-polyfill` - replaced by `core-js` with `useBuiltIns: 'usage'`
- `babel-register` - not needed with Babel 7
- `babili-webpack-plugin` - replaced by `terser-webpack-plugin`
- `connected-react-router` - use React Router hooks
- `devtron` - deprecated
- `electron-config` - use native electron-store
- `extract-text-webpack-plugin` - replaced by `mini-css-extract-plugin`
- `fbjs-scripts` - check-dev-engines not needed
- `file-loader` - use Webpack 5 asset modules
- `flow-bin`, `flow-runtime`, `flow-typed` - replaced by TypeScript
- `node-sass` - replaced by `sass` (Dart Sass)
- `react-addons-test-utils` - deprecated
- `react-hot-loader` - not needed with React 18 Fast Refresh
- `react-intl-redux` - use react-intl directly with Context
- `react-router` (separate package) - included in react-router-dom v6
- `react-router-redux` - use React Router hooks
- `spectron` - deprecated, use Playwright
- `url-loader` - use Webpack 5 asset modules

## New Dependencies

- `@babel/core`, `@babel/preset-*` - Babel 7 packages
- `@types/*` - TypeScript type definitions
- `buffer`, `crypto-browserify`, `stream-browserify` - Node polyfills for Webpack 5
- `core-js` - Modern polyfills
- `css-minimizer-webpack-plugin` - CSS optimization
- `fomantic-ui-css` - Updated Semantic UI fork
- `mini-css-extract-plugin` - CSS extraction
- `sass` - Dart Sass (replaces node-sass)
- `terser-webpack-plugin` - JS minification
- `typescript` - TypeScript compiler
- `webpack-cli` - Webpack 5 CLI (separate package)

## Migration Steps

1. **Update Node.js** to v18.x or higher
2. **Delete** `node_modules/` and `package-lock.json`
3. Run `npm install`
4. Run `npm run build-dll`
5. Run `npm run dev` to test

## File Changes Summary

### Renamed/Moved Files
- `app/index.js` → `app/index.tsx`
- `app/app.js` → `app/App.tsx`
- `app/routes.js` → `app/routes.tsx`
- `app/main.dev.js` → `app/main.dev.ts`
- `app/store/configureStore.js` → `app/store/configureStore.ts`
- `app/reducers/index.js` → `app/reducers/index.ts`
- `.babelrc` → `babel.config.js`

### New Files
- `app/preload.ts` - Electron preload script
- `app/hooks/redux.ts` - Typed Redux hooks
- `app/types/hive.d.ts` - Hive.js type definitions
- `app/utils/hiveApi.ts` - Promise-based Hive API wrapper
- `app/containers/AppContainer.tsx` - Simple app wrapper
- `tsconfig.json` - TypeScript configuration
- `.prettierrc` - Prettier configuration
- `UPGRADE_NOTES.md` - This file

### Removed Files
- `app/store/configureStore.dev.js`
- `app/store/configureStore.prod.js`
- `app/containers/Root.js`
- `app/containers/App.js`
- `.babelrc`
- `.flowconfig`
- `flow-typed/` directory

## Known Issues

1. **Gradual TypeScript Migration**: Not all files are converted to TypeScript yet. Legacy `.js` files in `containers/`, `components/`, `actions/`, and some `reducers/` still use Flow or plain JavaScript. Convert as needed.

2. **Form Components**: `formsy-react` and `formsy-semantic-ui-react` updated but may need component updates for React 18 compatibility.

3. **Test Updates Needed**: Test files need to be updated for Jest 29 and React 18 testing library patterns.
