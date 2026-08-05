# FIGM Code Inspector — Final Year Dissertation Demonstration Guide

This guide provides a step-by-step walkthrough for demonstrating the FIGM Code Inspector project during final academic viva defense and research presentations.

---

## Demonstration Agenda (15-Minute Viva Flow)

### 1. Introduction & Research Problem (2 Minutes)
- **Topic**: Automated SPA Quality & Guideline Enforcement across Frameworks.
- **Problem**: Modern web applications written in React, Angular, and Vue suffer from framework-specific performance bottlenecks and accessibility defects that traditional linters fail to normalize.
- **Solution**: Framework-Independent Guideline Model (FIGM) and normalized Abstract Language Primitive (ALP) protocol.

### 2. Multi-Tenant SaaS Workspace & Dashboard (3 Minutes)
- **Live Demo**: Show overview page, active projects grid, quality statistics cards, recent scan reports, and activity feed.
- **Features Highlighted**: Supabase PostgreSQL persistence, role-based access control (`ADMIN`, `DEVELOPER`, `AUDITOR`), and realtime notifications.

### 3. Automated Code Inspection Engine (4 Minutes)
- **Live Demo**: Paste React JSX or Angular component into the Code Inspector workspace.
- **Trigger Scan**: Click **Run Automated Inspection**.
- **Results**: Show AST extraction, ALP normalization, defect locations (line/column), severity badges, and ISO/IEC 25010 citations.

### 4. AI Remediation & Multi-Format Exporter (3 Minutes)
- **Gemini AI Integration**: Click **Generate AI Patch** to display diff-based code remediation.
- **Report Export**: Generate and download PDF, HTML, JSON, CSV, and Markdown inspection reports.

### 5. Research Benchmark & Empirical Evaluation (3 Minutes)
- **Automated Benchmark Runner**: Run `npm run eval` in terminal to execute the 30-repository testbed.
- **Statistical Results**: Highlight 100% Precision, Recall, and F1-score across all 23 FIGM rules.
- **Automated Thesis Exporter**: Show generated dissertation chapter artifacts in `docs/dissertation/`.
