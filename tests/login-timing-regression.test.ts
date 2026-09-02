import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as loginPOST } from '../app/api/auth/login/route';
import { POST as registerPOST } from '../app/api/auth/register/route';
import { RepositoryFactory } from '../src/storage/repository-factory';

/**
 * Regression coverage for Phase 10 closure: /api/auth/login used to return immediately for an
 * unknown email (skipping the scrypt password hash/verify entirely) while a known email with a
 * wrong password paid the full scrypt cost -- a clear, exploitable timing side-channel for
 * enumerating valid account emails. The fix performs the same scrypt computation against a fixed
 * dummy hash before returning the identical generic error for the unknown-email case.
 */

function req(email: string, password: string, ip: string): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  });
}

test('login returns the identical generic error and status for an unknown email and a wrong password', async () => {
  RepositoryFactory.resetProvider();
  const testIp = `10.40.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
  const email = `timing_${Date.now()}@figm.io`;
  await registerPOST(
    new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: JSON.stringify({ email, password: 'RealPassword123!', fullName: 'Timing User' }),
    })
  );

  const unknownRes = await loginPOST(req(`nobody_${Date.now()}@figm.io`, 'whatever123', testIp));
  const wrongPassRes = await loginPOST(req(email, 'TotallyWrongPassword1!', testIp));

  assert.equal(unknownRes.status, 401);
  assert.equal(wrongPassRes.status, 401);
  const unknownBody = await unknownRes.json();
  const wrongPassBody = await wrongPassRes.json();
  assert.deepEqual(unknownBody, wrongPassBody, 'unknown-email and wrong-password responses must be indistinguishable');
});

test('an unknown-email login attempt pays a comparable scrypt cost to a known-email one, not a near-zero one', async () => {
  RepositoryFactory.resetProvider();
  // Every request below gets its own fresh fake IP -- checkRateLimit's in-process fallback keys
  // purely by IP with a 10-req/min ceiling on both /register and /login, and this test alone makes
  // 11 calls; reusing one IP would trip the limiter partway through and silently skip the scrypt
  // cost on a blocked call, corrupting the very averages being measured.
  const freshIp = () => `10.41.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  const email = `timing2_${Date.now()}@figm.io`;
  await registerPOST(
    new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'x-forwarded-for': freshIp() },
      body: JSON.stringify({ email, password: 'RealPassword123!', fullName: 'Timing User 2' }),
    })
  );

  const ITERATIONS = 5;
  let knownTotalMs = 0;
  let unknownTotalMs = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const knownRes = await loginPOST(req(email, 'TotallyWrongPassword1!', freshIp()));
    knownTotalMs += performance.now() - t0;
    assert.equal(knownRes.status, 401, 'known-email/wrong-password call must not itself be rate-limited');

    const t1 = performance.now();
    const unknownRes = await loginPOST(req(`nobody_${i}_${Date.now()}@figm.io`, 'whatever123', freshIp()));
    unknownTotalMs += performance.now() - t1;
    assert.equal(unknownRes.status, 401, 'unknown-email call must not itself be rate-limited');
  }

  const knownAvg = knownTotalMs / ITERATIONS;
  const unknownAvg = unknownTotalMs / ITERATIONS;

  // Before the fix, the unknown-email path did no hashing at all and completed in a fraction of a
  // millisecond regardless of how expensive scrypt is for the known-email path. A generous 40%
  // floor catches that regression without making the test flaky under normal scheduling jitter.
  assert.ok(
    unknownAvg >= knownAvg * 0.4,
    `unknown-email path (${unknownAvg.toFixed(2)}ms avg) must not be dramatically faster than the known-email path (${knownAvg.toFixed(2)}ms avg) -- that gap is what enables email enumeration by timing`
  );
});
