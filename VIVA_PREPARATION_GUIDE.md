# FIGM Code Inspector — Viva Voice Preparation Guide

Comprehensive defense guide containing 20 common viva questions and model answers, reconciled
against the current, live state of the codebase (`docs/evidence/research-claim-traceability.md`).
**Every numeric claim below is either currently reproducible by a real command, or explicitly
marked as not-yet-collected/future work.** Do not state a more impressive-sounding number than
what appears here — an examiner who asks a follow-up question will find the real figure in the
live `/analytics` page or `docs/evidence/canonical-evaluation.json` in under a minute.

---

## 1. Top 20 Viva Questions & Model Answers

### Q1: What is the core problem that your research addresses?
**Model Answer**: Modern Single-Page Application (SPA) development relies on diverse frontend frameworks (React, Next.js, Angular, Vue). Each framework introduces unique performance bottlenecks and accessibility defects. Traditional static analysis tools (e.g., ESLint, SonarQube, Lighthouse) operate on framework-specific rule sets without a unified quality taxonomy, leading to fragmented guideline enforcement and limited framework portability. FIGM addresses this by providing a Framework-Independent Guideline Model operating on a 4-layer meta-model (Domain → Concern → Abstract Language Primitive → Rule).

### Q2: What are your primary Research Objectives (ROs)?
**Model Answer**:
- **RO1**: Formalize a framework-independent taxonomy of 25 performance and accessibility guidelines.
- **RO2**: Develop an Abstract Language Primitive (ALP) protocol to normalize detection across React, Next.js, Angular, and Vue.
- **RO3**: Build an automated static inspection engine and empirically measure its detection accuracy against hand-labelled ground truth.
- **RO4**: Design a contextual Gemini AI remediation pipeline that generates and *verifies* patches (re-scans the patched code and only reports success if the original violation is confirmed gone).
- **RO5**: Implement a multi-tenant SaaS-architected platform backed by Supabase PostgreSQL and Prisma ORM. *(If asked "is it live in production serving real users?": the architecture is genuinely multi-tenant with real auth and application-layer tenant isolation (not Postgres RLS), but there is no public production deployment with real paying users — say so plainly rather than implying otherwise.)*

### Q3: What is Design Science Research Methodology (DSRM)? How did you apply it?
**Model Answer**: DSRM is a rigorous software engineering research methodology comprising 6 phases:
1. **Problem Identification**: Identifying framework fragmentation in web quality tooling.
2. **Objectives of a Solution**: A framework-independent rule engine, measured empirically rather than assumed correct.
3. **Design & Development**: Creating the 4-Layer Meta-Model, the real-AST detection pipeline (TypeScript compiler API), and the Rule Engine.
4. **Demonstration**: Building the web inspector, project workspace, and live scan/remediation flow.
5. **Evaluation**: An automated ground-truth benchmark against 4 hand-authored, multi-framework fixture files (React, Vue, Angular, vanilla JS) — see Q10/Q11 for the honest scope of this. *(If asked "did you evaluate against real open-source repositories?": no — that was investigated, found not to be backed by any real scan, and explicitly retracted from the dissertation. Say this directly if asked; do not imply a large-scale evaluation occurred.)*
6. **Communication**: Dissertation chapters generated directly from the live evaluation pipeline (not hand-typed), plus this defense.

### Q4: How does the Abstract Language Primitive (ALP) extraction work?
**Model Answer**: `ALPExtractionEngine` and `RuleExecutionEngine` operate on a normalized `ASTNode` shape. For 23 of the 25 rules, on React/Next.js/plain JS-TS/Angular-class-body files, this shape is populated by walking a **real `ts.SourceFile` from the TypeScript compiler API** (`src/ast/real-syntax-node-builder.ts`, `src/parser/typescript-framework-parser.ts`) — not Babel, and not a synthetic/regex-only tree. The remaining 2 rules (Angular template markup: `*ngFor` trackBy, template method calls) and every rule on Vue SFC files still use a text/regex heuristic, because parsing Angular/Vue template grammar would require adding `@angular/compiler`/`@vue/compiler-sfc` as new dependencies — a deliberate, documented scope boundary, not an oversight. Every diagnostic is labeled with which mechanism produced it (`sourceKind: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC'`).

### Q5: What is the 4-Layer Meta-Model structure?
**Model Answer**:
1. **Domain Layer**: Quality attributes (PERFORMANCE, ACCESSIBILITY).
2. **Concern Layer**: Specific sub-concerns (e.g., INVARIANT_ALLOCATIONS, KEYBOARD_ACCESSIBILITY).
3. **ALP Primitive Layer**: Structural AST targets (`ObjectExpression` in loop scope, `JsxAttribute`, etc.).
4. **Guideline Rule Layer**: Precise execution logic and remediation instructions (e.g., `FIGM-PERF-01`).

### Q6: How does the AI Remediation Pipeline operate, and how do you know a "fix" actually worked?
**Model Answer**: When a diagnostic is identified, `AIRemediationPipeline` builds a structured prompt with the offending code, its location, and the rule's remediation guidance, queries the Gemini API for a patch, and validates it. Critically, validation is not just "did the API return something syntactically valid" — `RemediationEngine.validatePatch()` **re-scans the patched code with the same live engine** and only reports `FIXED` if the original rule ID is confirmed gone from the new diagnostics; otherwise it reports `PATCH_REJECTED`/`UNRESOLVED`/`MANUAL_REVIEW_REQUIRED`. For rules where a safe automated fix isn't reliably inferable (e.g. one requiring a correct `useMemo`/`useCallback` dependency array), the pipeline deliberately returns `MANUAL_REVIEW_REQUIRED` rather than generating a plausible-looking but potentially wrong patch.

### Q7: Explain the StorageProvider pattern and why it was used.
**Model Answer**: The StorageProvider pattern encapsulates data persistence behind an `IStorageProvider` interface. `RepositoryFactory` selects `SupabaseStorageProvider` when cloud environment variables are configured, and falls back to `JsonStorageProvider` locally — allowing local development without a configured cloud database.

### Q8: What database technologies are used in the platform?
**Model Answer**: Supabase PostgreSQL for cloud persistence via Prisma ORM, with tenant isolation enforced at the application/repository authorization layer (every query explicitly scoped by the authenticated request's `userId`, not by Postgres Row-Level Security), and a local JSON-file fallback (`figm-user-db.json`) for offline development.

### Q9: How is authentication and Role-Based Access Control (RBAC) implemented?
**Model Answer**: Passwords are salted (16-byte random salt) and hashed with PBKDF2-SHA512. Authentication issues HMAC-SHA256 JWT access tokens and refresh tokens. RBAC enforces 3 roles: `ADMIN`, `DEVELOPER`, and `AUDITOR` (`src/auth/user-db.ts::UserRole`). *(If asked about a past security finding: an earlier version had a predictable JWT-secret fallback and allowed a caller-controlled role claim; both were fixed — the app now fails closed when required secrets are missing and derives role only from trusted stored user data, never from a client-supplied claim.)*

### Q10: What empirical benchmark dataset was evaluated?
**Model Answer**: A hand-authored, multi-framework ground-truth fixture set in `benchmarks/testbed` (21 files — 20 flat + 1 nested App Router fixture, spanning React, Next.js, Vue, Angular, and vanilla JS), hand-labelled with **40 known violations** (`benchmarks/ground-truth.json`), covering **all 25 canonical rules**. *(`FIGM-NEXT-03` — the one rule that initially resisted file-based coverage, since its real detector requires a literal Next.js App Router `app/<segment>/page.tsx` path — was closed by extending `EvaluationRunner`'s file discovery from a flat to a recursive directory walk and adding a genuinely nested fixture; it is also independently verified via the separate `benchmarks/complete-rule-evaluation/` case dataset. Extending real-world-repository evaluation is still explicit future work.)*

### Q11: What were the precision, recall, and F1-score results?
**Model Answer**: On that full 25-rule, 40-violation ground truth: **Precision = 100%, Recall = 100%, F1-Score = 100%** (40 True Positives, 0 False Positives, 0 False Negatives — reproducible via `npm run research:evaluate`, live in `/analytics`). Two of the True Positives were previously undisclosed baseline false positives (`FIGM-PERF-05` on `ReactBenchmark.jsx`, `FIGM-ANG-02` on `AngularBenchmark.component.ts`) that existed in the source all along but were only labelled once ground-truth coverage was extended to those rules and the violations were directly source-verified as genuine, not detector bugs. *(These numbers must be quoted from `docs/evidence/canonical-evaluation.json` at defense time, not memorized — always confirm against the live artifact rather than this document.)*

### Q12: What is the AST inspection latency / throughput?
**Model Answer**: Scan throughput is computed live from the same benchmark run and reported as LOC/second (varies modestly run-to-run due to JIT warm-up; see `/analytics` for the current figure). No fixed "average per-file millisecond" latency claim is asserted — the honest unit of measurement here is aggregate throughput across the fixture set, not a stable per-file constant.

### Q13: How did you measure user usability and reliability?
**Model Answer**: A developer usability survey (target N=85) was designed with a scoring pipeline (SUS score, Cronbach's α) implemented and formula-verified against explicitly-labelled **synthetic test data** — never presented as real results. **0 of 85 real participant responses have been collected.** Real Cronbach's α and SUS scores do not currently exist and will only be reported once real responses are imported via `npm run research:user-study:import`. *(If pressed on why there is no usability result: state plainly that data collection has not yet occurred — this is documented as PLANNED, not fabricated as complete.)*

### Q14: How does FIGM prevent XSS vulnerabilities in export reports?
**Model Answer**: The `escapeHtml()` utility escapes dynamic strings (`fileName`, `framework`, `offendingCodeSnippet`, `remediation`) before injecting them into HTML/PDF template strings.

### Q15: What standard references are mapped to your guideline rules?
**Model Answer**: ISO/IEC 25010 (Performance Efficiency) for performance rules, and WCAG 2.2 (specific Success Criteria per concern, not a single blanket reference) for accessibility rules — see `src/matrix/standard-clause-mapping.ts`.

### Q16: How is real-time functionality implemented?
**Model Answer**: `RealtimeService` (`src/storage/realtime-service.ts`) implements a real Supabase Realtime `postgres_changes` WebSocket channel subscription for scan-completion and notification events. It is implemented but not yet wired into any page's UI, however -- if asked directly, say so plainly: the dashboard currently receives updates via normal request/response refreshes, not a live push, and connecting `useRealtime` (`src/hooks/useRealtime.ts`) to the dashboard/notifications components is future work, not a shipped user-facing feature.

### Q17: What automated test coverage exists in the codebase?
**Model Answer**: The current test suite (`npm test`) runs **848 automated tests across 74 suites** (last verified 2026-08-25; confirm the live count at defense time — `npm test`'s own summary line is the source of truth, this number changes as the suite grows). Covers unit rule-detection tests (positive/negative/boundary/adversarial/malformed/regression per rule), API security tests, live-scan end-to-end tests, and research-metrics consistency guards. *(If asked about the pass rate: as of 2026-08-25 there is one known, pre-existing, unrelated intermittent failure in `tests/participant-matrix-n-plus-1.test.ts` — a duplicate-email unique-constraint collision, consistent with test-isolation state rather than a real product defect — say so plainly rather than claiming 100%.)*

### Q18: What is the main research novelty of your work?
**Model Answer**: FIGM combines a framework-independent 4-layer rule taxonomy with a real-parser-backed detection engine (not a purely synthetic/regex "AST") and an AI remediation pipeline that verifies its own fixes by re-scanning — each finding is honestly labeled with its actual detection mechanism and confidence basis rather than presented uniformly.

### Q19: What are the main limitations of your research?
**Model Answer**:
1. Static analysis cannot detect dynamic runtime state changes or network-dependent behavior.
2. The empirical ground-truth benchmark now covers all 25 rules (including `FIGM-NEXT-03`, closed via a recursive testbed-directory walk and a nested App Router fixture). Remaining scope limitation: only 4/25 rules have MULTIPLE independent fixtures per rule; most have exactly one positive example.
3. 2 of 25 rules (Angular template markup) and all rules on Vue SFCs still use text-heuristic rather than real-AST detection, pending a template-compiler dependency decision.
4. No large-scale/real-world-repository evaluation has been performed.
5. No human usability data has been collected yet (0/20; target revised from an earlier 85 per the supervisor's latest instruction).
6. AI remediation depends on Gemini API availability (mitigated by a deterministic fallback engine, but the fallback's own aggregate success rate has not been empirically benchmarked either).

### Q20: What is your proposed future work?
**Model Answer**: (1) Extend empirical ground-truth coverage to the remaining 17 rules and to real open-source repositories. (2) Complete the developer usability study (N=85) and report real SUS/Cronbach's α. (3) Add `@angular/compiler`/`@vue/compiler-sfc` to close the remaining real-AST gaps. (4) Empirically benchmark the AI remediation pipeline's aggregate fix success rate against the full ground-truth corpus.

---

## Before the defense: verify, don't recite

Re-run these commands the day of your viva and use their live output, not the numbers memorized
from this document (which could drift as the codebase changes):

```bash
npm test                          # current test count + pass rate (Q17)
npm run research:evaluate         # current Precision/Recall/F1 + rule coverage (Q10, Q11)
```

Or open `/analytics` in the running app, which shows the same live figures.
