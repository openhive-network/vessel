# Automated contributions

This directory configures the automated development platform that contributes to this
repository. This note says which branches it uses here and how its work reaches the
project's main line.

## Branches

- `aidev/integration` — the integration branch. Automated work lands here and nowhere else.
- `master` — the project's main line; reached from `aidev/integration` only by merge request (`aidev handoff`). Merge it keeping the source branch (`aidev/integration` is protected, so GitLab will not delete it).
- `ai/*` — one branch per task, created and deleted by the platform. Do not commit to them.
- `session/*` — a session's accumulated work, landed on the integration branch as a batch.

## How work reaches the main line

Task and session branches never reach `aidev/integration` through merge requests; the platform
lands them after its own verification. `aidev/integration` reaches `master` by this project's
usual process, merge requests included — the platform never merges into any other branch.

Whether this project's CI pipelines skip `ai/*` and `session/*` branches is decided by the
project's CI rules; maintainers record that decision here.

## Suites run before work lands

Declared in `.aidev/project.yaml` under `verification`, all through `.aidev/run-checks.sh`,
which writes `test-results/<slot>/junit.xml` (one case per step):

- `quick` — `.aidev/run-checks.sh quick build test`
- `full` — `.aidev/run-checks.sh full typecheck build test`
- `baseline` — `.aidev/run-checks.sh baseline build`
- `canary` — `.aidev/run-checks.sh canary build test`
- `static` — `.aidev/run-checks.sh static lint typecheck`
- `coverage` — `.aidev/run-checks.sh coverage build test`
- `system` — `.aidev/run-checks.sh system build test`

Every run first installs `node_modules` with `npm ci --legacy-peer-deps` from `package-lock.json`
(`install`, lifecycle scripts included: the root `postinstall` applies `patches/` with
patch-package and runs `electron-builder install-app-deps`). It installs offline from the image's
npm cache (`npm_config_cache=/opt/npm-cache`); when the image has no such cache — the image pinned
when the project moved to npm was built for yarn — it falls back to an online `npm ci`, so that
image needs network for the install. Steps: `build` is `npm run build` (electron-vite bundles of
main, preload and renderer into `out/`), `test` is `npm test` (Vitest over `app/**/*.test.ts`),
`lint` is `npm run lint` (ESLint 9, `eslint.config.mjs`), `typecheck` is `npm run typecheck`
(`tsc --noEmit`). The suites never start Electron; the Playwright e2e suite (`npm run test-e2e`,
under `xvfb-run`) and packaging (`npm run package-linux`) run in the project's GitLab CI, not in
the slots.

## Test runtime

`.aidev/runtime/Dockerfile` builds on common-ci-configuration's `node-test-tools:develop`,
which carries the hive-wide Node version (ccc's `NODE_VERSION`); this repository names no
Node version for it. It adds `make`/`g++`, node-gyp's headers for that Node (`/opt/node-gyp`)
and an npm cache filled from `package-lock.json` (`/opt/npm-cache`, the image's
`npm_config_cache`); `ELECTRON_SKIP_BINARY_DOWNLOAD` keeps electron's install script offline.
Rebuild and re-pin it with `.aidev/runtime/build.sh --push` when the Dockerfile, `package.json`
or `package-lock.json` changes, or ccc's image moves, and put the printed `repo@sha256:…` into
`environment.image`.

**Operator step after the npm port lands:** the pinned image still carries the old yarn cache, not
an npm cache, so every install takes the online fallback. Run `.aidev/runtime/build.sh --push` on
the integration branch and commit the printed digest as `environment.image`; installs are then
offline again.

## Code signing (ships dark)

`package.json` `build` configures macOS signing + notarization (hardened runtime) and Windows
signing, read by electron-builder from the environment: `CSC_LINK` / `CSC_KEY_PASSWORD` (macOS
Developer ID), `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` or `APPLE_API_KEY` /
`APPLE_API_KEY_ID` / `APPLE_API_ISSUER` (notarization), `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`
(Windows). No certificates are provisioned yet, so packages are built **unsigned**: packaging
still succeeds and `build/signingNotice.js` prints which platform is unsigned. Signing switches on
once those variables are set (as protected CI variables for tag pipelines); no code change is
needed.

## Known state

The application is !11's (`modernization-2026`) TypeScript / electron-vite / React 19 tree on
Electron 44 (whose bundled Node is 24.x), merged with this `.aidev/` harness. `.nvmrc` and
`engines` name only the Node major (`24`); CI (`.gitlab-ci.yml`) includes ccc's base template and
runs its Node jobs in `${NODE_TEST_TOOLS_IMAGE}`.
