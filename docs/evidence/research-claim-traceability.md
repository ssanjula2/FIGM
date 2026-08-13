# FIGM Research Claim Traceability & Verification Matrix

**Last Verified**: August 7, 2026  
**Canonical Ground Truth**: `docs/evidence/canonical-evaluation.json` (`benchmarks/eval-summary.json`)

---

## Metric Traceability Matrix

| Research Metric / Claim | Claim Location | Implemented File / Source | Calculated Value | Documented Claim | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Precision Rate** | `BenchmarkSection.tsx`, `/api/research-metrics` | `src/eval/evaluation-runner.ts` → `benchmarks/eval-summary.json` | **85.7%** (18 TP / 21 flagged) | Live from API, no hardcoded value | **VERIFIED — LIVE** |
| **Recall Rate** | `BenchmarkSection.tsx`, `/api/research-metrics` | `src/eval/evaluation-runner.ts` → `benchmarks/eval-summary.json` | **94.7%** (18/19 ground truth) | Live from API, no hardcoded value | **VERIFIED — LIVE** |
| **F1-Score** | `BenchmarkSection.tsx`, `/api/research-metrics` | `src/eval/evaluation-runner.ts` → `benchmarks/eval-summary.json` | **90.0%** | Live from API, no hardcoded value | **VERIFIED — LIVE** |
| **Throughput (LOC/sec)** | `BenchmarkSection.tsx` | `benchmarks/eval-summary.json` | **577.1 LOC/s** | Live from API, no hardcoded value | **VERIFIED — LIVE** |
| **Repository Dataset ($N=30$)** | *(formerly)* Dissertation Ch. 5 | *(formerly)* `src/eval/repo-evaluator.ts` | N/A — never real | 30 Live Git Repos | **FABRICATED — DATASET DELETED.** No repositories were ever cloned or scanned; the 30-record array (invented repo names/URLs, e.g. `exchangerates/dashboard`, which does not exist) has been removed from the codebase and all dependent chapters/UI text rewritten. No large-scale repository evaluation currently exists. |
| **User Study ($N=85$)** | Dissertation Ch. 6 | `src/eval/user-study-evaluator.ts` | 0 real participants collected | 85 Human Subjects | **PENDING — NOT FABRICATED.** The scoring pipeline is implemented and its formulas verified against explicitly-labelled `SYNTHETIC_PIPELINE_TEST_DATA`; real collection status is surfaced live via `/api/research-metrics` (`userStudy.collectionStatus`). No real usability score currently exists. |

---

## Methodological Classifications

1. **Ground-Truth Benchmark Suite**: Evaluated directly against 4 single-page application framework testbed files (147 LOC total), yielding 18 True Positives, 3 False Positives, 1 False Negative. This is the only real, currently-computed accuracy evaluation in the project.
2. **30-Repository Dataset — Retracted**: Previously described here (and in earlier versions of this table) as a "benchmark vector" — a euphemism that avoided disclosing that the 30 records were fabricated with no repository ever cloned or scanned. The dataset, its generator code, and every UI/documentation claim depending on it have been deleted or rewritten to state plainly that no large-scale evaluation was performed.
3. **85-Participant Usability Model**: A synthetic vector used only to verify the Cronbach's Alpha / Likert-aggregation formulas compute correctly. It is not, and must never be presented as, real human usability data. Real data collection status is 0/85 as of this document's last verification.
