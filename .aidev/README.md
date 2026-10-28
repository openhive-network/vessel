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

Every run first installs `node_modules` with `pnpm install --frozen-lockfile` from `pnpm-lock.yaml`
(`install`; pnpm applies `patches/` through `patchedDependencies` in `pnpm-workspace.yaml` and runs
the root `postinstall`, `electron-builder install-app-deps`). `pnpm-workspace.yaml` carries ccc's
catalogs merged in, so the install does not need the `npm-common-config` submodule. It installs
offline from the image's pnpm store (`npm_config_store_dir=/opt/pnpm-store`); with an image that
has no such store it installs online. Steps: `build` is `pnpm run build` (electron-vite bundles of
main, preload and renderer into `out/`), `test` is `pnpm test` (Vitest over `app/**/*.test.ts`),
`lint` is `pnpm run lint` (ESLint 9, `eslint.config.mjs`), `typecheck` is `pnpm run typecheck`
(`tsc --noEmit`). The suites never start Electron; the Playwright e2e suite (`pnpm run test-e2e`,
under `xvfb-run`) and packaging (`pnpm run package-linux`) run in the project's GitLab CI, not in
the slots.

## Test runtime

`.aidev/runtime/Dockerfile` builds on common-ci-configuration's `node-test-tools:develop`,
which carries the hive-wide Node version (ccc's `NODE_VERSION`) and pnpm (`PNPM_VERSION`); this
repository names neither. It adds `make`/`g++`, node-gyp's headers for that Node (`/opt/node-gyp`)
and a pnpm store filled by `pnpm fetch` from `pnpm-lock.yaml` (`/opt/pnpm-store`, the image's
`npm_config_store_dir`); `ELECTRON_SKIP_BINARY_DOWNLOAD` keeps electron offline.
Rebuild and re-pin it with `.aidev/runtime/build.sh --push` when the Dockerfile, `package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml` (a ccc catalog bump) or `patches/` changes, or ccc's image
moves, and put the printed `repo@sha256:…` into `environment.image`.

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
`engines` name only the Node major (`24`); CI (`.gitlab-ci.yml`) includes ccc's npm_projects
template (and through it the base template), runs its Node jobs in `${NODE_TEST_TOOLS_IMAGE}` and
installs with ccc's `.pnpm_install_with_catalog_fallback`. React, TypeScript and Playwright come
from ccc's `react-toolset`, `typescript-toolset` and `playwright-toolset` catalogs.
