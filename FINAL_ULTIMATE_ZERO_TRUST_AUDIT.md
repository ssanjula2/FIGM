# MASTER REAL-HUMAN USER STUDY DEPLOYMENT & ZERO-TRUST AUDIT REPORT

**Research Title**: "Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code Inspector for Single Page Applications"  
**Repository**: `ssanjula2/FIGM`  
**Candidate**: A P H D S Sanjula  
**Student ID**: 28256  
**Module**: IS303.2 Research Methodology Repeat Coursework 2025  
**University**: NSBM Green University  
**Target Sample Size**: **85 Valid Real Human Participants** (`P001`..`P085`)  
**Audit Date**: August 9, 2026  

---

## 1. EXECUTIVE VERDICT & DEPLOYMENT READINESS CLASSIFICATION

# 🟡 **TECHNICALLY READY — REAL HUMAN USER-STUDY EVIDENCE PENDING**

**CONFIDENCE**: **HIGH**  
**REASON FOR CLASSIFICATION**:  
1. **Technically & Methodologically Complete**: The software evaluation engine, anti-hardcoding guards, Google Form generator script (`CreateGoogleForm.gs`), CSV ingestion validator (`import-user-study.ts`), progress checker (`user-study-status.ts`), user guide (`research/user-study/README.md`), landing page (`/user-study`), and unit test suite (`tests/user-study-pipeline.test.ts`) are **100% complete**.
2. **Dynamic Participant ID Assignment**: Anonymous participant IDs (`P001`..`P085`) are generated **dynamically AFTER validation** only for actual validated participant records. Excluded/invalid records do NOT consume participant IDs.
3. **Zero Fabricated Participants**: Prior to live participant data collection, the dataset provenance metadata is strictly set to:
   - `datasetType = "SYNTHETIC"`
   - `isRealHumanData = false`
   - `collectionStatus = "NOT_COLLECTED"`
   - `targetSampleSize = 85`
   - `validParticipantCount = 0`
   - `targetReached = false`
   - `anonymizedParticipantIds = []`

---

## 2. PARTICIPANT WORKFLOW & GOOGLE FORM INTEGRATION

The participant landing page ([app/user-study/page.tsx](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/app/user-study/page.tsx)) provides a complete 4-step workflow:
1. **Open `/user-study`**: Access participant background & research instructions.
2. **Select SPA Fixture**: Choose React (`UserProfile.jsx`), Angular (`SearchPanel.component.ts`), or Vue (`DataGrid.vue`).
3. **Run FIGM Scan**: Trigger static rule analysis and inspect detected rule IDs (`FIGM-PERF-01`..`04`, `FIGM-A11Y-01`..`04`), line numbers, and recommendations.
4. **Complete Questionnaire**: Click **"Open Google Form Questionnaire"** ↗ to submit feedback via the live Google Form ([https://docs.google.com/forms/d/e/1FAIpQLSf7XA39VT1Gx5inZstWj7sXkquAb04aK70BWz8uYWWtjMZDOw/viewform](https://docs.google.com/forms/d/e/1FAIpQLSf7XA39VT1Gx5inZstWj7sXkquAb04aK70BWz8uYWWtjMZDOw/viewform)).

---

## 3. REAL PARTICIPANT CSV INGESTION & ANALYTICS PIPELINE

The CLI ingestion engine ([scripts/import-user-study.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/scripts/import-user-study.ts)) processes Google Forms CSV exports:

1. **Header & Consent Gate**: Verifies `consentGiven === true` and age eligibility (18+).
2. **Dynamic Participant ID Assignment**: Assigns sequential participant IDs (`P001`..`P085`) **only** to validated participant records (`generateAnonymousParticipantIDs(validCount)`).
3. **Dynamic SUS Calculation**: Calculates SUS score per participant ($0..100$ scale) using item transformations:
   $$\text{SUS Score} = 2.5 \times \left( \sum_{i \text{ odd}} (R_i - 1) + \sum_{i \text{ even}} (5 - R_i) \right)$$
4. **Dynamic Cronbach's Alpha ($\alpha$)**: Calculates Cronbach's $\alpha$ reliability dynamically from the aligned Likert response matrix:
   $$\alpha = \frac{K}{K-1} \left( 1 - \frac{\sum_{i=1}^K \sigma_{y_i}^2}{\sigma_X^2} \right)$$
5. **Data Provenance Update**: Once valid real responses are ingested, updates metadata to `datasetType: "REAL_HUMAN_DATA"`, `isRealHumanData: true`, `collectionStatus: "COLLECTED"`, `targetReached: validParticipantCount >= 85`.

---

## 4. RELEASE VERIFICATION COMMAND MATRIX

| Verification Command | Purpose | Output / Status |
| :--- | :--- | :--- |
| `npx tsc --noEmit` | Type Safety | **PASSED** (0 errors) ✅ |
| `npx tsx --test tests/user-study-pipeline.test.ts` | Participant ID & Pipeline Tests | **PASSED** (8/8 tests passed) ✅ |
| `npm test` | Main Comprehensive Test Suite | **PASSED** (114/114 tests passed) ✅ |
| `npm run research:user-study:status` | Sample Size Progress Tracker | **PASSED** (`0/85 valid participants collected`) ✅ |
| `npm run research:evaluate` | Dynamic Evaluation Execution | **PASSED** (Regenerated canonical reports) ✅ |
| `npm run research:validate` | Integrity & Provenance Check | **PASSED** (Verified provenance `dynamic: true` & formulas) ✅ |
| `npm run ci:scan` | Static Quality Gate | **PASSED** (Quality Score: 73%, exceeding 70% threshold) ✅ |
| `npm --prefix vscode-extension run compile` | VS Code Extension Build | **PASSED** (0 errors) ✅ |

---

## FINAL RELEASE RECOMMENDATION

# 🟡 **TECHNICALLY READY — REAL HUMAN USER-STUDY EVIDENCE PENDING**
