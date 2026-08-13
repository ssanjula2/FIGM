# FIGM Code Inspector — Environment Variables Reference

Complete guide to all environment variables required for local development, automated testing, and Vercel/Supabase cloud production deployment.

---

## Environment Variables Matrix

| Variable Name | Required | Default / Example Value | Environment | Description |
| :--- | :---: | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | All | Runtime environment mode (`development`, `test`, `production`). |
| `PORT` | No | `3000` | Local | HTTP port for local Next.js development server. |
| `JWT_SECRET` | **Yes (outside dev/test)** | `e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3...` (≥32 chars, `openssl rand -hex 32`) | Production | Secret key used for signing HMAC-SHA256 JWT access tokens. |
| `REFRESH_SECRET` | **Yes (outside dev/test)** | `f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6...` (≥32 chars, `openssl rand -hex 32`) | Production | Secret key used for signing JWT refresh tokens. |
| `ADMIN_BOOTSTRAP_PASSWORD` | **Yes (outside dev/test)** | `openssl rand -base64 24` output, ≥12 chars | Production | Password used to seed the two default ADMIN accounts on first boot (empty local DB only). No default/guessable value is ever used outside development/test. |
| `STORAGE_PROVIDER` | No | `json` / `supabase` | All | Active storage engine provider (`json` for local/testing, `supabase` for cloud). |
| `NEXT_PUBLIC_SUPABASE_URL` | Cloud | `https://xxxx.supabase.co` | Client/Server | Supabase project URL accessible to client web application. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloud | `eyJhbGciOi...` | Client/Server | Public anon API key for Supabase client interactions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloud | `eyJhbGciOi...` | Server Only | Privileged service role key for administrative data migration. |
| `DATABASE_URL` | Cloud | `postgresql://postgres:...@...pooler.supabase.com:6543/postgres?pgbouncer=true` | Server Only | PgBouncer pooler connection string for Prisma ORM. |
| `DIRECT_URL` | Cloud | `postgresql://postgres:...@...supabase.com:5432/postgres` | Server Only | Direct PostgreSQL connection string for DDL migrations. |
| `GEMINI_API_KEY` | Optional | `AIzaSy...` | Server Only | Google Gemini AI Studio API key for contextual patch generation. |

---

## Security Best Practices
1. **Never Commit Secrets**: Ensure `.env` is listed in `.gitignore`. `figm-user-db.json` (the local JSON-storage runtime database, which contains password hashes and refresh tokens) is also gitignored -- never `git add` it.
2. **Fail-Closed Secret Check**: `JWT_SECRET`, `REFRESH_SECRET`, and `ADMIN_BOOTSTRAP_PASSWORD` MUST be set in any environment other than local `development`/automated `test` runs (this includes `production`, `staging`, an unset `NODE_ENV`, or anything else) or the service refuses to start/seed default admin accounts with a predictable value.
3. **Client vs Server Boundary**: Only variables prefixed with `NEXT_PUBLIC_` are bundled into client-side JS bundles. All secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `REFRESH_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`) remain strictly server-side.
4. **Rotate After Any Suspected Exposure**: If `figm-user-db.json` was ever committed to git (it was, historically -- see `audit/new.md` SEC-01), rotate `JWT_SECRET`/`REFRESH_SECRET` (this invalidates all outstanding tokens) and reset every admin account's password via `ADMIN_BOOTSTRAP_PASSWORD` or the admin panel, then purge the file from git history (see the `git filter-repo` commands in `audit/new.md` / the remediation commit message).
