# FIGM Code Inspector — Environment Variables Reference

Complete guide to all environment variables required for local development, automated testing, and Vercel/Supabase cloud production deployment.

---

## Environment Variables Matrix

| Variable Name | Required | Default / Example Value | Environment | Description |
| :--- | :---: | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | All | Runtime environment mode (`development`, `test`, `production`). |
| `PORT` | No | `3000` | Local | HTTP port for local Next.js development server. |
| `JWT_SECRET` | **Yes (Prod)** | `e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3...` | Production | Secret key used for signing HMAC-SHA256 JWT access tokens. |
| `REFRESH_SECRET` | **Yes (Prod)** | `f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6...` | Production | Secret key used for signing JWT refresh tokens. |
| `STORAGE_PROVIDER` | No | `json` / `supabase` | All | Active storage engine provider (`json` for local/testing, `supabase` for cloud). |
| `NEXT_PUBLIC_SUPABASE_URL` | Cloud | `https://xxxx.supabase.co` | Client/Server | Supabase project URL accessible to client web application. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloud | `eyJhbGciOi...` | Client/Server | Public anon API key for Supabase client interactions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloud | `eyJhbGciOi...` | Server Only | Privileged service role key for administrative data migration. |
| `DATABASE_URL` | Cloud | `postgresql://postgres:...@...pooler.supabase.com:6543/postgres?pgbouncer=true` | Server Only | PgBouncer pooler connection string for Prisma ORM. |
| `DIRECT_URL` | Cloud | `postgresql://postgres:...@...supabase.com:5432/postgres` | Server Only | Direct PostgreSQL connection string for DDL migrations. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Server Only | Google Gemini AI Studio API key for contextual patch generation. |

---

## Security Best Practices
1. **Never Commit Secrets**: Ensure `.env` is listed in `.gitignore`.
2. **Production Secret Check**: In production (`NODE_ENV=production`), `JWT_SECRET` and `REFRESH_SECRET` MUST be set or the service will fail to launch safely.
3. **Client vs Server Boundary**: Only variables prefixed with `NEXT_PUBLIC_` are bundled into client-side JS bundles. All secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`) remain strictly server-side.
