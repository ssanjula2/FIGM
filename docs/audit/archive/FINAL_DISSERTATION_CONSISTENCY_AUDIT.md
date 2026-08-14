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

# FIGM — FINAL DISSERTATION CONSISTENCY AUDIT

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## DISSERTATION & DOCUMENTATION CONSISTENCY MATRIX

| Quantitative Metric | Dissertation Chapter / Section | UI Card Location | LaTeX Table | Canonical Evidence File | Consistency Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Precision (85.7%)** | Chapter 4 (Section 4.1) | `app/analytics/page.tsx` | `latex-tables.tex` | `docs/evidence/canonical-evaluation.json` | **RECONCILED ✅** |
| **Recall (94.7%)** | Chapter 4 (Section 4.1) | `app/analytics/page.tsx` | `latex-tables.tex` | `docs/evidence/canonical-evaluation.json` | **RECONCILED ✅** |
| **F1-Score (90.0%)** | Chapter 4 (Section 4.1) | `app/analytics/page.tsx` | `latex-tables.tex` | `docs/evidence/canonical-evaluation.json` | **RECONCILED ✅** |
| **Throughput (86,987 LOC/s)**| Chapter 4 (Section 4.2) | `BenchmarkSection.tsx` | `latex-tables.tex` | `src/engine/dynamic-profiler.ts` | **RECONCILED ✅** |
| **SUS Score (86.4 / 100)** | Chapter 4 (Section 4.3) | Analytics Dashboard | `latex-tables.tex` | `src/eval/user-study-evaluator.ts` | **RECONCILED ✅** |
| **Cronbach's $\alpha$ (0.892)**| Chapter 4 (Section 4.3) | Research Tab | `latex-tables.tex` | `src/eval/user-study-evaluator.ts` | **RECONCILED ✅** |
| **CI Quality Score (74%)** | Chapter 5 (Section 5.2) | Health Dashboard | `figm-ci-report.md` | `figm-ci-report.json` | **RECONCILED ✅** |
