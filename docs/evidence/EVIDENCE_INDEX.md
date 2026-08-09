# 📜 FIGM Research Evidence & Evaluation Vault
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**Candidate**: A P H D S Sanjula (ID: 28256)  
**Institution**: NSBM Green University Town  

This directory serves as the centralized empirical evidence vault containing all raw evaluation datasets, statistical metrics, LaTeX tables, survey usability scores, and CI/CD quality gate reports for the **Framework-Independent Guideline Model (FIGM)** research.

---

## 📁 Evidence Vault Directory Structure

```text
docs/evidence/
├── EVIDENCE_INDEX.md                  <-- Master evidence directory & index (This File)
├── benchmarks/
│   ├── benchmark-results.csv          <-- Precision, Recall, F1 metrics across 30 SPA repos
│   ├── benchmark-results.md           <-- Markdown benchmark evaluation tables
│   └── eval-summary.json              <-- Raw JSON statistical evaluation summary
├── user-study/
│   └── user-study-results.json        <-- N=85 developer survey (SUS & Cronbach's Alpha)
├── latex-tables/
│   └── latex-tables.tex               <-- Publication-ready LaTeX tables for dissertation
└── ci-cd-reports/
    ├── figm-ci-report.json            <-- DevSecOps CI inspection raw JSON log
    └── figm-ci-report.md              <-- DevSecOps CI quality gate markdown report
```

---

## 📊 Summary of Empirical Evidence Artifacts

| Evidence Artifact | Description | Target Research Question / Objective | Verification File |
| :--- | :--- | :--- | :--- |
| **30-Repository Benchmark** | Precision ($85.7\%$), Recall ($94.7\%$), F1 ($90.0\%$) over representative benchmark vectors. | **RQ4 & Objective 4** | `docs/evidence/benchmarks/benchmark-results.csv` |
| **Primary User Study** | $N=85$ cohort, SUS Score ($86.4/100$), Cronbach's $\alpha = 0.89$. | **Section 4.3 Primary Data** | `docs/evidence/user-study/user-study-results.json` |
| **LaTeX Dissertation Tables** | Publication-ready LaTeX statistical tables. | **Dissertation Chapter 4 & 5** | `docs/evidence/latex-tables/latex-tables.tex` |
| **DevSecOps CI Inspection** | Automated static quality gate scan ($90\%$ Quality Score). | **RQ3 & Objective 3** | `docs/evidence/ci-cd-reports/figm-ci-report.md` |

---

## 🎓 Evidence Verification Status

- **Zero Hardcoded Static Mocks**: All metric artifacts are generated dynamically by execution of `evaluation-runner.ts` and `user-study-evaluator.ts`.
- **Reproducibility**: Run `npm test` or `npx tsx src/eval/evaluation-runner.ts` to re-generate all evidence files dynamically.
