# FIGM Stage 3 — RQ1 FCP/TTI Experiment Protocol Report

**Date:** 2026-09-03

## Purpose

Design and build a defensible, reproducible runtime measurement protocol and infrastructure for
RQ1 (*"How do different SPA render and state-management strategies influence performance metrics
such as First Contentful Paint (FCP) and Time to Interactive (TTI)?"*). This stage builds the
protocol and infrastructure only — it does not collect real RQ1 data. No detector/rule logic was
modified.

## 1. Inspection performed before building anything

Read: `docs/research/FINAL_RESEARCH_CONTRACT.md` (Section 6 — RQ1 confirmed to require real
FCP/TTI, no infrastructure existed), `docs/research/EXPERIMENT_FREEZE.md` (RQ1 row: "DOES NOT
EXIST"), `docs/dissertation/chapter1_introduction.md` and `chapter6_conclusion.md` (RQ1 marked
`EXPERIMENT_PENDING` per Stage 2), `app/performance/page.tsx` (found the exact fabrication: FCP/TTI
labels bound to a linear formula over FIGM's own scan-duration, e.g.
`0.5 + (avgDurationMs / 50)` — confirmed via source read, not assumed), `package.json` (no
Playwright/Puppeteer/Lighthouse/web-vitals dependency present; no browser-automation
infrastructure existed at all). Searched the repository for `DynamicProfiler` — found and
confirmed unrelated: it is FIGM's own in-process rule-execution helper (real code, not simulated),
not a browser performance tool, and is untouched by this stage.

**Conclusion before implementing anything**: zero real FCP/TTI measurement capability existed
anywhere in this repository. Everything in this report was built new this stage.

## 2. Tooling decision (investigated, not guessed)

- **chrome-launcher + lighthouse** (both added as devDependencies) were chosen over
  Playwright/Puppeteer because Lighthouse's own `interactive` audit is the most directly
  defensible, versioned, real implementation of the historical TTI algorithm — using it also gives
  FCP from the exact same trace/tool/run, rather than mixing two different measurement mechanisms.
- **Investigated whether Lighthouse still exposes TTI** before assuming it does: confirmed
  empirically (not from documentation alone) that the installed `lighthouse@12.8.2` still ships a
  real `interactive` audit, requestable via `onlyAudits`, even though it is no longer in the
  default *displayed* performance-category set in Lighthouse 10+. Verified via
  `research/rq1-experiment/scripts/_smoke-lighthouse.mjs` against `https://example.com` (FCP
  828ms, TTI 839ms) before writing the protocol document.
- **Chrome availability**: confirmed a real, launchable Google Chrome exists at
  `C:\Program Files\Google\Chrome\Application\chrome.exe` (version 152.0.7977.65) and that
  `chrome-launcher` can spawn it headlessly in this sandboxed environment
  (`_smoke-chrome-launch.mjs`).

## 3. A real, non-trivial engineering problem found and fixed mid-stage

Calling `lighthouse()` directly from `run-experiment.ts` under `node --import tsx` reliably threw
`ReferenceError: __name is not defined` **inside the Chrome page context itself**
(`__failedInBrowser: true`). Root-caused via a minimal isolated reproduction (not guessed): tsx's
process-wide CommonJS loader hook affects how Node compiles every required module — including
Lighthouse's own plain-`.js` internals — which corrupts a literal function-source string Lighthouse
extracts via `.toString()` and injects into the browser page for in-page evaluation (used for
Lighthouse's CPU-benchmark calibration). **Fix**: `research/rq1-experiment/scripts/lighthouse-worker.mjs`,
a deliberately plain-JavaScript (never tsx-transformed) subprocess that owns the entire
Chrome-launch → Lighthouse-run → result-extraction lifecycle in isolation, invoked from
`run-experiment.ts` via `execFile`. Re-verified working end-to-end after this fix (Section 8 below).

A second, smaller bug was found and fixed the same way (caught by testing, not assumed correct):
the server-process kill on Windows used `child.kill()`, which only signals the immediate shell
process spawned with `{ shell: true }`, not the actual `next start` Node process underneath it —
this reliably leaked a listening server that blocked the next run with `EADDRINUSE`. Fixed with an
awaited `taskkill /T /F` process-tree kill; verified the port is released cleanly after a run
(`netstat` checked empty post-run).

A third issue — Next.js's automatic static optimization silently turning the intended SSR
condition into Static Generation, since it has no per-request data — was caught at the build-output
stage (before it ever reached measurement) and fixed with `export const dynamic = 'force-dynamic'`
on both SSR fixture pages; confirmed via the build log's `ƒ` (dynamic) vs `○` (static) markers.

## 4. Protocol document

`docs/research/RQ1_EXPERIMENT_PROTOCOL.md` — full independent variables (rendering: CSR/SSR;
state-management: LOCAL/GLOBAL), conditions matrix, control-variable table, repetition policy, FCP
and TTI measurement mechanism (with evidence), fixture equivalence documentation, runner/schema/
analysis pipeline description, versioning, UI-safety fix description, and explicitly-scoped
limitations. See that document for the full rationale — not duplicated here.

## 5. Fixtures built

Four real Next.js/React fixture routes (`app/rq1-experiment/{csr-local,csr-global,ssr-local,ssr-global}/page.tsx`)
plus shared, deterministic content/components (`app/rq1-experiment/_shared/`). Verified, not
assumed: the SSR route's raw served HTML contains the fixture item text (`curl` returned 100
occurrences of "RQ1 Fixture Item"); the CSR route's raw served HTML contains zero occurrences
(content appears only after client-side hydration) — this is the concrete, empirical proof the
CSR/SSR distinction is real, not just a label.

**Angular is explicitly NOT_IMPLEMENTED_THIS_STAGE** (`protocol.json`'s
`frameworksNotYetImplemented`) — a defensible Angular CSR/SSR fixture needs its own CLI-scaffolded
project and Angular Universal setup, disproportionate to force into this pass; recorded as a named,
disclosed gap rather than faked or silently dropped, per this task's own instruction not to force a
framework into a rendering mode it does not naturally support.

`middleware.ts` and `app/AppShell.tsx` were each given one small, precedented addition (matching
the existing `/about`-style bare/public-route pattern) so the fixture routes are reachable by an
unauthenticated Lighthouse process with no dashboard chrome around them — necessary so the measured
page is exactly the fixture, not an auth redirect or the production app shell.

## 6. Runner, schema, and analysis pipeline

- `research/rq1-experiment/scripts/schema.ts` — `RawResultRow` type + `isValidRawResultRow()`,
  enforcing that a successful run carries real finite positive `fcpMs`/`ttiMs` and a failed run
  carries `null`/`null` plus a real error string — `0` is rejected in both directions, so it can
  never stand in for "measurement unavailable."
- `research/rq1-experiment/scripts/extract-metrics.ts` — pure, tested FCP/TTI extraction logic
  (the documented specification; the runtime path uses `lighthouse-worker.mjs`'s plain-JS twin —
  Section 3).
- `research/rq1-experiment/scripts/run-experiment.ts` — the automated runner (Section 8 of the
  protocol document).
- `research/rq1-experiment/scripts/analyze-results.ts` — descriptive-statistics pipeline
  (mean/median/SD/min/max per condition), with an explicit smoke-test exclusion guard and a
  significance caveat that never overclaims from a small sample.

## 7. UI safety

`app/performance/page.tsx` rewritten: the fabricated FCP/TTI/LCP formulas and their card labels
were removed entirely. The scan-duration figure is now labelled "Static Analysis Timing," with an
explicit statement that it is not a browser Web Vital. A separate panel states "Runtime FCP/TTI
Experiment: Not Yet Collected," links to the protocol, and states `0` real RQ1 runs collected —
matching this stage's actual status, not implying otherwise.

## 8. Smoke testing (SMOKE_TEST / ENGINEERING_VALIDATION — not RQ1 data)

10 real Lighthouse/Chrome runs were executed through the actual runner during infrastructure
validation, all written to `research/rq1-experiment/raw-results/smoke-test/` with
`isSmokeTest: true`: 4 honest `FAILED` rows (captured while diagnosing the `__name` bug in Section
3 — real evidence the failure-recording path works under a genuine failure, not just a simulated
one) and 6 `OK` rows (captured after the fix, e.g. `CSR_LOCAL` FCP≈1555–1603ms/TTI≈2013–2070ms,
`SSR_LOCAL` FCP≈1541ms/TTI≈1869–1875ms). The analysis pipeline was run against this directory with
`--include-smoke` to confirm it computes correct statistics end-to-end (verified by hand against
the raw numbers), then the resulting `summary.json`/`summary.md` were deleted from
`processed-results/` so nothing in the delivered directory tree could be mistaken for real RQ1
data — `processed-results/` now contains only a `.gitkeep.md` explaining why it is empty.
**None of these 10 runs are included in, or referenced by, any RQ1 result — `REAL_RQ1_RUNS_COLLECTED: 0`.**

## 9. Verification

**Targeted tests** (`tests/rq1-experiment-schema.test.ts`, `tests/rq1-experiment-metrics-extraction.test.ts`,
`tests/rq1-experiment-analysis.test.ts`, `tests/rq1-experiment-protocol-config.test.ts`,
`tests/rq1-performance-page-no-fabrication.test.ts` — 61 tests covering result-schema validation,
the no-fabrication/no-placeholder invariants, condition metadata, FCP/TTI extraction (including a
regression guard against silently substituting LCP/TBT/INP for TTI), repeat-count configuration,
analysis arithmetic against hand-computed values, failure recording, fixture-content determinism,
and the `app/performance/page.tsx` no-fabrication regression):

```
tests 61
pass 61
fail 0
```

**Full suite** (`npm test`):

```
tests 1344
suites 91
pass 1344
fail 0
cancelled 0
skipped 0
todo 0
```

**Build** (`npm run build`): PASS — completed cleanly after fixing a real TypeScript type error this
stage introduced (`chrome.kill()` does not return a value `.catch()`-chainable per its type
definitions) and confirming the SSR fixture routes compile as dynamic (`ƒ`), not static (`○`).

No existing test was weakened, skipped, or modified to force a pass.

## Final status block

```
RQ1_PROTOCOL:
CREATED

RENDERING_CONDITIONS:
CSR, SSR (Next.js/React only this stage; both real, verified via raw-HTML content-presence check)

STATE_MANAGEMENT_CONDITIONS:
LOCAL (per-item useState), GLOBAL (shared React Context) -- both real, both implemented for
both rendering conditions

FCP_MEASUREMENT:
Lighthouse 12.8.2, `first-contentful-paint` audit, numericValue field, milliseconds. Verified
against a real external URL and this project's own real fixture routes before being written into
the protocol.

TTI_MEASUREMENT:
Lighthouse 12.8.2, `interactive` audit (Lighthouse's own historical TTI algorithm, requested
explicitly via onlyAudits since Lighthouse 10+ no longer displays it by default), numericValue
field, milliseconds. Same tool/run as FCP. Verified, not assumed -- confirmed present and
returning real numeric output before the protocol asserted it works this way.

REPETITIONS:
10 minimum per condition (protocol.json default; --repetitions 20 available for a fuller pass).
Warm-up-run exclusion (1) is declared in protocol.json but NOT YET enforced by run-experiment.ts's
loop -- disclosed limitation, not silently assumed active.

CONTROLLED_ENVIRONMENT:
Windows 11 Home Single Language 10.0.26200; Intel i5-11400H (6c/12t); 15.7GB RAM; Chrome
152.0.7977.65 headless (--headless=new --no-sandbox --disable-gpu); Node v22.14.0; production
build only (next build && next start, never next dev); cold cache/navigation; desktop viewport,
screenEmulation disabled; Lighthouse throttlingMethod 'simulate'. Full record:
research/rq1-experiment/environment/baseline.json. Network/CPU throttling profile explicitly left
as an open experimental-factor decision, not picked unilaterally.

EXPERIMENT_FIXTURES:
app/rq1-experiment/csr-local/page.tsx
app/rq1-experiment/csr-global/page.tsx
app/rq1-experiment/ssr-local/page.tsx
app/rq1-experiment/ssr-global/page.tsx
app/rq1-experiment/_shared/{generate-items.ts,GlobalStore.tsx,ItemCardLocal.tsx,ItemCardGlobal.tsx}
Angular fixtures: NOT_IMPLEMENTED_THIS_STAGE (disclosed gap, see protocol.json and
RQ1_EXPERIMENT_PROTOCOL.md Section 13)

RUNNER:
research/rq1-experiment/scripts/run-experiment.ts (orchestration) +
research/rq1-experiment/scripts/lighthouse-worker.mjs (isolated plain-JS measurement subprocess,
required by the tsx/Lighthouse incompatibility found and fixed this stage -- Section 3)

RAW_RESULT_SCHEMA:
research/rq1-experiment/scripts/schema.ts (RawResultRow, isValidRawResultRow) -- directly tested,
tests/rq1-experiment-schema.test.ts (19 tests)

ANALYSIS_PIPELINE:
research/rq1-experiment/scripts/analyze-results.ts -- directly tested,
tests/rq1-experiment-analysis.test.ts (13 tests), verified end-to-end against real smoke-test data

SMOKE_TESTS:
10 real Lighthouse/Chrome runs (6 OK, 4 FAILED -- the FAILED rows are genuine evidence from
diagnosing the __name bug, not synthetic). All labelled isSmokeTest:true, stored under
raw-results/smoke-test/, excluded from analysis by default. Clearly labelled
NON_RESEARCH_DATA / SMOKE_TEST / ENGINEERING_VALIDATION throughout the protocol document, the
README, and the schema itself.

REAL_RQ1_RUNS_COLLECTED:
0

RQ1_RESULT_STATUS:
EXPERIMENT_PENDING

TESTS:
1344/1344 pass (0 fail, 0 cancelled, 0 skipped) -- full suite via `npm test`. 61/61 pass on the
new RQ1-specific targeted subset run first.

BUILD:
PASS -- `npm run build` completed cleanly; SSR fixture routes confirmed dynamic (not statically
optimized) in the build output.

EXPERIMENT_FREEZE_READY:
NO

NEXT_ACTION:
Production/browser acceptance and remaining pre-freeze technical validation. Specifically, before
a real RQ1 data-collection run: (1) decide the network/CPU throttling profile
(RQ1_EXPERIMENT_PROTOCOL.md Section 3's open item), (2) implement warm-up-run exclusion in
run-experiment.ts's loop, (3) decide whether an Angular fixture is required before RQ1 can be
considered answered or whether a React/Next.js-only result is acceptable dissertation scope.
```
