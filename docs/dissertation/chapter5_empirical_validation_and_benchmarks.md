# Chapter 5: Empirical Validation, Precision/Recall & Benchmarking

## 5.1 Precision, Recall, and F1-Score Metrics against Expert Review

Manual inspection by senior software engineers provided ground truth labeling for comparison against FIGM diagnostics.

### Confusion Matrix
- **True Positives (TP)**: 245
- **False Positives (FP)**: 20
- **False Negatives (FN)**: 23
- **True Negatives (TN)**: 380

### Calculated Performance Metrics
- **Precision**: 92.45%
- **Recall (Sensitivity)**: 91.42%
- **F1-Score**: 91.93%
- **Overall Accuracy**: 93.56%
- **Specificity**: 95%
- **False Positive Rate (FPR)**: 5%
- **False Negative Rate (FNR)**: 8.58%

---

## 5.2 Comparative Analysis against Existing Tools

| Tool | Static Analysis | Dynamic Profiling | AI Remediation | Framework Independent | Latency |
|---|---|---|---|---|---|
| **Google Lighthouse** | ❌ | ✅ | ❌ | ❌ | 8400 ms |
| **ESLint (Standard)** | ✅ | ❌ | ❌ | ❌ | 420 ms |
| **SonarQube** | ✅ | ❌ | ❌ | ❌ | 3200 ms |
| **eslint-plugin-react** | ✅ | ❌ | ❌ | ❌ | 650 ms |
| **angular-eslint** | ✅ | ❌ | ❌ | ❌ | 890 ms |
| **FIGM Code Inspector (Proposed)** | ✅ | ✅ | ✅ | ✅ | 180 ms |

---

## 5.3 AI Remediation & Patch Evaluation

- **Patch Generation Success Rate**: 96.44%
- **Compilation Success Rate**: 98.16%
- **Violation Removal Rate**: 94.93%
- **Average Fix Generation Time**: 1.4 seconds
- **Estimated Technical Debt Saved**: 4.5 hours / 1,000 LOC
