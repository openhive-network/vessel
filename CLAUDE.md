# CLAUDE.md - Vessel Desktop Wallet

## Project Overview

Vessel is a desktop wallet application for the Hive blockchain. It allows users to manage their Hive accounts, send HIVE/HBD tokens, manage vesting/delegation, and perform other blockchain operations without running a full node. Cross-platform support for macOS, Windows, and Linux via Electron.

**Status**: Experimental lite wallet
**Version**: 2.0.0
**License**: MIT

## Tech Stack

**Core**:
- Electron 43 - Desktop framework
- React 19.2 - UI library (functional components with hooks only; no class components)
- Redux 5 + Redux Toolkit 2 - State management (slices via `createSlice`)
- Redux Persist 6 - State hydration
- React Router 8 - Client-side routing (declarative `HashRouter` under `file://`)
- Mantine 8 (`@mantine/core`, `@mantine/hooks`, `@mantine/form`) + `@tabler/icons-react` - UI components

**Blockchain**:
- hive-tx 7 - Hive API client + signing (pure `@noble` crypto; the sole production Hive client)
- @scure/bip39 - Mnemonic generation
- @noble/hashes + @noble/ciphers - Cryptography (scrypt + AES-GCM key envelopes)
- (`@hiveio/hive-js` is a **devDependency**, retained only for the parity/signing test fixtures)

**Build**:
- electron-vite 5 / Vite 7 - Bundler (main / preload / renderer)
- TypeScript 5 - Type checking (strict; `noImplicitAny` on)
- Node.js >= 24 (see `package.json` engines)

**Quality**:
- ESLint 9 (flat config, `eslint.config.mjs`)
- TypeScript - Static type checking
- Vitest 4 - Unit tests
- Playwright (`_electron`) - End-to-end tests against the real packaged app
- Prettier - Code formatting

## Directory Structure

```
app/                    # Main application source
├── main.dev.ts        # Electron main process entry (window creation, IPC, URI handlers)
├── main/              # Main-process modules (keystore.ts key custody, signUri.ts)
├── preload.ts         # Electron preload script (contextBridge → window.electronAPI)
├── index.tsx          # React 19 entry point (createRoot)
├── App.tsx            # Root app with Provider + PersistGate
├── routes.tsx         # React Router v8 route definitions (HashRouter)
├── menu.js            # Electron menu builder
├── actions/           # Redux action creators / thunks
├── reducers/          # RTK slices (account, keys, preferences, hive, processing)
├── hooks/             # Custom React hooks (redux.ts typed hooks)
├── types/             # TypeScript type definitions
├── containers/        # Redux-connected components (pages)
├── components/        # Presentational React components (Mantine)
├── store/             # Redux store configuration (configureStore + persist)
├── utils/             # hiveApi facade, broadcast.ts, keyEnvelope.ts, authorityRoles.ts, …
└── img/               # Image assets

assets/                # Build assets (icons for all platforms)
build/                 # Packaging helpers (afterPackIcon.js, vessel.icon for macOS 26)
e2e/                   # Playwright _electron specs
```

## Development Commands

```bash
# Development
npm run dev            # Start electron-vite dev with hot reload
npm run build          # Bundle main/preload/renderer into out/

# Testing & Quality
npm run verify         # The gate: typecheck && lint && test
npm test               # Run Vitest unit tests
npm run test-e2e       # Run Playwright _electron e2e (needs a prior build)
npm run test:testnet   # Opt-in live mirrornet broadcast smoke (.env creds; see .env.example)
npm run lint           # ESLint check
npm run lint-fix       # Auto-fix lint issues
npm run typecheck      # TypeScript type check

# Production
npm start              # Build then run the production build (unpackaged)
npm run package        # Create installers via electron-builder
npm run package-win    # Windows only
npm run package-linux  # Linux only
```

## Key Files

| File | Purpose |
|------|---------|
| `app/main.dev.ts` | Electron main process, window creation, IPC handlers, URI handlers |
| `app/main/keystore.ts` | Main-process key custody: encrypted-envelope store + sign/memo IPC (renderer never holds a WIF) |
| `app/preload.ts` | contextBridge exposing `window.electronAPI` (keystore + shell) |
| `app/index.tsx` | React 19 bootstrap with createRoot |
| `app/App.tsx` | Redux Provider, PersistGate, MantineProvider |
| `app/routes.tsx` | React Router v8 page routing (HashRouter) |
| `app/hooks/redux.ts` | Typed useAppDispatch and useAppSelector hooks |
| `app/store/configureStore.ts` | RTK store with redux-persist v6 + keystore migration |
| `app/utils/hiveApi.ts` | Facade over hive-tx (the only module importing the Hive client) |
| `app/utils/broadcast.ts` | Op construction + sign/broadcast seam (signs via main-process keystore) |
| `app/utils/keyEnvelope.ts` | scrypt + AES-GCM v2 key envelope (encrypt/decrypt) |
| `electron.vite.config.ts` | electron-vite build config (main/preload/renderer) |
| `eslint.config.mjs` | ESLint 9 flat config |
| `tsconfig.json` | TypeScript compiler config |
| `.prettierrc` | Prettier formatting config |

## Coding Conventions

**Style**:
- ESLint 9 flat config
- 2 spaces indentation (JS/TS/JSON/CSS)
- TypeScript for type safety
- Prettier for consistent formatting

**Redux**:
- RTK slices (`createSlice`); action constants stay `UPPER_SNAKE_CASE` for the legacy async trio
- Async actions: suffixed with `_STARTED`, `_RESOLVED`, `_FAILED`
- Immutable state updates (Immer via RTK)
- Use `useAppDispatch` and `useAppSelector` hooks

**React**:
- Functional components with hooks (React 19) — no class components
- PascalCase for component files (.tsx)
- Mantine for UI elements
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
- Redux store with 5 slices: `account`, `keys`, `preferences`, `hive`, `processing`
- Redux-persist v6 for state hydration (PersistGate)
- Thunks (bundled by RTK) for async operations
- Typed hooks for dispatch and selectors

**Key custody & security** (the wallet's core invariant):
- Private keys live as scrypt+AES-GCM v2 envelopes; the **main process** owns the keystore and performs signing/memo crypto — a decrypted WIF never enters the renderer or Redux/localStorage.
- Post-HF28 authority-role gate: an op is refused unless the loaded key satisfies the required role (recomputed in main from the actual ops).
- Windows run `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; strict CSP in production; IPC gated by a sender-frame allowlist.

**Component Structure**:
- `containers/` - Page-level (Redux-connected) components
- `components/` - Presentational components
- Hierarchy: App → Routes → Page → Components

**Electron**:
- Single instance lock (prevents multiple windows)
- Custom URI protocols: `hive://` and `vessel://` (sign flow with confirm + unlock)
- Separate main/preload/renderer builds via electron-vite

## CI/CD Notes

**GitLab CI** (`.gitlab-ci.yml`):
- Image: `node:24`
- Pipeline: verify (typecheck+lint+test) → build (electron-vite) → e2e (Playwright under xvfb) → package (tag-gated)
- macOS packaging is a manual local `npm run package` step (no hosted mac runner)

## Network Configuration

Default Hive nodes configurable in settings:
- Mainnet: `api.hive.blog`
- Beacon-ranked node picker (`beacon.peakd.com`), plus custom nodes, Mirrornet, and Testnet toggle

## Key Features

- Send HIVE/HBD tokens
- Manage savings accounts
- Delegation and vesting operations
- Witness voting
- HBD ↔ HIVE conversion
- Transaction history
- Multiple account support
- Exchange address book (Binance, Bittrex, etc.)
