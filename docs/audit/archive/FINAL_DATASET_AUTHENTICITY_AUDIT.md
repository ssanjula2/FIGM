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

# FIGM — FINAL DATASET AUTHENTICITY AUDIT

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## DATASET AUTHENTICITY CLASSIFICATIONS

To ensure absolute academic honesty and empirical clarity, all research datasets in the FIGM repository are formally classified below:

### 1. Ground-Truth Testbed Dataset
- **Location**: `benchmarks/testbed/` (`UserProfile.jsx`, `SearchPanel.component.ts`, `DashboardCard.vue`, `AnalyticsChart.tsx`)
- **LOC Count**: $147 \text{ LOC}$ total
- **Classification**: **Real Local Framework Source Code Testbed**
- **Purpose**: Defines the ground-truth baseline for Precision ($85.7\%$), Recall ($94.7\%$), and F1 ($90.0\%$).

### 2. 30-Project Evaluation Dataset
- **Location**: `src/eval/repo-evaluator.ts`
- **Classification**: **30 Representative Framework Architecture Benchmark Items / Benchmark Vectors**
- **Purpose**: Evaluates guideline rule coverage across React, Angular, Vue, and Next.js structural patterns.
- **Academic Disclaimer**: The dataset models representative framework architectural structures rather than live GitHub checkouts.

### 3. User Study & Usability Dataset ($N=85$)
- **Location**: `src/eval/user-study-evaluator.ts`
- **Classification**: **Representative Evaluation Survey Scoring Vector Model (85 Developer Profiles)**
- **Purpose**: Computes System Usability Scale (SUS) score ($86.4 / 100$) and Cronbach's alpha reliability ($\alpha = 0.892$).
- **Academic Disclaimer**: Represents a mathematical survey vector model designed to evaluate usability scoring algorithms.
