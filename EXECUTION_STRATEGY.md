# Vessel Modernization — Execution & Orchestration Strategy

Companion to `MODERNIZATION_PLAN_2026.md`. The plan says *what* and *in what order*; this says *who builds it, on which model, at which effort, and by which method* — with the keystore invariant and data-safety encoded as gates, not hopes.

---

## 0. Roles (who is what)

- **Main session = the conductor** (whatever model drives the interactive session; this one runs Fable 5). Owns the git branch, all commits, and runs the *real* verification commands (`npm ci`, `tsc --noEmit`, `lint`, `test`, `build`, Playwright, the profile-copy round-trip). Launches workflows and Fable/Opus subagents. Does trivial edits itself. Never delegates the *gate* — verification is always run by the conductor on the real tree, never trusted from an agent's self-report.
- **Fable subagents.** Author every **sensitive** change (definition below) at `high`/`max` effort, serially, one at a time. Also run **all adversarial review**, regardless of who authored.
- **Opus subagents / Opus-tier workflow agents.** Author **non-trivial, non-sensitive** work (`medium`) — build tooling, router, bulk file conversions.
- **Sonnet.** **Trivial/mechanical** work (`low`) — rename+flow-strip, formatting, dead-dep deletion.

**"Sensitive" (⇒ Fable-serial + Fable-review, NEVER fanned out):** any change touching the keystore or its migration, the crypto envelope, key custody, IPC signing, the URI signing gate, HF28 broadcast key-role selection, or the persisted `keys`-slice shape. One mistake here bricks a wallet, so these are never parallelized and never authored below Fable.

---

## 1. Execution architecture — the per-phase loop

Each phase runs the same loop; the conductor stays in it end to end:

```
spec  →  implement  →  verify  →  adversarial review  →  human gate  →  next phase
 │           │            │              │                    │
 │           │            │              │                    └─ USER reviews at every phase boundary
 │           │            │              │                       (each phase is independently shippable)
 │           │            │              └─ sensitive diffs: adversarial-review workflow (≥3 Fable lenses)
 │           │            └─ conductor runs the REAL gate commands on the REAL tree
 │           └─ Fable (sensitive) serial · Opus (other) · workflow fan-out (wide+safe) · Sonnet/just-do (trivial)
 └─ spec authored by: Fable if the phase is sensitive, Opus if not. Written to scratchpad, USER-reviewed before code for Phases 1, 3, 4-swap.
```

Rules that never bend:
1. **Sensitive phases are specced by Fable and reviewed by the user before a line of code.** (Phases 1, 3, and the Phase-4 engine swap.)
2. **Every keystore-touching step runs against a DISPOSABLE PROFILE COPY** (harness in §5), never `~/Library/Application Support/vessel`. Re-take the cold backup before each such step.
3. **The conductor runs the gate**, prints the actual command output, and only then advances. A green self-report from a subagent is not a gate.
4. **Human review at every phase boundary** — the phase is shippable, the user signs off, then the next phase starts.

---

## 2. Per-phase orchestration table

Method ∈ {**just-do** (conductor/Sonnet inline), **serial-direct** (one agent at a time, stateful), **workflow-fanout** (parallel agents)}.

| Phase | Work unit | Model | Effort | Method | Why |
|---|---|---|---|---|---|
| **0** | devEngines/lockfile/nvmrc/postinstall/eslintignore/title/cleanup | Sonnet / conductor | low | just-do | Trivial config; fixes already-broken gates. No runtime behavior. |
| 0 | Prettier `--fix` mechanical pass (~1.5–2k errors) | Sonnet | low | just-do | Pure formatting; deterministic. |
| 0 | tsconfig honesty (drop `noImplicitAny:false`, delete shadow stubs) | Opus | medium | serial-direct | Small but needs judgment on what surfaces; not sensitive. |
| **1** | **Task 0 storage-layout migration (per-account merge)** | **Fable** | **max** | **serial-direct + review** | Layer-1 invariant; a wrong guard strands the user. The crown jewel. |
| 1 | **KDF envelope (D9a) + legacy OpenSSL-MD5 decrypt shim** | **Fable** | **max** | **serial-direct + review** | Layer-3 invariant; crypto correctness = money. |
| 1 | **Plaintext memo/opt-out fixes; DecryptPrompt leak** | **Fable** | **high** | **serial-direct + review** | Directly on key material. |
| 1 | **bip39 → @scure/bip39 (mnemonic→seed→key path)** | **Fable** | **high** | **serial-direct + review** | Key-generation path; user-visible mnemonic must be identical. |
| 1 | **HF28 authority-role audit + fix** | **Fable** | **high** | **serial-direct + review** | Live money-path bug; wrong role = failed/rogue broadcast. |
| 1 | Profile-copy test harness scaffolding | Opus | medium | serial-direct | Infra supporting the sensitive work; Fable writes the *assertions*. |
| **2** | electron.vite.config + index.html + Flow-JSX spike | Opus | medium | serial-direct | High change-risk, zero key/money exposure; one interdependent surface. |
| 2 | **hive-js-signs-a-tx-through-polyfills spike** | Opus (author) + Fable (verify result) | medium / high | serial-direct | Spike is throwaway, but it exercises signing → Fable sanity-checks the proof. |
| 2 | pkg collapse + electron-builder 24→26 (MR-B) | Opus | medium | serial-direct | Packaging; gated on manual per-platform install. |
| 2 | ESLint 10 flat config + Vitest + Playwright harness + GitLab CI | Opus / Sonnet | medium / low | serial-direct | Tooling; not parallelizable (one config surface). |
| **3** | **contextIsolation flip (both windows) + preload wiring** | **Fable** | **max** | **serial-direct + review** | Highest blast radius; changes every renderer assumption. |
| 3 | **D9b main-process custody + IPC signing** | **Fable** | **max** | **serial-direct + review** | New money-path structural code; no-WIF-in-renderer invariant. |
| 3 | **URI signing gate (confirmation + password-every-broadcast)** | **Fable** | **high** | **serial-direct + review** | [critical] one-click-drain fix. |
| 3 | 6× `require('electron')`→`electronAPI` rewrites | Opus | medium | serial-direct | Mechanical, non-key; batched, but entangled with the isolation flip. |
| 3 | CSP / setWindowOpenHandler / shell allowlist / devToolsLog delete | Opus (author) + Fable (review) | medium / high | serial-direct | Security surface, not key-custody logic; Fable reviews. |
| 3 | Staged Electron bumps (28→…→latest) | Opus | medium | serial-direct | Dep bump + re-run key-role/sign-window checks each hop. |
| **4** | Facade extension + repoint 14 importers (hive-js still under) | Opus | medium | serial-direct | Mechanical repointing; behavior must be identical. |
| 4 | **Engine swap hive-js → hive-tx (one commit)** | **Fable** | **max** | **serial-direct + review** | Serialization/signing correctness = money path. |
| 4 | Node-list refresh; mocked-transport unit tests | Sonnet / Opus | low / medium | just-do / serial-direct | Non-sensitive; testnet money-path assertions Fable-reviewed. |
| **5** | Non-sensitive file backlog (~50 of ~65 files) → TS/hooks/RTK | Opus (+Sonnet stage-1) | medium / low | **workflow-fanout** | Wide, independent, per-file reversible — the prime fan-out. |
| 5 | **Sensitive files** (`actions/keys`,`actions/account`,`reducers/keys`, `Keys/*`, `Send`, `sign/*`, `PromptOperation`, `DecryptPrompt`) | **Fable** | **high** | **serial-direct + review** | Pulled OUT of the fan-out; touch keys/broadcast/slice-shape. |
| 5 | **keysSlice + accountSlice RTK conversion** | **Fable** | **max** | **serial-direct + review** | Layer-2 slice-shape invariant + broadcast thunks. |
| 5 | preferences/processing/hive slices | Opus | medium | serial-direct | Non-sensitive slices. |
| **6** | Router v6→v8 codemod + data-router + ESM convergence | Opus | medium | serial-direct | Mechanical-ish; **sign-window mount reviewed by Fable** (money-path surface). |
| 6 | Playwright smoke-suite growth | Opus / Sonnet | medium / low | serial-direct | Test authoring. |
| **7** | Container-by-container Mantine migration (non-sensitive pages) | Opus | medium | **workflow-fanout** | Wide UI, low stakes, per-container reversible. |
| 7 | Send / sign+prompt windows / Keys flows (money-path UI) | Opus (author) + Fable (review) | medium / high | serial-direct | UI that collects keys / triggers broadcast → Fable eyeballs. |
| 7 | React 18→19 codemod | Opus | medium | serial-direct | One-MR mechanical codemod. |
| **8** | Doc deletes / dead-dep prune / README rewrite | Sonnet / conductor | low | just-do | Dead-code only. |
| 8 | Version bump + tagged release + packaging | Opus + **human** | medium | serial-direct | Human-gated; clean-machine install on all 3 OSes. |

---

## 3. Workflow skeletons (real, run with light editing)

### 3a. Phase 5 backlog-conversion wave (batched < 15 agents, sensitive files excluded)

Pre-classify files first (conductor): the **sensitive list** goes to Fable serial; only the **non-sensitive** list is passed as `args.files`. The stage-3 Fable review is a *safety net* for any file that still transitively imports a key/broadcast module.

```js
export const meta = {
  name: 'phase5-backlog-wave',
  description: 'Convert one wave of non-sensitive legacy .js to TS/hooks/RTK; Fable-review any that touch key/broadcast imports',
  phases: [
    { title: 'Convert', detail: 'rename+flow-strip then class→hooks, behavior-preserving' },
    { title: 'Verify',  detail: 'static behavior/type review per file' },
    { title: 'Review',  detail: 'Fable adversarial review ONLY for files importing keys/account/hive' },
  ],
}

// args = { files: [{path, kind}], sensitiveImports: ['actions/keys','actions/account','utils/hiveApi','reducers/keys'] }
const files = args.files
const SENS  = args.sensitiveImports || ['actions/keys','actions/account','utils/hiveApi','reducers/keys']

const FILE_OUT = { type:'object', required:['path','newContent','importsSensitive','notes'],
  properties:{ path:{type:'string'}, newContent:{type:'string'},
    importsSensitive:{type:'boolean'}, notes:{type:'string'} } }
const VERDICT = { type:'object', required:['ok','issues'],
  properties:{ ok:{type:'boolean'}, issues:{type:'array', items:{type:'string'}} } }

const results = await pipeline(files,
  // Stage 1 — convert; return the new content (parent writes it, so no worktree-merge dance).
  (f) => agent(
    `Convert ${f.path} (a legacy Flow/class-component .js ${f.kind}) to strict TS.
     A) rename to .ts/.tsx, strip @flow, type the obvious (any where Flow was loose).
     B) if a class component → function component with hooks; PRESERVE BEHAVIOR EXACTLY.
     HARD RULES: do not change any persisted-state or keys-slice shape; do not alter broadcast/signing behavior.
     Return full new file content, and set importsSensitive=true if it imports any of: ${SENS.join(', ')}.`,
    { label:`convert:${f.path}`, phase:'Convert', model:'opus', effort:'medium', schema:FILE_OUT }),

  // Stage 2 — cheap static second-look (real tsc/lint is run by the conductor after write).
  (out, f) => out && agent(
    `Static-review this converted TS ${f.kind} for Flow leftovers, lost lifecycle behavior, or changed prop/state shape:\n${out.newContent}`,
    { label:`verify:${f.path}`, phase:'Verify', model:'sonnet', effort:'low', schema:VERDICT })
      .then(v => ({ ...out, verify:v })),

  // Stage 3 — Fable adversarial review ONLY if the file reaches key/broadcast code.
  (out) => {
    if (!out) return null
    if (!out.importsSensitive) return out
    return agent(
      `ADVERSARIAL Fable review — ${out.path} imports a key/broadcast module. Try to BREAK it:
       does it change the keys-slice shape, change which key role signs which op, introduce a plaintext-key path,
       or drift persisted state? Default ok=false unless you can prove none of these.\n${out.newContent}`,
      { label:`fable-review:${out.path}`, phase:'Review', model:'fable', effort:'high', schema:VERDICT })
        .then(r => ({ ...out, fableReview:r }))
  }
)

return { converted: results.filter(Boolean) }
// Conductor then: write each newContent, commit rename+strip and class→hooks as SEPARATE commits per directory,
// run the real `tsc --noEmit` + lint gate, and hand any fableReview.ok===false file to a Fable serial fix.
```

Run one wave per directory tier, each its own invocation so the conductor reviews/commits between waves:
`{files: utils+non-sensitive actions/reducers}` → `{files: non-sensitive containers}` → `{files: components A}` → `{files: components B}`. Keeps every wave < 15 agents.

*(Worktree alternative:* if you want each agent to run `tsc` on its own island and iterate before returning, give stage-1 `isolation:'worktree'` and have it return commit refs instead of content — costs ~200–500ms + disk per agent and a merge step; only worth it if self-verification materially raises quality. Default to return-content.)*

### 3b. Reusable adversarial-review workflow (gates every sensitive MR)

```js
export const meta = {
  name: 'adversarial-review',
  description: 'Independent multi-lens Fable review of a sensitive diff before merge',
  phases: [{ title: 'Review' }],
}

// args = { diffRef:'HEAD~1..HEAD', context:'Phase 1 Task 0 migration', lenses?:[...] }
const LENSES = args.lenses || [
  'keystore-invariant: can this make an existing v4 or v6 keystore unreadable, drop/rename an account, or change the keys-slice shape?',
  'crypto-correctness: KDF params, AES-GCM nonce uniqueness, EXACT legacy OpenSSL-MD5/1-iter decrypt, non-destructive re-encrypt-on-unlock',
  'signing-authority: does every op sign with the correct HF28 key role; can a posting key satisfy an active-authority op?',
  'renderer-exposure: does any WIF reach the renderer, get persisted in clear, or hit a log/DevTools?',
]
const VERDICT = { type:'object', required:['lens','refuted','severity','findings'],
  properties:{ lens:{type:'string'}, refuted:{type:'boolean'},
    severity:{enum:['blocker','major','minor','none']}, findings:{type:'array', items:{type:'string'}} } }

const verdicts = (await parallel(LENSES.map(l => () =>
  agent(`Adversarial Fable reviewer. Diff: ${args.diffRef}. Context: ${args.context}.
         Lens: ${l}
         Read the diff and touched files; try to BREAK it. Default refuted=true unless you can prove it safe.`,
    { label:`review:${l.split(':')[0]}`, phase:'Review', model:'fable', effort:'high', schema:VERDICT })
))).filter(Boolean)

const blockers = verdicts.filter(v => v.refuted || v.severity==='blocker')
return { verdicts, blockers, pass: blockers.length===0 }
```

### 3c. Phase 7 container migration
Same shape as 3a: `args.files` = non-sensitive containers, stage-1 Opus `medium` migrates one container to Mantine, stage-2 parity-check, stage-3 Fable review triggered when the container is `Send`/`sign`/`prompt`/`Keys/*`. Batch < 15 per wave; both UI libraries coexist so each container ships independently.

---

## 4. Sensitive-phase protocol (Phases 1, 3, Phase-4 swap)

Explicit serial loop — **no fan-out at any step**:

1. **Re-backup** the live profile (`tar czf ~/Vessel-Keystore-Backups/vessel-profile-$(date +%Y%m%d-%H%M%S).tar.gz -C "$HOME/Library/Application Support" vessel`, `chmod 444`, sha256).
2. **Spec** — Fable `high` authors the implementation spec (module layout, function signatures, the exact OpenSSL-MD5 decrypt, migration guard, fixtures) → **written to scratchpad → USER reviews and approves before any code.**
3. **Implement** — Fable `max` authors the change serially, editing against a **profile copy** only.
4. **Verify (conductor)** — run the concrete gate on the real tree:
   - `npm run typecheck && npm run lint && npm test`
   - the **three-layer round-trip** unit test (§5) — must be green.
   - keystore steps: the **manual profile-copy check** (§5) — account appears + testnet broadcast with the original password.
5. **Adversarial review** — run the `adversarial-review` workflow (3b) with ≥3 Fable lenses over the diff. Any `blocker`/`refuted` → back to step 3.
6. **Human gate** — user reviews the shippable diff at the phase boundary.

The `keys` reducer and `account` actions are **held out of the Phase-5 fan-out entirely** and run through this same protocol.

## 5. Profile-copy test harness (the data-safety gate, made concrete)

Two layers, neither ever touches the real profile:

**Unit (Vitest/Jest, jsdom localStorage) — synthetic but real-format:**
```js
// seed a v4 blob the way the shipped app wrote it — with a THROWAWAY wif, not a real key
const wif = '5J...throwaway...'; const pw = 'test-password'
const enc = CryptoJS.AES.encrypt(wif, pw).toString()            // "U2FsdGVkX1…" OpenSSL/MD5 form
localStorage.setItem('reduxPersist:keys', JSON.stringify({
  names:['alice'],
  permissions:{ alice:{ account:'alice', key:enc, encrypted:true, type:'active', memo:'5J...memo...' } }
}))
// then: run migration → assert persist:root.keys has alice → decrypt(enc, pw)===wif (layer 3)
//       → re-encrypt to v2 → restart(reload) → still unlocks → localStorage has NO cleartext wif/memo
//       → reduxPersist:keys still present (non-destructive) → wrong pw rejected → absent-key = no-op
```

**Manual / e2e — a disposable COPY of the real profile:**
```bash
TESTDIR="$TMPDIR/vessel-e2e-$(date +%s)"; mkdir -p "$TESTDIR"
tar xzf ~/Vessel-Keystore-Backups/vessel-profile-<ts>.tar.gz -C "$TESTDIR"   # copy, never the original
electron . --user-data-dir="$TESTDIR/vessel"                                 # app points at the copy
# assert: existing accounts appear; a testnet op broadcasts with the original password
```
Electron reads `--user-data-dir` (or `app.setPath('userData', …)` under a `VESSEL_TEST_PROFILE` env flag) so no build ever writes to `~/Library/Application Support/vessel`.

---

## 6. cswap gating cadence

Run `python3 ~/.claude/skills/cswap/scripts/snapshot.py` **before every heavy launch** — that means: any Workflow invocation (Phase 5/7 waves, the adversarial-review fan-out) and any 3+-agent fan-out. Thresholds on the **binding Fable window**:
- **Heavy work blocked ≥ 80%** (≥ **70%** if 2+ other sessions are busy — they drain the same pool while a wave runs).
- Light single-agent Fable/Opus serial work may continue to ~95%.
- Snapshot **before each Phase-5 and Phase-7 wave** (they're the token-heaviest), and before each adversarial-review run on a big diff.
- If blocked: swap accounts if another is ≥20 pts lower on Fable, else defer with an armed reset trigger — never launch a wave "quickly before the limit."

Current headroom (session 28%, Fable weekly 35%) is well under the gate — all clear to start.

## 7. What must NOT be a workflow (and why)

- **Phase 1 (crypto/migration/HF28)** — sequential, stateful, incident-grade; the invariant can't be parallelized and a wrong branch bricks wallets.
- **Phase 3 (isolation/custody/URI gate)** — interdependent MRs on the money path; highest blast radius in the plan.
- **Phase 4 engine swap** — a single atomic commit on the signing path.
- **Phase 2 build config** — one interdependent surface (vite/eslint/vitest/ci); parallel agents would just collide on the same files with no isolation benefit, and the two spikes must be proven *serially* before anything commits.
- **Phase 8 release** — human-gated, single machine, one packaging pipeline.

Workflows fit exactly three things: the **Phase-5 non-sensitive backlog**, the **Phase-7 non-sensitive containers**, and the **adversarial-review fan-out** (which *reads* a diff, never mutates). Everything sensitive is Fable-serial.

---

## 8. First concrete move on greenlight

1. **Phase 0, immediately, just-do** (conductor + Sonnet): the config/lockfile/eslint/tsconfig fixes → get `npm ci && npm run lint && npm run typecheck && npm run build` to an honest green. Commit per-item. This makes every later risk *detectable*.
2. **Fable authors the Phase 1 implementation spec** (`high`) — `keyEnvelope.ts` module shape, the per-account migration guard, the OpenSSL-MD5 legacy decrypt, the three-layer test fixtures, the profile-copy harness — **written to scratchpad for the user to approve before any keystore code.**
3. On approval: **Fable implements Phase 1 serially** against a profile copy, conductor runs the three-layer gate, then the `adversarial-review` workflow, then the user's phase-boundary sign-off.

Phases 0 and the Phase-1 spec are the only things that start now; everything downstream waits on its predecessor's human gate.
