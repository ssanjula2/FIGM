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
| `GEMINI_API_KEY` | Google AI Studio Key | `AIzaSy...` |

---

## 4. Supabase Database & Cloud Storage Setup

1. Execute SQL DDL in Supabase SQL Editor:
   - Import file: `docs/multi_tenant_schema.sql`
2. Enable Row-Level Security (RLS) policies.
3. Create Cloud Storage Bucket:
   - Bucket Name: `figm-reports`
   - Public Access: Enabled (Read-Only)
