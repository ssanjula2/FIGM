# FIGM — FINAL REPRODUCIBILITY REPORT

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## REPRODUCIBLE COMMAND PROTOCOL

All technical and empirical results of the FIGM project can be independently reproduced using the standard commands below:

```bash
# 1. Type Safety & Compilation Check
npx tsc --noEmit
# Expected Output: Exit code 0 (0 errors)

# 2. Complete Test Suite Execution
npm test
# Expected Output: 111 passed, 0 failed across 21 test suites

# 3. Canonical Ground-Truth Metric Validation
npm run research:validate
# Expected Output: Precision 85.7%, Recall 94.7%, F1 90.0% (Mathematically Consistent)

# 4. DevSecOps Static Analysis Quality Gate
npm run ci:scan
# Expected Output: FIGM CI Inspection Status: PASSED (74% Quality Score)

# 5. VS Code Extension Compilation
npm --prefix vscode-extension run compile
# Expected Output: Exit code 0 (0 errors)
```

---

## REPRODUCIBILITY MATRIX

| Metric / Result | Reproducibility Command | Source Code File | Target Verification Output |
| :--- | :--- | :--- | :--- |
| **Precision (85.7%)** | `npm run research:validate` | `scripts/validate-research.ts` | `Computed Precision: 85.7%` |
| **Recall (94.7%)** | `npm run research:validate` | `scripts/validate-research.ts` | `Computed Recall: 94.7%` |
| **F1-Score (90.0%)** | `npm run research:validate` | `scripts/validate-research.ts` | `Computed F1-Score: 90.0%` |
| **Unit Tests (111/111)** | `npm test` | `tests/` directory | `# pass 111` |
| **CI Quality Score (74%)** | `npm run ci:scan` | `scripts/ci-figm-scan.ts` | `Overall Quality Score: 74%` |
| **Cronbach Alpha (0.892)** | `npm test` | `tests/thesis-exporter.test.ts` | `Cronbach Alpha = 0.89` |
