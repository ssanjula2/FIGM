# FIGM Static Analyzer Benchmark & Empirical Evaluation Report

## Executive Summary
* **Benchmark Lines of Code**: 147 LOC
* **Scan Duration**: 265.68 ms
* **Scan Throughput**: 553 LOC/sec
* **Peak Memory Usage**: 18.45 MB
* **Overall Precision**: 90.5%
* **Overall Recall**: 100.0%
* **Overall F1-Score**: **95.0%**

> **Rule Coverage Scope**: This benchmark empirically measures **8 of 25** FIGM rules (those with hand-labelled ground-truth violations in `benchmarks/ground-truth.json`): `FIGM-A11Y-01`, `FIGM-A11Y-02`, `FIGM-A11Y-03`, `FIGM-A11Y-04`, `FIGM-PERF-01`, `FIGM-PERF-02`, `FIGM-PERF-03`, `FIGM-PERF-04`. The remaining 17 rules (`FIGM-A11Y-05`, `FIGM-A11Y-06`, `FIGM-ANG-01`, `FIGM-ANG-02`, `FIGM-ANG-03`, `FIGM-ANG-04`, `FIGM-ANG-05`, `FIGM-NEXT-01`, `FIGM-NEXT-02`, `FIGM-NEXT-03`, `FIGM-NEXT-04`, `FIGM-PERF-05`, `FIGM-PERF-06`, `FIGM-REACT-01`, `FIGM-REACT-02`, `FIGM-REACT-03`, `FIGM-REACT-04`) are verified only by unit-level positive/negative fixture tests (`tests/rule-detection-matrix.test.ts` et al.), **not** by this empirical Precision/Recall/F1 benchmark. The Precision/Recall/F1 figures above must never be read as "FIGM is 95.0% accurate across all 25 rules."
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
| `FIGM-PERF-01` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-02` | PERFORMANCE | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-03` | PERFORMANCE | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-04` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| **OVERALL** | **ALL** | **19** | **2** | **0** | **90.5%** | **100.0%** | **95.0%** |

---

## 2. Cross-Framework Accuracy Matrix

| Framework Target | Files | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REACT_JSX` | 1 | 8 | 1 | 0 | 88.9% | 100.0% | **94.1%** |
| `VUE_SFC` | 1 | 5 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `ANGULAR_TEMPLATE` | 1 | 4 | 1 | 0 | 80.0% | 100.0% | **88.9%** |
| `GENERIC_ESTREE` | 1 | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
