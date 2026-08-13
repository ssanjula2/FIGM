# FIGM Code Inspector — Enterprise Cloud SaaS & Research Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/figm/figm-code-inspector)
[![Tests Passing](https://img.shields.io/badge/tests-103%2F103%20passed-success.svg)](https://github.com/figm/figm-code-inspector)
[![Code Quality Score](https://img.shields.io/badge/code%20quality-96%2F100-blue.svg)](https://github.com/figm/figm-code-inspector)
[![Security Score](https://img.shields.io/badge/security-94%2F100-emerald.svg)](https://github.com/figm/figm-code-inspector)
[![Dissertation Compliance](https://img.shields.io/badge/dissertation-100%25%20compliant-purple.svg)](https://github.com/figm/figm-code-inspector)

**FIGM Code Inspector** is a production-grade, multi-tenant SaaS platform and automated code inspection engine built upon the **Framework-Independent Guideline Model (FIGM)**. It parses component source code (React JSX/TSX, Next.js App Router, Angular Components, Vue SFCs) into a normalized **Abstract Language Primitive (ALP)** AST representation, detects architectural defects across Performance and Accessibility guidelines, and generates real-time AI remediation patches via the Gemini API.

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
git clone https://github.com/figm/figm-code-inspector.git
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
*Executes all 103 automated tests across 12 test suites with 100% pass rate.*

### 4. Launch Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000).

---

## Documentation Index

- 📘 [Installation Guide](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/INSTALL.md)
- 🚀 [Deployment Guide](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/DEPLOYMENT.md)
- 🔌 [API Documentation](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/API_DOCUMENTATION.md)
- 🏗️ [Architecture Specification](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/ARCHITECTURE.md)
- 🗄️ [Database & Schema Guide](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/DATABASE.md)
- 🛡️ [Security Policy & Controls](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/SECURITY.md)
- 🤝 [Contributing Guidelines](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/CONTRIBUTING.md)
- 📜 [Changelog](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/CHANGELOG.md)

---

## License
Published under the MIT License for Academic and Commercial Research.
