import test from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeHostedSupabaseUrl,
  looksLikeLocalDatabaseUrl,
  checkTestDatabaseSafety,
  assertSafeTestDatabaseEnvironment,
} from '../src/db/db-safety-guard';

/**
 * Phase 3 regression coverage (docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md): automated tests must
 * never be able to write to a real, hosted Supabase project. Every fixture URL below is fabricated
 * -- none are real secrets -- and every check is exercised with an explicit env object, never the
 * real process.env, so this file never depends on (or risks tripping over) actual credentials.
 */

const FAKE_HOSTED_POOLER_URL = 'postgresql://postgres.fakeproject:fakepass@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
const FAKE_HOSTED_DIRECT_URL = 'postgresql://postgres.fakeproject:fakepass@db.fakeproject.supabase.co:5432/postgres';
const FAKE_LOCAL_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
const FAKE_LOOPBACK_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

test('looksLikeHostedSupabaseUrl recognizes hosted Supabase pooler/direct/API URLs', () => {
  assert.equal(looksLikeHostedSupabaseUrl(FAKE_HOSTED_POOLER_URL), true);
  assert.equal(looksLikeHostedSupabaseUrl(FAKE_HOSTED_DIRECT_URL), true);
  assert.equal(looksLikeHostedSupabaseUrl('https://fakeproject.supabase.co'), true);
  assert.equal(looksLikeHostedSupabaseUrl(FAKE_LOCAL_URL), false);
  assert.equal(looksLikeHostedSupabaseUrl(FAKE_LOOPBACK_URL), false);
  assert.equal(looksLikeHostedSupabaseUrl(undefined), false);
  assert.equal(looksLikeHostedSupabaseUrl(null), false);
  assert.equal(looksLikeHostedSupabaseUrl(''), false);
});

test('looksLikeLocalDatabaseUrl recognizes localhost/loopback connection strings only', () => {
  assert.equal(looksLikeLocalDatabaseUrl(FAKE_LOCAL_URL), true);
  assert.equal(looksLikeLocalDatabaseUrl(FAKE_LOOPBACK_URL), true);
  assert.equal(looksLikeLocalDatabaseUrl(FAKE_HOSTED_POOLER_URL), false);
  assert.equal(looksLikeLocalDatabaseUrl(undefined), false);
});

test('checkTestDatabaseSafety never restricts development or production, only NODE_ENV=test', () => {
  assert.equal(
    checkTestDatabaseSafety({ NODE_ENV: 'development', DATABASE_URL: FAKE_HOSTED_POOLER_URL }).safe,
    true
  );
  assert.equal(
    checkTestDatabaseSafety({ NODE_ENV: 'production', DATABASE_URL: FAKE_HOSTED_POOLER_URL }).safe,
    true
  );
  assert.equal(checkTestDatabaseSafety({ DATABASE_URL: FAKE_HOSTED_POOLER_URL }).safe, true, 'NODE_ENV unset is not test');
});

test('checkTestDatabaseSafety flags a hosted-looking DATABASE_URL/DIRECT_URL/SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL under NODE_ENV=test', () => {
  const r1 = checkTestDatabaseSafety({ NODE_ENV: 'test', DATABASE_URL: FAKE_HOSTED_POOLER_URL });
  assert.equal(r1.safe, false);
  assert.equal(r1.offendingVar, 'DATABASE_URL');

  const r2 = checkTestDatabaseSafety({ NODE_ENV: 'test', DIRECT_URL: FAKE_HOSTED_DIRECT_URL });
  assert.equal(r2.safe, false);
  assert.equal(r2.offendingVar, 'DIRECT_URL');

  const r3 = checkTestDatabaseSafety({ NODE_ENV: 'test', SUPABASE_URL: 'https://fakeproject.supabase.co' });
  assert.equal(r3.safe, false);

  const r4 = checkTestDatabaseSafety({ NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'https://fakeproject.supabase.co' });
  assert.equal(r4.safe, false);
});

test('checkTestDatabaseSafety allows a local/loopback Postgres under NODE_ENV=test (e.g. a CI service container)', () => {
  assert.equal(checkTestDatabaseSafety({ NODE_ENV: 'test', DATABASE_URL: FAKE_LOCAL_URL }).safe, true);
  assert.equal(checkTestDatabaseSafety({ NODE_ENV: 'test', DATABASE_URL: FAKE_LOOPBACK_URL }).safe, true);
  assert.equal(checkTestDatabaseSafety({ NODE_ENV: 'test' }).safe, true, 'no DB env vars at all is always safe');
});

test('checkTestDatabaseSafety allows a hosted URL under NODE_ENV=test only with the explicit opt-in flag', () => {
  const result = checkTestDatabaseSafety({
    NODE_ENV: 'test',
    DATABASE_URL: FAKE_HOSTED_POOLER_URL,
    FIGM_ALLOW_TEST_AGAINST_HOSTED_DB: '1',
  });
  assert.equal(result.safe, true);

  const stillUnsafe = checkTestDatabaseSafety({
    NODE_ENV: 'test',
    DATABASE_URL: FAKE_HOSTED_POOLER_URL,
    FIGM_ALLOW_TEST_AGAINST_HOSTED_DB: 'true', // anything other than the exact string '1' does not count
  });
  assert.equal(stillUnsafe.safe, false);
});

test('assertSafeTestDatabaseEnvironment throws naming only the offending variable, never the URL/credential value', () => {
  const sensitiveUrl = 'postgresql://very_secret_user:very_secret_pass@aws-0-region.pooler.supabase.com:6543/postgres';
  assert.throws(
    () => assertSafeTestDatabaseEnvironment({ NODE_ENV: 'test', DATABASE_URL: sensitiveUrl }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('DATABASE_URL'), 'must name the offending variable');
      assert.ok(!err.message.includes('very_secret_user'), 'must never leak the credential');
      assert.ok(!err.message.includes('very_secret_pass'), 'must never leak the credential');
      assert.ok(!err.message.includes(sensitiveUrl), 'must never leak the full connection string');
      return true;
    }
  );
});

test('assertSafeTestDatabaseEnvironment does not throw for a safe environment', () => {
  assert.doesNotThrow(() => assertSafeTestDatabaseEnvironment({ NODE_ENV: 'test', DATABASE_URL: FAKE_LOCAL_URL }));
  assert.doesNotThrow(() => assertSafeTestDatabaseEnvironment({ NODE_ENV: 'test' }));
  assert.doesNotThrow(() => assertSafeTestDatabaseEnvironment({ NODE_ENV: 'production', DATABASE_URL: FAKE_HOSTED_POOLER_URL }));
});
