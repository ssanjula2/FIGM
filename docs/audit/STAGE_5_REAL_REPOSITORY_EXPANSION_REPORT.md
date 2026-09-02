# FIGM Stage 5 — Real-World Repository Corpus Expansion Report

**Date:** 2026-09-03

## Purpose

Expand the real-world evaluation corpus from 15 to at least 20 repositories, per the Proposal's
authoritative repository-sample requirement (§4.3: 20-30 public open-source SPA repositories using
React, Next.js, Angular; Interim02 §3.4 is consistent), while preserving reproducibility and the
frozen evaluation methodology. No participant data or expert labels were collected. The real RQ1
44-execution experiment was not run. No detector/rule semantics were changed to improve results —
the one script fix made this stage (an entry-guard on `run-real-world-benchmark.ts`, detailed
below) is a script-execution-safety fix, not a change to any rule's detection logic, severity, or
parsing behavior. Nothing was committed or tagged.

## 1. Inspection performed before any change

Read `docs/research/FINAL_RESEARCH_CONTRACT.md` (§8: repository target confirmed 20-30, current
count 15), `docs/research/EXPERIMENT_FREEZE.md` (repository inclusion protocol row), and the full
`benchmarks/real-world/run-real-world-benchmark.ts` (the `REPOS` manifest and the scan pipeline),
`benchmarks/real-world/raw-results/` and `raw-results-archive/` (confirmed the archive convention:
dated, descriptively-named subdirectories, e.g. `2026-09-02-post-ang07-pre-template-fix/`), and
`benchmarks/real-world/METHODOLOGY.md` / `README.md` (the existing inclusion/exclusion protocol and
selection-criteria precedent from the original 5-repo pass and the 2026-08-25 10-repo expansion).

**Pre-expansion framework count (15 repos, confirmed by direct count of `REPOS` before any edit):**

| Framework | Count | Repos |
|---|---|---|
| React | 3 | react-crash-2021, react-redux-realworld-example-app, redux-essentials-example-app |
| Next.js | 3 | nextjs-portfolio-starter, next-learn, commerce |
| Angular | 3 | angular-tour-of-heroes, angular-realworld-example-app, reactive-angular-course |
| Vue (additional support) | 3 | vue-hackernews-2.0, vue-realworld-example-app, vitesse |
| Generic JS/TS (additional support) | 3 | vanillawebprojects, JavaScript30, javascript-algorithms |
| **Total** | **15** | |

Primary-framework (React/Next.js/Angular) subtotal: **9**.

## 2. Repository selection

6 new repositories were added, **all primary-framework** (2 React, 2 Next.js, 2 Angular) — no new
Vue or generic-JS repos, per the explicit instruction not to pad the corpus with non-primary
frameworks to reach the 20-repo target. Every candidate's existence was verified via
`git ls-remote <url> HEAD` and its size/license/archived-status via the GitHub REST API **before**
being added to `REPOS` — the same discipline used for the two prior expansion passes. Candidates
checked and rejected without being added (never fabricated): `angular/angular.io` (returns
`archived: true` via the API); `cal-com/cal.com`, `TeamHive/ngx-material-timepicker`,
`wardbell/AngularAirport`, `sinedied/angular-tetris`, `khalilstemmler/nodejs-domain-driven-design`,
and several other guessed Angular-app repository names, all `404 Not Found`. `vercel/ai-chatbot` was
found renamed to `vercel/chatbot` mid-selection (confirmed via the GitHub API's redirect) — the
current canonical URL is what's recorded.

| New repo | Framework | Pinned commit | License | Files | LOC | Inclusion rationale (short) |
|---|---|---|---|---|---|---|
| [`excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw) | React | `e1bb9ff8f8931e783c11d104abb8967ac6605c9a` | MIT | 664 | 197,600 | Large (131k+★), real production SPA, not a tutorial — addresses the corpus's tutorial-heavy bias for React. |
| [`alan2207/bulletproof-react`](https://github.com/alan2207/bulletproof-react) | React | `9506629ed003a561c6627735480cce4994244bb4` | MIT | 425 | 23,202 | Widely-referenced (35k+★) React architecture reference, distinct shape from existing CRUD/Redux entries. |
| [`vercel/chatbot`](https://github.com/vercel/chatbot) | Next.js | `c2f8235e1f3ea903ad8b7f61447c4f74164b5c58` | NOASSERTION | 154 | 21,054 | Official Vercel App Router template (20k+★), streaming-UI/AI-chat patterns distinct from existing Next.js entries. |
| [`nextjs/saas-starter`](https://github.com/nextjs/saas-starter) | Next.js | `6e33e58b1e553a41fe22e6b941a7229a002de361` | MIT | 41 | 3,637 | Official nextjs-org SaaS starter (16k+★), small production-shaped App Router app; lightweight counterbalance to commerce/next-learn. |
| [`akveo/ngx-admin`](https://github.com/akveo/ngx-admin) | Angular | `dc6a442704bfef34b776b5eb15faf852d9e2f75c` | MIT | 244 | 14,408 | Popular (25k+★) production-shaped Angular admin dashboard — addresses Angular representativeness gap. |
| [`coreui/coreui-free-angular-admin-template`](https://github.com/coreui/coreui-free-angular-admin-template) | Angular | `5f66f95b19edf4092fd2f95f5c5b34e185bba033` | MIT | 141 | 6,369 | Organization-maintained, independently-authored second Angular admin app (Bootstrap-based, distinct from ngx-admin's Nebular UI). |

Full per-repo reproducibility metadata (license, rationale, source dirs, exclusion paths, date
pinned) is in `benchmarks/real-world/raw-results/repository-manifest.json`, machine-generated by
the new `generate-corpus-summary.ts` from the `REPOS` manifest — not hand-typed a second time.

## 3. Reproducibility

Every new repo is pinned to a full 40-character commit SHA in
`benchmarks/real-world/run-real-world-benchmark.ts`'s `REPOS` array — never a floating branch. Date
pinned: **2026-09-03**. Source dirs: entire repository (no subdirectory restriction, same as every
existing entry). Exclusion paths: `node_modules, .git, dist, build, .next, coverage, .vercel` —
identical `IGNORE_DIRS` set used by every other repo and by the production CLI.

## 4. Preserve prior results

The pre-expansion 15-repository result set was copied to
`benchmarks/real-world/raw-results-archive/2026-09-03-pre-20-repo-expansion/` **before** the
expanded corpus was run — 15 per-repo JSON files + `_combined-summary.json`, byte-identical to what
was in `raw-results/` at that point. Nothing was overwritten without this snapshot existing first.

## 5. Run current engine only

All 21 repositories were scanned via the unmodified `RuleExecutionEngine.analyzeFile()` — the exact
same engine call the production CLI uses. No rule was tuned, disabled, or had its severity changed
between or during repository scans; parsing behavior was not changed mid-run (the one parser-related
finding below was investigated and documented, not fixed — see Section 7).

**A genuine script defect was found and fixed, but it required no corpus re-run** (see Section 7 for
full detail): `run-real-world-benchmark.ts` had no entry guard, so importing `REPOS` from
`generate-corpus-summary.ts` (a legitimate, read-only use) silently re-triggered a full 21-repo
clone-and-scan as an import side effect. This is a script-execution-safety bug, not a detector/rule
change, and the accidental second run produced **byte-identical** per-repo file/LOC/finding counts
to the first — confirming both that the fix was safe to apply without re-running the corpus, and
that the corpus's results are deterministic/reproducible across independent runs.

## 6. Parse / failure honesty

| Metric | Value |
|---|---|
| Total files discovered | 2,512 |
| Total files analyzed | 2,512 |
| Parse-error files | 117 (4.7%) |
| Analysis failures (synchronous engine crashes) | 0 |
| Async engine crashes (unhandledRejection/uncaughtException) | 0 |
| Unsupported-framework files | not separately tracked as a distinct metric — see METHODOLOGY.md §5 |
| Total findings (FIGM-* rules only) | 2,649 |
| Distinct rule IDs fired | 36 of 50 canonical rules |

No parse-error file is counted as clean: `filesScanned` includes every file with parse errors, and
`parserFailures.filesWithParseErrors <= filesScanned` is enforced as a regression test
(`tests/real-world-corpus-manifest.test.ts`). Framework classification per repo is recorded in each
`raw-results/<repo>.json`'s `frameworksDetected` field (unchanged mechanism from the original
benchmark).

## 7. Anomalies investigated

Three concrete anomalies were found and investigated; **none were fixed** — each is either a
pre-existing, already-disclosed limitation whose fix is out of scope for a corpus-expansion pass
(would require changing parser/detector logic mid-corpus-run, explicitly prohibited), or too small
in scale to warrant a corpus-invalidating stop-fix-rerun cycle.

### 7a. Parser spike (concentrated in the 4 new Next.js-family repos)

`vercel-chatbot` 47/154 files (30.5%) with parse errors, `nextjs-saas-starter` 12/41 (29.3%),
`commerce` 16/65 (24.6%), `next-learn` 20/131 (15.3%) — all well above the corpus's other 17 repos
(0-2%, except `excalidraw` 13/664 = 2.0% and `bulletproof-react` 6/425 = 1.4%). Root-caused via a
targeted re-scan bucketing parse-error messages: **100% of the spike is one message**, `Unexpected
token "{" in function parameter list`, fired on the near-universal Next.js App Router pattern of a
destructured function parameter with an inline TypeScript object type —
`function Layout({ children }: { children: React.ReactNode })` — confirmed at
`vercel-chatbot`'s `app/(auth)/layout.tsx:6:36` and equivalently across every affected repo. This is
not new to Stage 5: the pre-existing `javascript-algorithms` and `vue-hackernews-2.0` entries
already showed 2 and 1 instances of the identical message before this expansion. It concentrates in
the new Next.js repos because App Router conventions put this exact syntax shape on nearly every
`layout.tsx`/`page.tsx`. This is the same class of limitation already flagged as dissertation
Chapter 6 future work ("Compiler AST Driver Integration: replace lightweight scope parsers with
Babel/SWC pluggable drivers") — quantified and reproduced here, not fixed, consistent with this
stage's explicit prohibition on changing parsing behavior mid-run.

### 7b. A concrete "wrong framework" false-positive class

`FIGM-ANG-01` ("RxJS subscription created inside Angular component missing unsubscribe or
takeUntilDestroyed") fired twice in `excalidraw/excalidraw` — a pure-React codebase with zero
Angular content — on `packages/excalidraw/components/AppStateObserver.ts`, a plain TypeScript class
whose private method is named `subscribe()` and called as `this.subscribe({...})`. Direct
inspection of the source (reproduced in full in this session) confirms the rule matches on
syntactic shape alone (`this.<name>(...)` resembling an RxJS `.subscribe()` call) with no actual
Angular-framework evidence required — the same class of limitation already disclosed for
`FIGM-REACT-03` in the original benchmark (`SPOT_CHECK.md`). Documented as a reproducible
false-positive class (2/2,649 findings, 0.08% of this run); not fixed here for the same reason as
7a — this is an existing rule-hardening gap, not a new defect introduced by this pass.

### 7c. One genuine exact-duplicate finding (not systemic)

`excalidraw/App.tsx:11606:10` produced two identical `FIGM-REACT-01` diagnostics (same rule,
message, code snippet) for the same AST location — 1 of 2,649 findings (0.04%) corpus-wide. An
initial broader "duplicate" check (grouping only by rule+file, due to a script bug that looked for a
nonexistent `d.line` field instead of `d.location.start.line`) had falsely flagged 362 apparent
duplicate groups; correcting the key to `ruleId + filePath + location.start.line + column` reduced
this to the single genuine instance above. Not treated as corpus-invalidating given its scale.

### No other anomaly category applied

Zero-finding repositories: none (`vitesse` is lowest at 2 findings). Duplicate findings: covered in
7c. Rules firing in an obviously wrong framework beyond 7b: none found on inspection of the
rule/framework cross-tab in `raw-results/_combined-summary.json` (Next.js repos firing `FIGM-REACT-*`
rules is expected — Next.js is React-based; `bulletproof-react` firing `FIGM-NEXT-*` rules is
expected — it contains a real `apps/nextjs-app` subdirectory).

## 8. Framework balance

| Framework | Count | Repos |
|---|---|---|
| React | 5 | react-crash-2021, react-redux-realworld-example-app, redux-essentials-example-app, excalidraw, bulletproof-react |
| Next.js | 5 | nextjs-portfolio-starter, next-learn, commerce, vercel-chatbot, nextjs-saas-starter |
| Angular | 5 | angular-tour-of-heroes, angular-realworld-example-app, reactive-angular-course, ngx-admin, coreui-free-angular-admin-template |
| Vue (additional support, not counted toward primary target) | 3 | vue-hackernews-2.0, vue-realworld-example-app, vitesse |
| Generic JS/TS (additional support) | 3 | vanillawebprojects, JavaScript30, javascript-algorithms |
| **Total** | **21** | |

Primary-framework balance achieved naturally (5/5/5) — no artificial equal-balance was imposed;
this is simply the result of adding exactly 2 repos per primary framework, which the selection
criteria (Section 2) fixed before any repo was scanned.

## 9. Real-world metrics (raw, unverified tool output — see METHODOLOGY.md §1)

See Section 6 for files/parse-errors/crashes. Findings by domain (via `primaryResearchDomain()`,
not the raw 2-value `domain` field) and by severity below; full detail in
`benchmarks/real-world/raw-results/domain-summary.json` and `rule-frequency-summary.json`.

**Precision/Recall/F1 are NOT computed from this raw corpus** — that requires the separate RQ4
expert-ground-truth stage, not performed here.

## 10. Domain breakdown (via `primaryResearchDomain()`)

| Domain | Findings |
|---|---|
| ARCHITECTURE | 393 |
| STATIC_PERFORMANCE | 1,578 |
| ACCESSIBILITY | 678 |
| **Total** | **2,649** |

**Accessibility findings by WCAG 2.2 Success Criterion** (count of findings mapped to a criterion —
**not** a conformance rate, which is never claimed):

| Success Criterion | Findings |
|---|---|
| SC 4.1.2 (Name, Role, Value) | 440 |
| SC 2.4.3 (Focus Order) | 217 |
| SC 2.1.1 (Keyboard) | 18 |
| SC 2.5.3 (Label in Name) | 2 |
| SC 4.1.3 (Status Messages) | 1 |

## 11. Output artifacts

- `benchmarks/real-world/raw-results/*.json` — per-repo raw scan output, all 21 repos (unchanged
  format).
- `benchmarks/real-world/raw-results/_combined-summary.json` — cross-repo aggregate (unchanged
  format, produced by `run-real-world-benchmark.ts` itself).
- **New this stage**, produced by `benchmarks/real-world/generate-corpus-summary.ts` (reads
  `raw-results/*.json`, never re-scans):
  - `repository-manifest.json` — full reproducibility metadata per repo.
  - `framework-distribution.json`.
  - `domain-summary.json` — via `primaryResearchDomain()`, plus WCAG SC breakdown.
  - `rule-frequency-summary.json`.
  - `reproducibility-metadata.json`.
- `benchmarks/real-world/raw-results-archive/2026-09-03-pre-20-repo-expansion/` — preserved
  pre-expansion 15-repo snapshot (Section 4).
- `benchmarks/real-world/METHODOLOGY.md` §8c — full expansion methodology, selection criteria,
  and anomaly write-up.
- `benchmarks/real-world/README.md` — tl;dr updated to current 21-repo totals (prior 5-repo-pass
  numbers preserved for history, not deleted).

## 12. Dissertation / research docs updated (current-state references only)

Updated (all current-state trackers, not historical audit reports): `docs/research/
FINAL_RESEARCH_CONTRACT.md` §8 and its human-action list, `docs/research/EXPERIMENT_FREEZE.md`
(repository inclusion protocol row + human-action list), `docs/research/FINAL_TRACEABILITY_MATRIX.md`
(real-repositories row), `docs/dissertation/chapter6_conclusion.md` (future-work item 3),
`docs/evidence/EVIDENCE_INDEX.md` (large-scale evaluation row). Historical audit reports (e.g.
`STAGE_2_DISSERTATION_ALIGNMENT_REPORT.md`, `PRE_FREEZE_TECHNICAL_COMPLETION_REPORT.md`,
`FINAL_IMPLEMENTATION_AND_SUBMISSION_READINESS_REPORT.md`) were left untouched, per this stage's
explicit instruction not to rewrite history.

## 13. Tests

New file: `tests/real-world-corpus-manifest.test.ts` (12 tests), added to `package.json`'s `test`
script. Covers: manifest has >=20 unique repos; every repo has a full 40-hex-char pinned commit SHA;
no duplicate URLs; no duplicate commit SHAs; every `primaryFrameworkLabel` is valid; only
React/Next.js/Angular repos count toward the primary-framework target (with an explicit Vue-is-not-
padding regression guard); no primary framework is empty; every `REPOS` entry has a matching
`raw-results/<name>.json`; combined-summary arithmetic matches the sum of per-repo files; a
parse-error file is never counted as clean; `domain-summary.json` is re-derivable via
`primaryResearchDomain()`; the pre-expansion 15-repo archive snapshot exists and contains exactly 15
per-repo files (not silently overwritten with 21).

TESTS: **1393/1393 pass, 0 fail** (`npm test`, clean run; see note below on one earlier
non-reproducing flaky run).

BUILD: **PASS** (`npm run build`, exit code 0; full Next.js production build completed, all routes
compiled).

**Note on test-run flakiness observed during this stage**: an earlier `npm test` invocation in this
same session (run immediately after the ~4.9-minute 21-repo clone/scan and piped through `tail -150`
for display) reported 36 failures, all sharing the identical Windows exit code `3221225794` and
clustering consecutively near the end of the alphabetically-adjacent test list (`stale-violation-
context.test.ts` through `wcag-mapping-integrity.test.ts`) — a pattern consistent with local
resource exhaustion (this session had just performed several heavy git-clone/scan operations) rather
than a real regression. An immediate, otherwise-identical clean re-run (`npm test`, full output
captured, no truncation) passed all 1393 tests with 0 failures, including
`tests/real-world-corpus-manifest.test.ts` itself (suite 189). Recorded here for transparency,
per this project's no-fabrication/parse-failure-honesty standard, rather than silently discarding
the earlier failing run.

## 14. Fields

```
CORPUS_TARGET:
20-30

CORPUS_BEFORE:
15

CORPUS_AFTER:
21

TARGET_MET:
YES

FRAMEWORK_DISTRIBUTION:
React: 5
Next.js: 5
Angular: 5
(Vue: 3, Generic JS/TS: 3 -- additional support, not counted toward the primary-framework target)

NEW_REPOSITORIES:
excalidraw/excalidraw @ e1bb9ff8f8931e783c11d104abb8967ac6605c9a (React)
alan2207/bulletproof-react @ 9506629ed003a561c6627735480cce4994244bb4 (React)
vercel/chatbot @ c2f8235e1f3ea903ad8b7f61447c4f74164b5c58 (Next.js)
nextjs/saas-starter @ 6e33e58b1e553a41fe22e6b941a7229a002de361 (Next.js)
akveo/ngx-admin @ dc6a442704bfef34b776b5eb15faf852d9e2f75c (Angular)
coreui/coreui-free-angular-admin-template @ 5f66f95b19edf4092fd2f95f5c5b34e185bba033 (Angular)

TOTAL_FILES_DISCOVERED:
2512

TOTAL_FILES_ANALYZED:
2512

PARSE_ERROR_FILES:
117

CRASHES:
0

TOTAL_FINDINGS:
2649

ARCHITECTURE_FINDINGS:
393

STATIC_PERFORMANCE_FINDINGS:
1578

ACCESSIBILITY_FINDINGS:
678

DISTINCT_RULES_TRIGGERED:
36

ANOMALIES_FOUND:
3

ANOMALIES_RESOLVED:
0 (all 3 documented, none fixed -- fixing any would mean changing parser/detector semantics
mid-corpus-run, which this stage's own brief explicitly prohibits; none rise to the "genuine
defect requiring stop-fix-rerun" threshold -- see Section 7 for the specific reasoning per
anomaly. Separately, one unrelated script-execution-safety defect (Section 5/7 preamble) WAS
found and fixed, but it is not one of the 3 corpus anomalies -- it required no corpus re-run
since it never altered scan results, confirmed by byte-identical before/after counts.)

REAL_WORLD_PRECISION_RECALL_F1:
NOT_AVAILABLE_PENDING_EXPERT_GROUND_TRUTH

RQ3_EVIDENCE_STATUS:
UPDATED

TESTS:
1393/1393 PASS

BUILD:
PASS

EXPERIMENT_FREEZE_READY:
NO -- repository-corpus expansion is done, but the RQ1 44-execution experiment
(REAL_RQ1_RUNS_COLLECTED: 0) and RQ4 expert ground-truth collection (0 submissions) both remain
outstanding per docs/research/EXPERIMENT_FREEZE.md's own required-human-action list.

REAL_PARTICIPANT_RECORDS_CREATED:
0

REAL_RQ1_RUNS_COLLECTED:
0

NEXT_ACTION:
Pre-freeze review, then execute the frozen RQ1 experiment and RQ4 expert-validation stages.
```
