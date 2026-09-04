# Stage 9 — RQ1 Real FCP/TTI Experiment (research-freeze-v5)

Scope: collect a real, 44-run RQ1 FCP/TTI dataset (React CSR / Next.js SSR × LOCAL/GLOBAL state,
1 warm-up + 10 measured per condition) against the exact `research-freeze-v5` baseline, using the
existing frozen Stage 3/3A experiment infrastructure unmodified. No participant data, no RQ4
expert data, and no source-baseline change were introduced this stage.

REAL RQ1 EXPERIMENT — all numbers below are real Lighthouse measurements, never fabricated,
manually typed, or copied from DevTools.

---

## 1. RQ1 contract (re-confirmed, unchanged from the frozen protocol)

RQ1: *How do different SPA render and state-management strategies influence performance metrics
such as First Contentful Paint (FCP) and Time to Interactive (TTI)?*

This controlled experiment: **React/Next.js only** (`research/rq1-experiment/protocol.json`'s
`rq1RuntimeFrameworkScope`), per the Stage 3A researcher-confirmed scope decision. Angular remains
a primary FIGM framework for guideline development/static analysis, but has no RQ1 runtime fixture
and none was added this stage.

Four conditions (unchanged): `CSR_LOCAL`, `CSR_GLOBAL`, `SSR_LOCAL`, `SSR_GLOBAL`. No condition was
added, removed, or substituted.

## 2. Fixed Lighthouse profile (unchanged, read from the frozen protocol/environment files)

Lighthouse `12.8.2`, `first-contentful-paint` (FCP) and `interactive` (TTI) audits only, desktop
form factor via Lighthouse's own `desktop-config.js` preset, `throttlingMethod: simulate`
(`rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`), viewport `1350×940`. 1 warm-up
+ 10 measured per condition = 44 total. All confirmed identical to
`research/rq1-experiment/protocol.json` / `environment/baseline.json` — nothing was changed.

## 3. Pre-run environment audit

```
git rev-parse HEAD (before checkout)   -> 613a88d5e6b6b6a6b93f8ceb1dda1b9cf6e5542e
git rev-list -n 1 research-freeze-v5   -> 0d287d6d8408c319bae839811d1ac52c0cd71f3f
```

**Mismatch found and disclosed**: HEAD was one commit ahead of `research-freeze-v5`. Verified via
`git diff --stat research-freeze-v5 HEAD` that the only difference was a single docs file
(`docs/audit/STAGE_8A_RESEARCH_DATASET_BASELINE_SAFETY_REPORT.md`, the Stage 8B deployment/
acceptance follow-up commit) — zero source files differed. For strict compliance with "HEAD ==
freeze-v5 or stop and disclose," `git checkout research-freeze-v5` was run, producing a detached
HEAD at the exact frozen commit for the remainder of this stage:

```
git rev-parse HEAD (after checkout)    -> 0d287d6d8408c319bae839811d1ac52c0cd71f3f   [MATCH]
git status --short                     -> 12 pre-existing, unrelated, already-uncommitted files
                                           (benchmark timestamp residue, dissertation chapter text,
                                           docs/evidence, docs/reports, docs/migration-report.json,
                                           public/eval-results, research/independent-annotation/
                                           results/STATUS.md) -- none touch app/, src/, or
                                           research/rq1-experiment/; present since before this
                                           session began; left untouched throughout
Node version                           -> v22.14.0
Lighthouse version                     -> 12.8.2
Chrome version                         -> 152.0.7977.65
OS                                     -> Microsoft Windows 11 Home Single Language 10.0.26200
Machine model                          -> MSI Katana GF66 11SC (Micro-Star International Co., Ltd.)
CPU                                    -> 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz
RAM                                    -> 15.71 GB
Battery/AC state                       -> Win32_Battery: BatteryStatus=2 (AC/charging or full),
                                           EstimatedChargeRemaining=100%
Active ports before run                -> none listening on 3000/3001/4173/4174
Experiment timestamp                   -> 2026-09-03T19:23-19:33Z (see run-manifest.json per-row
                                           timestamps for exact per-run values)
```

All values match `research/rq1-experiment/environment/baseline.json` (the frozen Stage 3A
control-variable snapshot) exactly: same CPU, same RAM, same Chrome build, same Node, same
Lighthouse, same throttling/viewport profile.

## 4. Controlled apps / fixtures (Stage 3/3A, located and mapped — none substituted)

| Condition | Directory | Route | Framework | Render | State |
|---|---|---|---|---|---|
| A. `CSR_LOCAL` | `app/rq1-experiment/csr-local/page.tsx` | `/rq1-experiment/csr-local` | Next.js/React | CSR | LOCAL |
| B. `CSR_GLOBAL` | `app/rq1-experiment/csr-global/page.tsx` | `/rq1-experiment/csr-global` | Next.js/React | CSR | GLOBAL |
| C. `SSR_LOCAL` | `app/rq1-experiment/ssr-local/page.tsx` | `/rq1-experiment/ssr-local` | Next.js/React | SSR | LOCAL |
| D. `SSR_GLOBAL` | `app/rq1-experiment/ssr-global/page.tsx` | `/rq1-experiment/ssr-global` | Next.js/React | SSR | GLOBAL |

Shared fixture content: `app/rq1-experiment/_shared/` (`generate-items.ts`, `GlobalStore.tsx`,
`ItemCardLocal.tsx`, `ItemCardGlobal.tsx`) — 50 deterministic items, identical text/DOM
structure/interaction workload (one increment button per item) across all four conditions, per
`docs/research/RQ1_EXPERIMENT_PROTOCOL.md` Section 7. Start command: `npx next start -p <port>`
(the runner's own `startServer()`). No fixture was substituted; no new fixture was created.

## 5. Equivalence check

- Same 50-item dataset/workload in every condition (fixed, deterministic — no `Math.random`/`Date`).
- Same functional UI task (one increment button per item).
- Same asset/content shape; only the two independent variables differ.
- `middleware.ts` explicitly excludes every `/rq1-experiment*` route from the authenticated-by-
  default matcher (`path.startsWith('/rq1-experiment')`) — **no condition has an authentication
  requirement the others don't**.
- Pre-flight `curl` of all four routes plus the `/rq1-experiment` index (Section 6) returned HTTP
  200 with no `Application error` text and no dev overlay for every one; all four shared the same
  page `<title>` (inherited root layout metadata) — no accidental per-condition debug content.
- Nothing was tuned after seeing results; this check ran before any measured run.

## 6. Build and serve in measurement mode

```
rm -rf .next
npm run build                     -> exit 0, clean (no errors)
```

Pre-flight verification server (deterministic port, killed before the real run):
```
npx next start -p 4174
curl http://localhost:4174/rq1-experiment            -> 200
curl http://localhost:4174/rq1-experiment/csr-local   -> 200
curl http://localhost:4174/rq1-experiment/csr-global  -> 200
curl http://localhost:4174/rq1-experiment/ssr-local   -> 200
curl http://localhost:4174/rq1-experiment/ssr-global  -> 200
```
Server on port 4174 killed (real listening PID, not the shell wrapper PID — matches
`run-experiment.ts`'s own documented Windows `taskkill /T /F` reasoning) before the real run began.

## 7–10. Automated runner, run order, warm-up, measured runs

Used the existing runner **unmodified**:
```
node --import tsx research/rq1-experiment/scripts/run-experiment.ts --port 4173
```
Sequential run order (the frozen protocol/runner define no randomization; preserved exactly, not
invented): `CSR_LOCAL` (1 warm-up, then 10 measured) → `CSR_GLOBAL` → `SSR_LOCAL` → `SSR_GLOBAL`.

Result: **44/44 real browser executions succeeded, 0 failures.** Every value came directly from
the runner's real Lighthouse/Chrome output — never typed manually, never copied from DevTools.

```
REACT_CSR_LOCAL_MEASURED:  10
REACT_CSR_GLOBAL_MEASURED: 10
NEXT_SSR_LOCAL_MEASURED:   10
NEXT_SSR_GLOBAL_MEASURED:  10
TOTAL_MEASURED:            40
WARMUP_RUNS:                4  (isWarmup: true, preserved, excluded from analysis by the frozen
                                 pipeline's default, never deleted)
FAILED_RUNS:                0
```

## 11. Raw evidence preservation

New timestamped evidence directory (never overwriting the existing `research-freeze-v1`-tagged
44-file dataset already present in `raw-results/`, which was left completely untouched — file
count and every hash unchanged):

```
research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/
  raw/                        44 raw Lighthouse JSON result files (copies of the runner's own
                               output; originals also remain in raw-results/ alongside the v1 set)
  run-manifest.json           machine-readable manifest: per-file conditionId/isWarmup/runNumber/
                               status/SHA-256, per-condition counts, duplicate-ID check result
  metrics.csv                 one row per run: condition, framework, render/state strategy, run #,
                               warmup flag, FCP, TTI, versions, timestamp, SHA-256
  environment-manifest.json   full control-variable record for this exact collection
  command-log.md              exact commands run, in order
  summary.json / summary.md   output of the frozen analyze-results.ts, run against ONLY this
                               evidence set's 44 files
  fcp-comparison-chart.svg    condition-level FCP bar chart (mean ± SD)
  tti-comparison-chart.svg    condition-level TTI bar chart (mean ± SD)
```

`research/rq1-experiment/processed-results/summary.json`/`summary.md` (the shared, canonical
output location the frozen `analyze-results.ts` always writes to) were backed up before running
the pipeline against the new data, then restored byte-for-byte afterward — confirmed via SHA-256
match before/after — so the existing `research-freeze-v1` provenance record in
`processed-results/PROVENANCE.md` remains accurate and untouched.

No file under `research/rq1-experiment/scripts/`, `app/rq1-experiment/`, or `protocol.json` was
modified.

## 12. Raw data validation

Every one of the 44 new rows validated against the frozen `schema.ts`'s `isValidRawResultRow()`
(imported read-only, never edited):

```
Total run records:        44   (matches expected)
Warm-up:                    4   (matches expected)
Measured:                  40   (matches expected)
Measured per condition:    10 / 10 / 10 / 10 (CSR_LOCAL / CSR_GLOBAL / SSR_LOCAL / SSR_GLOBAL)
Duplicate run IDs:          0
FCP source:                 first-contentful-paint audit only (schema-enforced)
TTI source:                 interactive audit only (schema-enforced)
Numeric values:             all 44 rows numeric/finite/positive (0 FAILED rows)
Raw JSON exists for every successful record: YES (44/44)
```

Dataset is complete — proceeding to descriptive analysis.

## 13–14. Descriptive analysis and factor comparisons (real, programmatically computed)

Computed entirely by the frozen `analyze-results.ts` (mean/median/SD/min/max; no manual
calculation, no premature rounding of source data):

### Per-condition (measured, valid only)

| Condition | n | FCP mean | FCP median | FCP SD | FCP min | FCP max | TTI mean | TTI median | TTI SD | TTI min | TTI max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CSR_LOCAL  | 10 | 439.9 | 439.1 | 2.5 | 437.2 | 445.4 | 464.5 | 463.1 | 4.4 | 459.2 | 472.4 |
| CSR_GLOBAL | 10 | 441.6 | 437.6 | 9.4 | 435.8 | 462.6 | 464.0 | 460.0 | 9.0 | 457.8 | 484.6 |
| SSR_LOCAL  | 10 | 438.8 | 439.1 | 1.3 | 436.6 | 440.4 | 463.3 | 462.5 | 4.4 | 459.6 | 474.4 |
| SSR_GLOBAL | 10 | 438.8 | 438.2 | 2.1 | 437.0 | 443.9 | 464.5 | 463.4 | 4.8 | 459.2 | 476.1 |

(All values milliseconds.)

### Rendering comparison — React CSR vs Next.js SSR (pooling both state variants, n=20 each)

| Group | FCP mean | FCP SD | TTI mean | TTI SD |
|---|---|---|---|---|
| CSR | 440.7 | 6.7 | 464.2 | 6.9 |
| SSR | 438.8 | 1.7 | 463.9 | 4.5 |

### State-management comparison — LOCAL vs GLOBAL (pooling both rendering variants, n=20 each)

| Group | FCP mean | FCP SD | TTI mean | TTI SD |
|---|---|---|---|---|
| LOCAL  | 439.3 | 2.0 | 463.9 | 4.3 |
| GLOBAL | 440.2 | 6.7 | 464.2 | 7.0 |

Full machine-readable output: `research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/summary.json`.

## 15. Statistical analysis

The frozen protocol was inspected before any inference was attempted
(`docs/research/RQ1_EXPERIMENT_PROTOCOL.md` Section 10, restated explicitly in Section 13: *"no
significance test is implemented or claimed"*; `analyze-results.ts`'s own `significanceCaveat()`
states the same). **No inferential test (t-test or otherwise) is defined anywhere in the frozen
methodology.**

Per this stage's explicit instruction not to select a test based on which one produces
significance, and not to fabricate a p-value: **descriptive results are available (Section 13-14
above); inferential statistics were not computed and would require a separate, explicitly
justified protocol addition before any significance claim could be made.**

## 16. Charts / tables

- `fcp-comparison-chart.svg`, `tti-comparison-chart.svg` — condition-level bar charts, mean ± SD,
  labelled "REAL RQ1 EXPERIMENT," generated directly from `summary.json`'s real numbers (see
  Section 11 for path). Condition-level tables: Section 13 above.
- Nothing here mixes controlled-benchmark data, real-world static-analysis data, GA4 data, or
  participant data — every number in this report traces to one of the 44 raw Lighthouse JSON files
  in this stage's evidence directory.

## 17. RQ1 interpretation (conservative, evidence-based)

- **Lowest mean FCP**: `SSR_LOCAL` and `SSR_GLOBAL` (both 438.8ms), essentially tied; **highest
  mean FCP**: `CSR_GLOBAL` (441.6ms), driven by a wider spread (SD 9.4ms, max 462.6ms) rather than
  a uniformly slower baseline (its median, 437.6ms, sits close to the other three conditions).
- **Lowest mean TTI**: `SSR_LOCAL` (463.3ms); the other three cluster within ~1.5ms of each other
  (464.0–464.5ms).
- **CSR vs SSR**: SSR shows a slightly lower mean FCP (438.8ms vs 440.7ms, ~1.9ms) and a
  substantially tighter spread (SD 1.7ms vs 6.7ms) — the difference in central tendency is small
  in absolute terms; the difference in *variability* is more pronounced, and appears concentrated
  in `CSR_GLOBAL` specifically rather than CSR generally.
- **LOCAL vs GLOBAL**: LOCAL shows a marginally lower mean FCP (439.3ms vs 440.2ms) and much lower
  SD (2.0ms vs 6.7ms) — again, GLOBAL's higher spread traces mostly to `CSR_GLOBAL`'s handful of
  slower runs (a 26.8ms range vs 3.4–7.3ms ranges elsewhere), not a uniform LOCAL/GLOBAL effect
  across both rendering strategies (`SSR_LOCAL` and `SSR_GLOBAL` have nearly identical, tight SDs).
- **Variability**: `CSR_GLOBAL` is the clear outlier in run-to-run consistency (FCP SD 9.4ms, TTI
  SD 9.0ms) versus every other condition (FCP SD 1.3–2.5ms). This is a real, observed pattern in
  this dataset — this report does not speculate on its cause beyond noting it.
- **Limitations**: single machine, single measurement session, simulated (not real-network)
  throttling, one specific 50-item synthetic fixture, React/Next.js only. These four conditions do
  not generalize to Angular, Vue, or any other framework/state-library, and this controlled-fixture
  result should not be read as a claim about real-world application performance in general.

## 18. Research integrity check

```
FABRICATED_RUNS: 0
MANUALLY_EDITED_METRICS: 0
WARMUPS_INCLUDED_IN_ANALYSIS: 0
GA4_USED_AS_RQ1_SOURCE: NO
STATIC_PERFORMANCE_FINDINGS_USED_AS_FCP_TTI: NO
PARTICIPANT_DATA_COLLECTED: 0
RQ4_EXPERT_DATA_COLLECTED: 0
```

## 19. Freeze v5 integrity

`research-freeze-v5` was not modified. This stage checked out the tag (detached HEAD) rather than
building on `main`'s later commit, ran only pre-existing, unmodified experiment tooling, and added
only new evidence files under `research/rq1-experiment/raw-results/` (a new timestamped
subdirectory) — no product source file was created, edited, or deleted. No blocker requiring a
source change was encountered; **no v6 freeze is required or was created.**

## 20. Final report

```
BASELINE_TAG: research-freeze-v5
BASELINE_COMMIT: 0d287d6d8408c319bae839811d1ac52c0cd71f3f

LIGHTHOUSE_VERSION: 12.8.2
CHROME_VERSION: 152.0.7977.65

TOTAL_EXPECTED_RUNS: 44
WARMUP_RUNS: 4
MEASURED_RUNS: 40
FAILED_RUNS: 0

REACT_CSR_LOCAL_MEASURED: 10
REACT_CSR_GLOBAL_MEASURED: 10
NEXT_SSR_LOCAL_MEASURED: 10
NEXT_SSR_GLOBAL_MEASURED: 10

FCP_SUMMARY:
  CSR_LOCAL:  mean 439.9ms, median 439.1ms, SD 2.5ms, min 437.2ms, max 445.4ms
  CSR_GLOBAL: mean 441.6ms, median 437.6ms, SD 9.4ms, min 435.8ms, max 462.6ms
  SSR_LOCAL:  mean 438.8ms, median 439.1ms, SD 1.3ms, min 436.6ms, max 440.4ms
  SSR_GLOBAL: mean 438.8ms, median 438.2ms, SD 2.1ms, min 437.0ms, max 443.9ms

TTI_SUMMARY:
  CSR_LOCAL:  mean 464.5ms, median 463.1ms, SD 4.4ms, min 459.2ms, max 472.4ms
  CSR_GLOBAL: mean 464.0ms, median 460.0ms, SD 9.0ms, min 457.8ms, max 484.6ms
  SSR_LOCAL:  mean 463.3ms, median 462.5ms, SD 4.4ms, min 459.6ms, max 474.4ms
  SSR_GLOBAL: mean 464.5ms, median 463.4ms, SD 4.8ms, min 459.2ms, max 476.1ms

RAW_EVIDENCE_PATH: research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/
RAW_EVIDENCE_COMPLETE: YES

FABRICATED_RUNS: 0
MANUALLY_EDITED_METRICS: 0

PARTICIPANT_DATA_COLLECTED: 0
RQ4_EXPERT_DATA_COLLECTED: 0

RQ1_COLLECTION_STATUS: PASS

READY_FOR_RQ4_STAGE: YES

NEXT_ACTION:
Preserve this evidence set and research-freeze-v5 unchanged. RQ4 (expert-validation) data
collection was NOT started this stage and requires a separate, explicit go-ahead.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
