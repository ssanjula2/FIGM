import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { JsonStorageProvider } from '../src/storage/json-storage-provider';
import { SupabaseStorageProvider } from '../src/storage/supabase-storage-provider';
import { ParticipantRepository } from '../src/engine/participant-repository';

/**
 * Regression coverage for the production incident traced this session: a normal /api/auth/register
 * call threw "FATAL: ADMIN_BOOTSTRAP_PASSWORD ..." even though RepositoryFactory correctly selected
 * SupabaseStorageProvider (confirmed live via /api/health reporting storageProvider: 'supabase',
 * services.database: 'CONNECTED_POSTGRES'). Root cause: SupabaseStorageProvider's OWN constructor
 * independently gates on Prisma/DATABASE_URL (a completely different env var than the
 * SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY pair RepositoryFactory checks to pick the
 * CLASS) and, when Prisma failed to initialize, silently substituted a JsonStorageProvider fallback
 * for every single method -- with `provider.name` still reporting 'supabase'. That legacy JSON
 * backend's cold-empty-store path unconditionally seeds the two DEFAULT_ADMIN_ACCOUNTS via
 * resolveBootstrapAdminPassword(), which is what actually threw -- a side effect completely
 * unrelated to normal user registration or research-participant provisioning.
 *
 * Fix (src/storage/supabase-storage-provider.ts constructor): outside development/test
 * (isInsecureFallbackAllowed(), the same allow-list already used by RepositoryFactory's own
 * top-level fallback check and by resolveBootstrapAdminPassword itself), a Prisma-unavailable
 * condition now throws a clear, controlled "Postgres/Prisma connection unavailable" error from the
 * constructor instead of silently degrading to JsonStorageProvider. Development/test keep the
 * existing permitted fallback unchanged.
 *
 * Test technique: `getPrismaClient()` (src/db/prisma-client.ts) memoizes its result on
 * `globalThis.__figmPrisma`, checked before ever touching `pg`/`@prisma/client`. Pre-seeding that
 * global directly (or leaving it/DATABASE_URL unset) lets these tests exercise
 * SupabaseStorageProvider's own branching contract deterministically, with zero real network I/O
 * and zero risk of ever touching a real Postgres connection (db-safety-guard.ts's
 * assertSafeTestDatabaseEnvironment is never even reached when DATABASE_URL stays unset).
 */

type FigmGlobal = typeof globalThis & { __figmPrisma?: any; __figmPgPool?: any };

function resetPrismaGlobalCache(): void {
  const g = globalThis as FigmGlobal;
  delete g.__figmPrisma;
  delete g.__figmPgPool;
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// Async variant -- only used where the guarded operation itself is async (test 5 below). Restores
// env only after the awaited operation genuinely settles, unlike the sync withEnv above, which would
// restore env before an unawaited promise's continuation ever ran.
async function withEnvAsync<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// Server-only Supabase credential pair RepositoryFactory's hasSupabaseCredentials checks -- present
// here on every sub-test below so RepositoryFactory always selects the SupabaseStorageProvider
// CLASS, isolating each test to SupabaseStorageProvider's OWN internal Prisma-availability gate.
const FAKE_SUPABASE_CREDS = {
  SUPABASE_URL: 'https://fake-project.supabase.co',
  SUPABASE_ANON_KEY: 'fake-anon-key-for-tests',
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
  STORAGE_PROVIDER: undefined,
  DATABASE_URL: undefined,
};

test('SupabaseStorageProvider production-fallback guard', async (t) => {
  await t.test('1. Supabase + working Prisma -> normal behavior (no fallback engaged, no throw)', () => {
    resetPrismaGlobalCache();
    try {
      (globalThis as FigmGlobal).__figmPrisma = { __fakeWorkingPrismaClient: true };
      withEnv({ ...FAKE_SUPABASE_CREDS, NODE_ENV: 'production' }, () => {
        const provider = new SupabaseStorageProvider();
        assert.equal(provider.name, 'supabase');
        assert.equal(provider.isConnected(), true, 'a truthy Prisma client must report connected');
        assert.equal((provider as any).fallback, null, 'no JSON fallback should ever be constructed when Prisma is available');
      });
    } finally {
      resetPrismaGlobalCache();
    }
  });

  await t.test('2. Supabase + unavailable Prisma + production -> controlled failure, NO JSON fallback', () => {
    resetPrismaGlobalCache();
    try {
      withEnv({ ...FAKE_SUPABASE_CREDS, NODE_ENV: 'production' }, () => {
        assert.throws(
          () => new SupabaseStorageProvider(),
          /FATAL:.*Postgres\/Prisma connection is unavailable/,
          'must fail loudly in production instead of silently constructing a JSON fallback'
        );
      });
    } finally {
      resetPrismaGlobalCache();
    }
  });

  await t.test('3. Supabase + unavailable Prisma + test/dev -> existing permitted fallback behavior remains', () => {
    resetPrismaGlobalCache();
    try {
      withEnv({ ...FAKE_SUPABASE_CREDS, NODE_ENV: 'test' }, () => {
        const provider = new SupabaseStorageProvider();
        assert.equal(provider.isConnected(), false);
        assert.ok((provider as any).fallback instanceof JsonStorageProvider, 'dev/test must keep the existing JSON fallback unchanged');
      });
      withEnv({ ...FAKE_SUPABASE_CREDS, NODE_ENV: 'development' }, () => {
        const provider = new SupabaseStorageProvider();
        assert.equal(provider.isConnected(), false);
        assert.ok((provider as any).fallback instanceof JsonStorageProvider, 'development must also keep the existing JSON fallback unchanged');
      });
    } finally {
      resetPrismaGlobalCache();
    }
  });

  await t.test('4. normal registration path never reaches UserDB/default-admin seeding through Supabase provider in production', () => {
    resetPrismaGlobalCache();
    RepositoryFactory.resetProvider();
    try {
      withEnv({ ...FAKE_SUPABASE_CREDS, NODE_ENV: 'production', ADMIN_BOOTSTRAP_PASSWORD: undefined }, () => {
        // Reproduces the exact reported incident's conditions end-to-end through the real entry
        // point POST /api/auth/register itself uses: RepositoryFactory.getStorageProvider().
        let thrown: unknown;
        try {
          RepositoryFactory.getStorageProvider();
        } catch (err) {
          thrown = err;
        }
        assert.ok(thrown instanceof Error, 'must throw synchronously at provider-construction time, before any findUserByEmail/createUser call is ever reached');
        assert.match((thrown as Error).message, /Postgres\/Prisma connection is unavailable/);
        assert.doesNotMatch(
          (thrown as Error).message,
          /ADMIN_BOOTSTRAP_PASSWORD/,
          'a lost Postgres connection must never be misreported as a missing admin-bootstrap secret'
        );
      });
    } finally {
      RepositoryFactory.resetProvider();
      resetPrismaGlobalCache();
    }
  });

  await t.test('5. research participant operations also cannot silently fall back to JSON in production', async () => {
    resetPrismaGlobalCache();
    RepositoryFactory.resetProvider();
    try {
      await withEnvAsync({ ...FAKE_SUPABASE_CREDS, NODE_ENV: 'production', ADMIN_BOOTSTRAP_PASSWORD: undefined }, async () => {
        await assert.rejects(
          () => ParticipantRepository.assignNewParticipant(),
          /Postgres\/Prisma connection is unavailable/,
          'participant provisioning must get the identical fail-closed guard, with zero changes to ParticipantRepository/consent/PRIMARY-SECONDARY logic itself -- the guard lives entirely in the shared storage layer'
        );
      });
    } finally {
      RepositoryFactory.resetProvider();
      resetPrismaGlobalCache();
    }
  });
});
