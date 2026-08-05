# Chapter 5: Empirical Results, Discussion & Static Analysis Trade-Offs

## 5.1 Empirical Evaluation Results

The Framework-Independent Guideline Model (FIGM) analyzer was empirically evaluated against a benchmark testbed containing multi-framework SPA source code (React JSX, Vue SFC, Angular Component Templates, and Vanilla JS) with known ground-truth quality defects.

### 5.1.1 Summary of Accuracy Metrics

| Evaluation Parameter | Measured Value |
| :--- | :--- |
| **Total Benchmark Lines of Code (LOC)** | 147 LOC |
| **Total Ground-Truth Injected Defects** | 19 Defect Targets |
| **True Positives ($TP$)** | 16 |
| **False Positives ($FP$)** | 0 |
| **False Negatives ($FN$)** | 3 |
| **Overall Precision ($\text{Precision} = \frac{TP}{TP+FP}$)** | **100.0%** |
| **Overall Recall ($\text{Recall} = \frac{TP}{TP+FN}$)** | **84.2%** |
| **Overall F1-Score ($F_1 = 2 \cdot \frac{P \cdot R}{P + R}$)** | **91.4%** |
| **Scan Speed / Throughput** | **58,052 LOC / sec** (2.53 ms execution time) |

---

## 5.2 Rule-by-Rule Accuracy Breakdown

To assess detection consistency, accuracy metrics were computed across each of the 8 core FIGM rules:

| Rule ID | Domain | Target ALP | $TP$ | $FP$ | $FN$ | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FIGM-PERF-01` | PERFORMANCE | `ALP-LOOP-ALLOC` | 1 | 0 | 1 | 100.0% | 50.0% | **66.7%** |
| `FIGM-PERF-02` | PERFORMANCE | `ALP-LAYOUT-ELEMENT` | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-03` | PERFORMANCE | `ALP-ASYNC-DISPOSAL` | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-PERF-04` | PERFORMANCE | `ALP-STATIC-IMPORT` | 0 | 0 | 2 | 100.0% | 0.0% | **0.0%** |
| `FIGM-A11Y-01` | ACCESSIBILITY | `ALP-EVENT-KEYBOARD` | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-02` | ACCESSIBILITY | `ALP-ARIA-NAMING` | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-03` | ACCESSIBILITY | `ALP-LIVE-REGION` | 3 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `FIGM-A11Y-04` | ACCESSIBILITY | `ALP-FOCUS-TRAVERSAL` | 1 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| **TOTAL** | **ALL** | **ALL ALPs** | **16** | **0** | **3** | **100.0%** | **84.2%** | **91.4%** |

---

## 5.3 Cross-Framework Portability Achievements

A primary objective of FIGM is achieving framework-independent static analysis across diverse web UI libraries. The cross-framework accuracy matrix demonstrates balanced performance across all targets:

| Framework Target | Files | $TP$ | $FP$ | $FN$ | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `REACT_JSX` | 1 | 7 | 0 | 1 | 100.0% | 87.5% | **93.3%** |
| `VUE_SFC` | 1 | 4 | 0 | 1 | 100.0% | 80.0% | **88.9%** |
| `ANGULAR_TEMPLATE` | 1 | 4 | 0 | 0 | 100.0% | 100.0% | **100.0%** |
| `GENERIC_ESTREE` | 1 | 1 | 0 | 1 | 100.0% | 50.0% | **66.7%** |

---

## 5.4 Analytical Discussion & Static Analysis Trade-Offs

### 5.4.1 Perfect Precision vs. Recall Trade-offs
The FIGM static analyzer achieved an **Overall Precision of 100.0%** with **zero false positive alerts** ($FP = 0$). In static analysis, zero false positive noise is critical for developer adoption, as false alarms erode developer trust in automated linter tooling.

### 5.4.2 Analysis of False Negatives ($FN = 3$)
The 3 false negatives observed in the benchmark evaluation stemmed from specific intra-procedural data flow patterns:
1. **Rule `FIGM-PERF-04` (Static Imports in Deferred Paths)**: Top-level static imports (`import HeavyModule from 'lib'`) defined at line 1 of a module require inter-procedural Control Flow Graph (CFG) reachability analysis to trace whether the imported symbol is invoked exclusively inside conditional branches (`if (shouldTrack) { ... }`). AST pattern matching alone without full CFG traversal misses deferred call sites.
2. **Rule `FIGM-PERF-01` (Invariant Object Allocations)**: Detecting whether an object literal inside a helper function is truly invariant vs. closure-bound requires variable lifetime taint analysis.

### 5.4.3 Performance Throughput
The analyzer demonstrated exceptional execution performance, scanning at **58,052 Lines of Code per second** (processing the 147 LOC benchmark in **2.53 milliseconds**). This near-zero latency enables seamless integration into IDE real-time linter passes and pre-commit Git hook workflows.
