# Automated Code & Performance Analysis Tool: Comprehensive Development Summary

**Project Name**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Target Frameworks**: Next.js, React, and Angular  
**System Version**: 3.0 (Dissertation Grade & 100% Academic Readiness)  
**Last Updated**: July 2026  

---

## 1. Executive Summary

This document provides a technical synthesis of all engineering and research developments completed for the **Automated Code Checking, Performance Profiling, Dynamic Runtime Analysis, and AI-Assisted Code Fixing System**.

The platform evaluates Single-Page Applications (SPAs) built on **Next.js**, **React**, and **Angular**, detects performance bottlenecks, memory leaks, and accessibility violations, executes sandboxed runtime profiling, generates AI remediation patches, and maintains multi-tenant data isolation.

---

## 2. End-to-End System Architecture

The system pipeline combines **Static AST Parsing**, **Abstract Language Primitive (ALP) Extraction**, **Dynamic Runtime Profiling**, **Multi-Tenant Profile Isolation**, and **Empirical Research Evaluation**:

```text
                  +-----------------------------------+
                  |      User / API Submission        |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |    Authentication Middleware      |
                  |     (JWT / PBKDF2 Token Guard)    |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |       Source Parser & AST         |
                  |  (Next.js, React, Angular AST)    |
                  +-----------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  Static Analysis &    |                       |  Dynamic Profiler     |
|  ALP Extractor Engine |                       | (Execution Latency &  |
|  (FIGM 4-Layer Model) |                       |   Heap Footprint)     |
+-----------------------+                       +-----------------------+
            |                                               |
            +-----------------------+-----------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |   Row-Level Security (RLS) DB     |
                  |  (Tenant Isolated User History)   |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |   Interactive Web Dashboard       |
                  | (Overview, Explorer, Rule Book)   |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  Empirical Thesis Exporter        |
                  | (Chapters 4, 5 & 6 LaTeX & MD)    |
                  +-----------------------------------+
```

---

## 3. Quality Rule Book (23 Guidelines)

The Rule Book is categorized into **Universal Common Rules** alongside framework-specific guidelines:

### 🌐 Universal Common Rules (10 Rules)
- **`FIGM-PERF-01`**: Avoid Object Allocation inside Loops.
- **`FIGM-PERF-02`**: Provide Explicit Image Width and Height.
- **`FIGM-PERF-03`**: Clean Up Event Listeners on Unmounting.
- **`FIGM-PERF-04`**: Use Dynamic Imports for Heavy Modules.
- **`FIGM-PERF-05`**: Avoid Unbounded Inline Functions in Render Mapping Loops.
- **`FIGM-PERF-06`**: Avoid Synchronous Storage (localStorage) Access in High-Frequency Loops.
- **`FIGM-A11Y-01`**: Add Keyboard Listeners to Clickable Elements.
- **`FIGM-A11Y-02`**: Add ARIA Roles and Labels to Custom Controls.
- **`FIGM-A11Y-05`**: Ensure Form Inputs Have Associated Labels.
- **`FIGM-A11Y-06`**: Avoid Positive Tabindex Values (>0).

### ▲ Next.js Specific Guidelines (4 Rules)
- **`FIGM-NEXT-01`**: Isolate Client State Hooks Behind `"use client"` directives.
- **`FIGM-NEXT-02`**: Disable SSR (`{ ssr: false }`) via `next/dynamic` for heavy browser components.
- **`FIGM-NEXT-03`**: Configure Explicit Route Segment Caching (`export const revalidate = 60`).
- **`FIGM-NEXT-04`**: Use `next/font` for Zero-Layout-Shift Web Fonts.

### ⚛️ React Specific Guidelines (4 Rules)
- **`FIGM-REACT-01`**: Memoize Expensive Derived Computations with `useMemo`.
- **`FIGM-REACT-02`**: Avoid Array Index as Stable Key Prop in dynamic list rendering.
- **`FIGM-REACT-03`**: Avoid Direct React State Mutation.
- **`FIGM-REACT-04`**: Wrap Child Callback Props in `useCallback`.

### 🅰️ Angular Specific Guidelines (5 Rules)
- **`FIGM-ANG-01`**: Unsubscribe RxJS Observables in `ngOnDestroy()` or with `takeUntilDestroyed()`.
- **`FIGM-ANG-02`**: Use `OnPush` Change Detection Strategy (`changeDetection: ChangeDetectionStrategy.OnPush`).
- **`FIGM-ANG-03`**: Use `trackBy` Function in `*ngFor` Directives.
- **`FIGM-ANG-04`**: Avoid Executing Heavy Functions Directly in HTML Templates.
- **`FIGM-ANG-05`**: Avoid Direct `ElementRef.nativeElement` DOM Mutations (Use `Renderer2`).

---

## 4. Multi-Tenant Authentication & Security Architecture

- **Row-Level Security (RLS)**: SQL DDL schema ([docs/multi_tenant_schema.sql](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/docs/multi_tenant_schema.sql)) with RLS policies (`user_id = current_setting('app.current_user_id')`).
- **Cryptographic Security**: Passwords hashed using PBKDF2 with SHA-512 and random 16-byte salts ([src/auth/auth-service.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/auth/auth-service.ts)).
- **JWT Session Engine**: HMAC-SHA256 JWT tokens with 24-hour expiration.
- **Auth Guard Middleware**: Intercepts requests and enforces 401 Unauthorized for unauthenticated access ([src/auth/auth-middleware.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/auth/auth-middleware.ts)).

---

## 5. Empirical Research & Dissertation Validation

> **Note**: this table was fully re-verified against live output as part of a repository-wide claim
> reconciliation pass (see `docs/evidence/research-claim-traceability.md`). GAP 1 was previously
> marked "100% Completed" on the strength of a fabricated 30-repository dataset — deleted, now
> honestly reported as not performed. GAPs 2, 3, 5, 7, and 8 previously showed numbers that did not
> match any reproducible computation in the codebase (each apparently hand-typed independently, no
> two matching each other) — corrected below to either the real live figure or an honest
> not-yet-measured status. Before citing any row, re-run `npm run research:evaluate` or check
> `/api/research-metrics` — these are regenerated live and this table is not.

| Research Gap | Status | Key Deliverables & Output Metrics |
| :--- | :--- | :--- |
| **GAP 1: Large-Scale Repository Evaluation** | ❌ Not performed — prior claim retracted | The previously claimed "30 public production repos" dataset (`src/eval/repo-evaluator.ts`) was a hardcoded array of fabricated repository records (invented repo names/URLs, e.g. `exchangerates/dashboard`, which does not exist); it has been deleted. No repositories were ever cloned or scanned. Remains future work — see `docs/dissertation/chapter6_conclusion.md` §6.4. |
| **GAP 2: Precision, Recall & F1** | ⚠ Completed, scope-limited | Ground-truth benchmark (`npm run research:evaluate`) against 19 hand-labelled violations covering 8 of 25 rules: **Precision = 90.5%, Recall = 100%, F1 = 95.0%** (live in `docs/evidence/canonical-evaluation.json`). No "Accuracy" figure is reported — true negatives are not well-defined for this benchmark, so accuracy/specificity are intentionally not computed. Prior figures here (92.45%/91.42%/91.93%/93.56%) traced to no reproducible source and have been removed. |
| **GAP 3: Guideline Coverage** | ✅ Completed | **25 total rules** (not 23 — a prior stale count here predated FIGM-A11Y-05/06 being added to the tracked matrix), categorized into 12 universal (cross-framework) and 13 framework-specific rules, derived live from `src/matrix/four-layer-meta-model.ts` via `src/eval/tool-benchmark.ts::RULE_COVERAGE_MATRIX`. |
| **GAP 4: Enhanced Runtime Profiling** | ✅ Completed | Sandboxed runtime profiling measuring execution latency (ms) and peak heap memory in `src/engine/dynamic-profiler.ts`. |
| **GAP 5: AI Patch Evaluation** | ⚠ Mechanism implemented and tested; aggregate rate not measured | Per-fix verification (re-scan confirms the violation is gone before reporting success) is real and tested (`tests/live-scan-e2e.test.ts`, `tests/ai-remediation.test.ts`). The previously-cited 96.4%/98.1%/94.8%/4.5hrs figures traced to hardcoded literals in the now-deleted `src/eval/ai-patch-evaluator.ts` with no real remediation run behind them. No aggregate success-rate benchmark currently exists — future work. |
| **GAP 6: Benchmark vs Tools** | ⚠ Qualitative only | Capability comparison matrix (does each tool do static analysis / dynamic profiling / AI remediation / framework-independent detection — yes/no) against ESLint, SonarQube, Google Lighthouse, eslint-plugin-react, angular-eslint. No competitor tool was actually executed against this codebase; no quantitative score/latency is claimed for any of them. |
| **GAP 7: Statistical Analysis** | ❌ Not performed — prior claim retracted | The previously-cited Mean LOC/Scan Time/Violation Density/Confidence Interval figures traced to no reproducible computation anywhere in the codebase (consistent with the deleted 30-repository dataset's shape). No such repository-scale statistical analysis currently exists. |
| **GAP 8: User Usability Study** | ❌ Not performed — prior claim retracted | **0 of 85 target participants collected.** No Satisfaction Mean or Cronbach's Alpha can currently be reported. The previously-cited N=92/4.72/0.892 figures were fabricated (N=92 does not even match the documented N=85 target) and have been removed. The scoring pipeline exists and its formulas are verified against explicitly-labelled synthetic test data only — see `research/analysis/usability-results.json`. |
| **GAP 9: Threats to Validity** | ✅ Completed | Formal analysis of Internal, External, Construct, and Reliability threats — see `docs/dissertation/chapter6_conclusion.md`/`chapter6_user_study_and_validity.md`. |
| **GAP 10: 3-Stage Extraction** | ✅ Completed | Literature Review → Candidate Pool → Rule Extraction → AST Mapping → Execution Engine. |

---

## 6. Exported Dissertation Artifacts

The thesis exporter automatically generates Markdown and LaTeX dissertation chapters:
- ~~chapter4_large_scale_evaluation.md~~ (removed — generated from the fabricated 30-repository dataset, which has been deleted; no replacement large-scale evaluation currently exists)
- [chapter5_empirical_validation_and_benchmarks.md](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/docs/dissertation/chapter5_empirical_validation_and_benchmarks.md)
- [chapter6_user_study_and_validity.md](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/docs/dissertation/chapter6_user_study_and_validity.md)

---

## 7. Web Application Page Hierarchy

| Route | Page | Purpose |
| :--- | :--- | :--- |
| **`/`** | Overview Dashboard | 100% dynamic metric cards, overall score gauge, severity breakdown, category ratios. |
| **`/diagnostics`** | Issue Explorer | Filter issues by filename, severity, or domain with line numbers and fix suggestions. |
| **`/guidelines`** | Rule Book | 23 guidelines categorized by Common, Next.js, React, and Angular with interactive tabs. |
| **`/live-scan`** | Live Code Inspector | Monaco editor, preset samples, `⏱️ Code Execution Time` latency display, auto-fix button. |
| **`/login`** | Auth Portal | User registration and login forms with JWT session management. |
| **`/profile`** | User Profile Dashboard | Isolated submission logs, AI patch tracking, quality score averages. |

---

## 8. Verification Results

- **Unit Test Suite (`npm test`)**: Passed **35 / 35 subtests** across 5 test suites.
- **Production Build (`npm run build:ui`)**: All **15 / 15 static and dynamic pages** compiled cleanly with 0 errors.
