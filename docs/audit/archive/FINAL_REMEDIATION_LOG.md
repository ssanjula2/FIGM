> **⚠ ARCHIVED — SUPERSEDED.** This document is a dated, point-in-time audit/verification
> snapshot from an earlier stage of the project (see its own "Audit Date" below). Substantial
> remediation has happened since it was written — including the JWT/auth hardening, API
> IDOR/rate-limiting fixes, the real-parser AST migration (Groups 1-4, now 23/25 rules
> real-AST), the live-scan pipeline fix, and the empirical-metrics single-source-of-truth fix
> (`docs/architecture/RULE_ENGINEERING_AUDIT.md`, `docs/evidence/canonical-evaluation.json`,
> `docs/evidence/research-claim-traceability.md`). **Any specific number, percentage, or
> pass/fail verdict below may no longer reflect the current codebase.** It is retained here
> for historical record only — do not cite it as current evidence. For current status, see
> `docs/evidence/canonical-evaluation.json` (empirical benchmark), `docs/evidence/
> research-claim-traceability.md` (claim-by-claim reconciliation), and `audit/new.md` (most
> recent full forensic audit).

---

# FINAL REMEDIATION LOG

**Project Name**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Repository**: `ssanjula2/FIGM`  
**Candidate**: A P H D S Sanjula  
**Student ID**: 28256  
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**University**: NSBM Green University  
**Audit Date**: August 9, 2026  

---

## Forensic Remediation Log

| Item # | Component | Defect Description | Remediation Applied | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `PrecisionRecallEngine` | Optional fallback parameter `= EMPIRICAL_EXPERT_GROUND_TRUTH` in `calculateMetrics` | Removed fallback parameter; `matrix: ConfusionMatrix` is now a **required parameter** | **VERIFIED FIXED ✅** |
| **2** | `UserStudyEvaluator` | Cronbach's $\alpha$ relied on static baseline constant | Implemented dynamic variance ratio formula ($\alpha = \frac{K}{K-1}(1 - \frac{\sum \sigma_i^2}{\sigma_X^2}) = 0.892$) | **VERIFIED FIXED ✅** |
| **3** | `BenchmarkDataLoader` | Analytics page lacked typed dynamic data access layer | Created `src/eval/benchmark-data-loader.ts` to load generated `canonical-evaluation.json` | **VERIFIED FIXED ✅** |
| **4** | `EvaluationRunner` | Provenance metadata missing in canonical output | Added `provenance` metadata block (`generatedBy`, `executionMode`, `dynamic: true`) | **VERIFIED FIXED ✅** |
| **5** | `ResearchValidator` | Validation script asserted target numbers | Refactored script to verify dynamic mathematical formula consistency from $TP/FP/FN$ | **VERIFIED FIXED ✅** |
| **6** | `Mutation Test Suite` | Anti-hardcoding test coverage missing | Added `Dynamic Mutation Suite` tests (Mutations A, B, C, D) in `tests/evaluation-runner.test.ts` | **VERIFIED FIXED ✅** |
| **7** | `Test Assertions` | Usability test asserted legacy sample size 92 | Updated `tests/research-gap-eval.test.ts` assertion to match $N=85$ vector model | **VERIFIED FIXED ✅** |
