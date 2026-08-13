# FIGM Code Inspector — Installation Guide

This guide details local installation, environment setup, database initialization, and test execution for the FIGM Code Inspector cloud SaaS application.

---

## 1. System Requirements

- **Operating System**: macOS, Linux, or Windows 10/11
- **Node.js**: Version `18.17.0` or higher (LTS recommended)
- **Package Manager**: `npm` `v9.0.0`+ or `pnpm` / `yarn`
- **Database (Optional)**: Supabase PostgreSQL instance (Local JSON fallback works out-of-the-box)

---

## 2. Installation Steps

### Step 1: Repository Setup
```bash
git clone https://github.com/ssanjula2/FIGM.git
cd figm-model
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a local `.env` file by copying the template:
```bash
cp .env.example .env
```

Default local environment values:
```env
PORT=3000
NODE_ENV=development
STORAGE_PROVIDER=json
```

`JWT_SECRET`/`REFRESH_SECRET`/`ADMIN_BOOTSTRAP_PASSWORD` may be left unset for local development only
(`NODE_ENV=development`) -- the app will generate/use a one-time or fixed development-only fallback
and print a warning. In any other environment (including `NODE_ENV=production`, unset, or anything
else) these are required and the app refuses to start without them. Generate real values with e.g.
`openssl rand -hex 32` (secrets) / `openssl rand -base64 24` (admin bootstrap password) -- never reuse
the values that shipped in earlier versions of this file or in `.env.example`.

---

## 3. Database Setup & Migration

### Mode A: Local Development (JSON Storage)
No database configuration required. The application automatically initializes `figm-user-db.json` upon start.

### Mode B: Cloud Production (Supabase PostgreSQL)
1. Provide Supabase URL and Keys in `.env`:
   ```env
   STORAGE_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   DATABASE_URL=postgresql://postgres.your-project:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.your-project:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
2. Run Prisma schema migration:
   ```bash
   npx prisma db push
   ```
3. Execute JSON to Supabase migration script:
   ```bash
   npm run migrate-json-to-supabase
   ```

---

## 4. Verification & Testing

Verify that all dependencies and storage engine bindings are functional by running the complete 103-test verification suite:

```bash
npm test
```

Expected Output:
```text
# tests 103
# suites 12
# pass 103
# fail 0
```
