# CLAUDE.md - Vessel Desktop Wallet

## Project Overview

Vessel is a desktop wallet application for the Hive blockchain. It allows users to manage their Hive accounts, send HIVE/HBD tokens, manage vesting/delegation, and perform other blockchain operations without running a full node. Cross-platform support for macOS, Windows, and Linux via Electron.

**Status**: Experimental lite wallet
**Version**: 2.0.0
**License**: MIT

## Tech Stack

**Core**:
- Electron 28.2.0 - Desktop framework
- React 18.2.0 - UI library (functional components with hooks)
- Redux 4.2.1 - State management
- Redux Persist 6.0.0 - State hydration
- React Router 6.22.0 - Client-side routing
- Semantic UI React 2.1.5 - UI components

**Blockchain**:
- @hiveio/hive-js 2.0.4 - Hive API client
- bip39 2.6.0 - Mnemonic generation
- crypto-js 3.1.9-1 - Cryptography

**Build**:
- Webpack 5.90.0 - Module bundler
- Babel 7.24.0 - Transpiler
- TypeScript 5.3.3 - Type checking
- Node.js 18.x (see .nvmrc)

**Quality**:
- ESLint 6.8.0 (Airbnb config)
- TypeScript - Static type checking
- Jest 29.7.0 - Testing
- Prettier - Code formatting

## Directory Structure

```
app/                    # Main application source
├── main.dev.ts        # Electron main process entry (TypeScript)
├── preload.ts         # Electron preload script
├── index.tsx          # React 18 entry point
├── App.tsx            # Root app with Provider setup
├── routes.tsx         # React Router v6 route definitions
├── menu.js            # Electron menu builder
├── actions/           # Redux action creators
├── reducers/          # Redux reducers
├── hooks/             # Custom React hooks (redux.ts)
├── types/             # TypeScript type definitions
├── containers/        # Redux-connected components (pages)
├── components/        # Presentational React components
├── store/             # Redux store configuration
├── utils/             # Utility functions (hiveApi.ts)
├── semantic-ui/       # Semantic UI CSS/JS
└── img/               # Image assets

assets/                # Build assets (icons for all platforms)
internals/             # Build helpers
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
npm run typecheck      # TypeScript type check

# Production
npm start              # Run production build
npm run package        # Create installers (all platforms)
npm run package-win    # Windows only
npm run package-linux  # Linux only
```

## Key Files

| File | Purpose |
|------|---------|
| `app/main.dev.ts` | Electron main process, window creation, URI handlers |
| `app/preload.ts` | Electron preload script for secure IPC |
| `app/index.tsx` | React 18 bootstrap with createRoot |
| `app/App.tsx` | Redux Provider and PersistGate setup |
| `app/routes.tsx` | React Router v6 page routing |
| `app/hooks/redux.ts` | Typed useAppDispatch and useAppSelector hooks |
| `app/store/configureStore.ts` | Redux store with redux-persist v6 |
| `app/utils/hiveApi.ts` | Promise-based wrapper for hive-js |
| `app/types/hive.d.ts` | TypeScript definitions for @hiveio/hive-js |
| `webpack.config.base.js` | Base webpack 5 configuration |
| `babel.config.js` | Babel 7 transpilation config |
| `tsconfig.json` | TypeScript compiler config |
| `.prettierrc` | Prettier formatting config |

## Coding Conventions

**Style**:
- ESLint Airbnb configuration
- 2 spaces indentation (JS/TS/JSON/CSS)
- TypeScript for type safety
- Prettier for consistent formatting

**Redux**:
- Action constants: `UPPER_SNAKE_CASE`
- Async actions: suffixed with `_STARTED`, `_RESOLVED`, `_FAILED`
- Immutable state updates only
- Use `useAppDispatch` and `useAppSelector` hooks

**React**:
- Functional components with hooks (React 18)
- PascalCase for component files (.tsx)
- Semantic UI React for UI elements
- Use `useEffect` instead of lifecycle methods

**TypeScript**:
- Components: `PascalCase.tsx`
- Types: in `app/types/` directory
- Use strict mode

**Naming**:
- Components: `PascalCase.tsx`
- Actions/reducers: `camelCase.ts`
- Hooks: `useXxx.ts`

## Architecture

**State Management**:
- Redux store with 5 reducers: `account`, `keys`, `preferences`, `hive`, `processing`
- Redux-persist v6 for state hydration (PersistGate)
- Redux-thunk for async operations
- Typed hooks for dispatch and selectors

**Component Structure**:
- `containers/` - Page-level components
- `components/` - Presentational components
- Hierarchy: App → Routes → Page → Components

**Electron**:
- Single instance lock (prevents multiple windows)
- Custom URI protocols: `hive://` and `vessel://`
- Separate main/renderer process builds
- Context isolation with preload script

## CI/CD Notes

**Travis CI** (`.travis.yml`):
- Node versions: 18, 20
- Ubuntu with build tools
- Pipeline: lint → test → build → e2e → package

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
