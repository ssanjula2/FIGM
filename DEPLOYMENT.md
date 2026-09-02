# FIGM Code Inspector — Production Deployment Guide

This guide covers deploying FIGM Code Inspector to Vercel and Supabase in a production-ready multi-tenant cloud environment.

---

## 1. Vercel Deployment Architecture

FIGM Code Inspector is built with Next.js 14 App Router and is fully optimized for Vercel Serverless Functions and Edge Middleware.

### Deployment Prerequisites
- Vercel Account
- Supabase Cloud Project
- Domain SSL Certificate (automatic on Vercel)

---

## 2. Deploying to Vercel

### Option A: Vercel CLI Deployment
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Option B: GitHub Integration
1. Push repository to GitHub.
2. Import project into Vercel Dashboard.
3. Configure Environment Variables under **Project Settings -> Environment Variables**.

---

## 3. Mandatory Production Environment Variables

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment mode | `production` |
| `JWT_SECRET` | 64-character random string | `e8f9a0b1c2d3...` |
| `REFRESH_SECRET` | 64-character random string | `f1e2d3c4b5a6...` |
| `STORAGE_PROVIDER` | Active database provider | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Client Anon Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Secret Key | `eyJhbGciOi...` |
| `DATABASE_URL` | PgBouncer Pooler Connection String | `postgresql://...` |
| `DIRECT_URL` | Direct Database Connection String | `postgresql://...` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API Key | `sk-ant-api03-...` |

---

## 4. Supabase Database & Cloud Storage Setup

1. Apply the real, version-controlled Prisma migration history against the target database (this
   is the actual schema source of truth -- `prisma/migrations/`, not a hand-run SQL file):
   ```bash
   npx prisma migrate deploy
   ```
2. Seed the default ADMIN accounts (not automatic on the Supabase/Postgres backend -- see
   "Admin Account Provisioning" in `ENV_VARIABLES.md`):
   ```bash
   npm run db:seed-admin
   ```
3. Create Cloud Storage Bucket:
   - Bucket Name: `figm-reports`
   - Public Access: Enabled (Read-Only)

**Tenant isolation**: this deployment does NOT use Postgres Row-Level Security. `docs/multi_tenant_schema.sql`
is a standalone, aspirational RLS design that was never wired into the real Prisma migration
history and is never applied to the live database -- running it would add policies keyed on a
`current_setting('app.current_user_id')` session variable that no application code ever sets, so
it would provide no real protection even if imported. Tenant isolation is enforced entirely at the
application/repository authorization layer instead (every query is explicitly scoped by the
authenticated request's `userId`; see `DATABASE.md` section 3 for detail). Do not import that file
as part of this setup.
