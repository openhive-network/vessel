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
- `full` — `.aidev/run-checks.sh full build test`
- `baseline` — `.aidev/run-checks.sh baseline build`
- `canary` — `.aidev/run-checks.sh canary build test`
- `static` — `.aidev/run-checks.sh static lint`
- `coverage` — `.aidev/run-checks.sh coverage build test`
- `system` — `.aidev/run-checks.sh system build test`

Every run first installs `node_modules` offline from the image's yarn cache (`install`,
`yarn install --offline --frozen-lockfile` with lifecycle scripts, the root `postinstall`
included). Steps: `build` is `yarn build` (webpack bundles of the main and renderer
processes), `test` is `yarn test` (`test/runTests.js`, Jest over `test/**/*.spec.js`), `lint`
is `eslint .` (the `lint` script). The project has no CI definition of its own (no GitLab CI;
the dead Travis config was removed). The suites never start Electron, and `package`
(electron-builder) is not in the slots.

The tests are smoke tests of the reducers, the key actions (hive-js key derivation,
crypto-js encryption) and `utils/NumericLabel`: enough that a broken toolchain or
dependency port fails `test`, not a behavioural suite of the wallet.

## Test runtime

`.aidev/runtime/Dockerfile` builds on common-ci-configuration's `node-test-tools:develop`,
which carries the hive-wide Node version (ccc's `NODE_VERSION`); this repository names no
Node version for it. It adds yarn classic, `make`/`g++`, node-gyp's headers for that Node
(`/opt/node-gyp`) and a yarn cache filled from `yarn.lock` (`/opt/yarn-cache`);
`ELECTRON_SKIP_BINARY_DOWNLOAD` keeps electron's install script offline. Rebuild and re-pin it with `.aidev/runtime/build.sh --push`
when the Dockerfile, `package.json` or `yarn.lock` changes, or ccc's image moves, and put
the printed `repo@sha256:…` into `environment.image`.

## Known state after the Node 24 port (2026-10-27)

The runtime is ccc's Node, and the application is built for it: `.nvmrc` and `engines`
name only the major (`24`), Babel 7 (`babel.config.json`) targets the current Node,
Electron 44 (whose own Node is 24) runs the app, and webpack 5 bundles it. `install`,
`build` and `test` pass. `eslint .` passes; Flow (`yarn flow`, flow-bin 0.116) is not in the
slots and was not re-checked. The `postinstall`'s `flow-typed install` needs the network and
is allowed to fail (`|| true`), as before.
