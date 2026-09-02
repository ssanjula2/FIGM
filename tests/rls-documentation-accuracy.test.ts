import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for Phase 12 closure: several docs claimed Postgres Row-Level Security (RLS)
 * actively enforces tenant isolation in this deployment. It doesn't -- no real Prisma migration
 * (prisma/migrations/) contains any RLS DDL, docs/multi_tenant_schema.sql (the only place RLS
 * policies exist) is never applied to the live database, and no application code ever sets the
 * `app.current_user_id` session variable those policies key on, so even importing it would provide
 * no real protection. Tenant isolation is enforced entirely at the application/repository
 * authorization layer (every query explicitly scoped by userId). This guard fails if any of these
 * docs regress back to claiming RLS is what actually protects tenant data.
 */

const STALE_CLAIM_PATTERNS: RegExp[] = [
  /Prisma ORM with Row-Level Security/i,
  /PostgreSQL \(Prisma ORM & RLS policies\)/i,
  /Prisma ORM & RLS policies/i,
  /Supabase PostgreSQL DDL.*enforces tenant isolation using Postgres RLS/i,
  /real auth\/RLS/i,
  /with RLS policies \(`user_id = current_setting/i,
  /PostgreSQL for cloud persistence via Prisma ORM, with Row-Level Security \(RLS\) policies/i,
];

const DOCS_TO_CHECK = [
  'README.md',
  'DATABASE.md',
  'DEPLOYMENT.md',
  'VIVA_PREPARATION_GUIDE.md',
  'DISSERTATION_DEMO_GUIDE.md',
  'docs/DEVELOPMENT_SUMMARY.md',
  'docs/migration_guide.md',
];

for (const doc of DOCS_TO_CHECK) {
  test(`${doc} does not falsely claim Postgres RLS actively enforces tenant isolation`, () => {
    const content = fs.readFileSync(path.join(rootDir, doc), 'utf-8');
    for (const pattern of STALE_CLAIM_PATTERNS) {
      assert.doesNotMatch(content, pattern, `${doc} contains a stale/false RLS-is-active claim matching ${pattern}`);
    }
  });
}

test('DEPLOYMENT.md no longer instructs deployers to import the unused multi_tenant_schema.sql file', () => {
  const content = fs.readFileSync(path.join(rootDir, 'DEPLOYMENT.md'), 'utf-8');
  assert.doesNotMatch(content, /Import file: `docs\/multi_tenant_schema\.sql`/);
  assert.match(content, /prisma migrate deploy/, 'DEPLOYMENT.md must document the real Prisma migration path instead');
});

test('DATABASE.md accurately documents application-layer tenant isolation instead of RLS', () => {
  const content = fs.readFileSync(path.join(rootDir, 'DATABASE.md'), 'utf-8');
  assert.match(content, /application\/repository authorization layer/i);
});

test('app/security/page.tsx (a LIVE in-app page shown to real users) does not claim RLS is active', () => {
  // Worse than a stale doc: this page literally rendered "Row-Level Security (RLS) Active" with a
  // green checkmark to any signed-in user who visited /security. Also fixed two other stale claims
  // found on the same page while verifying this one: "24-hour" JWT expiration (real value is 1
  // hour access / 7 day refresh -- src/auth/auth-service.ts) and "PBKDF2 Password Hashing" as the
  // primary algorithm (real primary algorithm is scrypt since the SEC-06 migration; PBKDF2 is only
  // the legacy format transparently upgraded on next login).
  const content = fs.readFileSync(path.join(rootDir, 'app/security/page.tsx'), 'utf-8');
  assert.doesNotMatch(content, /Row-Level Security \(RLS\) Active/);
  assert.doesNotMatch(content, /24-hour expiration/);
  assert.doesNotMatch(content, /PBKDF2 Password Hashing/);
  assert.match(content, /Application-Layer Tenant Isolation Active/);
  assert.match(content, /scrypt/);
});
