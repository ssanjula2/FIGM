// Loaded via `node --import` before any test file. Ensures the automated test run is recognized
// as a non-production environment by src/auth/auth-service.ts's fail-closed secret checks (see
// isInsecureFallbackAllowed / resolveSecret / resolveBootstrapAdminPassword) without ever setting
// NODE_ENV=production locally. Only sets a default -- an explicit NODE_ENV in the calling shell
// (e.g. a CI job intentionally simulating production) is left untouched.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// P0 data-integrity guard (see docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md): abort the entire
// test run before a single test file loads if the environment points at a real, hosted Supabase
// project. This is the earliest possible choke point -- `--import` modules are fully awaited
// before Node proceeds to the test files themselves. Also enforced independently inside
// src/db/prisma-client.ts (defense in depth for any code path that imports it without going
// through this bootstrap).
const { assertSafeTestDatabaseEnvironment } = await import('../src/db/db-safety-guard.ts');
assertSafeTestDatabaseEnvironment();
