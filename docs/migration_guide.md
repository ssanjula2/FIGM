# FIGM Code Inspector SaaS Platform — Migration & Deployment Guide

This guide details the step-by-step procedure for migrating the **Framework-Independent Guideline Model (FIGM)** from prototype persistent JSON storage to a production-ready **Supabase PostgreSQL** database managed by **Prisma ORM**, while deploying seamlessly to **Vercel**.

---

## 1. Supabase PostgreSQL Setup

1. **Create Supabase Project**:
   - Log into [Supabase Console](https://app.supabase.com) and create a new project.
   - Note down your database password and Project Reference ID.

2. **Retrieve Connection Strings**:
   - Go to **Project Settings** → **Database** → **Connection String**.
   - Copy the **Transaction Pooler URL** (`Port 6543`) for `DATABASE_URL`.
   - Copy the **Direct Connection URL** (`Port 5432`) for `DIRECT_URL`.

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set your credentials:
   ```env
   DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   JWT_SECRET="your-secure-jwt-secret-key"
   REFRESH_SECRET="your-secure-refresh-token-secret"
   ```

---

## 2. Database DDL & Prisma Migration

### Option A: Standard SQL DDL Migration (Supabase SQL Editor)
1. Open **Supabase SQL Editor**.
2. Paste the contents of `docs/multi_tenant_schema.sql` (contains all 12 normalized tables, indexes, and Row-Level Security policies).
3. Click **Run**.

### Option B: Prisma Migration CLI
Execute Prisma migrations using the Direct URL:
```bash
npx prisma migrate dev --name init_supabase_schema
```
Generate Prisma Client:
```bash
npx prisma generate
```

---

## 3. Data Persistence & Architecture Fallback

The repository layer (`UserRepository`, `ProjectRepository`, `ScanRepository`, `NotificationRepository`, `DashboardRepository`, `SettingsRepository`, `ResearchRepository`) includes an automatic environment detection engine:

- **Production Mode (`DATABASE_URL` present)**: Executes queries against Supabase PostgreSQL via Prisma ORM & RLS policies.
- **Offline / Test Mode (`DATABASE_URL` absent)**: Seamlessly operates using local persistent store (`figm-user-db.json`), ensuring 100% offline capability and fast test execution.

---

## 4. Deploying to Vercel

1. **Connect Repository**: Push codebase to GitHub/GitLab and import into [Vercel Dashboard](https://vercel.com).
2. **Configure Build Command**:
   ```bash
   npx prisma generate && next build
   ```
3. **Environment Variables**: Add `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, and `REFRESH_SECRET` in Vercel project settings.
4. **Deploy**: Click **Deploy**.

---

## 5. Verification & Research Alignment

Run full automated verification suite:
```bash
npm test
```
All 96 tests validate static AST detection, dynamic profiling, AI remediation, multi-tenant RBAC, research evaluation benchmarks, and SaaS repository workflows.
