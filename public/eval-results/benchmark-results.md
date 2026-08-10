# FIGM Static Analyzer Benchmark & Empirical Evaluation Report

## Executive Summary
* **Benchmark Lines of Code**: 147 LOC
* **Scan Duration**: 1.64 ms
* **Scan Throughput**: 89552 LOC/sec
* **Peak Memory Usage**: 0.22 MB
* **Overall Precision**: 85.7%
* **Overall Recall**: 94.7%
* **Overall F1-Score**: **90.0%**

---

## 1. Rule-by-Rule Accuracy Matrix

| Rule ID | Domain | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FIGM-PERF-01` | PERFORMANCE | 1 | 0 | 1 | 100.0% | 50.0% | **66.7%** |
| `FIGM-PERF-02` | PERFORMANCE | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-03` | PERFORMANCE | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-04` | PERFORMANCE | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-01` | ACCESSIBILITY | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-02` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-03` | ACCESSIBILITY | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-04` | ACCESSIBILITY | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| **OVERALL** | **ALL** | **18** | **3** | **1** | **85.7%** | **94.7%** | **90.0%** |

---

## 2. Cross-Framework Accuracy Matrix

| Framework Target | Files | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REACT_JSX` | 1 | 8 | 2 | 0 | 80.0% | 100.0% | **88.9%** |
| `VUE_SFC` | 1 | 4 | 0 | 1 | 100.0% | 80.0% | **88.9%** |
| `ANGULAR_TEMPLATE` | 1 | 4 | 1 | 0 | 80.0% | 100.0% | **88.9%** |
| `GENERIC_ESTREE` | 1 | 2 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
