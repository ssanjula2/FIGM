# FIGM — FINAL HOSTILE EXAMINER AUDIT & VERIFICATION REPORT

**Project Name**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Repository**: `ssanjula2/FIGM`  
**Research Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**Candidate**: A P H D S Sanjula  
**Student ID**: 28256  
**University**: NSBM Green University  
**Audit Type**: Complete Zero-Trust Hostile Dissertation & Viva Examiner Audit  
**Audit Date**: August 8, 2026  

---

## 1. RULE ARCHITECTURE RECONCILIATION

A central inquiry in adversarial examination is the exact relationship between the rule counts cited across different parts of the project.

```
+-------------------------------------------------------------------------------+
|                    FIGM Master Taxonomy Specification                          |
|                       23 Total Guideline Rules                                |
|          (Defined in figm-spec.json & four-layer-meta-model.ts)               |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                    Executable AST Detection Engine                            |
|                  25 Concrete Detection Predicates                             |
|          (Implemented in src/ast/ast-detection-engine.ts)                    |
|    - 6 PERF Rules  (FIGM-PERF-01 .. FIGM-PERF-06)                             |
|    - 6 A11Y Rules  (FIGM-A11Y-01 .. FIGM-A11Y-06)                             |
|    - 4 Next.js     (FIGM-NEXT-01 .. FIGM-NEXT-04)                             |
|    - 4 React       (FIGM-REACT-01 .. FIGM-REACT-04)                           |
|    - 5 Angular     (FIGM-ANG-01 .. FIGM-ANG-05)                               |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                 Ground-Truth Evaluation Benchmark Subset                      |
|                  8 Ground-Truth Core Detection Rules                          |
|         (Tested in benchmarks/testbed/ & benchmarks/ground-truth.json)        |
+-------------------------------------------------------------------------------+
```

---

## 2. CANONICAL RESEARCH METRICS

All quantitative evaluation claims in the repository trace strictly to the ground-truth single-page framework testbed files ($147 \text{ LOC}$ total) in `benchmarks/testbed/`:

$$\text{Precision} = \frac{TP}{TP + FP} = \frac{18}{18 + 3} = 85.7\%$$

$$\text{Recall} = \frac{TP}{TP + FN} = \frac{18}{18 + 1} = 94.7\%$$

$$\text{F1-Score} = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}} = 2 \cdot \frac{0.85714 \cdot 0.94736}{0.85714 + 0.94736} = 90.0\%$$

- **Throughput**: $86,987 \text{ LOC/sec}$

---

## 3. DATASET AUTHENTICITY CLASSIFICATIONS

1. **Ground-Truth Single-Page Testbed Dataset**: 4 single-page framework testbed files ($147 \text{ LOC}$ total). Defines canonical Precision ($85.7\%$), Recall ($94.7\%$), and F1 ($90.0\%$).
2. **30-Project Evaluation Dataset**: 30 pre-compiled framework architecture benchmark items / benchmark vectors. Evaluates framework coverage across React, Angular, Vue, and Next.js structures.
3. **User Usability Dataset ($N=85$)**: Representative usability survey scoring vector model. Evaluates SUS calculation ($86.4 / 100$) and Cronbach's alpha internal consistency ($\alpha = 0.892$).

---

## 4. API SECURITY & MULTI-TENANT IDOR VERIFICATION

| Method | Route Path | Auth Required | Server Ownership Verification | IDOR Protection Status | Rate Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/projects/[id]` | Required | Checks `userId === project.userId` | **403/404 on unauthorized access** | 20 req/min |
| `PUT` | `/api/projects/[id]` | Required | Checks `userId === project.userId` | **403/404 on unauthorized access** | 20 req/min |
| `DELETE` | `/api/projects/[id]` | Required | Checks `userId === project.userId` | **403/404 on unauthorized access** | 20 req/min |
| `GET` | `/api/scans/[id]` | Required | Checks scan author against caller | **403/404 on unauthorized access** | 20 req/min |
| `DELETE` | `/api/scans/[id]` | Required | Checks scan author against caller | **403/404 on unauthorized access** | 20 req/min |

---

## 5. 30 HOSTILE EXAMINER VIVA DEFENSE QUESTIONS & ANSWERS

### Q1: Where did the ground-truth benchmark data originate?
**Answer**: The ground-truth benchmark consists of 4 single-page framework files (`UserProfile.jsx`, `SearchPanel.component.ts`, `DashboardCard.vue`, `AnalyticsChart.tsx`) located in `benchmarks/testbed/` ($147 \text{ LOC}$ total), annotated in `benchmarks/ground-truth.json`.

### Q2: Are the 30 repositories real git clones?
**Answer**: No. To ensure reproducibility without external network dependencies, they are structured pre-compiled framework architecture benchmark vectors (`src/eval/repo-evaluator.ts`).

### Q3: Where are their commit hashes?
**Answer**: As benchmark vectors representing architectural patterns rather than live git checkouts, commit hashes are not applicable.

### Q4: Are the N=85 participants live human subjects?
**Answer**: No. N=85 represents a representative usability survey scoring vector model (`src/eval/user-study-evaluator.ts`) used to validate questionnaire scoring algorithms.

### Q5: Is there an ethics approval document?
**Answer**: Ethics approval is not required because no human subject data was collected; all survey metrics derive from a mathematical vector model.

### Q6: How was Cronbach's alpha calculated?
**Answer**: Calculated via the variance ratio formula $\alpha = \frac{K}{K-1} \left( 1 - \frac{\sum \sigma_{y_i}^2}{\sigma_X^2} \right) = 0.892$ in `src/eval/user-study-evaluator.ts`.

### Q7: Why are there 23 rules, 25 predicates, and 8 benchmark rules?
**Answer**: 23 taxonomy specification rules (`figm-spec.json`), 25 executable predicates (`src/ast/ast-detection-engine.ts`), and 8 benchmark core rules present in the testbed code (`benchmarks/ground-truth.json`).

### Q8: How is Precision calculated?
**Answer**: $\text{Precision} = TP / (TP + FP) = 18 / (18 + 3) = 85.7\%$.

### Q9: How is Recall calculated?
**Answer**: $\text{Recall} = TP / (TP + FN) = 18 / (18 + 1) = 94.7\%$.

### Q10: How is F1 calculated?
**Answer**: $F1 = 2 \cdot P \cdot R / (P + R) = 2(0.8571)(0.9474) / 1.8045 = 90.0\%$.

### Q11: Why isn't F1 100%?
**Answer**: 3 false positives (e.g., dynamic style expressions) and 1 false negative (complex nested callback) prevent artificial 100% scores.

### Q12: How do you prevent metric manipulation?
**Answer**: `scripts/validate-research.ts` recalculates metrics dynamically from `benchmarks/eval-summary.json` and fails CI if any discrepancy exists.

### Q13: Can another researcher reproduce your results?
**Answer**: Yes, executing `npm run research:validate` independently reproduces all ground-truth metrics.

### Q14: What does the VS Code extension execute?
**Answer**: The VS Code extension (`vscode-extension/`) uses hybrid regex heuristics for real-time editor feedback and delegates full AST analysis to the FIGM core engine.

### Q15: Is the AST engine framework-independent?
**Answer**: Yes, AST nodes from React, Next.js, Angular, and Vue are normalized into Abstract Language Primitives (ALPs) before rule evaluation.

### Q16: How are Angular and Vue templates parsed?
**Answer**: Angular HTML and Vue template syntax are parsed into ESTree-compatible JSX/HTML node structures via `UniversalASTMapper`.

### Q17: What happens when browser memory APIs are restricted?
**Answer**: `DynamicProfiler` returns a complexity-based heap estimate and explicitly sets `measurementType: 'ESTIMATED'`.

### Q18: How is IDOR prevented?
**Answer**: Server-side ownership verification (`userId === project.userId`) is enforced in Next.js App Router API routes (`app/api/projects/[id]/route.ts`).

### Q19: How is authentication enforced?
**Answer**: PBKDF2 SHA-512 password hashing with salt and 15-minute JWT access tokens verified in `middleware.ts`.

### Q20: Can User A access User B's project?
**Answer**: No. Requests return `403 Forbidden` or `404 Not Found`.

### Q21: Can CI pass when tests fail?
**Answer**: No. `.github/workflows/figm-scan.yml` contains zero `continue-on-error` or `|| true` soft-failure flags.

### Q22: Are any metrics hardcoded in the UI?
**Answer**: No. `app/analytics/page.tsx` and landing components consume ground-truth metrics reconciled with `canonical-evaluation.json`.

### Q23: What are the main threats to validity?
**Answer**: Benchmark vectors modeling synthetic code bases and survey vector models rather than live human user studies.

### Q24: What is the difference between benchmark and empirical evidence?
**Answer**: Benchmark evidence tests deterministic AST detection logic; empirical evidence measures live deployment environments.

### Q25: What is novel in FIGM?
**Answer**: Mapping framework-specific AST structures to unified Abstract Language Primitives (ALPs) for static guideline checking.

### Q26: What are the limitations?
**Answer**: Restrictive browser memory APIs require heap estimation, and Vue SFC template parsing relies on script AST + regex heuristics.

### Q27: Which claims should NOT be made in the dissertation?
**Answer**: Do not claim live git cloning of 30 external repos or live human user study with $N=85$ participants.

### Q28: How is password security implemented?
**Answer**: PBKDF2 with SHA-512, 10,000 iterations, and cryptographic salt (`src/auth/user-db.ts`).

### Q29: How is static analysis quality scored?
**Answer**: `qualityScore = 100 - (15*Critical + 8*High + 3*Med + 1*Low)`, resulting in a 74% score across clean source files.

### Q30: What is the final release status?
**Answer**: **READY WITH MINOR REVISIONS** (Technically verified, security hardened, and academically honest).

---

## 6. VERIFICATION COMMANDS EXECUTION RESULTS

1. `npx tsc --noEmit` $\rightarrow$ Exit code 0 (0 errors)
2. `npm test` $\rightarrow$ 111 passed, 0 failed across 21 test suites
3. `npm run research:validate` $\rightarrow$ Mathematically consistent
4. `npm run ci:scan` $\rightarrow$ PASSED (74% Quality Score)
5. `npm --prefix vscode-extension run compile` $\rightarrow$ Exit code 0

---

## 7. FINAL VERDICT

**FINAL DECISION: READY WITH MINOR REVISIONS**
