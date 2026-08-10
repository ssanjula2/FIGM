# FIGM REAL HUMAN USER STUDY — PARTICIPANT INSTRUCTIONS

**Research Title**: "Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code Inspector for Single Page Applications"  
**Target Sample**: 85 Valid Real Human Participants  

---

## OBJECTIVE
Your task is to evaluate the **FIGM Code Inspector** by inspecting sample Single Page Application (SPA) source code files and answering questions regarding rule readability, diagnostic clarity, and overall tool usability.

---

## STEP-BY-STEP PARTICIPANT WORKFLOW

### Step 1: Open the FIGM Code Inspector Interface
Navigate to the FIGM User Study page at `/user-study` (or open the provided online deployment URL).

### Step 2: Select a Benchmark Code Fixture
Choose one of the representative SPA source code fixtures:
- **React**: `UserProfile.jsx` (React 18 functional component with state and event handlers)
- **Next.js**: `DashboardPage.tsx` (Next.js App Router component with Server/Client boundaries)
- **Angular**: `SearchPanel.component.ts` (Angular 17 component with RxJS subscriptions)
- **Vue**: `DataGrid.vue` (Vue 3 Composition API with reactive data structures)

### Step 3: Run the FIGM Static Inspection
Click **"Run FIGM Scan on Benchmark"** to trigger the static analysis engine.

### Step 4: Review the Diagnostic Results
Examine the generated inspection output:
- **Rule IDs**: (e.g., `FIGM-PERF-01`, `FIGM-PERF-03`, `FIGM-A11Y-01`)
- **Severity Levels**: (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
- **Source Line Numbers**: (Start line and column locations)
- **Diagnostic Descriptions & Remediation Hints**: Recommended refactoring advice.

### Step 5: Perform the 5 Evaluation Tasks
Answer the task-based questions on the questionnaire:
1. **Task 1 (Rule Identification)**: Identify the rule ID reported for a specific code defect.
2. **Task 2 (Diagnostic Clarity)**: Assess how clear the explanation of the code concern is.
3. **Task 3 (Source Code Localization)**: Locate the line number in the source file corresponding to the reported issue.
4. **Task 4 (Remediation Understandability)**: Evaluate how clearly the recommended fix explains how to solve the issue.
5. **Task 5 (Manual Comparison)**: Assess whether FIGM identified defects that would be difficult to spot manually.

### Step 6: Complete the 10 System Usability Scale (SUS) Items
Rate your agreement with the 10 standard SUS statements on a 1 to 5 scale (1 = Strongly Disagree, 5 = Strongly Agree).

### Step 7: Provide Optional Feedback & Submit
Provide any optional comments regarding tool improvements, then click **Submit**.

---

## IMPORTANT NEUTRALITY GUIDANCE
- Please answer honestly based on your actual observation of the tool.
- There are no "right" or "wrong" usability opinions.
- Do not seek assistance during the evaluation tasks unless reporting a technical interface error.
