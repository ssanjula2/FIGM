# MASTER REAL-WORLD EVIDENCE & DATA-PROVENANCE FORENSIC AUDIT REPORT

**Project Name**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Repository**: `ssanjula2/FIGM`  
**Candidate**: A P H D S Sanjula  
**Student ID**: 28256  
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**University**: NSBM Green University  
**Audit Date**: August 9, 2026  

---

## 1. EXECUTIVE VERDICT & EMPIRICAL READINESS CLASSIFICATION

# 🟡 **TECHNICALLY READY — REAL HUMAN USER-STUDY EVIDENCE PENDING**

**CONFIDENCE**: **HIGH**  
**REASON FOR CLASSIFICATION**:  
1. **Technically Ready**: The software architecture, AST detection engine, evaluation runner, anti-hardcoding guard suite, and data ingestion validation pipeline ([src/eval/research-data-pipeline.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/eval/research-data-pipeline.ts)) are 100% complete and dynamically derive all benchmark metrics ($P=85.71\%, R=94.74\%, F_1=90.00\%$) from raw AST parsing against independent ground truth.
2. **Empirically Pending**: The usability dataset ($N=85$) is **truthfully classified as an 85-profile synthetic scoring vector model** (`isRealHumanData: false`) used for pipeline verification. To maintain 100% academic integrity, the repository **does NOT claim that 85 real human participants were recruited**. The production data ingestion pipeline, schema validator, consent verification, and directory structure (`/research/raw/real/`) are fully instantiated to analyze real human data as soon as collected.

---

## 2. REPOSITORY DATASET PROVENANCE TAXONOMY

| Dataset Name | Dataset ID | Classification | `isRealHumanData` | Collection Status | Provenance & Primary Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Usability Vector Model ($N=85$)** | `FIGM-SYNTHETIC-USABILITY-V1` | `SYNTHETIC` | `false` | `NOT_COLLECTED` | Methodological validation model for Cronbach $\alpha$ & SUS calculation |
| **Framework Benchmark ($N=30$)** | `FIGM-ARCH-BENCHMARK-V1` | `BENCHMARK` | `false` | `COLLECTED` | Precompiled architecture items for cross-framework rule evaluation |
| **Ground Truth Annotations** | `FIGM-GROUND-TRUTH-V1` | `BENCHMARK` | `false` | `COLLECTED` | 19 Independent expert-authored expected violation annotations |
| **Testbed Codebase (147 LOC)** | `FIGM-TESTBED-SOURCE-V1` | `BENCHMARK` | `false` | `COLLECTED` | React/Angular/Vue fixture files for AST parsing and rule execution |
| **Canonical Evaluation Output** | `FIGM-CANONICAL-EVAL-V1` | `GENERATED_OUTPUT` | `false` | `GENERATED` | Output JSON artifact exported to `docs/evidence/canonical-evaluation.json` |

---

## 3. REAL PARTICIPANT DATA INGESTION PIPELINE ARCHITECTURE

The participant data ingestion pipeline ([src/eval/research-data-pipeline.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/eval/research-data-pipeline.ts)) implements strict consent validation and schema checking:

```
REAL PARTICIPANT RESPONSES (responses.csv)
        ↓
CONSENT VALIDATION (consentGiven === true)
        ↓
ANONYMOUS ID SCHEMA CHECK (P001..P999)
        ↓
10-ITEM SUS RANGE VALIDATION (1 <= R <= 5)
        ↓
DataIngestionValidationResult { valid: true, dataSource: "REAL_HUMAN" }
        ↓
ResearchDataPipeline.calculateMetrics()
        ↓
DYNAMIC METRICS & EVIDENCE EXPORT
```

- Directories: `/research/raw/real/`, `/research/processed/real/`, `/research/anonymized/real/`, `/research/synthetic/`, `/research/analysis/`, `/research/evidence/`.

---

## 4. ADVERSARIAL NEGATIVE CONTROL EMPIRICAL RESULTS

To prove that the anti-hardcoding guard suite ([tests/anti-hardcoding-guard.test.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/tests/anti-hardcoding-guard.test.ts)) is genuinely enforceable, 8 adversarial negative control strategies were tested against temporary production files:

| Strategy | Injected Code Pattern | Expected | Actual Empirical Output | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Strategy 1** | Injected static literal metric return (`precision: 85.71, recall: 94.74`) | **FAIL** | **FAILED** (`AssertionError: Hardcoded Precision Return`) | **PASSED ✅** |
| **Strategy 2** | Injected fallback branch (`if (!matrix) return { precision: 85.71 }`) | **FAIL** | **FAILED** (`AssertionError: Hardcoded Fallback Branch`) | **PASSED ✅** |
| **Strategy 3** | Injected static research object (`const researchResults = { precision: 85.71 }`) | **FAIL** | **FAILED** (`AssertionError: Hardcoded Precision Return`) | **PASSED ✅** |
| **Strategy 4** | Injected metric array literal (`const metricArray = [85.71, 94.74, 90.0]`) | **FAIL** | **FAILED** (`AssertionError: Hardcoded Metric Array`) | **PASSED ✅** |
| **Strategy 5** | Injected stringified JSON (`JSON.parse('{"precision": 85.71}')`) | **FAIL** | **FAILED** (`AssertionError: Hardcoded JSON String Metric`) | **PASSED ✅** |
| **Strategy 6** | Injected static confusion matrix (`{ tp: 18, fp: 3, fn: 1, tn: 25 }`) | **FAIL** | **FAILED** (`AssertionError: Hardcoded Confusion Matrix Constant`) | **PASSED ✅** |
| **Strategy 7** | Injected nullish fallback operator (`return val ?? 85.71`) | **FAIL** | **FAILED** (`AssertionError: Nullish Fallback to Research Value`) | **PASSED ✅** |
| **Strategy 8** | Anti-Fabrication Test (`isRealHumanData === false` enforcement) | **PASS** | **PASSED** (5/5 subtests passed, 0 failures) | **PASSED ✅** |

---

## 5. DYNAMIC DATA FLOW & DESTRUCTIVE ANTI-CIRCULARITY PROOF

$$\text{benchmarks/testbed/ (147 LOC)} \xrightarrow{\text{UniversalASTMapper.parse()}} \text{ALPs} \xrightarrow{\text{RuleExecutionEngine.analyzeFile()}} \text{Diagnostics}$$
$$\text{Diagnostics} + \text{benchmarks/ground-truth.json} \xrightarrow{\text{EvaluationRunner.runEvaluation()}} \text{TP: 18, FP: 3, FN: 1, TN: 25}$$
$$\text{Metrics: Precision } \mathbf{85.71\%}, \text{ Recall } \mathbf{94.74\%}, \text{ F1-Score } \mathbf{90.00\%}, \text{ Cronbach's } \mathbf{\alpha = 0.892}, \text{ SUS } \mathbf{86.4}$$

- **Destructive Anti-Circularity Verification**: Renamed `docs/evidence/canonical-evaluation.json` to `.backup.json`. Ran `npm run research:evaluate`. Evaluation computed all metrics dynamically from AST parsing and rule execution against ground-truth labels and regenerated `docs/evidence/canonical-evaluation.json` with 0 errors.

---

## 6. RELEASE VERIFICATION COMMAND OUTPUTS

| Command | Objective | Output / Status |
| :--- | :--- | :--- |
| `npx tsc --noEmit` | Type Safety | **PASSED** (0 errors) ✅ |
| `npm run research:evaluate` | Dynamic Evaluation Execution | **PASSED** (Regenerated canonical reports) ✅ |
| `npm run research:validate` | Integrity & Provenance Check | **PASSED** (Verified provenance `dynamic: true` & formulas) ✅ |
| `npm run ci:scan` | Static Quality Gate | **PASSED** (Quality Score: 74%, exceeding 70% threshold) ✅ |
| `npm --prefix vscode-extension run compile` | VS Code Extension Build | **PASSED** (0 errors) ✅ |
| `npx tsx --test tests/evaluation-runner.test.ts tests/research-gap-eval.test.ts tests/anti-hardcoding-guard.test.ts` | Test Suites | **PASSED** (16/16 subtests passed across 3 suites) ✅ |

---

## 7. HOSTILE EXAMINER Q&A DEFENSE

1. **"Were the 85 participants real human developers?"**  
   *Defense*: No. $N=85$ represents an 85-profile synthetic usability scoring vector model used for methodological validation of statistical formulas ($\alpha=0.892, SUS=86.4$). This distinction is explicitly disclosed in methodology sections.
2. **"How does the system handle real human participant responses when collected?"**  
   *Defense*: `ResearchDataPipeline.ingestParticipantBatch()` validates informed consent (`consentGiven === true`), anonymized ID schemas (`P001`..`P999`), and SUS item bounds ($1 \le R \le 5$) before dynamically deriving Cronbach $\alpha$ and SUS scores.
3. **"Show me the raw data entering the calculation."**  
   *Defense*: [benchmarks/testbed/](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/benchmarks/testbed/) AST parsed representations matched against [benchmarks/ground-truth.json](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/benchmarks/ground-truth.json).
4. **"How do you know TP=18 is not hardcoded?"**  
   *Defense*: Proved by source code mutation (removing a diagnostic loop pattern drops $TP$ to 17) and anti-hardcoding guard tests.
5. **"What happens if I remove canonical-evaluation.json?"**  
   *Defense*: `EvaluationRunner.runEvaluation()` executes cleanly from scratch and regenerates `canonical-evaluation.json` without errors.

---

## FINAL RELEASE RECOMMENDATION

# 🟡 **TECHNICALLY READY — REAL HUMAN USER-STUDY EVIDENCE PENDING**
