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

# FINAL REPRODUCIBILITY AUDIT

**Project Name**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Repository**: `ssanjula2/FIGM`  
**Candidate**: A P H D S Sanjula  
**Student ID**: 28256  
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**University**: NSBM Green University  
**Audit Date**: August 9, 2026  

---

## Reproducibility Protocol

To independently execute and reproduce all empirical evaluation metrics and dissertation evidence artifacts from a clean checkout:

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher

### 2. Execution Steps

```bash
# Step 1: Install dependencies
npm install

# Step 2: Compile TypeScript & verify zero type errors
npx tsc --noEmit

# Step 3: Run dynamic evaluation runner (regenerates reports & dissertation chapters)
npm run research:evaluate

# Step 4: Run research validator (verifies mathematical & provenance consistency)
npm run research:validate

# Step 5: Run full automated unit & integration test suite
npm test

# Step 6: Run static quality scan
npm run ci:scan

# Step 7: Verify VS Code extension compilation
npm --prefix vscode-extension run compile
```

---

## Reproducibility Manifest Verification

- **Benchmark Fixture Input**: `benchmarks/testbed/` (4 files, 147 LOC)
- **Ground-Truth Input**: `benchmarks/ground-truth.json` (19 expert-authored expected violations)
- **Primary Evaluator**: `src/eval/evaluation-runner.ts`
- **Output Artifacts**:
  - `docs/evidence/canonical-evaluation.json`
  - `benchmarks/eval-summary.json`
  - `benchmarks/benchmark-results.md`
  - `benchmarks/benchmark-results.csv`
  - `benchmarks/latex-tables.tex`
  - `docs/dissertation/*.md`
