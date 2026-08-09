# FIGM Research Claim Traceability & Verification Matrix

**Last Verified**: August 7, 2026  
**Canonical Ground Truth**: `docs/evidence/canonical-evaluation.json` (`benchmarks/eval-summary.json`)

---

## Metric Traceability Matrix

| Research Metric / Claim | Claim Location | Implemented File / Source | Calculated Value | Documented Claim | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Precision Rate** | `RESEARCH_EVIDENCE.md`, UI | `src/eval/evaluation-runner.ts` | **85.7%** (18/21) | 100% / 88.5% | **RECONCILED TO 85.7%** |
| **Recall Rate** | `RESEARCH_EVIDENCE.md`, UI | `src/eval/evaluation-runner.ts` | **94.7%** (18/19) | 100% / 91.6% | **RECONCILED TO 94.7%** |
| **F1-Score** | `RESEARCH_EVIDENCE.md`, UI | `src/eval/evaluation-runner.ts` | **90.0%** | 100% / 90.0% | **RECONCILED TO 90.0%** |
| **Throughput (LOC/sec)** | `BenchmarkSection.tsx` | `benchmarks/eval-summary.json` | **86,987 LOC/s** | 45,200 LOC/s | **RECONCILED TO 86,987** |
| **Repository Dataset ($N=30$)** | Dissertation Ch. 5 | `src/eval/repo-evaluator.ts` | 30 Framework Benchmark Items | 30 Live Git Repos | **CLASSIFIED AS BENCHMARK VECTOR** |
| **User Study ($N=85$)** | Dissertation Ch. 6 | `src/eval/user-study-evaluator.ts` | 85 Simulated User Vectors ($\alpha=0.892$) | 85 Human Subjects | **CLASSIFIED AS SIMULATED VECTOR MODEL** |

---

## Methodological Classifications

1. **Ground-Truth Benchmark Suite**: Evaluated directly against 4 single-page application framework testbed files (147 LOC total), yielding 18 True Positives, 3 False Positives, 1 False Negative.
2. **30 Representative Benchmark Projects**: A pre-compiled vector dataset of 30 production framework single-page applications used for structural density evaluation.
3. **85 Participant Usability Model**: Likert evaluation vector model simulating student and senior developer usability scores.
