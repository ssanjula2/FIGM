# Human User Study Data Collection Protocol

**Project**: FIGM Code Inspector  
**Institution**: NSBM Green University  
**Module**: IS303.2 Research Methodology  

## 1. Study Objectives

Evaluate the usability, developer perception, and guideline inspection efficiency of the FIGM Code Inspector across frontend developers (React, Vue, Angular).

## 2. Participant Recruitment Criteria

- **Inclusion Criteria**: Frontend software developers, software engineers, or computer science students with $\ge 6$ months experience in React, Vue, or Angular.
- **Exclusion Criteria**: Non-technical users or developers with zero frontend framework experience.

## 3. Execution Procedure

1. **Informed Consent**: Participant reviews study objective and clicks consent confirmation (`consent_given = true`).
2. **Task Execution**: Participant completes inspection of 3 benchmark codebases using FIGM Inspector (VS Code Extension or Web UI).
3. **Questionnaire Submission**: Participant completes the 10-item System Usability Scale (SUS) questionnaire.
4. **Data Logging**: Raw Google Form export is saved as `research/raw/real/responses.csv` (the exact path `scripts/import-user-study.ts` reads — see `research/user-study/README.md` for the export/import steps). The import script performs validation (consent + SUS-item sanity checks), anonymization (sequential `P001`, `P002`, ... IDs, never the original timestamp/free-text fields), and analysis in one pass, writing the canonical result to `research/analysis/usability-results.json` — the single file every downstream consumer (the live `/api/research-metrics` endpoint, the dissertation Chapter 6 exporter) reads from.
