# FIGM Static Analyzer Benchmark & Empirical Evaluation Report

## Executive Summary
* **Benchmark Lines of Code**: 799 LOC
* **Scan Duration**: 6712.00 ms
* **Scan Throughput**: 119 LOC/sec
* **Peak Memory Usage**: 0.10 MB
* **Overall Precision**: 100.0%
* **Overall Recall**: 100.0%
* **Overall F1-Score**: **100.0%**

> **Rule Coverage Scope**: This benchmark empirically measures **50 of 50** FIGM rules (those with hand-labelled ground-truth violations in `benchmarks/ground-truth.json`): `FIGM-A11Y-01`, `FIGM-A11Y-02`, `FIGM-A11Y-03`, `FIGM-A11Y-04`, `FIGM-A11Y-05`, `FIGM-A11Y-06`, `FIGM-A11Y-07`, `FIGM-ANG-01`, `FIGM-ANG-02`, `FIGM-ANG-03`, `FIGM-ANG-04`, `FIGM-ANG-05`, `FIGM-ANG-06`, `FIGM-ANG-07`, `FIGM-ANG-08`, `FIGM-ANG-09`, `FIGM-ANG-10`, `FIGM-NEXT-01`, `FIGM-NEXT-02`, `FIGM-NEXT-03`, `FIGM-NEXT-04`, `FIGM-NEXT-05`, `FIGM-NEXT-06`, `FIGM-NEXT-07`, `FIGM-NEXT-08`, `FIGM-NEXT-09`, `FIGM-NEXT-10`, `FIGM-PERF-01`, `FIGM-PERF-02`, `FIGM-PERF-03`, `FIGM-PERF-04`, `FIGM-PERF-05`, `FIGM-PERF-06`, `FIGM-REACT-01`, `FIGM-REACT-02`, `FIGM-REACT-03`, `FIGM-REACT-04`, `FIGM-REACT-05`, `FIGM-REACT-06`, `FIGM-REACT-07`, `FIGM-REACT-08`, `FIGM-REACT-09`, `FIGM-REACT-10`, `FIGM-REACT-11`, `FIGM-VUE-01`, `FIGM-VUE-02`, `FIGM-VUE-03`, `FIGM-VUE-04`, `FIGM-VUE-05`, `FIGM-VUE-06`. The remaining 0 rules () are verified only by unit-level positive/negative fixture tests (`tests/rule-detection-matrix.test.ts` et al.), **not** by this empirical Precision/Recall/F1 benchmark. The Precision/Recall/F1 figures above must never be read as "FIGM is 100.0% accurate across all 50 rules."
>
> **Calculation method**: TP/FP/FN computed by dynamically re-running RuleExecutionEngine.analyzeFile against every file in benchmarks/testbed and diffing the resulting diagnostics against benchmarks/ground-truth.json (exact filePath+ruleId match). Precision = TP/(TP+FP), Recall = TP/(TP+FN), F1 = 2*P*R/(P+R). No cached or hand-typed confusion matrix is used at any step.

---

## 1. Rule-by-Rule Accuracy Matrix

| Rule ID | Domain | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FIGM-A11Y-01` | ACCESSIBILITY | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-02` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-03` | ACCESSIBILITY | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-04` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-05` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-06` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-07` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-01` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-02` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-03` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-04` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-05` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-06` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-07` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-08` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-09` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-ANG-10` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-01` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-02` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-03` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-04` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-05` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-06` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-07` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-08` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-09` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-NEXT-10` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-01` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-02` | PERFORMANCE | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-03` | PERFORMANCE | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-04` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-05` | PERFORMANCE | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-06` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-01` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-02` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-03` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-04` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-05` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-06` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-07` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-08` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-09` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-10` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-REACT-11` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-VUE-01` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-VUE-02` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-VUE-03` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-VUE-04` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-VUE-05` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-VUE-06` | PERFORMANCE | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| **OVERALL** | **ALL** | **65** | **0** | **0** | **100.0%** | **100.0%** | **100.0%** |

---

## 2. Cross-Framework Accuracy Matrix

| Framework Target | Files | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ANGULAR_TEMPLATE` | 12 | 14 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `GENERIC_ESTREE` | 3 | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `NEXT_JS` | 9 | 9 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `REACT_JSX` | 34 | 27 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `VUE_SFC` | 9 | 11 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
