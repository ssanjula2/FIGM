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

**Setting up a brand-new database** (nothing exists yet): run the tracked migration history in
`prisma/migrations/` against it directly --
```bash
npx prisma migrate deploy
```
then generate the client:
```bash
npx prisma generate
```
This applies every migration in `prisma/migrations/` in order and is safe to re-run (a no-op once
the database is already up to date, confirmed via `npx prisma migrate status`).

**Making a schema change going forward**: edit `prisma/schema.prisma`, then run
```bash
npx prisma migrate dev --name <describe-the-change>
```
against a development database. This generates a new numbered folder under `prisma/migrations/`
with the real DDL diff -- commit that folder alongside the schema change. Never hand-edit
`prisma/schema.prisma` and apply it via `prisma db push`/the Supabase SQL Editor directly in a
production environment going forward; that's exactly what left this project with no migration
history for its first stretch (PROD-02) -- the schema was live and correct, but not reproducible
from a clean database without a manual baseline step (see below).

**Historical note (PROD-02, closed):** this project's database was originally provisioned via
`prisma db push`/hand-run SQL, with no `prisma/migrations/` history at all -- functionally correct,
but not reproducible from an empty database, and `prisma migrate status` reported "the current
database is not managed by Prisma Migrate." Fixed via Prisma's own documented baseline procedure
(https://pris.ly/d/migrate-baseline): a migration representing the schema already live was
generated with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
(a read-only diff against the schema file, no database connection required), committed as
`prisma/migrations/<timestamp>_init_baseline/`, then marked as already-applied with
`prisma migrate resolve --applied <name>` -- this only inserts one tracking row into Prisma's own
`_prisma_migrations` table, it does not touch any application table or data (verified live: user
count identical before and after, `prisma migrate deploy` confirmed a genuine no-op immediately
after). Every schema change from this point forward goes through `prisma migrate dev`, so the
migration history stays real and reproducible.

---

## 3. Data Persistence & Architecture Fallback

The repository layer (`UserRepository`, `ProjectRepository`, `ScanRepository`, `NotificationRepository`, `DashboardRepository`, `SettingsRepository`, `ResearchRepository`) includes an automatic environment detection engine:

- **Production Mode (`DATABASE_URL` present)**: Executes queries against Supabase PostgreSQL via Prisma ORM, with tenant isolation enforced at the application/repository layer (every query explicitly scoped by `userId`) rather than by Postgres RLS -- see `DATABASE.md` section 3.
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
The suite validates static AST detection, dynamic profiling, AI remediation, multi-tenant RBAC, research evaluation benchmarks, and SaaS repository workflows -- run it locally for the current, live test count rather than trusting a number written down here, which will drift as the suite grows.
