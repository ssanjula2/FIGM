// Loaded via `node --import` before any test file. Ensures the automated test run is recognized
// as a non-production environment by src/auth/auth-service.ts's fail-closed secret checks (see
// isInsecureFallbackAllowed / resolveSecret / resolveBootstrapAdminPassword) without ever setting
// NODE_ENV=production locally. Only sets a default -- an explicit NODE_ENV in the calling shell
// (e.g. a CI job intentionally simulating production) is left untouched.
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
