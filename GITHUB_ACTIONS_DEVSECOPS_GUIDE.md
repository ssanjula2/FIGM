# FIGM Code Inspector — Enterprise DevSecOps & GitHub Actions CI/CD Guide

Comprehensive DevSecOps documentation for integrating FIGM Code Inspector AST Static Analysis Engine into GitHub Actions workflows.

---

## 1. DevSecOps Architecture & CI/CD Overview

FIGM Code Inspector transforms standard frontend development into an automated **DevSecOps** pipeline. Every code push, pull request, or manual workflow dispatch triggers an automated 3-stage inspection:

```mermaid
flowchart LR
    A[Git Push / PR] --> B[GitHub Actions Runner]
    B --> C[Install & Build]
    C --> D[Run 103 Unit & Integration Tests]
    D --> E[FIGM AST Static Analysis Engine]
    E --> F[Generate JSON & Markdown Artifacts]
    F --> G[GitHub Check Annotations & PR Comment]
    G --> H{Pass Thresholds?}
    H -- Yes --> I[Merge Allowed ✅]
    H -- No --> J[Pipeline Fail & Block PR ❌]
```

---

## 2. GitHub Actions Workflow Specification (`.github/workflows/figm-scan.yml`)

The workflow operates under Node 20.x environment with npm caching enabled:

- **Triggers**: `push`, `pull_request`, `workflow_dispatch`
- **Execution Budget**: Sub-50ms AST parsing per file; total workflow execution ~45s
- **Security Permissions**:
  - `contents: read`
  - `pull-requests: write`
  - `checks: write`
  - `statuses: write`

### Key Workflow Jobs:
1. **Checkout & Environment Setup**: Installs Node 20 with npm package caching.
2. **Prisma Generation & Build Verification**: Ensures database schemas & TypeScript compile with 0 errors.
3. **Test Suite Execution**: Runs all 103 automated tests.
4. **FIGM DevSecOps Inspection (`npm run ci:scan`)**: Executes AST engine across `app/` and `src/`.
5. **Artifact Generation & Upload**: Uploads `figm-ci-report.json` and `figm-ci-report.md` retained for 30 days.
6. **PR Automated Commenting**: Posts interactive markdown summary directly on Pull Requests.

---

## 3. Required GitHub Secrets Configuration

To run against your live database and authentication services in CI/CD, configure the following secrets under **Repository Settings → Secrets and variables → Actions**:

| Secret Name | Purpose | Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Transaction Pooler PostgreSQL Connection | `postgresql://postgres.xxx:pass@aws-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Direct DDL PostgreSQL Connection | `postgresql://postgres.xxx:pass@aws-1.pooler.supabase.com:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Cloud API Endpoint | `https://kiohthribojmofafmanc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhbGciOi...` |
| `GEMINI_API_KEY` | Gemini AI Remediation Engine API Key | `AIzaSy...` |

---

## 4. Pipeline Failure & Quality Gate Rules

The CI runner (`scripts/ci-figm-scan.ts`) enforces strict enterprise quality gates:

1. **Critical Defect Gate**: `CRITICAL > 0` causes immediate pipeline failure.
2. **High Severity Gate**: `HIGH > 200` causes pipeline failure.
3. **Quality Score Gate**: Overall score `< 70%` causes pipeline failure.

When a violation occurs, the runner emits GitHub Action Annotations directly onto the GitHub Code View diff lines:
```text
::error file=src/app/page.tsx,line=14::[FIGM-PERF-01] Invariant Object Allocation in Iteration Scopes
::warning file=src/app/component.tsx,line=42::[FIGM-A11Y-01] Keyboard Event Parity on Pointer Handlers
```

---

## 5. Local CI Execution & Testing

Developers can test the DevSecOps runner locally before pushing code:

```bash
# Execute local DevSecOps CI inspection runner
npm run ci:scan
```

This generates local artifacts:
- `figm-ci-report.json`
- `figm-ci-report.md`

---

*FIGM Code Inspector — Enterprise DevSecOps & CI/CD Automation Specifications v3.0*
