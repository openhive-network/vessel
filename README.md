# Vessel - Hive Desktop Wallet

Vessel is a lite wallet for the Hive blockchain that you can run on your desktop computer without needing to run the blockchain itself.

**This is experimental and messy software at the moment, please use with caution.**

# Development

Requires Node.js >= 24 and pnpm >= 10. Clone with `--recurse-submodules` (or run
`git submodule update --init`): `npm-common-config` is common-ci-configuration, whose shared pnpm
catalogs pin React, TypeScript and Playwright.

```
pnpm install          # install dependencies (applies patches/ via pnpm's patchedDependencies)
pnpm run dev          # start with hot reload (electron-vite)
pnpm run verify       # the gate: typecheck + lint + unit tests
pnpm run test-e2e     # Playwright end-to-end tests (needs a prior `pnpm run build`)
pnpm start            # build then run the production build (unpackaged)
```

`pnpm-workspace.yaml` holds vessel's pnpm settings (`nodeLinker: hoisted`, which electron-builder
needs to find the app's dependencies) and, between the `BEGIN`/`END common-ci-configuration
catalogs` markers, ccc's catalogs. Packages that ccc catalogs are referenced as `catalog:<name>` in
`package.json`; never write their version here. To take a ccc bump:

```
git submodule update --remote npm-common-config
python3 npm-common-config/scripts/python/pnpm-catalog-sync.py   # re-merge ccc's catalogs
pnpm install                                                     # refresh pnpm-lock.yaml
```

Stack: Electron 43 · React 19 · Redux Toolkit · React Router 8 · Mantine · hive-tx · electron-vite/Vite · TypeScript · Vitest + Playwright. Private keys are held encrypted in the main process (a decrypted key never enters the renderer).

# Release Instructions

To build for release:

```
#Install Wine if you want to build for windows
sudo dpkg --add-architecture i386
wget -nc https://dl.winehq.org/wine-builds/winehq.key
sudo apt-key add winehq.key
sudo add-apt-repository 'deb https://dl.winehq.org/wine-builds/ubuntu/ focal main'
sudo apt update
sudo apt install --install-recommends winehq-stable

pnpm install
pnpm run package-all
```

Mac releases must be built on a Mac. Can build on intel for M1 thanks to Rosetta.



## No Support & No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.

## Updates

### 1.0.3 Release

- Added new Binance exchange address.
- Removed Blocktrades exchange.
- Added Hive Mirrornet display.

### 1.0.2 Release

- Added Gate.io exchange
- Removed automatic setting of liquid/savings target when choosing `same_account`
- Reduced columns of the confirmation modal on the `Send` page


### 1.0.1 Release

- Added Conversion (HBD => HIVE) and Collateralized Conversion (HIVE => HBD)
- Improved `Send` page to make it easier to deposit to/withdraw from savings

### 1.0.0 Release

- Converted to community owned project
- Fixed Binance & other exchanges not taking correctly saved memo
- Added Binance memo to settings and switched order between HBD => HIVE to HIVE => HBD

### Before

- [2017/12/09 - 0.2.0 Release Notes](https://hive.blog/vessel/@jesta/vessel-0-2-0-interact-with-steem-securely-from-any-website)
- [2017/11/29 - 0.0.9 Release Notes](https://hive.blog/vessel/@jesta/vessel-009-witness-voting-improved-delegation-controls-auths-and-customjson-ops)
- [2017/10/19 - 0.0.8 Release Notes](https://hive.blog/steem-project/@jesta/vessel-008-configurable-steem-node-new-default-node)
- [2017/09/19 - 0.0.7 Release Notes](https://hive.blog/steem-project/@jesta/vessel-007-account-creation-encrypted-memos-bittrex)
- [2017/05/24 - 0.0.6 Release Notes](https://hive.blog/steem-project/@jesta/vessel-006-steem-power-delegation)
- [2017/05/20 - This app was announced on hive.blog](https://hive.blog/steem-project/@jesta/vessel-pre-release-looking-for-feedback)




