# FINAL RESEARCH CLAIM MATRIX

**Project Name**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Repository**: `ssanjula2/FIGM`  
**Candidate**: A P H D S Sanjula  
**Student ID**: 28256  
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**University**: NSBM Green University  
**Audit Date**: August 9, 2026  

---

## Dissertation Claim Verification & Classification Matrix

| Metric / Research Claim | Value / Representation | Classification | Source Code Location | Canonical Evidence File | Dissertation Location | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Precision** | **85.71%** | Dynamically computed ($TP / (TP + FP)$) | `src/eval/evaluation-runner.ts` | `docs/evidence/canonical-evaluation.json` | `docs/dissertation/chapter5_evaluation.md` | **VERIFIED DYNAMIC ✅** |
| **Recall** | **94.74%** | Dynamically computed ($TP / (TP + FN)$) | `src/eval/evaluation-runner.ts` | `docs/evidence/canonical-evaluation.json` | `docs/dissertation/chapter5_evaluation.md` | **VERIFIED DYNAMIC ✅** |
| **F1-Score** | **90.00%** | Dynamically computed ($2PR / (P+R)$) | `src/eval/evaluation-runner.ts` | `docs/evidence/canonical-evaluation.json` | `docs/dissertation/chapter5_evaluation.md` | **VERIFIED DYNAMIC ✅** |
| **Throughput** | **24.7k–26.6k LOC/s** | Dynamically measured (`performance.now()`) | `src/eval/evaluation-runner.ts` | `docs/evidence/canonical-evaluation.json` | `docs/dissertation/chapter5_evaluation.md` | **VERIFIED DYNAMIC ✅** |
| **Cronbach's $\alpha$** | **0.892** | Dynamically computed item variance ratio | `src/eval/user-study-evaluator.ts` | `docs/dissertation/chapter5_evaluation.md` | `docs/dissertation/chapter5_evaluation.md` | **VERIFIED DYNAMIC ✅** |
| **N=85 Dataset** | **85 User Profiles** | Synthetic Vector Model (85 scoring profiles) | `src/eval/user-study-evaluator.ts` | `docs/dissertation/chapter5_evaluation.md` | `docs/dissertation/chapter5_evaluation.md` | **DISCLOSED MODEL ✅** |
| **N=30 Dataset** | **30 Projects** | Synthetic Representative Dataset | `src/eval/repo-evaluator.ts` | `docs/dissertation/chapter4_large_scale_evaluation.md` | `docs/dissertation/chapter4_large_scale_evaluation.md` | **DISCLOSED MODEL ✅** |
