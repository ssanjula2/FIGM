/**
 * Test/production database isolation guard.
 *
 * Automated tests must never be able to write to a real, hosted Supabase project -- see
 * docs/audit/PRE_STUDY_SYNTHETIC_DB_RESIDUE_AUDIT.md and docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md
 * for the audit that led to this. In practice this repo's test suite already never reaches
 * Postgres under its normal invocation (`npm test` sets no DATABASE_URL/SUPABASE_URL, so
 * RepositoryFactory falls back to the local JSON-file provider, and UserDB is unconditionally
 * JSON-file-backed regardless of any env var). The one real gap is CI
 * (.github/workflows/figm-scan.yml), which injects DATABASE_URL/DIRECT_URL (a real secret, if
 * configured, or a harmless localhost fallback) into the same `npm test` step. This module closes
 * that off by construction rather than relying on "no test currently does this" staying true.
 *
 * Pure, dependency-free string/URL logic -- no network calls, no imports of prisma-client.ts or
 * any storage module (that would risk a circular import, since this guard is meant to run from
 * inside prisma-client.ts itself) -- and testable with fabricated fixture URLs, never real
 * secrets.
 */

/** A hosted Supabase Postgres endpoint (project pooler or direct connection) is real, live
 *  infrastructure -- never a disposable local/CI-local database. Deliberately structural (matches
 *  any Supabase project's hostname shape) rather than comparing against one specific project's
 *  connection string, so this stays correct if the project is ever migrated/rotated. */
export function looksLikeHostedSupabaseUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /supabase\.(co|com|in)\b/i.test(url);
}

/** localhost/127.0.0.1/postgres-service-name-in-docker are the only hosts a test run may ever
 *  target if it insists on a real Postgres connection instead of the JSON fallback (e.g. a CI
 *  runner's own ephemeral, empty Postgres service container). */
export function looksLikeLocalDatabaseUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /\/\/[^/]*@?(localhost|127\.0\.0\.1|::1)([:/]|$)/i.test(url) || /\/\/(localhost|127\.0\.0\.1|::1)([:/]|$)/i.test(url);
}

export interface DbSafetyCheckResult {
  safe: boolean;
  offendingVar?: string;
}

/** The actual gate. Only ever restrictive when NODE_ENV === 'test' -- normal local development
 *  and the deployed production app are untouched. Returns a structured result instead of throwing
 *  directly so callers (and tests) can decide how to report/abort. */
export function checkTestDatabaseSafety(env: NodeJS.ProcessEnv = process.env): DbSafetyCheckResult {
  if (env.NODE_ENV !== 'test') return { safe: true };
  // Explicit, rare opt-in for a deliberately-provisioned, disposable Supabase project dedicated to
  // CI/test use -- never the same project as production. Never set this to point at production.
  if (env.FIGM_ALLOW_TEST_AGAINST_HOSTED_DB === '1') return { safe: true };

  const candidateVars = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const;
  for (const varName of candidateVars) {
    const value = env[varName];
    if (looksLikeHostedSupabaseUrl(value)) {
      return { safe: false, offendingVar: varName };
    }
  }
  return { safe: true };
}

/** Throws (never returns) if the current process environment is unsafe for automated tests to run
 *  in. Deliberately never logs the offending value itself -- only which variable name tripped the
 *  check -- so this is safe to call from CI output without leaking a connection string. */
export function assertSafeTestDatabaseEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const result = checkTestDatabaseSafety(env);
  if (result.safe) return;
  throw new Error(
    `FATAL: refusing to run automated tests -- ${result.offendingVar} points at a real, hosted ` +
    'Supabase project. Automated tests must run against the local JSON-file storage fallback ' +
    '(the default when DATABASE_URL/SUPABASE_URL are unset) or an explicitly isolated test ' +
    'database. If this is a real CI job, check whether its DATABASE_URL/DIRECT_URL secrets are ' +
    'accidentally set to the production connection string -- they should be unset (letting tests ' +
    'use the JSON fallback) or point at a disposable local/CI-only Postgres instance. Set ' +
    'FIGM_ALLOW_TEST_AGAINST_HOSTED_DB=1 only for a deliberately-provisioned, disposable test ' +
    'Supabase project that is never the same project as production.'
  );
}
