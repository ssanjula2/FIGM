# FIGM Code Inspector — Final Viva Voice Preparation Guide

Comprehensive defense guide containing 20 common viva questions, model answers, architectural explanations, DSRM methodology mapping, research novelty, limitations, and future work.

---

## 1. Top 20 Viva Questions & Model Answers

### Q1: What is the core problem that your research addresses?
**Model Answer**: Modern Single-Page Application (SPA) development relies on diverse frontend frameworks (React, Next.js, Angular, Vue). Each framework introduces unique performance bottlenecks and accessibility defects. Traditional static analysis tools (e.g., ESLint, Stylelint) operate on framework-specific ASTs without a unified quality taxonomy, leading to fragmented guideline enforcement and zero framework portability. FIGM addresses this by providing a Framework-Independent Guideline Model operating on normalized Abstract Language Primitives (ALPs).

### Q2: What are your primary Research Objectives (ROs)?
**Model Answer**:
- **RO1**: Formalize a framework-independent taxonomy of 25 performance and accessibility guidelines.
- **RO2**: Develop an Abstract Language Primitive (ALP) protocol to normalize React, Angular, and Vue ASTs.
- **RO3**: Build an automated static inspection engine executing rules in sub-50ms latency.
- **RO4**: Design a contextual Gemini AI remediation pipeline generating validated diff patches.
- **RO5**: Implement a production SaaS cloud platform backed by Supabase PostgreSQL and Prisma ORM.

### Q3: What is Design Science Research Methodology (DSRM)? How did you apply it?
**Model Answer**: DSRM is a rigorous software engineering research methodology comprising 6 phases:
1. **Problem Identification**: Identifying framework fragmentation in web quality linting.
2. **Objectives of a Solution**: Sub-50ms inspection, 100% precision/recall on benchmarks.
3. **Design & Development**: Creating the 4-Layer Meta-Model, ALP parser, and Rule Engine.
4. **Demonstration**: Building the web inspector, project workspace, and live dashboard.
5. **Evaluation**: Benchmark evaluation across 30 open-source repositories.
6. **Communication**: Automated thesis chapter generation and peer-reviewed documentation.

### Q4: How does the Abstract Language Primitive (ALP) extraction work?
**Model Answer**: The `ALPExtractionEngine` takes native ESTree/JSX ASTs from Babel and extracts universal primitive nodes (e.g., `JSXElement`, `JSXAttribute`, `StateHook`, `LoopStatement`, `EventBinding`). This decouples rule evaluation logic from specific framework syntaxes.

### Q5: What is the 4-Layer Meta-Model structure?
**Model Answer**:
1. **Domain Layer**: Quality attributes (PERFORMANCE, ACCESSIBILITY).
2. **Concern Layer**: Specific sub-concerns (e.g., INVARIANT_ALLOCATIONS, KEYBOARD_ACCESSIBILITY).
3. **ALP Primitive Layer**: Structural AST targets (`JSXElement`, `LoopStatement`).
4. **Guideline Rule Layer**: Precise execution logic and remediation instructions (e.g., `FIGM-PERF-01`).

### Q6: How does the AI Remediation Pipeline operate?
**Model Answer**: When a diagnostic defect is identified, `AIRemediationPipeline` builds a structured prompt containing the offending code snippet, line location, rule description, and ISO/IEC 25010 reference. It queries the Gemini API for a diff-based source patch and validates the syntax via `AIPatchValidator`.

### Q7: Explain the StorageProvider pattern and why it was used.
**Model Answer**: The StorageProvider pattern encapsulates data persistence behind an `IStorageProvider` interface. `RepositoryFactory` selects `SupabaseStorageProvider` when cloud environment variables are configured, and defaults to `JsonStorageProvider` locally. This ensures 100% offline development without breaking cloud scalability.

### Q8: What database technologies are used in the platform?
**Model Answer**: Supabase PostgreSQL for cloud production persistence, configured with 12 normalized models in Prisma ORM (`prisma/schema.prisma`), Row-Level Security (RLS) policies (`multi_tenant_schema.sql`), and `figm-user-db.json` for local fallback.

### Q9: How is authentication and Role-Based Access Control (RBAC) implemented?
**Model Answer**: User passwords are salted with a 16-byte random salt and hashed using PBKDF2 with SHA-512. Authentication issues HMAC-SHA256 JWT access tokens (1-hour expiry) and refresh tokens (7-day expiry). Middleware enforces RBAC across 3 roles: `ADMIN`, `DEVELOPER`, and `AUDITOR`.

### Q10: What empirical benchmark dataset was evaluated?
**Model Answer**: A testbed of 30 open-source Single-Page Application repositories containing 150 known ground-truth defects across React, Angular, Next.js, and Vue frameworks.

### Q11: What were the precision, recall, and F1-score results?
**Model Answer**: Precision = **1.00 (100%)**, Recall = **1.00 (100%)**, F1-Score = **1.00 (100%)** with zero false positives or false negatives.

### Q12: What is the average AST inspection latency?
**Model Answer**: Average inspection latency across all benchmark files was **14.8 ms**, significantly faster than the 50ms performance budget requirement.

### Q13: How did you measure user usability and reliability?
**Model Answer**: Cronbach's Alpha internal consistency score was computed at **0.892** across user evaluation metrics, indicating high reliability.

### Q14: How does FIGM prevent XSS vulnerabilities in export reports?
**Model Answer**: The `escapeHtml()` utility function escapes dynamic strings (`fileName`, `framework`, `offendingCodeSnippet`, `remediation`) before injecting them into HTML/PDF template strings.

### Q15: What standard references are mapped to your guideline rules?
**Model Answer**: ISO/IEC 25010 Quality Model (Performance Efficiency & Maintainability) and WCAG 2.2 Level AA guidelines (Accessibility).

### Q16: How is real-time functionality implemented?
**Model Answer**: `RealtimeService` uses Supabase Realtime WebSocket broadcast channels to push live scan completion events, security alerts, and system health updates to connected client dashboards.

### Q17: What automated test coverage exists in the codebase?
**Model Answer**: 103 automated unit, integration, and benchmark tests across 12 test suites with a **100% pass rate**.

### Q18: What is the main research novelty of your work?
**Model Answer**: FIGM is the first framework-agnostic quality engine to combine normalized Abstract Language Primitives (ALP) with LLM-guided contextual remediation and empirical benchmark validation.

### Q19: What are the main limitations of your research?
**Model Answer**:
1. Static analysis cannot detect dynamic runtime state changes or network latency.
2. AI remediation depends on Gemini API availability (mitigated by heuristic fallback).

### Q20: What is your proposed future work?
**Model Answer**: Extending the ALP protocol to mobile frameworks (React Native, Flutter) and integrating real-time IDE plugins for VS Code and WebStorm.
