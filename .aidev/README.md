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
processes), `test` is `yarn test` (`test/runTests.js`), `lint` is `eslint .` (the `lint`
script, `.travis.yml`'s first step). The project has no GitLab CI; `.travis.yml` is the only
CI definition. The suites never start Electron, and `test-e2e` and `package`
(electron-builder) are not in the slots.

There are no tests: `package.json`'s `test` script runs `test/runTests.js`, and the tree has
no `test/` directory. Until it has one, the `test` case is recorded as skipped and
`coverage` measures nothing.

## Test runtime

`.aidev/runtime/Dockerfile` builds on common-ci-configuration's `node-test-tools:develop`,
which carries the hive-wide Node version (ccc's `NODE_VERSION`); this repository names no
Node version for it. It adds yarn classic, `make`/`g++`, node-gyp's headers for that Node
(`/opt/node-gyp`), a yarn cache filled from `yarn.lock` (`/opt/yarn-cache`), and the
lockfile's Electron and electron-chromedriver zips (`/opt/electron-cache`), so their
install scripts work offline. Rebuild and re-pin it with `.aidev/runtime/build.sh --push`
when the Dockerfile, `package.json` or `yarn.lock` changes, or ccc's image moves, and put
the printed `repo@sha256:…` into `environment.image`.

## Known state at onboarding (2026-10-26)

The runtime is Node v24.22.1, and the application is a Node 6 application (`.nvmrc`
`v6.9.5`, `.babelrc` targets node 6, Electron 4.2.11, webpack 2). Every slot fails at
`install`: `node-sass` 6 builds from source with node-gyp 7, which fails on Node 24. With
install scripts skipped, `yarn build` fails because npm 10 rejects `package.json`'s
`devEngines.node` (`Invalid property "devEngines.node"`), and `eslint .` reports 87 errors.
Moving the application to Node 24 is the open port issue.
