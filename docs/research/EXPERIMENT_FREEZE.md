# Experiment Freeze Record

**Status: FROZEN.** Frozen 2026-09-03 (Stage 7), following the Stage 6 pre-freeze review
(`docs/audit/STAGE_6_PRE_FREEZE_REVIEW_REPORT.md`: `TECHNICAL_FREEZE_READY = YES`,
`EXPERIMENT_FREEZE_READY = YES`, 0 unknown files, 0 secret risk, 1393/1393 tests, build PASS). The
baseline commit SHA below is the first of two freeze commits (the second is documentation-only,
recording this SHA into this file — see `docs/audit/STAGE_7_EXPERIMENT_FREEZE_REPORT.md`).

| Field | Value | Source |
|---|---|---|
| **Freeze date** | **2026-09-03** | This document |
| Tool version | 1.0.0 | `package.json` |
| **Commit SHA (freeze baseline)** | `PENDING_FREEZE_COMMIT_SHA` | Filled in by the Stage 7 documentation-only follow-up commit, per `git rev-parse HEAD` run immediately after the freeze commit |
| Rule-set version | 2.1.0 | `src/research/research-config.ts` `RESEARCH_ARTIFACT_VERSIONS.ruleSetVersion` (corrected 2026-09-03, Stage 6 -- this row was stale at 2.0.0, one version behind the canonical source; the underlying 50-rule set itself is unchanged, this is purely a documentation correction) |
| Rule semantics | 50 canonical rules, unchanged detection logic this session (only metadata: WCAG mapping, taxonomy field) | `figm-spec.json`, regenerated this session |
| Domain taxonomy | `domain` (PERFORMANCE/ACCESSIBILITY, unchanged) + new additive `primaryResearchDomain` (ARCHITECTURE/STATIC_PERFORMANCE/ACCESSIBILITY) | `four-layer-meta-model.ts` `primaryResearchDomain()` |
| Severity mappings | Unchanged this session | `figm-spec.json` |
| Parser behavior | Unchanged detection logic; Vue template real-AST landed in a prior session this same multi-turn engagement | `src/ast/vue-template-ast-builder.ts` |
| Scan-result schema | Unchanged | `src/engine/rule-execution-engine.ts` |
| Score formula | Unchanged this session | `src/engine/quality-score.ts` (not touched) |
| Remediation behavior | Unchanged this session (verified, not modified) | `src/engine/remediation-validation.server.ts` |
| AI model/config | Claude `claude-opus-5` primary, Gemini `gemini-3.6-flash` fallback | `docs/research/AI_CONFIGURATION_FREEZE.md` (prior session) |
| Prompt version | NOT SEPARATELY VERSIONED — no prompt-hash/version field found in `src/ai/prompt-builder.ts` this session | HUMAN_CONFIRMATION_REQUIRED if a prompt hash is needed for reproducibility |
| Validation behavior | Unchanged, re-verified (no false-VERIFIED path found) | `tests/sandbox-validation-pipeline.test.ts` |
| Participant task | Unchanged this session (consent gate, retry-on-failure landed prior session) | `app/user-study/page.tsx` |
| Survey | Unchanged | `research/QUESTIONNAIRE.md` |
| Consent | Version 1.0.0 | `src/research/research-config.ts` `CONSENT_PROTOCOL_VERSION` |
| Participant target | 20 — **RESOLVED 2026-09-03**: researcher-confirmed as a later approved research-scope decision; Proposal/Interim02's 80-100 preserved as historical baseline, not a conflict | `docs/research/PARTICIPANT_TARGET_DECISION.md` |
| Ethics approval | `CONFIRMED_BY_RESEARCHER` — **RESOLVED 2026-09-03**; formal reference number/date/committee `TO_BE_RECORDED` (not fabricated, non-blocking) | `research/CONSENT_FORM.md`, `docs/research/FINAL_RESEARCH_CONTRACT.md` §12 |
| GA4 event schema | Version 1.0.0, implemented, not live-verified | `src/lib/analytics.ts` |
| Benchmark methodology | Version 1.0.0; controlled benchmark unchanged; real-world corpus expanded and re-run this session (15 -> 21 repos, current engine unchanged — see `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md`) | `benchmarks/ground-truth.json`, `benchmarks/real-world/` |
| Repository inclusion protocol | Version 1.0.0; **21 repos, target met** — 20-30 per Proposal §4.3 / Interim02 §3.4, 15 of the 21 primary-framework (React/Next.js/Angular) — **RESOLVED 2026-09-03 (Stage 5)** | `benchmarks/real-world/run-real-world-benchmark.ts`; `FINAL_RESEARCH_CONTRACT.md` §8; `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` |
| Expert-review protocol | **READY** — regenerated 2026-09-03 (Stage 6) from stale (25/50 rules, 21/67 fixtures) to current; 0 real submissions | `research/independent-annotation/` |
| RQ1 experiment protocol | **FROZEN.** `RQ1_PROTOCOL = CREATED`, `RQ1_INFRASTRUCTURE = READY`, `RQ1_EXPERIMENT_SCOPE = FROZEN` — framework scope: React/Next.js runtime experiment (Angular remains PRIMARY for FIGM overall but `NOT_REQUIRED_FOR_THIS_EXPERIMENT`, researcher-confirmed); network/CPU throttling profile: Lighthouse's real `desktop-config.js` preset; warm-up-run exclusion enforced. **Conditions**: CSR_LOCAL, CSR_GLOBAL, SSR_LOCAL, SSR_GLOBAL. **Warm-up**: 1 per condition. **Measured**: 10 per condition. **Expected executions**: 4 warm-up + 40 measured = 44 total. `REAL_RQ1_RUNS_COLLECTED: 0` — collection happens after this freeze, not before. | `docs/research/RQ1_EXPERIMENT_PROTOCOL.md`, `research/rq1-experiment/protocol.json`, `docs/audit/STAGE_3A_RQ1_PROTOCOL_CLOSURE_REPORT.md`, `docs/audit/STAGE_6_PRE_FREEZE_REVIEW_REPORT.md` §7 |
| Deployment version | NOT_TESTED (no live deployment access in this environment) | N/A |

## Frozen baseline summary (2026-09-03)

```
RULE_SET_VERSION: 2.1.0
PARTICIPANT_TARGET: 20
REPOSITORY_CORPUS: 21 (target 20-30, met)
PRIMARY_FRAMEWORK_DISTRIBUTION: React 5, Next.js 5, Angular 5 (Vue 3, Generic JS/TS 3 -- additional support, not primary)
RQ1_CONDITIONS: CSR_LOCAL, CSR_GLOBAL, SSR_LOCAL, SSR_GLOBAL
RQ1_WARMUP_RUNS: 1 per condition
RQ1_MEASURED_RUNS: 10 per condition
RQ1_EXPECTED_EXECUTIONS: 44 (4 warm-up + 40 measured)
CONSENT_VERSION: 1.0.0
SURVEY_VERSION: 1.0.0
ETHICS_STATUS: CONFIRMED_BY_RESEARCHER
RQ4_EXPERT_PROTOCOL: READY
HUMAN_STUDY_PROTOCOL: READY
```

## What must remain frozen now that real collection may begin

Everything in the table above, plus: no rule addition/removal, no severity change, no
scoring-formula change, no AI model/provider change, no consent-text change, no survey-item change,
no participant-target change, **without** stopping collection, documenting old/new state, affected
participants/runs, and an explicit inclusion/exclusion/restart decision (per this task's Section
32). Any such change requires a new frozen baseline (a new tag), never a silent edit to this one.

## Freeze history

1. Research-governance items (RQ set, paradigm label, repository-count target, participant target,
   ethics approval) — RESOLVED 2026-09-03 (Stage 1).
2. RQ1 FCP/TTI experiment protocol built — DONE 2026-09-03 (Stage 3); protocol/infrastructure gaps
   (framework scope, network/CPU profile, warm-up enforcement) closed — DONE 2026-09-03 (Stage 3A).
3. Dissertation Chapter 1/6 aligned to authoritative Set B wording — DONE 2026-09-03 (Stage 2).
4. Production/browser acceptance verification — DONE 2026-09-03 (Stage 4); 3 real defects found and
   fixed (see `docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md`).
5. Real-repository corpus expanded from 15 to 21 (15 primary-framework), meeting the 20-30 target —
   DONE 2026-09-03 (Stage 5).
6. Pre-freeze technical/research-integrity review — DONE 2026-09-03 (Stage 6): 0 unknown files, 0
   secret risk, one stale rule-set-version doc value found and corrected, RQ4 expert-annotation
   package found stale and regenerated, `TECHNICAL_FREEZE_READY = YES`, `EXPERIMENT_FREEZE_READY =
   YES`.
7. **This freeze**: reviewed working tree committed and tagged `research-freeze-v1` — DONE
   2026-09-03 (Stage 7). See `docs/audit/STAGE_7_EXPERIMENT_FREEZE_REPORT.md` for the exact commit
   SHAs and tag verification.
