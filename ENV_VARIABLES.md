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
| `ADMIN_BOOTSTRAP_PASSWORD` | **Yes (outside dev/test)** | `openssl rand -base64 24` output, ≥12 chars | Production | Password used to seed the two default ADMIN accounts. No default/guessable value is ever used outside development/test. **JSON storage backend**: applied automatically on first boot of an empty local DB. **Supabase/Postgres backend**: NOT automatic -- run `npm run db:seed-admin` explicitly (see "Admin Account Provisioning" below). |
| `STORAGE_PROVIDER` | No | `json` / `supabase` | All | Active storage engine provider (`json` for local/testing, `supabase` for cloud). |
| `NEXT_PUBLIC_SUPABASE_URL` | Cloud | `https://xxxx.supabase.co` | Client/Server | Supabase project URL accessible to client web application. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloud | `eyJhbGciOi...` | Client/Server | Public anon API key for Supabase client interactions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloud | `eyJhbGciOi...` | Server Only | Privileged service role key for administrative data migration. |
| `DATABASE_URL` | Cloud | `postgresql://postgres:...@...pooler.supabase.com:6543/postgres?pgbouncer=true` | Server Only | PgBouncer pooler connection string for Prisma ORM. |
| `DIRECT_URL` | Cloud | `postgresql://postgres:...@...supabase.com:5432/postgres` | Server Only | Direct PostgreSQL connection string for DDL migrations. |
| `OLLAMA_BASE_URL` | Optional | `http://127.0.0.1:11434` | Server Only | Local Ollama server endpoint for AI-assisted remediation (`src/ai/providers/ollama-provider.ts`). LOCAL DEVELOPMENT ONLY — setting this (or `OLLAMA_MODEL`) makes Ollama the highest-precedence provider, above `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` — see `src/ai/ai-provider-selector.ts`. Never point this at anything a Vercel/production deployment cannot actually reach. The browser never calls this endpoint directly. |
| `OLLAMA_MODEL` | Optional | `qwen2.5-coder:7b` | Server Only | The exact locally-pulled Ollama model tag to use. The server always uses this configured value; no client request can override it. Defaults to `qwen2.5-coder:7b` when `OLLAMA_BASE_URL` is set but this is not. |
| `OLLAMA_TIMEOUT_MS` | No | `120000` | Server Only | Overrides the default per-request timeout (ms) for local Ollama generation calls. |
| `ANTHROPIC_API_KEY` | Optional | `sk-ant-api03-...` | Server Only | Anthropic Claude API key for contextual patch generation. Used only when Ollama is not configured — see `src/ai/ai-provider-selector.ts`. |
| `ANTHROPIC_MODEL` | No | `claude-opus-5` | Server Only | Overrides the default Claude model used for AI remediation. |
| `ANTHROPIC_TIMEOUT_MS` | No | `45000` | Server Only | Overrides the default per-request timeout (ms) for Claude remediation calls. |
| `GEMINI_API_KEY` | Optional | `AIza...` | Server Only | Google Gemini API key for AI-assisted remediation (`src/ai/providers/gemini-provider.ts`). Used when neither Ollama nor `ANTHROPIC_API_KEY` is configured — see `src/ai/ai-provider-selector.ts`. |
| `GEMINI_MODEL` | No | `gemini-3.6-flash` | Server Only | Overrides the default Gemini model used for AI remediation. |
| `GEMINI_TIMEOUT_MS` | No | `45000` | Server Only | Overrides the default per-request timeout (ms) for Gemini remediation calls. |
| `ALLOW_TEST_RESET_TOKEN` | No | `true` | Test only | Test-only escape hatch that makes `/api/auth/forgot-password` echo the reset token in its response. Has no effect unless `NODE_ENV=test` is also set -- both must be true. Never set this in development, staging, preview, or production. |

---

## Admin Account Provisioning

The JSON storage backend has always self-seeded the two default `ADMIN` accounts
(`sanjula@nsbm.ac.lk`, `admin@figm.io`) on first boot of an empty local DB. The Supabase/Postgres
backend has no equivalent auto-seed step -- a freshly-provisioned or credential-rotated production
database starts with zero users, and self-registration deliberately cannot create an `ADMIN`
account (see `app/api/auth/register/route.ts`). To create the first admin account against the live
database, set `ADMIN_BOOTSTRAP_PASSWORD` and run:

```
npm run db:seed-admin
```

This is explicit and idempotent: it never overwrites an existing account's password or role, and it
reuses the exact same password-resolution logic (`resolveBootstrapAdminPassword`) as the JSON
backend, so there is one definition of "how a default admin password is resolved," not two. See
`scripts/seed-admin.ts` for the full rationale.

---

## Security Best Practices
1. **Never Commit Secrets**: Ensure `.env` is listed in `.gitignore`. `figm-user-db.json` (the local JSON-storage runtime database, which contains password hashes and refresh tokens) is also gitignored -- never `git add` it.
2. **Fail-Closed Secret Check**: `JWT_SECRET`, `REFRESH_SECRET`, and `ADMIN_BOOTSTRAP_PASSWORD` MUST be set in any environment other than local `development`/automated `test` runs (this includes `production`, `staging`, an unset `NODE_ENV`, or anything else) or the service refuses to start/seed default admin accounts with a predictable value.
3. **Client vs Server Boundary**: Only variables prefixed with `NEXT_PUBLIC_` are bundled into client-side JS bundles. All secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `REFRESH_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`) remain strictly server-side.
4. **Rotate After Any Suspected Exposure**: If `figm-user-db.json` was ever committed to git (it was, historically -- see `audit/new.md` SEC-01), rotate `JWT_SECRET`/`REFRESH_SECRET` (this invalidates all outstanding tokens) and reset every admin account's password via `ADMIN_BOOTSTRAP_PASSWORD` or the admin panel, then purge the file from git history (see the `git filter-repo` commands in `audit/new.md` / the remediation commit message).
