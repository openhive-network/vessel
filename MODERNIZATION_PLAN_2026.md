# Vessel Modernization Plan — August 2026

**Supersedes:** PLAN.md and UPGRADE_NOTES.md (the 2.0.0 WIP-era documents). Those describe a plan whose infrastructure half was executed and whose application half was not; this document replaces them.

**Branch context:** `backup/wip-modernization-2026-08` — a committed work-in-progress from the earlier modernization effort.

---

## 1. Executive Summary

### Where the project actually stands

The previous modernization completed the *shell* and none of the *body*. TypeScript infra, webpack 5, React 18 entry points, React Router v6 routing, Electron 28, and a preload script all exist — but only 14 `.ts/.tsx` files were ever created (entry/infra files), while **~61–68 legacy `.js` source files** (discovery agents' counts differ — recount at Phase 5 start; most carry Flow annotations, ~51–55 are class components, 8 use `componentWillReceiveProps`) remain untouched across `app/actions/`, `app/components/`, `app/containers/`, and `app/reducers/`. Redux Toolkit adoption never started.

Worse, the quality gates that appear green are **inert**:

- `npm install` fails outright on any npm ≥ 10 (`Invalid property "devEngines.node"` in root `package.json`) — every npm command in the repo is unrunnable on a current toolchain.
- `npm run lint` passes because `.eslintignore` line 1 is `app` — zero application code is linted. Linting `app/` for real yields **4,434 errors**.
- `tsc --noEmit` passes because `strict: false` and an explicit `noImplicitAny: false` (which silently neuters even a CLI `--strict`) check only the 14 new files; forcing `--noImplicitAny` reveals 17 TS7016 errors.
- **Zero tests exist**; `jest --passWithNoTests` is a permanent no-op green. Travis CI references a `test-e2e` script that does not exist, and Travis itself is defunct for this repo.
- The Electron hardening documented in CLAUDE.md/UPGRADE_NOTES is **not implemented**: both BrowserWindows run `nodeIntegration: true, contextIsolation: false`; `app/preload.ts` is never compiled by any webpack config and `window.electronAPI` is used by zero files; 6 renderer files `require('electron')` directly.
- The only genuinely healthy parts: both production webpack builds compile cleanly, and the deleted-legacy-entry-point cleanup was done properly.

### What "up to date in Aug 2026" means

- **Runtime:** Node 24 (Active LTS through Apr 2028). Node 18 (pinned in `.nvmrc`) went EOL Apr 2025; Node 20 EOL Apr 2026.
- **Electron:** latest supported major (only the newest 3 majors receive security patches; 28 is years past EOL — a real exposure for a wallet).
- **React 19.2 / react-router v8 / ESLint 10 flat config / Babel-free esbuild pipeline / Vitest + Playwright.**
- **Hive ecosystem:** hive-js survives on ~1 release/year; the modern, actively maintained clients are hive-tx v7 (@noble crypto, TS-native, what Hive Keychain uses) and dhive. HF28 is live on mainnet (stricter authority matching affects broadcast paths); HF29 is unscheduled.
- **Wallet-grade crypto:** crypto-js is officially discontinued (lockfile resolves it to 3.3.0, and the `^3.1.9-1` pin cannot even reach the 4.2.0 CVE fix) and Vessel uses its worst mode (passphrase-mode AES = MD5 single-iteration EVP_BytesToKey) to encrypt users' private keys at rest. The keystore itself lands in the **renderer's `localStorage`** (via redux-persist's default `storage`) — not a main-process store, not the OS keychain — and inside it **memo private keys are stored in plaintext unconditionally**, while the main WIF is plaintext whenever the user unchecks "Encrypt this Wallet." Combined with full `nodeIntegration` + a one-click `hive://sign` broadcast path, this is the single most urgent cluster in the plan. (Full findings: §4, from a dedicated wallet-grade security review.)

### ⛔ Non-negotiable invariant — existing keystores must never break

**The one requirement that overrides every other goal in this plan: a user who already has accounts imported and encrypted in the current Vessel must be able to unlock and use them, unchanged, on every build we ship.** No modernization step — not the redux-persist layout, not the crypto envelope, not the RTK conversion, not the move to main-process custody — is allowed to make an existing key unreadable, even transiently, even if it "looks empty" for a moment.

This is enforced concretely, not by good intentions (full detail in D9's three-layer backwards-compatibility contract):
1. **Storage layout** — the shipped app writes keys to localStorage under redux-persist **v4** (`reduxPersist:keys`); the WIP reads redux-persist **v6** (`persist:root`). *These don't match today — the committed WIP would show an existing user an empty wallet.* Phase 1 adds a password-free, non-destructive migration that copies the old blob into the new layout verbatim.
2. **`keys` slice shape** — preserved byte-for-byte through the RTK conversion, or a tested `migrate` ships with it.
3. **WIF ciphertext** — the legacy crypto-js/OpenSSL-MD5 format stays decryptable **forever** via a permanent legacy read path; re-encryption to the strong envelope happens lazily on the user's next unlock, never destructively.

**Migration is always read-old → write-new → verify → keep-old.** The legacy data and read path are retained for at least one release so any build can be rolled back without a user ever losing a key. Every change touching keys is gated on a round-trip test against a **real shipped-format profile** and requires a second reviewer.

### Headline decisions

Fix the toolchain to a working baseline first (Phase 0), then fix the two live fires — at-rest key encryption and the HF28 authority-role selection that is failing broadcasts on mainnet today (Phase 1), migrate the build to electron-vite so the preload can finally compile (Phase 2), then harden Electron — context isolation, main-process key custody, and the URI signing gate — and stage the Electron upgrade (Phase 3), swap the Hive client to hive-tx behind a facade (Phase 4), and only then burn down the legacy backlog with Redux Toolkit (Phase 5). React 19 and the replacement of the discontinued Semantic UI ship last, together (Phase 7), because they gate each other. Every phase is independently shippable.

---

## 2. Decisions

Each decision states the choice, the rationale, and rejected alternatives. These are decisions, not options.

### D1 — Hive client library: **migrate to hive-tx v7**, behind a mandatory facade
- **Decision:** Adopt `hive-tx` 7.x as the sole Hive client, accessed exclusively through a revived `app/utils/hiveApi.ts` facade.
- **Rationale:** hive-tx 7 is a full TS rewrite on `@noble/curves` + `@noble/hashes` with 4 modern deps and no node polyfills, active weekly cadence (7.2.0 May 2026), Node 20+ engines, and is what Hive Keychain — the ecosystem's most security-sensitive JS wallet — runs on. hive-js (~1 release/yr, ws@3/debug@2/bluebird/bigi-era deps) is the reason the webpack config carries crypto-browserify/stream-browserify/Buffer polyfills at all. The facade is a prerequisite regardless: `hiveApi.ts` is currently **dead code imported by zero files** while 14 files import `@hiveio/hive-js` directly, and it lacks several methods the app actually uses (`getConversionRequests`, `transferToVesting`, `createAccount`, `wifIsValid`, `generateKeys`, `PrivateKey.fromString`).
- **Rejected:** *dhive* — most-used and TS-native, but still ships secp256k1@3 native binding (electron-rebuild liability) and node-fetch@2, so polyfills stay. *@hiveio/wax + beekeeper* — official long-term stack, but ~850 dl/mo adoption and beekeeper's key custody conflicts head-on with Vessel's own encrypted-WIF store. *Stay on hive-js* — 0.5 days of work but locks in every polyfill and the untyped surface.

### D2 — Bundler: **electron-vite** (v5, Vite 7; move to v6 when it exits beta for Vite 8)
- **Decision:** Replace all 6 webpack configs, the DLL machinery, and `babel.config.js` with one `electron.vite.config.ts` (main / preload / renderer sections). Keep electron-builder as packager.
- **Rationale:** Fixes the never-compiled `app/preload.ts` by making preload a first-class build target (prerequisite for context isolation); deletes the `document.write`/DLL-injection `app.html`; deletes the 3×-duplicated CSS-modules loader blocks that serve exactly one `import './app.global.css'`. Community-standard for Electron in 2026.
- **Rejected:** *Electron Forge* — its Vite plugin is still officially experimental in 7.11 and would force replacing electron-builder and re-authoring the whole `build` block. *Keep webpack* — viable but leaves 5 configs + babel-loader + hand-maintained HTML with no build owner, the exact conditions that produced the current rot.

### D3 — ESLint: **ESLint 10 flat config; drop airbnb permanently**
- **Decision:** `eslint.config.js` on ESLint 10 with `typescript-eslint` 8.x, `eslint-plugin-react` 7.37, `eslint-plugin-react-hooks` 7.x (flat presets), `eslint-config-prettier` last. Delete `eslint-config-airbnb`, `eslint-import-resolver-webpack`, `.eslintrc`, `app/.eslintrc`, `.eslintignore`, and the committed stale `.eslintcache`.
- **Rationale:** eslint-config-airbnb's last release was Dec 2021 with no flat-config/ESLint 9+ support and an official "not soon" from maintainers — it is a replacement item, not an upgrade. The webpack import resolver is outright broken by the two-package layout (emits a MODULE_NOT_FOUND stack per import; a real lint run produced 17 MB of noise and never finished). Prettier + `--fix` erases the ~1,500–2,000 pure-formatting errors of the 4,434 in one mechanical commit.
- **Rejected:** *FlatCompat bridge for airbnb* — pins us to an unmaintained ruleset; acceptable only as a same-day unblock, never permanent. *eslint-config-airbnb-extended / -flat forks* — v9/v10 support unconfirmed or dead-ended.

### D4 — Test stack: **Vitest 4 (unit) + Playwright `_electron` (e2e)**
- **Decision:** Vitest after the electron-vite migration (reuses the Vite config, ~10 lines); Playwright 1.6x `_electron` for a 3–5-test smoke suite. Delete the inline Jest block, `jest`, `babel-jest`, `identity-obj-proxy`, `internals/mocks/fileMock.js`. Remove `--passWithNoTests` the moment the first spec lands.
- **Rationale:** Zero existing tests means zero porting cost — the cheapest migration moment there will ever be. Playwright `_electron` is the only maintained Electron e2e option (Spectron archived 2022); the phantom `test-e2e` Travis step gets a real implementation.
- **Rejected:** *Jest 30* — the right call only if we stayed on webpack; do not run Vitest against a webpack build.

### D5 — Redux: **adopt Redux Toolkit 2.x during the reducer conversion; keep redux-persist pinned as a watch item**
- **Decision:** Convert the 5 legacy reducers + 5 action files to RTK `createSlice`/`createAsyncThunk` as part of the TS migration (Phase 5), rather than a 1:1 JS→TS transliteration followed by a second rewrite. Keep `redux-persist` 6 pinned (inactive upstream but functional); re-evaluate persistence when the key-envelope work (Phase 1) and RTK land.
- **Rationale:** Phase 4 of the old plan never started, so there is no sunk cost in the legacy action/reducer shapes; converting once (to RTK) is cheaper than twice. redux-persist is inactive but not dead; the community handoff is unresolved — pin and monitor.
- **Rejected:** *Rip out redux-persist now* — unnecessary churn on top of a key-format data migration in the same storage layer. *Plain redux + hand-rolled thunks in TS* — double conversion cost.

### D6 — React: **stay on 18.2 through the class-component burn-down; move to 19.2 in Phase 7 together with the UI-library swap**
- **Decision:** All class→hooks conversions happen on React 18. React 19.2 lands in Phase 7, in the same workstream that replaces Semantic UI.
- **Rationale:** React 19 removes exactly what the legacy code uses (string refs, defaultProps on functions, legacy context, propTypes), and `semantic-ui-react` — discontinued upstream — has **unconfirmed React 19 compatibility** (open issue #4510, unresolved). Converting to hooks first makes the 19 codemods near-mechanical; bumping React while the dead UI library still can't confirm 19 support risks an unshippable intermediate state.
- **Rejected:** *React 19 first* — blocked by semantic-ui-react; *stay on 18 indefinitely* — 18 will age out of the "current" window during this plan's lifetime.

### D7 — UI library: **replace semantic-ui-react/fomantic-ui-css with Mantine, incrementally, in Phase 7**
- **Decision:** Mantine as the target component library, migrated container-by-container (not big-bang), paired with the React 19 bump.
- **Rationale:** Semantic UI React and Fomantic CSS are both discontinued — this is the single biggest ecosystem risk in the app and the largest workstream. Mantine is actively maintained, batteries-included (forms, modals, tables — matching Vessel's UI surface), and needs no separate CSS framework decision. `formsy-react`/`formsy-semantic-ui-react` are replaced in the same stroke by Mantine's `useForm` (formsy-semantic-ui-react exists purely as a binding to the dead library).
- **Rejected:** *Radix+Tailwind* — maximal flexibility, but a headless approach costs more design effort than a maintenance-mode wallet warrants. *MUI/AntD* — viable; Mantine chosen for lighter footprint and built-in form story. *Keep Semantic UI pinned forever* — blocks React 19 and accumulates unpatched risk. **This is the one decision where a maintainer veto is cheap before Phase 7 starts — flag for confirmation.**

### D8 — Electron: **staged upgrade 28 → latest supported stable; never a single jump**
- **Decision:** After the preload compiles (Phase 2) and hardening lands (Phase 3), bump Electron in staged hops (e.g. 28→31→34→37→latest), verifying preload/contextBridge behavior, native-module rebuilds, and the `hive://`/`vessel://` protocol handlers at each stop. Update `browserslist`/esbuild `chrome` targets to match the final Chromium.
- **Rationale:** ~13+ majors of drift; only the latest 3 majors are supported; 8-week cadence. A wallet on an EOL Chromium is a genuine security exposure. Two discovery agents disagreed on the exact current stable (41.2.1 vs 43.2.0 — see Open Questions); the decision is "latest stable at execution time," which sidesteps the discrepancy.
- **Rejected:** *Single 28→latest jump* — too many simultaneous breaking surfaces to bisect; *stay on 28* — indefensible for a wallet.

### D9 — Key-storage architecture: **strong KDF envelope now (Phase 1); private keys out of the renderer into main-process custody with signing over IPC (Phase 3)**
- **Decision — two staged targets, both required:**
  - **D9a (Phase 1, at-rest):** Replace crypto-js entirely with a strong KDF envelope — scrypt or Argon2id via `@noble/hashes` (preferred for a wallet password; PBKDF2-SHA256 ≥ 600k iterations is the acceptable WebCrypto-only fallback) + AES-256-GCM, versioned format `{v: 2, kdf, params, salt, iv, ct}`. Decrypt-only shim for the legacy CryptoJS passphrase format; transparent re-encryption to v2 on next successful unlock. **Also in Phase 1:** encrypt memo keys with the same envelope (they are plaintext today) and remove the plaintext-storage path for the main WIF — an unencrypted account is imported and immediately encrypted, never persisted in the clear.
  - **D9b (Phase 3, custody):** Once `contextIsolation` and a real preload/IPC bridge exist, move private-key custody to the **main process** and wrap the keystore with Electron **`safeStorage`** (OS keychain: Keychain / DPAPI / libsecret) layered over the D9a KDF envelope. The renderer requests a *signature* over IPC (`sign(account, ops) → signed tx`) and never receives a WIF. This is what neutralizes the nodeIntegration-RCE-to-key-theft path structurally rather than by hardening alone.
- **Rationale:** crypto-js is officially discontinued; the resolved 3.3.0 carries CVE-2023-46233; and Vessel's actual usage — `CryptoJS.AES.encrypt(wif, password)` in `app/actions/keys.js:104` / decrypt in `app/containers/DecryptPrompt.js:65-66` — is passphrase mode (OpenSSL EVP_BytesToKey, MD5, one iteration), which a 4.2.0 bump does **not** fix. The security review found the keystore lives in renderer `localStorage`, memo WIFs are stored plaintext unconditionally (`app/reducers/keys.js:99,124`), and the main WIF is plaintext on the opt-out path — so "fix the KDF" alone is insufficient; the renderer must stop being where keys live. Highest-priority cluster after the baseline.
- **Backwards-compatibility contract — THREE layers, all mandatory** (established by reading the shipped code on `master` vs. the WIP; this is the single most important correctness requirement in the plan — see the invariant callout in §1):
  1. **Storage layout.** The **shipped** app persists with **redux-persist v4** (`app/store/configureStore.prod.js` on master: `autoRehydrate()` + `persistStore(store, {whitelist:['account','keys','preferences','hive']})`, redux-persist `^4.8.0`), which writes **each slice under its own `reduxPersist:`-prefixed localStorage key** (`reduxPersist:keys`, `reduxPersist:account`, …). The **WIP** switched to **redux-persist v6**, which reads a **single `persist:root` key**. These do not overlap — *the WIP as committed would rehydrate an empty wallet from an existing install* (data intact on disk, but where v6 never looks). Phase 1 must add a one-time, **password-free** migration: on first launch, detect the legacy `reduxPersist:*` keys, read them, and re-persist them into the v6 `persist:root` structure **verbatim** (the WIF ciphertext moves as-is — no decryption needed for this step). Same Electron `appId` (`com.greymass.vessel`) ⇒ same userData ⇒ the old localStorage is physically present after upgrade, so this is a read, not a recovery.
  2. **`keys` slice shape.** `{ names: string[], permissions: { [account]: { account, key, encrypted, type, memo? } } }` — `key` is the WIF *ciphertext* when `encrypted:true` else the plaintext WIF; `memo` is a plaintext WIF; `type` ∈ owner/active/posting (`app/reducers/keys.js:28-31,58-70,95-106`). Every RTK `createSlice` conversion (Phase 5) and every read path must preserve this shape byte-for-byte, or ship a tested redux-persist `migrate`.
  3. **WIF ciphertext format.** `CryptoJS.AES.encrypt(wif, password).toString()` (`app/actions/keys.js:104`) yields OpenSSL-style `"U2FsdGVkX1…"` = base64 of `Salted__` + 8-byte salt + AES-256-CBC, key/iv via **EVP_BytesToKey(MD5, 1 iteration)**. The new envelope's legacy path must decrypt exactly this **forever**. Because crypto-js is being removed, that means reimplementing the ~20-line OpenSSL-MD5-KDF AES-CBC decrypt (WebCrypto/@noble) — *or* retaining crypto-js solely on the decrypt-only path (acceptable: the CVE is a PBKDF2-DoS, not relevant to decrypting the user's own at-rest blob). Verified against a real shipped-format blob in Phase 1 tests.
- **Non-destructive migration rule:** migration is read-old → write-new → verify-new-decrypts → **only then** proceed; the legacy `reduxPersist:*` keys and the v1 ciphertext read path are **never deleted for at least one release**, so a user can downgrade and a failed migration never costs a key. Snapshot the existing `keys` blob to a backup key before writing anything.
- **Rejected:** *crypto-js 4.2.0 bump* — fixes the PBKDF2 default but not the passphrase-mode KDF actually in use, and leaves keys in the renderer. *safeStorage alone without a wallet-password KDF* — safeStorage's key is readable by any code running as the user, so a compromised renderer/app could read it; the password-derived layer is what protects against local malware and gives a user-known secret. *Keep keys in the renderer with just a stronger envelope* — leaves the RCE-to-key-theft path that §4's [critical] findings all funnel into. *Purge the legacy storage keys after migrating* — rejected; keeping them is what makes the migration reversible.
- **Never ship** any key-format, storage-layout, or custody change without exercising all three layers above against a real shipped-format profile and preserving a permanent legacy read path.

### D10 — Package manager & structure: **npm only; single root package.json; one lockfile**
- **Decision:** Delete `yarn.lock`, `app/yarn.lock`, `app/package-lock.json`; keep root `package-lock.json` (regenerated). Collapse the two-package electron-builder layout into a single root `package.json` **in the same change as** the electron-vite migration and an electron-builder 24→26 bump. Fix `devEngines` (or drop it for `engines`). Delete the dead-host `--disturl=https://atom.io/download/atom-shell` postinstall; remove the DLL-building root postinstall.
- **Rationale:** Every script and CI step is npm-only; yarn.lock is pure drift. `app/package.json` has no dependencies — the externals mechanism it fed is vestigial ([] today) — and its mere existence breaks the ESLint webpack resolver. electron-builder ≥ 8 doesn't need the two-package layout; v25/v26 changed rebuild behavior, so structure change and bump belong together.
- **Rejected:** *pnpm/Yarn Berry* — both would hard-fail today on the formsy peer conflict and add migration surface for zero benefit here.

### D11 — CI: **GitLab CI on gitlab.syncad.com; delete .travis.yml**
- **Decision:** `.gitlab-ci.yml` with: `verify` stage (npm ci → lint, typecheck, test) on `node:24`, npm-cache keyed by lockfile hash; `build` stage (electron-vite build); `package:linux` / `package:win` on `electronuserland/builder:wine`, tags only; Playwright e2e job under `xvfb-run`. macOS packaging: manual local release step unless a tagged mac runner exists (Open Question).
- **Rationale:** The repo lives on gitlab.syncad.com; Travis OSS is defunct and the config is fossilized (g++-4.8, hand-rolled Xvfb, `npm install -g npm@latest` which installs the exact npm that rejects the repo). Today there is effectively **no CI at all**.
- **Rejected:** *GitHub Actions* — repo isn't hosted there; *fix Travis* — dead platform.

### D12 — Supporting decisions (one line each)
- **Node baseline: 24** (Active LTS to Apr 2028); do not chase 26 before its Oct 2026 LTS; note Node's Oct 2026 calendar-versioning model change as a footnote only.
- **TypeScript: stay on 5.9.x through the migration**; evaluate the TS 7 (Go-native) jump after Phase 5, when esbuild transpiles and `tsc` is only the type gate (compiler swap risk then approaches zero). Rejected: jumping to 7.0 mid-migration while editor/tooling ecosystem catches up.
- **react-router: v6 → v8** (`react-router` unified package, ESM-only, official codemod covers ~85–90% of v6→v7) in Phase 6, inside the coordinated ESM workstream; the standalone `history` dep dissolves as a side effect.
- **ESM convergence as one workstream:** electron-vite (ESM-first), react-router v8 (ESM-only) and the Babel-8-vs-delete-Babel question resolve together — and the answer is **delete Babel** (esbuild transpiles; `@babel/plugin-transform-flow-strip-types` survives only inside `@vitejs/plugin-react`'s babel pass until the last `@flow` file is gone).
- **bip39 2.6 → `@scure/bip39`** (same wordlists and derivation, so the user-visible mnemonic UX is unchanged; Uint8Array-based with no Node Buffer; same @noble family as hive-tx), fixing the two dead-API call sites (`app/components/Keys/Generate.js:46`, `app/components/Keys/Create.js:70` — `mnemonicToSeedHex` was removed upstream). Rejected: bip39 3.1.0 — works, but stays Buffer-based, which would force keeping the Buffer polyfill past Phase 4.
- **url-parse → native `URL`**; **react-autocomplete → Downshift**; **react-collapsible → @radix-ui/react-collapsible**; **react-input-range → react-range**; **electron-devtools-installer → electron-extension-installer**; **electron-json-storage → electron-store** — bundled into one "abandoned small deps" cleanup task.
- **react-intl: remove it.** Verified usage is exactly two files — `App.tsx` (an `IntlProvider` hardcoded to `locale="en"`) and `VestingAccounts.js` (`FormattedDate`/`FormattedTime`) — and no message catalogs exist anywhere. Replace the two call sites with native `Intl.DateTimeFormat` during Phase 5's VestingAccounts conversion and drop the dependency. Rejected: the 6.6→10.x multi-major bump — real upgrade cost for a library doing the job of a platform API here.
- **Default node stays `api.hive.blog`**, but refresh the settings node list to the current developers.hive.io set and adopt hive-tx `config.nodes` + `callWithQuorum` for read-path failover.
- **Repo hygiene:** `app/main.prod.js(.map)` and `.DS_Store` are already gitignored and untracked (local-disk cleanup only — no repo change to make); delete `.flowconfig` + `flow-typed/` once the Flow count reaches zero, and the committed stale `.eslintcache`; retire PLAN.md/UPGRADE_NOTES.md in favor of this document.

---

## 3. Phased Roadmap

**Sequencing is driven by breakage risk, not by time.** Two axes decide the order, and they pull against each other:
- **Change-risk** — how likely applying a change is to break something that works today, how far the damage spreads if it does (cosmetic → a feature → all broadcasts → the build → the keystore), and how cleanly it reverts.
- **Standing-risk** — how much danger the code is in *right now* by leaving it alone (a one-click-drain URI and MD5-encrypted keys are live hazards; an old UI library is not).

The rule: **build the safety net before taking any risk, then spend the earned confidence on the highest standing-risk items, and leave the large-but-safe surface for last.** Concretely — (0) make the gates and tests real so breakage is *detectable* at all; then attack the live security/money hazards (high stakes, but each change is de-risked by a hard invariant — e.g. the keystore never loses its legacy read path); then modernize the build substrate (high change-risk, zero money/key exposure, fully reversible); then the deep process-boundary work; then the money-path client swap behind a facade; and only then the wide, mechanical, per-file-reversible surface (the legacy backlog, router, UI). Every phase ends shippable, so work can stop at any boundary without leaving the app half-broken.

Each phase below carries a **Risk:** line in the form *likelihood · blast radius · reversibility* instead of a time estimate.

---

### Phase 0 — Green Baseline (make the existing WIP real)
**Objective:** `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and app launch all succeed on a current toolchain, with the gates still lenient but *honest* — no further upgrades until this is true.

**Tasks:**
1. Fix root `package.json` `devEngines` — replace the malformed string form or delete it in favor of `"engines": {"node": ">=24"}`. (The single hard blocker: breaks *every* npm command on npm ≥ 10.)
2. Add an `overrides` block pinning `react`/`react-dom` for `formsy-semantic-ui-react@1.2.0` (peers React ^15||^16) so `npm ci` passes without silent auto-override. Interim measure until D7 removes formsy entirely.
3. Switch `.nvmrc` to Node 24; regenerate a single root `package-lock.json` on npm 11; **delete** `yarn.lock`, `app/yarn.lock`, `app/package-lock.json`.
4. Neuter the root postinstall's failure modes: drop `--disturl=https://atom.io/download/atom-shell` from `app/package.json` postinstall (dead host) pending its full removal in Phase 2.
5. Delete `app` from `.eslintignore` line 1; set the noisy app/ rules to `warn` temporarily; swap `import/resolver: webpack` → `node` (the webpack resolver is broken by the two-package layout and makes lint non-terminating). Drop `--cache` from the lint script; delete committed `.eslintcache`. Add Prettier + `eslint-config-prettier` and land one mechanical `--fix` commit (erases ~1,500–2,000 of the 4,434 errors).
6. Make tsconfig honest: remove the explicit `noImplicitAny: false` (it silently overrides `--strict`), delete the hand-written stubs in `app/types/modules.d.ts` that shadow real shipped types (redux-persist, react-dom/client, url-parse, history, redux-logger) and the resulting `@ts-expect-error` in `app/App.tsx`; delete dead `outDir` and unused `@/*` paths alias. Fix whatever surfaces (expect the 17 TS7016s to appear when `noImplicitAny` is enabled — acceptable to defer that one flag to Phase 5, but `strict` for the 14 TS files should pass now).
7. Local-disk cleanup only: `app/main.prod.js(.map)` and `app/.DS_Store` are already gitignored and untracked — remove stale local copies so they can't shadow real build output. (No git change to make here.)
8. Update `app/app.html` `<title>` from "Vessel - 1.0.3" (cosmetic, but it's a 30-second lie to stop telling).

**Verification gate:** on a clean checkout with Node 24/npm 11: `npm ci && npm run lint && npm run typecheck && npm run build` all exit 0; `npm run build && npm start` launches the production wallet and the accounts page renders (the path discovery actually verified green). Dev-mode (`npm run dev`) is a stretch check, not a gate — no discovery agent ever exercised it and it rides on the DLL/webpack-dev-server machinery; budget debugging time if it turns out broken rather than blocking the phase on it.
**Rollback:** trivial — all changes are config/lockfile-level; revert commits individually.
**Risk:** *Very low · dev/CI only, no runtime wallet behavior touched · trivial per-commit revert.* Every change here fixes something already broken (install, lint, typecheck, lockfile drift); the failure mode is "a gate still isn't green," not "a working feature broke." This is the phase that makes every later risk **detectable** — nothing riskier should start until it lands.

---

### Phase 1 — Wallet-Grade Crypto + Broadcast Correctness — SECURITY CRITICAL
**Objective:** existing keystores survive intact under the new storage layout; users' private keys are no longer protected by MD5-single-iteration key derivation; and every broadcast selects the correct key role under HF28's stricter authority matching (a live mainnet failure today).

This phase does the **keystore backwards-compat migration (D9 three-layer contract)**, the **at-rest KDF envelope (D9a)**, and the plaintext-key fixes; the deeper **main-process custody (D9b)** waits for the preload/IPC bridge and lands in Phase 3. **Nothing else in this phase merges until Task 0 is proven** — it is the guard on the §1 invariant.

**Tasks:**
0. **Keystore storage-layout migration (D9 layer 1) — do this FIRST, it fixes a break the WIP already has.** On first launch, detect the shipped redux-persist **v4** localStorage keys (`reduxPersist:keys` + `reduxPersist:{account,preferences,hive}`), snapshot them to a backup key, and copy them **verbatim** into the redux-persist **v6** `persist:root` structure — **no password required**, the WIF ciphertext moves untouched. Idempotent (skips if v6 state already exists), non-destructive (never deletes the `reduxPersist:*` keys). Without this, an existing user upgrading to the WIP sees an empty wallet. **Verify the exact legacy key names against a real profile before relying on them** (see Open Questions) — the migration must no-op safely if they are absent rather than wiping anything.
1. Implement the D9a envelope: AES-256-GCM with scrypt/Argon2id via `@noble/hashes` (or PBKDF2-SHA256 ≥ 600k iterations as the WebCrypto-only fallback), versioned format — as a new standalone pure-TS module (e.g. `app/utils/keyEnvelope.ts`) importing nothing from legacy `.js` files. That isolation is deliberate: it's what lets this phase's tests survive the Jest→Vitest swap in Phase 2 (see the Phase 2 test constraint).
2. Legacy decrypt-only shim for the current CryptoJS passphrase format (D9 layer 3: OpenSSL `Salted__` + AES-256-CBC + EVP_BytesToKey/MD5/1-iter; `app/actions/keys.js:104`, `app/containers/DecryptPrompt.js:65-66`). Either reimplement the ~20-line OpenSSL-MD5-KDF decrypt on WebCrypto/@noble or keep crypto-js solely on this decrypt path; lazy re-encrypt to the v2 envelope on next successful unlock; version tag persisted in state. The legacy decrypt path is **permanent**, never removed.
3. **Close the plaintext-key holes** (security review, both [high]): encrypt memo keys with the same envelope — they are stored plaintext unconditionally today at `app/reducers/keys.js:99` and `:124` (`KEY_ADD_AUTH_CONFIRMED`) with no encryption step in `addMemoKeyConfirmed` (`app/actions/keys.js:250-255`); and remove the plaintext main-WIF path — the "Encrypt this Wallet" opt-out (`app/actions/keys.js:101-110`, `app/components/Keys/Import.js:194-199`) must no longer persist a cleartext WIF (import → encrypt → persist; never store `key = wif`).
4. **Fix the DecryptPrompt cleartext leak** ([medium]): `app/containers/DecryptPrompt.js` mutates `auth.key = decrypted` on an object inside the persisted `state.keys.decrypt` slice, so a redux-persist flush while it's set would serialize a plaintext WIF to localStorage (and it's visible to Redux DevTools). Hold the decrypted key outside persisted state (or exclude `decrypt` from the persist whitelist) and clear it immediately after use.
5. Remove `crypto-js` from dependencies once no call sites remain.
6. bip39 2.6 → `@scure/bip39` (D12: same wordlists/derivation, Uint8Array-based, no Buffer); fix the two dead-API call sites (`app/components/Keys/Generate.js:46`, `app/components/Keys/Create.js:70` — `mnemonicToSeedHex` no longer exists upstream).
7. HF28 authority-role audit (pulled ahead of all Electron/build work because it depends on none of it and is a live money-path bug — HF28 activated 2025-11-19): audit every broadcast path for correct key-role selection (active vs posting) per operation type, especially the generic `broadcast.send(operations, keys)` in `app/containers/PromptOperation.js` (which today labels the key `{posting: wif}` regardless of op) and the `hive://`/`vessel://` URI handlers. Post-HF28 a posting key no longer satisfies an active-authority op — lenient paths fail on mainnet now.
8. **First real tests land here** (still on Jest 29, pre-Vitest — that's fine; they import only the pure-TS envelope module). Must include a **real shipped-format profile round-trip exercising all three D9 layers**: seed localStorage with a `reduxPersist:keys` blob holding a crypto-js-encrypted WIF (encrypted account), a plaintext-WIF account, and a plaintext memo key, at a **known password** → migrate to `persist:root` (layer 1) → decrypt with the old password (layer 3) → re-encrypt to v2 → assert it still unlocks after a simulated restart, and that the `keys` slice shape (layer 2) is preserved. Plus: wrong-password rejection, idempotent/absent-key no-op for the migration, and that no memo key or WIF is ever persisted in the clear post-migration. Remove `--passWithNoTests`.

**Verification gate:** the three-layer round-trip test (Task 8) passes; **the decisive manual test — install the *shipped* Vessel, import a real account with an encrypted wallet, then run the new build against that same profile and confirm the account appears and broadcasts a testnet op with the original password** (this is the actual "did we break existing users" check, not a synthetic one); a state blob inspected in localStorage contains **no** cleartext WIF or memo key post-migration; the legacy `reduxPersist:*` keys are still present (non-destructive); on testnet, a posting-authority op signs with the posting key, an active-authority op signs with the active key, and an active-authority op offered only a posting key is rejected client-side before broadcast.
**Rollback:** the legacy storage keys are retained and the v1 ciphertext read path is permanent, so a rollback build reads the old `reduxPersist:*` data and decrypts v1 exactly as before — no data-loss path. Never delete legacy read support. (Note: the plaintext-key hardening is forward-only — a downgrade to a pre-Phase-1 build would resume *writing* plaintext memo keys; the existing keys remain readable throughout. Call this out in release notes.)
**Risk:** *Medium likelihood · blast radius: HIGH (the keystore is users' money; the broadcast path is live) · reverts cleanly for crypto, forward-only for the plaintext-key fix.* This is high-stakes-early **on purpose** — the hazards it fixes (MD5 key encryption, plaintext memo keys, HF28-broken broadcasts) are already live, so the standing-risk of waiting outweighs the change-risk. The change-risk is pinned down by one hard invariant: **the legacy keystore read path is permanent** — a bad build can never make an existing wallet undecryptable. Everything key-touching gets a second reviewer and a both-formats test before it merges.

---

### Phase 2 — Build System: electron-vite + single package.json + GitLab CI
**Objective:** one modern build pipeline; preload actually compiles; CI exists and gates.

**Tasks:**
1. **MR-A:** add `electron.vite.config.ts` with main / **preload** / renderer sections. The webpack configs, `babel.config.js`, `app/app.html`, and the two-package layout stay in-tree until MR-B, so the webpack path genuinely still builds. Config the legacy renderer demands — and treat "the ~60 JSX-in-`.js` Flow files compile under Vite" as a prove-before-committing spike of the same rank as the hive-js signing spike (it is a canonical Vite-migration failure mode): `@vitejs/plugin-react` with `include` covering plain `.js`, its babel pass running `@babel/plugin-transform-flow-strip-types` (until Phase 5 deletes the last `@flow` file), and `optimizeDeps.esbuildOptions.loader: { '.js': 'jsx' }` so the dep-scan doesn't choke on JSX in `.js`. Also set renderer `build.rollupOptions.external: ['electron']` while the 6 legacy `require('electron')` call sites and `nodeIntegration: true` remain — those are rewritten in Phase 3, and removing this external is a Phase 3 exit criterion.
2. `vite-plugin-node-polyfills` for crypto/stream/buffer (still required by hive-js and bip39 until Phase 4). **Prove hive-js can sign and broadcast a transaction in the Vite renderer before committing the migration** — this is the single biggest technical risk of the phase; budget a full day for it.
3. **MR-A:** add the Vite-processed `index.html` entry (real `<script type="module">`) that replaces `app.html`'s `document.write`/`process.env`/DLL-injection pattern for the electron-vite path — including the sign window's query-param load (today `app.html?type=sign&action=…` from `app/main.dev.ts`), which must work against the new html. `app.html` itself is deleted only in MR-B.
4. **MR-B — only after the first electron-vite-built release ships:** delete the 6 webpack configs, DLL scripts, `babel.config.js`, and `app.html`; collapse to a single root `package.json` (D10): delete `app/package.json` + its postinstall, rewrite electron-builder `files`/`directories` against the new `out/` layout, bump electron-builder 24 → 26. Re-verify dmg/nsis/deb packaging and `hive://`/`vessel://` protocol registration.
5. ESLint 10 flat config (D3) replacing `.eslintrc`/`app/.eslintrc`/`.eslintignore`. The same cleanup deletes the dead style pipeline: the `lint-styles`/`lint-styles-fix` scripts and the `stylelint` 7 + `stylelint-config-standard` + `stylefmt` devDeps (the app has one hand-written CSS file, and stylelint 7's `--syntax` flag no longer exists).
6. Vitest 4 replacing Jest (port the Phase 1 crypto tests — small). **Constraint until Phase 5:** unit tests may only import pure-TS modules — Vitest transforms with esbuild, which cannot parse Flow, and the flow-strip babel pass lives in plugin-react's renderer pipeline, which Vitest does not apply. The Phase 1 tests satisfy this by design (standalone TS envelope module). Playwright `_electron` harness with 2–3 smoke tests (app launches, window title, accounts route renders).
7. `.gitlab-ci.yml` per D11; delete `.travis.yml`. Single `verify` script (`typecheck && lint && test`) called by CI.

**Verification gate:** CI green on the new pipeline; packaged app installs and launches on Linux + Windows (macOS manually); `out/preload.js` exists and loads (verifiable in devtools even before isolation flips); a hive-js-signed test transaction broadcasts from the dev renderer; the promptOperation/sign window opens from a `vessel://` URI against the Vite-built html (the query-param load is the exact surface the html replacement is most likely to break).
**Rollback:** between MR-A and MR-B the webpack path (`npm run build:webpack`) still genuinely works — that is the escape hatch, and it's real only because MR-B's deletions wait for a shipped electron-vite release. After MR-B the hatch is gone: rollback is `git revert` of MR-B. Packaging regressions are the biggest risk — gate MR-B on a manual install smoke test per platform.
**Risk:** *High likelihood · blast radius: the build substrate (no keys, no money) · reversible until a release ships, then git-revert of MR-B.* The build is the ground everything stands on, and two failure modes here are canonical Vite-migration breakages (the ~60 JSX-in-`.js` Flow files compiling, and hive-js signing through the polyfills) — both are **prove-first spikes that must pass before the migration commits**. What keeps this merely High and not Critical: it touches nothing key- or money-related, and the MR-A/MR-B split keeps the webpack path genuinely runnable as a real escape hatch until the first electron-vite release is out. Packaging (MR-B) is the sharpest edge — gated on a manual install smoke test per platform.

---

### Phase 3 — Electron Hardening + Staged Electron Upgrade — SECURITY CRITICAL
**Objective:** context isolation actually on; keys out of the renderer; the URI signing flow gated; Electron on a supported major.

**Tasks:**
1. Flip **both** BrowserWindows (`app/main.dev.ts:69-78` main window; `:120-129` promptOperation/sign window) to `contextIsolation: true, nodeIntegration: false, sandbox: true`. Attach the preload to the sign window too — it currently has **none** despite rendering externally-supplied `hive://`/`vessel://` URI payloads.
2. Rewrite the 6 renderer files that `require('electron')` for `shell` to use the (currently dead) `window.electronAPI.openExternal`: `app/components/Send.js:18`, `app/components/Welcome.js:13`, `app/components/global/AccountName.js:4`, `AccountLink.js:4`, `PostLink.js:4`, `AccountAvatar.js:4`. Extend the preload bridge/IPC surface as needed (keep it minimal and typed). Removing the renderer `external: ['electron']` from Phase 2's Vite config is an exit criterion of this task.
3. **D9b — private keys into main-process custody.** Move the keystore and all signing into the main process behind an IPC contract (`sign(account, ops) → signed tx`, `unlock(password)`, `getVersion`); wrap it with Electron `safeStorage` over the Phase-1 KDF envelope. The renderer keeps only account names / pubkeys / metadata and **never receives a WIF**. This is the structural fix that makes the nodeIntegration-flip in task 1 durable — it removes the keys from the process the URI payload renders in. Migrate the Phase-1 localStorage envelope into the main-process store on first launch (password prompt → decrypt → re-wrap → wipe the localStorage `keys` slice), keeping the localStorage read path for one release.
4. **Harden web content** (security review [critical]/[high]/[medium]): add a strict CSP (`default-src 'self'; script-src 'self'`, no remote) via `session.defaultSession.webRequest.onHeadersReceived` and/or an `app.html`/`index.html` `<meta>`, and drop the dev remote-bundle exception from production; add `setWindowOpenHandler` (deny/allowlist) to **both** windows and a `will-navigate` guard to the sign window (`mainWindow` has one at `:94-98`; the sign window has none); constrain the `shell:openExternal` IPC handler (`app/main.dev.ts:161-163`) to an `https:`-only allowlist; sanitize the interpolated `@${name}`/`${permlink}` path segments in `app/components/global/*.js`; and **delete `devToolsLog`** (`app/main.dev.ts:192-197`) — an unescaped `executeJavaScript(\`console.log("${s}")\`)` injection sink with no callers.
5. **Gate the URI signing flow** (security review [critical]): re-gate the `hive://`/`vessel://` `sign` path behind an explicit confirmation that renders account, operation type, recipient and amount in plain language, defaults to Cancel, and requires the wallet password (or biometric) for **every** broadcast regardless of whether the key is stored encrypted; validate/normalize decoded ops against a schema before display and cap operation count/size; add an extra-confirm tier for high-risk ops (`transfer`, `transfer_to_savings`, `account_update`). Today the only barrier is a generic "please review" banner (`app/components/sign/operations/prompt.js:301-306`) plus a password prompt only when the key is encrypted.
6. Purge remaining `process.env` / node-API reads from renderer scope (the old `app.html` pattern dies in Phase 2, but audit for stragglers).
7. Staged Electron bump 28 → latest supported stable (D8), one hop per MR: at each hop run typecheck/lint/tests, launch, sign-window flow, both URI protocols, and packaging. Update `browserslist` and esbuild `chrome` target to the final Chromium.
8. HF28 authority-role re-verification (the audit itself landed in Phase 1): re-run the sign-window/URI key-role checks on each Electron hop.

**Verification gate:** `webPreferences` audit clean (no `nodeIntegration` / `contextIsolation:false` anywhere; both windows have a preload); `require('electron')` grep over `app/` (excl. main/preload) returns zero; no WIF crosses the IPC boundary into the renderer (asserted by an IPC-contract test); a CSP header is present on every response; a crafted `vessel://sign` link cannot broadcast without the plain-language confirmation + password; all e2e smoke tests pass on the new Electron; a `hive://` sign request round-trips with the correct key role.
**Rollback:** each Electron hop is its own MR/tag; the D9b custody move and the hardening flags are separate MRs; treat reverting isolation or re-exposing keys to the renderer as an incident, not a routine rollback. The localStorage key read path stays for one release so a rollback build can still unlock.
**Risk:** *Medium–high likelihood · blast radius: HIGHEST in the plan (keystore + every broadcast + whether the renderer even renders) · separate MRs, but re-exposing keys or reverting isolation is an incident, not a routine undo.* This is the single most dangerous phase: flipping `contextIsolation` changes assumptions the entire legacy renderer was written under, and moving key custody + signing across the IPC boundary is new structural code on the money path. It is sequenced here deliberately — **after** the build substrate is modern (Phase 2 gives a preload that actually compiles) and **after** the crypto envelope exists (Phase 1), so it isn't also fighting a broken build or weak encryption. De-risking: each concern (isolation flip, custody move, URI gate, each Electron hop) is its own MR with its own gate; the legacy localStorage read path stays one release; an IPC-contract test asserts no WIF ever crosses into the renderer.

---

### Phase 4 — Hive API Layer: facade adoption, then hive-tx
**Objective:** exactly one module talks to the Hive network, and it's a maintained library.

**Tasks:**
1. **Facade adoption (client-agnostic, do even if the lib decision slipped):** extend `app/utils/hiveApi.ts` to the full real surface (add the missing `getConversionRequests`, `transferToVesting`, `createAccount`, `wifIsValid`, `generateKeys`, `PrivateKey.fromString`, memo encode/decode, config get/set, `formatter.vestToHive`), then repoint the 14 direct `@hiveio/hive-js` importers (`app/actions/{account,hive,keys}.js`, `app/components/Accounts/Voting.js`, `app/components/Keys/{Auth,Create,Generate,Import,Login,Memo}.js`, `app/components/Send.js`, `app/containers/{ConvertPage,PromptOperation}.js`, `app/routes.tsx`) at the facade with hive-js still underneath. Verify zero behavior change.
2. **Engine swap in one commit:** facade internals → hive-tx 7.x. Port the 9 read calls, 13 broadcast ops + generic send, 7 auth helpers, memo, config; inline `vestToHive` (~5 lines of arithmetic). Adopt `config.nodes` + `callWithQuorum` for read-path failover.
3. Delete `app/types/hive.d.ts` (hive-tx ships types) and remove `vite-plugin-node-polyfills` + the crypto/stream/buffer fallbacks — safe now because hive-tx needs none and Phase 1 already moved mnemonics to Uint8Array-based `@scure/bip39`, so nothing Buffer-dependent remains; verify with a grep/bundle check that no renderer code still touches `Buffer`.
4. Refresh the settings node list to the current developers.hive.io set (keep `api.hive.blog` default).
5. Unit tests against a mocked transport for every facade method; one testnet/mirrornet broadcast smoke test per op family (transfer, vesting, witness, convert, customJson).

**Verification gate:** grep proves zero imports of any hive client outside `hiveApi.ts`; facade test suite green; manual send + power-up + witness-vote on testnet succeed.
**Rollback:** the facade makes rollback a one-commit engine swap back to hive-js; keep hive-js in package.json until one release after the swap ships.
**Risk:** *Medium likelihood · blast radius: every network read + every broadcast (money path) · one-commit revert to hive-js behind the facade.* Swapping the Hive client is money-path work, so subtle behavior differences between hive-js and hive-tx (serialization, error shapes, asset formatting) are the real hazard — caught by a per-op-family testnet broadcast gate before mainnet. The facade is what caps this at Medium: because exactly one module talks to the network, the engine swap is a single commit and rolling back is a single commit, with hive-js kept in the tree one release past the swap.

---

### Phase 5 — Application Migration: the legacy backlog (~61–68 files — recount first) → TypeScript + hooks + RTK
**Objective:** zero `@flow` files, zero class components, meaningful strict type checking, RTK store.

**Tasks (bottom-up dependency order, two mechanical steps kept in separate commits per directory: (a) rename + Flow-strip with types `any` where Flow was loose, (b) class→hooks behavior conversion):**

**Standing constraint for every slice conversion:** RTK slice state must stay shape-compatible with the legacy reducer's persisted state, or ship a tested redux-persist `migrate` function for that slice. The `keys` slice carries the Phase 1 encrypted-envelope data — a silent rehydration break there is a keystore-loss event and violates the plan's standing keystore rule.
1. `app/utils/` (NumericLabel), then `app/actions/` + `app/reducers/` (5+5 files) — converted **directly to RTK slices/thunks** (D5), killing the 17 TS7016 errors at the source. `reducers/index.ts` becomes the RTK store setup.
2. `app/containers/` (13 files) — includes retiring the 8 `componentWillReceiveProps` users (`PromptOperation`, plus components below).
3. `app/components/` (~45 files) — including the `componentWillReceiveProps` set (`CustomJSON`, `Delegation`, `Proxy`, `Voting`, `Keys/Create`, `Send`, `VestingAccounts`).
4. Remove the Flow babel pass from the Vite config; delete `.flowconfig`, `flow-typed/`.
5. Ratchet tsconfig one flag per MR: `noUnusedLocals`/`noUnusedParameters`/`noImplicitReturns` → `strictNullChecks` (the expensive one for Redux state and API responses) → `noImplicitAny` → full `strict` + `useUnknownInCatchVariables`. Ratchet ESLint app/ rules from `warn` back to `error` as directories convert.
6. Replace-abandoned-small-deps task (D12): url-parse→`URL`, react-autocomplete→Downshift, react-collapsible→Radix, react-input-range→react-range, electron-json-storage→electron-store, electron-devtools-installer→electron-extension-installer; drop react-intl (replace `VestingAccounts.js`'s FormattedDate/FormattedTime with `Intl.DateTimeFormat`, remove the hardcoded-`en` IntlProvider from App.tsx). Each is narrow; do them as files that use them get converted.
7. Reducer/slice unit tests as each slice lands (target: all 5 slices covered).

**Verification gate:** `git grep -l "@flow" app/` empty; `git grep -l "extends Component\|extends React.Component" app/` empty (excl. vendor); `tsc --noEmit` green under full `strict`; lint at `error` severity green; feature-parity checklist (§5) walked manually per converted page; a redux-persist state blob captured from a pre-RTK build rehydrates correctly into the RTK store (explicit automated test, with the `keys` slice asserted by name).
**Rollback:** per-directory commits; behavior-change commits (class→hooks) separated from rename commits precisely so a regression bisects to a small diff.
**Risk:** *Low per change, but the widest surface in the plan (~61–68 files — recount at phase start) · blast radius: one page/slice at a time · fully per-directory reversible.* Individually each conversion is low-risk and independently revertible, which is the whole point of doing it as many small commits rather than one big rewrite — a regression bisects to a single small diff. Two things keep it honest: the rename+Flow-strip commit is always kept **separate** from the class→hooks behavior-change commit (so a break is unambiguously one or the other), and the one genuinely dangerous spot — the RTK-converted `keys` slice rehydrating old redux-persist state — is guarded by a named, tested state-shape invariant (a break there is a keystore-loss event, not a cosmetic one).

---### Phase 6 — Router v8 + ESM convergence + test build-out
**Objective:** routing and module system current; test suite meaningful.

**Tasks:**
1. react-router-dom 6 → `react-router` v8 (codemod for the mechanical ~85–90%; `createBrowserRouter`/`RouterProvider` data-router pattern; drop the standalone `history` dep). Requires Node 22+ — already on 24.
2. Complete the ESM convergence: `"type": "module"` where electron-vite expects it; Babel fully deleted (Flow pass went in Phase 5).
3. Grow Playwright suite to the prioritized smoke set: unlock keystore, render send form with mocked node, sign-window flow via `vessel://` URI, node-switcher.
4. TypeScript 7.x evaluation now that `tsc` is only the type gate (esbuild transpiles): adopt if editor tooling is stable, else pin 5.9 and note.

**Verification gate:** all routes reachable (parity checklist §5); e2e suite green in CI; no `require(` in app source.
**Rollback:** router migration is a self-contained MR; revert cleanly if data-router semantics regress the sign-window flow.
**Risk:** *Medium likelihood · blast radius: all routing, including the `vessel://` sign-window query-param flow · self-contained MR, clean revert.* The router jump is mechanical for ~85–90% (codemod), but data-router semantics can subtly change how the externally-triggered sign window mounts — which is a money-path surface, so it gets an explicit e2e gate rather than just "routes render." Contained because it's one self-contained MR that reverts cleanly.

---

### Phase 7 — UI Replacement + React 19
**Objective:** off the discontinued UI stack; React current.

**Tasks:**
1. Mantine adopted app-shell-first (MenuBar, TitleBar, layout), then container-by-container: Send → Accounts → Vesting → Transactions → Settings → Convert → Keys flows → sign/prompt windows. formsy-react + formsy-semantic-ui-react replaced by Mantine `useForm` as each form converts.
2. When the last semantic-ui-react import is gone: delete `semantic-ui-react`, `fomantic-ui-css`, and the entire vendored `app/semantic-ui/` directory (~44 stale JS files).
3. React 18.2 → 19.2 with the official codemod suite (render/string-ref/act-import/ref-cleanup); @types/react v19; fix `JSX.Element` namespace moves; note useId prefix change for any snapshot tests.
4. Visual/parity pass per page against the checklist in §5.

**Verification gate:** zero semantic-ui imports; React 19 in lockfile; full parity checklist walked; e2e green.
**Rollback:** container-by-container migration means any page can ship on Mantine while others remain on Semantic (both libraries coexist during the phase — verified acceptable bundle-size cost, or accept temporarily).
**Risk:** *Medium per container, wide UI surface · blast radius: visual/interaction regressions across every page · per-container reversible, both libraries coexist during the swap.* Large but not dangerous: no keys, no signing, no money logic — the worst case is a page that looks wrong or a form that mis-validates, caught by the parity walk. It sits last precisely because it's the highest-surface, lowest-stakes work: nothing security- or money-critical should wait behind it, and by here everything underneath is already modern and tested. Both Semantic UI and Mantine render side-by-side during migration, so any single page can ship on the new library while the rest stay on the old.

---

### Phase 8 — Cleanup & Release
**Objective:** retire the transitional scaffolding; cut a release.

**Tasks:** delete PLAN.md/UPGRADE_NOTES.md (superseded by this doc, kept in git history); final dependency audit (`npm audit`, `npm outdated`); prune `overrides` (formsy gone); README/CLAUDE.md rewritten to match reality (the current CLAUDE.md claims context isolation that Phase 3 only now made true); version bump + tagged release with GitLab CI-built Linux/Windows artifacts and a manual macOS build; publish upgrade notes for users covering the key-envelope migration behavior.
**Verification gate:** clean-machine install of packaged artifacts on all three platforms; fresh-profile and migrated-profile wallet flows both pass.
**Risk:** *Low, except the release step · blast radius: deletions are dead-code-only; a bad packaged release means users can't install · gated, not easily un-shipped.* The cleanup deletions (superseded docs, dead deps, flow config) can't break anything running. The one real hazard is the release/packaging itself — a broken installer or protocol registration reaches users — so it's gated on a clean-machine install of the packaged artifacts on all three platforms, with both a fresh-profile and a migrated-profile wallet flow exercised before the tag is pushed.

---

## 4. Security Workstream (cross-phase view)

A dedicated wallet-grade security review was run (the original discovery agent had returned placeholder output; a follow-up review covered key lifecycle, the URI surface, IPC, web-content hardening, and dependencies with `file:line` evidence). Its findings drive the phase placements below. The through-line: **every [critical] finding funnels into the same structural flaw — private keys live in a fully `nodeIntegration`-enabled renderer, weakly encrypted, one URI click from broadcast.** That is why the plan fixes the KDF *and* moves keys to the main process, rather than treating either alone as sufficient.

**Severity tally (from the review):** 3 critical, 5 high, 5 medium, plus lows. The critical/high items and their phase homes:

| Sev | Item (evidence) | Phase |
|---|---|---|
| **crit** | Weak key-at-rest KDF — crypto-js passphrase AES, MD5/1-iter EVP_BytesToKey, resolves 3.3.0, CVE-2023-46233 (`app/actions/keys.js:104`) | 1 (D9a) |
| **crit** | One-click drain via `hive://sign`/`vessel://sign` — crafted link prefills arbitrary ops incl. `transfer`; only barrier is account-pick + a password prompt *only if the key is encrypted* (`app/main.dev.ts:110-158`, `app/containers/PromptOperation.js:52-83`, `app/components/sign/operations/prompt.js:301-306`) | 3 (URI gate) |
| **crit** | No renderer isolation — both windows `nodeIntegration:true, contextIsolation:false`, no sandbox; injection ⇒ Node RCE ⇒ keystore theft (`app/main.dev.ts:69-78,120-129`) | 3 (D9b + flip) |
| **high** | Memo private keys stored **plaintext unconditionally** (`app/reducers/keys.js:99,124`; `app/actions/keys.js:250-255`) | 1 |
| **high** | Main WIF stored plaintext on the "Encrypt this Wallet" opt-out (`app/actions/keys.js:101-110`) | 1 |
| **high** | Sign window is the weakest window — no preload, no `will-navigate`, no `setWindowOpenHandler`, renders untrusted URI payload (`app/main.dev.ts:120-129`) | 3 |
| **high** | No Content-Security-Policy anywhere; `app.html` uses `document.write` + dev remote bundle (`app/app.html:20-44`) | 3 |
| **high** | crypto-js pinned `^3` can't reach the 4.2.0 CVE fix (dependency view of the crit above) | 1 |
| **med** | Decrypted WIF mutated into the persisted `keys.decrypt` slice — flush/DevTools leak (`app/containers/DecryptPrompt.js`) | 1 |
| **med** | `shell:openExternal` IPC has no scheme allowlist (`app/main.dev.ts:161-163`) | 3 |
| **med** | Partial navigation controls — no `setWindowOpenHandler`; sign window unguarded | 3 |
| **med** | `preload.ts`/`window.electronAPI` are dead code — hardening documented but never wired (`app/main.dev.ts:76`) | 2 (compiles) / 3 (used) |
| **med** | bip39 2.6 outdated (entropy path) → `@scure/bip39` | 1 |

Non-security-phase items already tracked elsewhere: HF28 authority-role correctness (Phase 1, live mainnet failure), Electron 28 EOL → supported major (Phase 3), maintained @noble-based Hive client (Phase 4), CI that actually gates (Phases 0/2), `devToolsLog` injection sink removal + `console.log` metadata-leak strip + dead `electron-json-storage`/`electron-log` removal + `npm audit`/`osv-scanner` in CI (Phase 3 hardening / Phase 5 cleanup).

Standing rule for the whole plan: **no phase may weaken the legacy keystore read path** (users must always be able to decrypt an existing wallet — through Phase 1's v1 shim and Phase 3's localStorage-read-for-one-release), and any change touching keys, signing, or IPC gets a second-reviewer requirement.

---

## 5. Feature-Parity Checklist

Walked manually at the end of Phases 3, 5, 6 and 7 (and automated where the e2e suite covers it):

- [ ] **Send** HIVE and HBD (memo, incl. encrypted memo to accounts; exchange-memo warnings)
- [ ] **Savings:** transfer to savings, transfer from savings (3-day withdraw), pending savings withdrawals list
- [ ] **Vesting:** power up (transferToVesting), power down (withdrawVesting) incl. cancel, power-down destination / withdraw routes (setWithdrawVestingRoute)
- [ ] **Delegation:** delegate vesting shares, view/edit/remove existing delegations
- [ ] **Witness voting:** vote/unvote (accountWitnessVote), witness proxy set/clear (accountWitnessProxy)
- [ ] **Conversions:** HBD→HIVE (convert), HIVE→HBD collateralized (collateralizedConvert), pending conversion requests display
- [ ] **customJson** broadcast (Accounts/CustomJSON flow)
- [ ] **Account creation** (createAccount via Keys/Create, mnemonic path — bip39 3.x)
- [ ] **Key management:** import WIF, auth-based login, key generation from mnemonic, memo key ops, per-key encryption at rest (v1→v2 envelope migration), decrypt prompt
- [ ] **URI handlers:** `hive://` and `vessel://` sign requests → prompt window → broadcast with correct HF28 key role; single-instance lock still routes URIs to the running window
- [ ] **Multi-account** support (add/remove/switch; per-account balances)
- [ ] **Transaction history** (getAccountHistory rendering, pending rewards claim)
- [ ] **Address book:** exchange address presets (Binance, Bittrex, …) with memo enforcement
- [ ] **Node selection:** preferred node setting, custom node entry, server reconnect/status behavior, Mirrornet/Testnet chain-id config
- [ ] **URI signing gate** (post-Phase-3): a `hive://`/`vessel://sign` link surfaces account + op type + recipient + amount in plain language, defaults to Cancel, and requires the wallet password for every broadcast; a legitimate keychain-style sign request still completes
- [ ] **Date/time rendering** (react-intl removed per D12 — verified usage was only FormattedDate/FormattedTime in `VestingAccounts.js` plus a hardcoded-`en` IntlProvider, with no locale catalogs anywhere): vesting dates/times render correctly via `Intl.DateTimeFormat` after Phase 5
- [ ] **Advanced page:** every operation exposed by `AdvancedPage` verified (money-adjacent and previously uncovered by any gate)
- [ ] **Debug page** renders (`DebugPage` route)
- [ ] **Window chrome:** custom TitleBar, menu (menu.ts), devtools gating in production

---

## 6. Risk Model & Sequencing

This plan is ordered by breakage risk, not by time. Each phase is rated on three axes:
- **Change-breakage likelihood** — odds that applying it breaks something that works today.
- **Blast radius** — how bad it is if it does, on a wallet-specific scale: *cosmetic < a feature < the build < all broadcasts (money) < the keystore (money, possibly unrecoverable) < can't-ship*.
- **Reversibility** — clean git-revert · revert-but-forward-only-data · needs-a-data-migration-to-undo · incident-grade.

| Phase | Change-breakage likelihood | Blast radius if it breaks | Reversibility |
|---|---|---|---|
| 0 · Green baseline | **Very low** (fixes already-broken gates) | dev/CI only — no runtime behavior | clean per-commit |
| 1 · Key crypto + plaintext fixes + HF28 | **Medium** | **keystore + broadcasts (money)** | clean (crypto) / forward-only (plaintext fix); legacy read path permanent |
| 2 · electron-vite + pkg collapse + CI | **High** | the build substrate (no keys/money) | escape hatch until a release ships, then git-revert |
| 3 · Hardening + main-process custody + URI gate | **Medium–high** | **highest: keystore + all broadcasts + render** | separate MRs; incident-grade if keys re-exposed |
| 4 · Hive facade → hive-tx | **Medium** | **every read + broadcast (money)** | one-commit swap back behind the facade |
| 5 · Legacy backlog → TS/hooks/RTK | **Low per change**, widest surface | one page/slice at a time (RTK `keys` slice is the exception) | per-directory revert |
| 6 · Router v8 / ESM / e2e | **Medium** | all routing incl. sign-window flow | self-contained MR |
| 7 · Mantine + React 19 | **Medium per container**, wide | visual/interaction only — no money logic | per-container; libraries coexist |
| 8 · Cleanup & release | **Low** except the release step | dead-code deletes / a bad installer | gated on clean-machine install |

**How to read the order.** Phase 0 is first because it makes breakage *detectable*. Phases 1, 3 and 4 carry the highest blast radius (money/keys) and are done early-to-middle **despite** that — because the hazards they fix are already live and every one of them is fenced by a hard invariant (permanent legacy keystore read, facade one-commit rollback, no-WIF-in-renderer IPC test). Phase 2's high change-*likelihood* is tolerable because its blast radius excludes money and keys and it keeps a real escape hatch. Phases 5–7 are the widest surface but the lowest stakes per change, so they come last: nothing security- or money-critical waits behind them, and each is reversible one file or one page at a time. **Any phase boundary is a safe stopping point** — through Phase 4 you have a hardened, maintained-dependency wallet on the existing UI; 5–7 are polish and long-term maintainability.

### Risks & mitigations
1. **hive-js under Vite polyfills fails to sign (Phase 2).** Mitigation: prove a signed broadcast before committing the migration; fallback = keep webpack escape hatch one cycle; worst case pull Phase 4's hive-tx swap earlier (hive-tx needs no polyfills).
2. **An existing user's keystore breaks on upgrade (Phase 1) — THE headline risk (§1 invariant).** Three failure surfaces, one mitigation set: (layer 1) redux-persist v4→v6 layout mismatch — the WIP already can't see `reduxPersist:keys`; fixed by a password-free, non-destructive first-launch migration that leaves the old keys in place. (layer 2) `keys` slice shape drift in the RTK conversion — guarded by a shape-preservation test. (layer 3) legacy crypto-js/OpenSSL-MD5 ciphertext must stay decryptable — permanent v1 read path, lazy non-destructive re-encrypt. All three are gated by a round-trip test against a **real shipped-format profile** plus the manual "install shipped app, then run new build on its profile" check; legacy data + read path retained ≥ 1 release so any build rolls back without key loss.
3. **Context isolation breaks legacy renderer code in un-audited ways (Phase 3).** Mitigation: hardening lands after Phase 2's html/preload rebuild; grep-gated verification; sign-window e2e test before flipping flags.
3b. **D9b custody migration bricks a keystore, or a WIF silently leaks back to the renderer (Phase 3).** Mitigation: reuse Phase 1's permanent legacy-read path; migrate localStorage→main-store only on successful unlock and keep the localStorage read path one release; an IPC-contract test asserts no WIF-shaped value crosses into the renderer; treat any regression here as a security incident, not a routine rollback.
4. **Packaging regression from single-package collapse + builder 24→26 (Phase 2).** Mitigation: same-MR change with manual install smoke test per platform; protocol-registration test on Windows/macOS.
5. **Phase 5/7 scope creep (bulk phases).** Mitigation: per-directory commits, rename separated from behavior change; parity checklist per page; both UI libraries allowed to coexist mid-Phase-7.
6. **Ecosystem drift during the plan's lifetime** (Electron 8-week cadence, react-router yearly, Node model change Oct 2026). Mitigation: D8's "latest at execution time" phrasing; re-verify current versions at each phase start rather than trusting this doc's snapshot.
7. **redux-persist abandonment hardens (watch item).** Mitigation: pinned; storage access is concentrated in the store config + key envelope, so a later swap is contained.
8. **Semantic-ui removal reveals undocumented behavior (Phase 7).** Mitigation: per-container migration with parity walk; keep old page reachable behind a flag during conversion if needed.

---

## 7. Open Questions (explicitly unverified — do not guess)

1. **Security review — done, but not a substitute for an offline audit tool.** The wallet-grade review in §4 was completed (key lifecycle, URI surface, IPC, hardening, deps). What it did *not* do: run `npm audit`/`osv-scanner` against the lockfile (the environment was offline) — several of the ~93 direct deps predate 2022. **Action:** wire `npm audit`/`osv-scanner` into CI (Phase 2) and fail on high; treat §4 as the reviewed floor, and re-run the review after the Phase 3 custody move lands to confirm no WIF reaches the renderer.
2. **Exact current Electron stable:** discovery agents conflict (41.2.1 vs 43.2.0, both claimed as Aug 2026 current). Decision D8 ("latest supported at execution time") absorbs this, but verify at Phase 3 start.
3. **macOS CI runner** on gitlab.syncad.com: unknown. Until confirmed, macOS packaging is a documented manual release step.
4. **Exact legacy localStorage key names (BLOCKS Phase 1 Task 0).** The plan reads the shipped format from `master`'s source (redux-persist v4 → `reduxPersist:`-prefixed per-slice keys, default `keyPrefix`), but the *exact* on-disk key strings must be confirmed against a **real profile from an installed shipped Vessel** before the migration is trusted — pull them from the app's `Local Storage` LevelDB (or DevTools `localStorage`) on a machine that has run the release. If an older build used a different persist config or an even earlier (Steem-era) layout, the migration must recognize that variant too. Until confirmed, the migration must **no-op safely on absence** — never wipe. This is the one item that most directly guards the §1 invariant.
5. **User base / migration obligation:** the plan assumes real users hold v1-encrypted keystores (hence the permanent legacy decrypt path). Even if the maintainers say there are "no users," the legacy read path and non-destructive migration **stay** — the cost is trivial and the downside of guessing wrong is a bricked wallet. Only the *manual* shipped-profile test in Phase 1's gate is skippable if there is genuinely no install to test against.
5. **Mantine as UI target (D7):** decided here, but it is the largest workstream and taste-sensitive — cheap to veto before Phase 7 starts, expensive after.
6. **semantic-ui-react React 19 compatibility** remains unconfirmed upstream (issue #4510) — this is *why* React 19 is sequenced after the UI swap; if it resolves earlier, Phase 7's ordering can loosen but the swap still happens (library is discontinued regardless).
7. **hive-tx quorum behavior under Mirrornet/Testnet chain-ids:** not verified by discovery; test during Phase 4 before wiring `callWithQuorum` as default.
