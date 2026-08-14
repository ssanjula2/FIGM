# Real-World Benchmark — Summary Report

Executed 2026-08-14. See `METHODOLOGY.md` for full procedure and `SPOT_CHECK.md` for the manually
verified sample. **This is the real-world benchmark, distinct from the controlled
`benchmarks/testbed/` benchmark — see METHODOLOGY.md section 1 before reading any number below.**

## Corpus

| Repo | Framework | Commit | Files | LOC | Scan time |
|---|---|---|---|---|---|
| [bradtraversy/react-crash-2021](https://github.com/bradtraversy/react-crash-2021) | React | `a644cded` | 10 | 340 | 1128 ms |
| [vercel/nextjs-portfolio-starter](https://github.com/vercel/nextjs-portfolio-starter) | Next.js | `90cfee0f` | 5 | 128 | 365 ms |
| [johnpapa/angular-tour-of-heroes](https://github.com/johnpapa/angular-tour-of-heroes) | Angular | `c6596771` | 21 | 609 | 634 ms |
| [vuejs/vue-hackernews-2.0](https://github.com/vuejs/vue-hackernews-2.0) | Vue | `98399b55` | 23 | 1396 | 692 ms |
| [bradtraversy/vanillawebprojects](https://github.com/bradtraversy/vanillawebprojects) | Generic JS | `adc66a18` | 21 | 2259 | 472 ms |
| **Total** | | | **80** | **4732** | **3291 ms** |

Full 40-character commit hashes are in `run-real-world-benchmark.ts`'s `REPOS` array and in each
repo's raw JSON (`raw-results/<name>.json` → `commit` field).

## Raw findings (UNVERIFIED tool output — see caveat)

**268 raw FIGM findings across 80 files.** These are NOT confirmed defects. No independent ground
truth exists for this corpus. Read as "268 times the tool's pattern-matching fired," not as "268
real bugs." See SPOT_CHECK.md for the only findings in this benchmark with a human judgment
attached.

| Rule | Count | Rule | Count |
|---|---|---|---|
| FIGM-REACT-03 | 153 | FIGM-A11Y-05 | 4 |
| FIGM-PERF-03 | 69 | FIGM-PERF-02 | 2 |
| FIGM-REACT-01 | 18 | FIGM-REACT-02 | 1 |
| FIGM-PERF-05 | 6 | FIGM-PERF-01 | 1 |
| FIGM-ANG-02 | 5 | | |
| FIGM-ANG-01 | 5 | | |
| FIGM-PERF-04 | 4 | | |

By severity (as labeled by FIGM's own static severity assignment, not an independent judgment):
CRITICAL 231, HIGH 27, MEDIUM 10, LOW 0.

**One rule, FIGM-REACT-03, accounts for 57% (153/268) of every finding in this entire corpus**, and
87% of those (133/153) are concentrated in a single repository (`vanillawebprojects`). Every one of
the 4 FIGM-REACT-03 findings manually spot-checked in this run (one per repo where it fired,
including a repo outside `vanillawebprojects`) was a **confirmed false positive** — see finding #3,
#5, #8, #15 in `SPOT_CHECK.md`. This is the single most actionable result of this benchmark: it is
a quantified, file/line-cited, reproducible signal that FIGM-REACT-03's detector needs real
state-binding analysis (it currently matches any `identifier.property = value` assignment shape
regardless of whether the target is React state at all — already disclosed as a documented
`knownLimitation` in `src/matrix/four-layer-meta-model.ts`; this benchmark is the first empirical
confirmation that limitation produces real false positives on unrelated real-world code, not just a
theoretical caveat).

Frameworks FIGM's own auto-detection assigned across the corpus: GENERIC_ESTREE 59 files,
ANGULAR_TEMPLATE 7, VUE_SFC 8, REACT_JSX 4, NEXT_JS 2 (some repositories contain config/build files
that legitimately parse as generic JS rather than the repo's primary framework — this is expected,
not an error).

## Parser failures / unsupported syntax

- **0 files** with `SourceParser` parse errors, across all 80 files, all 5 repos, all 5 frameworks.
- **0 synchronous engine crashes** (`RuleExecutionEngine.analyzeFile` throwing) across all 80 files.
- **1 asynchronous engine crash** discovered — an unhandled promise rejection from
  `DynamicProfiler`'s in-process code-execution harness, traced to
  `nextjs-portfolio-starter/scripts/gen-rss.js:7`. Full root-cause writeup in METHODOLOGY.md
  section 6. Not a "parser failure" in the traditional sense (the file parsed fine — this is a
  runtime execution bug in a different subsystem, the dynamic profiler), disclosed here for
  completeness and because it is the most severe issue this benchmark surfaced.
- **A second, pre-existing bug this one exposed and which WAS fixed**: `src/cli/figm-analyze.ts`'s
  module-level auto-execution guard matched on the substring `"figm-model"` anywhere in the running
  process's entry-script path — true for every script/test in this repository, since the project
  itself lives in a directory named `figm-model`. This meant merely *importing* the CLI's functions
  (as `tests/cli-analyzer.test.ts` does) silently triggered a full, unrequested 393-file scan of
  the entire project on every such run, which is what actually reached the cloned `gen-rss.js` and
  crashed an unrelated, previously-green test. Fixed to check the entry script's exact basename
  instead. See METHODOLOGY.md section 6b.

## Manual spot-check results (the only verified numbers in this document)

18 findings manually verified against real source (not randomly sampled — see SPOT_CHECK.md):
- **7 clean true positives**, **6 "true positive per the rule's own narrow definition" (predicate
  satisfied, but low practical relevance or a name/remediation mismatch — e.g. `useMemo` advice on
  a file with no React)**, **5 confirmed false positives**.
- Bounded precision on this specific 18-item sample: **13/18 (72%)** counting narrow-TPs as
  correct, **7/18 (39%)** counting only clean TPs as correct. Neither number should be quoted as
  "FIGM's real-world precision" — the sample is small and was not randomly drawn.
- Two concrete, reproducible false-positive classes identified with file/line citations:
  FIGM-REACT-03 (matches any property assignment, not just React state) and FIGM-REACT-01 (matches
  the method name `sort`/`filter`/`reduce` without checking the receiver is actually an array — the
  clearest instance being `Vue.filter(...)`, Vue's global-filter-registration API, misidentified as
  an unmemoized array `.filter()` call).

No Recall or F1 is reported for the real-world benchmark: computing recall requires knowing the
total number of real defects that exist in the corpus, which nobody has exhaustively enumerated
(unlike the controlled `benchmarks/testbed/` corpus, where the fixture files were authored with a
known, exhaustive violation list). Reporting a recall figure here would mean estimating the
denominator, which this task's instructions explicitly rule out ("do not turn 'tool found X issues'
into 'X issues are correct' without verification" — the same principle applies to inventing a
"total defects that exist" figure with no basis).

## What this benchmark does and does not establish

**Does establish:**
- FIGM's CLI-equivalent scan path runs successfully, without parser errors or synchronous crashes,
  across 80 real files spanning React, Next.js, Angular, Vue, and generic JS, from 5 independent,
  unrelated public repositories.
- Scan performance is fast in absolute terms (under 1.2 seconds per repository, well under 1ms/LOC
  on average) on real-world code, not just the synthetic testbed.
- At least two specific detection rules (FIGM-REACT-03, and to a lesser extent FIGM-REACT-01) have
  real, reproducible, non-trivial false-positive behavior on real code outside their intended
  context, at a rate high enough (4/4 and 1/3 respectively in the spot-checked sample) to be a
  genuine product concern, not statistical noise.
- One real, previously-unknown async-crash bug in `DynamicProfiler`, with an exact file/line
  reproduction.

**Does not establish:**
- FIGM's overall real-world precision or recall (no exhaustive ground truth exists for this corpus,
  and the spot-check sample is neither random nor large enough to extrapolate from).
- That FIGM-REACT-03's false-positive rate generalizes beyond this specific corpus (it might be
  worse or better on TypeScript-heavy or more idiomatic-React codebases — untested here).
- Anything about FIGM's performance/scalability on large (>1000 file) codebases — the largest single
  repository scanned here was 23 files.
