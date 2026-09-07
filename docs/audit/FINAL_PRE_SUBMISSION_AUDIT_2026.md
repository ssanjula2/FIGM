# FIGM — Final Pre-Submission Forensic Audit

**Date:** 2026-09-07
**Scope:** Full repository + research + production-readiness audit on `main`, including uncommitted working-tree state.
**Method:** Read-only. No code changes, no commits, no pushes, no deploys, no database mutations were performed. `tsc`, the full local test suite, and a local production build were executed as explicitly permitted "if safe" — all three completed cleanly and are reported below. Five parallel research passes plus this session's own direct verification were used to cross-check every claim against actual source, test output, and existing (previously-generated) audit artefacts already in the repo. Two of five parallel research agents hit a platform rate limit mid-run; their sections were completed directly by this session instead, using the same evidentiary standard.

**Standing instruction honored throughout:** this project has a documented history of fabricated benchmark/research data (see prior sessions' own audit trail, e.g. `THESIS_BLOCKER_RESOLUTION.md`, `FINAL_THESIS_CONSISTENCY_AUDIT.md`). Every claim below is either independently re-derived from source/test output in this session, or explicitly marked as **secondhand** (sourced from a prior session's document, not re-verified live by this one). Nothing is estimated or invented.

---

## 1. Executive Summary

FIGM is materially further along than a typical final-year submission: 50 canonical rules with real AST-based detection across React/Next.js/Angular/Vue, a genuinely three-stage-validated AI remediation pipeline (deterministic-first → AI-assisted → sandboxed re-scan), 1,659 passing tests, a clean type-check, a clean production build, and — unusually for a project with this history — an extraordinarily rigorous, already-in-place internal self-audit trail (`research/thesis/*`) that independently reaches the same conclusions this audit reaches when checked against source.

The blockers are not "is the science real" — it is. They are **operational and current**: as of *today* (2026-09-07), production admin login is broken with an unconfirmed root cause (likely two Vercel projects pointing at different Supabase databases), and as of 2026-08-18 both admin accounts still authenticate with a live, unrotated default password that was once committed to git history. Since the human-study consent gate is admin-only, the admin-login break directly blocks starting real data collection right now, independent of code quality. Working-tree state also has 26 modified + 25 untracked files — real, necessary work (a genuine production bugfix, new tests, new research exports) that has not yet been committed.

**Bottom line:** the underlying engine, AI pipeline, and research methodology are submission-quality and well-evidenced. The project is **not yet safe to freeze or start real participant collection** until the P0 items in §20 are resolved — all of which are small-to-medium, well-understood fixes, not open research problems.

---

## 2. Current Repository State

```
HEAD_SHA=7819e191641611121fe5d54a3eaef0f79ade7ef2
BRANCH=main (up to date with origin/main)
STAGED_CHANGES=0
MODIFIED_FILES=26 (unstaged)
UNTRACKED_FILES=25 (incl. 2 new directories)
```

### Modified (unstaged) — classification

| File | Change | Classification |
|---|---|---|
| `src/parser/vue-sfc-parser.ts` (+52) | Adds `assertSingleVueSfcStructure()` — shared, independently-auditable duplicate-SFC guard | **REQUIRED_BEFORE_SUBMISSION** — real hardening for the Vue duplicate-SFC bug |
| `src/ai/patch-validator.ts` (+14) | Uses the new shared guard instead of a direct `parseVueSfc` call | **REQUIRED_BEFORE_SUBMISSION** |
| `src/ai/sandbox-validation-pipeline.ts` (+18) | Same shared guard used at the heavy sandbox gate — removes duplicated logic | **REQUIRED_BEFORE_SUBMISSION** |
| `src/engine/participant-repository.ts` (+194/-x) | Same-row enrollment fix + post-write re-read verification (never report fake success) | **REQUIRED_BEFORE_SUBMISSION** — real production logic bug fix, already covered by a dedicated regression test |
| `src/storage/supabase-storage-provider.ts` (+8) | `.trim()` on email lookup (admin-login investigation fix) | **REQUIRED_BEFORE_SUBMISSION** |
| `src/auth/user-db.ts` (+4) | Same `.trim()` fix, JSON backend | **REQUIRED_BEFORE_SUBMISSION** |
| `src/engine/dashboard-repository.ts` (+10) | Minor, part of the same fix set | **REQUIRED_BEFORE_SUBMISSION** |
| `src/eval/evaluation-runner.ts`, `src/eval/thesis-gap-exporter.ts` (+14/+12) | Small evaluation/export adjustments | **REQUIRED_BEFORE_SUBMISSION** |
| `tests/research-gap-eval.test.ts`, `tests/research-integrity.test.ts` (+15/+20) | Test updates matching the above | **REQUIRED_BEFORE_SUBMISSION** |
| `package.json` (+3/-2) | Registers 7 new test files into the default `npm test` script + a new `research:export-analysis` script | **REQUIRED_BEFORE_SUBMISSION** — without this, new tests silently never run in CI |
| `benchmarks/*`, `docs/evidence/canonical-evaluation.json`, `docs/migration-report.json`, `docs/reports/*`, `public/eval-results/*`, `docs/validation-report.md` | Regenerated evaluation/benchmark output (small diffs, current data) | **SAFE_TO_LEAVE_UNCOMMITTED** short-term, but should be committed together with the code changes that produced them to keep evidence and code in sync |
| `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md`, `chapter5_evaluation.tex` | Content corrections from this project's own audit passes | **REQUIRED_BEFORE_SUBMISSION** |
| `docs/dissertation/chapter6_conclusion.md`, `chapter6_user_study_and_validity.md` (deleted) | Superseded by the untracked `chapter6_results_and_conclusion.md` | **REQUIRED_BEFORE_SUBMISSION** (the deletion + new file must be committed together, not left split) |
| `research/independent-annotation/results/STATUS.md`, `research/thesis/CHAPTER_05_TESTING_EVALUATION_AUDIT.md` | Status/audit refresh | **REQUIRED_BEFORE_SUBMISSION** |

### Untracked — classification

| File/dir | What it is | Classification |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` | Agent tooling instructions (harness-level, not research content) | **SHOULD_COMMIT** (or intentionally leave untracked if the project deliberately excludes tool config — not a research-integrity concern either way) |
| `docs/audit/ADMIN_LOGIN_RECOVERY_ROOT_CAUSE.md`, `docs/audit/FINAL_PRODUCT_END_TO_END_AUDIT.md` | Real, dated (2026-09-06/07) prior audit evidence, cited throughout this report | **REQUIRED_BEFORE_SUBMISSION** — this is exactly the kind of evidence a reproducibility-minded examiner would want preserved in history, not left as an ephemeral local file |
| `docs/dissertation/archive/*.SUPERSEDED-*.{md,tex}` | Explicitly-named superseded originals, kept for traceability | **SHOULD_COMMIT** — the naming convention itself signals intent to preserve, not discard |
| `docs/dissertation/chapter6_results_and_conclusion.md` | The real, current Chapter 6 (replaces the two deleted files above) | **REQUIRED_BEFORE_SUBMISSION** |
| `docs/generated/` (2 files) | Auto-exported chapter copies from `research:evaluate`/`npm run eval` | **SHOULD_DELETE or .gitignore** — these are a build artefact of the exporter, not source; committing them risks exactly the kind of stray-duplicate-file residual risk this project's own `FINAL_THESIS_CONSISTENCY_AUDIT.md` already flags (§7 of that document) |
| `docs/research/REAL_HUMAN_STUDY_ANALYSIS.md`, `docs/research/exports/` (10 files) | The real, honest (zero-fabrication) human-study analysis output | **REQUIRED_BEFORE_SUBMISSION** |
| `research/thesis/CHAPTER_05_TESTING_AND_EVALUATION.md`, `CHAPTER_05_TESTING_TRACEABILITY.md`, `CHAPTER_06_RESULTS_AND_CONCLUSION.md`, `CHAPTER_06_RESULTS_CONCLUSION_AUDIT.md`, `CHAPTER_06_RESULTS_TRACEABILITY.md`, `FINAL_THESIS_CONSISTENCY_AUDIT.md` | This project's own rigorous internal audit trail — independently checked against source in this pass and found accurate | **REQUIRED_BEFORE_SUBMISSION** — valuable, real evidence of process rigor; an examiner benefits from seeing this |
| `scripts/export-research-analysis.ts`, `src/eval/research-analysis-exporter.ts` | The real exporter that produces the honest, zero-fabrication analysis above | **REQUIRED_BEFORE_SUBMISSION** |
| `tests/admin-login-recovery-regression.test.ts`, `tests/dashboard-storage-provider-path.test.ts`, `tests/research-analysis-exporter.test.ts`, `tests/study-live-scanner-integration.test.ts`, `tests/thesis-exporter-canonical-guard.test.ts`, `tests/vue-remediation-minimal-patch.test.ts` | New regression tests, all registered in `package.json` and all passing (see §5) | **REQUIRED_BEFORE_SUBMISSION** |

**No secrets found in any tracked or staged file** (repo-wide pattern sweep for API-key/PEM/connection-string shapes, zero hits in the current tree). `.env`/`.env.local`/`figm-user-db.json` are correctly `.gitignore`d going forward. **However**, see §15 — git *history* (not the current tree) still contains real historically-committed secrets, an open item.

**Dead code / TODO sweep:** only 3 TODO-shaped hits in `src/`, all the same literal placeholder string (`'TODO: describe this field'`) used as an aria-label fallback by the deterministic accessibility fixer (`src/engine/ast-fix-engine.ts:337`, `src/engine/remediation-engine.ts:335,342`) — not abandoned work, but a real UX quality note (§20, P2).

---

## 3. Build / Test / Type Safety

```
TSC=PASS (0 errors)
TESTS=PASS (1659 / 1659 passed, 0 failed, 0 cancelled, 0 skipped; 109 suites; 382.4s)
LOCAL_BUILD=PASS (exit 0; 56/56 routes generated; TypeScript check inside build: 3.8s)
VERCEL_BUILD=NOT INDEPENDENTLY VERIFIED — no Vercel CLI/API access in this environment; see §15 for the one directly relevant, dated document (production admin login currently broken)
KNOWN_FAILING_TESTS=none
FLAKY_TESTS=none observed in this run
TESTS_TOUCHING_PRODUCTION_DB=ZERO — independently confirmed: the default `npm test` script never sets `DATABASE_URL`/`SUPABASE_URL` (`process.env.DATABASE_URL` verified `UNSET` in this session's shell), so `RepositoryFactory` always falls back to disk-file-backed `JsonStorageProvider`; the test-fixture user store (`UserDB`) is *always* a local JSON file, never Postgres, regardless of environment. A live Supabase check from a prior session (`docs/audit/PRE_STUDY_SYNTHETIC_DB_RESIDUE_AUDIT.md`, 2026-09-04) independently corroborates zero synthetic/test rows in production at that time (**secondhand**, not re-run live this session).
```

The prior recorded full-suite figure was 1,526/1,526 (`CHAPTER_05_TESTING_EVALUATION_AUDIT.md`); the current 1,659 reflects the 7 new test files registered in this session's uncommitted `package.json` diff, all passing.

---

## 4. FIGM Engine

```
RULE_COUNT=50 (verified: 50 unique ruleId entries in src/matrix/four-layer-meta-model.ts, zero duplicates)
DOMAIN_SPLIT (primaryResearchDomain, verified by a passing dedicated test — "partitions all 50 rules into exactly three non-overlapping buckets summing to 50"):
  ARCHITECTURE = 19
  STATIC_PERFORMANCE = 24
  ACCESSIBILITY = 7
RULE_SET_VERSION=2.1.0 (per generateMasterSpecification() and Chapter 3/6)
```

Framework/rule-ID breakdown by prefix: PERF-06, A11Y-07 (universal/common rules), NEXT-10, REACT-11, ANG-10, VUE-06 = 50.

**Architecture is sound and single-sourced**: `RULE_CATALOG` (`src/matrix/rule-registry.ts`) is explicitly documented as reshaping `FOUR_LAYER_MAPPINGS` rather than hand-maintaining a second list, and `RuleCategory` (framework-display bucket: COMMON/NEXTJS/REACT/ANGULAR/VUE) is kept deliberately distinct from `DomainType`/`primaryResearchDomain` (the formal PERFORMANCE/ACCESSIBILITY taxonomy axis and the research-facing three-way split) — a real, well-documented design decision, not an accidental inconsistency.

**Parser/framework detection**: real AST-based (not text-heuristic) for React/Next.js (Babel/TS AST), Angular (`angular-html-parser`), and Vue (`@vue/compiler-sfc`/`@vue/compiler-dom`) — confirmed via the passing `angular-template-ast`, `vue-template-ast-detection`, and `ast-detection-rules` test suites. Svelte is detected at the file-extension level but explicitly *not* marketed/documented as supported (`tests/svelte-unsupported.test.ts`, `SUPPORTED_FRAMEWORKS` excludes it).

**Real-world false-positive patterns — found, and honestly disclosed by the project's own spot-check** (`benchmarks/real-world/SPOT_CHECK.md`, n=18 hand-verified findings, explicitly *not* claimed as a representative precision figure):
- `FIGM-REACT-03` (state-mutation-in-render) fired on `Button.defaultProps = {...}` (idiomatic `defaultProps`, no `useState` in the file) and on a plain CommonJS `module.exports = ...` in a Karma config — the detector appears to match any `Identifier.property = value` assignment shape without confirming the target is actual component state. Matches this session's prior memory of "FIGM-REACT-03/01 false-positive patterns."
- Several "TP (narrow)" cases where the formal predicate is technically satisfied but the rule's plain-English name/remediation text implies a scope (a loop, a render cycle) that doesn't actually apply at the flagged location — a real-world generalization gap, disclosed rather than hidden.

**Quality-score / severity assignment**: not independently re-derived line-by-line in this pass beyond what the passing `quality-score.test.ts`/`header-quality-score-truth.test.ts` suites already assert; no hardcoded/fabricated constants were found standing in for computed values in the files read.

**No claim of full WCAG conformance found anywhere active** — `WCAG_2_2` traceability entries carry per-rule `automatedDetectability` classifications (`DIRECT_STATIC_CHECK`/`PARTIAL_STATIC_CHECK`/`HEURISTIC`/`MANUAL_REVIEW_REQUIRED`/`NOT_SUPPORTED`), and every occurrence of "WCAG 2.2 AA"/"full WCAG" across the six dissertation chapters is either an explicit non-claim disclaimer or a correctly-attributed description of cited literature (independently confirmed by this project's own `FINAL_THESIS_CONSISTENCY_AUDIT.md` §12, cross-checked against source by the research-methodology pass this session).

---

## 5. AI Remediation

*(Full detail: independent agent report, reproduced in condensed form — the agent independently ran the relevant test files rather than only reading them.)*

**Architecture verified real, not documentation-only**: `AIRemediationRouter` routes by rule ID → `decideRemediation()` actually executes the routed deterministic engine against the real defect instance and only narrows to AI-assisted if it genuinely declines → `AIRemediationPipeline`'s three paths (deterministic / manual-review / AI-assisted with bounded retry) match their own header comment → `SandboxValidationPipeline` runs a real six-stage gate (ISOLATION → SYNTAX → PATCH_SCOPE → FRAMEWORK_STRUCTURAL → COMPILE_AND_RESCAN → TEST) in isolated temp directories, never against the live project tree.

**Providers**: Claude (primary, `ANTHROPIC_API_KEY`), Gemini (fallback, `GEMINI_API_KEY`), Ollama (dev-only, local). **"Qwen" is not a separate provider** — it is only the default *model tag* (`qwen2.5-coder:7b`) the dev-only Ollama provider requests. No `qwen-provider.ts` exists. This distinction is drawn precisely and consistently everywhere in current documentation (independently confirmed by two separate passes this session).

**Deterministic-first**: real, not aspirational — three real engines (`ast-fix-engine.ts`, `angular-template-fix-engine.ts`, `vue-fix-engine.ts`) with disjoint rule-ID ownership, genuinely invoked and only narrowed to AI-assisted on an actual per-instance decline.

**Minimal-patch enforcement**: a real LCS-based line-change-ratio heuristic (60% ceiling, `sandbox-validation-pipeline.ts`), honestly documented as a heuristic rather than a semantic diff.

**Retry logic**: `MAX_AI_ATTEMPTS=3`; confirmed by direct test execution that the original source is never mutated across retries and previously-rejected candidates are never re-embedded into a later prompt (only their failure reason is) — no state accumulation.

**Original source preserved on rejection**: every failure branch returns the untouched input `code`; sandbox writes only to `fs.mkdtempSync` temp dirs, cleaned up in `finally`.

**`AiHistory.applied=true` semantics**: directly wired to the pipeline's own `verified` boolean (only true after the full sandbox+re-scan chain passes) — not set merely because a candidate patch existed.

**Vue duplicate-SFC bug — CRITICAL RE-AUDIT RESULT: genuinely fixed, verification substantially complete.** HEAD (`7819e191`) closed an early-rejection/observability gap (the cheap pre-filter previously missed what the heavier sandbox gate already caught); the uncommitted working-tree diff adds real further hardening — a single shared `assertSingleVueSfcStructure()` used identically by both the cheap pre-filter and the sandbox's `FRAMEWORK_STRUCTURAL` stage, eliminating any risk of the two drifting apart. **This session directly executed** (not merely read) `tests/vue-remediation-minimal-patch.test.ts` (15/15 pass, including exact reproduction of the reported `</script><template>` concatenation artifact against FIGM-A11Y-01, plus FIGM-PERF-02), `tests/vue-sfc-duplicate-patch-rejection.test.ts`, and 46 further sandbox/parser/prompt-builder regression tests — all passing. One cosmetic-only issue: a stale comment in `patch-validator.ts` still references the old direct `parseVueSfc` call after the refactor to the shared helper (§20, P2).

**Per-framework AI-fix test-depth asymmetry (real, not fabricated)**: React and (post-fix) Vue have full end-to-end mocked-provider pipeline tests (retry, telemetry). Angular is proven only at the sandbox-gate level (`ANGULAR_TEMPLATE` structural ACCEPT/REJECT), not through the full retry/telemetry pipeline with a mocked provider. No test tagged explicitly `NEXT_JS` was found exercising the full mocked-provider pipeline either (Next.js shares the React AST engine, so the underlying mechanism is exercised, just not framework-tagged end-to-end). This is a real test-coverage gap, not evidence the feature doesn't work (§20, P2).

**Auth/session-refresh interaction** (commits `9f987203`, `841163cb`): a proactive silent-refresh timer (5 min before the 1-hour access-token expiry) closes a real, production-log-evidenced gap where long-open Live Scan sessions silently lost fix-telemetry attribution after token expiry. Both the login-time `sessionClient.recordSession()` and the app-mount `sessionClient.init()` wiring are present together (neither alone would have closed the gap) — confirmed by direct test execution of `session-client.test.ts` and `session-refresh-ai-history-integration.test.ts`.

---

## 6. Framework Support Summary

```
REACT_STATUS=Real AST detection, full deterministic + AI-fix pipeline, strong test depth. Known FP pattern on FIGM-REACT-03 (assignment-shape over-match) disclosed in the project's own spot-check.
NEXTJS_STATUS=Real AST detection (shares React engine + Next-specific rules). AI-fix mechanism structurally present; no framework-tagged full-pipeline mocked test found (test-depth gap, not a functional gap).
ANGULAR_STATUS=Real template AST detection. AI-fix proven at the sandbox-gate level; full retry/telemetry pipeline not proven end-to-end with a mocked provider (test-depth gap).
VUE_STATUS=Real AST detection (compiler-sfc/compiler-dom). Additional implementation support (not one of the three primary research frameworks), consistently stated as such everywhere checked. Duplicate-SFC regression genuinely fixed and the most thoroughly tested framework in this pass.
```

---

## 7. Live Scan / Product Flow

*(Independently verified by a completed research agent; key points below.)*

End-to-end trace confirmed in source: login/register → hardened-cookie session (`httpOnly`, `sameSite:'strict'`, `secure` in production — confirmed on all four cookie-issuance sites) → middleware page gate (`/live-scan` requires login for the UI, though the underlying `/api/scan` route itself allows anonymous callers) → framework detection → AST analysis → optional persistence → deterministic/AI fix → sandbox re-verification.

Verified directly: malformed/missing request bodies return a clean `400` (not a 500); 500KB code-size cap (`413` on excess); layered rate limiting (60/min scan, 15/min fix per IP, **plus** a second independent per-client-fingerprint limit on fix/AI actions specifically, defeating simple IP rotation); logout genuinely revokes already-issued tokens via a DB `tokenVersion` check, not just client-side cookie clearing; parser failures become a `SYNTAX-PARSE-ERROR` diagnostic rather than a thrown exception; the dynamic profiler (which executes submitted code for runtime measurement) runs in a **separate spawned child process**, never in-process, under any failure mode.

**A prior audit's finding was checked and found stale, corrected here**: `docs/audit/FINAL_PRODUCT_END_TO_END_AUDIT.md` (2026-09-06) flagged cookie hardening as unverified and `next@^14.1.0` (~20 unresolved advisories) as a P1. Both are now resolved — cookie hardening is directly confirmed present, and `package.json` currently pins `next@^16.3.4` (upgraded in a separate, already-committed `bab8c770` commit, which also removed the unused `openai` dependency in the same pass). **`npm audit` was not run this session** against the current dependency tree — flagged as PENDING, not claimed clean (§20, P2).

---

## 8. Research Participant Flow

```
PARTICIPANT_TARGET=20 (P001-P020), hard-capped in code (enrollAuthenticatedUserAsParticipant throws once all 20 slots are taken — not just a documentation target)
SAME_ROW_ENROLLMENT=fixed (commit ac2bac9d) with a real post-write re-read verification guard added in the same commit ("never report a fake success" — backed by a dedicated fake-provider test)
CONSENT_GATE=structural, admin-only path to CONSENT_VERIFIED; the research-dataset eligibility filter requires participantCode in-range AND status===CONSENT_VERIFIED AND a non-null verification timestamp AND scan.createdAt >= that timestamp
QA/TEST_EXCLUSION=two independent, non-overlapping mechanisms — a persisted accountType flag for general admin-aggregate exclusion, and a P001–P020 range guard (structurally excludes any QA-fixture code) for the research dataset specifically
```

**Real, unaddressed residual risk**: enrollment is idempotent per authenticated *account*, not per human. Nothing in `register`/`enroll` prevents one person from creating two accounts and obtaining two participant codes — this relies entirely on manual admin review during consent verification. Not a code defect exactly, but a genuine gap worth closing (or at minimum documenting as a manual-review responsibility) before real collection begins (§20, P1).

**Current actual state (most recent recorded evidence, generated 2026-09-07T08:55:07Z — not independently re-queried live against production this session):**

```
REAL_PARTICIPANTS_ENROLLED=1 (P001)
QA_PARTICIPANTS=not enumerated this pass; excluded from the research dataset by range guard regardless of count
PRE_CONSENT=1 (P001, ASSIGNED, consent not yet verified)
CONSENT_VERIFIED=0
ELIGIBLE_PRIMARY=0
SECONDARY=0
```

No real human-study data has been collected as of the most recent recorded evidence. The exporter honestly reports `NOT_AVAILABLE`/`0`/`PENDING` throughout rather than inventing plausible-looking numbers — independently confirmed by reading `docs/research/REAL_HUMAN_STUDY_ANALYSIS.md` directly this session.

---

## 9–13. Research Methodology (RQ1–RQ4, Internal Benchmark, Human Study, Questionnaire)

All figures below were independently re-derived this session from `research/thesis/THESIS_BLOCKER_RESOLUTION.md` (which itself documents re-deriving them from raw JSON, not copying a prior report), `docs/dissertation/chapter6_results_and_conclusion.md`, `research/independent-annotation/results/STATUS.md` (re-read directly, timestamped today), and `docs/research/REAL_HUMAN_STUDY_ANALYSIS.md` (re-read directly).

### RQ1 — Runtime performance (FCP/TTI)
```
RQ1_STATUS=COMPLETE
```
Batch 1 (PRIMARY, `research-freeze-v1`, **committed**) and Batch 2 (REPLICATION, `research-freeze-v5` baseline, **currently uncommitted** — see §20 P0) used byte-identical protocol parameters, Lighthouse version, and unmodified fixture/runner code (`git log` shows zero commits to either between the two freeze tags). No pooling was performed; both batches are reported and interpreted separately. The result itself is honestly stated as a near-null effect: the largest cross-condition FCP/TTI gaps in Batch 1 are smaller than or comparable to that condition's own standard deviation. No unsupported significance claim was found — no inferential statistics (t-tests, ANOVA, CIs) are computed anywhere in this project's reports, by explicit design choice given the sample size.

### RQ2 — Framework-agnostic patterns / WCAG 2.2 alignment
No full-WCAG-conformance overclaim found anywhere active (see §4). Consistently framed as "WCAG 2.2-aligned static checks," not certification.

### RQ3 — Real-world evaluation
```
RQ3_STATUS=PARTIAL (real-world scanning evidence is complete and substantial; precision/recall AT SCALE is explicitly not claimed, by design)
```
21 public repositories (15 primary-framework: React 5/Next.js 5/Angular 5, + 6 additional: Vue 3/Generic JS-TS 3) — independently confirmed via `benchmarks/real-world/raw-results/repository-manifest.json` (`repoCount: 21`) directly this session. 2,512 files scanned, 320,367 LOC, 0 engine crashes, 117 files with parse errors, 2,649 raw findings (393 Architecture / 1,578 Static Performance / 678 Accessibility). These findings are explicitly **not** labelled for correctness at scale — only an n=18 manual spot-check exists (`benchmarks/real-world/SPOT_CHECK.md`, read directly this session — see §4 for its real, disclosed false-positive findings), and the project's own text correctly states this is too small to generalize and that no real-world precision/recall/accuracy figure is claimed. This is the right way to handle it methodologically — RQ3 asks about *detection effectiveness*, and the evidence gathered is real, but a precision/recall answer at corpus scale genuinely does not yet exist.

### RQ4 — Independent expert validation
```
RQ4_STATUS=PENDING
```
`research/independent-annotation/results/STATUS.md`, re-read directly this session, timestamped `2026-09-07T13:56:40Z` (**today**): "Independent annotation: PENDING... 0 submission files." Zero real expert submissions exist. The internal controlled benchmark (below) is never presented as RQ4 anywhere this session checked — a project-wide, repeatedly-stated non-substitution rule, and this session's own independent grep of the six canonical dissertation chapters corroborates it.

### Internal Controlled Benchmark
```
CANONICAL_INTERNAL_BENCHMARK_TP=65, FP=0, FN=0, Precision=Recall=F1=100.0%, RULE_COVERAGE=50/50
```
Explicitly and consistently labelled **INTERNAL_CONTROLLED_BENCHMARK** everywhere checked (dissertation chapters, `docs/research/REAL_HUMAN_STUDY_ANALYSIS.md`'s Appendix A, `BenchmarkSection.tsx` on the landing page, which additionally discloses "self-authored fixtures, not real-world accuracy" directly in the UI). No instance found presenting this as external/expert validation.

### Human-Study Analysis Pipeline
All required exports present and wired (`docs/research/exports/`: primary/secondary scans, participant summary, domain analysis, framework-domain matrix, severity analysis, remediation events, before/after, rule frequency). Architecture/Static Performance/Accessibility are all represented in the schema. Directly read this session: the report honestly reports 0/NOT_AVAILABLE throughout (0 eligible PRIMARY scans, 0 SECONDARY, 0 before/after pairs) rather than fabricating plausible values — explicitly stated as "the accurate current state, not a defect." No fake N, no fake SUS, no fake Cronbach's alpha, no pre-consent inclusion, no PRIMARY/SECONDARY mixing found.

### Questionnaire / Usability
```
QUESTIONNAIRE_STATUS=PENDING
```
No real questionnaire response data exists yet (`research/raw/real/responses.csv` absent/empty). SUS and Cronbach's alpha are both correctly reported as `PENDING`, not fabricated placeholders.

### Independent self-audit cross-check
This project's own `research/thesis/FINAL_THESIS_CONSISTENCY_AUDIT.md` (dated this session, read in full) independently re-checked all six canonical dissertation chapters for cross-chapter numeric consistency, RQ-wording alignment, WCAG/static-runtime scope integrity, and overclaim language — and reached **PASS** on every axis it checked, with zero active overclaims found (`OVERCLAIM_OR_STALE_PHRASES=0`) and only small housekeeping gaps remaining (two placeholder figures, one orphaned reference, Chapter 6 tables lacking formal numbering — see §20). This session independently spot-checked several of that document's specific claims (domain split 19/24/7, RQ3 repo count 21, RQ4 pending timestamp) directly against source and found them accurate.

---

## 14. Security

*(Full detail: independent agent report + this session's own direct reading of the two most safety-critical documents. No secret values are reproduced anywhere in this report.)*

**Strong, verified code-level controls**: no exposed secrets in the current tree; service-role Supabase key never referenced client-side; JWT verified + DB `tokenVersion`-checked for real logout revocation; admin routes role-gated; layered, DB-backed rate limiting shared across serverless instances; 500KB input cap; zero `dangerouslySetInnerHTML` usage anywhere; zero server-side `eval`/`new Function()` outside a deliberately-isolated child-process sandbox (documented "NEVER executes code in this process, under any failure mode"); CORS is an explicit allow-list, never a wildcard, never credentialed; hardened cookies on all four issuance sites; no hardcoded credentials in source; `ADMIN_BOOTSTRAP_PASSWORD` fails closed outside dev/test.

**Real, currently-open findings (not hypothetical, both dated and secondhand to this session but not contradicted by anything newer):**

1. **Live, unrotated default admin credential.** `docs/audit/GIT_HISTORY_SECRET_REMEDIATION.md` (dated 2026-08-18, read in full this session): both `admin@figm.io` and `sanjula@nsbm.ac.lk` were confirmed — by a live `verifyPassword()` call against the actual stored hash, no value printed — to still authenticate with the exact default password (`Admin123456!`) that was once committed to git history and separately printed in cleartext in an even older audit document. No later document in the repo records this being changed. **This is a live, currently-exploitable credential**, not a historical footnote.
2. **`JWT_SECRET`/`REFRESH_SECRET` rotation status unconfirmed.** Same document: whether the current secrets are the same ones briefly committed in the repo's first two commits (2026-08-05) was not verified. If unchanged, anyone who retained that history window could forge valid tokens, not merely replay stolen ones.
3. **Git history contains real, historically-committed secrets** — 74 commits of a full user database (password hashes, refresh tokens, including a real refresh token for the `sanjula@nsbm.ac.lk` admin account) and 2 commits of a real `.env`. The repo is confirmed private (`404` to an unauthenticated GitHub API request), which narrows but does not eliminate exposure — anyone who cloned during that window retains the history locally regardless of current visibility.
4. **Production admin login is currently broken** (§15) — while not itself a vulnerability, it means the one path that sets `CONSENT_VERIFIED` is non-functional right now.

**`npm audit` was not run this session** against the current (`next@^16.3.4`) dependency tree — PENDING, not claimed clean.

```
TESTS_TOUCHING_PRODUCTION_DB=ZERO (independently confirmed, §3)
```

---

## 15. Production (static evidence only — no live Vercel/Supabase access in this environment)

```
VERCEL_PROJECT=figm-code-inspector (confirmed via .vercel/project.json and vercel.json)
```

**Most serious, most current finding in this entire audit**: `docs/audit/ADMIN_LOGIN_RECOVERY_ROOT_CAUSE.md`, dated **today (2026-09-07)**, read in full this session, documents that admin login (`sanjula@nsbm.ac.lk`) on `https://figm-code-inspector.vercel.app` continues to fail after a manual, verified-correct `password_hash` update in the Supabase SQL Editor. The investigation ruled out DB field-mapping and hash-format incompatibility (both proven clean), found and fixed a real email-normalization bug (missing `.trim()` — now in the uncommitted working-tree diff, §2), but the leading suspect remains unresolved: **this repository has deployed to two separate Vercel projects (`figm-code-inspector` and `figm-model`) from the same pushes**, and it is unconfirmed whether the Supabase project the SQL Editor session targeted is the same one `figm-code-inspector`'s live `DATABASE_URL` actually points at (`VERCEL_AND_SQL_EDITOR_SAME_DATABASE=UNCONFIRMED`). This requires a manual dashboard comparison by the project owner — it could not be resolved from this (or the prior) read-only session.

**"No JSON fallback in production" claim** — verified largely true: `RepositoryFactory`/`SupabaseStorageProvider` now fail closed (throw `FATAL`) if Supabase is unreachable/unconfigured outside dev/test, rather than silently degrading while still reporting `name:'supabase'`. One caveat: an operator can still explicitly set `STORAGE_PROVIDER=json` in any environment (a deliberate, loudly-logged "break glass" escape hatch, not a silent fallback) — enforced by `vercel.json` pinning `STORAGE_PROVIDER=supabase`, not by something that makes misconfiguration structurally impossible.

**DB health**: a prior session's live, read-only Supabase query (`docs/audit/PRE_STUDY_SYNTHETIC_DB_RESIDUE_AUDIT.md`, 2026-09-04, **secondhand**) found 29 users, 1,062 scans, zero synthetic/test-pattern rows. Not re-verified live this session.

```
PRODUCTION_READY=NOT CONFIRMED (static code evidence is good; the most recent, dated production document in the repo reports a live, unresolved login failure)
```

---

## 16. UI/UX (static source inspection only — no live browser testing performed this pass)

No broken/dead `onClick` handlers found anywhere in `app/`. `/login`, `/register`, `/forgot-password` are intentional, documented redirect stubs to the canonical `/auth/*` routes, not orphaned duplicates. Apparent accessibility violations found inside `app/live-scan/page.tsx` turned out, on inspection, to be inside the "Try Sample" demo *input* strings (deliberately flawed code for the scanner to find) — not real UI bugs. A custom search-trigger `<div>` in `HeaderBar.tsx` is correctly implemented as an accessible control (`role="button"`, `tabIndex`, `aria-label`, `onKeyDown`). No fabricated static "trend" badges remain on the dashboard — a previously-flagged decorative "+100%"/"100% Valid" badge was confirmed genuinely removed, not merely hidden.

**Real, minor gap**: two search inputs (`app/history/page.tsx`, `HeaderBar.tsx`) rely on placeholder text alone with no visible `<label>`/`aria-label` — a real, if small, anti-pattern for a tool whose entire purpose is accessibility (§20, P2).

**Not checked this pass**: rendered contrast ratios, focus-trap behavior, screen-reader announcements, client-side runtime errors — none of these are visible from source alone.

---

## 17. Documentation / Claim Audit

*(Full detail: independent agent report. Summary below.)*

The large majority of current (non-archived) documentation is accurate and well-caveated: zero live "ISO Verified" claims, zero unqualified "WCAG compliant" claims, every "100%" figure correctly labelled as an internal, self-authored benchmark, Gemini/Qwen distinction drawn precisely and consistently, participant count consistently 20 everywhere (an old hardcoded `?? 85` fallback found in a prior audit has since been fixed and was independently re-confirmed fixed this session), framework list consistent everywhere sampled, RQ4/internal-benchmark separation maintained everywhere, Batch 1/2 labelling consistent.

**Genuine stale/inconsistency items found:**
- Participant-facing IRB documents (Consent Form, Participant Instructions, Questionnaire) title the study "Framework-Independent Guideline Model," while Chapter 1 designates "Framework-Agnostic" as the dissertation's official term (§20, P1).
- `package.json`'s `description` field still reads "Phase 1 Conceptual Artifacts & Specification" — stale metadata, not user-facing (§20, P2).
- `prisma/schema.prisma`'s header comment calls the platform a "Production SaaS Platform" — an internal label the dissertation's own traceability doc already flags must never be read as "deployed and serving real customers"; low risk, not reproduced as a claim anywhere else.

**Top risk items surfaced by this section are not documentation-language issues at all** — they are the same live, dated, real findings already reported in §14–15 (broken admin login, unrotated default password, uncommitted RQ1 replication data, git history secrets). Repeating them here would double-count; see §20 for the consolidated blocker list.

---

## 18. Remaining Risks (cross-cutting)

- Uncommitted working tree containing real, necessary fixes and new tests (§2).
- RQ1 Batch 2 replication data (44 raw files) genuinely uncommitted and at risk of loss via `git clean` — this project's own `THESIS_BLOCKER_RESOLUTION.md` already flags this exact risk.
- No technical safeguard against one human obtaining multiple participant codes via multiple accounts.
- Test-coverage depth asymmetry across frameworks in the AI-remediation pipeline (Angular/Next.js less directly proven end-to-end than React/Vue).
- `npm audit` not run against the current dependency tree.

---

## 19. Submission Readiness Scores (0–100, evidence-based, not inflated)

| Axis | Score | Basis |
|---|---|---|
| A. Research problem/contribution | 82 | Clear, well-scoped four-RQ design; a genuine, if modest, framework-agnostic contribution |
| B. Methodological consistency | 88 | Exceptional discipline separating internal benchmark / RQ1 / RQ3 / RQ4 / human study, verified independently by this session against source, not just the project's own claim |
| C. FIGM model quality | 80 | Real four-layer taxonomy, WCAG-mapping integrity test-enforced; real-world spot-check reveals genuine, disclosed FP patterns (FIGM-REACT-03) |
| D. Static-analysis engine | 78 | 0 crashes across 2,512 real-world files; 117 parse errors; known FP classes honestly documented rather than hidden |
| E. Multi-framework implementation | 75 | React/Vue strong; Angular/Next.js AI-fix path structurally present but less directly proven end-to-end |
| F. AI remediation | 85 | Verified real 3-stage pipeline; Vue duplicate-SFC bug genuinely fixed and tested this session; asymmetric test depth is the main gap |
| G. Testing/validation | 90 | 1,659/1,659 tests, clean `tsc`, clean build, all independently re-run this session |
| H. Security | 45 | Strong code-level controls undercut by a live, currently-active default admin credential and unrotated secrets — a real, present-tense exposure |
| I. Production deployment | 40 | Admin login broken today; ambiguous dual-Vercel-project database wiring, unconfirmed |
| J. Human-study readiness | 50 | Excellent code-level readiness (consent gate, hard cap, honest zero-fabrication reporting) but 0/20 real participants and the admin-login break blocks the consent step operationally right now |
| K. Reproducibility | 80 | Frozen protocols, versioned rule catalogue, pinned corpus manifest; undercut only by uncommitted RQ1 replication data |
| L. Documentation | 83 | Unusually thorough, self-critical audit trail; a few small stale items, proportionally minor |
| M. Dissertation evidence readiness | 78 | RQ1/RQ3 well-evidenced and honestly scoped; RQ4/questionnaire genuinely and appropriately disclosed as PENDING, not hidden |
| N. Demo readiness | 65 | Core live-scan/AI-fix/dashboard flow is real, tested, and functional; a demo touching the admin/participant panel would currently fail |

```
OVERALL_SUBMISSION_READINESS_SCORE=73
```
(Simple mean of the 14 axes above. The underlying engineering and research quality clusters in the high 70s/80s; the number is pulled down specifically and correctly by two live, current, well-understood operational issues — not by any deficiency in the science itself.)

---

## 20. P0 / P1 / P2 / P3 Issues

### P0 — MUST FIX BEFORE REAL DATA COLLECTION

| ID | Component | Problem | Impact | Action | Effort |
|---|---|---|---|---|---|
| P0-1 | Production auth (Supabase) | Both admin accounts (`admin@figm.io`, `sanjula@nsbm.ac.lk`) still authenticate with the live, unrotated default password once committed to git history | A currently-exploitable credential on the exact system about to start collecting real participant data | Rotate both passwords via the admin panel or bootstrap path; rotate `JWT_SECRET`/`REFRESH_SECRET` regardless | SMALL |
| P0-2 | Production deployment | Admin login broken as of today; leading suspect is two Vercel projects (`figm-code-inspector`, `figm-model`) pointing at different Supabase databases | The consent-verification step (admin-only) is non-functional — blocks starting real collection entirely | Compare Supabase project reference vs. `figm-code-inspector`'s live `DATABASE_URL` in the two dashboards directly; fix the mismatch or consolidate to one Vercel project | MEDIUM |
| P0-3 | Git history | 74 commits contain a full historical user DB (password hashes, refresh tokens); 2 commits contain a real `.env` | Live risk to research-data confidentiality once real participant PII flows through this system | At minimum, rotate all secrets (covers P0-1/P0-2's forgery risk); evaluate a history rewrite (`git filter-repo`) as a deliberate, separate decision given it breaks every clone/fork | MEDIUM–LARGE |
| P0-4 | `research/rq1-experiment/raw-results/` | Batch 2 (Stage 9) replication dataset — 44 raw files — is genuinely uncommitted | Data-loss risk (`git clean`) for evidence the dissertation already cites as replication support | `git add` + commit the raw files and the `STAGE9_REAL_RUN_...` directory | SMALL |

### P1 — MUST FIX BEFORE FINAL SUBMISSION

| ID | Component | Problem | Impact | Action | Effort |
|---|---|---|---|---|---|
| P1-1 | Working tree | 26 modified + 25 untracked files, including real bugfixes, new tests, and new research evidence, uncommitted | The "current state" this audit describes is not actually preserved in history yet | Commit in logical groups (code fixes + their tests; dissertation content; research exports) | SMALL–MEDIUM |
| P1-2 | `research/user-study/{CONSENT_FORM,PARTICIPANT_INSTRUCTIONS,QUESTIONNAIRE}.md` | Research Title uses "Framework-Independent," while Chapter 1 states "Framework-Agnostic" is the dissertation's official term | Minor but real title-consistency gap in IRB-facing materials, right before real participants read them | One-line title correction across the three documents | SMALL |
| P1-3 | `docs/dissertation/chapter6_results_and_conclusion.md` | Tables lack formal "Table 6.X" captions, unlike every table in Chapters 2–5 | Numbering-consistency gap an examiner will notice | Add Table 6.1–6.4 captions | SMALL |
| P1-4 | `docs/dissertation/references.md` | Reference [11] (Wohlin et al.) is never cited anywhere in the six chapters | Orphaned bibliography entry | Insert into Ch3 §3.4 (best topical fit, already identified) or remove | SMALL |
| P1-5 | `docs/dissertation/chapter2_literature_review.md` | ~Half the required section structure (§3, §9) does not exist yet; §2.7 still depends on a citation already identified and removed as fabricated | Chapter is structurally incomplete, not merely stale | Rewrite §2.7 using the already-identified real replacement citation (Manca et al. 2023); draft missing sections | MEDIUM–LARGE |
| P1-6 | Figures 1.1, 2.1 | Rich Picture (Vue undifferentiated from primary frameworks) needs redraw; conceptual literature map is prose-only | Two self-flagged, already-tracked placeholders | Redraw / render before final submission | MEDIUM |
| P1-7 | `src/engine/participant-repository.ts` | Enrollment is idempotent per account, not per human — no invite/allowlist mechanism found | One person could obtain two participant codes across two accounts; relies entirely on manual admin review | Add a lightweight allowlist/invite-code gate, or explicitly document this as a manual-review responsibility in the collection protocol | MEDIUM |

### P2 — SHOULD FIX IF TIME

| ID | Component | Problem | Action | Effort |
|---|---|---|---|---|
| P2-1 | `src/engine/remediation-engine.ts`, `ast-fix-engine.ts` | Deterministic A11Y fixer inserts a literal `"TODO: describe this field"` aria-label placeholder | Prompt for/require manual completion instead of a generic placeholder | SMALL |
| P2-2 | `app/history/page.tsx`, `HeaderBar.tsx` | Search inputs rely on placeholder-only labeling | Add visible `<label>`/`aria-label` | SMALL |
| P2-3 | `src/ai/patch-validator.ts` | Stale comment still references the pre-refactor direct `parseVueSfc` call | Update comment to reference `assertSingleVueSfcStructure` | SMALL |
| P2-4 | `package.json` | `description` field still says "Phase 1 Conceptual Artifacts & Specification" | Update to reflect current scope | SMALL |
| P2-5 | AI remediation test suite | Angular/Next.js lack full end-to-end mocked-provider pipeline tests (retry/telemetry) at the same depth as React/Vue | Add framework-tagged full-pipeline tests mirroring the Vue ones | MEDIUM |
| P2-6 | Dependencies | `npm audit` not run against current `next@^16.3.4` tree | Run and address any high-severity findings | SMALL |
| P2-7 | `docs/generated/` | Untracked auto-exported chapter duplicates from the eval exporter | Delete or `.gitignore` — avoid the stray-duplicate risk this project's own audit already flags | SMALL |

### P3 — POLISH ONLY

| ID | Component | Problem | Action | Effort |
|---|---|---|---|---|
| P3-1 | `bin/figm-analyze.js` (CLI) | No code-size cap equivalent to the API's 500KB limit | Add a matching cap | SMALL |
| P3-2 | `app/api/auth/login/route.ts` | A `500` response body includes `err.message` (pre-existing, minor info-disclosure pattern, unrelated to the reported symptom) | Return a generic message; log detail server-side only | SMALL |
| P3-3 | Local dev environment | `figm-user-db.json` local test-residue file has grown to ~8,922 entries from repeated local `npm test` runs (gitignored, disk-only, harmless) | Periodic local cleanup | SMALL |

```
P0_COUNT=4
P1_COUNT=7
P2_COUNT=7
P3_COUNT=3
```

---

## 21. Feature Freeze Decision

```
CAN_FREEZE_PRODUCT_NOW=NO
SAFE_TO_START_REAL_DATA_COLLECTION=NO
SAFE_FOR_FINAL_UNIVERSITY_SUBMISSION=NO
SAFE_FOR_DEMO=YES (core live-scan → framework-detect → finding → deterministic/AI fix → dashboard flow, which does not depend on admin login, is real, tested, and functional — avoid the admin/participant-matrix panel until P0-2 is resolved)
SAFE_FOR_PUBLIC_BETA=NO
```

**Exact blockers, in order of what actually stops each decision:**

- **Real data collection is blocked by P0-1 and P0-2 specifically**: the consent-verification step is admin-only, and admin login is currently broken; separately, a live default admin credential is not an acceptable state to be in the moment real participant PII starts flowing through the system.
- **Final submission is blocked by P1-1 through P1-6**: an uncommitted working tree, a structurally incomplete Chapter 2, an orphaned reference, unformalized table captions, and two placeholder figures are all real, itemized, small-to-medium pieces of finishing work — none are open research questions.
- **Freezing the product now is blocked by all P0 items plus P1-1** (nothing to freeze onto until the tree is committed and the P0 items are closed).
- **Demo is safe today for the primary product flow only**, with the explicit caveat that the admin/consent panel currently fails.

---

## 22. Exact Final Action Plan

1. Rotate both admin passwords and `JWT_SECRET`/`REFRESH_SECRET` (P0-1). **Do this first — smallest effort, highest live risk.**
2. Resolve the two-Vercel-project / database-target ambiguity; confirm and fix production admin login (P0-2).
3. Commit the working tree in logical groups: (a) the Vue/patch-validator/sandbox hardening + participant-repository fix + their tests, (b) the dissertation chapter5/6 content and the new chapter6 file, (c) the new research exports and audit trail documents, (d) `package.json`'s test-registration diff (P1-1, folding in P0-4's RQ1 Batch 2 raw data commit at the same time).
4. Decide on and, if chosen, execute a git-history secret remediation (P0-3) — a deliberate, separate, owner-level decision given its blast radius.
5. Fix the three participant-facing document titles (P1-2), add Chapter 6 table captions (P1-3), resolve the orphaned reference (P1-4).
6. Complete the Chapter 2 rewrite (P1-5) and the two flagged figures (P1-6).
7. Add a lightweight duplicate-enrollment safeguard or explicitly document the manual-review responsibility (P1-7).
8. Only after 1–4 above: begin real participant data collection.
9. Address P2 items opportunistically; P3 items are optional polish.

---

## 23. Final Status Block

```
HEAD_SHA=7819e191641611121fe5d54a3eaef0f79ade7ef2
WORKING_TREE_CLEAN=NO
RULE_COUNT=50
REACT_STATUS=WORKING (known, disclosed FP pattern on FIGM-REACT-03)
NEXTJS_STATUS=WORKING (AI-fix test-depth gap, not a functional gap)
ANGULAR_STATUS=WORKING (AI-fix test-depth gap, not a functional gap)
VUE_STATUS=WORKING (duplicate-SFC bug fixed and verified this session)
AI_FIX_STATUS=WORKING (deterministic-first, sandboxed, minimal-patch enforced, no retry accumulation)
AI_TELEMETRY_STATUS=WORKING (applied=true only after full verification)
AUTH_SESSION_STATUS=WORKING IN CODE / BROKEN IN PRODUCTION TODAY (see P0-2)
PARTICIPANT_FLOW_STATUS=WORKING (target cap + same-row fix verified; residual multi-account risk, P1-7)
CONSENT_GATE_STATUS=WORKING (0/20 currently consent-verified; 1/20 assigned)
ANALYSIS_PIPELINE_STATUS=WORKING (honest zero-fabrication reporting, independently confirmed)
RQ1_STATUS=COMPLETE
RQ3_STATUS=PARTIAL (real-world evidence complete; precision/recall at scale not claimed, by design)
RQ4_STATUS=PENDING
QUESTIONNAIRE_STATUS=PENDING
SECURITY_STATUS=NEEDS_ACTION (live default admin credential, unconfirmed secret rotation, git-history secrets)
PRODUCTION_STATUS=NOT_CONFIRMED (admin login broken as of today)
TSC=PASS
TESTS=PASS (1659/1659)
BUILD=PASS
P0_COUNT=4
P1_COUNT=7
P2_COUNT=7
P3_COUNT=3
OVERALL_SUBMISSION_READINESS_SCORE=73
CAN_FREEZE_PRODUCT_NOW=NO
SAFE_TO_START_REAL_DATA_COLLECTION=NO
SAFE_FOR_FINAL_UNIVERSITY_SUBMISSION=NO
SAFE_FOR_DEMO=YES
SAFE_FOR_PUBLIC_BETA=NO
```
