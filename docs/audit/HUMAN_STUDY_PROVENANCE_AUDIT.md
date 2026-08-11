# FIGM Code Inspector — Phase 6 & 7 Human Usability Study Provenance Audit

**Audit Date**: August 11, 2026  
**Auditor**: Senior Research-Methodology Auditor & Dissertation Examiner  
**Module**: IS303.2 Research Methodology  

---

## 📋 Empirical Human Usability Dataset Status

```
REAL HUMAN PARTICIPANTS: 0 / 85
COLLECTION STATUS:       NOT COLLECTED (PENDING LIVE HUMAN RESPONSES)
DATA PROVENANCE:         isRealHumanData = false
SUS SCORE:               PENDING REAL DATA (DISCLAIMING SYNTHETIC 86.4)
CRONBACH ALPHA (α):      PENDING REAL DATA (DISCLAIMING SYNTHETIC 0.892)
```

---

## 1. Zero-Fabrication Academic Integrity Directive

1. **No Fabricated Participants**: No mock or artificial participant records have been or will be presented as genuine human survey responses in the dissertation.
2. **Pipeline Testing Segregation**: Synthetic score vectors used during software pipeline testing are strictly flagged as `isRealHumanData = false` in `scripts/import-user-study.ts` and `src/eval/evaluation-runner.ts`.
3. **Dynamic Ingestion Readiness**: The ingestion pipeline (`npm run research:user-study:import`) is configured to validate consent, anonymous participant IDs (`P001`–`P085`), and Likert 1–5 bounds when real human participant survey responses arrive in `research/raw/real/responses.csv`.

---

## 2. SUS & Cronbach Alpha Dynamic Calculation Trace

When real participant survey responses are ingested:

### A. System Usability Scale (SUS) Formula:
- For odd items ($Q1, Q3, Q5, Q7, Q9$): $\text{Score}_i = \text{Response} - 1$
- For even items ($Q2, Q4, Q6, Q8, Q10$): $\text{Score}_i = 5 - \text{Response}$
- $\text{Total Participant SUS} = \left( \sum_{i=1}^{10} \text{Score}_i \right) \times 2.5$
- $\text{Mean SUS} = \frac{1}{N} \sum_{p=1}^{N} \text{Total Participant SUS}_p$

### B. Cronbach's Alpha Reliability ($\alpha$) Formula:
$$\alpha = \frac{K}{K - 1} \left( 1 - \frac{\sum_{i=1}^{K} \sigma_{y_i}^2}{\sigma_X^2} \right)$$
Where:
- $K = 10$ survey items.
- $\sigma_{y_i}^2$ is the variance of item $i$.
- $\sigma_X^2$ is the variance of the total survey scores.

---

## 3. Academic Readineess Verdict
- **Empirical Usability Findings**: 🟡 **YELLOW** (Configured & ready for live $N=85$ collection; 0 human participant responses ingested to date).
- **Software Metric Engine Status**: 🟢 **GREEN** ($F1=90.0\%$, $P=85.7\%$, $R=94.7\%$ software benchmark evaluation fully operational).
