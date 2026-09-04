# CHAPTER 4 — IMPLEMENTATION AUDIT (Stage T4, audit only)

**Status:** Audit only. No rewrite performed. All findings below trace to current source code, verified live by four independent forensic passes this session — not to any prior documentation, which was treated only as a source of claims to check, never as evidence.

---

## 0. Headline Finding

**The current Chapter 4 covers roughly one subsystem (the static-analysis parsing/rule-execution engine and a first-generation remediation sequence) accurately in shape but with almost every specific number and the entire AI-provider description stale, and is missing eleven other implementation areas entirely** — frontend/Next.js architecture, backend/API architecture, authentication/authorization, persistence/data model, admin architecture, the research-specific pipeline, deployment architecture, testing architecture, and an explicit security-scope statement. This is comparable in scale to Stage T3's finding for Chapter 3, but for implementation rather than methodology.

**The single most consequential correction:** the current draft describes the AI remediation subsystem as using **Gemini exclusively**. Current code implements a **three-provider abstraction** (Ollama, Claude, Gemini) with an explicit precedence order, plus evidence that a **fourth provider, Qwen, was built, tested, and then deliberately removed** in a real git commit. The Gemini model string the draft cites (`gemini-3.6-flash`) is genuinely current and accurate as one data point — the error is treating it as the whole system rather than the lowest-precedence of three default options.

**Second most consequential correction:** the two existing Chapter 4 files directly contradict each other on Vue's AST support status. This is now **definitively resolved from current source**: Vue SFC parsing is real-AST (via `@vue/compiler-sfc`/`@vue/compiler-dom`) for all six `FIGM-VUE-*` rules. The `chapter4_implementation.tex` claim that Vue rules remain regex-only "due to no package-registry network access" is stale — true at an earlier point, superseded since.

**Positive finding, stated up front so it isn't lost:** the remediation pipeline's deterministic-first routing, common provider interface, minimal-patch scope guard, multi-stage sandbox validation, and — most importantly — its re-scan-before-verified gate are all **real, current, and unconditionally enforced**. No code path was found anywhere that marks an AI-proposed patch "verified" without first passing a genuine re-scan through FIGM's own rule engine. This specific risk, which the audit instructions explicitly asked to check for, was **not found** in current code.

---

## 1. Current Chapter Structure

Two separate, overlapping files currently exist as "Chapter 4," neither referencing the other:

**`docs/dissertation/chapter4_implementation.md`:**
```
4.1 Analyzer System Architecture Overview
4.2 Resilient Source Code Parser Adapter
    4.2.1 Framework Detection Matrix
    4.2.2 Genuine AST Migration (Stage A: React / Next.js)
4.3 ALP Extraction Engine
4.4 Static Analyzer Rule Execution Engine
4.5 CLI Runner & Interactive Dashboard Exporters
    4.5.1 Report Exporters
4.6 AI-Assisted Remediation Sequence
```

**`docs/dissertation/chapter4_implementation.tex`:**
```
Static Rule Execution Engine (with its own, differently-worded correction narrative)
Formal Predicates for all 50 canonical rules (complete — a genuinely valuable, current asset)
Resilient Source Parsing & Diagnostics
```

## 2. Required / Expected Implementation Structure

Derived from the audit's own lettered scope (A–P) in the governing instruction, which is the closest available structural specification for this chapter:

```
A. Overall system architecture
B. Frontend architecture (Next.js / React / UI)
C. Backend / API architecture
D. FIGM scan pipeline
E. Framework parsing (React/Next.js, Angular, Vue, generic)
F. Four-layer meta-model implementation
G. Rule registry (50 rules, ruleSetVersion 2.1.0)
H. Remediation architecture
I. AI provider architecture
J. Authentication / authorization
K. Persistence
L. Admin architecture
M. Research-specific implementation
N. Deployment architecture
O. Testing architecture
P. Security scope
```

## 3. Section Mapping

| Required area | Current draft coverage | Verdict |
|---|---|---|
| A. Overall system architecture | §4.1 (analyzer-only mermaid diagram) | PARTIAL — covers only the static-analysis engine's internal layering, not the whole web application |
| B. Frontend architecture | *(absent)* | **Missing entirely** |
| C. Backend/API architecture | *(absent)* | **Missing entirely** |
| D. FIGM scan pipeline | §4.1, §4.4 | PRESENT, broadly accurate shape, needs current file/function names |
| E. Framework parsing | §4.2, §4.2.1, §4.2.2 (.md); predicate-section header (.tex) | PRESENT but **heavily stale** (see §5) and the two files **contradict each other** on Vue |
| F. Four-layer meta-model | §4.3 (ALP Extraction Engine, partial) | PARTIAL — ALP layer covered; full Domain→Concern→ALP→Rule structure not explicitly walked through in Ch4 (it lives in Chapter 3 §3.3 now) |
| G. Rule registry | §4.4 (DiagnosticReport interface); full predicate table in .tex | PARTIAL/STALE — predicate table itself is a genuine, valuable, largely-current asset (see §4); the surrounding rule-count narrative is stale |
| H. Remediation architecture | §4.6 | PRESENT, broadly accurate shape (deterministic-first, sandbox validation, sequence diagram), some detail stale (see §5) |
| I. AI provider architecture | §4.6 (folded into remediation) | **Materially wrong/incomplete** — describes Gemini exclusively; real system is a 3-provider precedence architecture (see §9) |
| J. Authentication/authorization | *(absent)* | **Missing entirely** |
| K. Persistence | *(absent)* | **Missing entirely** |
| L. Admin architecture | *(absent)* | **Missing entirely** |
| M. Research-specific implementation | *(absent)* | **Missing entirely** |
| N. Deployment architecture | *(absent)* | **Missing entirely** |
| O. Testing architecture | *(absent)* | **Missing entirely** |
| P. Security scope | *(absent)* | **Missing entirely** |

## 4. Correct Current Implementation Claims (verified accurate as written, or accurate in shape)

- The four-stage analyzer layering in §4.1's diagram (Source/Parsing → ALP → Rule Evaluation → Reporting) is structurally accurate, though the box labels now map to different/renamed current classes.
- §4.4's characterisation of `RuleExecutionEngine` as the coordinator that parses, extracts ALPs, evaluates rules, and accumulates `DiagnosticReport` records is accurate in shape (current: `RuleExecutionEngine.buildScanResult()`, `src/engine/rule-execution-engine.ts:80`).
- §4.5's CLI usage example (`figm-analyze ./src --format both --out figm-scan-report`) is **verified current and accurate**, including the `--format`/`--out`/`--threshold`/`--ignore`/`--framework` flags and the `bin`/`scripts.analyze` wiring.
- §4.6's core remediation *shape* — deterministic fixer tried first, a small fixed set of rules routed to manual review, AI reached only as the third path, every AI-authored patch passing a sandbox validation pipeline before acceptance, a bounded retry (3 attempts) with failure fed back to the model, and a genuine "no automated fix available" terminal state rather than a manufactured fallback patch — is **verified accurate**, and its self-correcting framing ("there is deliberately no fourth path... never falls back to the legacy regex-based RemediationEngine") remains true of current code.
- `chapter4_implementation.tex`'s full 50-rule formal-predicate table is a genuine, valuable, largely-current asset — every rule ID matches the current 50-rule catalogue exactly (cross-checked against Agent 1's programmatic count: PERF ×6, A11Y ×7, NEXT ×10, REACT ×11, ANG ×10, VUE ×6 = 50). This table should be preserved and reused, not rewritten from scratch, at the Chapter 4 rewrite stage.
- The general claim that Angular template markup (not just its TypeScript class body) is parsed via a real, independently-maintained parser (`angular-html-parser`, not `@angular/compiler` itself) is accurate and current, including modern `@for`/`@if`/`@switch` block syntax support — with one honestly-disclosed limitation: only an *inline* `template:` backtick property is parsed, not a separate `templateUrl` file.

## 5. Stale Claims (verified against current source; each is a distinct correction needed)

1. **"SourceParser is a resilient line/regex-based pattern scanner... ~22 independent substring/regex checks"** — STALE. Most detection now runs through real-AST builders; the regex/substring loop is a secondary, largely-dead path for React/Next.js/Angular-class-body/Vue, remaining load-bearing mainly for rule/framework combinations not yet migrated and Angular/Vue element-level checks reused from the legacy loop.
2. **"22 of 25 FIGM rules are pure regex/substring matching"** — STALE. Wrong rule-count basis entirely (current: 50, not 25); current real-AST coverage is the large majority of rule/framework pairings, not a small migrated subset.
3. **Framework Detection Matrix (§4.2.1): four frameworks via simple extension/substring checks** — STALE and materially incomplete. Current `detectFramework()` strips comments/strings before matching, detects **Next.js as a distinct framework** (via App/Pages Router file-role heuristics and `next/*` import/API hints) separately from React, detects **Svelte** (detected but explicitly unsupported, not in the old four-framework list at all), and uses structural regex (real import/call shapes, not bare substrings) for Angular and plain-JS React detection.
4. **"Only FIGM-REACT-02 is real-AST; staged migration Stage A (React/Next.js) → B → C → D → E still pending"** — STALE. The migration described as a future staged plan is, for practical purposes, complete: all 50 rules have real-AST detection on at least one eligible framework.
5. **`DiagnosticReport` interface (10 fields shown: ruleId, ruleName, domain, concern, severity, filePath, location, offendingCodeSnippet, message, remediation, standardReference)** — STALE/incomplete. Current interface (`src/types/ast-spec.ts:95-141`) has grown to include `category`, `line`/`column`, `sourceSnippet`, `recommendation`, `confidenceScore`, `evidence`, `fixAvailable`, `sourceKind` (the REAL_AST/LEGACY_TEXT_HEURISTIC provenance field — itself a significant addition not mentioned in the old interface at all), `kind`, `fixabilityStatus`, `compilerCode`, `relatedDiagnostics`.
6. **"AI-Assisted Remediation... Gemini... `GEMINI_MODEL` (default `gemini-3.6-flash`)"** — STALE/incomplete, the headline correction of this audit (see §0, §9).
7. **`chapter4_implementation.tex`'s "44 of 50 real-AST... FIGM-VUE-01/02 still regex/substring... environment had no package-registry network access"** — CONTRADICTED by current source. Vue is fully real-AST for all six rules; this was true historically (confirmed by a residual, now-dead comment in the codebase itself referencing the same "no npm registry access" limitation) but has since been resolved.
8. **`src/types/ast-spec.ts`'s own doc comment on `DetectionSourceKind`** (not a dissertation claim, but a live-code documentation lag worth flagging) still states Vue SFC and Angular template rules are `LEGACY_TEXT_HEURISTIC` — this is itself now inaccurate and should be corrected in the codebase independently of the dissertation, and should not be relied on as a source when writing Chapter 4.
9. **A residual comment block in `real-syntax-node-builder.ts` (lines ~1869-1881)** referencing "no npm registry access" for Vue is dead documentation above superseded code — not active logic, but a real internal inconsistency worth a one-line footnote if this file is quoted directly in Chapter 4.

## 6. Missing Implementation Sections (verified absent from both current files)

1. Overall system architecture beyond the analyzer engine (the web application as a whole: Next.js frontend + API layer + database, not just the static-analysis core).
2. Frontend architecture (Next.js App Router structure, route organisation, key pages).
3. Backend/API architecture (the ~38 API route groups under `app/api/`, and the end-to-end live-scan request flow).
4. Authentication/authorization (the JWT scheme, password hashing, role model, and — most importantly for this dissertation's research-integrity narrative — the research-participant/ordinary-user token isolation mechanism).
5. Persistence (Prisma/Postgres schema, the dual Supabase/JSON-file storage-provider abstraction and its fail-closed hardening).
6. Admin architecture (the admin console's tabs and its two-tier ADMIN/AUDITOR access model).
7. Research-specific implementation (participant assignment, the consent flow's two distinct mechanisms, the research-dataset inclusion filter, the PRIMARY/SECONDARY classification, and the now-existing research-dataset export route).
8. Deployment architecture (Vercel configuration, environment-variable categories, CI/CD scope and its explicit non-deployment role).
9. Testing architecture (134 test files, Node's built-in test runner, coverage categories).
10. An explicit security-scope statement for Chapter 4 specifically (supplementary product functionality, not a research contribution — already stated correctly in Chapter 1/3, but Chapter 4 is where the actual security-adjacent code would otherwise be described without this framing, so it needs restating at the point that code is discussed).
11. A definitive, current AI-provider architecture (distinct from item 4, listed separately because it requires its own subsection given its significance and the scale of correction needed — see §9).

## 7. Architecture Diagrams Required

| Diagram | Purpose | Status |
|---|---|---|
| Overall system architecture | Frontend (Next.js) ↔ API layer ↔ FIGM engine ↔ persistence (Supabase/Prisma or JSON fallback) | New — does not currently exist |
| FIGM scan pipeline (revised) | Source → framework detection → parser/AST → RuleExecutionEngine → diagnostics → remediation routing → verification → VERIFIED/REJECTED | Revise existing §4.1 diagram with current class/function names |
| AI provider selection and precedence | Ollama → Claude → Gemini → stub, with `AI_PRIMARY_PROVIDER`/`AI_FALLBACK_PROVIDER` override paths | New — the existing sequence diagram (§4.6) shows only a single "Gemini API" participant and needs the provider-selection layer inserted before it |
| Remediation and verification workflow (revised) | Deterministic router → AST/Angular-template/Vue fixers → AI-assisted path (3-provider) → sandbox validation (6 stages) → re-scan gate → VERIFIED/REJECTED | Revise existing sequence diagram |
| Authentication/session architecture | JWT issuance/verification, `kind`-claim isolation between ordinary and research-participant tokens | New |
| Research-data pipeline | Participant assignment → consent (two mechanisms) → inclusion gate → PRIMARY/SECONDARY classification → export | New |

## 8. Tables Required

- **Rule taxonomy / detection-mechanism table** — extend the existing full 50-rule predicate table (`.tex`) with a `sourceKind`/detection-mechanism column per rule×framework cell (React/Next.js/Angular-class/Angular-template/Vue/generic), since no single current table centrally tabulates this (confirmed by Agent 1: "a precise 'N of 50 are real-AST' count would require enumerating every rule×framework cell, which the source itself does not centrally tabulate").
- **AI provider comparison table** — provider name, invocation mechanism (SDK vs. HTTP), default model, precedence position, deployment-environment applicability (Ollama explicitly not production-usable on Vercel — see §13).
- **API route inventory table** — route group, purpose, auth requirement (public / authenticated / role-gated), one row per major route group (not all 38 routes individually).
- **Prisma model summary table** — model name, purpose, key fields (not every field).
- **Environment-variable category table** — category (required-production / optional-production / development-only), example variables, purpose — names and categories only, never values.

## 9. AI-Provider Reality Check

**Current architecture (verified from `src/ai/ai-provider-selector.ts`, `src/ai/providers/*`, and a live test suite):**

- Three implemented providers: **Ollama** (local HTTP API, default model tag `qwen2.5-coder:7b`), **Claude/Anthropic** (`@anthropic-ai/sdk`, default model `claude-opus-5`), **Gemini** (`@google/genai`, default model `gemini-3.6-flash`).
- Default precedence (`getActiveProvider()`): **Ollama (if configured) → Claude (if `ANTHROPIC_API_KEY` set) → Gemini (if `GEMINI_API_KEY` set) → a no-op stub** returning `AI_UNAVAILABLE` with no network call. Overridable via `AI_PRIMARY_PROVIDER`/`AI_FALLBACK_PROVIDER`, but only to a provider that is actually configured.
- Fallback-on-failure precedence: **Claude → Gemini → Ollama**, skipping the failed primary — corroborated by a live test suite (`tests/ai-provider-selector.test.ts`).
- **Qwen was built as a distinct fourth provider, tested (three dedicated test files existed), and then deliberately removed** — confirmed via `git log` showing a commit (`25a2b3c2`, message: "finalize Qwen removal, resolve provider-architecture ambiguity") that deletes `src/ai/providers/qwen-provider.ts` and its three test files. No `qwen-provider.ts` exists in the current tree; `AIProviderName` (`'CLAUDE' | 'OLLAMA' | 'GEMINI' | 'NONE'`) has no `QWEN` member.
- **The "Qwen" name that does still appear in current, live code is Ollama's default served model tag (`qwen2.5-coder:7b`)** — an open-weight model served generically through the Ollama HTTP API, not a distinct provider integration. Chapter 4 must not conflate these two facts.
- Residual dead comments in `gemini-provider.ts` reference the removed Qwen provider's historical quirks for context only — not evidence of an active Qwen code path.
- **Orphaned dependency**: `package.json` still lists `"openai": "^7.7.0"`, added in the same historical window Qwen was added, with **zero current imports anywhere in `src/`** — a dead dependency, almost certainly a leftover from the removed Qwen provider's likely OpenAI-compatible client. Worth a footnote if `package.json` is reproduced in Chapter 4, so it is not mistaken for evidence of a live OpenAI/Qwen path.
- Ollama is **explicitly documented in current, non-dissertation project docs** (`ENV_VARIABLES.md`) as not production-usable on the actual deployment target: "must never be set in a deployed environment... Vercel's serverless runtime has no network path to a local machine's Ollama instance." This directly resolves the audit's specific watch-item about local-Ollama claims not being conflated with production usability — the project's own documentation already gets this right; Chapter 4 should state it explicitly too.
- **AI output marked VERIFIED before re-scan?** — checked explicitly and **not found**. `verified: true` is set only inside a branch gated on `sandboxResult.accepted`, which itself can only be `true` after `RemediationValidator.validatePatchAsync` (a genuine re-scan through `RuleExecutionEngine`) has confirmed the original violation is gone. No code path bypasses this.

## 10. Research-Pipeline Implementation Check

All verified current and consistent with Chapters 1/3's methodology description — no drift found:

- Participant assignment: `ParticipantRepository.assignNewParticipant()` (`src/engine/participant-repository.ts`), smallest-unused-`P###`-number allocation, collision-safe against Prisma's unique-constraint error, target `HUMAN_STUDY_TARGET_PARTICIPANTS = 20` (`src/research/research-config.ts`), with the historical 85-figure explicitly documented in a code comment as superseded, not live.
- Consent: **two distinct mechanisms**, not one — (1) an anonymous session-token consent click-through (`POST /api/user-study/consent`, re-signs the participant's session JWT with `consentGiven: true`) that gates whether `log-scan` records anything at all, and (2) admin-operated reconciliation of a real external questionnaire submission against a participant code (`ParticipantRepository.setResearchStatus()`), which sets `researchStatus`/`researchConsentVerifiedAt` on the `User` row and is the actual gate for research-dataset inclusion. The consent route's own comment states it does not itself verify institutional ethics approval — consistent with Chapter 3 §3.11's `TO_BE_RECORDED` wording.
- Research-dataset inclusion filter — quoted verbatim by the investigating agent, matches Chapter 3 §3.8's stated logic exactly (participant code in the real `P001`–`P020` range, `researchStatus === 'CONSENT_VERIFIED'`, non-null `researchConsentVerifiedAt`, scan timestamp at or after consent).
- PRIMARY/SECONDARY classification — quoted verbatim, matches Chapter 3 §3.8 exactly: earliest eligible scan per `(userId, fileName)` pair is PRIMARY, later ones SECONDARY.
- **A research-dataset export route now exists** (`app/api/admin/research-dataset/route.ts`, ADMIN-only, JSON or CSV) — this did not exist at the time of the original evidence-audit stage and should be added to Chapter 4 as new, verified content. Two other, unrelated export routes exist (`app/api/export/route.ts` for per-scan reports, `app/api/export-dissertation/route.ts` for static LaTeX artifacts) and should not be conflated with the research-dataset export.

**RESEARCH_DATA_PIPELINE_ALIGNMENT: PASS** — no correction needed to Chapters 1/3's methodology description; Chapter 4 simply needs to add the implementation-level detail.

## 11. Auth/Security Check

- Custom HS256 JWT (not a third-party auth library), constant-time signature comparison, scrypt password hashing with a documented legacy-PBKDF2 upgrade path, secrets validated for minimum length and rejected if placeholder-looking outside dev/test.
- Three-role model (`ADMIN | DEVELOPER | AUDITOR`), with a documented `tokenVersion`-based logout-revocation mechanism closing a real, previously-existing gap (a captured token surviving logout).
- **Research-participant/ordinary-user token isolation is real and code-enforced**, not just documented: `verifyJWT` rejects any token carrying a `kind` claim outright, which is what prevents a research-participant session token (`kind: 'research_participant'`) from ever authenticating as a real logged-in user on an ordinary product route — the code comment explicitly frames this as the fix for a real, test-confirmed privilege-escalation bug (`tests/human-study-readiness.test.ts`).
- Root `middleware.ts` is authenticated-by-default (negative matcher) for page routes, with an explicit public-path allow-list; API-route authentication is left to each route's own `authenticateUser`/`authorizeRole` call, with CORS/OPTIONS handling applied uniformly at the middleware layer.
- Security headers (CSP, X-Frame-Options, HSTS, etc.) are set project-wide in `next.config.mjs`; CORS uses an explicit allow-list with credentials never enabled; the CSRF posture is "Bearer-token API auth (not cookie-credentialed) + strict CORS allow-list," not a dedicated CSRF-token mechanism — Chapter 4 should describe it this precisely rather than claim a token-based CSRF defence that was not found in source.
- **Stale-claim sweep result: clean.** None of "ISO verified," "WCAG compliant," "fully compliant," "Production SaaS" (as an unqualified claim about the whole system), "production-grade," or "guaranteed" were found anywhere in current, in-scope dissertation/README/architecture documentation. The only hits for any WCAG-adjacent language were in already-archived, clearly-labelled-superseded files. One item worth a light touch at Chapter 4 draft time: `prisma/schema.prisma`'s own header comment literally reads "Prisma Schema for Supabase PostgreSQL Production SaaS Platform" — not an overclaim in context (a schema-file label, not a dissertation assertion), but if this comment is ever quoted verbatim in Chapter 4, it should be paraphrased rather than reproduced as if it were this dissertation's own claim.

**AUTHORIZATION_IMPLEMENTATION_ALIGNMENT: PASS.**

## 12. Persistence/Data-Model Check

- Prisma 7.9.1, PostgreSQL datasource (Supabase in practice), confirmed via `prisma/schema.prisma`.
- Main models confirmed: `User` (including the research-participant fields), `Project`, `ScanReport`, `Notification`, `AuditLog`, `Settings`, `ApiKey`, `SavedReport`, `ResearchEvaluation`, `FrameworkBenchmark`, `AiHistory`, `ExportHistory`, `Submission`.
- Scan-history read/write path confirmed server-authoritative: `POST /api/scans` deliberately ignores any client-supplied quality score or diagnostics and re-derives them from a fresh scan server-side — a documented fix for a previously-real forgeable-history-record vulnerability.
- **The dual storage-provider abstraction (Supabase vs. JSON-file) still exists**, contrary to what might be assumed if the system were described as Supabase-only — but it is no longer a silent, accidental fallback: outside `development`/`test`, the system now **fails closed** (throws) unless either real Supabase credentials are present or `STORAGE_PROVIDER=json` is explicitly, loudly set. `GET /api/health` reports which path is actually live at runtime (`CONNECTED_POSTGRES` vs. `JSON_FILE_FALLBACK`), confirming both remain genuinely reachable, not dead code.

**PERSISTENCE_ALIGNMENT: PASS.**

## 13. Deployment Check

- Vercel confirmed as the deployment target (`vercel.json`, a populated `.vercel/` project directory indicating at least one real prior deployment, `next.config.mjs`'s Vercel-specific `outputFileTracingIncludes` handling for a sandboxed profiler script).
- Environment-variable categories confirmed (`ENV_VARIABLES.md`): required-production (JWT/refresh secrets, Supabase connection, `DATABASE_URL`/`DIRECT_URL`, `NODE_ENV`), optional-production (storage-provider override, AI provider keys/models for Claude/Gemini, analytics ID, app URL), development-only (Ollama variables, explicitly documented as never to be set in a deployed environment, plus a test-reset-token override).
- CI/CD (`.github/workflows/figm-scan.yml`) confirmed to build, run the test suite, run FIGM's own self-scan (dogfooding), upload the resulting report as an artifact, and comment on the triggering PR — **it does not itself perform deployment**; actual deployment is handled separately by Vercel's own Git integration. Chapter 4 must not describe this workflow as a deployment step.

**DEPLOYMENT_ALIGNMENT: PARTIAL** — not because anything found is wrong, but because this entire area is currently undocumented in Chapter 4 and needs to be written from scratch; nothing here contradicts existing claims (there are none to contradict), but the section itself does not yet exist, which is the same "absence, not incorrectness" pattern noted for Chapter 3's equivalent gaps.

## 14. Testing Implementation Check

- 134 test files currently in `tests/`, covering rule/AST detection, framework detection, remediation/AI fix engines (including per-provider integration tests for Claude/Gemini/Ollama), API/security (auth isolation, IDOR closures, open-redirect regression, login-timing regression, search-auth enforcement), and the research pipeline (consent gate, range guard, repeated-scan policy, participant-provisioning race, RQ1/RQ4/annotation pipeline tests).
- Test runner confirmed as **Node's own built-in test runner** (`node --test`, via `tsx` for TypeScript transpilation only), not Jest or Vitest — `package.json`'s `test` script hardcodes an explicit, enumerated file list, run at `--test-concurrency=1` (deliberately serialized, since tests share a real local JSON-file storage backend/state).

**No correction needed** — this matches what was already established in the Stage-1 evidence audit and Chapter 3's own testing-evidence citation; Chapter 4 simply needs its own implementation-focused framing of the same facts (which categories of implementation code are covered by tests, not a general testing-evidence claim).

---

## 15. Proposed Chapter 4 Rewrite Structure

```
4.1 Overall System Architecture
4.2 Frontend Architecture (Next.js App Router)
4.3 Backend / API Architecture
4.4 The FIGM Scan Pipeline
4.5 Framework Parsing
    4.5.1 React / Next.js
    4.5.2 Angular (class body and template markup)
    4.5.3 Vue.js (additional support)
    4.5.4 Generic JavaScript/TypeScript
4.6 Rule Registry and Detection-Mechanism Provenance
    (reuses/extends the existing full 50-rule predicate table from chapter4_implementation.tex)
4.7 Remediation Architecture
    4.7.1 Deterministic-First Routing
    4.7.2 AI Provider Architecture (Ollama / Claude / Gemini, precedence, and the removed Qwen provider)
    4.7.3 Sandbox Validation and the Re-Scan Verification Gate
4.8 Authentication and Authorization
4.9 Persistence
4.10 Admin Architecture
4.11 Research-Specific Implementation
4.12 Deployment Architecture
4.13 Testing Architecture
4.14 Security Scope
4.15 Chapter Summary
```

This consolidates both existing files (`chapter4_implementation.md` and `.tex`) into one, reuses the .tex predicate table as the anchor for §4.6, and adds the eleven missing areas identified in §6.

---

## Summary

```
CHAPTER_4_STRUCTURE_ALIGNMENT=PARTIAL
SYSTEM_ARCHITECTURE_ALIGNMENT=FAIL
FIGM_PIPELINE_ALIGNMENT=PASS
RULE_COUNT_CONSISTENCY=FAIL
FRAMEWORK_SCOPE_CONSISTENCY=FAIL
REMEDIATION_ARCHITECTURE_ALIGNMENT=PASS
AI_PROVIDER_DOCUMENTATION_ALIGNMENT=FAIL
AUTHORIZATION_IMPLEMENTATION_ALIGNMENT=PASS
PERSISTENCE_ALIGNMENT=PASS
RESEARCH_DATA_PIPELINE_ALIGNMENT=PASS
DEPLOYMENT_ALIGNMENT=PARTIAL
STALE_IMPLEMENTATION_CLAIMS=9
MISSING_IMPLEMENTATION_SECTIONS=11
UNRESOLVED_CHAPTER_4_ISSUES=6
READY_TO_REWRITE_CHAPTER_4=YES
```

**Notes on the ratings:**
- `FIGM_PIPELINE_ALIGNMENT=PASS` and `REMEDIATION_ARCHITECTURE_ALIGNMENT=PASS`: the *shape* of both is correct in the current draft even though specific numbers within them are stale (counted separately under `STALE_IMPLEMENTATION_CLAIMS`) — the architecture the draft describes is recognisably the current architecture, not a different one.
- `RULE_COUNT_CONSISTENCY=FAIL` and `FRAMEWORK_SCOPE_CONSISTENCY=FAIL`: both existing files still narrate a 25-rule world (or, in `.tex`'s case, an internally-inconsistent 44/50 split that is itself wrong on the Vue portion) and an incomplete framework-detection story (missing Next.js as a distinct framework, missing Svelte's detected-but-unsupported status).
- `AI_PROVIDER_DOCUMENTATION_ALIGNMENT=FAIL`: this is the headline correction (§0, §9) — not merely incomplete detail but a materially wrong picture of the system (single-provider vs. three-provider-with-precedence, plus the removed-Qwen history).
- `SYSTEM_ARCHITECTURE_ALIGNMENT=FAIL`: no current section describes the application as a whole (frontend + API + persistence), only the internal static-analysis engine.
- **Unresolved issues (6):** (1) the two `chapter4_implementation.{md,tex}` files need to be consolidated into one, not left as two parallel, non-cross-referencing documents; (2) `src/types/ast-spec.ts`'s own `DetectionSourceKind` doc comment is stale in live code, independent of the dissertation — worth flagging to the researcher as a code-hygiene item, not just a writing item; (3) the residual dead "no npm registry access" comment block in `real-syntax-node-builder.ts`; (4) the orphaned `openai` package.json dependency, worth a one-line footnote if `package.json` is reproduced; (5) a precise per-rule×framework real-AST/legacy-heuristic table does not exist anywhere and would need to be freshly compiled (a non-trivial enumeration task) rather than copied from any existing source; (6) `route.ts:20`'s `export const maxDuration = 60` comment notes this has not yet been verified end-to-end against an actual Vercel preview deployment — worth a cautious, hedged mention only if deployment timing is discussed in Chapter 4.
- `READY_TO_REWRITE_CHAPTER_4=YES`: as with Chapters 2 and 3, every open item has a concrete, evidence-backed resolution already gathered this session (four independent, code-verified investigation passes) — this is a distillation and correction task, not one requiring further research.
