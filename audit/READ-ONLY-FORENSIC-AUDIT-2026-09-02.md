# FIGM FULL FORENSIC AUDIT REPORT

**Date:** 2026-09-02
**Audit type:** Read-only forensic audit (Phases 1–30 of the commissioned audit specification), executed by 7 parallel read-only research agents plus coordinator synthesis.
**Status of this document:** This is itself Level-6 evidence (an audit claim), not Level-1 source-of-truth. Every finding below cites file/line/commit-hash evidence from a direct read at audit time; re-verify against current source before relying on any specific figure, since the codebase — per this report's own findings — has a documented history of documentation and even audit-report figures drifting out of date quickly (see Sections 26 and Contradiction C-8/C-10).

---

## 1. Executive Summary

FIGM is a substantially real system, not a mockup: the scan → parse → AST → rule-execution → deterministic-fix/AI-remediation → re-scan → verify pipeline is genuinely wired end-to-end, and no code path was found that fabricates a "verified" fix result without a real compile-and-rescan check. That said, the audit surfaces four categories of serious, evidence-backed problems:

1. **A CRITICAL, unresolved secrets exposure**: real production secrets (JWT signing secret, refresh secret, Supabase service-role key, DB URL, admin credentials) were committed in plaintext in the initial commit and remain recoverable from local git history — never purged. Supabase-side rotation is *claimed* (self-reported, not independently re-verified); JWT/refresh-secret rotation status is unverified.
2. **A documented, repeated historical pattern of fabricated research data** (participants, benchmark datasets, dashboard statistics, AI-fix results) across at least 9 distinct commits — all apparently caught and reverted, and the *current* on-disk state for participant data (0/85, explicitly labeled `NOT_COLLECTED`) is honest. But the headline "100% Precision/Recall/F1" benchmark rests on a circular, self-authored testbed the dissertation does not disclose as circular, and independent annotation is still `PENDING` with 0 submissions.
3. **Pervasive rule-count and methodology inconsistency**: the true rule count is 50 (verified in code and the canonical `figm-spec.json`), but five different documents/comments state 25, 23, or 8 — including a direct self-contradiction within Chapter 6 (RQ1 answer says 50, RQ2 answer two lines later says 25) and a methodology chapter whose formal derivation only covers 8 of the 50 rules.
4. **Structural gaps in the dissertation itself**: Chapters 1 and 2 do not exist anywhere in the repository; ethics approval status is explicitly unresolved (`NEEDS_VERIFICATION`) — a hard blocker before any real participant recruitment; the two reference-list formats disagree with each other; and an in-flight, entirely uncommitted architecture pivot (Qwen provider added in the HEAD commit, then deleted from the working tree with no commit recording either state) leaves the true current AI-provider architecture undocumented anywhere.

Positives worth stating plainly, per the audit's own no-defense/no-attack mandate: the fix-verification chain is genuinely rigorous (no fabricated "verified" path found anywhere across three independent forks that each tried to find one); every FIGM rule self-documents its own false-positive/false-negative limitation in code; RBAC/IDOR checks on API routes were spot-checked and found correct; the N=85 dashboard badge fabrication found in git history has been fixed with an honest inline comment; and the participant-data honesty (0/85, consistently reported everywhere) is a real, verifiable strength.

## 2. Audit Scope

Phases 1–30 as specified, executed via 7 parallel read-only research agents plus coordinator synthesis: (1) architecture & FIGM pipeline, (2) FIGM rule registry & false positive/negative, (3) AI provider & remediation validity, (4) security/auth/secrets/DB/API, (5) research integrity/statistics/benchmarks/usability, (6) dissertation/RQ coverage/references/data-collection readiness, (7) git history/testing/production readiness/UI claims/reproducibility. Each agent operated under identical read-only constraints and the same evidence/redaction standards.

**Explicit scope boundaries (self-disclosed by the forks, not concealed):** not every line of every file was read (e.g., `source-parser.ts` is 1357 lines, ~968 sampled; `remediation-decision.ts` internals and `checkPatchScope`'s exact heuristic were not opened; RLS policy correctness and full Prisma schema were not exhaustively verified; no test suite was executed, so all test-pass-rate claims are UNVERIFIED by this audit; no network requests were made, so live GitHub repo visibility and DOI resolution were not checked). Where a fork could not verify something, it is marked UNVERIFIED below rather than assumed true or false.

## 3. Read-Only Verification Statement

No Edit/Write/NotebookEdit tool was invoked by the coordinator or any of the 7 audit forks during the audit itself. No npm install/uninstall/update, no test execution, no benchmark/research script execution, no database writes, no git history rewrites, no commits, no deployments, and no mutating HTTP requests were made. All git inspection used read-only commands (`log`, `show`, `diff --stat`, `status`). Two forks read `.env`/`.env.local`/git-history blobs containing real secrets for detection purposes only; no secret value appears anywhere in this report or was echoed by any fork — only presence/absence and redacted markers. The working tree already contained extensive pre-existing uncommitted changes (from prior sessions, including a UI-only edit made by this same coordinator session on an earlier, separate, non-audit task) before this audit began; nothing was added, changed, or removed during the audit itself. This document is a subsequent, explicitly requested write of the audit's own findings to a new file — a distinct action from the audit process, which remained read-only throughout.

## 4. Repository Inventory

| Component | Location |
|---|---|
| Frontend (App Router) | `app/*/page.tsx` — ~25 pages incl. `live-scan`, `admin`, `analytics`, `guidelines`, `history`, `profile`, `settings`, `reports/[id]` |
| API routes | 31–33 routes under `app/api/**/route.ts` (auth, admin, dashboard, export, health, notifications, profile, projects, report, research-metrics, scan, scans, search, settings, submissions, user-study) |
| Auth/middleware | `src/auth/{auth-middleware,auth-service,rate-limiter,audit-logger,user-db}.ts`, root `middleware.ts` |
| Database | `prisma/schema.prisma`, `prisma/migrations/`, `supabase/config.toml` |
| Scanner/parser/AST | `src/parser/{source-parser,typescript-framework-parser,vue-sfc-parser,alp-extractor}.ts`, `src/ast/{ast-detection-engine,real-syntax-node-builder,universal-ast-mapper,angular-template-ast-builder,vue-framework-adapter}.ts` |
| FIGM rule engine | `src/engine/rule-execution-engine.ts`, `src/engine/diagnostic-classifier.ts`, `src/matrix/four-layer-meta-model.ts` |
| Deterministic fixers | `src/engine/{ast-fix-engine,angular-template-fix-engine,vue-fix-engine,lexical-typo-fix-engine,remediation-engine}.ts` |
| AI remediation | `src/ai/{ai-remediation-pipeline,figm-fix-pipeline,code-error-fix-pipeline,ai-provider-selector,sandbox-validation-pipeline,patch-validator,prompt-builder,remediation-decision,response-parser}.ts`, `src/ai/providers/{claude,gemini,ollama}-provider.ts` (untracked), `src/ai/providers/qwen-provider.ts` (deleted, uncommitted) |
| Sandbox | `src/engine/sandbox/`, `src/ai/sandbox-validation-pipeline.ts` |
| Benchmark/research | `benchmarks/{testbed,real-world,adversarial-real-world,complete-rule-evaluation}/`, `research/{raw,processed,analysis,anonymized,evidence,independent-annotation,user-study}/` |
| Dissertation | `docs/dissertation/chapter{3-6}*.{md,tex}` (no chapter1/chapter2), `docs/dissertation/references.md` |
| Prior audit docs (self-authored, unverified) | `audit/*.md` — multiple "forensic"/"ultimate"/"closure" reports, treated throughout as Level-6/7 claims, not evidence |
| CLI | `src/cli/`, `bin/` |
| Tests | `tests/*.test.ts` — 101 files, 51 `describe()`, 389 `it()`/`test()` static floor |
| Scripts | `scripts/` incl. `wipe-all-synthetic-data.ts`, `migrate-json-to-supabase.ts`, `seed-admin.ts`, `import-user-study.ts`, `validate-research.ts`, `compare-annotations.ts` |
| VS Code extension | `vscode-extension/` (not audited) |

## 5. Actual System Architecture

Verified end-to-end: `app/api/scan/route.ts` → `RuleExecutionEngine.buildScanResult` → `SourceParser.parseSource`/`buildASTFromCode` → `ASTDetectionEngine.evaluateNode` (50 wired predicates) → `diagnostic-classifier.ts` (authoritative `kind`/`fixabilityStatus` stamping) → client render. Fix path: `FigmFixPipeline`/`CodeErrorFixPipeline` → `AIRemediationPipeline.remediateDefect` → deterministic fixer (`ast-fix-engine.ts` et al.) or `AIProviderSelector` → `SandboxValidationPipeline` (syntax → scope → compile+rescan → optional test stage) → `verified: true` only inside a real `.isValid`/`.accepted` branch. This architecture is real; its fidelity is uneven per-rule/per-framework (Section 6).

## 6. FIGM Pipeline Verification

| Arrow | Verdict | Key evidence |
|---|---|---|
| Source → Live Scanner | **IMPLEMENTED** | `app/api/scan/route.ts:69` calls the engine on the literal submitted code, no shortcut found |
| Scanner → Real Parser/AST | **PARTIALLY IMPLEMENTED** | Real `ts.createSourceFile` only for framework/rule combinations gated true in `real-syntax-node-builder.ts`'s eligibility lists; **VUE_SFC is in none of them → 100% legacy regex/text-heuristic for all 6 Vue rules**; 4/10 Angular rules (ANG-03/04/08/10) also remain legacy-only even though Angular is an eligible framework |
| Parser/AST → Rule Engine | **IMPLEMENTED** | `evaluateNode` runs all 50 predicates recursively; confirmed real execution, not hardcoded |
| Rule Engine → Violation? | **IMPLEMENTED** | Genuine `reports.push(...)` from real predicate evaluation |
| → NO → No Issues Found | **IMPLEMENTED, with a caveat** | Honest empty-array return; but for a framework whose pseudo-AST doesn't match its real syntax (e.g. Svelte), a "clean" result can mean "no trigger pattern matched" rather than "genuinely clean" — a false-negative risk (Section 9) |
| → YES → Deterministic fix available? | **IMPLEMENTED** (routing confirmed; internal decision logic in `remediation-decision.ts` not directly read — UNVERIFIED in detail) | `ai-remediation-pipeline.ts:134,140` |
| → Deterministic Fixer → Sandbox → Re-scan → Verified/Rejected | **IMPLEMENTED** | Both deterministic and AI paths route through the identical `RemediationValidator.validatePatchAsync`; `verified: true` is set only inside an `if (verification.isValid)` branch — confirmed by full-file read, no fabricating path found |
| → NO → AI Remediation → Minimal Patch → In-Memory → Syntax → TS Compile → Scope → Re-scan → Reject/Verify | **IMPLEMENTED**, with one exception | Real bounded-retry loop against a real provider abstraction; syntax/compile/rescan stages are real (`ts` compiler, `RuleExecutionEngine` re-scan, same-`ruleId` re-check, not just "no errors"). **Exception**: `SandboxValidationPipeline.runAssociatedTestIfPresent` writes the patched candidate **directly over the real on-disk source file** for its TEST stage (restored in a `finally`), not purely in-memory — a real deviation from the "in-memory only" model, reachable only when `defect.filePath` resolves to a real in-repo file with a co-located test |

**Overall verdict**: The verification/rejection logic is genuinely sound — three independent forks each tried to find a path where `verified`/`FIXED` could be set without a real check, and none found one. The main defect is architectural coverage, not integrity: "AST-based" is true for a growing, gated subset and false (regex/text-heuristic) for the rest, most severely 100% of Vue.

## 7. Language & Framework Understanding

`detectFramework` (`source-parser.ts:470-568`) is genuine, hardened detection (word-boundary-anchored React import/hook checks explicitly fixed after a documented false-positive audit; Angular requires real syntax shapes, not substring matches). Extension-based for `.vue`/`.svelte`/`.jsx`/`.tsx`; content-based for Next.js/React/plain-TS. **Gap**: `SVELTE` is a real, distinct detected framework value, but there is no server-side `analysis`/`serviceStatus` field marking a Svelte scan as unsupported — the only "unsupported" signal is a client-side hardcoded `Set(['SVELTE'])` in `app/live-scan/page.tsx` that must be manually kept in sync with server detection. Framework-agnostic legacy regex rules will still fire against raw Svelte text (e.g. an `<img>` dimension check), while Svelte-specific event syntax (`on:click`) won't match the trigger patterns FIGM's a11y rules look for — a plausible false-negative class, inferred from code structure, not observed live (no scan was executed).

## 8. FIGM Rule Forensic Audit

Canonical registry: `figm-spec.json`, `meta.totalCoreRules = 50`, verified as the only registry (no duplicates). 12/50 rules framework-independent (PERF-01…06, A11Y-01…06); 38/50 framework-specific. **Every rule carries a self-documented `knownLimitation` field** — a genuine, code-level admission of its own FP/FN risk. Detector wiring: all 50 rule IDs confirmed wired to a real `eval<RuleID>` predicate in `ast-detection-engine.ts`. Real-AST coverage: 40/50 rules have *some* real-AST path, but gated per-framework — Vue gets zero, 4 Angular rules remain legacy-only even on an eligible framework. No stale (spec-without-detector) or duplicate rule IDs found. `docs/audit/RULE_DETECTION_MATRIX.md` (the one document explicitly designed as an authoritative TP/TN proof) is dated for a 25-rule set, 12 days stale relative to the current 50-rule `figm-spec.json` — half the rule set has no current authoritative TP/TN proof document, though scattered test coverage for the newer rules exists elsewhere.

## 9. False Positive / False Negative Risks

Concrete, code-verified (not speculative) examples:

- **FIGM-PERF-01** ("Invariant Object Allocation") sets `isInvariant: true` unconditionally for *any* `const/let/var = {` inside a loop/render scope, in both the legacy and real-AST paths — no data-flow check that the object is actually invariant. A per-item object built from the loop variable (`items.map(item => ({ id: item.id }))`) is flagged as if it were hoistable, contradicting the rule's own name.
- **FIGM-A11Y-02/04**: custom-interactive-element detection is gated by a hardcoded 3-word/2-word component-name-prefix allowlist (`['Custom','Select','Dropdown']`, `['Modal','Dialog']`) — any real-world component library using other naming conventions (`AccountPicker`, `ComboBox`, `Popover`, `Drawer`) is invisible to these rules entirely (structural false negative).
- **FIGM-A11Y-03** flags any element whose `class`/`id` merely *starts with* the string `"status"`, static or not — a purely decorative `className="status-icon-static-decoration"` is flagged as a missing-`aria-live` violation.
- **Systemic**: 100% of Vue detection runs on the legacy regex pipeline, so any FP/FN class already known to affect that pipeline elsewhere (multi-line JSX-attribute scanning, string-literal blanking edge cases) is a standing, unmitigated risk specifically for Vue since it can never benefit from the real-AST migration.
- **Svelte** (Section 7): plausible false-negative class from architecture, not directly observed.

## 10. AI Provider & Remediation Audit

**CRITICAL finding — in-flight, entirely uncommitted architecture pivot**: the current HEAD commit (`99c7213f`) *added* `src/ai/providers/qwen-provider.ts` plus three Qwen test files (641 lines). The actual working tree has since *deleted* all four files, uncommitted (`git status`: ` D src/ai/providers/qwen-provider.ts` etc.), and the Claude/Gemini/Ollama provider files that replaced it are all untracked (`??`) — never committed at all. **No commit records either the addition's removal or the replacement architecture's arrival.** Git history and actual source describe two different provider architectures.

**Three-way documentation contradiction**: `.env.example` describes Qwen as a real, precedence-ordered provider (`Ollama > Qwen > Claude > Gemini`) with a Qwen-primary/Gemini-fallback default; `ENV_VARIABLES.md` never mentions Qwen or `HF_TOKEN` at all; actual code (`ai-provider-selector.ts`) has no Qwen, precedence `Ollama > Claude > Gemini`, default fallback pairing "Claude primary / Gemini fallback." None of the three agree.

**Live-pinned configuration**: `.env.local` sets `AI_PRIMARY_PROVIDER="GEMINI"` (non-secret, safe to report), `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` both populated, `OLLAMA_*` absent. This **matches** the dissertation's RQ3 claim (Gemini, per `RESEARCH_TRACEABILITY_MATRIX.md:18` and `chapter6_conclusion.md:31`) — SUPPORTED, no contradiction on this specific point.

**Functional gap**: `AIProviderSelector.getFallbackProvider()` only special-cases `primary === 'CLAUDE'` → Gemini. With the live config pinning `primary = GEMINI`, there is no coded fallback branch — a Gemini outage/quota exhaustion goes straight to `AI_UNAVAILABLE` despite a working, credentialed Claude key being configured.

**Remediation validity chain (Phase 8)**: traced in full — prompt construction includes rule context + minimal-patch instruction + injection defense; patch extraction is real, with a disclosed recovery heuristic for a known Qwen backtick-quoting bug (now orphaned code, since Qwen is deleted — UNVERIFIED whether this dead logic still executes uselessly or was cleanly removed); syntax/TS-compile/scope/re-scan stages are all real; `verified: true` is set at exactly two call sites, both gated behind an awaited real validation result. **No fabricating path found.** The one real deviation from "in-memory only" is the TEST-stage on-disk file mutation noted in Section 6. 402/429 quota-handling code in `gemini-provider.ts` is genuine, non-comment logic — but the specific regression tests the HEAD commit's message advertises adding are among the files deleted in the working tree; equivalent Gemini-path coverage is UNVERIFIED.

## 11. Security Audit

- **DynamicProfiler** (`src/engine/dynamic-profiler.ts` + `profiler-sandbox-runner.cjs`): runs submitted code in a **disposable child OS process** (confirmed via `spawn`), not in-process. Real mitigations: curated secret-free env, capped V8 heap, 3s hard timeout + SIGKILL, output-size cap. Self-disclosed residual gap: not a true OS-level sandbox (no seccomp/container/chroot) — `fetch()` and `globalThis`/`process` remain reachable from the child, so network egress (SSRF-adjacent) is plausible from submitted code. **HIGH**, self-disclosed, partially mitigated.
- **Unauthenticated AI-cost path**: `/api/scan`'s fix-action branch (calls real AI providers) executes before `authenticateUser()`, reachable anonymously, bounded only by per-IP rate limiting (15/min). Explicitly acknowledged in the route's own comment as a real cost/abuse vector. **MEDIUM.**
- **Rate-limiting coverage gap**: only 10 of 31 routes have explicit rate limiting; most unlimited routes require auth (smaller surface) but authenticated-account abuse is unmitigated on ~21 routes. **LOW-MEDIUM.**
- **CORS**: correct hardening (explicit allow-list, no wildcard, credentials never set) but its own comment inaccurately claims no cookie-based auth exists — `auth-middleware.ts` and `middleware.ts` do support a `figm_token` cookie fallback. Net risk: none currently (credentials flag never set), but the stated reasoning is wrong. **LOW.**
- **Middleware token check is presence-only**: page-route redirect gate checks only cookie *existence*, not signature — by design, since every data-bearing API route independently verifies the JWT signature via `authenticateUser()`. **LOW/INFO.**
- **RBAC/IDOR**: spot-checked clean — every `app/api/admin/*` route uses `authorizeRole(['ADMIN'])`; `admin/users` masks API keys to last 4 chars even for admins; `scans/[id]` verifies real ownership before read/write/delete. `projects/[id]`'s equivalent ownership check was not independently re-verified (UNVERIFIED, not confirmed broken).
- **No internal/migration/debug endpoints found.**

## 12. Authentication & Authorization Audit

JWT-based, verified server-side per API call via `authenticateUser()`/`authorizeRole()`. Admin endpoints consistently role-gated. Logout previously did not revoke the stored refresh token — fixed per commit `3f151804` (git history evidence, not re-verified live). Password hashing migrated PBKDF2(10k)→scrypt per commit `c6a63b33`. IDOR vulnerabilities across dashboard/reports/projects were previously found and closed per commits `df30255b`/`5c7836ac`/`b2055d20`, one referencing a "live cross-user IDOR test" that reproduced the vulnerability pre-fix — historical evidence of both real vulnerabilities and real fixes, not independently re-exploited in this audit.

## 13. Secrets & Credential Exposure Audit

| Variable | Committed historically? | Current status |
|---|---|---|
| `JWT_SECRET` | **YES** (`98bac3f9`, untracked but not purged in `56ddcfc0`) | [EXPOSED IN FILE — VALUE REDACTED], historically. Blob still retrievable (`git show 98bac3f9:.env` succeeds). Rotation: **UNVERIFIED** |
| `REFRESH_SECRET` | YES, same commits | Same — rotation **UNVERIFIED** |
| `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`/`DIRECT_URL` | YES | Rotation *claimed* confirmed in a self-authored audit commit (`85d461a4`), via SHA-256 hash comparison to a different project — plausible methodology, **not independently re-verified** by this audit |
| Admin refresh token + password hash (`figm-user-db.json`, hardcoded password `Admin123456!`) | YES, tracked until `20e28f03` | Now gitignored; historical blob not purged |
| Current `.env`/`.env.local` | N/A | [PRESENT — REDACTED locally], correctly gitignored, not tracked |
| Ollama/Qwen vars | N/A | [ABSENT] |
| Gemini/Claude keys | N/A | [PRESENT — REDACTED] |

**The project's own security-fix commit message (`20e28f03`) explicitly states these secrets "must be treated as fully compromised" and that git-history purge plus full external rotation were still-required manual steps not performed as part of that commit.** No `filter-branch`/BFG evidence found. This is the audit's single highest-confidence CRITICAL finding.

## 14. Database / Supabase / Prisma Audit

Rate limiter and audit logging are Prisma/Postgres-backed with a graceful in-memory fallback (logged) if the DB is unavailable — good resilience. Service-role key usage appears server-side only in the sampled paths (not exhaustively verified across all of `src/storage/`). **Not independently verified in this pass**: RLS policy presence/correctness, full Prisma schema vs. `DATABASE.md` claims — flagged as a genuine gap in this audit's coverage, not a finding of absence.

## 15. API Endpoint Audit

31 routes enumerated. No undocumented/debug/temporary endpoints found. All admin routes role-gated. One MEDIUM (unauthenticated AI-cost path, Section 11), one LOW-MEDIUM (rate-limit coverage), remainder LOW/INFO. Two dashboard routes (`activity`, `frameworks`) have no auth but are documented/spot-checked as aggregate-only (sibling `statistics` route confirmed no per-scan leakage; the other two were not independently re-confirmed — UNVERIFIED, flagged not broken).

## 16. Research Integrity Audit

| Finding | Classification |
|---|---|
| Git history shows ≥9 distinct "remove fabricated X" commits (participants, 30-repo/755k-LOC eval dataset, dashboard statistics, AI-fix results, audit docs) | **RETRACTED** (historical), now reverted |
| Current dissertation explicitly self-discloses one such incident inline, naming the exact fabricated literals removed | **VERIFIED (disclosed)** |
| Current human-study dataset explicitly machine-labeled `NOT_COLLECTED`, `validParticipantCount: 0` | **SUPPORTED (honest)** |
| 50-rule, 100% P/R/F1 testbed uses fixtures/ground-truth both apparently authored by the same party, deliberately engineered to avoid incidental rule co-firing, with no disclosed independent-authorship process | **PARTIALLY SUPPORTED — undisclosed circularity risk** |
| Whether all fabrication is now exhausted, or undiscovered artifacts remain | **UNVERIFIED** (absence of evidence ≠ evidence of absence) |
| Dissertation Ch.5 says no aggregate AI-fix success-rate statistic has been computed; `benchmarks/fix-success-rate-results.json` (dated 6 days earlier) contains exactly such an aggregate (19/20 auto-verified across 50 rules, tested against each rule's own canonical example, not the ground-truth corpus) | **CONTRADICTED** (chapter text is factually overbroad, though arguably about a narrower claim than what the artifact provides) |

## 17. Data Collection Readiness Audit

**MUST FIX BEFORE DATA COLLECTION**: ethics approval status explicitly `NEEDS_VERIFICATION` (blocking); pilot testing of the 5 custom task-performance items and 7 background items (not found, absent from `research/`); a stated hypothesis-testing plan for RQ4 (not found). **CAN FIX BEFORE DATA COLLECTION**: task-count contradiction (protocol says "3 benchmark codebases," questionnaire Q9 references a singular fixture). **CAN FIX DURING**: recruitment channel/timeline plan (absent beyond inclusion/exclusion criteria). **CAN FIX AFTER/BEFORE FINAL ANALYSIS**: missing-value/outlier policy, SPSS/SmartPLS export-readiness, full reliability/validity procedure beyond the SUS instrument itself — none found. Positives: a real, substantive consent form, a real 10-item standard SUS instrument plus custom items, a real anonymization protocol (P001–P085 coding, GDPR-referenced), and real Google-Form deployment tooling all exist.

## 18. Statistical Audit

| Statistic | Claimed | Traceable? |
|---|---|---|
| Rule count = 50 | `eval-summary.json`, `ground-truth.json` | **VERIFIED** consistent across these two, but see Section 20 for the wider contradiction |
| TP/FP/FN = 65/0/0 (testbed) | `eval-summary.json:62-64` | **SUPPORTED as a real live diff**, not hand-typed — but see circularity caveat (Section 16) on its *input* |
| Precision/Recall/F1 = 100/100/100 | Dissertation Ch.5 | **SUPPORTED mechanically / CIRCULAR methodologically** |
| Fix success rate 19/20 | `benchmarks/fix-success-rate-results.json` | **SUPPORTED as real**, but tested against each rule's own canonical example, not an independent corpus; contradicts a dissertation sentence (Section 16) |
| SUS mean, Cronbach's α | 0 (PENDING) real; 86.4 / 0.892 / 0.85 synthetic-formula-test | **SYNTHETIC, explicitly labeled** as such everywhere found — **except** two different "formula test" alpha values (0.892 vs 0.85) appear within the *same* dissertation chapter for what reads as the same synthetic pass — internal inconsistency, **LOW severity** since both are non-real |
| Real-world benchmark precision/recall | Not computed | **VERIFIED absence — correctly withheld**, with an explicit statement that no exhaustive ground truth exists for that corpus |
| Participant N | Target 85 / Collected 0 | **VERIFIED — TARGET ≠ COLLECTED**, consistent everywhere |

## 19. Benchmark / Evaluation Audit

Two distinct regimes, correctly kept structurally separate: `benchmarks/testbed/` (46 self-authored, single-rule-per-fixture files, WITH ground truth) vs `benchmarks/real-world/` (5 real public repos, NO ground truth, explicitly labeled unverified tool output). **CIRCULAR VALIDATION** on the testbed (fixtures deliberately engineered around detector behavior, per the ground-truth meta note itself, e.g. adding `OnPush` specifically to avoid incidental co-firing with another rule). **INDEPENDENT VALIDATION ABSENT**: `research/independent-annotation/results/STATUS.md` confirms annotation is `PENDING`, zero submission files exist. The real-world benchmark independently found concrete false positives (FIGM-REACT-03: 4/4 spot-checked firings false; FIGM-REACT-01: 1/3) in rules the testbed scores as flawless — a genuine, disclosed tension between the two regimes that the dissertation's Chapter 5 (56 lines) does not reference or reconcile at all.

## 20. Human Participant / Usability Audit

**Actual collected participant count: 0. Target: 85. TARGET ≠ COLLECTED.** No participant response files of any kind exist on disk (only `.gitkeep` placeholders in `research/{raw,processed,anonymized}/real/`). `usability-results.json` and dissertation Chapter 6 state this identically and consistently. All SUS/Cronbach/usability/productivity/task-completion figures found are either placeholder-zero or explicitly labeled `SYNTHETIC_PIPELINE_TEST_DATA` (formula verification only) — none found mislabeled as real. This is the most consistently honest data domain in the entire project.

## 21. Research Question Coverage

| RQ | Status | Key contradiction/gap |
|---|---|---|
| RQ1 (framework-independent formalization) | **PARTIALLY ANSWERED** | Rule count stated as 50 (Ch6 L28) vs 25 two lines later (Ch6 L30) vs formal derivation covering only 8 rules (Ch3 §3.3-3.4) — three unreconciled counts |
| RQ2 (detection coverage vs. existing tools) | **PARTIALLY ANSWERED** (self-admitted) | Only a qualitative capability checklist exists; a prior quantitative comparison was explicitly retracted |
| RQ3 (AI remediation validity) | **PARTIALLY ANSWERED** | Per-fix verification mechanism is real and tested; no aggregate success-rate benchmark against a reproducible defect corpus exists (though see Section 16's contradiction re: `fix-success-rate-results.json`) |
| RQ4 (developer usability/productivity) | **NOT ANSWERED** (honestly, consistently self-disclosed) | 0/85 real participants; ethics approval unresolved is a blocking prerequisite |

`RESEARCH_TRACEABILITY_MATRIX.md` additionally labels its own RO1 and RO2 rows both "RQ1" with different question text — inconsistent with the RQ1-4 numbering used in Chapter 6.

## 22. Dissertation Audit

**Structural**: Chapters 1 and 2 do not exist anywhere in the repository — no Introduction, no Literature Review. Chapter 3 and Chapter 4 each have two files (a `.md` and a `.tex`) covering divergent content with no index clarifying which is canonical. **Content contradictions**: WCAG 2.1 AA cited once (`chapter6_user_study_and_validity.md:42`) against WCAG 2.2 everywhere else including the rule spec itself; a citation to `data/user-study-responses.json`, which does not exist anywhere in the repo; the polished `.tex` evaluation chapter (likely the actual submission document) omits a circularity/small-sample caveat that the parallel `.md` evidence-trail version includes for the identical 100/100/100 figures. **Positive**: the 0/85 participant status and prior-fabrication-retraction are stated identically and honestly across every dissertation source checked.

## 23. Cross-Document Contradiction Matrix

| ID | Claim A | Source A | Claim B | Source B | Source of truth | Contradiction | Severity | Confidence |
|---|---|---|---|---|---|---|---|---|
| C-1 | 50 rules | `figm-spec.json`, `ast-detection-engine.ts` code (50 wired predicates), `chapter6_conclusion.md:28` (RQ1) | 25 rules | `chapter6_conclusion.md:30` (RQ2, same doc, 2 lines later), `app/guidelines/page.tsx:15`, `app/reports/[id]/page.tsx:81,202`, `diagnostic-classifier.ts:15` (comment), `docs/audit/RULE_DETECTION_MATRIX.md` | Code (50) | Direct self-contradiction within one dissertation section; stale comments/UI-reasoning elsewhere | **HIGH** | High |
| C-2 | 23 rules | `source-parser.ts:3` docblock | 50 rules (actual) | same file's actual implementation | Code (50) | Docblock never updated after rule-set growth | MEDIUM | High |
| C-3 | 8-rule formal derivation | `chapter3_methodology.md` §3.3-3.4 | 50 implemented/evaluated rules | `figm-spec.json` | Code (50) | Core methodological justification accounts for only 16% of the actual rule set | **HIGH** | High |
| C-4 | Qwen is a real, wired, precedence-ordered provider | `.env.example` | No Qwen; Ollama>Claude>Gemini | `ai-provider-selector.ts` (actual code); `qwen-provider.ts` deleted in working tree | Code (no Qwen) | `.env.example` stale relative to an uncommitted removal | **HIGH** | High |
| C-5 | No mention of Qwen/HF_TOKEN ever existing | `ENV_VARIABLES.md` | Qwen was added in HEAD commit `99c7213f`, now deleted uncommitted | git history + working tree | Neither doc reflects the true in-flight state | Three-way disagreement, none authoritative | **HIGH** | High |
| C-6 | "No aggregate [fix] success rate has been computed" | `chapter5_empirical_validation_and_benchmarks.md:53` | Aggregate 19/20 fix success rate exists, dated 6 days earlier | `benchmarks/fix-success-rate-results.json` | Artifact exists; chapter text overbroad | Not silently reconciled — arguably about a narrower claim, but as literally written, contradicted | MEDIUM | High |
| C-7 | WCAG 2.1 AA | `chapter6_user_study_and_validity.md:42` | WCAG 2.2 | `figm-spec.json:21`, `chapter3_methodology.md`, `chapter4_implementation.tex:259`, `references.md` | WCAG 2.2 (majority + primary spec) | Single outlier citation | MEDIUM | High |
| C-8 | 784 tests passing | `README.md:3,47` | 389 static `it()`/`test()` floor found; 10 different values (415→1065) across audit docs over time, one doc self-contradicting internally | This audit's static grep; `audit/*.md` history | Neither independently confirmed live (no test run performed) | **CONTRADICTED / UNVERIFIED** | MEDIUM | Medium |
| C-9 | Rules PERF-03/05/06, A11Y-05/06, REACT-01/04 remain legacy-regex-only, deliberately deferred | `docs/architecture/AST_MIGRATION_MAP.md` §5 | These 7 rules have since been migrated to real AST (Group 4) | `source-parser.ts:623-629` (live code, with an explicit "Group 4" comment) | Code (migrated) | Stale architecture doc | MEDIUM | High |
| C-10 | RULE_DETECTION_MATRIX.md's TP/TN proof covers "25 rules," dated 2026-08-13 | Same doc | `figm-spec.json` generated 2026-08-25 defines 50 rules | `figm-spec.json` | figm-spec.json (current) | Authoritative-proof doc stale for half the rule set | MEDIUM | High |
| C-11 | Cronbach's α (synthetic formula test) = 0.892 | `chapter6_user_study_and_validity.md:9` | Same metric = 0.85 | `chapter6_user_study_and_validity.md:17` | Neither — both non-real | Internal inconsistency, same document | LOW | High |
| C-12 | Task protocol: "3 benchmark codebases" | `DATA_COLLECTION_PROTOCOL.md` §3.2 | Questionnaire references "the benchmark fixture" (singular) | `QUESTIONNAIRE.md` Q9 | Unclear — neither confirmed as intended design | Ambiguous participant task scope | MEDIUM | Medium |
| C-13 | IEEE reference list, entries [1]-[9], [11]-[12] | `references.md` Part A | APA reference list, 11 entries including Saurabh & Roy | `references.md` Part B | Neither — internally inconsistent | Missing entry #10; author present in one format, absent in the other | LOW | High |
| C-14 | CORS module: "no automatic credentialed cookie transmission" (implying no cookie auth exists) | `src/lib/cors.ts` comment | Cookie-based auth (`figm_token`) is actively supported | `auth-middleware.ts:21-28`, `middleware.ts:48` | Code (cookie auth exists) | Comment misdescribes mechanism; net risk nil since credentials flag never set | LOW | High |
| C-15 | Claude client is "the current, and only, AI remediation integration" | `src/ai/response-parser.ts:7` | Gemini provider also calls the same parser directly | `gemini-provider.ts:118` | Code (multiple callers) | Stale comment | LOW | High |
| C-16 | Real-world benchmark finds FIGM-REACT-03 false-positive in 4/4 spot-checked firings | `benchmarks/real-world/SUMMARY.md` | Testbed reports 100% precision including FIGM-REACT-03 | `eval-summary.json`, dissertation Ch.5 | Both true simultaneously — different corpora, unreconciled in text | Dissertation never references or reconciles the real-world findings | **HIGH** | High |
| C-17 | DynamicProfiler executes code in-process (a prior, now-superseded understanding) | Pre-audit assumption | DynamicProfiler runs in an isolated disposable child process (`spawn`) | `dynamic-profiler.ts`, `profiler-sandbox-runner.cjs`, commit `d37d1733` | Code (isolated child process) | This is a correction to a prior understanding, not a project defect | INFORMATIONAL | High |

## 24. Reference / Literature Audit

Reference list numbering gap at [10] in the IEEE format list; the APA-format list (Part B) includes a Saurabh & Roy (2022) entry absent from the IEEE list (Part A) — the two "same bibliography, two formats" lists are not actually the same. Grepping all dissertation files for in-text citations of every listed author found only "Hevner et al. (2004)" actually cited in prose anywhere in the repo — the other ~9 references (Aho, Nielson, Cousot, Bierman, Cleary, Gamma, Peffers, Wohlin, Saurabh & Roy) were not found cited in-text in any existing chapter, though this is likely partly explained by the missing Chapter 1/2 (literature review) where most would normally be discussed. One DOI (`10.1109/TSE.2020.3045612` cited for a 2022 publication) has a year mismatch between the DOI segment and the claimed publication year — flagged as UNVERIFIED, not confirmed fabricated, since no network check was performed. The origin of the 18-candidate rule pool that the 3-stage extraction protocol filters down to 8 (formally) is not documented as self-authored vs. literature-derived.

## 25. Git Forensic Audit

Confirmed via read-only `git log`: real secrets committed in the initial commit (`98bac3f9`), untracked but not purged (`56ddcfc0`), with the project's own later fix commit (`20e28f03`) explicitly stating both must be "treated as fully compromised." At least 9 distinct commits titled "remove fabricated..." spanning participant data, a 30-repo/755k-LOC evaluation dataset, dashboard statistics/badges, audit documents, and a fake AI-fix result — establishing fabrication as a recurring pattern across multiple areas and points in time, not a single incident. The database was wiped of synthetic/fabricated records at least twice (`c1cb9431`, `ff9b6778`). Separate, real security-fix commits closed: unrevoked-refresh-token-on-logout, weak password hashing (PBKDF2→scrypt), CSV formula injection, plaintext admin API keys, weak API-key randomness, and multiple IDOR vulnerabilities (one closure commit references a "live cross-user IDOR test" that reproduced the bug pre-fix).

## 26. Testing & QA Audit

Claimed test-pass counts have been restated at least 10 times across audit documents with values ranging 415→1065, one document (`ADMIN-RESEARCH-DASHBOARD-CLOSURE-REPORT.md`) self-contradicting internally (784 then 805 within the same file). The current README claims 784/784. This audit's static analysis (no execution performed) found a **floor** of 389 `it()`/`test()` call-sites across 101 files with no dynamic/loop-generated test-multiplication pattern found — meaning 784 is **not directly reconcilable** with a static read, though a live run (not performed) could plausibly reach it via mechanisms this audit didn't check (helper-function-mediated generation). **STATUS: CONTRADICTED/UNVERIFIED — no live test run was performed by this audit, so neither figure is confirmed.**

## 27. Production Readiness Audit

**Classification: RESEARCH-READY / DEVELOPMENT-READY. NOT confirmed PRODUCTION-READY.** Rate limiting is correctly DB-backed (not in-memory) for multi-instance serverless correctness — a real positive. Security headers (CSP/HSTS/Permissions-Policy) and custom error pages were added per git history (not independently re-verified). Two durability concerns found: (1) `src/auth/user-db.ts` falls back through local-JSON → ephemeral `/tmp` → `globalThis` cache — not durable across Vercel's serverless boundary if this path is ever the primary data store in production (reachability in prod is UNVERIFIED — other evidence suggests Supabase is the real backing store); (2) the sandbox validation pipeline's TEST stage writes patched code directly over the real on-disk source file, restored in a `finally` — a process kill between write and restore would leave a real project file corrupted (Section 6/10).

## 28. UI Claim Consistency Audit

The "50 rules" figure hardcoded in `app/live-scan/page.tsx` (5 places) is **verified consistent** with the canonical registry (`four-layer-meta-model.ts` also contains exactly 50 unique rule IDs) — a genuine positive finding. However, a stale "25" reference persists in a code comment in the same file (`page.tsx:1460`) and in user-facing-adjacent copy in `app/guidelines/page.tsx:15` and `app/reports/[id]/page.tsx:81,202` (whether these specific "25" references actually render to end users, vs. being internal reasoning/comments only, was not conclusively confirmed — UNVERIFIED for rendered output). Dashboard fallback patterns like `summary?.frameworkDistribution?.nextjs || 10` and a hardcoded `40%` bar width can render a plausible-looking number indistinguishable from real data when the underlying value is 0/undefined — a smaller-scale recurrence of the same fallback-masking pattern that produced the now-fixed, git-history-documented "N=85 Cohort" badge fabrication. That specific badge fabrication is confirmed removed with an honest inline comment.

## 29. Reproducibility Audit

Gaps: no evidence of a pinned AI model/provider version recorded per benchmark run (and the provider architecture itself is currently in undocumented flux, Section 10) — a re-run today would not necessarily use the same model that produced any historical AI-remediation figures. `benchmarks/eval-summary.json`/`ground-truth.json`/`benchmark-results.csv` etc. all appear to be generated outputs, repeatedly "regenerated" per commit history; whether a deterministic, seed-fixed regeneration script exists was not verified in this pass (Phase 16 territory, flagged not resolved). The test-count instability (Section 26) is itself evidence against current reproducibility of that specific claim — no document pins a commit hash alongside its stated count. The real-world benchmark's 5 public repos' continued accessibility at their referenced state was not checked (requires network access, out of scope).

## 30. Examiner / Viva Risk Audit

See Section 47 for the full ranked list. Highest-risk category by far: the rule-count self-contradiction within a single dissertation section (RQ1 says 50, RQ2 says 25 two lines later) — this is the kind of error an examiner catches by reading two consecutive paragraphs, with no need to cross-reference source code at all.

## 31. ALL CRITICAL ISSUES

| ID | Issue | Evidence |
|---|---|---|
| CRIT-1 | Real production secrets (JWT/refresh secrets, Supabase service-role key, DB URL, admin credentials) committed in plaintext in the initial commit, never purged from git history; project's own fix-commit message calls them "fully compromised"; JWT/refresh secret rotation status UNVERIFIED | `98bac3f9`, `56ddcfc0`, `20e28f03` (Sections 13, 25) |
| CRIT-2 | Undocumented, entirely uncommitted AI-provider architecture pivot — Qwen added then deleted with no commit recording either state; three sources (`.env.example`, `ENV_VARIABLES.md`, actual code) all disagree on the current provider architecture | `99c7213f`, working-tree `git status`, `.env.example` vs `ai-provider-selector.ts` (Section 10) |

## 32. ALL HIGH-SEVERITY ISSUES

| ID | Issue |
|---|---|
| HIGH-1 | Rule count self-contradicts within one dissertation section (50 vs 25, RQ1 vs RQ2) and again in the methodology chapter's formal derivation (8 of 50) — C-1, C-3 |
| HIGH-2 | Chapters 1 and 2 of the dissertation do not exist anywhere in the repository |
| HIGH-3 | Ethics approval status explicitly `NEEDS_VERIFICATION` — blocks real participant recruitment |
| HIGH-4 | Repeated historical pattern (≥9 commits) of fabricated research data across participants, benchmarks, dashboard stats, AI-fix results — now reverted, but the pattern itself is a real examiner-risk topic |
| HIGH-5 | Headline 100% P/R/F1 benchmark is circular by construction (self-authored, detector-aware fixtures); independent annotation is 0/PENDING; dissertation does not disclose the circularity, nor reference the real-world benchmark's contradicting false-positive findings for the same rules — C-16 |
| HIGH-6 | DynamicProfiler sandbox self-discloses it is not a true OS-level sandbox; network egress via `fetch()` is plausible from submitted/AI-patched code |
| HIGH-7 | AI-remediation sandbox's TEST stage writes patched candidate code directly over the real on-disk source file (restored in `finally`) — a crash mid-window leaves a real project file corrupted |
| HIGH-8 | 100% of Vue rule detection and 4/10 Angular rules run on legacy regex/text-heuristic pseudo-AST, never real parsing, despite the project's broader "AST-based detection" framing |
| HIGH-9 | Concrete, code-verified false positive/negative classes in FIGM-PERF-01, FIGM-A11Y-02/03/04 (self-documented in the rules' own `knownLimitation` fields, but not flagged as a research-validity caveat in the dissertation's precision/recall claims) |

## 33. ALL MEDIUM-SEVERITY ISSUES

Unauthenticated AI-cost path in `/api/scan` (MEDIUM); rate-limiting coverage gap across ~21/31 routes (LOW-MEDIUM); test-count contradicted/unverified — 784 claimed vs. 389 static floor, 10 different historical values (MEDIUM); `user-db.ts` ephemeral-storage fallback chain, reachability in prod UNVERIFIED (MEDIUM); WCAG 2.1 vs 2.2 citation mismatch (MEDIUM); stale `AST_MIGRATION_MAP.md` vs. actual migrated-rules code (MEDIUM); stale `RULE_DETECTION_MATRIX.md` covering only half the current rule set (MEDIUM); dissertation Ch.5 overbroad "no aggregate fix success rate computed" claim contradicted by a dated artifact (MEDIUM); dashboard fallback values (`|| 10`, hardcoded `40%`) that can render indistinguishably from real data (MEDIUM); task-count contradiction between data-collection protocol and questionnaire (MEDIUM); pilot-testing of custom questionnaire items absent (MEDIUM); no stated hypothesis-testing plan for RQ4 (MEDIUM); provider-fallback functional gap — live-pinned Gemini has no coded fallback despite Claude being configured (MEDIUM).

## 34. ALL LOW-SEVERITY ISSUES

Stale rule-count comments (23, 25) in source headers with no functional impact; internal Cronbach's-α inconsistency (0.892 vs 0.85) within one synthetic-test-only dissertation passage; CORS-comment mechanism misdescription (net risk nil); stale "Claude is the only integration" code comment; reference-list numbering gap ([10] missing) and format disagreement (IEEE vs APA); DOI/year mismatch (UNVERIFIED, not confirmed fabricated); middleware presence-only cookie check (by-design, mitigated at API layer); `projects/[id]` ownership check not independently re-confirmed (not confirmed broken, just unchecked); two dashboard routes with no auth but plausible aggregate-only design (not independently re-confirmed).

## 35. Complete Evidence Matrix

Consolidated across all 7 fork reports (Sections 6, 8-22 above) — every finding in Sections 31-34 traces to a specific file/line or commit hash cited in its originating section. No finding in this report lacks a citation; where a fork could not obtain direct evidence, it is explicitly marked UNVERIFIED in the relevant section rather than asserted.

## 36. Complete Contradiction Matrix

See Section 23 (C-1 through C-17) — the full matrix, not reproduced twice.

## 37. Complete Statistical Verification Matrix

See Section 18.

## 38. Complete RQ Coverage Matrix

See Section 21.

## 39. FIGM Claim vs. Actual Implementation Matrix

| Claim | Actual |
|---|---|
| "Real AST-based detection" | TRUE for a growing, framework/rule-gated subset (React/Next JSX, Angular class-body, general JS); FALSE (regex/text-heuristic) for 100% of Vue and 4/10 Angular template rules |
| "Deterministic fix, verified by re-scan" | TRUE — no fabricating code path found across 3 independent forks' attempts |
| "AI remediation validated before acceptance" | TRUE for the validation gate logic; ONE exception — TEST stage mutates the real source file in place rather than staying purely in-memory |
| "50 canonical FIGM rules" | TRUE in code/spec; documentation and even the dissertation itself variously say 50/25/23/8 |
| "Unsupported frameworks handled gracefully, never presented as clean" | TRUE client-side (explicit UI messaging); the honesty contract is enforced only by a hardcoded client-side set, not a server-side signal |
| "AI provider: Gemini" (dissertation RQ3) | TRUE, matches live-pinned config — but the broader provider architecture is in undocumented flux (Qwen added/removed uncommitted) |

## 40. Research Integrity Status

**Historical**: RETRACTED fabrication pattern, now reverted (≥9 commits). **Current**: participant data SUPPORTED as honest; benchmark headline statistic PARTIALLY SUPPORTED with an undisclosed CIRCULAR-VALIDATION risk; independent annotation UNVERIFIED/PENDING (0 submissions); one dissertation statement CONTRADICTED by a dated artifact. No evidence found of *currently* fabricated data being presented as real anywhere this audit looked — but coverage was not 100% exhaustive (each fork explicitly flagged its own scope boundaries), so absence of further findings is not proof of absence.

## 41. Data Collection Blocking Issues

Ethics approval (`NEEDS_VERIFICATION`) — hard blocker. Pilot testing of custom questionnaire items — should precede real recruitment. Hypothesis-testing plan for RQ4 — ideally pre-registered before data collection, not decided post-hoc.

## 42. Priority 1 — MUST FIX BEFORE DATA COLLECTION

| ID | Issue | Why | Dependency | Risk if ignored | Difficulty |
|---|---|---|---|---|---|
| P1-1 | Confirm/obtain ethics approval | Currently explicitly unresolved | None | Data collected without approval may be unusable/non-compliant | Institutional process, not technical |
| P1-2 | Pilot-test the 5 custom task items + 7 background items | Only the 10-item SUS block is externally validated | P1-1 | Unreliable/invalid custom-item data undermines RQ4 | Low-medium |
| P1-3 | Resolve task-count contradiction (3 codebases vs. singular fixture) | Ambiguous participant task scope | None | Inconsistent task conditions across participants | Low |
| P1-4 | Define a hypothesis-testing / statistical-analysis plan for RQ4 | None found | None | Post-hoc analysis choices are harder to defend | Medium |

## 43. Priority 2 — MUST FIX BEFORE FINAL SUBMISSION

| ID | Issue | Why | Difficulty |
|---|---|---|---|
| P2-1 | Reconcile the 50/25/8 rule-count contradiction across Ch.6, Ch.3, and UI/comment copy | Direct, page-level self-contradiction an examiner will catch immediately | Low (documentation only) |
| P2-2 | Write Chapters 1 and 2 (Introduction, Literature Review) | Currently absent entirely | High |
| P2-3 | Disclose the testbed's circular-validation risk explicitly in Ch.5, and reconcile it against the real-world benchmark's false-positive findings for the same rules | Undisclosed limitation on the headline statistic | Medium |
| P2-4 | Resolve WCAG 2.1 vs 2.2 citation mismatch | Standards-consistency error | Low |
| P2-5 | Reconcile the two reference-list formats (missing [10], Saurabh & Roy present/absent) | Bibliography integrity | Low |
| P2-6 | Correct the overbroad "no aggregate fix success rate computed" sentence in Ch.5 §5.3, or clarify its precise scope relative to `fix-success-rate-results.json` | Contradicted as literally written | Low |
| P2-7 | Verify/rotate JWT_SECRET and REFRESH_SECRET (Supabase rotation is claimed; these two are not documented as rotated) | CRITICAL security exposure | Low-medium (rotation itself), but requires external coordination |
| P2-8 | Resolve the Qwen provider architecture ambiguity — either commit its removal and update `.env.example`/`ENV_VARIABLES.md`, or restore and document it | Currently three sources disagree on ground truth | Low |
| P2-9 | Update `AST_MIGRATION_MAP.md` and `RULE_DETECTION_MATRIX.md` to reflect the current 50-rule, Group-4-migrated state | Both are stale relative to code | Low-medium |
| P2-10 | Pin a commit hash to any test-count or benchmark figure quoted in the dissertation | Figures have been restated ~10 times with no anchor | Low |

## 44. Priority 3 — POST-SUBMISSION / NON-BLOCKING

Fix the AI-remediation sandbox's TEST-stage in-place file mutation to use a temp-dir copy consistently with its other stages; add a coded fallback branch for `primary === 'GEMINI'`/`'OLLAMA'` in `AIProviderSelector`; extend rate limiting to the remaining ~21 unlimited routes; verify `user-db.ts`'s reachability in the actual production deployment and remove the ephemeral fallback tiers if unreachable; correct the stale CORS/response-parser comments; investigate the Svelte server-side "unsupported" signal gap; broaden FIGM-A11Y-02/04's component-name detection beyond a 2-3-word hardcoded prefix list; add data-flow awareness to FIGM-PERF-01's invariance check.

*(None of the above were implemented as part of this audit — report only, per the audit's absolute no-change rule.)*

## 45. Final Readiness Scores

| Dimension | Score (0-100) | Basis |
|---|---|---|
| 1. Research Design Integrity | 55 | Real RQs, real instruments; undermined by rule-count self-contradiction and undisclosed benchmark circularity |
| 2. Literature Review | 15 | Chapters 1-2 absent; only 1 of ~11 references found cited in-text anywhere in the repo |
| 3. Methodology | 45 | Formal derivation covers only 8/50 rules; task-count ambiguity; no pilot testing documented |
| 4. Data Integrity | 60 | Current data honestly labeled; historical fabrication pattern is a real, documented precedent |
| 5. Statistical Analysis | 40 | No hypothesis-testing plan found; synthetic-vs-real boundary is honestly maintained where checked |
| 6. Measurement Model | 50 | SUS is validated; custom items unpiloted |
| 7. Structural Model | 30 | No real participant data exists yet to fit a structural model against |
| 8. Results–Discussion Consistency | 40 | Direct in-document contradictions (rule count, WCAG version, fix-success-rate claim) |
| 9. Conclusion Validity | 45 | RQ4 correctly stated as unanswered; RQ1/RQ2 conclusions rest on contradicted figures |
| 10. Reference Quality | 35 | Two reference-list formats disagree; sparse in-text citation; one DOI/year mismatch unverified |
| 11. Technical Implementation | 70 | Pipeline is substantially real and well-verified end-to-end; genuine engineering quality in the fix-verification chain |
| 12. FIGM Validation Evidence | 40 | Real testbed diff, but circular; independent annotation 0/PENDING; real-world benchmark contradicts headline claim without reconciliation |
| 13. Security | 45 | CRITICAL unrotated/unverified historical secret exposure; otherwise generally solid RBAC/IDOR/CORS engineering |
| 14. Reproducibility | 35 | No pinned model versions; generated-only benchmark artifacts; unstable test-count claims |
| 15. Data Collection Readiness | 30 | Ethics approval unresolved (hard blocker); good instrument/consent/anonymization infrastructure otherwise |
| 16. Viva Readiness | 30 | Multiple immediately-catchable self-contradictions (rule count, WCAG version) in the polished chapters |
| 17. Production Readiness | 40 | Solid rate-limiting/security-header engineering; unresolved durability/sandbox edge cases |

**OVERALL READINESS SCORE: 42/100** (unweighted mean of the 17 dimensions). This reflects a project with genuinely strong core engineering (the FIGM pipeline itself, dimension 11, is the clear high point) dragged down heavily by dissertation-document-layer inconsistencies that are all individually low-to-medium effort to fix, plus one unresolved CRITICAL security item and one structurally absent literature review. The score is not a judgment on whether the software "works" — it substantially does — but on whether the combined project is ready for viva/submission/data-collection in its current state. It is not.

## 46. Final Submission Readiness

**NOT READY.** Priority 1 items (Section 42) block real data collection. Priority 2 items (Section 43) — most of which are documentation-only, low-to-medium effort — block a defensible submission, since several (rule-count self-contradiction, missing Ch.1/2, WCAG mismatch) are the kind of error an examiner catches within the first page of reading, independent of any deeper technical scrutiny.

## 47. Top 20 Examiner Challenges

1. "Your RQ1 answer says 50 rules; your RQ2 answer, two lines later, says 25. Which is it?" — **NOT DEFENSIBLE** as currently written.
2. "Your formal rule-derivation methodology (§3.3-3.4) only covers 8 rules. How do the other 42 rules follow the same scientific process?" — **NOT DEFENSIBLE** without additional documentation.
3. "Where are your Introduction and Literature Review chapters?" — **NOT DEFENSIBLE**; they don't exist.
4. "Your 100% precision/recall claim — who wrote the ground truth, and who wrote the detector?" — **PARTIALLY DEFENSIBLE**: the same codebase/researcher did both, fixtures were deliberately engineered around known detector behavior; independent annotation is still pending with zero submissions.
5. "Your own real-world benchmark found FIGM-REACT-03 to be a false positive in 4 of 4 cases — how does that square with 100% precision on the same rule in your testbed?" — **PARTIALLY DEFENSIBLE**: different corpora, but the dissertation never raises or reconciles this itself.
6. "How many real human participants have you collected?" — **DEFENSIBLE**: honestly, consistently stated as 0/85 everywhere.
7. "Is your ethics approval confirmed?" — **NOT DEFENSIBLE** as currently documented (`NEEDS_VERIFICATION`).
8. "Your git history shows at least 9 separate incidents of fabricated data being added and later removed. Why did this happen repeatedly, and how do you know it's not still happening somewhere undetected?" — **PARTIALLY DEFENSIBLE**: each incident is documented and reverted, but the pattern itself demands a direct, prepared answer.
9. "Real secrets were committed to your git history and never purged — are they still valid?" — **NOT DEFENSIBLE** without confirming rotation of JWT_SECRET/REFRESH_SECRET specifically.
10. "You cite WCAG 2.1 AA in one place and WCAG 2.2 everywhere else — which standard does your tool actually implement?" — **NOT DEFENSIBLE** as an inconsistency, though easily fixed.
11. "Which AI model actually produced your remediation results — is it still the same one today?" — **PARTIALLY DEFENSIBLE**: Gemini matches current live config, but the provider architecture is in undocumented, uncommitted flux (Qwen added then deleted).
12. "How many tests actually pass right now?" — **NOT DEFENSIBLE** with a single number; the figure has been restated ~10 times with no commit-hash anchor, and this audit's static count doesn't match the current README claim.
13. "Is your AST-based detection real for every framework you claim to support?" — **PARTIALLY DEFENSIBLE**: true for React/Next/Angular-class-body with caveats; false (regex-only) for 100% of Vue.
14. "Walk me through a case where your tool would produce a false positive." — **DEFENSIBLE**: the codebase self-documents these per-rule (`knownLimitation`), and this audit reproduced concrete examples.
15. "Is a 'verified' fix in your system ever set true without actually re-scanning the code?" — **DEFENSIBLE**: no such code path was found across three independent audit passes.
16. "Your reference list has two different formats that don't match each other — which is correct?" — **NOT DEFENSIBLE** as currently written.
17. "You cite a data file, `data/user-study-responses.json`, that doesn't exist in your repository." — **NOT DEFENSIBLE**.
18. "Does your AI-remediation sandbox ever touch real project files on disk?" — **PARTIALLY DEFENSIBLE**: mostly in-memory, but one stage writes the real source file in place and restores it.
19. "Is your code-execution sandbox for scanning user-submitted code actually isolated?" — **PARTIALLY DEFENSIBLE**: runs in a disposable child process (real isolation from the main server), but self-admits no OS-level sandbox (network egress plausible).
20. "What is your actual statistical analysis plan for the usability study once you do collect data?" — **NOT DEFENSIBLE**: no hypothesis-testing or missing-data/outlier policy document was found.

## 48. Final Verdict

FIGM's core technical claim — a real, AST-informed static analysis engine with a genuinely verified deterministic-and-AI-assisted remediation pipeline — holds up well under forensic scrutiny; this is the project's strongest asset and should be presented with confidence. Everything above the code layer — the dissertation's internal consistency, the benchmark's disclosed circularity, the reference list, the security posture of the git history, and the currently-unresolved ethics-approval status — is not yet in a defensible state for either data collection or final submission. None of the identified issues appear to require re-architecting the system; the majority are documentation reconciliation, disclosure, and process-completion items of low-to-medium difficulty. The one item that cannot be resolved by writing — confirming or rotating the historically-exposed JWT/refresh secrets — should be treated as the single most urgent action item in this entire report.

---

**Final verification (per the audit's 16-point checklist):** No project files were modified, created, or deleted during the audit itself (this document is a separate, subsequently-requested write of the completed findings). No environment variables were changed. No packages were installed/updated/removed. No migrations were executed. No database mutation occurred. No deployment occurred. No credential value was exposed anywhere in this report — all secrets are represented only via the specified redaction markers. Every CRITICAL/HIGH issue above carries file/line/commit-hash evidence from a fork's direct read. Every contradiction in Section 23 names both sources. Every statistic in Section 18 states its source and traceability status. The participant count (0/85) is based solely on actual collected-data artifacts, never inferred from the target sample size. Synthetic data is labeled SYNTHETIC/PLACEHOLDER throughout, never treated as real evidence. Contradictions were reported as-is, not silently reconciled. This report includes all issues discovered across all seven forks' scopes, not only the highest-severity subset — lower-severity and informational items are enumerated in Sections 33-34 and throughout Sections 6-29 rather than omitted.

**READ-ONLY FORENSIC AUDIT COMPLETE — NO PROJECT CHANGES MADE** *(during the audit itself; this file is the requested persisted record of its findings).*
