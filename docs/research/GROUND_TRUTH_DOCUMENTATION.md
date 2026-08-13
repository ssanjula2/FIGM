# FIGM Benchmark — Ground Truth Documentation

**Purpose**: This document is the authoritative, human-readable record of every labeled violation
in FIGM's automated ground-truth benchmark, as required before independent annotation can be
designed against it (see `research/independent-annotation/`).

**Source of truth**:
- Fixtures: `benchmarks/testbed/*` (4 files — the only fixtures wired into the automated
  evaluation pipeline, `src/eval/evaluation-runner.ts`; `benchmarks/adversarial-real-world/*`
  exists on disk but is not read by any evaluation script and is out of scope here).
- Labels: `benchmarks/ground-truth.json` (19 hand-authored violation records).
- Detection status: re-verified live against the current engine (`src/engine/rule-execution-engine.ts`,
  which as of the Stage A AST migration uses genuine TypeScript-compiler AST analysis for
  FIGM-REACT-02 on React/Next.js files — not relevant to this benchmark, since no ground-truth
  item here is FIGM-REACT-02) on 2026-08-13, by running `RuleExecutionEngine.analyzeFile()`
  directly against each fixture and checking, per ground-truth record, whether a diagnostic with
  the same `ruleId` was returned for that file.

**Dependency note**: per this task's own instruction, this document and the independent-annotation
package must be regenerated/re-verified if detection behavior changes again (e.g. a future Stage
B/C/D AST migration, or any change to `benchmarks/ground-truth.json` or `benchmarks/testbed/*`).
Regenerate via `npm run research:generate-annotation-package` after any such change.

---

## Ground truth table (19 violations, 4 fixtures, 4 frameworks, 8 distinct rules)

| # | Fixture | Framework | Rule | Severity | Expected violation (description) | Expected detection (current engine) |
|---|---|---|---|---|---|---|
| 1 | ReactBenchmark.jsx | REACT_JSX | FIGM-PERF-04 | MEDIUM | Static import `HeavyAnalytics` used inside conditional function (line 2) | ✅ Detected (TP) |
| 2 | ReactBenchmark.jsx | REACT_JSX | FIGM-PERF-03 | CRITICAL | `window.addEventListener('scroll', ...)` missing removal teardown (line 9) | ✅ Detected (TP) |
| 3 | ReactBenchmark.jsx | REACT_JSX | FIGM-PERF-02 | HIGH | Un-dimensioned `<img>` bound to `user.avatar` (line 22) | ✅ Detected (TP) |
| 4 | ReactBenchmark.jsx | REACT_JSX | FIGM-A11Y-01 | CRITICAL | `<div onClick>` without `onKeyDown`/tabindex (line 25) | ✅ Detected (TP) |
| 5 | ReactBenchmark.jsx | REACT_JSX | FIGM-A11Y-02 | HIGH | `<CustomDropdown>` missing ARIA role and `aria-label` (line 30) | ✅ Detected (TP) |
| 6 | ReactBenchmark.jsx | REACT_JSX | FIGM-A11Y-03 | HIGH | `status` banner div missing `aria-live` announcer (line 33) | ✅ Detected (TP) |
| 7 | ReactBenchmark.jsx | REACT_JSX | FIGM-PERF-01 | HIGH | Invariant object `itemConfig` allocated inside `.map()` render loop (line 39) | ✅ Detected (TP) |
| 8 | ReactBenchmark.jsx | REACT_JSX | FIGM-A11Y-04 | CRITICAL | `<Modal>` overlay without focus restoration (line 44) | ✅ Detected (TP) |
| 9 | VueBenchmark.vue | VUE_SFC | FIGM-PERF-02 | HIGH | Un-dimensioned `<img :src="userAvatar">` (line 4) | ✅ Detected (TP) |
| 10 | VueBenchmark.vue | VUE_SFC | FIGM-A11Y-01 | CRITICAL | `<span v-on:click>` without keydown/tabindex (line 7) | ✅ Detected (TP) |
| 11 | VueBenchmark.vue | VUE_SFC | FIGM-PERF-01 | HIGH | Invariant style object allocated inside `v-for` loop (line 11) | ❌ **Not detected (FN)** |
| 12 | VueBenchmark.vue | VUE_SFC | FIGM-A11Y-03 | HIGH | `status` div missing `aria-live` (line 15) | ✅ Detected (TP) |
| 13 | VueBenchmark.vue | VUE_SFC | FIGM-PERF-03 | CRITICAL | `window.addEventListener('resize', ...)` in `mounted()` missing teardown (line 29) | ✅ Detected (TP) |
| 14 | AngularBenchmark.component.ts | ANGULAR_TEMPLATE | FIGM-PERF-02 | HIGH | Un-dimensioned `<img [src]="avatarUrl">` (line 7) | ✅ Detected (TP) |
| 15 | AngularBenchmark.component.ts | ANGULAR_TEMPLATE | FIGM-A11Y-01 | CRITICAL | `<div (click)>` without keydown/tabindex (line 10) | ✅ Detected (TP) |
| 16 | AngularBenchmark.component.ts | ANGULAR_TEMPLATE | FIGM-A11Y-03 | HIGH | `status` div missing `aria-live` (line 15) | ✅ Detected (TP) |
| 17 | AngularBenchmark.component.ts | ANGULAR_TEMPLATE | FIGM-PERF-03 | CRITICAL | `window.addEventListener('scroll', ...)` in `ngOnInit()` missing teardown (line 26) | ✅ Detected (TP) |
| 18 | VanillaJSBenchmark.js | GENERIC_ESTREE | FIGM-PERF-04 | MEDIUM | Static import `ChartEngine` used inside conditional function (line 2) | ✅ Detected (TP) |
| 19 | VanillaJSBenchmark.js | GENERIC_ESTREE | FIGM-PERF-03 | CRITICAL | `window.addEventListener('orientationchange', ...)` missing teardown (line 6) | ✅ Detected (TP) |

**Current detection totals**: 18 TP, 1 FN, matching `benchmarks/eval-summary.json`'s
`overall: {truePositives: 18, falsePositives: 3, falseNegatives: 1}` (the 3 FP are diagnostics the
engine raises that are *not* in this ground-truth table at all — genuinely extra findings, not
represented here since this table documents only the 19 labeled ground-truth items, not the
engine's full output).

## Rule frequency in this benchmark

| Rule ID | Occurrences | Severity |
|---|---|---|
| FIGM-PERF-01 | 2 | HIGH |
| FIGM-PERF-02 | 3 | HIGH |
| FIGM-PERF-03 | 4 | CRITICAL |
| FIGM-PERF-04 | 2 | MEDIUM |
| FIGM-A11Y-01 | 3 | CRITICAL |
| FIGM-A11Y-02 | 1 | HIGH |
| FIGM-A11Y-03 | 3 | HIGH |
| FIGM-A11Y-04 | 1 | CRITICAL |

**Line-number data-quality note**: `benchmarks/ground-truth.json`'s `expectedLine` field is
inconsistent across fixtures — for `ReactBenchmark.jsx`, `VueBenchmark.vue`, and 3 of 4
`AngularBenchmark.component.ts` entries it points at the actual violating code line, but for the
first 3 `AngularBenchmark.component.ts` entries (FIGM-PERF-02, FIGM-A11Y-01, FIGM-A11Y-03) it
points at the standalone `<!-- Defect: ... -->` comment line immediately above the code instead
(discovered while building `research/independent-annotation/internal/blinded-ground-truth.json`,
whose `blindedLine` is `null` for those 3 items as a direct consequence). This has **no effect on
real evaluation correctness** — `src/eval/evaluation-runner.ts` matches ground truth to
detections by `(filePath, ruleId)` only, never by line number — but it is a real, pre-existing
authoring inconsistency in the ground-truth file, noted here rather than silently corrected, since
fixing it is outside this task's scope.

**Coverage note**: this benchmark exercises only 8 of FIGM's 25 rules. The remaining 17 rules
(FIGM-PERF-05/06, FIGM-A11Y-05/06, FIGM-NEXT-01..04, FIGM-REACT-01..04, FIGM-ANG-01..05) have no
ground-truth representation in `benchmarks/testbed/*` at all — a real, existing limitation of the
benchmark's scope, independent of and prior to the independent-annotation work below.
