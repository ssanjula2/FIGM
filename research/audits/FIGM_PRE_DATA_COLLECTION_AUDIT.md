# FIGM Pre-Data-Collection Research Artifact Audit

Project:
Designing a Framework Agnostic Guideline Model and an Automated Validation
Tool for Effective Single Page Applications (SPA)

Audit Type:
Final Research-Artifact and Pre-Data-Collection Audit

Audit Date:
2026-09-02

Repository:
figm-model (origin: https://github.com/ssanjula2/FIGM.git)

Branch:
main

Commit:
7d8c41faef857cd9818b23332cf488e6d4287a85

Working Tree:
DIRTY — 165 uncommitted changes at audit time (155 modified, 10 untracked; `git status --porcelain | wc -l` = 165)

Auditor:
Automated repository audit performed under evidence-first research
integrity rules (7-stream parallel investigation + direct verification of
`npm test` and `npm run build`).

Purpose:
To establish the actual implementation, validation, evaluation,
production, and data-collection readiness of FIGM before the research
artifact is frozen for empirical evaluation.

---

## SECTION 1 — EXECUTIVE SUMMARY

FIGM is a substantially real, non-trivial research artifact: a genuinely
engineered scan pipeline, a real 50-rule cross-framework guideline
registry, an honestly self-reported internal benchmark, a conservative
AI-remediation verification chain with no false-VERIFIED path found, and
server-side-enforced authentication/authorization. `npm test` and
`npm run build` were independently re-run during this audit (not assumed
from prior claims) and both succeeded (Evidence: Section 18).

It is **not yet ready to begin real human-participant data collection**.
The current blockers are administrative/process, not fundamental
implementation gaps: the working tree is uncommitted (165 files,
including an already-passing but unlanded Vue AST upgrade), the
implementation's human-study target (N=85, hardcoded in 7+ files) has not
been synchronized with the latest supervisor instruction (~20
participants), and Google Analytics/GA4 — instructed to be incorporated
into the analysis component — is not implemented at all.

- Current product stage: FUNCTIONAL_RESEARCH_PROTOTYPE
- Core analyzer status: real, tested, 0 crashes across 843 real-world files in the last full run
- Framework support: React/Next.js/Angular FULL (primary); Vue PARTIAL (additional support, mid-upgrade)
- Research alignment: strong at the guideline-model layer (MODERATE framework-agnosticism verdict); weak at the empirical-evaluation layer (real-world repo count and expert validation both below target)
- Benchmark status: internal controlled benchmark mathematically verified (P=R=F1=1.0) but structurally self-fulfilling (no negative fixtures); real-world evaluation covers 15/~20-30 target repos with only an n=18 manual spot-check for accuracy (39-72% depending on definition)
- Human-study readiness: technical infrastructure strong (hardened session binding, a real fixed exploit closed) but ZERO real participants collected and the target itself needs correcting
- Production readiness: `npm test` = 1265/1265 pass; `npm run build` = success (verified this session, Section 18)
- P0 blockers: 5
- P1 blockers: 5
- Can data collection begin today: **NO**
- Highest-risk unresolved research issue: the human-study participant target hardcoded throughout the codebase (N=85) has not been reconciled with the latest supervisor instruction (~20 real participants) — if data collection began today under the unsynchronized code, every dashboard, admin view, and dissertation exporter would display and reason about the wrong target for the entire collection window.

OVERALL VERDICT:
**GO_AFTER_P0_FIXES** — the P0 items are process/configuration corrections (freeze the tree, synchronize the participant target, implement GA4, confirm consent gating decision), not open implementation risk. None require new core-engine work.

---

## SECTION 2 — RESEARCH CONTRACT

Main Research Question:
How can a framework-agnostic guideline model and an automated validation
tool be designed and implemented to improve the performance and
accessibility of modern Single Page Applications?

RQ1: How do different SPA render and state-management strategies
influence performance metrics such as FCP and TTI?

RQ2: What framework-agnostic architectural and accessibility patterns
can be identified and standardized to improve SPA performance and
accessibility in compliance with WCAG 2.2 guidelines?

RQ3: How effectively can an automated static analysis validation tool
detect architectural and accessibility violations in SPA source code
before deployment?

RQ4: To what extent does the proposed validation tool achieve acceptable
accuracy versus manual expert architectural review (Precision, Recall,
F1)?

OBJ1: Identify framework-agnostic architectural/accessibility patterns
supporting WCAG 2.2 compliance.
OBJ2: Analyze SPA rendering/state-management strategies vs FCP/TTI.
OBJ3: Design and develop the framework-agnostic static analysis
validation tool.
OBJ4: Evaluate tool effectiveness against expert manual review via
Precision/Recall/F1.

Primary frameworks: React, Next.js, Angular.
Additional implementation support: Vue.js.

Research domains: Architecture, Performance, Accessibility, WCAG 2.2,
Static Analysis.

Out of scope: deep security vulnerability assessment, network latency
profiling, cloud orchestration, infrastructure research, unrelated
backend performance research.

---

## SECTION 3 — SUPERVISOR INSTRUCTION REGISTER

### Human-study participant target

Documented old target:
- 80-100 (stated in the audit brief that initiated this review)
- 85 (the actual value hardcoded throughout the implementation)

Latest supervisor target:
approximately 20

Implementation target found in code:
**85**, hardcoded as a fallback default in at least 7 locations —

Evidence:
- File: `research/analysis/usability-results.json:7` — `"targetSampleSize": 85`
- File: `research/user-study/README.md:48` — "the 85-participant goal"
- File: `src/docs/dissertation-exporter.ts:137` — "A target cohort of $N = 85$ student developers... As of this export, **0 of 85** real participant responses have been collected"
- File: `app/admin/page.tsx:549` — `` `${research.userStudy?.collectedParticipants ?? 0} / ${research.userStudy?.targetParticipants ?? 85}` ``
- File: `app/analytics/page.tsx:114` — `'0/85 Real Responses'` fallback string
- File: `app/api/research-metrics/route.ts:218-222,316` — `const targetParticipants = usabilityReport?.provenance.targetSampleSize ?? 85;` and a status string literally reading "(0/85 valid responses)"
- File: `app/components/landing/ResearchOverview.tsx:25` — `` `human usability study N=${us?.targetParticipants ?? 85}` ``

Command: `grep -rn "targetSampleSize\|85.participant\|80.100" research/ src/ app/` — OBSERVED: 8 hits, all consistent at 85, zero hits for "approximately 20" or "~20" anywhere in the repository.

Status:
**MISMATCH**

Required synchronization (every file above, plus any other consumer of
`targetSampleSize`/`targetParticipants`):
- `research/analysis/usability-results.json` (`provenance.targetSampleSize`)
- `research/DATA_COLLECTION_PROTOCOL.md` and `research/user-study/README.md` (narrative target)
- `src/docs/dissertation-exporter.ts` (LaTeX-facing target text)
- `app/admin/page.tsx`, `app/analytics/page.tsx`, `app/api/research-metrics/route.ts`, `app/components/landing/ResearchOverview.tsx` (all four independently hardcode the `?? 85` fallback rather than reading one shared constant — this is the same "no single source of truth" pattern that previously caused the 25-vs-50 rule-count contradiction, and should be fixed the same way: introduce one shared constant, e.g. alongside `TOTAL_RULE_COUNT`, rather than patching each `?? 85` individually)
- `research/CONSENT_FORM.md` / `research/PARTICIPANT_INSTRUCTIONS.md` if either states a specific numeric target to prospective participants

### Analytics instruction

GOOGLE ANALYTICS / GA4 should be incorporated into the analysis component.

Status:
**NOT_IMPLEMENTED**

Evidence:
- Command: `grep -rn "gtag|GoogleAnalytics|GA4|googletagmanager|react-ga|@next/third-parties" **/*.{ts,tsx,json,md}` (excluding node_modules) — OBSERVED: zero genuine matches; the only 3 file hits (`package-lock.json`, `src/matrix/four-layer-meta-model.ts`, `figm-spec.json`) were re-checked directly and contain no `gtag`/`GoogleAnalytics`/`googletagmanager` string at all — they were regex false positives against the broader pattern, confirmed by a follow-up literal-string grep returning no matches.
- File: `app/layout.tsx` (root layout, the only place a global analytics script could be mounted) — read in full (23 lines): no `<script>` tag, no `next/script` import, no analytics provider component. Only `AppShell` is rendered.
- Command: `node -e "console.log(JSON.stringify({...require('./package.json').dependencies,...require('./package.json').devDependencies}))" | grep -i "analytics\|gtag\|ga4"` — OBSERVED: no output (no matching dependency).

Conclusion: Google Analytics/GA4 is entirely absent from the codebase — not partially wired, not configuration-pending with code already in place. This is a genuine gap against the latest instruction, not a documentation lag.

---

## SECTION 4 — SYSTEM ARCHITECTURE

```
Source Input
  -> app/api/scan/route.ts (validation, rate limiting, audit logging)
Framework Detection
  -> src/parser/source-parser.ts (internal detection, feeds SourceParser.parseSource)
Parser
  -> src/parser/source-parser.ts (1365 lines) / framework-parser.ts /
     typescript-framework-parser.ts / vue-sfc-parser.ts / alp-extractor.ts
AST / Structured Representation
  -> src/ast/real-syntax-node-builder.ts (2205 lines, TS-compiler-driven)
Framework Adapter
  -> src/ast/universal-ast-mapper.ts, vue-framework-adapter.ts,
     angular-template-ast-builder.ts, vue-template-ast-builder.ts (uncommitted)
Framework-Agnostic Guideline Mapping
  -> src/matrix/four-layer-meta-model.ts (CORE_ALPS + FOUR_LAYER_MAPPINGS,
     single source of truth) via src/matrix/rule-registry.ts
Rule Execution Engine
  -> src/engine/rule-execution-engine.ts (RuleExecutionEngine.buildScanResult,
     analyzeFile [sync, CLI/tests/eval] / analyzeFileAsync [async, live web])
     -> src/ast/ast-detection-engine.ts (ASTDetectionEngine.evaluateNode)
Violation
  -> DiagnosticReport[] on ScanResult, with figmStatus:
     COMPLETE | PARTIAL | BLOCKED | UNSUPPORTED_FRAMEWORK
Remediation
  -> src/ai/remediation-decision.ts -> src/ai/ai-remediation-router.ts
     (deterministic-first) -> src/engine/ast-fix-engine.ts /
     angular-template-fix-engine.ts / vue-fix-engine.ts /
     lexical-typo-fix-engine.ts, else -> src/ai/ai-remediation-pipeline.ts
     (Claude / Gemini / Ollama)
Validation
  -> src/ai/sandbox-validation-pipeline.ts (isolation -> syntax ->
     patch-scope -> framework-structural -> compile-and-rescan -> test)
Re-scan
  -> src/engine/remediation-validation.server.ts (evaluatePatchResults —
     re-runs RuleExecutionEngine against the patched code)
Verified / Rejected
  -> verified:true set only after the original ruleId AND any grouped
     relatedDiagnostics ruleId are confirmed absent from the re-scan AND
     no new violation/lint error was introduced
```

Evidence: direct source reads of every file above during this audit's
sub-investigations; no stage in this chain was found to be mocked,
stubbed, or simulated.

---

## SECTION 5 — PRODUCT FEATURE INVENTORY

| Feature | Status | Implementation | Tests | Research Relevance | Limitation |
|---|---|---|---|---|---|
| Authentication | IMPLEMENTED | `src/auth/auth-service.ts`, `auth-middleware.ts`, `middleware.ts` | `tests/auth-isolation.test.ts`, `auth-production.test.ts` | Platform, not research subject | JWT/refresh secrets fail closed outside dev/test (verified) |
| Projects | IMPLEMENTED | `app/api/projects/**`, ownership-checked | `tests/saas-projects-workspace.test.ts` | Platform | — |
| Editor / Live Scan | IMPLEMENTED | `app/live-scan/page.tsx`, `app/api/scan/route.ts` | `tests/live-scan-e2e.test.ts`, `live-scan-file-upload.test.ts` | RQ3 core capability | Same UNSUPPORTED_FRAMEWORK/PARTIAL status logic applies |
| AST Parsing | IMPLEMENTED | `src/parser/source-parser.ts`, `src/ast/real-syntax-node-builder.ts` | `tests/ast-migration.test.ts` | RQ2/RQ3 core | Vue template rules mid-upgrade (uncommitted, tests pass — Section 18) |
| Framework Detection | IMPLEMENTED | `source-parser.ts` internal detector | `tests/framework-detection.test.ts`, `framework-detection-react-hint-hardening.test.ts` | RQ3 | — |
| Rule Engine | IMPLEMENTED | `src/engine/rule-execution-engine.ts`, `src/ast/ast-detection-engine.ts` | `tests/ast-detection-rules.test.ts` | RQ2/RQ3 core | No confirmed per-rule exception isolation in `evaluateNode`; no top-level scan timeout |
| Accessibility Analysis | PARTIALLY_IMPLEMENTED | 7 `FIGM-A11Y-*` rules + embedded checks | `tests/accessibility-regression.test.ts` | RQ2 | WCAG-2.2-aligned subset only, not full compliance |
| Performance Analysis (static) | PARTIALLY_IMPLEMENTED | `FIGM-PERF-*`, `FIGM-NEXT-*` architectural checks | `tests/*` per rule | RQ1/RQ2 | Static proxy only — no runtime measurement |
| Architecture Analysis | IMPLEMENTED | ALP layer, `four-layer-meta-model.ts` | `tests/rule-catalog-consistency.test.ts` | RQ2 core | — |
| Deterministic Fixes | IMPLEMENTED | `src/engine/*-fix-engine.ts` | `tests/remediation-coverage.test.ts` | OBJ3 | >=23/50 rules (floor estimate) |
| AI Fixes | IMPLEMENTED | `src/ai/ai-remediation-pipeline.ts` | `tests/ai-remediation.test.ts`, `ai-provider-fallback.test.ts` | OBJ3 | Live-provider integration tests excluded from default `npm test` run |
| Re-scan / Verified Fix | IMPLEMENTED | `src/engine/remediation-validation.server.ts` | `tests/remediation-engine-regressions.test.ts` | RQ3/OBJ3 | No premature-VERIFIED path found (Section 15) |
| Reports | IMPLEMENTED | `app/reports/[id]/page.tsx`, `app/api/report/route.ts` | — | — | Fabricated sec/maintainability score bars for out-of-taxonomy domains were present historically; fixed in the current (uncommitted) working tree |
| History | IMPLEMENTED | `app/history/page.tsx`, `app/api/scans/route.ts` | `tests/scan-history-api.test.ts` | — | — |
| Exports | IMPLEMENTED | `app/api/export/route.ts`, `export-dissertation/route.ts` | `tests/export-dissertation-rate-limit.test.ts` | — | — |
| Guidelines | IMPLEMENTED | `app/guidelines/page.tsx` | — | RQ2 | Sources rule count from `TOTAL_RULE_COUNT` (correct pattern) |
| User Study | PARTIALLY_IMPLEMENTED | `app/user-study/page.tsx`, `app/api/user-study/log-scan/route.ts` | `tests/user-study-canonical-path.test.ts`, `participant-provisioning-race.test.ts` | OBJ4/RQ4 | 0 real participants; fire-and-forget POSTs silently swallow failures (Section 19) |
| Admin | IMPLEMENTED | `app/admin/**`, `app/api/admin/**` | `tests/admin-research-dashboard.test.ts` | — | Server-side `authorizeRole(['ADMIN'])` confirmed on all 6 admin routes checked |
| Research Metrics | IMPLEMENTED | `app/api/research-metrics/route.ts` | `tests/research-metrics-shape-consistency.test.ts` | RQ4 | Reads real files, not fabricated; hardcodes the 85 fallback (Section 3) |
| Google Analytics | **NOT_IMPLEMENTED** | none | none | Supervisor instruction, unmet | See Section 13 |
| Database | IMPLEMENTED | Prisma + Supabase, `RepositoryFactory` | `tests/supabase-storage-provider.test.ts` | Platform | App-layer isolation, not Postgres RLS (disclosed) |
| Production Deployment | IMPLEMENTED, verified this session | Vercel target, `next.config.mjs`, `vercel.json` | `npm run build` — PASS (Section 18) | — | — |

---

## SECTION 6 — CANONICAL RULE INVENTORY

Source of truth: `src/matrix/four-layer-meta-model.ts`, cross-checked
against `docs/evidence/canonical-evaluation.json` (regenerated
2026-09-02T13:16:00.468Z, `evidenceStatus: "CANONICAL_GROUND_TRUTH_VERIFIED"`).

| Metric | Count | Note |
|---|---|---|
| Total canonical rules | **50** | A11Y=7, ANG=10, NEXT=10, PERF=6, REACT=11, VUE=6 |
| Rules with real detector implementation | 50/50 | — |
| Rules with AST-backed detection | 48/50 (as last regenerated) / potentially 50/50 pending commit | FIGM-VUE-01/02 recorded LEGACY_TEXT_HEURISTIC in the last-generated `ground-truth.json`; an uncommitted change adds real-AST detection for both and its dedicated tests pass (`buildVueTemplateRealSyntaxNodes` — 257/257 subtests passing per this session's `npm test` run) — not yet reflected in a regenerated ground-truth/canonical-evaluation artifact |
| Rules using heuristics/text matching | 2/50 (FIGM-VUE-01/02), pending the uncommitted fix above | — |
| Rules with deterministic remediation | >=23 (floor; textual-ID measurement) / 27 by registry self-classification (18 AUTOMATED_FIX_VERIFIED + 9 AUTOMATED_FIX_WITH_CAVEAT) | Two different measurement methods — do not conflate |
| Rules with AI/manual remediation only | 23 (registry `MANUAL_REVIEW_REQUIRED`) | — |
| Rules with positive tests | 50/50 | every rule ID referenced in `tests/` |
| Rules with negative (true-negative) tests | **0/50 in the controlled ground-truth corpus** | `benchmarks/testbed` fixtures are deliberately one-rule-per-fixture positive cases only — no clean/non-violating fixtures exist to test false-positive rate |
| Rules with adversarial tests | 10/50 (20%) | across `tests/adversarial-user-code-detection.test.ts` + `tests/adversarial-complete-detection.test.ts` |
| Rules represented in controlled benchmark | 50/50 | `benchmarks/ground-truth.json`, 65 total labelled violations |
| Rules represented in real repositories | 31/50 (62%) | fired at least once across 16 real-world result files; 19 rules have not yet fired in any real-world scan (absence of evidence, not evidence of a defect) |
| Rules independently expert validated | **0/50** | `research/independent-annotation/results/STATUS.md`: 0 submissions received |

Do not substitute the total rule count (50) for evaluation coverage —
the table above deliberately keeps every coverage dimension separate,
per the audit's evidence standard.

Full 50-row per-rule matrix (rule ID, severity, framework scope,
detection mechanism, remediation status, known limitation) is
machine-readable at `src/matrix/four-layer-meta-model.ts` and exported to
`figm-spec.json`; it is not reproduced row-by-row in this document to
keep the report legible, but every aggregate figure above was computed
directly from that source, not from any narrative document.

---

## SECTION 7 — FRAMEWORK COVERAGE

| Framework | Parser | AST | Detection | Remediation | Tests | Real Evaluation | Status |
|---|---|---|---|---|---|---|---|
| React | Shared TS-compiler | Real | Real-AST, 11 rules | Deterministic + AI | Yes | 3 real repos | **FULL** (primary) |
| Next.js | Shared TS-compiler | Real | Real-AST, 10 rules | Deterministic + AI | Yes | 2 real repos | **FULL** (primary) |
| Angular | Shared TS-compiler (class body) + dedicated template builder | Real | Real-AST, 10 rules (template rules upgraded from legacy heuristic, committed) | Deterministic + AI | Yes | 3 real repos (8/10 rule IDs confirmed firing) | **FULL** (primary) |
| Vue.js | Dedicated `@vue/compiler-sfc`/`compiler-dom` adapter | Real (script-block rules 03-06, committed); real (template rules 01-02, uncommitted but test-passing) | 6 rules | Deterministic + AI | Yes | 3 real repos | **PARTIAL** (additional support, correctly not folded into the primary evaluation sample) |
| Generic JS/TS | Shared TS-compiler | Real | Universal PERF/A11Y rules only, no dedicated rule family | n/a | Yes | 3 real repos | **PARTIAL** (fallback baseline by design) |

Vue is not counted as part of the primary React/Next.js/Angular research
sample anywhere in the current codebase or documentation reviewed — this
is consistent with the research contract in Section 2.

---

## SECTION 8 — RESEARCH QUESTION READINESS

**RQ1 STATUS: NOT_READY**
Evidence: `app/performance/page.tsx` computes FCP/TTI via an explicitly
self-labeled proxy formula off FIGM's own scan-duration metric, not a
real Web Vitals measurement; no `lighthouse`/`playwright`/`web-vitals`
dependency exists; no `PerformanceObserver` usage found anywhere.
Missing evidence: any real runtime FCP/TTI dataset.
Required experiment: build controlled SPA variants (rendering strategy x
state-management strategy), fixed hardware/browser/network profile,
repeated trials, real Web Vitals collection (Lighthouse or
`web-vitals`+Playwright), correlated against FIGM's static findings.

**RQ2 STATUS: PARTIAL**
Evidence: real 4-layer ALP abstraction (`four-layer-meta-model.ts`)
spanning all 5 framework targets; 7 dedicated A11Y rules + embedded
accessibility checks in other rule families; 25 files reference WCAG.
Missing evidence: coverage of WCAG 2.2 beyond a narrow statically-checkable
subset; no dynamic accessibility-tree tooling (no `axe-core`).
Required work: either expand the accessibility rule set materially, or
explicitly scope the RQ2 answer to "a WCAG-2.2-aligned static subset,"
not full compliance.

**RQ3 STATUS: PARTIAL** (leaning READY on core capability)
Evidence: CLI, live web scan, and the real-world benchmark runner all
call the exact same `RuleExecutionEngine.analyzeFile[Async]` function
(one real pipeline, not a benchmark-only reimplementation); 843 files
scanned across 15 real repos with 0 engine crashes in the most recent
run; `npm test` = 1265/1265 passing (verified this session).
Missing evidence: no formal measurement of detection latency/robustness
across "malformed source"/"unknown framework" categories beyond the
incidental 40 parse-error files already observed; no top-level scan
timeout exists outside the profiler sandbox's own 3s guard.
Required work: a dedicated robustness test matrix, and either a scan-level
timeout or an explicit documented decision that one is unnecessary.

**RQ4 STATUS: PARTIAL**
Evidence: see Section 10 (controlled benchmark) and Section 11
(real-world evaluation) — both independently verified this audit, math
correct.
Missing evidence: negative/true-negative fixtures in the controlled
corpus; formal P/R/F1 on the real-world corpus; any completed independent
expert annotation (currently 0/N).
Required evaluation: add negative fixtures to the controlled benchmark;
scale the real-world corpus to the 20-30 target with formal metrics;
execute the already-built blind expert-annotation pipeline with at least
one real annotator.

---

## SECTION 9 — FCP / TTI STATUS

Static performance-related detection (real, exists): `FIGM-NEXT-02`
(heavy component without `next/dynamic`), `FIGM-PERF-04` (static import of
a heavy module), `FIGM-NEXT-07..10` (revalidate/font/hydration-adjacent
checks), and the ALP `astNodeType`/`semanticConstraint` risk-proxy layer.

Actual FCP/TTI measurement (does not exist): no browser-runtime
measurement infrastructure, no Lighthouse/Playwright/`web-vitals`
dependency, no `PerformanceObserver` usage against any *analyzed* SPA's
page load. The only FCP/TTI-labeled numbers in the product
(`app/performance/page.tsx`) are computed from FIGM's own internal
scan-duration metric via a disclosed arithmetic proxy formula, not from
any browser's actual paint/interactivity timing.

Controlled runtime evidence currently exists: **NO.**
No runtime improvement or FCP/TTI outcome may be inferred from any
static-rule detection result in this repository.

---

## SECTION 10 — CONTROLLED BENCHMARK

Label: **INTERNAL CONTROLLED BENCHMARK** (does not use independent
real-world ground truth; see Section 11 for that separate track).

- Dataset: `benchmarks/testbed/` (isolated single-rule fixture convention)
- Fixture/file count: 46 flat fixture files (plus 1 non-flat App-Router fixture for FIGM-NEXT-03)
- Ground-truth violation count: 65 (`benchmarks/ground-truth.json`, `meta.totalExpectedViolations: 65`)
- Rules represented: 50/50
- Frameworks represented: `REACT_JSX, VUE_SFC, ANGULAR_TEMPLATE, GENERIC_ESTREE, NEXT_JS`
- TP: 65 / FP: 0 / FN: 0 (`docs/evidence/canonical-evaluation.json.overall`)
- Precision: 1.0 (100.0%) — independently recomputed: 65/(65+0) = 1
- Recall: 1.0 (100.0%) — independently recomputed: 65/(65+0) = 1
- F1: 1.0 (100.0%) — independently recomputed: 2(1)(1)/(1+1) = 1
- Label provenance: **100% researcher-authored** (`research/independent-annotation/README.md`: "Strengthens benchmarks/ground-truth.json (currently 100% researcher-authored)...")
- Independent review status: **not independently reviewed**

Evidence:
- File: `docs/evidence/canonical-evaluation.json` — `provenance.calculationMethod`: "TP/FP/FN computed by dynamically re-running RuleExecutionEngine.analyzeFile against every file in benchmarks/testbed and diffing... No cached or hand-typed confusion matrix is used at any step." `provenance.dynamic: true`.
- File: `docs/evidence/canonical-evaluation.json.datasetClassification.metricType`: `"AUTOMATED_BENCHMARK_METRICS_ONLY"` — the artifact itself explicitly disclaims being anything more.

Material limitation: the corpus contains **zero true-negative/clean
fixtures**. A perfect P=R=F1=1.0 on a corpus engineered to have exactly
one isolated violation per fixture is close to guaranteed by
construction and provides no evidence about false-positive behavior on
non-violating or ambiguous real code — that evidence exists only in the
much smaller real-world spot-check (Section 11).

---

## SECTION 11 — REAL REPOSITORY EVALUATION

- Target repository count: ~20-30 (per the audit brief; not independently corroborated by any in-repo document, which may originate from a proposal document not present in this codebase)
- Actual repository count: **15** (`benchmarks/real-world/raw-results/`: 15 per-repo JSON files + `_combined-summary.json`, all with real GitHub URLs and pinned commit SHAs, independently spot-checked)
- Framework distribution: React (3 repos), Next.js (2), Angular (3), Vue (3), generic/vanilla JS (4)
- Selection protocol status: PARTIAL — informal documented rationale (`benchmarks/real-world/METHODOLOGY.md`) exists per repo, but is not a pre-registered formal inclusion/exclusion checklist, and the document itself is stale (describes only 5 repos, never updated after the later expansion to 15)
- Commit SHA recording: READY — every repo entry in `_combined-summary.json` carries `url`, `commit`, `name`
- Manual review status: **n=18 manual spot-check only** (`benchmarks/real-world/SPOT_CHECK.md`) — 13/18 (72%) "TP narrow" / 7/18 (39%) "clean TP only," with two documented, reproducible false-positive classes (FIGM-REACT-03 overmatching non-React property assignment; FIGM-REACT-01 misfiring on `.filter()`/`.sort()`/`.reduce()` for non-array receivers, e.g. `Vue.filter()`)
- Expert annotation status: **MISSING** (0 submissions, see Section 8/RQ4 and Section 6)
- Metrics status: no formal P/R/F1 computed for the real-world corpus as a whole — deliberately, per the methodology document's own stated position that this requires independent ground truth it does not yet have
- Robustness metrics that do exist: 843 files scanned, 0 engine crashes, 40 files with (surfaced, not swallowed) parse errors

Fixtures, sample apps, unit tests, and demo code (`benchmarks/testbed`,
`benchmarks/adversarial-real-world`, `samples/sample-spa`) are correctly
excluded from the "15 real repositories" count above.

---

## SECTION 12 — HUMAN PARTICIPANT STUDY

Latest supervisor target: **approximately 20 real participants**
(instruction recorded in this audit; not yet reflected anywhere in the
codebase — see Section 3).

Old conflicting target still hardcoded throughout the implementation:
**85** (see Section 3 for the 7+ file locations).

- Real collected: **0**
- Synthetic/test: 0 (no synthetic responses found mixed into the real data path)
- Valid: 0
- Excluded: 0
- Consent: workflow-order-enforced (UI checkbox before the external Google Form link is reached) and validated at CSV-import time (`scripts/import-user-study.ts` checks `consent_given` on ingest); **not** a hard server-side gate on the FIGM-interaction API itself (`app/api/user-study/log-scan/route.ts` has no consent check) — status: PARTIAL
- Anonymous participant ID: IMPLEMENTED — server-issued, httpOnly, signed, single-participant-scoped session cookie (`ParticipantRepository.assignNewParticipant`); a real previously-exploitable bug (any caller-chosen `participantId` could write a fabricated scan onto an existing participant's real record) has been closed — verified by direct source read of `app/api/user-study/log-scan/route.ts`
- Survey: IMPLEMENTED as an external Google Form (`research/user-study/CreateGoogleForm.gs`) — 10-item SUS instrument
- Persistence: IMPLEMENTED — `scripts/import-user-study.ts` validates, anonymizes to sequential `P001...` IDs, and writes `research/analysis/usability-results.json`
- Export: IMPLEMENTED (`research/raw/real/responses.csv` is the documented single ingest path)
- Analysis pipeline: IMPLEMENTED and honestly self-reporting — `research/analysis/usability-results.json` currently reads: `"datasetType": "SYNTHETIC", "isRealHumanData": false, "collectionStatus": "NOT_COLLECTED", "validParticipantCount": 0`, with `susMean/susMedian/cronbachAlpha` all `0` and an explicit `exclusionLog` entry: "Raw responses file not found... Reporting NOT_COLLECTED baseline state."

Additional integrity evidence: `src/docs/dissertation-exporter.ts:137`
documents that **a prior version of the dissertation chapter reported a
completed evaluation with a specific SUS score and satisfaction
percentages that were fabricated** (invented, with no underlying data)
and have since been retracted rather than replaced with different
invented numbers. This is direct, first-party evidence that a fabrication
incident occurred historically and was caught and corrected — record it
as such, not as an ongoing risk.

---

## SECTION 13 — GOOGLE ANALYTICS / GA4

GA4 installed: **NO**
Measurement ID configuration: none found
Page views: not tracked
Custom events: none implemented
Production verified: n/a (nothing to verify)
Consent/privacy handling: n/a
PII protection: n/a
Source-code protection: n/a

Implemented events: **none.**

Recommended research events (NOT implemented — listed only as candidates
for a future implementation, never to be read as already present):
- page_view on each core workflow page (live-scan, guidelines, reports, user-study)
- scan_started / scan_completed (non-PII: framework, ruleCount, durationMs — never source code)
- fix_applied / fix_verified / fix_rejected (ruleId, remediation strategy — never patch content)
- user_study_task_started / user_study_task_completed (participantCode only, never name/email)

Verification that analytics does NOT transmit source code, uploaded
code, email, name, JWT, raw survey answers, or direct personal
identifiers: **N/A — no analytics implementation exists to audit for
this property.** This must be a first-class requirement of whatever GA4
implementation is added (Section 22/23), not an afterthought: given the
product handles arbitrary user-submitted source code, any GA4 event
schema must be explicitly reviewed to guarantee no event payload ever
includes `code`, `codeContent`, `email`, `fullName`, or any token/cookie
value before it ships.

---

## SECTION 14 — ANALYSIS PLAN

| Evidence Stream | Source | Metrics | Supports | Status |
|---|---|---|---|---|
| Static-analysis benchmark | `benchmarks/testbed` + `benchmarks/ground-truth.json` | P/R/F1 (internal) | RQ3, RQ4 (partial) | PARTIAL — see Section 10 |
| Real repository evaluation | `benchmarks/real-world/raw-results/` | crash rate, finding counts, n=18 spot-check accuracy | RQ3, RQ4 | PARTIAL — 15/~20-30 repos, no formal P/R/F1 |
| Expert review | `research/independent-annotation/` | Cohen's kappa, confusion matrix (infrastructure only) | RQ4 | MISSING (0 submissions) |
| Participant survey | `research/analysis/usability-results.json` | SUS mean/median/stddev, Cronbach's alpha, task completion | Usability evaluation, RQ4 (secondary) | DATA_COLLECTION_PENDING — 0 real participants |
| Google Analytics | none | none | Behavioral/usage triangulation (supervisor-requested) | NOT_IMPLEMENTED |
| Runtime performance experiment | none | FCP, TTI | RQ1 | NOT_IMPLEMENTED — see Section 9 |

Google Analytics, if and when implemented, must **not** be treated as a
substitute for any of: Precision/Recall/F1 computation, independent
expert validation, the SUS survey/questionnaire results, or a real FCP/TTI
runtime experiment. Its role, per the supervisor instruction as recorded,
is to be "incorporated into the analysis component" — i.e., an
additional, clearly-labeled behavioral-usage evidence stream, not a
replacement for any of the above.

---

## SECTION 15 — REMEDIATION INTEGRITY

Deterministic-first behavior: **CONFIRMED.** `remediation-decision.ts`
routes by rule ID to a deterministic engine first, then a hardcoded
`MANUAL_REVIEW_ONLY` set, and only then to `AI_ASSISTED` — verified by
direct source read of `src/ai/ai-remediation-router.ts` and
`remediation-decision.ts`.

AI fallback behavior: single-hop provider fallback on availability
failure only (timeout/rate-limit/auth), never on a code-quality
rejection, never looping back to the same failed provider. Observed live
during this session's `npm test` run (test log excerpt): a Gemini 429
`RESOURCE_EXHAUSTED` response correctly triggered `AI_PROVIDER_FALLBACK`
to Claude, which then produced `finalResult=VERIFIED`.

Patch generation: `src/ai/ai-remediation-pipeline.ts`.

Syntax validation: `src/ai/sandbox-validation-pipeline.ts` (real
temp-file isolation, TS reparse or Vue/Angular structural check).

Compile/type validation: same pipeline, `COMPILE_AND_RESCAN` stage,
delegating to `RemediationValidator.validatePatchAsync`.

Scope validation: an explicitly-disclosed LCS-based line-change-ratio
heuristic (`sandbox-validation-pipeline.ts:184-236`) — a known,
documented limitation ("cannot tell a genuinely large necessary change
from an unnecessary one"), not a concealed one.

Re-scan: `src/engine/remediation-validation.server.ts`,
`evaluatePatchResults()` — re-runs the real rule engine against the
patched code and rejects on (a) new syntax errors, (b) new type/compile
errors not present originally, (c) any new FIGM guideline violation not
present originally, (d) the original rule ID or any grouped related
diagnostic still present.

Verified/rejected decision: `verified: true` is set in exactly two code
paths, both gated behind the full validation chain above completing
successfully — traced line-by-line in `ai-remediation-pipeline.ts:140-163`
(deterministic path) and `:320-369` (AI path, gated on
`sandboxResult.accepted`).

**Explicit statement: a false VERIFIED result was not found to be
possible via any code path traced in this audit.** The chain is more
conservative than many production systems — it rejects not only when the
original violation persists, but also when the patch introduces a
*different* new violation. This finding should be read as a genuine
positive result, not hedged language.

---

## SECTION 16 — AI CONFIGURATION

Available providers (implemented in code): Claude, Gemini, Ollama (local).

Actually implemented: all three — `src/ai/providers/claude-provider.ts`,
`gemini-provider.ts`, `ollama-provider.ts`.

Actually tested:
- Unit-tested: all three (`tests/claude-client.test.ts`, `gemini-provider.test.ts`, `ollama-provider.test.ts`) — part of the default `npm test` run verified this session (1265/1265 pass).
- Live-integration-tested: all three have a dedicated integration test (`claude-integration.test.ts`, `gemini-integration.test.ts`, `ollama-integration.test.ts`) but these are **excluded from the default `npm test` script** and require real API keys / a local Ollama instance — not exercised in this session's verified run.

Production-configured provider: Claude primary (`AI_PRIMARY_PROVIDER=CLAUDE`
in `.env.example`), Gemini fallback (`AI_FALLBACK_PROVIDER=GEMINI`).

Recommended final provider: **Claude**, fallback **Gemini** — matches the
already-shipped default; reproducible hosted API, no GPU/VRAM dependency
unlike Ollama, no quota-ambiguity issue observed with Gemini's 429
handling (Section 15 shows the fallback path working correctly against
a real Gemini quota-exhaustion response during this session's test run).

Model: exact pinned model string in `src/ai/claude-client.server.ts` —
not re-extracted in this pass; must be confirmed and recorded verbatim
before freeze (Section 21/23).

Environment variable names (values not disclosed): `AI_PRIMARY_PROVIDER`,
`AI_FALLBACK_PROVIDER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`GEMINI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`.

Qwen: confirmed fully removed as a standalone provider; the string
"qwen2.5-coder:7b" that remains is the name of the local model Ollama
serves, not a fourth provider — `AIProviderName` type is exactly
`OLLAMA | CLAUDE | GEMINI | NONE`.

Final provider decision status: **NOT_FROZEN** — the current default
configuration is a reasonable recommendation, but no explicit freeze
action (pinning an exact model version string, recording it in the
methodology chapter) has occurred yet.

---

## SECTION 17 — SECURITY AND PRIVACY

**Product security** (in scope for the artifact's own operation, out of
scope as a research contribution):
- Authentication: HMAC-SHA256 JWT (1h access / 7d refresh), scrypt password hashing with transparent legacy-PBKDF2 upgrade
- Authorization: `authorizeRole(request, ['ADMIN'])` confirmed server-side on all 6 admin routes read; IDOR ownership check confirmed in `app/api/projects/[id]/route.ts` (`auth.user.role !== 'ADMIN' && project.userId !== auth.user.userId`)
- User isolation: application-layer, userId-scoped queries verified server-side from the JWT — explicitly not relying on Postgres RLS (disclosed on the product's own Security page, cross-referenced to `DATABASE.md`)
- Admin isolation: as above
- Secret handling: `resolveSecret()` in `src/auth/auth-service.ts` fails closed (throws FATAL) for `JWT_SECRET`/`REFRESH_SECRET` outside dev/test regardless of the exact `NODE_ENV` string, and validates minimum length (32 chars) plus rejects placeholder-pattern values; no silent insecure production fallback found
- Production fallback risks: the rate limiter has a documented in-process fallback used only when Postgres is unavailable — acceptable as designed but not safe across multiple serverless instances at scale without further hardening (carried forward as P2)

**Research-data protection:**
- Participant-data protection: signed, httpOnly, single-participant-scoped session cookie; a real previously-exploitable identity-spoofing bug is closed (Section 12)
- Consent enforcement: workflow-order + CSV-import-time validation, not a hard server-side gate on the interaction API itself (Section 12, carried forward as a finding)
- Analytics privacy: n/a — no analytics implementation exists yet (Section 13); any future implementation must guarantee no code/PII transmission before shipping

**Research security claims:** the product's own Security page
(`app/security/page.tsx`) is correctly scoped to "Data Privacy &
Cross-User Protection" / "Tenant Security Specification" language and
makes no claim of deep vulnerability assessment or penetration testing.
No `SEC`-prefixed rule domain exists among the 50 canonical rules —
security is not part of the research rule taxonomy. Recommended
classification: **SUPPLEMENTARY_PRODUCT_CAPABILITY**, excluded from
research-contribution metrics — the current framing already avoids
overclaiming.

---

## SECTION 18 — PRODUCTION READINESS

npm test result:
**PASS.** Independently executed during this audit (2026-09-02).
```
# tests 1265
# suites 75
# pass 1265
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 344129.68
```
Exit code 0. This exactly matches the previously-claimed baseline —
verified by actual execution, not assumed.

npm run build result:
**PASS.** Independently executed during this audit (2026-09-02).
Observed: `Next.js 14.2.35`, "Compiled with warnings" — the exact two
`@vue/compiler-sfc` "Critical dependency" warnings previously claimed as
the known non-fatal baseline were reproduced verbatim (traced through
`vue-sfc-parser.ts` -> `source-parser.ts` -> `rule-execution-engine.ts` ->
`app/api/scan/route.ts`), all 63 routes compiled, exit code 0.

Production deployment status: build artifact produces successfully;
actual live Vercel deployment was **NOT EXECUTED** this session (out of
scope for a read-only-plus-one-report audit — deploying is a
state-changing action requiring separate authorization).

Database: schema and migrations present (`prisma/migrations/`); live
connectivity **NOT EXECUTED** this session (would require live
credentials this audit did not use).

Authentication: code-level verification only this session (Section 17);
a live login/register/refresh cycle against a running instance was
**NOT EXECUTED**.

Scan API: code-level and pipeline-trace verification only; a live HTTP
request against a running instance was **NOT EXECUTED**. (`npm test`
does exercise the underlying `RuleExecutionEngine` extensively via unit
tests, which is a genuine but different form of verification than a live
HTTP round-trip.)

Report: code-level verification only; live round-trip **NOT EXECUTED**.

User study: code-level verification only; live round-trip **NOT
EXECUTED**. Zero real participant data exists regardless (Section 12).

Analytics: **NOT_IMPLEMENTED** (Section 13) — nothing to verify.

No production-verification claim in this report extends beyond what was
actually executed above; live HTTP/browser-level verification against a
running deployment remains a required next action (Section 22/23) before
any GO decision that depends on it.

---

## SECTION 19 — P0/P1/P2/P3/P4 REGISTER

| ID | Priority | Finding | Evidence | Research Impact | Product Impact | Required Action | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|---|
| F-01 | P0 | Working tree has 165 uncommitted changes; nothing is frozen | `git status --porcelain` = 165 | Cannot certify a specific artifact version as "what the study ran against" | Blocks any freeze/tag | Commit or explicitly revert every pending change; tag the resulting commit | Clean `git status` on a tagged commit | OPEN |
| F-02 | P0 | Vue template-AST upgrade (FIGM-VUE-01/02) is uncommitted | `src/ast/vue-template-ast-builder.ts` untracked, `real-syntax-node-builder.ts` modified | Vue framework-support classification (Section 7) cannot be finalized until landed or reverted | Vue detection quality | Land the change (it already passes its dedicated tests, per Section 18's verified `npm test` run) or explicitly revert before freeze | Committed, with ground-truth/canonical-evaluation artifacts regenerated to reflect the new status | OPEN — verified passing, decision pending |
| F-03 | P0 | Human-study participant target (85, hardcoded in 7+ files) not synchronized with the latest supervisor instruction (~20) | Section 3 | If collection starts unsynchronized, every dashboard/exporter reasons about the wrong target for the entire window | Admin/analytics/dissertation-exporter UI all show the wrong denominator | Introduce one shared target constant and update all 7+ call sites and the protocol/consent-facing docs | `grep` for `85` as a participant-target fallback returns zero hits; all UI/exports read the new shared constant | OPEN |
| F-04 | P0 | Google Analytics/GA4 is completely unimplemented despite explicit supervisor instruction | Section 13 | Any real-participant session run before this lands is permanently unmeasurable by GA4 — cannot be retroactively collected | No behavioral-usage evidence stream exists | Implement GA4 with an explicitly PII/code-free event schema (Section 13) before any real participant is run | GA4 events verified firing in a test session, with a code review confirming no `code`/`email`/`fullName`/token field is ever included in any event payload | OPEN |
| F-05 | P0 | Consent is not server-side-gated on the FIGM-interaction API (`log-scan`) | `app/api/user-study/log-scan/route.ts` has no `consent_given` check | Ethics/methodology risk if the study proceeds without an explicit accepted-design decision | Minor code risk, real ethics-documentation risk | Either add a server-side consent gate, or obtain and record an explicit accepted-design decision in the methodology chapter | Code change merged, or a reviewed methodology-doc statement | OPEN |
| F-06 | P1 | Silent participant-data-loss risk in the study UI | `app/user-study/page.tsx` fire-and-forget POSTs with `.catch(() => {})`, no retry/error surfaced | A real participant's task record could be silently lost mid-study with no trace | Data integrity during collection | Await the persistence call; surface a retry/error state on failure | A simulated failed POST visibly blocks/retries rather than silently succeeding | OPEN |
| F-07 | P1 | 25-vs-50 rule-count contradiction persists uncorrected in non-dissertation docs | `docs/architecture/AST_MIGRATION_MAP.md`, `docs/audit/RULE_DETECTION_MATRIX.md`, `docs/DEVELOPMENT_SUMMARY.md:131` | A reviewer/examiner reading these files without the dissertation's correction convention sees stale numbers as current | Documentation credibility | Apply the same "Correction (Phase N)" convention already used in dissertation chapters, or move to `archive/` | `grep -rn "25 rules\|25 canonical\|8/25\|23/25" docs/` returns only archived/annotated hits | OPEN |
| F-08 | P1 | Real-world repository count (15) is below the ~20-30 target | Section 11 | RQ4's real-world evidence base is thinner than the research design calls for | — | Scale `run-real-world-benchmark.ts` to 20-30 repos; update the stale methodology doc | `_combined-summary.json.repoCount` >= 20, doc matches | OPEN |
| F-09 | P1 | Zero independent expert annotations against fully-built infrastructure | Section 6, 8, 11 | RQ4's "vs manual expert review" claim is currently unanswerable | — | Recruit and run at least one independent annotator through the existing blind-review package | `submissions/*.csv` exists; `research:compare-annotations` produces a real kappa/confusion-matrix output | OPEN |
| F-10 | P1 | Model string for the frozen AI provider not yet extracted/pinned | Section 16 | Experiment-freeze baseline is incomplete without it | — | Read and record the exact model constant in `src/ai/claude-client.server.ts` | Recorded in Section 21 baseline and the methodology chapter | OPEN |
| F-11 | P2 | Controlled benchmark has zero true-negative fixtures | Section 10 | P=R=F1=1.0 cannot be paired with a real false-positive-rate figure | — | Add non-violating "clean" fixtures per rule | New fixtures added, ground truth regenerated, a real FP-rate figure reported | OPEN |
| F-12 | P2 | Two documented real-world false-positive classes (FIGM-REACT-01, FIGM-REACT-03) uncorrected | Section 11 | Understates the tool's real-world FP rate if unaddressed | Detector accuracy | Fix the detectors or formally cite as a dissertation limitation | Either a code fix + regression test, or an explicit limitations-section citation | OPEN |
| F-13 | P2 | In-process rate-limiter fallback unsafe across multiple serverless instances | Section 17 | — | Multi-instance production risk | Harden or explicitly document as a scoped limitation | Documented decision or code hardening | OPEN |
| F-14 | P2 | Adversarial test coverage only 10/50 rules (20%) | Section 6 | Limits confidence in adversarial robustness claims | — | Expand adversarial coverage | Adversarial tests exist for a materially larger rule subset | OPEN |
| F-15 | P3 | Hardcoded `'50'` string for rule count in `app/live-scan/page.tsx` | prior audit finding, not re-verified this session | Same drift risk that caused the 25-vs-50 contradiction | Cosmetic | Source from `TOTAL_RULE_COUNT` | Sourced from the constant | OPEN |
| F-16 | P4 | No per-rule exception isolation in `ASTDetectionEngine.evaluateNode`; no top-level scan timeout | Section 8/RQ3 | Defense-in-depth beyond current research-validity requirements | Reliability | Add isolation + timeout | Repro-tested against a deliberately hanging/throwing rule | OPEN |

P0 count: **5**
P1 count: **5**
P2 count: **4**
P3 count: **1**
P4 count: **1**

---

## SECTION 20 — DATA COLLECTION DECISION

**GO_AFTER_P0_FIXES**

Evidence for this decision: the core scan/remediation/verification
engine is real, tested (1265/1265 passing, independently re-verified
this session), and builds cleanly. Authentication, authorization, and
participant-session integrity are server-side enforced and a real prior
exploit is closed. None of the 5 P0 items (Section 19: F-01 through
F-05) require new core-engine implementation — they are a freeze
decision, a land-or-revert decision on an already-passing change, a
constant-synchronization task, a new but well-scoped analytics feature,
and a consent-design decision. All are achievable without touching the
scan/rule/remediation pipeline itself.

CAN APPROXIMATELY 20 REAL USERS BEGIN THE STUDY TODAY?

**NO** — specifically because F-03 (participant target unsynchronized)
and F-04 (GA4 unimplemented) mean that starting today would either run
under the wrong target or permanently lose the behavioral-analytics
stream for those first sessions. Once F-01 through F-05 are closed:
**YES_AFTER_P0_FIXES.**

---

## SECTION 21 — EXPERIMENT FREEZE BASELINE

To be captured at the moment of freeze (after Section 19's P0 items
close) — recorded here as the template plus every value already known:

- Git commit: **NOT YET FROZEN** — current HEAD at audit time is `7d8c41faef857cd9818b23332cf488e6d4287a85` on `main`, but this is a pre-freeze reference point, not the freeze commit (165 files are still uncommitted)
- Branch: `main`
- Tool version: `figm-model@1.0.0` (`package.json`), Next.js `14.2.35`
- Rule count: 50 (`four-layer-meta-model.ts`)
- Rule-set version: no explicit version field found in `four-layer-meta-model.ts`/`figm-spec.json` (`figm-spec.json.version` is absent) — recommend adding one before freeze
- Framework support: React/Next.js/Angular FULL; Vue PARTIAL (pending F-02 resolution)
- Survey version: `research/user-study/CreateGoogleForm.gs`, 10-item SUS — no explicit version tag found; recommend adding one before freeze
- Participant target: **TO BE SET to ~20 per Section 3, currently 85 in code — must be corrected before this baseline is meaningful**
- AI provider/model: Claude primary / Gemini fallback; exact model string not yet extracted (F-10)
- Scoring formula: `calculateQualityScore` (`src/engine/quality-score.ts`) — not independently re-derived in this audit pass
- Benchmark version: `benchmarks/ground-truth.json` — "FIGM Empirical Evaluation Benchmark Testbed v1.0", `docs/evidence/canonical-evaluation.json.version: "1.0.0"`, generated 2026-09-02T13:16:00.468Z
- Repository protocol version: informal (`benchmarks/real-world/METHODOLOGY.md`), no version tag, currently stale (F-08)
- Analytics configuration: **NOT_IMPLEMENTED** (F-04) — must exist and be configured before this baseline is meaningful

This baseline is **incomplete and not yet fit to freeze** — it is
recorded here specifically to make visible which fields are already
known versus which remain open pending the P0 register in Section 19.

---

## SECTION 22 — ROADMAP TO FINAL PRODUCT

| ID | Stage | Task | Reason | Research Requirement | Files | Dependency | Acceptance Criteria | Verification | Before Data Collection? | Frozen During Study? | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | 0 | Freeze scope: resolve 165 uncommitted files | F-01 | All | repo-wide | none | Clean `git status` | `git status --porcelain` empty | Yes | n/a | OPEN |
| R-02 | 0 | Land or revert the Vue AST upgrade | F-02 | RQ2/RQ3, Vue support | `src/ast/vue-template-ast-builder.ts`, `real-syntax-node-builder.ts` | R-01 | Committed decision, tests still green | Targeted `npm test` re-run | Yes | Yes | OPEN |
| R-03 | 0 | Synchronize participant target to ~20 | F-03 | OBJ4/RQ4, ethics | 7+ files, Section 3 | R-01 | No `85` fallback remains | `grep` sweep | Yes | Yes | OPEN |
| R-04 | 0 | Implement GA4 with a PII/code-free event schema | F-04 | Supervisor instruction | `app/layout.tsx` + new analytics module | R-01 | Events verified firing; payload-safety code review passed | Manual test session + code review | Yes | Yes | OPEN |
| R-05 | 0 | Decide and document consent-gating design | F-05 | Ethics/methodology | `app/api/user-study/log-scan/route.ts`, `DATA_COLLECTION_PROTOCOL.md` | R-01 | Code change or recorded decision | Review | Yes | Yes | OPEN |
| R-06 | 1 | Fix silent scan-logging failure in study UI | F-06 | Data integrity | `app/user-study/page.tsx` | R-01 | Failed POST surfaces an error/retry | Stubbed-failure manual test | Yes (recommended) | Yes | OPEN |
| R-07 | 2 | Correct stale 25-rule docs | F-07 | Documentation credibility | Section 19 list | none | `grep` sweep clean | `grep` | No | No | OPEN |
| R-08 | 3 | Full regression: `npm test` + `npm run build` on the frozen commit | verify R-01 through R-06 | All | repo-wide | R-01..R-06 | Both green | Command output | Yes | n/a | Partially done pre-freeze this session; must re-run on the actual frozen commit |
| R-09 | 4 | Production/browser acceptance pass (live auth, scan, report, admin, user-study) | Section 18 gaps | RQ3 | live deployment | R-08 | All flows verified live | Manual/browser test | Yes | n/a | OPEN |
| R-10 | 5 | Research-pipeline dry run (one synthetic full participant pass end-to-end) | catch integration gaps before real users | RQ4/OBJ4 | full study stack | R-09 | Dry-run record produced and matches expected schema | Manual run | Yes | n/a | OPEN |
| R-11 | 6 | Pilot participant session (1-3 people) | de-risk before scaling | OBJ4 | full study stack | R-10 | Pilot completes cleanly, GA4 events observed | Manual review | Yes | n/a | OPEN |
| R-12 | 7 | Freeze the experiment version (tag, complete Section 21 baseline) | — | All | repo-wide | R-11 | Section 21 fully populated, tagged commit | `git tag` + doc | Yes | n/a | OPEN |
| R-13 | 8 | Begin the real ~20-participant study | OBJ4/RQ4 | full study stack | R-12 | ~20 valid responses collected | `usability-results.json` reflects real data | n/a | Yes (this is the frozen window) | OPEN |
| R-14 | 9 | Scale real-world repository evaluation 15 -> 20-30 | F-08 | RQ4 | `benchmarks/real-world/` | R-01 (parallelizable with R-13) | `_combined-summary.json.repoCount` >= 20 | file inspection | No | No | OPEN |
| R-15 | 10 | Run independent expert-annotation pass | F-09 | RQ4 | `research/independent-annotation/` | R-01 (parallelizable with R-13) | Real `.csv` submission(s), computed kappa | `STATUS.md` regenerated | No | No | OPEN |
| R-16 | 11 | Compute final TP/FP/FN/P/R/F1 against expanded real-world corpus + expert labels | — | RQ4 | `src/eval/*` | R-14, R-15 | New evaluation artifact generated | file inspection | No | No | OPEN |
| R-17 | 12 | Usability/reliability analysis (SUS mean, Cronbach's alpha) on real data | — | OBJ4 | `research/analysis/` | R-13 | Real, non-zero metrics computed | file inspection | No | No | OPEN |
| R-18 | 13 | RQ1 performance-strategy evaluation (build Web Vitals infra from scratch) | F none, but RQ1 currently NOT_READY | RQ1/OBJ2 | new infra, Section 9 | R-01; independent of R-13 | Real FCP/TTI dataset across controlled variants | file inspection | No (unless scope requires it before collection) | No | OPEN — needs an explicit scope decision first |
| R-19 | 14 | Answer RQ1-RQ4 using only collected evidence | — | All RQs | dissertation chapters | R-16, R-17, R-18 | Chapters cite only real collected data | manual review | No | No | OPEN |
| R-20 | 15-19 | Results/discussion writing, documentation sync, reproducibility audit, final release, final tagged artifact | — | All | repo-wide | R-19 | per-stage | manual review | No | No | OPEN |

---

## SECTION 23 — NEXT 10 ACTIONS

**ACTION 1**
Goal: Establish the true frozen baseline state.
Files/Command: `git add -A && git commit` (after resolving R-02's land/revert decision), then `git tag figm-pre-study-freeze`.
Expected Result: clean `git status`.
Stop Condition: do not tag until the Vue AST decision (Action 2) and participant-target sync (Action 3) are both resolved.

**ACTION 2**
Goal: Land or revert the uncommitted Vue template-AST upgrade.
Files/Command: `src/ast/vue-template-ast-builder.ts`, `src/ast/real-syntax-node-builder.ts`; `node --import tsx --import ./tests/test-env-setup.mjs --test tests/vue-template-ast-detection.test.ts tests/vue-fix-engine.test.ts`.
Expected Result: tests already pass (confirmed this session); commit if landing.
Stop Condition: if a fresh run of just these two test files fails, revert instead of committing.

**ACTION 3**
Goal: Synchronize the human-study participant target to ~20 everywhere.
Files/Command: introduce one shared constant; update all 7+ locations listed in Section 3.
Expected Result: `grep -rn "?? 85\|targetSampleSize.*85\|N = 85" research/ src/ app/` returns zero hits.
Stop Condition: none — pure text/constant substitution, safe to do immediately.

**ACTION 4**
Goal: Implement GA4 with a PII/code-free event schema.
Files/Command: `app/layout.tsx` + a new analytics module; define the event list from Section 13.
Expected Result: events fire in a manual test session; a code review confirms no event payload includes `code`, `codeContent`, `email`, `fullName`, or a token.
Stop Condition: do not ship if any event payload includes source code or a personal identifier — redesign the schema first.

**ACTION 5**
Goal: Resolve the consent-gating design decision (server-side gate vs. documented accepted design).
Files/Command: `app/api/user-study/log-scan/route.ts`, `research/DATA_COLLECTION_PROTOCOL.md`.
Expected Result: either a merged code change or a reviewed, recorded decision.
Stop Condition: this needs a human (researcher/supervisor/ethics) decision — surface the two options rather than choosing unilaterally.

**ACTION 6**
Goal: Fix the silent participant-data-loss risk in the study UI.
Files/Command: `app/user-study/page.tsx`, `handleRunScan()`.
Expected Result: a failed POST surfaces a visible retry/error state instead of silently proceeding.
Stop Condition: verify with a stubbed-failure manual test before considering closed.

**ACTION 7**
Goal: Re-run the full regression suite on the actual frozen commit (post Actions 1-6).
Files/Command: `npm test`, `npm run build`.
Expected Result: 1265/1265 pass, build exit 0 (matching this session's pre-freeze verification).
Stop Condition: any regression must be fixed before proceeding to Action 8.

**ACTION 8**
Goal: Live production/browser acceptance pass.
Files/Command: deploy the frozen commit; manually exercise login, live-scan, report, admin, and the user-study flow (including a deliberately-failed request to confirm Action 6's fix).
Expected Result: every flow works live, GA4 events observed firing.
Stop Condition: any live failure blocks Action 9.

**ACTION 9**
Goal: Run one full synthetic dry-run of the entire study pipeline end-to-end (not a real participant).
Files/Command: full study stack, `app/user-study/page.tsx` through `usability-results.json`.
Expected Result: a dry-run record matches the expected schema at every stage.
Stop Condition: any schema mismatch or silent failure blocks the pilot (Action 10).

**ACTION 10**
Goal: Run a 1-3 person pilot participant session, then freeze and tag the experiment version (Section 21 baseline fully populated) before beginning the real ~20-participant study.
Files/Command: full study stack; `git tag`; complete Section 21.
Expected Result: pilot completes cleanly; baseline document is complete with no open fields.
Stop Condition: do not begin the real ~20-participant study until the pilot is clean and the baseline is frozen.

---

## SECTION 24 — FINAL READINESS DASHBOARD

- Core Analyzer: **85%** — real pipeline, 1265/1265 tests passing (verified this session), 0 crashes on 843 real files; gaps are the two residual robustness items (F-16)
- Rule Engine: **90%** — 50/50 rules implemented and tested; adversarial coverage only 20%
- Framework-Agnostic Model: **60%** — MODERATE verdict (Section 8/RQ2); real abstraction layer, but detection layer not uniformly real-AST across all frameworks
- React: **90%** — FULL, primary framework
- Next.js: **90%** — FULL, primary framework
- Angular: **85%** — FULL, primary framework; 2/10 rule IDs unconfirmed in real-world data
- Vue: **55%** — PARTIAL; template-AST upgrade verified passing but uncommitted (F-02)
- Accessibility: **40%** — narrow WCAG-2.2-aligned subset only, no dynamic tooling
- Performance Static Analysis: **55%** — real architectural proxies exist, disclosed as such
- Runtime FCP/TTI Evidence: **0%** — no infrastructure exists at all (Section 9)
- Deterministic Remediation: **75%** — >=23/50 rules, real decline semantics
- AI Remediation: **85%** — genuinely verified re-scan chain, no defect found; live-provider integration tests excluded from default `npm test`
- Validation/Re-scan: **90%** — conservative, rejects on newly-introduced violations too (Section 15)
- Benchmark: **50%** — correct math, but zero negative fixtures (F-11)
- Real Repository Evaluation: **40%** — 15/~20-30 target, no formal P/R/F1 on the corpus
- Expert Validation: **5%** — infrastructure only, 0 submissions
- Human Study: **35%** — strong technical infrastructure and honest self-reporting, but 0 real participants AND the target itself is unsynchronized (F-03) AND one unaddressed silent-failure risk (F-06)
- Google Analytics: **0%** — not implemented at all (F-04)
- Production: **80%** — `npm test` and `npm run build` independently verified passing this session; live deployment/browser acceptance not yet re-verified (Section 18)
- Research Alignment: **55%** — good dissertation-side correction discipline and a documented, corrected fabrication incident (positive integrity signal); stale non-dissertation docs and the unsynchronized participant target both currently work against alignment

---

## SECTION 25 — FINAL SIGN-OFF

CURRENT PRODUCT STAGE:
FUNCTIONAL_RESEARCH_PROTOTYPE

DATA COLLECTION STATUS:
GO_AFTER_P0_FIXES

TARGET REAL PARTICIPANTS:
Approximately 20, according to latest supervisor instruction (implementation currently still hardcodes 85 — see F-03)

REAL PARTICIPANTS COLLECTED:
0

GOOGLE ANALYTICS:
NOT_IMPLEMENTED

REAL REPOSITORY EVALUATION:
PARTIAL (15 of an approximately 20-30 target)

EXPERT VALIDATION:
MISSING (0 of N submissions; infrastructure ready)

RQ1:
NOT_READY

RQ2:
PARTIAL

RQ3:
PARTIAL

RQ4:
PARTIAL

P0 BLOCKERS:
5

P1 BLOCKERS:
5

NEXT REQUIRED ACTION:
Resolve the uncommitted Vue AST upgrade (land or revert, Action 2) and synchronize the human-study participant target from 85 to approximately 20 across all 7+ hardcoded locations (Action 3), then commit and tag a frozen baseline (Action 1), before implementing Google Analytics (Action 4) and closing the consent-gating decision (Action 5).
