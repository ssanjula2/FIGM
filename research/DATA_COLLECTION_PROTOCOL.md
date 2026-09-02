# Human User Study Data Collection Protocol

**Project**: FIGM Code Inspector  
**Institution**: NSBM Green University  
**Module**: IS303.2 Research Methodology  

## 1. Study Objectives

Evaluate the usability, developer perception, and guideline inspection efficiency of the FIGM Code Inspector across frontend developers (React, Vue, Angular).

**Target Sample**: 20 valid real human participants — the final approved study target. **Correction history:** an earlier version of this protocol, and every consumer of it (`research/CONSENT_FORM.md`, `PARTICIPANT_INSTRUCTIONS.md`, `QUESTIONNAIRE.md`, `research/user-study/README.md`, `CreateGoogleForm.gs`, the admin dashboard, the research-metrics API, and the dissertation exporters), used an undocumented 85-participant target. That was corrected to 20 during a prior pass, sourced then only to an in-session supervisor instruction. On 2026-09-03, the actual Research Proposal (`Research Proposal new.docx` Sec 4.3/5.2) and Interim Submission 02 (`28256_Interim 02.docx` Sec 1.9.2/3.4/3.6.1/3.6.2) were read in full and independently confirm a documented target of **80-100** student developers — the true historical baseline, preserved here for the record. The researcher has since confirmed 20 as a later, deliberate, approved research-scope decision (not a rejection of the Proposal/Interim 02 figures). The single canonical value lives in `src/research/research-config.ts`'s `HUMAN_STUDY_TARGET_PARTICIPANTS = 20`, and every consumer listed above reads from it rather than a separately hardcoded number. See `docs/research/PARTICIPANT_TARGET_DECISION.md` for the full decision record and `docs/audit/STAGE_1_RESEARCH_CONTRACT_CLOSE_REPORT.md` for closure evidence.

## 2. Participant Recruitment Criteria

- **Inclusion Criteria**: Frontend software developers, software engineers, or computer science students with $\ge 6$ months experience in React, Vue, or Angular.
- **Exclusion Criteria**: Non-technical users or developers with zero frontend framework experience.

## 3. Execution Procedure

1. **Informed Consent**: Participant reviews study objective and clicks consent confirmation (`consent_given = true`).
2. **Task Execution**: Participant inspects **one of** 3 provided benchmark fixtures — React (`UserProfile.jsx`), Angular (`SearchPanel.component.ts`), or Vue (`DataGrid.vue`), all in `samples/sample-spa/src/` — using FIGM Inspector (VS Code Extension or Web UI). **Correction (Phase 4, reconciled against the actual deployed instrument, `research/user-study/CreateGoogleForm.gs`'s own help text):** this step previously said "3 benchmark codebases," which read as every participant inspecting all three; the real Google Form directs each participant to inspect only one fixture of their choice before answering Questions 9–15, matching `QUESTIONNAIRE.md` Q9's "the benchmark fixture" (singular) phrasing. The offered pool is 3 fixtures (one per framework); the per-participant task is 1.
3. **Questionnaire Submission**: Participant completes the 10-item System Usability Scale (SUS) questionnaire.
4. **Data Logging**: Raw Google Form export is saved as `research/raw/real/responses.csv` (the exact path `scripts/import-user-study.ts` reads — see `research/user-study/README.md` for the export/import steps). The import script performs validation (consent + SUS-item sanity checks), anonymization (sequential `P001`, `P002`, ... IDs, never the original timestamp/free-text fields), and analysis in one pass, writing the canonical result to `research/analysis/usability-results.json` — the single file every downstream consumer (the live `/api/research-metrics` endpoint, the dissertation Chapter 6 exporter) reads from.
