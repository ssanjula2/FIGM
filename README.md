# FIGM Code Inspector — Multi-Tenant SaaS Platform & Research Prototype

[![Tests Passing](https://img.shields.io/badge/tests-1263%2F1265%20passed-yellow.svg)](https://github.com/ssanjula2/FIGM)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ssanjula2/FIGM)

> The "Code Quality 96/100", "Security 94/100", "Build: passing", and "Dissertation: 100% compliant" badges previously shown here traced to no computation anywhere in this codebase and have been removed rather than replaced with different unverified numbers. The test-count badge above is the actual count from the last `npm test` run (see Validation below); the workflow at `.github/workflows/figm-scan.yml` runs static analysis on push/PR but has not yet run on a public remote, so no CI status badge is shown until it has real run history to report.

**FIGM Code Inspector** is a multi-tenant SaaS-architected code inspection platform and undergraduate research prototype (NSBM Green University, IS303.2 Research Methodology coursework) built upon the **Framework-Independent Guideline Model (FIGM)**. It analyzes component source code (React JSX/TSX, Next.js App Router, Angular Components, Vue SFCs) against **50** Performance and Accessibility guideline rules (`figm-spec.json`'s `meta.totalCoreRules`; corrected as of Phase 3 dissertation-integrity work from a stale "25" figure that predated the rule set's growth), and generates AI-assisted remediation patches via the configured AI provider (Ollama, Claude, or Gemini, in that default precedence — see `src/ai/ai-provider-selector.ts`; corrected from a stale "the Claude API" claim in the same pass). All 50 rules are detected via a genuine compiler-derived AST (TypeScript compiler, `@vue/compiler-dom`, or `angular-html-parser`, depending on the rule) for at least one supported framework — re-verified directly by re-running `RuleExecutionEngine.analyzeFile` against every fixture in `benchmarks/ground-truth.json` and reading each diagnostic's own `sourceKind` field. Coverage remains framework-gated, not universal: 5 rules (FIGM-A11Y-01, FIGM-A11Y-03, FIGM-PERF-01, FIGM-PERF-02, FIGM-PERF-03) still fall back to a text/regex heuristic specifically on Vue SFC and/or Angular template files, where the TypeScript compiler cannot parse the markup directly. Every finding is labeled with which detection mechanism produced it — see `docs/architecture/AST_MIGRATION_MAP.md` for the full rule-by-rule breakdown and the reasoning behind what is and isn't AST-based today.

---

## Key Platform Features

- **Multi-Tenant SaaS Workspace**: Complete project management, scan history, search, archiving, duplication, and statistics persistence.
- **Dual Storage Engine**: Powered by **Supabase PostgreSQL** (Prisma ORM, tenant isolation enforced at the application/repository layer -- see `DATABASE.md` section 3) with zero-config fallback to **JsonStorageProvider**.
- **Real-Time WebSocket Updates (implemented, not yet wired into the UI)**: `src/storage/realtime-service.ts` and `src/hooks/useRealtime.ts` implement a real Supabase `postgres_changes` channel subscription for notifications/project/scan events, but no page currently imports or uses the hook -- the dashboard and notifications UI do not yet receive live pushes and rely on normal request/response refreshes instead.
- **AI Remediation Pipeline**: Contextual patch generation leveraging Anthropic Claude models.
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
*Executes 1265 automated tests across 75 test suites (corrected as of Phase 3 dissertation-integrity work from a stale "784/784, 100%" claim dated 2026-08-23 — the suite has grown substantially since, and restating a number without a fresh run is exactly the pattern this project's own `audit/DEFECT-REGISTER.md` (DR-10) flags as a recurring risk). **1263/1265 pass** as of this correction; the 2 failures are a single known, pre-existing, unrelated issue (a CSS contrast regression in `app/globals.css` — see `audit/DEFECT-REGISTER.md` DR-12), not a regression from this pass. Run `npm test` yourself to confirm the current count, since this number changes as the suite grows — do not hardcode a copy of this number elsewhere without re-running it.*

### 4. Launch Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000). Every route requires a session --
`/` redirects an unauthenticated visitor straight to `/auth/login` (also reachable at the
top-level `/login` alias). From there, register a new account (self-registration creates a
`DEVELOPER`/`AUDITOR` account only) or, for admin access against a fresh local/JSON database, log
in with one of the two default admin accounts seeded automatically on first boot (see
`ADMIN_BOOTSTRAP_PASSWORD` in `ENV_VARIABLES.md`; for a Supabase/Postgres-backed environment, run
`npm run db:seed-admin` first -- that seeding is not automatic on that backend).

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
