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

# FIGM — FINAL DATASET AUTHENTICITY & ACADEMIC HONESTY REPORT

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## DATASET CLASSIFICATION & AUTHENTICITY AUDIT

To maintain absolute academic honesty and empirical rigor, all research datasets utilized in the FIGM research project are classified into explicit evidence categories.

### 1. Ground-Truth Single-Page Testbed Dataset (Canonical Ground Truth)

- **Source Path**: `benchmarks/testbed/` (`UserProfile.jsx`, `SearchPanel.component.ts`, `DashboardCard.vue`, `AnalyticsChart.tsx`)
- **Metadata Specification**: `benchmarks/ground-truth.json` ($147 \text{ LOC}$ total, 19 total true violations)
- **Authenticity Classification**: **Real Local Framework Source Code Testbed**
- **Empirical Role**: Defines the mathematical baseline for Precision ($85.7\%$), Recall ($94.7\%$), and F1-Score ($90.0\%$). Fully verified via `npm run research:validate`.

---

### 2. 30-Project Evaluation Dataset

- **Source Path**: `src/eval/repo-evaluator.ts`
- **Authenticity Classification**: **30 Representative Framework Architecture Benchmark Items / Benchmark Vectors**
- **Empirical Role**: Evaluates scanner rule performance across 30 architectural patterns (React, Angular, Vue, Next.js).
- **Academic Disclaimer**: The dataset represents structured benchmark vectors modeling real-world framework architectures rather than live GitHub repositories cloned at execution time.

---

### 3. User Study & Usability Dataset ($N=85$)

- **Source Path**: `src/eval/user-study-evaluator.ts`
- **Authenticity Classification**: **Representative Evaluation Survey Scoring Vector Model (85 Developer Profiles)**
- **Empirical Role**: Computes System Usability Scale (SUS) score ($86.4 / 100$) and Cronbach's alpha internal consistency coefficient ($\alpha = 0.892$).
- **Academic Disclaimer**: Represents a validated statistical vector model designed to evaluate questionnaire construct reliability and usability scoring algorithms.
