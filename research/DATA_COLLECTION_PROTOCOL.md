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
4. **Data Logging**: Response vector is serialized into `/research/raw/responses.csv` with a unique anonymized ID.
