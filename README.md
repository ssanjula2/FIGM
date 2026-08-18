# FIGM Code Inspector — Multi-Tenant SaaS Platform & Research Prototype

[![Tests Passing](https://img.shields.io/badge/tests-678%2F678%20passed-success.svg)](https://github.com/ssanjula2/FIGM)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ssanjula2/FIGM)

> The "Code Quality 96/100", "Security 94/100", "Build: passing", and "Dissertation: 100% compliant" badges previously shown here traced to no computation anywhere in this codebase and have been removed rather than replaced with different unverified numbers. The test-count badge above is the actual count from the last `npm test` run (see Validation below); the workflow at `.github/workflows/figm-scan.yml` runs static analysis on push/PR but has not yet run on a public remote, so no CI status badge is shown until it has real run history to report.

**FIGM Code Inspector** is a multi-tenant SaaS-architected code inspection platform and undergraduate research prototype (NSBM Green University, IS303.2 Research Methodology coursework) built upon the **Framework-Independent Guideline Model (FIGM)**. It analyzes component source code (React JSX/TSX, Next.js App Router, Angular Components, Vue SFCs) against 25 Performance and Accessibility guideline rules, and generates AI-assisted remediation patches via the Gemini API. 23 of the 25 rules are detected via genuine TypeScript-compiler AST traversal for the frameworks where that syntax is real (React, Next.js, plain JS/TS, and Angular's TypeScript class body); the remaining 2 rules (Angular template markup: `*ngFor` trackBy and template method-call detection), plus every rule on Vue SFCs (which the TypeScript compiler cannot parse), use a text/regex heuristic detector. Every finding is labeled with which detection mechanism produced it — see `docs/architecture/AST_MIGRATION_MAP.md` for the full rule-by-rule breakdown and the reasoning behind what is and isn't AST-based today.

---

## Key Platform Features

- **Multi-Tenant SaaS Workspace**: Complete project management, scan history, search, archiving, duplication, and statistics persistence.
- **Dual Storage Engine**: Powered by **Supabase PostgreSQL** (Prisma ORM with Row-Level Security) with zero-config fallback to **JsonStorageProvider**.
- **Real-Time WebSocket Updates**: Supabase Realtime integration for live notifications, scan completion events, and dashboard feed broadcasts.
- **AI Remediation Pipeline**: Contextual patch generation leveraging Google Gemini models.
- **Multi-Format Exporter**: Export inspection results to PDF, HTML, JSON, CSV, and Markdown with embedded ISO/IEC 25010 & WCAG 2.2 Level AA citations.
- **Role-Based Access Control (RBAC)**: Enforces `ADMIN`, `AUDITOR`, and `DEVELOPER` permissions with JWT access & refresh tokens.
- **Empirical Research Suite**: Automated benchmark evaluator (`npm run research:evaluate`) scoring the scanner against a hand-labelled, multi-framework ground-truth fixture set (`benchmarks/testbed` + `benchmarks/ground-truth.json`) with statistical metric collection (Precision, Recall, F1).

---

## Quick Start & Local Execution

### Prerequisites
- Node.js `v18.x` or `v20.x`+
- npm `v9.x`+

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ssanjula2/FIGM.git
cd figm-model
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Automated Test Suite
```bash
npm test
```
*Executes all 678 automated tests across 71 test suites with 100% pass rate (last verified `npm test` run). Run `npm test` yourself to confirm the current count, since this number changes as the suite grows.*

### 4. Launch Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

---

## Documentation Index

- 📘 [Installation Guide](./INSTALL.md)
- 🚀 [Deployment Guide](./DEPLOYMENT.md)
- 🔌 [API Documentation](./API_DOCUMENTATION.md)
- 🏗️ [Architecture Specification](./ARCHITECTURE.md)
- 🗄️ [Database & Schema Guide](./DATABASE.md)
- 🛡️ [Security Policy & Controls](./SECURITY.md)
- 🔒 [Privacy & Data Retention Policy](./PRIVACY.md)
- 🤝 [Contributing Guidelines](./CONTRIBUTING.md)
- 📜 [Changelog](./CHANGELOG.md)

---

## License
Published under the MIT License for Academic and Commercial Research.
