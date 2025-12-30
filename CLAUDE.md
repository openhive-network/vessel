# CLAUDE.md - Vessel Desktop Wallet

## Project Overview

Vessel is a desktop wallet application for the Hive blockchain. It allows users to manage their Hive accounts, send HIVE/HBD tokens, manage vesting/delegation, and perform other blockchain operations without running a full node. Cross-platform support for macOS, Windows, and Linux via Electron.

**Status**: Experimental lite wallet
**Version**: 1.0.3
**License**: MIT

## Tech Stack

**Core**:
- Electron 4.2.11 - Desktop framework
- React 16.4.0 - UI library
- Redux 4.0.5 - State management
- Semantic UI React 0.88.2 - UI components

**Blockchain**:
- @hiveio/hive-js 2.0.4 - Hive API client
- bip39 2.6.0 - Mnemonic generation
- crypto-js 3.1.9-1 - Cryptography

**Build**:
- Webpack 2.7.0 - Module bundler
- Babel 6 - Transpiler
- Node.js 6.x (see .nvmrc)

**Quality**:
- ESLint 6.8.0 (Airbnb config)
- Flow 0.116.1 - Type checking
- Jest 19.0.2 - Testing

## Directory Structure

```
app/                    # Main application source
├── main.dev.js        # Electron main process entry
├── index.js           # React entry point
├── app.js             # Redux provider setup
├── routes.js          # Route definitions
├── menu.js            # Electron menu builder
├── actions/           # Redux action creators
├── reducers/          # Redux reducers
├── containers/        # Redux-connected components (pages)
├── components/        # Presentational React components
├── store/             # Redux store configuration
├── utils/             # Utility functions
├── semantic-ui/       # Semantic UI CSS/JS
└── img/               # Image assets

assets/                # Build assets (icons for all platforms)
internals/             # Build helpers and Flow types
flow-typed/            # Generated Flow type definitions
```

## Development Commands

```bash
# Development
npm run dev            # Start with hot reload
npm run build          # Build main and renderer
npm run build-dll      # Build DLL cache (faster dev rebuilds)

# Testing & Quality
npm test               # Run Jest tests
npm run lint           # ESLint check
npm run lint-fix       # Auto-fix lint issues
npm run flow           # Flow type check

# Production
npm start              # Run production build
npm run package        # Create installers (all platforms)
npm run package-win    # Windows only
npm run package-linux  # Linux only
```

## Key Files

| File | Purpose |
|------|---------|
| `app/main.dev.js` | Electron main process, window creation, URI handlers |
| `app/index.js` | React bootstrap and render |
| `app/routes.js` | Page routing configuration |
| `app/reducers/index.js` | Root reducer combining all state |
| `app/actions/account.js` | Core wallet actions (send, delegate, vote) |
| `webpack.config.base.js` | Base webpack configuration |
| `.babelrc` | Babel transpilation config |
| `.eslintrc` | ESLint rules |
| `.flowconfig` | Flow type checker config |

## Coding Conventions

**Style**:
- ESLint Airbnb configuration
- 2 spaces indentation (JS/JSON/CSS)
- Flow type annotations on functions and components

**Redux**:
- Action constants: `UPPER_SNAKE_CASE`
- Async actions: suffixed with `_STARTED`, `_RESOLVED`, `_FAILED`
- Immutable state updates only

**React**:
- Class components (legacy codebase)
- PascalCase for component files
- Semantic UI React for UI elements

**Naming**:
- Components: `PascalCase.js`
- Actions/reducers: `camelCase.js`

## Architecture

**State Management**:
- Redux store with 5 reducers: `account`, `keys`, `preferences`, `hive`, `processing`
- Redux-persist for state hydration
- Redux-thunk for async operations

**Component Structure**:
- `containers/` - Redux-connected smart components (pages)
- `components/` - Presentational components
- Hierarchy: Root → App → Routes → Page → Components

**Electron**:
- Single instance lock (prevents multiple windows)
- Custom URI protocols: `hive://` and `vessel://`
- Separate main/renderer process builds

## CI/CD Notes

**Travis CI** (`.travis.yml`):
- Node versions: 6, 7
- Ubuntu with build tools
- Pipeline: lint → test → build → e2e → package

**No GitLab CI** configured in this repo.

## Network Configuration

Default Hive nodes configurable in settings:
- Mainnet: `api.hive.blog`
- Supports custom nodes, Mirrornet, Testnet

## Key Features

- Send HIVE/HBD tokens
- Manage savings accounts
- Delegation and vesting operations
- Witness voting
- HBD ↔ HIVE conversion
- Transaction history
- Multiple account support
- Exchange address book (Binance, Bittrex, etc.)
