# FIGM Stage 3A — RQ1 Protocol Gap Closure Report

**Date:** 2026-09-03

## Purpose

Close the three gaps `docs/audit/STAGE_3_RQ1_EXPERIMENT_PROTOCOL_REPORT.md` left open: (1)
finalize the RQ1 runtime framework scope per the researcher's confirmed decision (React/Next.js
only; Angular stays PRIMARY for FIGM overall but is not required for this experiment), (2) finalize
a single, fixed, reproducible network/CPU throttling profile, (3) actually enforce warm-up-run
exclusion (previously declared in `protocol.json` but not implemented). No final RQ1 research data
was collected. No detector/rule logic was modified. No commit or tag was made.

## 1. Inspection performed before trusting the Stage 3 report

Read `docs/research/RQ1_EXPERIMENT_PROTOCOL.md`, `docs/research/EXPERIMENT_FREEZE.md`,
`docs/audit/STAGE_3_RQ1_EXPERIMENT_PROTOCOL_REPORT.md`, `research/rq1-experiment/protocol.json`,
`research/rq1-experiment/environment/baseline.json`,
`research/rq1-experiment/scripts/run-experiment.ts`,
`research/rq1-experiment/scripts/lighthouse-worker.mjs`,
`research/rq1-experiment/scripts/analyze-results.ts` in full — not assumed correct. This
confirmed the Stage 3 report's own disclosure that warm-up exclusion was declared but not
enforced, and additionally surfaced a defect Stage 3's report did **not** disclose (Section 2
below), found only by actually running the code and inspecting Lighthouse's real resolved
configuration rather than trusting the settings object as written.

## 2. A real, previously undetected configuration bug found and fixed

`lighthouse-worker.mjs` passed `formFactor: 'desktop'` and `screenEmulation: { disabled: true }`
as loose flags with no Lighthouse `config` object. Dumping the actual resolved
`lhr.configSettings` from a live run (`research/rq1-experiment/scripts/_smoke-configsettings.mjs`)
showed this **does not** cascade to desktop network/CPU throttling or a desktop user-agent in
Lighthouse — only the dedicated `lighthouse:desktop` / `desktop-config.js` preset does that. The
original configuration silently ran Lighthouse's **mobile** `mobileSlow4G` throttling (`rttMs: 150`,
`cpuSlowdownMultiplier: 4`) and a mobile Android/Chrome user-agent, despite every document and log
line claiming "desktop." This means **every FCP/TTI number collected during Stage 3, including its
own smoke-test evidence, was measured under an internally inconsistent, non-reproducible-as-
documented configuration.**

**Fix**: `lighthouse-worker.mjs` now passes Lighthouse's own `lighthouse/core/config/desktop-config.js`
preset directly as the `config` argument, rather than hand-assembled flags. Re-verified via the
same `configSettings` dump: real desktop throttling (`rttMs: 40`, `throughputKbps: 10240`,
`cpuSlowdownMultiplier: 1`), a real desktop viewport (`1350×940`, `mobile: false`), and the real
desktop Chrome/macOS user-agent are now what Lighthouse actually applies. A real re-measurement
against the project's own fixtures after the fix shows the expected direction of change (FCP
dropped from ~1500-2000ms under the old, incorrectly-mobile-throttled config to ~440-470ms under
the corrected desktop config — consistent with removing artificial mobile network/CPU throttling).
This is disclosed here, in the protocol document, and in `environment/baseline.json`, rather than
silently corrected without a record.

## 3. RQ1 runtime framework scope — finalized per researcher decision

Recorded in `research/rq1-experiment/protocol.json` (`rq1RuntimeFrameworkScope`,
`primaryFigmFrameworkScope`, `angularRq1RuntimeFixture`, and `frameworksNotYetImplemented[0].status`
changed from `NOT_IMPLEMENTED_THIS_STAGE` to `NOT_REQUIRED_FOR_THIS_EXPERIMENT` with the researcher's
rationale quoted in full) and in `docs/research/RQ1_EXPERIMENT_PROTOCOL.md`'s new Section 1. This
is recorded as a **decided scope limitation**, not a rephrased version of the same open gap: Stage
3's framing implied a fixture was merely deferred; this decision states one is not required for
RQ1's scope at all, while explicitly preserving Angular's PRIMARY status for FIGM's overall
guideline development, static-analysis validation, and real-repository evaluation — unaffected by
this RQ1-specific decision.

## 4. Network/CPU profile — finalized, one fixed profile, values resolved not assumed

See Section 2 above for the bug this also fixed. The final, single, fixed profile (used for every
condition, never switched) is recorded in three places, kept consistent:
`research/rq1-experiment/environment/baseline.json`, `research/rq1-experiment/protocol.json`
(`environment.throttling` etc.), and `docs/research/RQ1_EXPERIMENT_PROTOCOL.md` Section 3. Every
value was read directly from a live Lighthouse run's `lhr.configSettings`, not transcribed from
documentation or guessed:

| Field | Value |
|---|---|
| throttlingMethod | `simulate` |
| rttMs | 40 |
| throughputKbps | 10240 |
| requestLatencyMs | 0 (unset override) |
| downloadThroughputKbps | 0 (unset override) |
| uploadThroughputKbps | 0 (unset override) |
| cpuSlowdownMultiplier | 1 |
| screenEmulation | `{ mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }` |
| emulatedUserAgent | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ... Chrome/136.0.0.0 Safari/537.36` |

## 5. Warm-up run exclusion — now enforced, not just declared

`research/rq1-experiment/scripts/schema.ts`: added `isWarmup: boolean` to `RawResultRow`,
`isValidRawResultRow()` validation, and a `classifyRun()` pure function giving the single
precedence rule (`SMOKE_TEST` > `WARMUP` > `FINAL_MEASURED_RUN`) so the two independent booleans
(`isSmokeTest`, `isWarmup`) are never overloaded into one meaning.

`research/rq1-experiment/scripts/run-experiment.ts`: `protocol.json` renamed `repetitions` →
`measuredRuns`, added `warmupRuns`; the per-condition loop now executes Phase 1 (warm-up,
`warmupRuns` real executions, `isWarmup: true`) fully before Phase 2 (measured, `measuredRuns` real
executions, `isWarmup: false`) — both phases use the identical `executeOneRun()` path, so a
warm-up failure is recorded exactly as honestly as a measured failure (never silently promoted to
measured, never silently discarded). CLI flags renamed `--repetitions` → `--measured-runs`, added
`--warmup-runs`.

`research/rq1-experiment/scripts/analyze-results.ts`: `filterRealRows` renamed and extended to
`filterMeasuredRows(rows, { includeSmoke, includeWarmup })` (independent switches); added
`computeExecutionBreakdown()` (total/smoke/warmup/measured/valid/failed counts — nothing silently
dropped) and `compareByDimension()` (CSR vs SSR, LOCAL vs GLOBAL, per Section 8 of this task).
`summary.md`/`summary.json` now report the full execution breakdown and both cross-condition
comparisons alongside the four individual conditions.

**Verified for real, not just by unit test**: a live smoke run
(`--smoke --warmup-runs 1 --measured-runs 2 --conditions CSR_LOCAL,SSR_GLOBAL`) executed exactly 1
warm-up + 2 measured per condition (6 total executions), including one genuine transient failure
(a `chrome-launcher` WebSocket connection error) recorded honestly rather than crashing the run.
Analyzing that data (`--include-smoke`) produced an execution breakdown (`6 total, 6 smoke, 2
warm-up, 4 measured, 3 valid, 1 failed`) that is internally consistent with the per-condition
table — confirmed by hand, not merely by a passing assertion.

## 6. Tests

Added/adjusted (all in the existing RQ1 test files, extending rather than replacing prior
coverage): `classifyRun` precedence tests; `isWarmup` schema-validation tests (missing field
rejected, same no-fabrication guarantees as `isSmokeTest`); `filterMeasuredRows`'s independent
`includeSmoke`/`includeWarmup` switches; `computeExecutionBreakdown` correctness including the
exact "1 warm-up + 10 measured × 4 conditions = 44 total, 4 warm-up, 40 measured" scenario from
this task's Section 7; `compareByDimension` arithmetic for both CSR-vs-SSR and LOCAL-vs-GLOBAL;
`protocol.json`'s Angular-scope fields, primary-FIGM-scope preservation, and non-empty throttling
profile with all six required fields; renamed CLI-flag tests (`--measured-runs`, `--warmup-runs`).
The existing no-fabrication regression test for `app/performance/page.tsx` was re-run unchanged and
still passes (that file was not touched this stage).

**Targeted tests**: 79/79 pass (`tests/rq1-experiment-schema.test.ts`,
`tests/rq1-experiment-metrics-extraction.test.ts`, `tests/rq1-experiment-analysis.test.ts`,
`tests/rq1-experiment-protocol-config.test.ts`, `tests/rq1-performance-page-no-fabrication.test.ts`).

**Full suite** (`npm test`): 1362/1362 pass, 0 fail, 0 cancelled, 0 skipped.

**Build** (`npm run build`): PASS, clean.

No existing test was weakened.

## 7. Smoke-test data hygiene

Stage 3's smoke-test raw-result files predate the `isWarmup` field and are correctly rejected by
the updated schema validator (`loadRawResults` throws on a malformed/incompatible file rather than
silently skipping it — this is the validator working as designed, not a new defect). Those stale
files were deleted from `research/rq1-experiment/raw-results/smoke-test/`; the six files remaining
there are all from this stage's real, schema-valid smoke run. `processed-results/` was returned to
empty (`.gitkeep.md` explains why) after using it to verify the analysis pipeline end-to-end —
consistent with Stage 3's own established practice of not leaving demonstration output where it
could be mistaken for real RQ1 data.

## Final status block

```
RQ1_RUNTIME_FRAMEWORK_SCOPE:
React/Next.js controlled experiment (CSR/SSR x LOCAL/GLOBAL, all within Next.js's App Router).
Angular remains PRIMARY for FIGM's overall guideline development, static-analysis validation, and
real-repository evaluation -- unaffected by this RQ1-specific scope decision.

ANGULAR_RUNTIME_FIXTURE_REQUIRED:
NO

THROTTLING_METHOD:
simulate (Lighthouse's real desktop-config.js preset, not a hand-assembled flag set -- see Section
2's bug-fix for why this distinction matters)

NETWORK_PROFILE:
rttMs: 40, throughputKbps: 10240, requestLatencyMs: 0 (unset), downloadThroughputKbps: 0 (unset),
uploadThroughputKbps: 0 (unset) -- Lighthouse's real "desktopDense4G" simulated profile, read from
a live run's lhr.configSettings

CPU_PROFILE:
cpuSlowdownMultiplier: 1 (no artificial CPU slowdown -- the desktop preset's real value; Stage 3's
original, undisclosed configuration had silently applied 4x mobile CPU slowdown instead)

WARMUP_RUNS_PER_CONDITION:
1

MEASURED_RUNS_PER_CONDITION:
10

CONDITIONS:
4

EXPECTED_WARMUP_EXECUTIONS:
4

EXPECTED_MEASURED_EXECUTIONS:
40

EXPECTED_TOTAL_EXECUTIONS:
44

WARMUP_EXCLUSION:
VERIFIED -- enforced in run-experiment.ts's two-phase loop, excluded by default in
analyze-results.ts's filterMeasuredRows/computeExecutionBreakdown, confirmed both by unit tests
(hand-computed 44-execution scenario) and a real live smoke run (1 warmup + 2 measured per
condition executed and correctly categorized).

ANALYSIS_EXCLUSION_GUARDS:
VERIFIED -- isSmokeTest and isWarmup are independent, default-excluded switches; FAILED rows are
excluded from valid-metric statistics but always counted in the execution-breakdown audit trail
(never silently dropped); confirmed by unit tests and a real smoke run with a genuine failure.

REAL_RQ1_RUNS_COLLECTED:
0

RQ1_INFRASTRUCTURE_READY:
YES

TESTS:
1362/1362 pass (0 fail, 0 cancelled, 0 skipped) -- full suite via `npm test`. 79/79 pass on the
RQ1-specific targeted subset run first.

BUILD:
PASS -- `npm run build` completed cleanly.

EXPERIMENT_FREEZE_READY:
NO

NEXT_ACTION:
Production/browser acceptance validation. Separately (not blocking freeze-readiness on its own):
execute the frozen 44-execution real data-collection pass
(`node --import tsx research/rq1-experiment/scripts/run-experiment.ts --measured-runs 10
--warmup-runs 1`) once the researcher confirms this is the intended moment to collect real RQ1
data, and expand the real-world repository corpus from 15 toward the confirmed 20-30 target.
```
