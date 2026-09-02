# RQ1 FCP/TTI Experiment Protocol

**Status: PROTOCOL_CREATED / INFRASTRUCTURE_READY. `REAL_RQ1_RUNS_COLLECTED: 0`.** This document
defines the experiment; it does not report results. No FCP/TTI data has been collected for
inclusion in the dissertation as of this writing. See
`docs/audit/STAGE_3_RQ1_EXPERIMENT_PROTOCOL_REPORT.md` (infrastructure build) and
`docs/audit/STAGE_3A_RQ1_PROTOCOL_CLOSURE_REPORT.md` (protocol-gap closure: framework scope,
network/CPU profile, warm-up enforcement) for the build record.

**RQ1 (authoritative wording, Research Proposal §2.3 / Interim Submission 02 §1.4):** *How do
different Single Page Application (SPA) render and state-management strategies influence
performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?*

## 0. What this protocol explicitly refuses to do

- It does not substitute the FIGM scanner's own scan-duration timing for FCP or TTI. That figure
  (`app/performance/page.tsx`, prior to Stage 3's UI-safety fix) measures how long FIGM's static
  analyzer takes to run — a property of the analysis tool, not of the page being analyzed. It has
  no defensible relationship to a browser's paint or interactivity timing and must never be cited
  as evidence toward RQ1.
- It does not silently substitute Largest Contentful Paint (LCP), Total Blocking Time (TBT), or
  Interaction to Next Paint (INP) for TTI. Those are reported separately, under their own names,
  only if a future pass adds them explicitly as supplementary metrics — never relabelled as TTI.
- It does not report or imply a result before real data has been collected (Section 10, 13, 14).
- It does not claim an Angular-only, or cross-framework, runtime performance result. This
  experiment's runtime scope is React/Next.js only (Section 2) — a deliberate, researcher-confirmed
  decision, not an oversight.

## 1. RQ1 Runtime Framework Scope (Stage 3A — finalized)

**RQ1_RUNTIME_FRAMEWORK_SCOPE: React/Next.js controlled experiment.**
**PRIMARY_FIGM_FRAMEWORK_SCOPE: React, Next.js, Angular** (unchanged — this experiment's scope
decision does not alter FIGM's overall primary-framework scope for guideline development,
static-analysis validation, or real-repository evaluation; see `docs/research/FINAL_RESEARCH_CONTRACT.md`
Section 4).
**ANGULAR_RQ1_RUNTIME_FIXTURE: NOT_REQUIRED_FOR_THIS_EXPERIMENT.**

**Researcher-confirmed rationale (2026-09-03):** RQ1 investigates rendering and state-management
strategy effects on FCP/TTI. It does not explicitly require a cross-framework performance
comparison. React/Next.js provides a controlled, technically valid CSR/SSR/LOCAL/GLOBAL experiment
sufficient to answer RQ1 within this scope.

**LIMITATION (record this explicitly wherever RQ1 runtime results are reported):** RQ1 runtime
results are specific to the controlled React/Next.js fixture implementation described in this
document and must not be generalized as measured Angular runtime performance, or as a
cross-framework performance comparison of any kind. Angular remains a PRIMARY framework for FIGM's
static-analysis rule set and real-repository evaluation — this limitation concerns only the RQ1
*runtime* experiment's scope, not FIGM's overall framework coverage.

This decision **resolves** the item Stage 3's report left open ("decide whether an Angular fixture
is required before RQ1 can be considered answered") — Stage 3's earlier framing
(`NOT_IMPLEMENTED_THIS_STAGE`, implying a still-open gap) is superseded by this section; a fixture
is not merely deferred, it is not required for this experiment's scope at all.

## A. Independent Variables

### A.1 Rendering strategy: CSR, SSR

Chosen set: **Client-Side Rendering (CSR)** and **Server-Side Rendering (SSR)** — the protocol's
own recommended minimum. Static Generation (SSG) was considered and explicitly rejected as a
third condition: Next.js automatically optimizes a page with no per-request data into a
statically-generated page, which would have silently turned the intended "SSR" condition into SSG
unless prevented. `app/rq1-experiment/ssr-local/page.tsx` and `ssr-global/page.tsx` both declare
`export const dynamic = 'force-dynamic'` specifically to keep this a genuine, per-request server
render rather than build-time static output — verified in the build log (`ƒ` dynamic marker, not
`○` static, for both routes).

- **CSR**: the page ships an empty initial shell; all 50 fixture items are generated and painted
  only after a client-side `useEffect` runs post-hydration. Verified empirically: the raw served
  HTML for `/rq1-experiment/csr-local` contains zero occurrences of the fixture item text.
- **SSR**: all 50 fixture items are generated server-side and present in the initial HTML response,
  before any client JS executes. Verified empirically: the raw served HTML for
  `/rq1-experiment/ssr-local` contains the fixture item text already present in the response body.

### A.2 State-management strategy: LOCAL, GLOBAL

- **LOCAL**: each fixture item owns its own `useState` counter (`app/rq1-experiment/_shared/ItemCardLocal.tsx`) — no state is shared or lifted.
- **GLOBAL**: every fixture item's counter lives in one shared `React.Context` provider
  (`app/rq1-experiment/_shared/GlobalStore.tsx`, consumed by `ItemCardGlobal.tsx`). React's own
  Context API was chosen deliberately over introducing a new dependency (Redux, Zustand, MobX): it
  is the minimal built-in mechanism that genuinely represents "centralized/global state," and this
  protocol's own instruction is not to add libraries "solely to produce more conditions" without
  justification — a within-framework LOCAL/GLOBAL contrast does not need one.

## B. Conditions Matrix

| Condition ID | Framework | Rendering | State | Route |
|---|---|---|---|---|
| `CSR_LOCAL` | Next.js/React | CSR | LOCAL | `/rq1-experiment/csr-local` |
| `CSR_GLOBAL` | Next.js/React | CSR | GLOBAL | `/rq1-experiment/csr-global` |
| `SSR_LOCAL` | Next.js/React | SSR | LOCAL | `/rq1-experiment/ssr-local` |
| `SSR_GLOBAL` | Next.js/React | SSR | GLOBAL | `/rq1-experiment/ssr-global` |

## 3. Control Variables

**STAGE 3A CORRECTION**: Stage 3's original worker passed `formFactor: 'desktop'` and
`screenEmulation: { disabled: true }` as loose flags with no Lighthouse `config` object. This does
NOT cascade to desktop network/CPU throttling or a desktop user-agent in Lighthouse — only the
dedicated `lighthouse:desktop` / `desktop-config.js` preset does that. Verified by dumping the real,
resolved `lhr.configSettings` (not assumed): the original setup silently ran with Lighthouse's
**mobile** `mobileSlow4G` throttling (rttMs 150, cpuSlowdownMultiplier 4) and a mobile
Android/Chrome user-agent, despite claiming "desktop" — an internally inconsistent, non-
reproducible-as-intended configuration that affected every FCP/TTI number collected during Stage 3
(including its smoke-test runs, which have since been superseded). Fixed by using Lighthouse's own
`lighthouse/core/config/desktop-config.js` preset directly
(`research/rq1-experiment/scripts/lighthouse-worker.mjs`), which resolves to the real, coherent
desktop profile below.

| Variable | Value | Notes |
|---|---|---|
| Browser | Google Chrome 152.0.7977.65 | `environment/baseline.json` |
| Mode | Headless (`--headless=new --no-sandbox --disable-gpu`) | Required to launch reliably in this sandboxed environment; a headed run could show different timing in principle |
| OS | Windows 11 Home Single Language 10.0.26200 | `environment/baseline.json` |
| CPU | 11th Gen Intel Core i5-11400H, 6 cores / 12 logical processors | `environment/baseline.json` |
| RAM | 15.7 GB | `environment/baseline.json` |
| Lighthouse config preset | `lighthouse/core/config/desktop-config.js` (Lighthouse's own official desktop preset — not a hand-assembled flag set) | `lighthouse-worker.mjs` |
| formFactor | `desktop` | Resolved from the preset, confirmed via `lhr.configSettings` |
| throttlingMethod | `simulate` | Resolved from the preset |
| Throttling profile (`desktopDense4G`) | `rttMs: 40`, `throughputKbps: 10240`, `requestLatencyMs: 0`, `downloadThroughputKbps: 0`, `uploadThroughputKbps: 0`, `cpuSlowdownMultiplier: 1` | Real, resolved values read directly from a live run's `lhr.configSettings` via `research/rq1-experiment/scripts/_smoke-configsettings.mjs` — not transcribed from documentation. `requestLatencyMs`/`downloadThroughputKbps`/`uploadThroughputKbps` of `0` mean those specific override fields are unset; `rttMs`/`throughputKbps` are the values actually applied. Recorded in `protocol.json`'s `environment.throttling` and `environment/baseline.json`. |
| screenEmulation | `{ mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }` | Real desktop viewport (1350×940), resolved from the preset — not the native-headless-viewport/"disabled" configuration Stage 3 used |
| emulatedUserAgent | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36` | Real desktop Chrome/macOS UA, resolved from the preset |
| Cache policy | Cold — Lighthouse's default storage reset (clears cache/storage) before every navigation | No warm/repeat-view variant implemented |
| Cold/warm navigation | Cold only; one fresh headless Chrome instance launched per run, including warm-up runs (Section 4) | Guarantees no state leaks between runs |
| Application build mode | Production (`next build && next start`), never `next dev` | Dev mode ships unminified bundles, HMR client, and a dev overlay that would distort timing; enforced in `run-experiment.ts`'s `startServer()` |
| Node version | v22.14.0 | `environment/baseline.json` |
| Dependency lock | `package-lock.json` SHA-256 `2f354a7e...` (see `environment/baseline.json` for the full hash) | Recorded so a re-run can verify it used the same dependency tree |
| Test dataset / content | 50 deterministic fixture items, identical text across all four conditions (`app/rq1-experiment/_shared/generate-items.ts`) | No `Math.random`/`Date`-based content — same run always produces the same DOM |
| Route under test | One of the four in Section B | — |
| Server startup procedure | `run-experiment.ts` spawns `npx next start -p <port>` and polls `/rq1-experiment` until it returns HTTP 200 (60s timeout) before any measurement begins | — |

**One fixed profile is used for every condition and every run** — the profile above is never
switched between conditions; the goal is reproducibility, not selecting whichever profile produces
the most favorable-looking result. **The only intentional differences between conditions are
rendering strategy and state-management strategy.**

## 4. Sample / Repetition Policy (Stage 3A — warm-up now enforced)

- **Frozen minimum for the final experiment: 1 warm-up run + 10 measured runs per condition**
  (`protocol.json`'s `warmupRuns: 1`, `measuredRuns: 10`; `--warmup-runs`/`--measured-runs` CLI
  flags override either for a fuller pass — e.g. `--measured-runs 20`).
- **Warm-up runs are now actually executed and enforced**, closing the gap Stage 3's report
  disclosed ("declared but NOT enforced"). `run-experiment.ts`'s per-condition loop runs exactly
  `warmupRuns` real executions first (recorded with `isWarmup: true`, own `runNumber` sequence
  starting at 1), then exactly `measuredRuns` real executions (`isWarmup: false`, own `runNumber`
  sequence starting at 1). `warmupRuns=1, measuredRuns=10` therefore produces exactly **11** real
  browser executions per condition — not 9, not 10, not 12.
- **A warm-up failure is recorded the same honest way a measured failure is** — `status: 'FAILED'`,
  real error message, `isWarmup: true` — and never silently becomes, or silently blocks, a measured
  run. Verified via a real (not simulated) failure captured during Stage 3A's own smoke-testing (a
  transient `chrome-launcher` WebSocket connection error), which was recorded honestly and did not
  abort the run.
- **Every recorded row originates from a real Lighthouse/Chrome execution.** No row is
  synthesized, interpolated, or copied to "meet" the repetition target — `schema.ts`'s
  `isValidRawResultRow` rejects any row whose `status: 'OK'` fields are not real finite positive
  numbers, and a failed run is recorded as `status: 'FAILED'`, never silently dropped or replaced.
- **Final run-count policy (Section 7):** 4 conditions × (1 warm-up + 10 measured) = 4 warm-up + 40
  measured = **44 total browser executions** for the final experiment. This is the minimum frozen
  protocol; it is not run as part of this document's own creation (Section 13).

## 5. FCP Measurement

**Mechanism: Lighthouse's `first-contentful-paint` audit**, requested explicitly via
`onlyAudits: ['first-contentful-paint', 'interactive']` against the `desktop-config.js` preset
(Section 3). This audit computes FCP from a real Chrome performance trace (the same mechanism
`PerformanceObserver`/Performance Timeline exposes to page JavaScript, but captured from outside
the page via Chrome's tracing protocol). Value read: `numericValue` (milliseconds). **Verified
real**, both before and after the Section 3 throttling-profile correction, via
`research/rq1-experiment/scripts/_smoke-lighthouse.mjs` / `_smoke-configsettings.mjs` against real
URLs — not assumed to work.

Each raw result row records: `conditionId`, `framework`, `renderingStrategy`,
`stateManagementStrategy`, `runNumber`, `fcpMs`, `ttiMs`, `status`, `error`, `browserVersion`,
`nodeVersion`, `lighthouseVersion`, `timestamp`, `experimentVersion`, `isSmokeTest`, `isWarmup` —
see `research/rq1-experiment/scripts/schema.ts`'s `RawResultRow` for the exact, tested shape.

## 6. TTI Measurement

**Investigation performed before implementing anything** (per this protocol's own instruction):
Lighthouse 10+ removed Time to Interactive from its *default displayed* performance-category audit
set, but the underlying `interactive` audit — Lighthouse's own historical TTI algorithm
implementation — still ships in the installed `lighthouse` npm package (v12.8.2) and can be
requested explicitly via `onlyAudits: ['interactive']`. Confirmed empirically, not assumed.

**Mechanism: Lighthouse's `interactive` audit, exact same tool/version/run/config preset as FCP**
(Section 5) — deliberately the same tool for both metrics, so FCP and TTI in a given row come from
the identical trace under the identical desktop throttling profile, not two different measurement
mechanisms (or two different throttling assumptions) that could disagree on what "the page load"
even means. Tool: `lighthouse` npm package. Version: `12.8.2`. Algorithm: Lighthouse's own internal
TTI computation (network-quiet + CPU-quiet window detection after FCP). No TBT, INP, LCP,
DOMContentLoaded, or load-event value is ever written to the `ttiMs` field — `schema.ts`'s
validator only accepts a value that came from this specific audit's `numericValue`.

## 7. Experiment Fixtures

Location: `app/rq1-experiment/` (a real Next.js App Router route group; see
`research/rq1-experiment/fixtures/WHERE_THE_FIXTURES_ACTUALLY_LIVE.md`). Entirely separate from
`src/` — the production FIGM scanner/detection engine is never imported by, and never analyzes,
these fixture pages.

**Fixture equivalence**, held identical across all four conditions:
- **Content**: 50 deterministic items (`generate-items.ts`), each with a title and a fixed
  paragraph of body text — same 50 items, same text, in every condition.
- **DOM size**: 50 card elements, each with an `<h3>`, a `<p>`, and a `<button>` — structurally
  identical markup across conditions.
- **Asset count**: no images; all four conditions share the same Next.js JS bundle chunks plus
  their own small route-specific chunk.
- **Interaction workload**: one button per item (50 total), each incrementing a counter by 1 on
  click — identical interaction shape whether the counter is local or global state.
- **Data volume**: identical (50 items × the same fixed body-text string length in every
  condition).

The only deliberate differences are exactly the two independent variables (Section A) — nothing
else about the fixtures varies between conditions.

## 8. Automated Runner

`research/rq1-experiment/scripts/run-experiment.ts` (run via
`node --import tsx research/rq1-experiment/scripts/run-experiment.ts [--smoke] [--warmup-runs N] [--measured-runs N] [--conditions ID,ID] [--port N]`):

1. Reads `protocol.json` for the default `warmupRuns`/`measuredRuns` and condition list
   (`schema.ts`).
2. Spawns `npx next start -p <port>` (production server) and polls until ready (60s timeout).
3. For each condition: executes Phase 1 (warm-up, `isWarmup: true`, `warmupRuns` repetitions), then
   Phase 2 (measured, `isWarmup: false`, `measuredRuns` repetitions). Each execution spawns
   `lighthouse-worker.mjs` as a separate plain-JS child process (via `execFile`), which launches a
   fresh headless Chrome (`chrome-launcher`) and runs Lighthouse (via `desktop-config.js`, Section 3)
   against that condition's route requesting only the FCP and TTI audits, printing the result as one
   line of JSON on stdout. **Why a subprocess**: calling `lighthouse()` directly from
   `run-experiment.ts` under `node --import tsx` reliably threw
   `ReferenceError: __name is not defined` *inside the browser page context* — tsx's process-wide
   CJS loader hook corrupts a literal function-source string Lighthouse extracts via `.toString()`
   and injects into the page. Isolated via a minimal reproduction before this architecture was
   adopted (not guessed) — see `lighthouse-worker.mjs`'s own header comment.
4. Writes one raw JSON file per run to `raw-results/` (or `raw-results/smoke-test/` under
   `--smoke`) — never batches multiple runs into one file, so a partial run never loses already-
   collected data. Warm-up files are named `..._warmupNNN_...json`; measured files
   `..._runNNN_...json`.
5. On a per-run failure (worker/Chrome/Lighthouse error), the row is recorded with
   `status: 'FAILED'`, `fcpMs: null`, `ttiMs: null`, and the real caught error message — the loop
   continues rather than aborting the whole experiment, for both warm-up and measured phases.
6. Kills the Chrome instance after every run and the Next.js server (via an awaited, process-tree
   `taskkill /T /F` on Windows) at the end of the whole run.
7. **Never inserts a placeholder value.** `0` is never written for a missing metric; `null` is.

## 9. Raw Result Schema

`research/rq1-experiment/scripts/schema.ts`'s `RawResultRow` interface:

```
experimentVersion, conditionId, framework, renderingStrategy, stateManagementStrategy, runNumber,
fcpMs, ttiMs, status, error, browserVersion, nodeVersion, lighthouseVersion, timestamp,
isSmokeTest, isWarmup
```

`isValidRawResultRow()` enforces: a successful row must have finite, positive `fcpMs`/`ttiMs` and
`error: null`; a failed row must have `fcpMs: null`, `ttiMs: null`, and a non-empty `error` string
— for both measured and warm-up rows alike.

**Three distinguishable, non-overloaded categories** (`classifyRun()`): `SMOKE_TEST` (isSmokeTest),
`WARMUP` (isWarmup, not smoke), `FINAL_MEASURED_RUN` (neither) — precedence in that order (a row
that is both smoke and warmup classifies as `SMOKE_TEST`, since it is still, first and foremost,
not research data). `isSmokeTest` and `isWarmup` are independent booleans, never one overloaded
flag.

## 10. Analysis Pipeline

`research/rq1-experiment/scripts/analyze-results.ts`
(`node --import tsx research/rq1-experiment/scripts/analyze-results.ts [--dir DIR] [--include-smoke] [--include-warmup]`):

- Reads every `*.json` file in `raw-results/`. By default, excludes `isSmokeTest === true` rows,
  excludes `isWarmup === true` rows, and separates `FAILED` rows out of the valid-metric
  computation — but **never silently deletes a failure from the audit trail**: every row, smoke,
  warm-up, measured-valid, and measured-failed alike, is counted in `computeExecutionBreakdown()`'s
  report (`totalExecutions`, `smokeExecutions`, `warmupExecutions`, `measuredExecutions`,
  `validMeasuredN`, `failedMeasuredN`), written into every `summary.md`/`summary.json` this pipeline
  produces.
- Refuses to read `raw-results/smoke-test/` unless `--include-smoke` is explicitly passed.
- Validates every row against `schema.ts`'s validator before using it — an invalid/malformed file
  throws rather than being silently skipped.
- Per condition (measured, valid rows only): `n_valid`, `n_failed`, and for both FCP and TTI —
  mean, median, standard deviation, min, max.
- **Cross-condition comparisons** (`compareByDimension()`): CSR vs SSR (pooling both state-
  management variants of each), and LOCAL vs GLOBAL (pooling both rendering variants of each) — in
  addition to the four individual conditions.
- `significanceCaveat()` explicitly refuses to imply statistical significance when any condition
  has fewer valid runs than this protocol's minimum (10), and even above that threshold states
  plainly that only descriptive statistics are computed — no t-test or other inferential claim is
  made anywhere in this pipeline, and none should be inferred without a separately justified,
  explicitly-added test.
- Every `summary.md` this pipeline writes states explicitly: this is descriptive statistics over a
  controlled React/Next.js fixture only, with no causal generalization beyond it and no claim about
  Angular or any other framework's runtime performance.

## 11. Experiment Versioning

- **Protocol version**: `1.0.0` (`protocol.json`'s `experimentVersion`, `schema.ts`'s
  `EXPERIMENT_VERSION` — kept in sync; every raw result row carries this value).
- **Tool versions**: Lighthouse `12.8.2` (via its own `desktop-config.js` preset, Section 3),
  `chrome-launcher` (pinned via `package-lock.json`), Chrome `152.0.7977.65` — recorded in
  `environment/baseline.json`.
- **Git commit**: `WORKING_TREE_UNFROZEN` — this multi-turn engagement has not committed at any
  point; see `docs/research/EXPERIMENT_FREEZE.md`. A real data-collection run must record the actual
  commit SHA in effect at that time, not assume it is still unfrozen.

## 12. UI Safety

`app/performance/page.tsx` previously displayed values labelled "First Contentful Paint (FCP)" and
"Time to Interactive (TTI)" that were in fact derived from FIGM's own static-analysis scan
duration, via an arbitrary linear formula with no connection to real browser timing. Stage 3
relabelled this page: the scan-latency figure is now shown under "Static Analysis Timing," and a
separate, explicit "Runtime FCP/TTI Experiment: Not Yet Collected" panel states this protocol's
status honestly, linking here.

## 13. Known Limitations / Explicitly Out of Scope

- **Angular RQ1 runtime fixture**: not required for this experiment (Section 1) — a deliberate,
  researcher-confirmed scope decision, not an unresolved gap. Angular remains PRIMARY for FIGM's
  overall guideline development, static-analysis validation, and real-repository evaluation.
- **Statistical hypothesis testing**: descriptive statistics only (Section 10); no significance
  test is implemented or claimed.
- **This protocol has not yet been used to collect real RQ1 data.** `REAL_RQ1_RUNS_COLLECTED: 0`.
  All Lighthouse runs executed while building and validating this infrastructure (Stage 3 and Stage
  3A) are labelled `isSmokeTest: true` and are excluded from any RQ1 analysis by construction.
- **Warm-up count is fixed at 1** for the frozen minimum protocol (Section 4/7); a future pass may
  justify a different count with evidence (e.g. observed first-run variance), but this document
  does not do so unilaterally.
