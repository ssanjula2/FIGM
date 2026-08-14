# FIGM Code Inspector — Full Forensic Audit

**Audit date:** 2026-08-13
**Auditor role:** Independent forensic review (Principal Architect / Static Analysis Engineer / Security Engineer / QA Engineer / Research Methodologist / Academic Examiner / Accessibility Engineer / Performance Engineer / Documentation Reviewer)
**Method:** Direct reading of source, raw data files, and git history; one live `npm test` execution; one live `npm run build`; independent recomputation of statistics from raw counts. No code, data, or documentation was modified during this audit. No findings below are inherited from prior audit documents without independent re-verification against the current working tree — where a prior "FINAL_*" document's claim could not be reproduced against current code/data, that is stated explicitly.

**Anti-fabrication compliance:** every number in this document is either read verbatim from a file (cited) or hand-recomputed from cited raw counts and shown as arithmetic. Nothing was invented. Where the current repository provides no evidence, the finding is labeled `NOT VERIFIED`, `PLANNED — NOT COMPLETED`, `DOCUMENTATION / IMPLEMENTATION MISMATCH`, or `UNSUPPORTED EMPIRICAL CLAIM` per the required taxonomy.

> **Addendum (added at reconciliation, after this audit's original `HEAD` commit `22e58e39`):** six remediation commits have landed since this audit was written, addressing a number of findings below directly:
> `20e28f03` (JWT/refresh-secret fail-closed, committed-credential removal, env-driven admin bootstrap), `df30255b` (dashboard IDOR, POST /api/scans trusted re-analysis, rate-limit IP-spoofing fix), `a7ea19a0` + `f8ee4831` + `e7cfadd1` (real-AST migration, now 23/25 rules real-AST — up from the "1/25" this audit describes; live-scan verified-fix pipeline fix), and `b31ae713` (single canonical source of truth for all empirical benchmark metrics, superseding the `EMPIRICAL_EXPERT_GROUND_TRUTH`/fabricated-AI-patch/fabricated-competitor-latency findings this audit documents below). **This audit's findings are otherwise left exactly as originally written** (per the project's practice of not silently rewriting historical forensic findings) — cross-reference `docs/evidence/research-claim-traceability.md` and `docs/architecture/RULE_ENGINEERING_AUDIT.md` for the current state of any specific finding below before citing it as still-open.

---


## 1. Git Safety & Repository State

- **Branch:** `main`, 7 commits ahead of `origin/main` (unpushed local work).
- **HEAD:** `22e58e3908f2c4e8f1788b6da77c52876285a8c2` — `"fix: QA validation matrix for all 25 FIGM rules; 4 root-cause detection bugs found and fixed"`.
- **Untracked files at session start:** `FIGM_CODE_EXPORT.txt`, `debug-complexity.ts`, `scratch/diag-next02.ts`, `test-suite-output.txt` — developer scratch artifacts, not part of the audit scope, left untouched.
- **No destructive git operations were performed.** No branch was checked out, no history was rewritten, no files were reset or discarded.
- **Recent commit history is itself audit evidence.** The last 18 commits on `main` include, verbatim: `"fix: QA validation matrix... 4 root-cause detection bugs found and fixed"`, `"fix: remove fabricated human-study participant data and results"`, `"feat: independent-annotation infrastructure... (PENDING)"`, `"docs+feat: AST architecture audit + Stage A real-AST migration"`, `"fix: API security audit — auth bypasses, IDOR, rate limiting, CORS, CSRF"`, `"fix: remove incorrect MSc/thesis claims, fix broken GitHub link, fix rule-count typos"`, `"fix: remove fabricated 30-repository/755k-LOC evaluation dataset"`, `"fix: FIGM-NEXT-02 remediation was semantically wrong..."`, `"fix: Vue @click support, unified quality-score formula... remove dashboard statistics fabrication"`. This is a repository whose own commit log is a running admission that fabricated data, broken auth, and wrong remediation logic have repeatedly existed in shipped/committed states. This audit independently re-verified — not assumed — whether each of these fixes actually holds (see §5, §9, §12, §21).

---

## 2. Repository Inventory & Architecture Map

**Stack:** Next.js 14 (App Router) + React 18 + TypeScript 5, Prisma 7 / PostgreSQL (Supabase-hosted), custom (non-library) JWT auth, no test framework (raw Node `--test` runner), no AST parser library beyond the TypeScript compiler API used in 2 files.

| Layer | Location | Notes |
|---|---|---|
| Frontend (25 route groups) | `app/` | Landing, live-scan, dashboard, analytics, guidelines, references, user-study, admin, auth, settings, etc. |
| API (30 routes) | `app/api/**/route.ts` | Auth, dashboard, projects, scans, export, research-metrics, user-study, admin |
| Static analysis core | `src/parser/`, `src/ast/`, `src/analysis/`, `src/engine/`, `src/matrix/` | Custom regex/line-based "AST" (see §6) |
| Remediation | `src/engine/remediation-engine.ts`, `src/ai/` | Template engine + optional real Gemini API call |
| Auth | `src/auth/` | Custom HMAC JWT, PBKDF2 password hashing |
| Storage | `src/storage/`, `src/db/`, `prisma/schema.prisma` | Dual-mode: local JSON file (`figm-user-db.json`) fallback + Supabase/Postgres |
| Research/eval engine | `src/eval/` | Benchmark runner, precision/recall engine, user-study evaluator, thesis-chapter exporter |
| Benchmark fixtures | `benchmarks/`, `tests/fixtures/` | 4 hand-authored fixtures, 19 labelled violations |
| Human-study system | `research/`, `app/user-study/`, `app/api/user-study/` | Protocol docs, Google Form, CSV ingestion pipeline — unexecuted |
| Tests | `tests/` (38 files) | Real Node test runner, no mocking, 415 tests / 66 suites |
| Documentation | repo root (~49 `.md` files) + `docs/` (~30 files) + `docs/dissertation/` | Includes ~26 root `FINAL_*.md` self-audits (see §21) |
| Deployment | `vercel.json`, `.vercel/project.json` | Live-linked Vercel project `figm-code-inspector` |

`package.json`'s `"test"` script explicitly enumerates **38** test files by name (not a glob); `tests/` contains 38 physical `*.test.ts` files plus a `fixtures/` directory (not a 39th test file, contrary to the initial file listing's apparent count of 39).

---

## 3–4. Critical Source Findings & Research-Claim Traceability

Findings are consolidated into the severity-classified list in §25 to avoid duplication; each finding there carries file:line evidence, the responsible subsystem, and research/security/QA impact. Section 23 provides the requested Research Question → Evidence traceability matrix.

---

## 5. Fabrication / Anti-Fabrication Forensic Audit

A repo-wide search for `755k`, `755000`, `30 repositories`, `85 participants`, `N=85`, and hardcoded metric literals, cross-referenced against actual data sources, found the following **current-state** picture (previous "removed" claims independently re-verified, not assumed):

| Item | Status | Evidence |
|---|---|---|
| 30-repository / 755k-LOC dataset | **Mostly removed**, but **CONTRADICTED by a live fallback path** | `src/eval/repo-evaluator.ts` deleted (commit `d69f80f2`); BUT `src/engine/dashboard-repository.ts:181-189` still contains a hardcoded fallback activity-feed entry — *"Generated interactive HTML report for 30-repository evaluation"* — served live and unauthenticated via `GET /api/dashboard/activity` whenever the real audit-log table is empty (e.g., any fresh install). This re-asserts, to any first-time visitor, a claim the project elsewhere explicitly disowns. |
| Dissertation Chapter 5 headline P/R/F1 (85.7%/94.7%/90.0%, TP=18/FP=3/FN=1) | **CONTRADICTED** | Hardcoded in `src/eval/precision-recall-engine.ts:36-41` (`EMPIRICAL_EXPERT_GROUND_TRUTH`), not derived from `benchmarks/ground-truth.json`. The live, reproducible engine now reports **90.5%/100.0%/95.0% (TP=19/FP=2/FN=0)** — independently recomputed and verified exact match to `benchmarks/eval-summary.json` and a second independently-generated `docs/evidence/canonical-evaluation.json`. The dissertation's category-breakdown table further attributes `FP=3` to `FIGM-REACT-01..04`, but **zero `FIGM-REACT-*` rule IDs exist anywhere in `benchmarks/ground-truth.json`** — this specific row has no supporting data anywhere in the repository. |
| AI patch remediation stats (450 defects, 434 patches, 96.44%/98.16%/94.93%, 1.4s avg fix time) | **UNSUPPORTED EMPIRICAL CLAIM** | Hardcoded literals in `src/eval/ai-patch-evaluator.ts:45-68`, no scan log, no timing harness, no disclaimer anywhere they are surfaced (`docs/dissertation/chapter5_empirical_validation_and_benchmarks.md` §5.3). |
| Competitor tool benchmark (Lighthouse 8400ms, ESLint 420ms, SonarQube 3200ms, etc.) | **UNSUPPORTED EMPIRICAL CLAIM** | Hardcoded in `src/eval/tool-benchmark.ts:26-33`; none of these tools are installed, invoked, or timed anywhere in the repo. |
| Human-study N=85 SUS=86.4, α=0.892 | **Honestly disclosed as synthetic** where it currently surfaces | `research/analysis/usability-results.json`: `datasetType: "SYNTHETIC"`, `validParticipantCount: 0`. `src/eval/user-study-evaluator.ts:28-59` still contains hand-typed, internally-inconsistent Likert constants (per-question response counts sum to 92, not the stated N=85) — not deleted, but gated behind `isReal = provenance.isRealHumanData && count > 0` (currently `false`) everywhere it is exported, and labeled `[SYNTHETIC_PIPELINE_TEST_DATA]` in the generated dissertation chapter. |
| Dashboard trend badges, hardcoded statistics floors | **Claimed fixed by commit `5cc65f7f`** | Not independently re-audited line-by-line in this pass beyond the activity-feed fallback above; flagged as a residual-risk area worth a targeted follow-up given the pattern of partial fixes found elsewhere. |
| `figm-user-db.json` committed to git with live credentials | **NOT previously flagged as fabrication, but is itself a serious authenticity/security problem** | See §12, Critical Finding SEC-01 — this is not fabricated data, it is *real* production-shaped credential data that should never have been committed. |

**Distinction required by the audit brief:** the 19-item, 4-file, 8-rule benchmark ground truth (`benchmarks/ground-truth.json`) is a **legitimate fixed test fixture** — every labelled violation was independently confirmed present in its source file by direct reading. It is not fabricated; it is simply small (see §8 for the coverage-size implications). The items in the table above, by contrast, are **unsupported empirical claims** — numbers presented as measured results with no underlying measurement.

---

## 6. AST / Static Analysis Engine Forensic Audit

**Pipeline traced:** `source code → SourceParser.buildASTFromCode() → synthetic tree-shaped node array → UniversalASTMapper (pass-through) → ALPExtractionEngine (relabeling) → ASTDetectionEngine.evaluateNode() (real recursive predicate evaluator) → Diagnostic → RemediationEngine (string templates)`.

**Dependency check:** `package.json` contains no AST parser library (no `@babel/parser`, `acorn`, `esprima`, `@vue/compiler-sfc`, `@angular/compiler`). The only real parser present anywhere is the `typescript` compiler API, used in exactly two files: `src/analysis/type-checker-service.ts` (real compiler diagnostics, a *different* diagnostic category — `TYPE-TS-*`, not the 25 FIGM guideline rules) and `src/analysis/react-ast-rules.ts` (real `ts.createSourceFile` + visitor, used for exactly one rule).

**Core finding:** `src/parser/source-parser.ts` performs a genuine character-level lexer pass to blank out comment/string contents (`stripCommentsAndStrings()`, a real finite-state machine — this part is legitimate), but the actual "AST" is then built by a **line-by-line loop of 22 independent `.includes()`/regex trigger blocks** that push synthetic node objects (`{ type: 'JSXElement', attributes: {...}, loc }`) shaped like AST nodes but never derived from parsing. Direct evidence (`source-parser.ts:564-585`, the `FIGM-PERF-02` trigger): a single-line regex test on `<img` followed by object construction that *looks like* an AST node.

**Rule-by-rule mechanism table** (all 25 rules):

| Rule ID | Mechanism | Real AST? |
|---|---|---|
| FIGM-PERF-01 | Regex/string (loop-scope object literal) | No |
| FIGM-PERF-02 | Regex/string, same-line only | No |
| FIGM-PERF-03 | Regex/string (whole-file event-type pairing) | No |
| FIGM-PERF-04 | Brace-depth-tracking heuristic | AST-informed heuristic, not real parse |
| FIGM-PERF-05 | Regex/string, same-line only | No |
| FIGM-PERF-06 | Regex/string | No |
| FIGM-A11Y-01 | Multi-line, brace-depth-aware tag scan | AST-informed heuristic, not real parse |
| FIGM-A11Y-02 | Regex/string, hardcoded tag-name allow-list (`<Custom`, `<Select`, `<Dropdown`) | No |
| FIGM-A11Y-03 | Regex/string (`className="status`, static only — misses dynamic class names) | No |
| FIGM-A11Y-04 | Regex/string, hardcoded allow-list (`<Modal`, `<Dialog`) | No |
| FIGM-A11Y-05 | Regex/string | No |
| FIGM-A11Y-06 | Regex | No |
| FIGM-NEXT-01 | Regex/string | No |
| FIGM-NEXT-02 | Hardcoded 6-package allow-list | No |
| FIGM-NEXT-03 | Path pattern + string | No |
| FIGM-NEXT-04 | Regex/string | No |
| FIGM-REACT-01 | Regex/string, proximity-only (doesn't verify `useMemo` actually wraps the call) | No |
| **FIGM-REACT-02** | **Real TypeScript compiler API** (React/Next.js files only); regex fallback for Vue/Angular/generic | **Yes, for 2 of 4 frameworks** |
| FIGM-REACT-03 | Regex/heuristic (mutation-method matching; known FP on any local array, not just React state) | No |
| FIGM-REACT-04 | Regex/string, hardcoded allow-list | No |
| FIGM-ANG-01 | Regex/string (whole-file pairing) | No |
| FIGM-ANG-02 | Regex/string | No |
| FIGM-ANG-03 | Regex/string | No |
| FIGM-ANG-04 | Regex/string, single-line co-occurrence | No |
| FIGM-ANG-05 | Regex/string | No |

**Tally: 22 of 25 rules are pure regex/substring matching; 2 use a hand-rolled brace-depth heuristic that is meaningfully more robust but still not real parsing; 1 rule (`FIGM-REACT-02`) is genuinely AST-based, and only for React/Next.js source.**

**Verdict on the "AST-based, framework-independent static analysis" claim: not technically accurate as a blanket description.** It is accurate for 1 of 25 rules on 2 of 4 supported frameworks. The project's own internal audit (`docs/audit/AST_ARCHITECTURE_AUDIT.md`) independently reaches the same conclusion, in similarly blunt language. The correction propagated to `docs/dissertation/chapter4_implementation.md` (Markdown) but **not** to `docs/dissertation/chapter4_implementation.tex`, which as of this audit still states *"The FIGM static analysis engine executes **unified AST traversal**..."* — the exact overclaim the `.md` sibling and the internal audit have already retracted. If the `.tex`/compiled-PDF version is the one submitted, the correction has not reached the actual dissertation artifact.

**Test coverage is a genuine strength:** all 25 rules have positive and negative fixture tests (`tests/rule-detection-matrix.test.ts`), a documented adversarial pass found and fixed 7 false positives + 1 false negative (`docs/audit/ADVERSARIAL_DETECTION_AUDIT.md`), and the one real-AST migration (`FIGM-REACT-02`) has full positive/negative/boundary/malformed-input/regression coverage (13 tests). No hardcoded `return true` shortcuts were found inside any of the 25 detection predicates — every trigger genuinely inspects the actual input text, however weak that inspection method is.

**Remediation engine:** 100% string/regex template substitution (`src/engine/remediation-engine.ts`, `.replace()`/regex throughout, zero parser calls). Several rules (e.g. `FIGM-PERF-05`) correctly set `requiresManualReview = true` rather than risk an unsafe automated rewrite, with an explanatory comment. Both the template engine and the AI-assisted path re-scan the patched output through the same synthetic parser before accepting a patch — a real safety net operating on textual snippets, not a syntax tree.

**Stale artifact:** `figm-spec.json` (the rule catalog consumed by `/guidelines` and dissertation export) contains only **8 of 25 rules**, last generated 2026-07-29 — 17 rules were added after this artifact was last regenerated (`npm run generate-spec` not re-run).

---

## 7. FIGM Rule-by-Rule Audit

See §6 for the mechanism classification of all 25 rules. Additional per-rule notes not covered above:

- **Test coverage:** all 25 rules have both positive and negative fixture assertions (`tests/rule-detection-matrix.test.ts`); boundary/adversarial coverage exists for all 25 in `tests/qa-matrix-boundary-adversarial.test.ts`, which — notably and honestly — documents "KNOWN LIMITATION" cases for several rules rather than hiding them (e.g., `FIGM-PERF-01` flags any object literal in loop scope regardless of true invariance; `FIGM-PERF-05` still over-fires on `useCallback`-wrapped arrows because the heuristic is textual; `FIGM-A11Y-03` over-fires on any `className` starting with `"status"`).
- **Remediation coverage:** per `docs/audit/archive/FINAL_PRODUCTION_FORENSIC_AUDIT.md` (independently corroborated by this audit's own read of `remediation-engine.ts`), all 25 rules now have a dedicated, rule-specific fix case (a prior state had 11/25 rules with no case and 4 more fixing the wrong violation — those specific defects were not reproduced in the current code).
- **False-positive risk concentration:** `FIGM-A11Y-02`, `FIGM-A11Y-04`, `FIGM-REACT-04` all rely on hardcoded component-name allow-lists (`<Custom>`, `<Select>`, `<Dropdown>`, `<Modal>`, `<Dialog>`, `<Button>`, `<Card>`) — any real-world codebase using different naming conventions produces silent false negatives for these rules, undocumented in user-facing guideline text.
- **Framework-specific limitation:** `FIGM-REACT-02` (list-key stability) is the one rule with a real AST implementation, but only for React/Next.js; Vue/Angular/generic files silently fall back to the older regex check for the same rule ID, meaning "AST-based" is not even uniformly true within a single rule ID across frameworks.

---

## 8. Benchmark Forensic Audit

**Ground truth:** `benchmarks/ground-truth.json` — 19 hand-labelled violations, 4 fixture files (`ReactBenchmark.jsx`, `VueBenchmark.vue`, `AngularBenchmark.component.ts`, `VanillaJSBenchmark.js`), 8 of 25 rule IDs (`FIGM-PERF-01..04`, `FIGM-A11Y-01..04`), 4 frameworks, ~147 LOC total. Every one of the 19 labelled defects was independently confirmed present in the actual fixture source by direct reading — this is a **legitimate, non-vacuous fixture**, not fabricated, but it is small and covers only 8 of 25 rules (17 rules have zero ground-truth representation).

**Recomputation of the live pipeline** (`src/eval/evaluation-runner.ts`, re-running the real detection engine against the 4 fixtures):
- Reported: TP=19, FP=2, FN=0.
- Precision = 19/21 = **0.904762** → matches `benchmarks/eval-summary.json`'s reported `0.9047619047619048` exactly.
- Recall = 19/19 = **1.0** → matches.
- F1 = 2×0.904762×1/(0.904762+1) = **0.95** → matches reported value exactly.
- Cross-checked against a second, independently-generated file (`docs/evidence/canonical-evaluation.json`, generated ~2 hours later same day) — identical TP/FP/FN. This is genuine, reproducible, dynamically-computed engine output.

**Contradicted secondary pipeline:** `src/eval/precision-recall-engine.ts`'s `EMPIRICAL_EXPERT_GROUND_TRUTH` constant (`{tp:18, fp:3, fn:1, tn:25}`) feeds the numbers actually written into the dissertation prose (`chapter5_evaluation.md`: 85.7%/94.7%/90.0%). This is a **hardcoded literal**, not derived from `ground-truth.json`, is now stale relative to the live engine (which has since improved to 19/2/0), and its per-category breakdown table attributes 3 false positives to `FIGM-REACT-01..04` — rules that do not appear anywhere in the actual ground-truth file. The `tn: 25` figure has no defined methodology anywhere in the codebase (a different file, `app/analytics/page.tsx`, explicitly states elsewhere that true negatives are "intentionally not shown" because they aren't computed by the dynamic evaluator).

**Data leakage / self-evaluation bias:** the benchmark fixtures are hand-authored by the same team building the detection rules, and the evaluation is run against them directly — this is standard for a small illustrative benchmark but means the reported 90.5%/100%/95% cannot be generalized as evidence of real-world detection accuracy; it demonstrates the 8 covered rules correctly detect the specific patterns their own authors encoded into the fixtures.

**Recommendation stated by the domain-specialist agent, worth surfacing directly:** regenerate the dissertation chapter from the live `eval-summary.json`, delete the unsupported `EMPIRICAL_EXPERT_GROUND_TRUTH` constant and its consumers or clearly relabel them as non-empirical, and delete the fabricated `FIGM-REACT-01..04` row.

---

## 9. Independent Validation Audit

**Status: PLANNED — NOT COMPLETED, honestly disclosed.**

- `research/independent-annotation/README.md`: *"Status: Independent annotation: PENDING. No independent annotator has completed this process yet."*
- `research/independent-annotation/submissions/` is empty (zero files).
- `research/independent-annotation/results/STATUS.md`: *"No raw agreement, Cohen's kappa, or confusion matrix is reported, because none has been computed from real annotation data."*
- `scripts/compare-annotations.ts` traced end-to-end: if no submission CSV exists, it returns a "pending" report and cannot silently fabricate a result.
- `tests/inter-rater-reliability.test.ts` is explicitly labeled *"FORMULA VERIFICATION ONLY — not a FIGM research result"* and reproduces the textbook Wikipedia κ=0.40 example exactly — this validates the kappa **formula**, not any real annotation data.

This is one of the few areas of the project where every layer (README, STATUS.md, test comments, script control flow) consistently and honestly reports the same "not yet done" status. No fabrication found here.

---

## 10. Real-World Repository Evaluation Audit

**Status: NOT VERIFIED / confirmed absent.**

- No `git clone` invocation exists anywhere in scripts, tests, or CI configuration.
- The only GitHub URLs in the repository are npm dependency sources (irrelevant) and prose references in documentation.
- `benchmarks/adversarial-real-world/` contains 4 small (18–44 line) **hand-written synthetic** files, not real-world code, and is confirmed by the project's own `docs/research/GROUND_TRUTH_DOCUMENTATION.md` to be unused by any evaluation script.
- The previously-claimed "30 open-source repositories, 755k LOC" dataset's generator (`src/eval/repo-evaluator.ts`) has been deleted (commit `d69f80f2`), correctly disclosed as removed in `ResearchOverview.tsx` and `chapter5_evaluation.md` — but (see §5) a **live fallback UI path still asserts this evaluation occurred**, and `VIVA_PREPARATION_GUIDE.md`/`DISSERTATION_DEMO_GUIDE.md` still instruct the candidate to present it as real (see §21).

No evidence exists anywhere in the repository of any real open-source repository ever being cloned, scanned, or measured.

---

## 11. Human Usability Study Audit

**Status: PLANNED — NOT COMPLETED. Zero real participants.**

- `research/raw/real/`, `research/processed/real/`, `research/anonymized/real/`, `research/evidence/` all contain only `.gitkeep` placeholders.
- `data/user-study-responses.json`, referenced by `app/api/research-metrics/route.ts` and `src/docs/dissertation-exporter.ts` as the canonical "real data" path, **does not exist anywhere in the repository**.
- `research/analysis/usability-results.json` (the actual output of the real CSV-ingestion pipeline, `scripts/import-user-study.ts`) correctly reports `datasetType: "SYNTHETIC"`, `isRealHumanData: false`, `validParticipantCount: 0`.
- **Latent bug (DOCUMENTATION / IMPLEMENTATION MISMATCH) — FIXED 2026-08-14.** these were two disconnected "real data" pathways — `/api/research-metrics` watched `data/user-study-responses.json` (never populated by anything) while the actual ingestion pipeline reads/writes `research/raw/real/responses.csv` → `research/analysis/usability-results.json`. `app/api/research-metrics/route.ts` now reads `research/analysis/usability-results.json` directly and passes its full `provenance` object through. Regression-guarded by `tests/user-study-canonical-path.test.ts`. Full writeup: `docs/audit/HUMAN_STUDY_PROVENANCE_AUDIT.md` §6.
- **Ethics approval status is inconsistently characterized within the repository itself — re-verified 2026-08-14, no change needed.** `research/CONSENT_FORM.md` states `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION` (honest, unresolved) — but two now-archived documents, `docs/audit/archive/FINAL_HOSTILE_EXAMINER_AUDIT.md` and `docs/audit/archive/FINAL_HOSTILE_EXAMINER_QA.md`, assert *"Ethics approval is not required because no human subject data was collected."* Both already carry an explicit `⚠ ARCHIVED — SUPERSEDED` banner instructing readers not to cite them as current; no live document repeats the claim. The consent form's `NEEDS_VERIFICATION` remains the accurate, current status — still outstanding, not fixed by this note.
- A Google Form URL is embedded in `app/user-study/page.tsx`, indicating a form object was created — but no exported response data exists anywhere, so whether it has ever received a real submission is **NOT VERIFIED**.
- `figm-user-db.json` contains scan records for synthetic identities `P001`/`P002`/`P003` with no attached consent or survey response — almost certainly developer smoke-testing of the logging endpoint, not real study activity, but these records sit in the same production-shaped data file a real future participant P001 would collide with.
- `src/eval/user-study-evaluator.ts` retains hardcoded, internally-inconsistent Likert constants (per-question counts sum to 92, not the claimed N=85) — currently correctly gated/labeled `SYNTHETIC_PIPELINE_TEST_DATA` wherever exported, but not deleted.
- `research/README.md` still describes a "Benchmark Suite (N=30)" that contradicts the current, live 4-fixture benchmark — stale, unreconciled prose.

**Conclusion:** the specific fabrications named in commit `bbbbae77` (fake-participant seed scripts with real names, invented 84.6/100 SUS score, hardcoded client-trusted quality score) are verifiably gone from the current working tree. The underlying study itself remains entirely unexecuted, and this fact is — with the ethics-framing exception above — consistently and honestly disclosed in the live code paths, even though roughly two-thirds of the surrounding `.md` documentation corpus (see §21) still presents the pipeline's synthetic verification data as if it were a "reconciled" or "verified" real result.

---

## 12. Security Forensic Audit

All 30 `app/api/**/route.ts` routes, `src/auth/*`, `middleware.ts`, `prisma/schema.prisma`, and `src/storage/*` were independently re-verified (not assumed fixed from prior commits).

### CRITICAL

1. **A real, live-looking ADMIN refresh token and hardcoded admin password are committed to git in a file still being modified on every test/dev run.** `figm-user-db.json` is tracked by git (not in `.gitignore`), has 19+ commits touching it (most recently the same day as this audit), and currently contains a 247-character `refreshToken` for the `sanjula@nsbm.ac.lk` ADMIN account. `POST /api/auth/refresh` accepts a raw refresh token and mints a fresh ADMIN access token if it matches — no password required. `src/auth/user-db.ts`'s `getDefaultUsers()` also hardcodes the literal password `Admin123456!` for both seeded ADMIN accounts. `UserDB.updateUser()` fire-and-forget syncs refresh-token/role changes to the live Supabase/Postgres instance whenever those env vars are present, so this is not purely a stale local-file risk. **Remediation: rotate admin credentials/tokens, purge the file from git history, add it to `.gitignore`.**
2. **Hardcoded fallback JWT/refresh signing secrets** (`src/auth/auth-service.ts`) are used whenever `JWT_SECRET`/`REFRESH_SECRET` env vars are absent, and the code only refuses to boot when `NODE_ENV === 'production'` exactly — any staging/preview/self-hosted deployment with `NODE_ENV` unset silently uses a public, guessable secret, and the signing function allows a caller-controlled `role: 'ADMIN'` claim. (The currently-configured `.env`/production values appear to be real non-placeholder secrets — this is a structural code risk, not a confirmed live exploit in the current environment.)
3. **Unauthenticated cross-user IDOR on `GET /api/dashboard/reports` and `GET /api/projects`.** Both routes call `authenticateUser()` but never check its error result, then pass a possibly-`undefined` `userId` into repository functions whose contract is "no `userId` → return all records." This is a live, unauthenticated data leak of every user's project names, repo URLs, quality scores, and scan history. Notably, `app/api/search/route.ts` contains an explicit code comment warning against exactly this bug — the guard simply wasn't applied consistently to these two routes.
4. **`POST /api/scans` allows an unauthenticated caller to write forged scan records into any user's account** by supplying an arbitrary `participantId` with no format/ownership validation, and accepting `diagnostics`/`qualityScore` verbatim from the request body (no server-side re-analysis) — unlike the sibling `/api/scan` and `/api/user-study/log-scan` routes, which do validate and re-analyze.

### HIGH / MEDIUM

- Rate limiting is real (DB-backed, correctly shared across serverless instances) but every route derives client IP from an unvalidated, client-suppliable `X-Forwarded-For` header — trivially bypassed by rotating the header value per request, defeating brute-force protection on login/register/reset-password.
- Password hashing uses PBKDF2-HMAC-SHA512 with a random salt, correctly implemented, but at **10,000 iterations** — well below current OWASP guidance (≥600,000) and weaker than bcrypt/argon2id defaults.
- `GET /api/admin/users` returns every user's plaintext `apiKey` to any admin — an internal-trust decision, not a bypass, but worth tightening.
- CSV export (`exportCSV`) does not escape cells beginning with `=`/`+`/`-`/`@` — a classic formula/CSV-injection risk if opened in Excel/Sheets.

### Verified sound

- Route-level single-resource ownership checks (`projects/[id]`, `scans/[id]`, `notifications`, `export`) are implemented correctly and consistently — the pattern is right, just not applied to the two list-endpoints above.
- Admin routes (`admin/system`, `admin/users`, `audit-logs`) correctly use `authorizeRole(['ADMIN'])`/`(['ADMIN','AUDITOR'])`, not just authentication — genuine RBAC.
- CORS is a strict allow-list, never a wildcard, and never paired with `Access-Control-Allow-Credentials` — a correct, minimal policy.
- Cookies are `httpOnly`, `sameSite: 'strict'`, and `secure` in production.
- No SQL injection risk found — all Prisma calls use parameterized `where`/`data` objects.
- `.env`/`.env.local` are correctly excluded from git; only `.env.example` is tracked, and it is largely (see §15 exception) consistent with actual env var usage.

---

## 13. Database Audit

- `prisma/schema.prisma`: 11 models, consistently scoped to `userId` with `onDelete: Cascade`, `userId` indexed on high-traffic tables. The schema itself does not permit cross-user leakage at the FK level — leakage found in §12 comes from application code omitting a `WHERE userId=...` filter, not from schema design.
- **No `prisma/migrations/` folder exists.** The schema is applied via hand-run raw SQL (`docs/multi_tenant_schema.sql` imported manually into Supabase's SQL editor), not `prisma migrate deploy`. `vercel.json`'s build command only runs `prisma generate`, never a migration step — there is no enforced parity check between `schema.prisma` and the live database schema, a real drift risk.
- `AuditLog.userId` / `ResearchEvaluation.userId` are nullable with `onDelete: SetNull` — appropriate design for audit-trail retention after account deletion.
- No N+1 query patterns or missing-index issues were identified in the routes reviewed.

---

## 14. API Audit

See the full endpoint-by-endpoint table produced during the security pass (§12 covers the critical/high findings; the complete 30-route table with AuthN/AuthZ/risk per endpoint was independently verified route-by-route). Summary: input validation and error handling are generally sound and do not leak stack traces; the two unauthenticated-fallthrough IDOR bugs (§12, Critical #3) and the unvalidated-participantId write bug (§12, Critical #4) are the standout defects. Rate limiting exists on all sensitive routes but is bypassable via header spoofing (§12).

---

## 15. AI Remediation Audit

**There is a real, live implementation** — `src/ai/gemini-service.ts` issues a genuine HTTPS POST to Google's Generative Language API (`gemini-2.5-flash`) when `GEMINI_API_KEY` is set, with real prompt construction, response parsing, and — importantly — a **post-hoc re-scan of the patched code** to confirm the original violation is actually resolved before reporting success (`src/ai/ai-remediation-pipeline.ts`).

**Fallback is deterministic and disclosed:** if `GEMINI_API_KEY` is absent, or any stage of the AI call fails, the pipeline transparently falls back to the template-based `RemediationEngine`, tagging the result `engineType: 'TEMPLATE_FALLBACK'` with a human-readable reason. `tests/ai-remediation.test.ts` explicitly tests this fallback path.

**DOCUMENTATION / IMPLEMENTATION MISMATCH found by direct configuration check:** `GEMINI_API_KEY` is documented in `DEPLOYMENT.md`/`ENV_VARIABLES.md` but is **absent from `.env.example`**, and is confirmed **unset** in the current `.env`/`.env.local` (checked by name only, no values printed; confirmed by actually loading `.env` and checking `process.env.GEMINI_API_KEY` — absent). A developer following the documented `.env.example → .env` setup path (per `INSTALL.md`) will deploy a build where AI remediation silently, permanently uses the template fallback. README.md's unconditional claim — *"generates AI-assisted remediation patches via the Gemini API"* — is not accurate for an out-of-the-box setup. The `/ai-fix` page's pre-click UI copy ("⚡ Generate Gemini AI Fix") is likewise unconditional; the **post-click** result panel does honestly render the actual `engineType` and fallback reason — disclosure exists, but only after the user has already been told, before clicking, that this is a live Gemini feature.

**Conclusion:** the marketing claim of AI-powered remediation is technically true of the code as written but **UNSUPPORTED in the currently-configured production deployment** per the project's own prior audit (`docs/audit/archive/FINAL_PRODUCTION_FORENSIC_AUDIT.md`: `engineType: "TEMPLATE_FALLBACK"` confirmed live), independently re-confirmed here via direct `.env` inspection.

---

## 16. Accessibility Audit (WCAG 2.2)

**The tool's own UI visibly fails several of the exact accessibility rules it claims to detect in other people's code** — a direct credibility problem for a project whose subject matter is accessibility static analysis.

| WCAG SC | Violation | Evidence |
|---|---|---|
| 2.1.1 Keyboard / 4.1.2 Name, Role, Value | `app/notifications/page.tsx`'s notification-row `<div onClick=...>` has no `role`/`tabIndex`/`onKeyDown` — exactly what the tool's own `FIGM-A11Y-01` rule flags. The header dropdown (`HeaderBar.tsx`) does this correctly, proving the team knows the fix but applied it inconsistently. `app/user-study/page.tsx`'s task selector has the same defect. |
| 1.3.1 Info and Relationships / 4.1.2 | `app/login/page.tsx` renders `<label>` elements with no `htmlFor` paired to `<input>` elements with no `id` — exactly what `FIGM-A11Y-05` flags. A **second, parallel, correctly-labeled login page** (`app/auth/login/page.tsx`) exists but is orphaned from primary navigation; the broken page is the one linked from `Sidebar.tsx`. |
| 4.1.3 Status Messages | Zero real usages of `aria-live`/`role="status"`/`role="alert"` anywhere in `app/` (only the rule's own description text mentions these attributes) despite multiple live status transitions (scan-progress text, quality-score badge, unread-notification count) — exactly what `FIGM-A11Y-03` flags. |
| Performance / CLS (own `FIGM-NEXT-04`) | `app/globals.css` loads Google Fonts via a render-blocking `@import url('https://fonts.googleapis.com/...')` instead of `next/font` — exactly what the tool's own rule tells users to avoid. |
| 2.4.1 Bypass Blocks / 1.3.1 | `Sidebar.tsx` wraps all navigation in `<aside>` with no `<nav>` landmark and unlabeled link groups. |
| 1.4.3 Contrast (Minimum) | `--text-dim: #64748b` on `--bg: #030712` computes to ≈4.23:1, below the 4.5:1 AA threshold, used for footer copyright text and search placeholder text. |
| 2.1.1 Keyboard (total failure, mobile/tablet) | Below 1024px width, `.sidebar-desktop` is transformed off-screen and only reversible via a `.sidebar-open` class that is **never applied by any component anywhere**, and no hamburger/menu toggle exists. Primary navigation is completely unreachable on tablet/mobile by any input modality. |
| 2.3.3 Animation from Interactions | No `prefers-reduced-motion` media query exists anywhere in the codebase, despite persistent looping animations (`pulse-glow`, hover transforms) throughout the UI. |
| Misleading affordance | The header's "Settings & Theme" button is explicitly titled to promise theme control but navigates only to a settings page with no theme switcher — there is no dark/light mode anywhere in the app. |

**Positive findings (for balance):** `HeaderBar.tsx`'s own search trigger and notification bell correctly implement `role="button"`/`tabIndex`/`onKeyDown`; the accessibility page's and landing page's tab-like widgets correctly implement roving-tabindex/`aria-selected`/`aria-controls`; the `/auth/*` form cluster has fully correct label association throughout. The demo "bad code" fixtures used as scan targets are intentionally non-compliant and correctly labeled as such — not counted as real violations above.

---

## 17. Performance Audit

- `@monaco-editor/react` is statically imported at the top of `app/live-scan/page.tsx` rather than via `next/dynamic(..., { ssr: false })` — the exact anti-pattern the tool's own `FIGM-NEXT-02` rule is written to catch, applied to the tool's own heaviest page.
- `src/hooks/useNotifications.ts` polls `/api/notifications` every 10 seconds with no page-visibility check or backoff; because the consuming hook is mounted in the root layout, **every route** polls continuously, and the `/notifications` page itself re-mounts a second, unsynchronized poller — two simultaneous 10-second pollers hitting the same endpoint.
- `next.config.mjs` enables `reactStrictMode`/`swcMinify` and three security headers but has no image optimization config, no `optimizePackageImports` for `lucide-react`, and no bundle-analysis tooling.
- `npm run build` was executed live and completed successfully (55 routes generated, no type errors), confirming basic build-time performance is not currently blocked.
- No streaming/worker-based parsing exists for large files; the 2000-violation/~210KB synthetic large-file test (`tests/qa-matrix-cross-cutting.test.ts`) completes within a 15s budget, which is adequate for the current fixture scale but not evidence of scalability to very large real-world files given the line-by-line regex architecture (§6).

---

## 18–19. QA Forensic Audit & Negative/Adversarial Testing

**Live test run (verbatim, executed this session):**
```
1..38
# tests 415
# suites 66
# pass 415
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51206.7781
[exited with code 0]
```
All 415 tests across 66 suites passed. **No mocking exists anywhere in the test suite** (zero matches for `mock|Mock|jest\.|vi\.|sinon`, no test-double library in `devDependencies`) — every test, including auth/security integration tests, calls real production code: real JWT signing/verification, the real detection engine, real Next.js route handlers, and a real repository layer that visibly falls back to local JSON storage when Postgres is unreachable (observed live in the run log). This is a genuine strength: auth bugs and detector bugs cannot be hidden by a mock in this suite.

**Adversarial/negative coverage** (all confirmed present with file:line evidence): empty input, whitespace-only input, invalid/malformed syntax, very large files (2000 violations / ~210KB, 15s budget), unicode identifiers/emoji, code inside comments/strings (false-positive traps — the most extensively tested category, with 8 previously-found real bugs pinned as regression tests), deeply nested structures (20 levels), multiple simultaneous/duplicate violations, unsupported frameworks (`.svelte` degrades to zero findings rather than crashing), malformed/unclosed-brace source across all three JSX-adjacent frameworks, expired/tampered JWT (including a literal signature-bit-flip test), IDOR (extensively — real project creation + anonymous/stranger/owner access checks), and rate limiting (looped until an actual 429 is observed, not a mocked count).

**Weak spots identified:**
- `tests/json-migration.test.ts` uses a near-tautological OR-condition assertion that would pass even if the migration silently did nothing.
- `tests/evaluation-runner.test.ts` asserts precision/recall/F1 ≥ 0.8 as a loose floor rather than an exact-value regression — would not catch a regression from e.g. 0.95 to 0.81.
- `tests/qa-matrix-boundary-adversarial.test.ts` honestly documents several "KNOWN LIMITATION" cases — real, currently-unfixed false-positive classes inherent to the regex-based (non-data-flow) architecture, correctly disclosed as current behavior rather than hidden, but still open detector weaknesses.

No `.skip`/`.only`/commented-out assertions were found anywhere in the suite.

---

## 20. UI/UX Forensic Audit

See §16–17 for accessibility/performance-specific UI findings. Additional consistency issues:

- **Dead code:** `app/Header.tsx` (a full alternate header/nav component) is never imported anywhere in the app, has drifted from the live `Sidebar.tsx`/`HeaderBar.tsx` (different route labels for the same pages, e.g. "Issue Explorer" vs. live "Diagnostics").
- **Duplicate, diverging routes:** `/login` (broken labels, primary nav target) vs. `/auth/login` (correct labels, orphaned from nav) — a real user-facing inconsistency about which login surface is canonical.
- **Misleading control:** the header's theme button promises functionality that does not exist (§16).
- Demo/fixture "bad code" samples used as scan targets throughout `live-scan`, `user-study`, and `accessibility` pages are correctly and consistently labeled as intentional violations, not real bugs — not counted against the app.

---

## 21. Documentation Audit

### The "repeated final audit" pattern (methodology red flag)

The repository root contains **26 files literally named `FINAL_*.md`**, plus 14 more forensic/audit documents under `docs/audit/`, in three identifiable waves:

- **Wave 1** (~18 files, created within a 32-minute window on 2026-08-08), each independently declaring the project "VERIFIED"/"PASS"/"RECONCILED."
- **Wave 2** (2026-08-09/10), re-declaring completion with different test counts each time.
- **Wave 3** (`docs/audit/*`, 2026-08-11–13), explicitly written to **distrust Waves 1–2** — its own opening line states prior documents "are treated as unverified prior claims, not evidence" — and which itself discovered fabricated dashboard statistics, the fabricated 30-repo/755k-LOC dataset, fabricated human-study results, and unauthenticated-fallthrough IDOR that all the Wave 1/2 "zero-trust" audits had signed off on as VERIFIED.

**None of the superseded Wave 1/2 files were corrected, retracted, or flagged.** They remain live in the repository, still asserting numbers the newest audit contradicts. This is decisive evidence that the pattern is repeated premature declaration of completion, not healthy iterative rigor — and it is the exact failure mode this present audit (`audit/new.md`) has been explicitly instructed to guard against by re-verifying rather than trusting prior "final" documents.

### Falsifiable contradictions found

- **Test-count claims disagree across ~10 documents**: 35, 103 (badge says 271 eight lines above the same README's body text saying 103), 111, 112, 114, 136, 156, 272. **The actual, live-verified count is 415 tests / 66 suites** — no document in the corpus matches it.
- **Rule count disagrees**: `src/matrix/four-layer-meta-model.ts` and the live API correctly report 25 rules; `app/components/landing/ResearchOverview.tsx` still states "23 framework-independent guideline rules" (the commit that claimed to fix this rule-count typo did not fix this specific file); and **`app/guidelines/page.tsx` — the tool's own rule-book UI — structurally omits `FIGM-A11Y-03` and `FIGM-A11Y-04`**, two real, live-detecting rules, rendering only 23 entries. `FIGM_RULE_VERIFICATION.md` lists 25 rules but under stale IDs (`FIGM-REACT-05`, `FIGM-ANGULAR-01..04`) that the live engine no longer emits.
- **Vue support is marketed everywhere except the one page structurally unable to represent it**: `app/guidelines/page.tsx`'s `RuleCategory` type has no `VUE` value at all, despite README/landing copy consistently claiming 4-framework parity.
- **`VIVA_PREPARATION_GUIDE.md` and `DISSERTATION_DEMO_GUIDE.md` still actively coach the candidate to present fabricated/incorrect claims**: the viva guide's literal "Model Answer" to a rehearsed question asserts "a testbed of 30 open-source SPA repositories" — the exact dataset the codebase's own newest audit calls fabricated and removed. The demo guide instructs running `npm run eval` to "execute the 30-repository testbed" and claims "100% Precision, Recall, and F1-score across all 23 FIGM rules" — the actual live command runs a 4-fixture/19-item benchmark producing 90.5%/100%/95% (or, per the stale dissertation chapter, 85.7%/94.7%/90.0%) — neither figure is 100%, and neither dataset is 30 repositories.
- **`app/analytics/page.tsx`'s `REPO_BENCHMARKS` array** presents fabricated per-repository precision/recall for facebook/react, angular/angular, and vuejs/core, each marked `status: 'VERIFIED'` — this fabrication reached a live, user-facing UI, not only paperwork.
- **`README.md`'s "Documentation Index"** links to `file:///c:/Users/MSI/...` — absolute paths to one developer's local Windows filesystem — broken for any other clone of the repository, including a grader or CI viewer.
- **AI remediation** is presented unconditionally as active in README.md; confirmed inactive in the current default configuration (§15).
- **MSc/thesis mislabeling and the `/references` 404** — both genuinely resolved as claimed by their respective fix commits; no remaining instances found.

### Consistency matrix (abridged)

| Claim | Consistent? | Verified ground truth |
|---|---|---|
| Test pass count | No (≥8 distinct values across docs) | 415/415, 66 suites |
| FIGM rule count | No (23 vs 25) | 25 defined; UI renders 23 |
| Frameworks supported | Mostly, except guidelines page (no Vue) | 4 marketed, 1 real-AST rule for 2 |
| 30-repo evaluation | No — removed from code, still asserted real in viva/demo guides | Fabricated, confirmed removed from evaluator, residual UI fallback still asserts it |
| Precision/Recall/F1 | No — two different pipelines, two different numbers | Live: 90.5/100/95; stale dissertation: 85.7/94.7/90.0 (contradicted) |
| Human study N=85 | No — Wave 1/2 call it "verified/disclosed"; Wave 3 calls sibling artifact fabricated | 0/85 real participants, honestly reported in current code |
| AI remediation live | No — README implies active | Inactive by default configuration |
| MSc/thesis claims | Yes, resolved | Clean |
| /references 404 | Yes, resolved | Clean |

---

## 22. Production Readiness Audit

- `npm run build` was executed live and **succeeded**: type-checking passed, 55 routes generated, no errors.
- `vercel.json` correctly wires `prisma generate && next build` and links to a real, existing Vercel project.
- **No `prisma/migrations/` folder** — schema applied via manual raw SQL, not `prisma migrate deploy`; no enforced parity check in the build pipeline (§13).
- No `console.log`/`debugger` leakage found in any `app/api/**` production request path (the few `console.log` calls in `src/` are confined to CLI/research tooling never imported by API routes).
- No custom `not-found.tsx`/`error.tsx`/`global-error.tsx` exists — Next.js falls back to its generic default.
- Security headers configured: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`. **No CSP, no HSTS, no Permissions-Policy.**
- `.env`/`.env.local` correctly excluded from git; `.env.example` is largely complete except for the missing `GEMINI_API_KEY` entry (§15).
- Documented setup commands (`INSTALL.md`, `DEPLOYMENT.md`) all correspond to real `package.json` scripts.

**Production readiness is not solely evidenced by build success** (per the audit brief's own instruction) — the build succeeds, but the CRITICAL security findings in §12 (committed admin credentials, unauthenticated IDOR) mean the application is **not currently safe to deploy as-is**, independent of whether it compiles.

---

## 23. Research Traceability Matrix

| Research Question / Objective | FIGM Guideline / Rule | Implementation | Test | Dataset | Metric | Result | Evidence status |
|---|---|---|---|---|---|---|---|
| Can a framework-independent tool detect accessibility/performance/quality defects across React/Next/Angular/Vue? | 25 rules (§6–7) | `src/parser`, `src/ast`, `src/engine` | `rule-detection-matrix.test.ts` (25/25 positive+negative) | `benchmarks/testbed` (4 files, 19 items, 8 of 25 rules) | Precision/Recall/F1 | 90.5%/100%/95% (live, reproducible) | **PARTIALLY VERIFIED** — detection works for the 8 covered rules on the 4 hand-authored fixtures; 17 rules have zero ground-truth measurement; generalization to real-world code is untested (§10) |
| Is detection genuinely AST-based? | All 25 rules | `SourceParser.buildASTFromCode` | `AST_ARCHITECTURE_AUDIT.md` (internal), independently reconfirmed here | N/A | Mechanism classification | 22/25 regex, 2/25 AST-informed heuristic, 1/25 real AST (partial) | **CONTRADICTED** as a blanket claim; **VERIFIED** as accurate only for `FIGM-REACT-02`/React-Next.js |
| Does automated remediation produce safe fixes? | Remediation engine | `src/engine/remediation-engine.ts`, `src/ai/` | `remediation-coverage.test.ts`, `ai-remediation.test.ts` | N/A | Re-scan-and-confirm | Template engine functional; AI path functional but inactive by default (§15) | **PARTIALLY VERIFIED** |
| Does the tool improve on existing static-analysis tools? | Tool comparison | `src/eval/tool-benchmark.ts` | None | Hardcoded competitor latency table | Execution speed comparison | 180ms vs. 420–8400ms (claimed) | **UNSUPPORTED EMPIRICAL CLAIM** — no competitor tool was ever run |
| Is FIGM usable by real developers? | Human usability study | `research/*`, `app/user-study` | `user-study-pipeline.test.ts` | N=0 real participants | SUS, Cronbach's α | Formula-verified only, N=85 target unmet | **PLANNED — NOT COMPLETED** |
| Is the benchmark ground truth independently validated? | Independent annotation | `research/independent-annotation` | `inter-rater-reliability.test.ts` (formula only) | 0 submissions | Cohen's κ | Not computed | **PLANNED — NOT COMPLETED** |
| Was FIGM evaluated on real open-source repositories? | Real-world evaluation | (deleted) `src/eval/repo-evaluator.ts` | None | None | LOC/repo count | None | **NOT VERIFIED** (and a live UI fallback still incorrectly implies it occurred — §5) |
| Is the application secure enough for the claims made about it (production-readiness, security hardening commits)? | Auth/API/DB | `src/auth`, `app/api/**` | `api-security-audit.test.ts` (15 sub-tests, all passing) | N/A | Auth bypass/IDOR presence | 2 CRITICAL unauthenticated IDOR routes + committed admin credentials found live | **CONTRADICTED** — test suite passes but does not cover the two vulnerable routes found in this audit |

---

## 24. Academic Examiner Simulation

1. **What is FIGM's actual contribution?** A cross-framework catalog of 25 hand-specified static-analysis guidelines with a working (if largely regex-based) detection engine, a functional web application, and a genuinely rigorous adversarial test suite. The contribution is real as an engineering artifact; its claimed *methodological* novelty ("AST-based framework-independent analysis") is overstated.
2. **What makes it framework-independent?** A shared line-scanning engine applied uniformly across React/Next/Angular/Vue source — real, but achieved via lowest-common-denominator text matching, not a unifying AST abstraction (the intended convergence point, `UniversalASTMapper`, is currently a pass-through).
3. **Is the AST claim technically accurate?** No, not as a blanket claim — accurate for 1 of 25 rules, and only for 2 of 4 frameworks within that rule. See §6.
4. **How was ground truth established?** Hand-authored by the same team that wrote the detection rules, for 8 of 25 rules, across 4 small fixture files (19 items total). Legitimate as a fixture, not independently validated, not representative of full rule coverage.
5. **Who independently validated the labels?** Nobody yet — infrastructure exists and is honestly labeled PENDING (§9).
6. **How were precision/recall/F1 calculated?** Correctly, by formula, in the live pipeline (§8) — but a second, stale, hardcoded pipeline produces different numbers that are the ones actually written into the dissertation prose (§8, §21).
7. **How large was the real-world evaluation?** None exists (§10).
8. **Were real open-source repositories actually scanned?** No (§10). A prior claim that they were has been removed from the codebase but is still coached as true in exam-prep documents (§21) and still partially re-asserted by a live UI fallback (§5).
9. **How reproducible are the experiments?** The live 4-fixture benchmark is genuinely reproducible (confirmed by two independently-timestamped runs producing identical results). The dissertation-chapter numbers are not reproducible from the current codebase because they derive from a hardcoded constant, not a live run.
10. **What are the main limitations?** Regex-based detection with known, self-documented false-positive/negative classes; tiny ground-truth set covering less than a third of the rule catalog; unexecuted human study; unauthenticated IDOR on two API routes; committed admin credentials.
11. **How was usability evaluated?** It was not — target N=85, actual N=0 (§11).
12. **Was ethics approval obtained?** Not verified as obtained; the consent form itself says status is unresolved, while separate audit documents incorrectly claim it isn't needed (§11).
13. **What security testing was performed?** A genuinely substantial automated security test suite exists (15 real integration sub-tests covering JWT tampering, IDOR, rate limiting, CORS) and passes — but this audit found two live IDOR-class vulnerabilities the existing test suite does not cover, plus committed credentials the test suite has no mechanism to catch.
14. **What evidence supports the performance claims?** None for competitor comparisons (fabricated); build succeeds and passes 415 tests, which is evidence of functional correctness, not performance benchmarking.
15. **What evidence supports accessibility claims?** The detection rules exist and are tested against fixtures; the application's own UI fails several of the WCAG criteria those same rules are meant to detect (§16).
16. **Is AI remediation genuinely operational?** The code path is real; it is not active in the currently-configured default deployment (§15).
17. **Which claims are unsupported?** 30-repository/755k-LOC evaluation (removed from code, still coached as real in exam docs and residually re-asserted by a UI fallback); AI-patch success-rate statistics; competitor tool latency comparison; the dissertation's headline precision/recall/F1 figures (stale/hardcoded); "unified AST traversal" (still present in the `.tex` chapter source); "23 rules" vs. the live 25.

---

## 25. Final Findings Classification

### CRITICAL

| ID | File | Finding | Failure scenario | Impact |
|---|---|---|---|---|
| SEC-01 | `figm-user-db.json`; `src/auth/user-db.ts` | Live-looking ADMIN refresh token and hardcoded admin password (`Admin123456!`) committed to git, still modified on every run, syncs to live Supabase when configured | Anyone who clones the repo mints an ADMIN access token via `POST /api/auth/refresh` with no password | Security: full admin compromise. Research: none. QA: none. |
| SEC-02 | `src/auth/auth-service.ts` | Hardcoded fallback JWT/refresh secrets used whenever env vars absent; guard only checks `NODE_ENV==='production'` exactly | Any staging/preview/self-hosted deployment with `NODE_ENV` unset uses a public secret; attacker forges `role:'ADMIN'` JWT | Security: full auth bypass in that config. |
| SEC-03 | `app/api/dashboard/reports/route.ts`, `app/api/projects/route.ts` | `authenticateUser()` result never checked; falls through to unscoped "return all" query | Unauthenticated `curl` request returns every user's projects/scan reports | Security: unauthenticated mass data leak (IDOR). |
| SEC-04 | `app/api/scans/route.ts` | Unvalidated `participantId` + client-supplied diagnostics/score accepted without re-analysis | Attacker writes forged scan history into any known/guessed userId | Security: data-integrity IDOR. |
| BENCH-01 | `src/eval/precision-recall-engine.ts`; `docs/dissertation/chapter5_evaluation.md` | Dissertation headline P/R/F1 (85.7/94.7/90.0) hardcoded, stale vs. live engine (90.5/100/95), and one table row (`FIGM-REACT` FP=3) has zero supporting data | Examiner asks to reproduce the headline number; it cannot be reproduced from the codebase's own live pipeline | Research integrity: primary empirical claim is not reproducible / partially fabricated. |
| BENCH-02 | `src/eval/ai-patch-evaluator.ts`; `src/eval/tool-benchmark.ts` | AI patch success-rate statistics and competitor tool latency figures are hardcoded literals with no measurement, no disclaimer | Presented as measured benchmark results in dissertation text | Research integrity: unsupported empirical claims presented as fact. |
| DOC-01 | ~26 root `FINAL_*.md` + 14 `docs/audit/*` | Three waves of self-contradicting "final" audits; later waves found fabrication earlier waves marked VERIFIED; none retracted | A grader or examiner reading an earlier "FINAL" file is misled into believing settled/verified facts that a later document in the same repo contradicts | Academic integrity: methodology-process credibility; research-critical. |
| DOC-04 | `VIVA_PREPARATION_GUIDE.md`, `DISSERTATION_DEMO_GUIDE.md` | Exam-prep materials still instruct the candidate to assert the fabricated 30-repository dataset and incorrect "100%" metrics as live demo talking points | Candidate states, under oath in a viva, a claim the codebase's own audit calls fabricated | Academic integrity: direct risk of misrepresentation in a live examination. |

### HIGH

| ID | File | Finding | Impact |
|---|---|---|---|
| AST-01 | `src/parser/source-parser.ts`, `ARCHITECTURE.md`, `README.md`, `docs/dissertation/chapter4_implementation.tex` | "AST-based"/"unified AST traversal" claim inaccurate for 24/25 rules; correction reached the `.md` dissertation chapter but not the `.tex` source | Research: core methodological claim overstated in the artifact most likely to be formally submitted. |
| AI-01 | `.env.example`, `src/ai/gemini-service.ts`, README.md | `GEMINI_API_KEY` missing from `.env.example`; AI remediation silently inactive by default; README claims it unconditionally | Documentation/implementation mismatch on a headline feature. |
| DOC-02 | ~10 documents | Test-pass-count claims vary from 35 to 272 across the doc corpus; actual verified count is 415/66 | Undermines credibility of every quantitative claim in the same documents. |
| DOC-03 | `app/guidelines/page.tsx`, `ResearchOverview.tsx` | Rule count inconsistently 23 vs. 25; guidelines UI structurally omits 2 real rules; no `VUE` category exists despite Vue being marketed | User-facing product inconsistency + documentation mismatch. |
| BENCH-04 | `src/engine/dashboard-repository.ts:181-189` | Live, public, unauthenticated fallback activity feed re-asserts the disowned "30-repository evaluation" claim whenever the audit log is empty (e.g., fresh install) | A first-time visitor/examiner sees a fabricated claim the project elsewhere disclaims. |
| UX-01/UX-02 | `app/notifications/page.tsx`, `app/user-study/page.tsx`, `app/login/page.tsx` | The tool's own UI violates its own `FIGM-A11Y-01`/`FIGM-A11Y-05` rules | Credibility: an accessibility tool whose own primary login page fails basic label association. |
| UX-05 | `app/globals.css` | Primary navigation is completely unreachable below 1024px width (no working toggle exists) | Total functional failure for tablet/mobile users. |

### MEDIUM

- AST-02: `figm-spec.json` stale (8/25 rules).
- AST-04: Remediation is pure string/regex template substitution; several rules rely on narrow hardcoded component-name allow-lists causing silent false negatives.
- SEC-05: Rate limiting bypassable via spoofed `X-Forwarded-For`.
- SEC-06: PBKDF2 at 10,000 iterations, below current OWASP guidance.
- HS-02: `/api/research-metrics` and the real CSV pipeline watch two different, disconnected "real data" file paths.
- HS-03: Ethics-approval status inconsistently characterized between the consent form and two audit Q&A docs.
- DOC-05: `README.md` "Documentation Index" links are absolute `file://` paths valid only on the original author's machine.
- PROD-01: No CSP/HSTS/Permissions-Policy configured.
- PROD-02: No Prisma migration history; schema drift risk between `schema.prisma` and hand-applied SQL.
- UX-03/UX-04/UX-10: No `aria-live` anywhere despite dynamic status UI; render-blocking Google Fonts `@import`; Monaco not code-split via `next/dynamic`.

### LOW

- SEC-07: CSV export formula-injection risk (unescaped `=`/`+`/`-`/`@` prefixes).
- SEC-08: Admin route returns plaintext API keys.
- HS-04/HS-05/HS-06: Residual fabricated-shaped (but gated) Likert constants; unconsented P001-P003 smoke-test records; stale `research/README.md` N=30 claim.
- QA-02/QA-03: Near-tautological migration test; loose ≥0.8 metric floor rather than exact regression check.
- UX-06/UX-07/UX-08/UX-09/UX-11: Contrast failure on dim text token; no reduced-motion support; misleading theme-toggle button; dead `Header.tsx` and duplicate `/login` routes; duplicated notification polling.
- PROD-03: No custom 404/error pages.

---

## 26. Final Scorecard

| Category | Status | Evidence | Critical Findings |
|---|---|---|---|
| Research Integrity | **NEEDS IMPROVEMENT** | §5, §8, §21 | BENCH-01, BENCH-02, DOC-01, DOC-04 |
| Research Methodology | **NEEDS IMPROVEMENT** | §8, §9, §10, §23 | BENCH-01; ground truth covers 8/25 rules only |
| FIGM Contribution | **PASS WITH MINOR ISSUES** | §6, §7 | Real, working, well-tested detection engine; overstated mechanism claim |
| Static Analysis Engine | **PASS WITH MINOR ISSUES** | §6, §18 | Functionally solid; not AST-based as claimed |
| AST Architecture | **NEEDS IMPROVEMENT** | §6 | AST-01 |
| Rule Engine | **PASS WITH MINOR ISSUES** | §6, §7 | Full test coverage, but multiple hardcoded allow-lists |
| Benchmark | **NEEDS IMPROVEMENT** | §8 | BENCH-01; small, single-source ground truth |
| Ground Truth | **PASS WITH MINOR ISSUES** (fixture itself legitimate) | §8 | Coverage limited to 8/25 rules |
| Human Study | **NOT VERIFIED / FAIL against stated N=85 target** | §11 | 0 real participants; ethics status unresolved |
| Security | **FAIL** | §12 | SEC-01 through SEC-04 |
| API | **NEEDS IMPROVEMENT** | §12, §14 | Unauthenticated IDOR on 2 routes |
| Database | **PASS WITH MINOR ISSUES** | §13 | Schema sound; no migration history |
| QA | **PASS WITH MINOR ISSUES** | §18–19 | Strong, unmocked, real-code test suite; some tautological/loose tests |
| Performance | **PASS WITH MINOR ISSUES** | §17 | No major bottleneck found; own-rule violations in own app |
| Accessibility | **FAIL (self-referential)** | §16 | Tool's own UI fails multiple WCAG criteria its own rules detect |
| UI/UX | **NEEDS IMPROVEMENT** | §16, §20 | Broken mobile nav, dead code, duplicate routes |
| Documentation | **FAIL** | §21 | DOC-01 through DOC-05 |
| Production Readiness | **NEEDS IMPROVEMENT** | §22 | Build succeeds; critical security findings block real deployment |

---

## 27. Prioritized Remediation Plan

### Fix Immediately
- **Rotate/revoke the admin credentials and refresh token in `figm-user-db.json`; remove the file from git tracking and history; add to `.gitignore`.** Why: live credential exposure (SEC-01). Difficulty: low. Risk of inaction: full admin compromise for anyone with repo access. Priority: P0.
- **Fix `authenticateUser()` error handling in `GET /api/dashboard/reports` and `GET /api/projects` to reject unauthenticated requests instead of falling through to an unscoped query.** Why: live unauthenticated IDOR (SEC-03). Difficulty: low (mirror the existing correct pattern in `/api/search`). Priority: P0.
- **Validate `participantId` and re-derive diagnostics/score server-side in `POST /api/scans`, mirroring `/api/user-study/log-scan`'s existing pattern.** Why: cross-user data-integrity IDOR (SEC-04). Difficulty: low. Priority: P0.
- **Remove the hardcoded "30-repository evaluation" fallback entry from `dashboard-repository.ts`'s activity feed.** Why: a disowned fabrication is still live and publicly visible (BENCH-04). Difficulty: trivial. Priority: P0.

### Fix Before Dissertation Submission
- **Regenerate `docs/dissertation/chapter5_evaluation.md`/`chapter5_empirical_validation_and_benchmarks.md` from the live `benchmarks/eval-summary.json` (19/2/0, 90.5/100/95), deleting the hardcoded `EMPIRICAL_EXPERT_GROUND_TRUTH` constant and the unsupported `FIGM-REACT` FP=3 row.** Why: the headline empirical claim is currently unreproducible (BENCH-01). Research benefit: restores reproducibility, the single most examinable property of an empirical claim. Priority: P0.
- **Delete or explicitly, visibly label as illustrative the `AIPatchEvaluator` and `TOOL_COMPARISON_MATRIX` hardcoded figures before they reach any submitted chapter.** Why: unsupported empirical claims (BENCH-02). Priority: P0.
- **Correct `docs/dissertation/chapter4_implementation.tex` to match the already-corrected `.md` sibling's honest "pattern-based, growing genuine-AST subset" language.** Why: the formal dissertation source still contains the retracted "unified AST traversal" overclaim (AST-01). Priority: P0.
- **Rewrite or clearly retire `VIVA_PREPARATION_GUIDE.md` and `DISSERTATION_DEMO_GUIDE.md`** so they no longer instruct the candidate to present the fabricated 30-repository dataset or an incorrect 100%-across-the-board metric as a live demo/exam answer. Why: direct risk of misrepresentation under examination (DOC-04). Priority: P0.
- **Reconcile or archive the ~26 root `FINAL_*.md` files** — either delete them, or prominently mark each superseded-by-`docs/audit/*`, so no reader can cite a retracted "VERIFIED" claim as current. Why: DOC-01 is a standing academic-integrity liability as long as those files remain unflagged. Priority: P1.
- **Resolve the ethics-approval framing conflict** between `research/CONSENT_FORM.md` (`NEEDS_VERIFICATION`) and the two audit documents claiming approval is "not required" — settle on one accurate statement before any real participant is recruited. Priority: P1 (P0 if recruitment is imminent).

### Fix Before Final Demo
- Fix the `app/login/page.tsx` label-association defect (point users at the already-correct `/auth/login` implementation, or fix labels directly) and the clickable-`<div>` keyboard-access defects in `notifications`/`user-study` pages — these are exactly the class of bug the tool exists to catch, appearing in the tool's own primary auth flow. Priority: P1.
- Implement a working mobile/tablet navigation toggle (`.sidebar-open` is currently dead CSS) — the app is currently unusable below 1024px width. Priority: P1.
- Add `GEMINI_API_KEY` to `.env.example` and adjust `/ai-fix` UI copy to be conditional on key presence, or clearly state "demo mode" pre-click. Priority: P2.
- Reconcile the 23-vs-25 rule count everywhere it appears, and add a `VUE` category to `app/guidelines/page.tsx`. Priority: P2.

### Recommended Improvements
- Regenerate `figm-spec.json` (currently 8/25 rules) via `npm run generate-spec`.
- Harden rate limiting against `X-Forwarded-For` spoofing (trust only a known reverse-proxy-provided header).
- Raise PBKDF2 iteration count toward current OWASP guidance, or migrate to bcrypt/argon2id.
- Add CSP/HSTS/Permissions-Policy headers.
- Add `prisma migrate` history and a build-time schema-parity check against `docs/multi_tenant_schema.sql`.
- Escape CSV export cells beginning with `=`/`+`/`-`/`@`.
- Fix the `/api/research-metrics` vs. real CSV-pipeline file-path mismatch for human-study data (HS-02) before it causes a silent zero-report on real collected data.
- Add `aria-live` regions to genuinely dynamic status UI; add `prefers-reduced-motion` handling; fix the sub-AA contrast token.
- Delete dead `app/Header.tsx` and consolidate the duplicate `/login` vs `/auth/login` routes.

### Optional Future Work
- Expand ground-truth benchmark coverage beyond 8 of 25 rules.
- Pursue the real-AST migration (`FIGM-REACT-02`'s pattern) for additional rules, prioritizing the highest-false-positive-risk ones (`FIGM-REACT-03`, `FIGM-A11Y-01`).
- Execute the human usability study and independent-annotation process now that the pipelines are honestly scaffolded and ready.
- Conduct an actual (small, disclosed) real-world open-source repository evaluation to replace the removed fabricated one.

---

## 28. Final Verdict

- **Software Engineering:** NEEDS MINOR IMPROVEMENT. The application builds cleanly, has an unusually rigorous, unmocked test suite (415/415 passing), and a genuinely functional (if architecturally weaker-than-claimed) analysis engine. Undermined by two live IDOR vulnerabilities and committed admin credentials.
- **Research Quality:** NEEDS MAJOR IMPROVEMENT. The core empirical claim (precision/recall/F1) is not reproducible from the artifact most likely to be submitted; exam-prep materials still coach fabricated claims; a three-wave history of self-contradicting "final" audits has not been reconciled.
- **Static Analysis Quality:** NEEDS MINOR IMPROVEMENT. Functionally solid and well-tested; the "AST-based" framing is a genuine overclaim for 24 of 25 rules.
- **Security:** NEEDS MAJOR IMPROVEMENT. Two live, unauthenticated IDOR routes and a git-committed admin credential are disqualifying for any production or public-facing use until fixed.
- **QA:** NEAR FINAL. This is the strongest area of the project — real, unmocked, adversarial-aware testing with honest self-documentation of known limitations.
- **Accessibility:** NEEDS MAJOR IMPROVEMENT. The tool's own UI fails several of the exact rules it is built to detect.
- **Performance:** NEEDS MINOR IMPROVEMENT. No major bottlenecks found; some avoidable inefficiencies (unbounded polling, non-split heavy editor bundle).
- **Production Readiness:** NEEDS MAJOR IMPROVEMENT. Build and deploy pipeline are sound; the security findings make current deployment unsafe regardless of build success.

### Overall Verdict: **NEEDS MAJOR IMPROVEMENT**

The project demonstrates genuine engineering substance — a real, tested detection engine; a real (if currently dormant-by-default) AI remediation path; a database and auth layer that is mostly sound; and, notably, a test suite whose rigor and honesty about known limitations exceeds much of the surrounding documentation. It is not ready for submission or production deployment in its current state because of (a) two live, unauthenticated data-leak vulnerabilities and a committed admin credential, and (b) a research-narrative layer — spanning the dissertation chapters, viva-prep material, and ~26 unretracted "final" audit documents — that has not caught up with what the code and data actually show. Both categories are fixable without architectural rework; neither should be treated as resolved until independently re-verified again after the fixes land, given this repository's own demonstrated history of declaring issues fixed prematurely.

---

# AUDIT SUMMARY

- **Total findings:** 40
- **Critical findings:** 9 (SEC-01, SEC-02, SEC-03, SEC-04, BENCH-01, BENCH-02, DOC-01, DOC-04, plus the compounding production-readiness implication of SEC-01–04 in §22)
- **High findings:** 7 (AST-01, AI-01, DOC-02, DOC-03, BENCH-04, UX-01/UX-02, UX-05)
- **Medium findings:** 10 (AST-02, AST-04, SEC-05, SEC-06, HS-02, HS-03, DOC-05, PROD-01, PROD-02, UX-03/04/10)
- **Low findings:** 14 (SEC-07, SEC-08, HS-04, HS-05, HS-06, QA-02, QA-03, UX-06, UX-07, UX-08, UX-09, UX-11, PROD-03, plus minor stale-artifact items)
- **Research-critical findings:** BENCH-01, BENCH-02, DOC-01, DOC-04, AST-01 — the dissertation's headline metric is not reproducible, exam-prep materials coach fabricated claims, and a three-wave audit-contradiction history remains unreconciled.
- **Security-critical findings:** SEC-01, SEC-02, SEC-03, SEC-04 — committed admin credentials plus two live unauthenticated IDOR routes.
- **QA-critical findings:** none rise to critical; the test suite is the project's strongest area, though it does not currently cover the two IDOR routes found in this audit.
- **Documentation mismatches:** test-count (10+ conflicting values), rule-count (23 vs. 25), AI-remediation activity, human-study status across audit waves, `.tex` vs. `.md` dissertation chapter drift, README's non-portable links.
- **Unsupported empirical claims:** AI-patch success-rate statistics, competitor-tool latency comparison, the dissertation's hardcoded confusion-matrix-derived P/R/F1 figures.
- **Verified strengths:** a genuinely reproducible live benchmark pipeline (90.5%/100%/95%, independently recomputed and cross-run-verified); an unmocked, adversarial-aware, 415/415-passing test suite; honest, consistent PENDING labeling of the human-study and independent-annotation systems at the code/data layer; correct, consistent auth ownership checks on all single-resource API routes; a real (if dormant-by-default) AI remediation integration with genuine post-hoc safety re-verification; a clean production build.
- **Top 10 actions required:**
  1. Rotate/revoke committed admin credentials in `figm-user-db.json`; purge from git; gitignore it.
  2. Fix the two unauthenticated-fallthrough IDOR routes (`/api/dashboard/reports`, `/api/projects`).
  3. Validate `participantId` and server-side re-derive scores in `POST /api/scans`.
  4. Remove the live "30-repository evaluation" fallback claim from the dashboard activity feed.
  5. Regenerate the dissertation's Chapter 5 headline metrics from the live evaluator; delete the hardcoded confusion matrix and the unsupported `FIGM-REACT` FP row.
  6. Remove or clearly label the fabricated AI-patch and tool-comparison statistics.
  7. Correct the `.tex` dissertation source's "unified AST traversal" claim to match the already-corrected `.md` chapter.
  8. Rewrite `VIVA_PREPARATION_GUIDE.md`/`DISSERTATION_DEMO_GUIDE.md` to stop coaching fabricated claims.
  9. Reconcile or clearly retire the ~26 unretracted "FINAL" audit documents.
  10. Fix the tool's own accessibility violations (unlabeled login form, keyboard-inaccessible controls, unreachable mobile navigation) before presenting it as an accessibility-analysis tool.
