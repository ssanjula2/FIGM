# FIGM Static Analyzer Benchmark & Empirical Evaluation Report

## Executive Summary
* **Benchmark Lines of Code**: 147 LOC
* **Scan Duration**: 296.51 ms
* **Scan Throughput**: 496 LOC/sec
* **Peak Memory Usage**: 9.68 MB
* **Overall Precision**: 90.5%
* **Overall Recall**: 100.0%
* **Overall F1-Score**: **95.0%**

---

## 1. Rule-by-Rule Accuracy Matrix

| Rule ID | Domain | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FIGM-PERF-01` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-02` | PERFORMANCE | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-03` | PERFORMANCE | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-04` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-01` | ACCESSIBILITY | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-02` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-03` | ACCESSIBILITY | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-04` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| **OVERALL** | **ALL** | **19** | **2** | **0** | **90.5%** | **100.0%** | **95.0%** |

---

## 2. Cross-Framework Accuracy Matrix

| Framework Target | Files | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REACT_JSX` | 1 | 8 | 1 | 0 | 88.9% | 100.0% | **94.1%** |
| `VUE_SFC` | 1 | 5 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `ANGULAR_TEMPLATE` | 1 | 4 | 1 | 0 | 80.0% | 100.0% | **88.9%** |
| `GENERIC_ESTREE` | 1 | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
