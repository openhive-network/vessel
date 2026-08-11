# Phase 4 Implementation Plan — Hive client: hive-js → hive-tx 7.2.0, behind the facade

Companion to `MODERNIZATION_PLAN_2026.md` (§ Phase 4, § D1) and `EXECUTION_STRATEGY.md` (Phase-4 rows).
Written 2026-08 after reading the tree at `modernization-2026` (post Phase 2 MR-A) **and the published
hive-tx 7.2.0 dist** (tarball from npm inspected file-by-file; every claim below marked *verified-in-dist*
was read in `hive-tx-7.2.0/dist/index.mjs`, not inferred from docs).

**Standing invariants (repeated because they bind every commit below):**
1. **PARAMOUNT** — existing users' imported + encrypted keys never break, even transiently. The at-rest
   envelope (`app/utils/keyEnvelope.ts`, @noble v1 scrypt+AES-GCM + permanent legacy OpenSSL-MD5 decrypt)
   is *not* part of the hive-client surface and this phase does not modify it (see §3 for the one place
   the two worlds touch — the @noble version question).
2. Every broadcast and every network read flows through this client — money path. The engine swap is one
   atomic, one-commit-revertible change (`hiveApi.ts` internals only), everything before it is provably
   behavior-neutral, everything after it is deletion of then-dead code.
3. Local crypto (sign / memo encode / decode / verify / wif checks) with throwaway keys is safe to
   auto-test. A **real broadcast — even testnet/mirrornet — is never auto-run**; every broadcast smoke
   test below is marked `REAL-BROADCAST · HUMAN-AUTHORIZED`. All app-level tests run against a disposable
   profile via `VESSEL_USER_DATA` (honored at `app/main.dev.ts:40`), never the real
   `~/Library/Application Support/vessel`.
4. Execution is Opus-only, small individually-shippable/revertible commits, no Claude/Anthropic
   attribution. The T2 engine swap is "sensitive" per EXECUTION_STRATEGY §4: Fable spec → Fable
   spec-review → user approval → Opus authors → conductor runs the real gates.

---

## 0. Findings that change the shape of this phase

Discovery against the *actual* hive-tx 7.2.0 dist and the *actual* tree surfaced five things the
Phase-4 section of the modernization plan did not anticipate. They are resolved in this plan and
called out here so nobody re-derives the old (wrong) assumptions:

**F1 — hive-tx signing is NON-deterministic.** *verified-in-dist:* `PrivateKey.sign` calls noble
`secp256k1.sign(digest, key, { extraEntropy: true, format: 'recovered', prehash: false })` — hedged
signing with 32 random bytes of extra entropy, single-shot, no Graphene canonicality loop (v6.1.2 dist
is the same, so this is long-standing production behavior, not a v7 regression). Consequences:
- "Byte-identical signatures to hive-js" is **impossible by design**. The parity gate is reframed (§6):
  **byte-identical *digest*** (which proves serialization + chain-id handling are identical — the part
  that actually decides what the chain sees) **plus cryptographic verification of the signature against
  the digest and expected pubkey**. Any canonical valid signature over the same digest is
  chain-equivalent; hived accepts hive-tx's signatures in production (Keychain et al.), but we still
  gate on a testnet broadcast before trusting it (§7.3).
- The comment contract in `app/utils/broadcast.ts` ("hive-js signs deterministically … a main-signed tx
  is byte-identical to what the local path would produce") becomes false after the swap. Functionally
  harmless (only one signature is ever broadcast), but the comments and `broadcast.parity.test.ts`'s
  signature-equality assertions must be reworked in T2 — they will otherwise fail spuriously.

**F2 — hive-tx freezes `chain_id` at module load. Testnet/Mirrornet signing is broken out of the box.**
*verified-in-dist:* `Transaction.ts` has module-scope `const chainId = hexToBytes(config.chain_id);`
and `digest()` uses that frozen copy. Mutating `config.chain_id` at runtime (which is exactly what
`app/routes.tsx:41` does after `get_config`) does **not** change what `Transaction.sign()` signs.
v6 has the identical freeze. There is no exported serializer to compute a digest ourselves, and no
subpath export to import config before the Transaction module evaluates. **Resolution required before
T2 can land** — see §4.1 (upstream one-line fix, else a pinned `patch-package`-style patch). Mainnet
is unaffected (the frozen default *is* mainnet).

**F3 — `address_prefix` default is also frozen at load.** *verified-in-dist:*
`const DEFAULT_ADDRESS_PREFIX = config.address_prefix;` captured before any runtime mutation, used by
`PublicKey` when no prefix is passed. Facade rule: **every** `createPublic()` call passes the current
prefix explicitly; never rely on the default. (`PublicKey.fromString` preserves whatever 3-char prefix
the input string carries — *verified-in-dist* — so parsing on-chain TST keys is safe.)

**F4 — hive-js key derivation normalizes whitespace; hive-tx's `fromLogin` does not.** hive-js
`toWif(name, password, role)` builds `seed = name + role + password` then
`seed.trim().split(/[\t\n\v\f\r ]+/).join(' ')` before sha256. hive-tx `fromLogin` is
`PrivateKey.fromSeed(username + role + password)` with **no normalization** (*verified-in-dist*). For a
master password containing a tab, double space, or leading/trailing whitespace, the two libraries derive
**different keys** — a user who imported via master password would silently fail to re-derive the same
key. Also, `Keys/Create.js:93` derives with the pseudo-role `'master'`, which hive-tx's `KeyRole` type
does not offer. **Resolution: the facade owns login-derivation itself** (≈6 lines: hive-js-exact
normalization + `PrivateKey.fromSeed`), fixture-tested byte-for-byte against hive-js — including
whitespace-containing passwords and the `'master'` role. `PrivateKey.fromLogin` is not used.

**F5 — the facade the old plan describes is not the facade that exists.** Since Phase 3 landed, the
*live* broadcast path is already centralized: `app/actions/account.js` calls
`broadcastOps`/`signAndBroadcast` in `app/utils/broadcast.ts` (prepare → sign → broadcast), **not** the
13 promisified `hive.broadcast.<op>` helpers in `hiveApi.ts` — those, plus `hiveBroadcast.send`,
`hiveFormatter.vestToHive` and `hiveAuth.toWif`, have **zero production callers** (grep-verified; only
tests and the facade itself reference them). So T2 does *not* port 13 typed broadcast helpers — it ports
**three broadcast primitives** (prepare, sign, broadcast) plus reads/auth/memo/config. The dead facade
surface is deleted in T1, shrinking the money-path swap dramatically. Also: the direct-importer count is
**15, not 14** — `app/components/DecryptModal.js` (uses `hive.auth.isWif` as the wrong-password oracle)
was missed by the earlier survey, and `app/containers/PromptOperation.js:5` imports hive-js without
using it (dead import; delete).

Minor but load-bearing: **F6** — `app/reducers/processing.js:427` parses hive-js's RPC error shape
(`payload.error.data.stack[0]`) to build user-facing broadcast-failure messages; hive-tx throws
`RPCError extends Error` with `.code`/`.data` and **no `.error` wrapper** (*verified-in-dist*). The
facade must normalize (§2.7) or every broadcast error degrades to "Unknown Error".

---

## 1. Current state (verified by reading, 2026-08)

### 1.1 The two seams

**Renderer seam** — 15 production files import `@hiveio/hive-js` directly:

| File | hive-js usage (all call sites) |
|---|---|
| `app/actions/account.js` | `api.getAccounts`, `api.getVestingDelegations`, `api.getWithdrawRoutes`; `config.get('address_prefix')==='TST'` ×7 (testnet symbol rewrites) |
| `app/actions/hive.js` | `api.getDynamicGlobalProperties`; `config.get('chain_id')` (network labeling) |
| `app/actions/keys.js` | `auth.isWif` ×3, `auth.wifToPublic` ×3, `api.getAccounts` ×5 |
| `app/components/Accounts/Voting.js` | `api.getWitnessesByVote('', 100)` |
| `app/components/Keys/Auth.js` | `auth.isWif`, `auth.wifIsValid` |
| `app/components/Keys/Create.js` | `api.getAccounts`, `auth.generateKeys`, `auth.getPrivateKeys` ×2 (incl. role `'master'` at line 93) |
| `app/components/Keys/Generate.js` | `api.getAccounts`, `auth.generateKeys`, `auth.getPrivateKeys` |
| `app/components/Keys/Import.js` | `auth.isWif` |
| `app/components/Keys/Login.js` | `auth.getPrivateKeys` ×2 |
| `app/components/Keys/Memo.js` | `auth.isWif`, `auth.wifIsValid` |
| `app/components/Send.js` | `api.getAccounts` ×2, `api.getSavingsWithdrawFrom`, `auth.isWif` ×2, `auth.wifToPublic` ×2, `memo.encode` ×2 |
| `app/components/DecryptModal.js` | `auth.isWif` ×2 (wrong-password oracle after `decryptKey`) |
| `app/containers/ConvertPage.js` | `api.getConversionRequests` |
| `app/containers/PromptOperation.js` | **dead import** — no `hive.` usage |
| `app/routes.tsx` | `api.setOptions` ×2, `api.getConfig`, `config.set('chain_id'/'address_prefix')` (node switching) |

**Main-process seam** — 2 infra modules:
- `app/main/keystore.ts` (Electron main / BoringSSL): `auth.isWif` ×3, `auth.signTransaction`,
  `auth.wifToPublic` (memo-key guard), `memo.encode`/`memo.decode`, `config.set` ×2
  (`setChainConfig`). Runs only because the `RIPEMD160_MAIN_BANNER` shim in `electron.vite.config.ts`
  patches `crypto.createHash('rmd160')` for hive-js's memo self-test.
- `app/utils/broadcast.ts` (shared; the money-path orchestrator): `broadcast._prepareTransaction`,
  `auth.signTransaction` ×3, `api.broadcastTransactionAsync`, `config.get('address_prefix')` ×2 (the
  post-prepare ` HIVE`→` TESTS` / ` HBD`→` TBD` testnet rewrite, replicated verbatim from
  hive-js `broadcast.send`).

### 1.2 The facade today, live vs dead

`app/utils/hiveApi.ts` exports 6 groups, imported **only by tests** (`app/main/keystore.test.ts`,
`app/utils/broadcast.parity.test.ts`, `app/utils/broadcast.mainsign.test.ts`,
`app/utils/hiveSigning.test.ts` — all via `hiveAuth`):

| Group | Production-relevant? |
|---|---|
| `hiveApi` (9 reads) | Live surface (call sites currently bypass it) — but missing `getConversionRequests` |
| `hiveBroadcast` (13 named ops + `send`) | **Dead** — live path is `broadcastOps`/`signAndBroadcast` in `broadcast.ts` (F5). Delete, don't port. |
| `hiveAuth` (`isWif`, `wifToPublic`, `toWif`, `getPrivateKeys`) | Live except `toWif` (tests only); missing `wifIsValid`, `generateKeys` |
| `hiveMemo` (encode/decode) | Live surface |
| `hiveConfig` (get/set) | Live surface |
| `hiveFormatter` (`vestToHive`) | **Dead** — zero callers anywhere. Delete. |

Missing from the facade vs. the real surface: `getConversionRequests`, `wifIsValid`, `generateKeys`,
and the three broadcast primitives `broadcast.ts` uses (`_prepareTransaction`, `signTransaction`,
`broadcastTransactionAsync`). (`getAccountHistory` is in the facade; its only would-be caller —
transaction history — currently hits a dead `localhost:5001` fetch, so it stays as dormant surface.)

Items from the old surface list that need **no mapping at all**: `props.network`,
`props.total_vesting_shares`, `props.total_vesting_fund_hive`, `props.time`, `props.head_block_number`
are reads of the Redux `state.hive.props` slice (populated by `getDynamicGlobalProperties`), not
hive-js API calls. `transferToVesting`/`claimRewardBalance` already exist as `broadcastOps` builders.
`createAccount` is commented-out dead code in `account.js:99-120` (`createAccountDelegated` dispatches
processing actions only).

### 1.3 Existing test/e2e assets this phase builds on

- `broadcast.parity.test.ts` — proves seam-vs-legacy-helper **signature** equality per op family with
  stubbed tapos (works because hive-js is deterministic; must be reframed per F1 in T2).
- `hiveSigning.test.ts` — key derivation + local signing under Vitest/ESM.
- `keystore.test.ts`, `broadcast.mainsign.test.ts` — main-custody sign/verify/memo with throwaway keys.
- Playwright e2e: `e2e/{smoke,migration,mainSign,memoEncode,signWindow}.spec.ts` against a disposable
  `VESSEL_USER_DATA` profile. These are the primary "zero behavior change" gates for T1/T2/T3.

---

## 2. API mapping: every hive-js call in use → hive-tx 7.2.0

Legend: ✅ = direct equivalent, *verified-in-dist*. 🔧 = facade implements it (small, fixture-tested).
⚠ = verify against hive-tx source/behavior during execution before relying on it.

### 2.1 Reads → `callRPC` (returns `result` directly; throws `RPCError`)

| hive-js | hive-tx 7.2.0 |
|---|---|
| `api.getAccounts(names, cb)` | ✅ `callRPC('condenser_api.get_accounts', [names])` |
| `api.getDynamicGlobalProperties(cb)` | ✅ `callRPC('condenser_api.get_dynamic_global_properties', [])` |
| `api.getVestingDelegations(a, from, limit, cb)` | ✅ `callRPC('condenser_api.get_vesting_delegations', [a, from, limit])` |
| `api.getWithdrawRoutes(a, type, cb)` | ✅ `callRPC('condenser_api.get_withdraw_routes', [a, type])` |
| `api.getSavingsWithdrawFrom(a, cb)` | ✅ `callRPC('condenser_api.get_savings_withdraw_from', [a])` |
| `api.getAccountHistory(a, from, limit, cb)` | ✅ `callRPC('condenser_api.get_account_history', [a, from, limit])` |
| `api.getWitnessesByVote(from, limit, cb)` | ✅ `callRPC('condenser_api.get_witnesses_by_vote', [from, limit])` |
| `api.getConfig(cb)` | ✅ `callRPC('condenser_api.get_config', [])` |
| `api.getConversionRequests(a, cb)` *(not yet in facade)* | ✅ `callRPC('condenser_api.get_conversion_requests', [a])` |
| `api.setOptions({url})` | 🔧 `config.nodes = [url]` — single-element pins the user-selected node, preserving today's exact behavior; T4 widens it. ⚠ note: on a fresh install with no `hived_node` preference, `routes.tsx` never calls `setOptions`, so hive-tx's *default* multi-node failover list applies — a mild (beneficial) behavior change; document it. |

`callWithQuorum` exists (✅ *verified-in-dist*, signature `(method, params?, quorum=2)`), but is **not**
adopted in Phase 4: with a single user-selected node (`config.nodes=[url]`) or any custom
testnet/mirrornet node there is no second node to form a quorum, and its failure semantics under
disagreement are unverified. Deferred as a post-Phase-4 option, contra the one-liner in
MODERNIZATION_PLAN task 2 — see §8/R6.

### 2.2 Broadcast-path primitives (consumed only by `broadcast.ts`)

| hive-js | hive-tx 7.2.0 |
|---|---|
| `broadcast._prepareTransaction(tx)` | 🔧 facade `prepareTransaction(tx)`: `callRPC` DGP → build tapos exactly as hive-js does (`ref_block_num = head_block_number & 0xFFFF`, `ref_block_prefix` = LE-uint32 at byte 4 of `head_block_id`, `expiration = head block time + 60s`). ⚠ replicate against `node_modules/@hiveio/hive-js/lib/broadcast/index.js` verbatim during execution — do **not** use hive-tx's `tx.addOperation()` path (it computes its own tapos with a 2s DGP cache and would change tx assembly semantics). |
| `auth.signTransaction(preparedTx, {role: wif})` | 🔧 facade `signTransaction`: `new Transaction({ transaction: {...preparedTx, signatures: preparedTx.signatures ?? []} }).sign(PrivateKey.fromString(wif))` → returns the signed `TransactionType`. Role label is dropped (hive-js ignored it too — signs with the value only). **Gated on F2/§4.1 for non-mainnet chain ids.** |
| `api.broadcastTransactionAsync(signedTx)` | 🔧 facade `broadcastTransaction`: `callRPC('condenser_api.broadcast_transaction', [signedTx], timeout, retry: 0)`. Single-shot like hive-js — deliberately NOT `tx.broadcast()` (which retries via node failover and silently swallows "Duplicate transaction check failed", *verified-in-dist*; both are behavior changes on the money path we don't take in T2). ⚠ verify `retry` param semantics (0 vs 1 = one attempt) in `helpers/call.ts`. Return shape becomes `{}`/RPC result vs. hive-js's richer object — safe: `signAndBroadcast` merges `signed` in and callers only truthiness-check (documented in `broadcast.ts:93-97`). |
| `broadcast.{transfer, transferToSavings, …}` ×13 + `broadcast.send` | **Delete from facade (F5)** — zero production callers; `broadcastOps` builders in `broadcast.ts` are the live, parity-tested op constructors and stay unchanged. |

The testnet ` HIVE`→` TESTS`/` HBD`→` TBD` rewrite stays where it is (`broadcast.ts:82-89`),
reading the prefix via `hiveConfig.get('address_prefix')` — engine-agnostic. hive-tx's serializer
accepts TESTS/TBD symbols (✅ *verified-in-dist*: `Asset.fromString` whitelist includes them).

### 2.3 Auth / key derivation

| hive-js | hive-tx 7.2.0 |
|---|---|
| `auth.isWif(wif)` | 🔧 `try { PrivateKey.fromString(wif); return true } catch { return false }`. Semantic delta: hive-tx also enforces the 0x80 network-id byte (*verified-in-dist* `decodePrivate`), hive-js checks base58+double-sha256 checksum only — hive-tx is strictly stricter. Accepted (real WIFs always carry 0x80); pinned by a truth-table fixture (valid / bad checksum / bad version byte / garbage / empty). Callers using it as a wrong-password oracle (`DecryptModal.js`) are unaffected: garbage stays false. |
| `auth.wifToPublic(wif)` | 🔧 `PrivateKey.fromString(wif).createPublic(hiveConfig.get('address_prefix')).toString()` — prefix **always explicit** (F3). |
| `auth.wifIsValid(wif, pub)` *(not yet in facade)* | 🔧 `wifToPublic(wif) === pub` (hive-js-identical string compare). |
| `auth.getPrivateKeys(name, pw, roles)` | 🔧 facade-owned derivation (F4): per role, `seed = name+role+pw` → hive-js brain-key normalization (`trim` + collapse `[\t\n\v\f\r ]+` to single spaces) → `PrivateKey.fromSeed(normalized)`; returns hive-js's exact shape `{ [role]: wif, [role+'Pubkey']: pub }` (Generate.js dumps the whole object into the Key-Backup JSON — shape is user-visible). Supports the `'master'` pseudo-role used by `Create.js:93`. Fixture-tested byte-for-byte against hive-js incl. whitespace passwords. `PrivateKey.fromLogin` is NOT used (no normalization, no 'master'). |
| `auth.generateKeys(name, pw, roles)` | 🔧 same derivation, returns `{ [role]: publicKeyString }`. |
| `auth.toWif(name, pw, role)` | 🔧 same core (tests only; kept for the fixture suite). |
| `PrivateKey.fromString(wif)` | ✅ `PrivateKey.fromString` / `PrivateKey.from` (*verified-in-dist*). |

### 2.4 Memo

| hive-js | hive-tx 7.2.0 |
|---|---|
| `memo.encode(privWif, pubStr, '#msg')` | ✅ `Memo.encode(privWif, pubStr, '#msg')` — accepts WIF strings directly; optional `testNonce` param enables deterministic fixtures (*verified-in-dist*). ⚠ verify the non-`#` passthrough and empty-string edge behavior matches hive-js. |
| `memo.decode(privWif, encoded)` | ✅ `Memo.decode(privWif, encoded)`. |

Pure @noble hashing → runs natively in Electron main (BoringSSL irrelevant) → the
`RIPEMD160_MAIN_BANNER` shim becomes deletable (T3). **Cross-compat is mandatory, not assumed**: memos
encoded by hive-js (historical, on-chain) must decode under hive-tx and vice versa — both directions
fixture-tested with throwaway keys (§7.2).

### 2.5 Config & chain identity

| hive-js | hive-tx 7.2.0 |
|---|---|
| `config.get/set('chain_id')` | 🔧 facade `hiveConfig` keeps its own authoritative copy and writes through to `config.chain_id`. **Signing honors runtime changes only after the §4.1 fix** (F2). |
| `config.get/set('address_prefix')` | 🔧 same; consumed by the TST rewrites, `wifToPublic`, and every `createPublic` call (F3). |

Main and renderer are separate JS contexts with separate hive-tx `config` instances —
`Keystore.setChainConfig()` (called over IPC from `broadcast.ts:48` before every main sign) remains the
sync mechanism; after T1 it calls `hiveConfig.set` instead of `hive.config.set`. Unchanged design.

### 2.6 Dead surface — delete in T1, do not port

`hiveBroadcast` (all 14 members), `hiveFormatter.vestToHive` (zero callers; if a future caller needs
it: 3 lines of arithmetic `vests/totalVests*totalFund`), the dead hive-js import in
`PromptOperation.js:5`, and `app/types/hive.d.ts` (T3, once nothing imports hive-js).

### 2.7 Error-shape adapter (F6)

Facade read/broadcast rejections are normalized to preserve the legacy consumer contract:
`catch (e) { if (e RPCError-like) e.error = { code: e.code, message: e.message, data: e.data }; throw e; }`
— so `processing.js` `setError`'s `payload.error.data.stack[0]` keeps producing real messages
(hive-tx's `RPCError.data` carries the same hived `stack` payload). `reducers/keys.js:164`
(`payload.message`) works as-is since `RPCError extends Error`. Unit-tested with a canned hived error.

---

## 3. The @noble v1→v2 decision

**Facts:** root pins `@noble/ciphers@^1.3.0` + `@noble/hashes@^1.8.0`, used by (i) `keyEnvelope.ts`
(scrypt, AES-GCM, randomBytes — the PARAMOUNT at-rest crypto), (ii) the rmd160 main-banner
(`require('@noble/hashes/ripemd160')` — a v1 subpath; v2 moved ripemd160 to `legacy.js` ⚠), (iii)
`app/utils/bytes.ts` helpers. hive-tx requires `@noble/{ciphers,curves,hashes}@^2.2.0`. **The tree
already nests both major lines today**: `@scure/bip39@2.2.0` (Phase 1) carries its own
`@noble/hashes@2.2.0` under `node_modules/@scure/bip39/node_modules/` while the root holds 1.8.0 —
verified on this machine. npm handles it; there is precedent in the shipped build.

**Option (a) — nest both (root stays v1; hive-tx gets its own v2).**
- ✅ Zero contact with the PARAMOUNT at-rest surface; the T2 revert cannot regress keystore crypto.
- ✅ No API-migration work (v2 renamed subpaths to `*.js`-suffixed, relocated ripemd160 to `legacy`,
  adjusted some option types — all irrelevant if v1 code is untouched).
- ➖ Ships two copies (~60–120 KB uncompressed across bundles) — noise for a desktop app.

**Option (b) — bump root to v2 and align.**
- ✅ One copy; tidier tree.
- ❌ Touches `keyEnvelope.ts` (import paths at minimum) **in the same phase as the money-path swap**,
  coupling the two highest-stakes surfaces in the repo. Needs its own compat proof (v1-written envelope
  fixtures decrypting under v2 code), its own commit, its own Fable spec per the sensitivity rule — all
  cost, no Phase-4 benefit.

**RECOMMENDATION: (a).** hive-tx nests its own @noble v2; root stays on v1 through all of Phase 4.
Schedule the v2 alignment as a *separate* Phase-8 hygiene item (or drop it — dual-versioning is npm's
normal operating mode), executed with: capture-envelope-fixture-before, bump, decrypt-fixture-after,
plus the profile-copy e2e. Note the rmd160 banner's v1 subpath import never becomes a problem: the
banner itself is deleted in T3, *before* any future v2 alignment.

---

## 4. Prerequisite gates (must be green before T2 merges)

### 4.1 Chain-id agility (F2) — blocker for testnet/mirrornet, and for this plan's own smoke gates

The fix is one line upstream (read `config.chain_id` inside `digest()` instead of module scope).
Execution order:
1. **Check hive-tx master / releases > 7.2.0 first** — this may already be fixed (⚠ verify at
   execution time; also search upstream issues for "chain_id").
2. If unfixed: file the issue + PR upstream (mahdiyari has a weekly cadence; D1 notes this).
3. **Do not block on upstream**: land T2 carrying a pinned local patch (`patch-package` postinstall, or
   an `overrides`-pinned fork) of exactly that line, with a test that fails if a future hive-tx bump
   silently reverts it: *set a testnet chain id → digest of a fixed tx ≠ mainnet digest of the same tx,
   and equals `sha256(testnet_chain_id ‖ serialized_tx)` recomputed from hive-js's serializer*.
4. Drop the patch when an upstream release contains the fix.

The same test locks F3 (`createPublic` explicit-prefix rule) via a TST-prefix derivation assertion.

### 4.2 Signature-acceptance sanity (F1)

Before T2 merges: statistical unit test signs 512 fixed digests with a throwaway key and asserts 100%
recover to the right pubkey; record the Graphene-canonicality rate as documentation (hive-tx does not
grind for the historical canonical form — hived stopped requiring it, which is why hive-tx v4–v7 work
in production ⚠ *confirm empirically via the human-authorized testnet smoke broadcast in §7.3 before
any mainnet use; if testnet hived rejects with a canonicality error, add a facade-side re-sign loop
(`while !isCanonical(sig) resign` — possible because extraEntropy randomizes each attempt) — ~10 lines,
designed now so it's a known lever, not a scramble*.

### 4.3 Baseline fixtures captured while hive-js is still the engine (T0)

Everything §6/§7 compares against must be generated and committed **before** the engine changes:
per-op-family digest fixtures, key-derivation vectors (incl. whitespace + 'master'), isWif truth table,
memo ciphertexts. After the swap, hive-js remains installed (rollback posture §9) so cross-checks still
run live — but committed fixtures survive even hive-js's eventual removal.

---

## 5. Commit sequence

Every commit: buildable, shippable, individually revertible. Gates are run by the conductor on the real
tree (`npm run verify` = typecheck+lint+vitest; `npm run build`; `npm run test-e2e` on a disposable
`VESSEL_USER_DATA` profile copy). No commit mixes facade-surface change with engine change.

---

**T0 — parity fixture harness (tests only; no production code).**
*Changes:* new `app/utils/hiveParity.fixtures.ts` + generator test that snapshots, from hive-js:
(1) serialized-tx digests for one representative tx per live op family — the 14 `broadcastOps` ops +
`vote`, `comment`, `account_update` (URI-signable set) — under mainnet AND testnet chain-ids/prefixes,
tapos fixed; (2) key-derivation vectors (`getPrivateKeys`/`generateKeys`/`toWif` across roles incl.
`'master'`, passwords incl. leading/trailing/tab/double-space cases); (3) memo ciphertexts both
directions with fixed test nonce; (4) `isWif` truth table. All keys throwaway-derived, as in
`broadcast.parity.test.ts`. hive-js digests come from `@hiveio/hive-js/lib/auth/serializer`
(`ops.transaction.toBuffer`) + sha256 ⚠ verify that deep-import path against the installed 2.0.4.
*Gate:* `npm run verify`; fixtures committed and human-eyeballed for plausibility (hex, lengths).
*Rollback:* delete the test files. Zero production risk.

**T1 — facade to full real surface + repoint everything; hive-js still underneath. (3 commits)**

- **T1a — facade surface.** Extend `hiveApi.ts`: add `getConversionRequests`, `hiveAuth.wifIsValid`,
  `hiveAuth.generateKeys`, and a new `hiveTx` group = `{ prepareTransaction, signTransaction,
  broadcastTransaction }` (thin wrappers over `hive.broadcast._prepareTransaction`,
  `hive.auth.signTransaction`, `hive.api.broadcastTransactionAsync` — hive-js still the engine).
  Delete `hiveBroadcast` and `hiveFormatter` (dead, F5). Add the error-normalization wrapper (§2.7) as
  a no-op-for-hive-js pass-through (hive-js errors already carry `.error`) so T2 changes only internals.
  *Gate:* `npm run verify` (existing test importers still compile — they use `hiveAuth`, unchanged).
- **T1b — repoint the 15 renderer importers** listed in §1.1 (mechanical: callback→`.then` at each
  site or keep a promisify shim per method; delete the dead import in `PromptOperation.js`).
  *Gate:* `verify` + `build` + full Playwright e2e + a manual page-walk (send form, keys pages,
  convert, voting, settings/node-switch); `grep -rn "@hiveio/hive-js" app --include='*.js' --include='*.tsx'`
  → zero hits outside `app/utils/`, `app/main/`, tests, `app/types/hive.d.ts`.
- **T1c — repoint the money path**: `broadcast.ts` → `hiveTx.*` + `hiveConfig.get`; `keystore.ts` →
  `hiveAuth`/`hiveMemo`/`hiveConfig` via the facade. Highest-care commit of T1 — behavior must be
  provably identical.
  *Gate:* `verify` (incl. `broadcast.parity.test.ts` still asserting **signature** equality — valid
  until the engine changes, and the strongest possible no-change proof while hive-js is underneath);
  `mainSign`/`memoEncode`/`signWindow` e2e; final grep: hive-js imports exist **only** in
  `hiveApi.ts` + test files.
  *Rollback (each):* revert the commit; facade groups are additive until T1b/c flip call sites.

**T2 — the engine swap (2 commits, second is the atomic one).**

- **T2a — additive: dep + parity suite red→green.** `npm i hive-tx@7.2.0` (to `dependencies`;
  devDependency `patch-package` + the §4.1 chain-id patch if still needed ⚠). New
  `hiveEngineParity.test.ts` imports **both** engines side by side and asserts, against the T0 fixtures:
  digest equality per op family × {mainnet, testnet}; key-derivation byte-equality; memo cross-decode
  both directions; isWif truth table; §4.2 signature-verification statistics. **No production file
  changes.** *Gate:* `verify` green — this IS the parity proof, landed before the swap.
  ⚠ execution notes: hive-tx is ESM-first with a CJS build (`exports` map verified) — Vitest, Vite
  renderer, and the externalized Electron-main build (`require('hive-tx')` → `index.cjs`, Node≥20,
  Electron 43 ✓) must all resolve it; also confirm electron-builder packages `hive-tx` +
  its nested @noble v2 for the externalized main (same mechanism hive-js uses today).
- **T2b — THE atomic swap.** `hiveApi.ts` internals only: `import hive from '@hiveio/hive-js'` →
  hive-tx imports; every group re-implemented per §2 (facade-owned derivation F4, explicit prefix F3,
  own tapos-prepare, `callRPC` reads, `Transaction`-sign, single-shot broadcast, error adapter §2.7
  now active). Plus the ONLY out-of-file edits allowed: `broadcast.parity.test.ts` +
  `broadcast.ts`/`keystore.ts` comments reframed from "byte-identical signature" to "identical digest,
  verified signature" (F1) — mechanical test/comment truth-maintenance, no behavior.
  *Gate (in order):* 1. `npm run verify` — all unit suites incl. T2a parity + reframed parity test;
  2. `npm run build` + full e2e on a disposable copy of the real profile (accounts appear, unlock works,
  send form renders, sign-window flow); 3. `grep -rn "@hiveio/hive-js" app` → hits only in test files;
  4. **§7.3 testnet smoke — REAL-BROADCAST · HUMAN-AUTHORIZED — one op per family** before the commit
  is called done (it can merge, but the phase gate in MODERNIZATION_PLAN §Phase-4 requires the manual
  testnet send/power-up/witness-vote to pass before release).
  *Rollback:* revert T2b alone → hive-js engine returns under the identical facade surface. This is the
  designed one-commit revert; keep it clean (no drive-by edits).

**T3 — payoff deletions (2 commits).**

- **T3a — main-process:** delete `RIPEMD160_MAIN_BANNER` + its `rollupOptions.output.banner` wiring
  from `electron.vite.config.ts` (hive-js no longer loads in main; hive-tx memo hashing is pure @noble).
  Delete `app/types/hive.d.ts` (hive-tx ships types; hive-js remains only in tests, which keep the
  module untyped-importable via a 3-line `declare module` in a test-local `.d.ts` if `tsc` complains ⚠).
  *Gate:* `verify` + build + `memoEncode`/`mainSign` e2e (proves memo crypto works in main WITHOUT the
  shim — the explicit payoff verification).
- **T3b — renderer:** remove `nodePolyfills(...)` from `electron.vite.config.ts` and drop
  `vite-plugin-node-polyfills` + the stray `buffer` devDependency.
  *Gate:* `npm run build` succeeds; grep-prove no renderer source references `Buffer`/`process.`
  (excluding main/preload, which are Node) ⚠ check the legacy `.js` components for incidental
  `process.env` before assuming; built renderer bundle contains no `buffer/` polyfill module
  (string-search the emitted chunk); full e2e; manual smoke of Keys/Generate + Send (the old
  crypto-consumer pages).
  *Rollback (each):* revert re-adds shim/polyfills; independent of T2.

**T4 — node-list refresh (1 commit).** Replace the 1-entry `servers` list in
`app/components/global/ServerSelect.js` with the current recommended set from developers.hive.io
(⚠ fetch the authoritative list at execution; cross-check against hive-tx's shipped default
`config.nodes`), keep `https://api.hive.blog` as the default (`routes.tsx` fallback unchanged), and on
node *selection* keep `config.nodes = [selected]` pinning. Optionally append the curated list after the
selected node for read failover — decide at execution; default to pin-only (least behavior change).
*Gate:* `verify` + node-switcher manual check (switch to a second mainnet node, watch props refresh).
*Rollback:* revert; cosmetic.

**T5 — test build-out (1–2 commits, tests only).** Per §7.1: mocked-transport unit specs for every
facade method (fetch-level mock so `callRPC`'s JSON-RPC framing is exercised), the §2.7 error-adapter
spec, plus the documented-but-not-auto-run broadcast smoke script. *Gate:* `verify`. *Rollback:* n/a.

---

## 6. Signing byte-parity proof plan (reframed per F1)

**Claim to prove:** for every transaction Vessel can emit, hive-tx produces (1) the **byte-identical
signing digest** hive-js produces — i.e. identical serialization and identical chain-id premixing — and
(2) a signature that cryptographically verifies against that digest for the signing key. Together these
imply the chain accepts the tx exactly as before; signature *bytes* differ run-to-run by design
(hedged nonce), which is chain-irrelevant.

Mechanics (all SAFE, local, no broadcast, throwaway keys; landed as T2a *before* the swap):
- **Digest side:** hive-js digest = `sha256(chain_id ‖ ops.transaction.toBuffer(tx))` via the
  `lib/auth/serializer` deep import (⚠ verify path); hive-tx digest = `new Transaction({transaction:
  tx}).digest().digest`. Assert equality per op family (14 `broadcastOps` + `vote`, `comment`,
  `account_update`) × {mainnet, testnet chain-id+TST} × {plain memo, '#'-encrypted memo string,
  empty memo, multi-op tx, tx with extensions}. The chain-independent `txId` is cross-checked too.
- **Signature side:** hive-tx signature over the digest → `Signature.getPublicKey(digest)` (or noble
  recovery) equals `wifToPublic(wif)`; and hive-js's own `signTransaction` output for the same tx also
  verifies under the same digest (mutual confirmation the digest is what both sign).
- **Statistical acceptance (§4.2):** 512-signature recovery + canonicality census.
- **Main-process replay:** `keystore.test.ts` extended so main-custody `signTransaction` output
  verifies against the same digest — proving renderer-signed and main-signed txs stay equivalent
  (the old byte-identity guarantee, weakened exactly as F1 forces, no further).

Only after digest parity is green may T2b merge; the residual serialization risk (an op family we
didn't fixture) is bounded by the URI sign-window's arbitrary-ops surface — covered by fixturing the
`accountFields` op set from `PromptOperation.js` and accepting fail-closed "Unable to serialize" for
exotic ops hive-tx's 46-op union lacks vs hive-js's fuller table (see R4).

## 7. Test strategy

### 7.1 Mocked-transport unit tests (SAFE, auto-run — T5)
Fetch-level mock (intercept `globalThis.fetch`, return canned JSON-RPC bodies) so the real `callRPC`
code path runs. One spec per facade method: `getAccounts`, `getDynamicGlobalProperties`,
`getVestingDelegations`, `getWithdrawRoutes`, `getSavingsWithdrawFrom`, `getAccountHistory`,
`getWitnessesByVote`, `getConfig`, `getConversionRequests`, `setNode`, `prepareTransaction` (tapos
math against a fixed DGP fixture — the hive-js-replication proof), `broadcastTransaction` (single
attempt, no failover re-send on timeout — assert at the mock), error adapter (hived error → legacy
`.error.data.stack` shape → `setError` renders the real message).

### 7.2 Local-crypto parity + app e2e (SAFE, auto-run — T0/T2a + existing suites)
The §6 digest/derivation/memo/isWif suites; `DecryptModal` wrong-password oracle regression; existing
Playwright specs (`smoke`, `migration`, `mainSign`, `memoEncode`, `signWindow`) on disposable
`VESSEL_USER_DATA` profiles — these are the "real app" gates per project practice.

### 7.3 Broadcast smoke tests — `REAL-BROADCAST · HUMAN-AUTHORIZED · NEVER AUTO-RUN`
A checked-in, documented script (`docs/phase4-testnet-smoke.md` + optional playwright spec tagged
`@real-broadcast`, excluded from default runs) that a human executes explicitly, on a testnet/mirrornet
account with throwaway keys, against a disposable profile: one op per family — transfer,
transfer_to_savings + transfer_from_savings, transfer_to_vesting + withdraw_vesting +
set_withdraw_vesting_route + delegate_vesting_shares, account_witness_vote + account_witness_proxy,
convert + collateralized_convert, custom_json, claim_reward_balance — plus one sign-window
(`vessel://`) flow and one memo'd transfer decoded on the other side. Pass criteria: accepted by the
node, visible in the account history, memo decodes. **This is the phase's release gate on the money
path**; mainnet stays untouched until it passes and MODERNIZATION_PLAN's manual
send/power-up/witness-vote checklist is walked.

## 8. Risks & open questions

- **R1 (F2) chain-id freeze** — highest-probability blocker; resolution path §4.1. If neither upstream
  nor patching is acceptable at execution time, fallback: ship T2 mainnet-only and gate node-switching
  to non-mainnet chains behind a "testnet signing unavailable in this build" guard — ugly, listed only
  as the emergency posture.
- **R2 (F1) signature acceptance** — if testnet hived rejects non-ground signatures (not expected;
  hive-tx v4+ run in production wallets), add the facade-side canonical re-sign loop (§4.2).
- **R3 error shapes** — beyond `setError` (§2.7): timeouts/network failures. hive-js surfaced transport
  errors via callback `err`; `callRPC` throws plain `Error` after exhausting retries ⚠ enumerate its
  failure modes during execution; ensure `ServerStatus`/spinner paths (`_FAILED` reducers) behave under
  a dead node (manual: point at an unreachable node, observe UI).
- **R4 serialization coverage** — hive-tx's op union covers all 17 ops Vessel constructs (verified
  against the union type) but fewer historical ops than hive-js's serializer; an exotic URI-supplied op
  now fails at sign-time with a different message (fail-closed either way). Accepted; note in the
  sign-window docs.
- **R5 asset formatting** — hive-tx serializes condenser-style string amounts and validates the symbol
  whitelist incl. TESTS/TBD (*verified-in-dist*); malformed amounts (`'1 HIVE'`, missing precision) may
  error differently than hive-js ⚠ fixture the failure cases Send.js can produce.
- **R6 `callWithQuorum` under testnet/mirrornet** — quorum needs ≥2 agreeing nodes; single-custom-node
  setups make it unusable; MODERNIZATION_PLAN's open-question #7 stands. Deferred out of Phase 4
  (§2.1); revisit with the T4 list where mainnet has real failover breadth.
- **R7 packaging of externalized main deps** — `build.files=["out/**","package.json"]`; hive-js works
  today as an externalized production dep, hive-tx must ride the same mechanism (incl. its nested
  @noble v2) ⚠ verify with a packaged build + clean-machine launch during T2a.
- **R8 hive-tx bus factor** — single-maintainer library; mitigated by the facade (any future re-swap is
  again one commit) and by hive-js remaining in-tree one release (§9).
- **R9 DGP-shape drift in `state.hive.props`** — `refreshGlobalProps` stores the raw DGP result;
  condenser_api via callRPC returns the same shape hive-js's condenser call did, but `Voting.js`,
  `VestingPage` compute against `total_vesting_*` strings ⚠ eyeball the mocked-transport fixture against
  a live response during execution.
- **R10 first-run node behavior** — fresh install with no `hived_node` preference now reads via
  hive-tx's default failover list instead of hive-js's built-in default (§2.1) — accepted, document.

## 9. Rollback posture

- `@hiveio/hive-js` stays in `package.json` (and on disk in releases) until **one full release after**
  the swap ships; the T0/T2a parity suites import it, so it retains a tested purpose and cannot rot
  silently. Its eventual removal (Phase 8) deletes: the dep, the parity generators (fixtures stay),
  `bluebird` test usage, and the test-local `declare module` shim.
- Engine rollback = `git revert` of **T2b only** (facade surface unchanged on both sides by
  construction). T3a/T3b must be reverted first *only if* already landed (re-adds shim/polyfills);
  hence T3 waits until T2b has survived the §7.3 smoke gate.
- T1a–T1c revert independently (facade repointing is per-commit mechanical).
- The keystore and its envelope are untouched by every commit in this phase (§3 option (a)), so **no
  rollback path here can strand a key** — the PARAMOUNT invariant holds by construction, not by care.
