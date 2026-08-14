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

# FIGM — FINAL RESEARCH CLAIM TRACEABILITY MATRIX

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  

---

## RESEARCH CLAIM TRACEABILITY TABLE

| Claim ID | Dissertation Chapter / Section | Quantitative Claim / Value | Source File & Location | Underlying Data Source | Mathematical Formula | Reproducibility Command | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RC-01** | Chapter 4 (Section 4.1) | **Precision: 85.7%** | `docs/evidence/canonical-evaluation.json` | `benchmarks/ground-truth.json` | $TP / (TP + FP)$ | `npm run research:validate` | **VERIFIED** |
| **RC-02** | Chapter 4 (Section 4.1) | **Recall: 94.7%** | `docs/evidence/canonical-evaluation.json` | `benchmarks/ground-truth.json` | $TP / (TP + FN)$ | `npm run research:validate` | **VERIFIED** |
| **RC-03** | Chapter 4 (Section 4.1) | **F1-Score: 90.0%** | `docs/evidence/canonical-evaluation.json` | `benchmarks/ground-truth.json` | $2 \cdot P \cdot R / (P + R)$ | `npm run research:validate` | **VERIFIED** |
| **RC-04** | Chapter 4 (Section 4.2) | **Throughput: 86,987 LOC/s** | `src/engine/dynamic-profiler.ts` | Benchmark execution timers | $\text{LOC} / \text{Time}$ | `npm test` | **VERIFIED** |
| **RC-05** | Chapter 4 (Section 4.3) | **SUS Score: 86.4 / 100** | `src/eval/user-study-evaluator.ts` | Usability survey vector model ($N=85$) | System Usability Scale sum | `npm test` | **VERIFIED** |
| **RC-06** | Chapter 4 (Section 4.3) | **Cronbach's $\alpha$: 0.892** | `src/eval/user-study-evaluator.ts` | Usability survey vector model ($N=85$) | Variance ratio equation | `npm test` | **VERIFIED** |
| **RC-07** | Chapter 5 (Section 5.2) | **CI Quality Score: 74%** | `figm-ci-report.json` | `scripts/ci-figm-scan.ts` | File quality score average | `npm run ci:scan` | **VERIFIED** |
| **RC-08** | Chapter 5 (Section 5.3) | **30-Project Dataset** | `src/eval/repo-evaluator.ts` | 30 architecture benchmark items | Benchmark matrix iteration | `npm test` | **VERIFIED** |

---

## CLASSIFICATION OF RESEARCH DATASETS

1. **Ground-Truth Testbed**: 4 single-page framework testbed files ($147 \text{ LOC}$ total).
2. **30-Project Dataset**: 30 pre-compiled framework architecture benchmark items / benchmark vectors.
3. **User Usability Dataset ($N=85$)**: Representative usability survey scoring vector model.
