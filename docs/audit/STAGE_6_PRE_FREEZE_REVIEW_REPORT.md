# FIGM Stage 6 — Pre-Freeze Review and Experiment Freeze Preparation

**Date:** 2026-09-03

## Purpose

Final technical/research-integrity review before the experiment freeze commit/tag. No real RQ1
measurements, expert annotations, or participant responses were collected. No detector/rule
semantics were changed to improve corpus results. Nothing was committed or tagged.

## 1. Inspection performed before any judgment

Read, in full, every document this task named: `FINAL_RESEARCH_CONTRACT.md`,
`FINAL_TRACEABILITY_MATRIX.md`, `EXPERIMENT_FREEZE.md`, `RQ1_EXPERIMENT_PROTOCOL.md`, Stage 1-5
audit reports, `package.json`, `src/research/research-config.ts`, `AI_CONFIGURATION_FREEZE.md`,
`research/CONSENT_FORM.md`/`QUESTIONNAIRE.md`, `research/independent-annotation/` (full package),
`research/rq1-experiment/protocol.json` and its `raw-results/`, and the live `git status`/`diff`.
Every canonical value below was re-derived from the current source file, not copied from a prior
report's summary — see Section 4.

## 2. Working tree classification

`git status --short` / `git diff --stat` / `git diff --name-status`: **277 changed/untracked
paths** (up from 248 at the start of this stage — the increase is entirely this stage's own work:
regenerating the independent-annotation package, re-running the canonical evaluation/spec
generators, and this report itself).

| Class | Count | Paths (pattern) |
|---|---|---|
| SOURCE | 132 | `app/**` (excl. dissertation-facing pages counted below is not separate — all 44 app/ paths are source), `src/**` (41), `scripts/**` (3, all `.ts` generators), `vscode-extension/src/**` (2), `middleware.ts` (1), `next.config.mjs` (1) — Next.js/React app code, the FIGM engine, CLI, VS Code extension, and build config are all real, compiled/tested code |
| TEST | 46 | `tests/**` — all `.test.ts`, all wired into `package.json`'s `test` script |
| CONFIG | 6 | `.env.example` (placeholder template, verified below), `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs` (also counted above as build config), `middleware.ts` (also app routing config) |
| RESEARCH_DOC | ~55 | Root docs (`README.md`, `SECURITY.md`, `DEPLOYMENT.md`, `DATABASE.md`, `ENV_VARIABLES.md`, `VIVA_PREPARATION_GUIDE.md`, `DISSERTATION_DEMO_GUIDE.md`, `RESEARCH_TRACEABILITY_MATRIX.md`), `audit/DEFECT-REGISTER.md`, `docs/audit/**` (11 stage/audit reports + this one), `docs/research/**` (8, incl. the new `KNOWN_LIMITATIONS_REGISTER.md`), `research/CONSENT_FORM.md`/`DATA_COLLECTION_PROTOCOL.md`/`PARTICIPANT_INSTRUCTIONS.md`/`QUESTIONNAIRE.md`/`README.md`, `research/user-study/README.md`, `research/independent-annotation/README.md`/`ANNOTATION_INSTRUCTIONS.md`, `docs/DEVELOPMENT_SUMMARY.md`, `docs/migration_guide.md`, `docs/validation-report.md`, `docs/architecture/**`, `research/audits/**` |
| DISSERTATION | 10 | `docs/dissertation/*.md`/`*.tex` (chapters 1-6; chapters 1-2 untracked/new, others modified by the evaluation-runner's regeneration) |
| BENCHMARK | 39 | `benchmarks/**` (ground-truth, testbed/negative fixtures, controlled-benchmark exports, all of `benchmarks/real-world/**` — manifest, methodology, README, raw-results, archive) |
| GENERATED_EVIDENCE | ~47 | `figm-spec.json`, `docs/evidence/**`, `docs/reports/**`, `docs/migration-report.json`, `public/eval-results/**`, `research/analysis/usability-results.json`, `research/independent-annotation/internal/blinded-ground-truth.json` + `package/fixtures/**` + `package/RULE_REFERENCE.md` + `package/annotation-template.csv` (all machine-regenerated, none hand-authored), `research/independent-annotation/results/STATUS.md` |
| RQ1_EXPERIMENT | 15 | `app/rq1-experiment/**` (9 files: 4 fixture routes + `_shared/*`), `research/rq1-experiment/**` (protocol.json, environment/baseline.json, scripts/, raw-results/smoke-test/ 6 files, processed-results/.gitkeep.md) |
| TEMP | 0 | None found. (Two temp investigation scripts created during Stages 5-6 — `.tmp-investigate-parse-errors.ts`, `.tmp-stage6-verify.ts` — were both deleted before this git status snapshot; verified absent.) |
| SECRET_RISK | 0 | See Section 3 — none found. |
| UNKNOWN | **0** | Every one of the 277 paths above was individually attributable to one of the classes above. |

**Note on `research/independent-annotation/`**: this stage found its `package/fixtures/` (21 files,
stale) and `package/RULE_REFERENCE.md` (25/50 rules, stale) out of sync with the current 50-rule/
65-violation benchmark testbed, and regenerated both via `npm run research:generate-annotation-package`
(extended this stage to also regenerate `RULE_REFERENCE.md` from `RULE_CATALOG`, so it cannot drift
again) — see Section 8.

## 3. Secret / env safety audit

- `.env.example`: read in full. Every value is a placeholder (`YOUR_...`, `G-XXXXXXXXXX`) — no real
  API key, JWT secret, DB password, or credential of any kind. Confirmed unchanged in shape from its
  prior audited state.
- `.env` / `.env.local` / any real secret file: **not present in `git status` output at all** —
  confirmed via `.gitignore` (`.env`, `.env*` both present) and a direct grep of the status list.
- Pattern scan across every tracked diff (`git diff`) and every untracked file's content for
  API-key-shaped strings (`sk-...`, `AIza...`, JWT-shaped `eyJ...eyJ`), real (non-placeholder)
  Postgres connection strings, and PEM private-key headers: **zero matches**.

**SECRET_RISK: NONE.**

## 4. Research contract values — verified against live source, not copied from prior reports

| Field | Claimed | Verified live | Match |
|---|---|---|---|
| FINAL_RQ_SET | SET_B | `FINAL_RESEARCH_CONTRACT.md` §1 (verbatim Proposal §2.3/Interim02 §1.4 quote) | YES |
| PARTICIPANT_TARGET | 20 | `src/research/research-config.ts`: `HUMAN_STUDY_TARGET_PARTICIPANTS = 20` | YES |
| REPOSITORY_TARGET | 20-30 | `FINAL_RESEARCH_CONTRACT.md` §8 (Proposal §4.3 / Interim02 §3.4) | YES |
| CURRENT_CORPUS | 21 | `benchmarks/real-world/run-real-world-benchmark.ts` `REPOS.length` (re-counted) | YES |
| PRIMARY_FRAMEWORKS | React, Next.js, Angular | `FINAL_RESEARCH_CONTRACT.md` §4 | YES |
| VUE | additional support | `FINAL_RESEARCH_CONTRACT.md` §4; `REPOS` entries labelled, excluded from primary count | YES |
| RQ1 | FCP + TTI required | `RQ1_EXPERIMENT_PROTOCOL.md` §5/§6 (Lighthouse `first-contentful-paint`/`interactive` audits) | YES |
| RQ1_RUNTIME_SCOPE | React/Next.js CSR/SSR x LOCAL/GLOBAL | `research/rq1-experiment/protocol.json` `conditions` (4, all `NEXTJS_REACT`) | YES |
| RQ4 | expert review, P/R/F1 required | `FINAL_RESEARCH_CONTRACT.md` §10 | YES |
| ETHICS | confirmed by researcher | `research/CONSENT_FORM.md`: `ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER` | YES |
| CONSENT_VERSION | 1.0.0 | `src/research/research-config.ts`: `CONSENT_PROTOCOL_VERSION = '1.0.0'` | YES |
| SURVEY_VERSION | 1.0.0 | `src/research/research-config.ts`: `RESEARCH_ARTIFACT_VERSIONS.surveyVersion = '1.0.0'` | YES |
| RULE_SET_VERSION | 2.1.0 | `src/research/research-config.ts`: `RESEARCH_ARTIFACT_VERSIONS.ruleSetVersion = '2.1.0'` | **MISMATCH FOUND AND FIXED** |

**One mismatch found**: `docs/research/EXPERIMENT_FREEZE.md`'s "Rule-set version" row said `2.0.0`,
one version behind the canonical `2.1.0` in `src/research/research-config.ts` (the version was
bumped during the Pre-Freeze Technical Completion Pass, per that constant's own doc comment, but
`EXPERIMENT_FREEZE.md`'s table was never updated to match). **Fixed this stage** — corrected to
`2.1.0` with a note explaining the correction. This is a documentation-only fix; the underlying
50-rule set itself is unchanged.

**RESEARCH_CONTRACT: PASS** (one stale-documentation mismatch found and corrected; no contract
*value* itself was wrong).

## 5. Rule / engine freeze review

Verified directly against `src/matrix/four-layer-meta-model.ts` (not assumed from a prior report):

```
total rules: 50
domain counts: { ARCHITECTURE: 19, STATIC_PERFORMANCE: 24, ACCESSIBILITY: 7 }
wcag mapping count: 7 (all 7 accessibility rules have a WCAG_22_MAPPINGS entry, 0 missing)
distinct rule IDs: 50 (no duplicates)
```

Matches `FINAL_RESEARCH_CONTRACT.md` §5 exactly. `tests/wcag-mapping-integrity.test.ts` (8 tests,
including a regression guard that two rules with different concerns can't share a WCAG clause, and
that `generateMasterSpecification()` throws rather than silently defaulting if any accessibility
rule lacks a mapping) passes. Deterministic-remediation, validation/re-scan-chain, and scan-status
honesty behavior were verified via the existing regression suites (`tests/ast-fix-engine.test.ts`,
`tests/sandbox-validation-pipeline.test.ts`, `tests/remediation-engine-regressions.test.ts`,
`tests/rule-catalog-consistency.test.ts`) — all passing in the full-suite run (Section 12); no rule
was added, removed, or had its severity changed this stage.

## 6. Known Limitations Register

Created: `docs/research/KNOWN_LIMITATIONS_REGISTER.md` — a standing, updatable register (not a
point-in-time report) consolidating every disclosed limitation across this project, organized by
area (detection engine/parser, RQ1 scope, Vue scope, accessibility scope, accuracy evidence,
human-participant study, telemetry, AI-remediation testing, dissertation-text alignment), each
citing its full source document, plus a "Resolved" section preserving history. Covers all 9 items
this task's brief named, verbatim or more precisely sourced. See that file for full detail — not
duplicated here.

## 7. RQ1 freeze check

Verified directly against `research/rq1-experiment/protocol.json` (not assumed from a prior
report):

```
conditions: CSR_LOCAL, CSR_GLOBAL, SSR_LOCAL, SSR_GLOBAL (4, all NEXTJS_REACT) -- MATCH
warmupRuns: 1 -- MATCH
measuredRuns: 10 -- MATCH
expected: 4 warm-up + 40 measured = 44 total -- MATCH (runCountRationale field, verbatim)
FCP: lighthouse "first-contentful-paint" audit, numericValue field -- MATCH
TTI: lighthouse "interactive" audit, numericValue field -- MATCH
environment: desktop-config.js preset, throttlingMethod=simulate, rttMs=40, throughputKbps=10240,
  cpuSlowdownMultiplier=1, screenEmulation 1350x940 non-mobile -- MATCH (Stage 3A's corrected profile)
```

**Smoke/real data contamination check** (performed directly on the raw files, not assumed):
`research/rq1-experiment/raw-results/` contains only a `smoke-test/` subdirectory (no top-level
`.json` files that would represent real data). All 6 files inside `smoke-test/` were individually
parsed and confirmed `isSmokeTest: true` — zero real or ambiguous rows. `processed-results/` is
empty except its explanatory `.gitkeep.md`. **No smoke rows could enter a final analysis as
currently structured.**

**RQ1_PROTOCOL_READY: YES. RQ1_REAL_RUNS: 0.**

## 8. RQ4 expert-protocol readiness

Inspected `research/independent-annotation/` in full. **Found genuinely incomplete, not just
theoretically outdated**:

- `package/fixtures/` contained 21 files, generated at an earlier point in this project's history;
  the current `benchmarks/testbed/` (source of truth) now has 45 top-level entries plus a 21-file
  `negative/` subdirectory and a nested `next03/` fixture — 67 files total when correctly collected
  recursively.
- `package/RULE_REFERENCE.md` hand-listed only 25 of the current 50 rules (missing all 6 Vue rules
  entirely, plus `FIGM-A11Y-07` and 17 rules added in a later expansion pass) — an annotator handed
  this sheet would have had no reference for half of what they could plausibly encounter.
- `package/ANNOTATION_INSTRUCTIONS.md` told an annotator to expect "4 short source files," a claim
  that was already wrong by an order of magnitude before this stage's regeneration.

**Fixed, protocol/documentation only, per this task's explicit allowance** (no expert data was
collected):
1. `scripts/generate-annotation-package.ts` extended to also regenerate `RULE_REFERENCE.md` directly
   from `RULE_CATALOG` (`src/matrix/rule-registry.ts`) — the same canonical registry every other
   consumer reads — so it can never silently drift out of sync with the rule set again.
2. Re-ran `npm run research:generate-annotation-package`: `package/fixtures/` now has 67 files
   (matching the current testbed exactly), `internal/blinded-ground-truth.json` now has 65 items
   (matching `benchmarks/ground-truth.json` exactly), `RULE_REFERENCE.md` now lists all 50 rules.
3. `ANNOTATION_INSTRUCTIONS.md` rewritten to describe the fixture set without a brittle hardcoded
   count (names the frameworks/`negative/` subset instead of a number that will go stale again).
4. **A downstream test broke as a direct, correct consequence** (`tests/independent-annotation-pipeline.test.ts`
   hardcoded `items.length === 40` and several kappa/agreement values derived from that count, with
   its own comment explicitly warning "if this changed, the hand-computed expectations below must be
   recomputed, not adjusted blindly"). Recomputed properly: constructed the identical synthetic
   test-submission shape used by the test, ran the real `scripts/compare-annotations.ts` against the
   regenerated 65-item ground truth, hand-verified the presence/absence arithmetic (n=66, 95.5%
   observed, 95.5% expected, kappa -0.021, confusion matrix 63/2/1/0) against the script's real
   output, and captured the "Rule Classification Agreement" figures (n=63, 76.2%, kappa 0.755) the
   same way the original test did (from an actual run, since that section's outcome depends on
   real fixture line-proximity collisions, not derivable from the count alone). Updated the test;
   re-ran — passes. No test was weakened; the assertions still fail if the script's logic regresses.

**Blind-review integrity re-verified after regeneration**: `generate-annotation-package.ts`'s own
internal check (fails loudly if any `Defect: FIGM-...` comment survives stripping) ran clean on all
67 regenerated fixtures. No FIGM scan output, prior analysis, or answer key is included in
`package/` — only in `internal/` (never bundled to an annotator) and `results/` (currently just
`STATUS.md`, honestly reporting `PENDING`, 0 real submissions). Submission format
(`annotation-template.csv`), versioning (regeneration is idempotent and reproducible, tied to the
live testbed/ground-truth), and the TP/FP/FN-equivalent derivation procedure
(`scripts/compare-annotations.ts`'s presence/absence + rule-classification agreement, Cohen's kappa,
confusion matrix) were all exercised end-to-end by the fixed test and by a real, ad hoc run of the
script this stage — both produced real, working output.

**RQ4_EXPERT_PROTOCOL_READY: YES** (post-fix). **RQ4_EXPERT_SUBMISSIONS: 0.**

## 9. Human-study readiness

- Target: 20 (`HUMAN_STUDY_TARGET_PARTICIPANTS`, verified Section 4).
- Ethics: `CONFIRMED_BY_RESEARCHER` (reference number still `TO_BE_RECORDED`, non-blocking,
  disclosed as such — not fabricated).
- Consent version: `1.0.0`, locked. Survey version: `1.0.0`, locked.
- Study tasks: unchanged this stage (`app/user-study/page.tsx` not touched).
- Real participant count: **0** — verified via `research/analysis/usability-results.json`'s live
  provenance block (`validParticipantCount: 0`, `collectionStatus: "NOT_COLLECTED"`, real
  exclusion-log entry noting the raw-response CSV does not exist).
- Engineering/test-record contamination check: Stage 4's two engineering test accounts
  (`stage4-usera@figm-test.local`, `stage4-userb@figm-test.local`, role `DEVELOPER`) were created
  to test the project/scan flow, not the `/user-study` consent flow — confirmed by re-reading Stage
  4's own report (Section 7: "No real participant record was created this pass"). Participant
  records are matched by a distinct ID pattern (`^P\d{3,6}$`, `src/engine/participant-repository.ts`)
  populated only via the Google Form CSV import pipeline (`scripts/import-user-study.ts`), a
  structurally separate path from ordinary account creation — a `DEVELOPER`-role test account cannot
  incidentally register as a study participant.

**HUMAN_STUDY_PROTOCOL_READY: YES. REAL_PARTICIPANTS: 0.**

## 10. Repository corpus freeze check

- Current corpus: 21 (re-counted directly from `REPOS`, Section 4).
- Pinned SHAs: verified by `tests/real-world-corpus-manifest.test.ts` (12 tests, all passing in the
  full suite) — every repo has a full 40-hex-char commit SHA, no duplicates.
- Manifest complete: `benchmarks/real-world/raw-results/repository-manifest.json` (license,
  inclusion rationale, source dirs, exclusion paths, date pinned, files/LOC per repo).
- Archived 15-repo pre-expansion snapshot preserved: `raw-results-archive/2026-09-03-pre-20-repo-expansion/`
  confirmed present with exactly 15 per-repo files (enforced by the same manifest test).
- Domain aggregate reproducible: `raw-results/domain-summary.json`, computed via
  `primaryResearchDomain()` — re-verified reproducible in Stage 5 by an accidental double-run
  (byte-identical output); not re-run again this stage to avoid a wasteful 180MB re-clone when
  Stage 5 already established determinism twice independently.
- Framework distribution recorded: `raw-results/framework-distribution.json` (React 5, Next.js 5,
  Angular 5, Vue 3, Generic JS 2, Generic JS/TS 1).
- No real-world P/R/F1 claim anywhere: confirmed by direct grep of `benchmarks/real-world/**` for
  "precision"/"recall"/"F1" outside of explicit disclaimer sentences — none found; `SUMMARY.md` and
  `METHODOLOGY.md` both state explicitly that no such metric is computed from this corpus.

**CORPUS_FROZEN_READY: YES.** The corpus manifest/version is frozen as of this review (`REPOS` in
`run-real-world-benchmark.ts`, `21 repos`, `raw-results/*` as currently written) for the upcoming
evaluation.

## 11. Generated data / export reproducibility

Ran every canonical exporter/generator this stage, on the current (unchanged-this-stage) rule set
and testbed, and confirmed each reproduces internally consistent, expected output without
overwriting any historical archive:

- `npm run research:evaluate` (`src/eval/evaluation-runner.ts`): F1-Score 100.0% (self-fulfilling
  controlled benchmark, as already disclosed), regenerated `benchmarks/*`, `public/eval-results/*`,
  `docs/reports/*`, `docs/evidence/canonical-evaluation.json`, and dissertation Markdown chapters.
- `npm run research:validate` (`scripts/validate-research.ts`): TP=65, FP=0, FN=0, Precision/Recall/
  F1 all 100.0%, "mathematically consistent" — matches the evaluator's own output exactly (no
  drift between the two independent computations).
- `npm run generate-spec` (`src/matrix/export-spec.ts`): "Total Core Rules in Matrix: 50" — matches
  Section 5.
- `npm run research:generate-annotation-package`: Section 8.

No archive directory (`raw-results-archive/`, or any other) was touched by any of these — they only
write to the live, current-state output paths.

## 12. Final test gate

**Targeted freeze/integrity tests** (research-integrity, independent-annotation-pipeline,
wcag-mapping-integrity, real-world-corpus-manifest, all 5 RQ1 test files, anti-hardcoding-guard,
rule-catalog-consistency, accessibility-page-no-fabrication, diagnostics-domain-filter,
evaluation-runner — 14 files):

```
tests 153
pass 153
fail 0
```

**Full suite** (`npm test`), run once, clean:

```
tests 1393
suites 99
pass 1393
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 317017.5
```

No flaky/resource-exhaustion failure occurred this time (Stage 5's report documented one such
transient failure with a 36-test Windows-crash-code cluster near the end of the test list, resolved
by an immediate clean re-run). This stage's run was clean on the first attempt — no investigation or
re-run was needed, and none was performed beyond this single full run plus the earlier targeted
subset (both independently green).

**Build** (`npm run build`): **PASS**, exit code 0, clean.

No existing test was weakened, skipped, or modified to force a pass — the one test that changed
(`tests/independent-annotation-pipeline.test.ts`) had its hardcoded expectations recomputed from a
real script run against real (regenerated, correct) data, per its own explicit warning against
blind adjustment (Section 8).

## 13. Freeze decision

**No commit or tag was made.**

### TECHNICAL_FREEZE_READY: YES

- No UNKNOWN changes (Section 2: 0/277).
- No secret risk (Section 3: NONE).
- Tests pass (Section 12: 1393/1393).
- Build passes (Section 12: PASS).
- Research contract consistent (Section 4: PASS, one stale doc value found and corrected).
- RQ1 protocol frozen (Section 7: YES).
- Corpus frozen (Section 10: YES).
- Expert protocol ready (Section 8: YES, after this stage's fix).
- Human-study protocol ready (Section 9: YES).

### EXPERIMENT_FREEZE_READY: YES

All inputs required *before* data collection are stable: research contract, rule/engine set, RQ1
protocol/infrastructure, RQ4 expert-annotation package, human-study protocol/consent/survey, and
repository corpus are all frozen-consistent as of this review. Per this task's own explicit
instruction, `REAL_RQ1_RUNS_COLLECTED: 0` and `RQ4_EXPERT_SUBMISSIONS: 0` are **not** blockers —
those are collected *after* freeze, not prerequisites to it.

## Final status block

```
RESEARCH_CONTRACT:
PASS

WORKING_TREE_CLASSIFIED:
YES

UNKNOWN_FILES:
0

SECRET_RISK:
NONE

RULE_SET_VERSION:
2.1.0 (EXPERIMENT_FREEZE.md corrected from stale 2.0.0 this stage)

RULE_COUNT:
50

DOMAIN_COUNTS:
Architecture 19
Static Performance 24
Accessibility 7

RQ1_PROTOCOL_READY:
YES

RQ1_REAL_RUNS:
0

RQ4_EXPERT_PROTOCOL_READY:
YES (fixed this stage -- was stale: 21/67 fixtures, 25/50 rules in RULE_REFERENCE.md, wrong file
count in instructions; regenerated from canonical sources and re-verified)

RQ4_EXPERT_SUBMISSIONS:
0

HUMAN_STUDY_PROTOCOL_READY:
YES

REAL_PARTICIPANTS:
0

CORPUS:
21 / target 20-30 (15 primary-framework)

CORPUS_FROZEN_READY:
YES

KNOWN_LIMITATIONS:
See docs/research/KNOWN_LIMITATIONS_REGISTER.md -- 9 active limitation areas (parser/detection
engine x3, RQ1 scope x2, Vue scope, accessibility scope, accuracy-evidence layering x3, human-study
x1, telemetry x1, AI-remediation-testing x1, dissertation-text-alignment x1) plus a Resolved section
preserving history. Full detail and sourcing in that file, not restated here.

TESTS:
1393/1393 pass (targeted 153/153 pass first). Clean on first run, no flakiness this stage.

BUILD:
PASS

TECHNICAL_FREEZE_READY:
YES

EXPERIMENT_FREEZE_READY:
YES

FREEZE_BLOCKERS:
None remaining for the freeze decision itself. (Real RQ1 data collection and real RQ4 expert
recruitment are the deliberate NEXT steps after freeze, not blockers to it, per this task's own
instruction.)

NEXT_ACTION:
Human review -> commit -> tag experiment freeze (e.g. `research-freeze-v1`), recording the real
commit SHA into docs/research/EXPERIMENT_FREEZE.md's "Commit SHA" row (currently
WORKING_TREE_UNFROZEN). After that: execute the real RQ1 44-execution data-collection run, recruit
real independent expert annotator(s) for RQ4, and begin real human-participant recruitment against
the N=20 target -- all under the now-frozen protocol, with any mid-collection change requiring the
documented stop/disclose/version-bump procedure (EXPERIMENT_FREEZE.md, "What must remain frozen").
```
