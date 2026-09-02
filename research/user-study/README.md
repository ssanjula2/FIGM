# FIGM Code Inspector — Real Participant User Study Deployment Guide

**Research Title**: "Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code Inspector for Single Page Applications"  
**Institution**: NSBM Green University  
**Candidate**: A P H D S Sanjula (Student ID: 28256)  
**Target Sample Size**: **20 Valid Real Human Participants** — the final approved study target (a later approved research-scope decision confirmed by the researcher; the original Proposal/Interim 02 documents state 80-100 as the historical baseline, preserved and superseded — see `docs/research/PARTICIPANT_TARGET_DECISION.md`)  

---

## 1. Google Form Programmatic Deployment

1. Log in to your Google Account in any web browser and open [script.google.com](https://script.google.com/).
2. Click **"New project"** (+ button).
3. Delete any default code in `Code.gs` and copy-paste the entire contents of:
   `research/user-study/CreateGoogleForm.gs`
4. Save the file (Ctrl+S) and click **"Run"** for `createFIGMUserStudyForm`.
5. Review the execution log to get your 3 generated URLs:
   - **Form Edit URL**: Admin access to your Google Form.
   - **Form Respondent URL**: Shareable link to distribute to participants.
   - **Linked Google Sheet Responses URL**: Live collection destination.

---

## 2. Participant Recruitment & Task Execution

1. Share the **Form Respondent URL** with frontend software developers (React, Vue, Angular).
2. Participants complete the 5 task questions (evaluating **one of** the React/Angular/Vue benchmark fixtures — `UserProfile.jsx`, `SearchPanel.component.ts`, or `DataGrid.vue` — in `samples/sample-spa/src/`, per the in-form instructions before Question 9) and 10 standard System Usability Scale (SUS) questions (15–25 minutes). *(Corrected, Phase 4: previously said "benchmarks/testbed/" and did not specify "one of," which read as inspecting all three across a different fixture directory than the one the actual Google Form script points to.)*

---

## 3. Exporting & Ingesting Responses

When responses are submitted:

1. Open the linked Google Sheet Responses destination.
2. Click **File $\rightarrow$ Download $\rightarrow$ Comma Separated Values (.csv)**.
3. Save the downloaded CSV file to the repository path:
   `research/raw/real/responses.csv`
4. Run the automated ingestion and validation pipeline from Windows PowerShell:
   ```powershell
   npm run research:user-study:import
   ```

---

## 4. Checking Collection Status & Target Progress

Run the status command at any time to check real-time progress toward the 20-participant goal:
```powershell
npm run research:user-study:status
```

### Example Status Output (Prior to collection):
```
====================================================
  FIGM REAL HUMAN USER STUDY STATUS
====================================================
  Target Sample Size   : 20
  Valid Participants  : 0 (0/20 collected - 0%)
  Remaining Needed    : 20
  Collection Status   : NOT_COLLECTED
  Real Human Data     : false
  Target Reached      : false
====================================================
```

### Example Status Output (Target Reached):
```
====================================================
  FIGM REAL HUMAN USER STUDY STATUS
====================================================
  Target Sample Size   : 20
  Valid Participants  : 20 (20/20 collected - 100%)
  Remaining Needed    : 0
  Collection Status   : COLLECTED
  Real Human Data     : true
  Target Reached      : true
====================================================
```
