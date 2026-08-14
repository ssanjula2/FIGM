# Real-World Benchmark — Methodology

Date executed: 2026-08-14. Executed by an AI agent (Claude) acting as this session's research
engineer, with full outbound network access verified before any repository was selected (see
"Network access verification" below) — nothing in this benchmark is simulated or fabricated.

## 1. Controlled benchmark vs. real-world benchmark — read this first

FIGM already has a **controlled benchmark**, unrelated to this document:

- `benchmarks/testbed/` — four hand-written fixture files (`ReactBenchmark.jsx`,
  `VueBenchmark.vue`, `AngularBenchmark.component.ts`, `VanillaJSBenchmark.js`), each deliberately
  constructed to contain a known set of violations at known line numbers.
- `benchmarks/ground-truth.json` — the pre-registered list of those 19 expected violations.
- `benchmarks/adversarial-real-world/` — despite the directory name, these are also hand-written
  synthetic fixture files (not cloned repositories), designed to be adversarial edge cases.
- Precision/Recall/F1 computed from this controlled testbed (`npm run eval`) are meaningful because
  the ground truth was authored *before* the tool ran and is exhaustive for those specific files.

**This document describes a different, new thing: a real-world benchmark.** Five genuine, public,
third-party GitHub repositories — code FIGM's authors did not write and did not design around the
tool's rules — were cloned at pinned commits and scanned with the same engine. Nothing about this
corpus was constructed to exercise FIGM's rules; it is simply real code that happens to use
React, Next.js, Angular, or Vue.

**The critical difference: the real-world benchmark has no exhaustive ground truth.** Nobody has
enumerated every real accessibility/performance defect in these five repositories. What this
benchmark provides is:
1. Real, reproducible **raw tool output** (`raw-results/*.json`) — counts, locations, timings.
2. A small, **manually verified sample** of that raw output (`SPOT_CHECK.md`) — the only part of
   this benchmark with an actual human judgment attached to it, and therefore the only part where a
   TP/FP/precision statement is defensible.

**Precision/Recall/F1 are NOT computed for the real-world benchmark as a whole**, per the explicit
instruction this task was executed under: only compute those metrics where valid independent
ground truth exists. The 268 raw findings in `raw-results/` are not ground truth and must never be
read as "268 confirmed defects." A bounded, sample-only precision figure is reported in
`SPOT_CHECK.md` for exactly the 18 hand-verified findings, with explicit caveats about sample size
and sampling method.

## 2. Network access verification (performed before any repo selection)

```
curl -s -o /dev/null -w "%{http_code}" https://github.com          -> 200
curl -s -o /dev/null -w "%{http_code}" https://api.github.com      -> 200
curl -s https://api.github.com/rate_limit                          -> 60 req/hr unauthenticated, 57 remaining
git clone --depth 1 https://github.com/octocat/Hello-World.git     -> succeeded, real file checked out
```
Network access was genuinely available. Had it not been, this document would say
`NOT VERIFIED / ENVIRONMENT LIMITATION` and stop, per this task's explicit instruction, rather than
fabricate repository results.

## 3. Repository selection

Five repositories, one per framework FIGM claims to support (React, Next.js, Angular, Vue, generic
JavaScript/TypeScript), chosen for being **small enough to scan and manually verify within this
session**, genuinely public, and not tooling/demo repos authored by this project. Existence, default
branch, size, and archive status were checked via the GitHub API *before* cloning (not assumed):

| Repo | Framework | Why chosen |
|---|---|---|
| [`bradtraversy/react-crash-2021`](https://github.com/bradtraversy/react-crash-2021) | React | Small, popular (~1.9k★ at time of writing), real hooks-based CRUD app with forms, lists, API calls -- realistic bait for A11Y/PERF rules. |
| [`vercel/nextjs-portfolio-starter`](https://github.com/vercel/nextjs-portfolio-starter) | Next.js | Official Vercel starter template, small App/Pages Router mix, includes a real Node build script (`scripts/gen-rss.js`). |
| [`johnpapa/angular-tour-of-heroes`](https://github.com/johnpapa/angular-tour-of-heroes) | Angular | The canonical Angular "Tour of Heroes" tutorial source, widely referenced, real components/services/RxJS usage. |
| [`vuejs/vue-hackernews-2.0`](https://github.com/vuejs/vue-hackernews-2.0) | Vue | Official `vuejs` org demo app (SSR Hacker News clone) -- real Vuex/vue-router/SFC usage. |
| [`bradtraversy/vanillawebprojects`](https://github.com/bradtraversy/vanillawebprojects) | Generic JS/TS | A collection of ~21 independent small vanilla-JS projects (canvas games, DOM manipulation, fetch-based apps) -- the best available proxy for "framework-independent JavaScript" in the wild. |

This is 5 repositories, at the low end of the requested 5-10 range. Given the manual-spot-check
requirement (each finding read and judged by a human/AI reviewer against real source, not
automated), 5 repositories already produced 268 raw findings across 80 files -- more than could be
exhaustively hand-verified in this session. Breadth was deliberately traded for the depth needed to
make the spot-check in SPOT_CHECK.md meaningful rather than a rubber stamp.

## 4. Exact procedure (fully scripted, see `run-real-world-benchmark.ts`)

For each repository:
1. `git clone <url> <dest>` (full clone, not shallow -- needed to `git checkout` an exact commit).
2. `git checkout <pinned commit>`.
3. `git rev-parse HEAD` is compared against the pinned commit; **the script throws and refuses to
   scan if they don't match** -- there is no silent fallback to "whatever HEAD happens to be."
4. Every `.js`/`.ts`/`.jsx`/`.tsx`/`.vue`/`.svelte` file is collected (identical extension list and
   default ignore-directory list -- `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage` --
   to `src/cli/figm-analyze.ts`, the production CLI).
5. Each file is scanned via `RuleExecutionEngine.analyzeFile(relativePath, code)` -- **the exact
   same function the production CLI (`npm run analyze`) and the web app's live scan feature call.**
   This benchmark does not reimplement or approximate detection logic.
6. LOC is `code.split('\n').length` per file (raw line count, not a comment-stripped SLOC figure --
   stated explicitly so the number isn't over-interpreted).
7. Scan duration is wall-clock `performance.now()` around the per-repo file loop, in-process (no
   subprocess spawn overhead per file).
8. `SYNTAX-PARSE-ERROR` and `TYPE-TS-*` diagnostics are excluded from "FIGM findings" and
   "findings by rule" (they are parser/type-checker signals, not rule violations) but their counts
   are still recorded as `parserFailures`.

## 5. What "parser failures" and "unsupported syntax" mean here, precisely

FIGM's engine does not expose a single distinct "unsupported syntax" flag. Two real signals exist
and are both reported, rather than inventing a third metric that doesn't correspond to anything the
tool actually tracks:

- **`parserFailures`** = files where `SourceParser.parseSource()` returned one or more entries in
  `parseErrors` (recoverable parse diagnostics, surfaced to the user as `SYNTAX-PARSE-ERROR`
  findings). **Result: 0 across all 80 files in all 5 repositories.**
- **`engineCrashes`** = files where `RuleExecutionEngine.analyzeFile()` threw an exception
  synchronously (caught by this script's per-file try/catch). **Result: 0 across all 80 files.**

A third, more serious class was discovered that neither of the above metrics captures: an
**asynchronous** engine crash. See section 6.

## 6. A real engine bug discovered by this benchmark (not fixed in this pass -- see below)

`RuleExecutionEngine.analyzeFile` calls `DynamicProfiler.profileExecution(code)`
(`src/engine/dynamic-profiler.ts`), which -- despite being commented "Sandboxed execution evaluation
harness" -- actually **executes the scanned source code in-process** via `new Function(...)`, with
`require` stubbed to return `{}` for every module name, and auto-appends a call to any top-level
function it detects by regex if the function isn't already invoked in the file.

`nextjs-portfolio-starter/scripts/gen-rss.js` (a real file in this benchmark's corpus) is:
```js
const RSS = require('rss')
async function generate() {
  const feed = new RSS({ ... })   // line 7
  ...
}
generate()                        // line 42, already present in the source
```
Inside the harness, `require('rss')` resolves to `{}` (the stub), so `new RSS(...)` throws
`TypeError: RSS is not a constructor`. Because `generate` is an `async function`, that throw does
not propagate as a synchronous exception -- it becomes a **rejected Promise**. Nothing in
`dynamic-profiler.ts` or `rule-execution-engine.ts` awaits or attaches a `.catch()` to that
promise, so it surfaces later as a process-level `unhandledRejection`, disconnected in time from
the file that caused it (observed firing only *after* every repository in this run had already
finished scanning and its results had already been written to disk -- confirmed no result data was
lost). `run-real-world-benchmark.ts` registers `process.on('unhandledRejection', ...)` purely to
keep the benchmark process alive and to record that this happened; it does not fix the underlying
issue. **Automated attribution of which repo was "current" when the crash fires is unreliable** (it
recorded `vanillawebprojects`, the last repo scanned, not the true source) -- the real cause was
found only by manually grepping all 5 repos' source for `RSS` and reading `gen-rss.js` directly.
This is disclosed explicitly rather than trusted, per this benchmark's own no-fabrication standard.

**Why this was not fixed as part of this task:** the brief for this session was to design and
execute a benchmark, not to modify the detection/profiling engine. Fixing `DynamicProfiler` to
either truly sandbox execution (e.g. Node's `vm` module with a timeout) or, more simply, stop
executing scanned code at all (the "profiling" it produces is already a heuristic
line/loop/allocation-count formula layered on top of the eval result -- see the `baseTime`/
`baseMemory` calculation in `dynamic-profiler.ts`, which barely uses the eval'd execution's timing
at all) is a real, actionable follow-up for a future session, flagged here rather than silently
patched or silently ignored.

### 6b. A second, more severe bug this first one led to -- fixed, because it broke the test suite

Verifying section 6's finding (running `npm test` after the benchmark) surfaced a second, worse bug
that this benchmark's own artifacts triggered: `tests/cli-analyzer.test.ts` started failing with
the identical `TypeError: RSS is not a constructor`, even though that test only scans
`samples/sample-spa` (4 files, no "RSS" anywhere in them or in the test itself -- verified by
`grep -rni rss samples/sample-spa`).

Root cause, found by reproducing with a standalone script that captured the full stack trace
(node:test truncates it): `src/cli/figm-analyze.ts` ends with a module-level "direct execution"
guard:
```js
if (process.argv[1] && (process.argv[1].includes('figm-analyze') || process.argv[1].includes('figm-model'))) {
  const exitCode = runCLI(process.argv.slice(2));
  ...
}
```
`process.argv[1].includes('figm-model')` matches *any* process whose entry script path contains
the substring `"figm-model"` -- which is true for literally every script or test run from inside
this repository, since the project directory itself is named `figm-model`. This means **merely
importing `runCLI`/`parseCLIArgs` from this module** (exactly what `tests/cli-analyzer.test.ts`
does) **silently triggers a full, unrequested recursive scan of the entire project root** --
confirmed directly: the reproduction script's log shows `Scanned Files: 393`, covering the whole
repository including `node_modules`-excluded but otherwise everything, `benchmarks/real-world/
.repo-clones/` included. That unrequested scan is what actually reached
`nextjs-portfolio-starter/scripts/gen-rss.js` and triggered the section 6 crash -- `gen-rss.js` was
never scanned by the benchmark's own intentional per-repo scan crashing; it was scanned a *second,
accidental* time by this unrelated side effect, and that second scan is what a completely unrelated
test (`cli-analyzer.test.ts`) happened to observe.

This was a **pre-existing bug**, not introduced by this benchmark -- it was already silently
wasting a full-project scan on every test/script invocation in this repository before today. It
simply had no *visible* effect until a file matching the specific "stubbed require used as a
constructor inside an async function" shape existed somewhere under the project root, which the
benchmark's cloned fixtures happened to introduce.

**This one WAS fixed**, unlike section 6's underlying `DynamicProfiler` issue, because it broke a
pre-existing, previously-green test (`tests/cli-analyzer.test.ts`) and this task's own instructions
require running the full test suite and committing only once it passes -- leaving a broken test
suite behind was not an option. The fix (`src/cli/figm-analyze.ts`): replace the substring-anywhere
check with an exact entry-script basename check (`figm-analyze.ts` / `figm-analyze.js`), so only
genuinely executing this file directly (`npm run analyze`, or the `bin/figm-analyze.js` wrapper)
triggers auto-execution. Verified: `tests/cli-analyzer.test.ts` now passes in ~1.2s (previously hung
for ~18s before failing). Full test suite re-run to confirm no other regression (see commit for the
final count).

## 7. Manual spot-check methodology

18 findings were selected from the 268 raw findings: at least one per repository, at least one per
distinct rule ID that fired, plus several chosen specifically because the raw diagnostic's
`message` text looked inconsistent with its `offendingCodeSnippet` field (a fast, cheap heuristic
for surfacing likely false positives without reading all 268 by hand). For each, the actual source
file was read at and around the reported line in the pinned commit (not the JSON output alone), and
a TP/FP/"TP (narrow)" judgment was recorded with the specific reasoning. Full results, including
two concrete reproducible false-positive classes discovered this way, are in `SPOT_CHECK.md`.

This is explicitly **not** a random or statistically representative sample -- see SPOT_CHECK.md's
own caveat. It is sized and shaped to answer one question honestly: "when this tool fires on real
code it wasn't designed around, is the result usually right?" -- not to produce a citable accuracy
percentage for the whole tool.

## 8. Reproducing this benchmark

```bash
# From the repository root:
node --import tsx benchmarks/real-world/run-real-world-benchmark.ts
```
Requires outbound network access to github.com. Clones into
`benchmarks/real-world/.repo-clones/` (git-ignored, never committed -- see `.gitignore`). Each
repository is checked out at the exact commit hash recorded in `REPOS` inside
`run-real-world-benchmark.ts`; the script refuses to scan if the checked-out HEAD doesn't match.
Override the clone location with `FIGM_BENCHMARK_CLONE_DIR=<path>` if needed. Output is written to
`benchmarks/real-world/raw-results/<repo-name>.json` (per-repo, full diagnostic detail) and
`benchmarks/real-world/raw-results/_combined-summary.json` (cross-repo aggregate).

To verify the pinned commits are still reachable and match what's recorded here without re-scanning:
```bash
git ls-remote https://github.com/bradtraversy/react-crash-2021.git HEAD
# compare against REPOS[0].pinnedCommit in run-real-world-benchmark.ts (a644cded...) --
# note the remote's current HEAD may have moved on; the script checks out the pinned SHA
# regardless of what the remote's default branch currently points to.
```

## 9. Known limitations of this benchmark, stated directly

- 5 repositories, 80 files, 4,732 LOC total -- a small corpus. Findings here characterize FIGM's
  behavior on this specific, small, non-random sample of real code, not a general real-world
  precision/recall figure.
- All 5 repositories are tutorials/starters/demos, not large production codebases -- chosen for
  tractable manual verification, not for representativeness. A production monorepo would likely
  surface different (probably more numerous, possibly differently-distributed) findings.
- The manual spot-check (18/268 findings, 6.7%) is intentionally diverse rather than random, and is
  explicitly not sized or sampled for a statistically valid precision estimate.
- `DynamicProfiler`'s execution-timing/memory figures per file are not reported in this benchmark's
  summary at all (only FIGM rule findings, LOC, and scan duration are), because the profiler's
  in-process code-execution behavior documented in section 6 makes its own output for
  `executionTimeMs`/`peakMemoryMb` untrustworthy as a real measurement for arbitrary real-world
  code (it can throw, and even when it doesn't, `baseTime`/`baseMemory` are dominated by a static
  formula over line/loop/allocation counts, not genuine execution profiling).
