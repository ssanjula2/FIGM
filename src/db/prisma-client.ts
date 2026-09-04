import { assertSafeTestDatabaseEnvironment } from './db-safety-guard';

export const isPostgresConfigured = (): boolean => {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
};

// HMR-safe singleton: Next.js dev re-requires this module on every affected file change, and a
// plain module-scope `let` gets reset each time, silently leaking the previous run's `pg.Pool`
// (and its live server-side connections) instead of reusing/closing it. Stashing the instance on
// `globalThis` survives module reloads within the same Node process, so dev keeps exactly one
// pool alive instead of accumulating one per reload.
const globalForPrisma = globalThis as unknown as { __figmPrisma?: any; __figmPgPool?: any };

export const getPrismaClient = (): any => {
  if (!globalForPrisma.__figmPrisma && isPostgresConfigured()) {
    // Defense in depth: test-env-setup.mjs already aborts the whole test run before this can be
    // reached in the normal case, but this guards any code path (a script run with NODE_ENV=test,
    // a test file that imports this module before the bootstrap runs, etc.) that reaches a real
    // Postgres connection attempt without going through that bootstrap. See db-safety-guard.ts.
    assertSafeTestDatabaseEnvironment();
    try {
      const { PrismaClient } = require('@prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { Pool } = require('pg');

      // Runtime application queries MUST go through DATABASE_URL (the Supabase pooler /
      // PgBouncer transaction-mode connection on :6543) -- NOT DIRECT_URL (:5432), which is
      // reserved for Prisma CLI migrations (see prisma.config.ts) and has a far lower connection
      // ceiling. Every request previously opened a connection against DIRECT_URL, which -- with
      // no pool cap and no HMR-safe reuse -- exhausted that ceiling and produced the observed
      // "Can't reach database server" / "Server has closed the connection" failures.
      const connectionString = process.env.DATABASE_URL;
      const pool = new Pool({
        connectionString,
        max: 5,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
      });
      globalForPrisma.__figmPgPool = pool;
      const adapter = new PrismaPg(pool);

      globalForPrisma.__figmPrisma = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
    } catch (err) {
      console.error('Prisma initialization error:', err);
      globalForPrisma.__figmPrisma = null;
    }
  }
  return globalForPrisma.__figmPrisma;
};

export const prisma = getPrismaClient();
