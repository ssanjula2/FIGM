import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { POST as exportPOST } from '../app/api/export/route';
import { GET as reportGET } from '../app/api/report/route';
import { GET as searchGET } from '../app/api/search/route';
import { POST as submissionsPOST } from '../app/api/submissions/route';
import { POST as projectsPOST } from '../app/api/projects/route';
import { POST as duplicatePOST } from '../app/api/projects/[id]/duplicate/route';

/**
 * Regression coverage for Phase 1 (Security Close-out), task 3: the six routes identified during
 * this audit as genuinely needing rate limiting (previously had none) -- POST /api/export,
 * GET /api/report, GET /api/search, POST /api/submissions, POST /api/projects, and
 * POST /api/projects/[id]/duplicate. See SECURITY.md §4 for the full per-route rationale.
 *
 * Each test uses ONE fixed, never-reused fake IP for every request in its own loop (the limit is
 * per-IP -- rotating it, as a different test in this suite deliberately does to prove the
 * SEPARATE fingerprint dimension on /api/scan's fix path, would defeat a plain per-IP check
 * entirely and never trip it). Mirrors tests/export-dissertation-rate-limit.test.ts's own
 * established pattern: hammer the route until a 429 (with Retry-After) appears, while also
 * confirming at least one request under the limit is NOT rejected for rate-limit reasons --
 * distinguishing "the new limit works" from "the route was already broken for an unrelated
 * reason."
 */

function tokenFor(userId: string): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role: 'DEVELOPER' }, 0);
}

function fakeIp(prefix: number): string {
  return `10.${prefix}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
}

test('POST /api/export is rate-limited (was previously unthrottled)', async () => {
  RepositoryFactory.resetProvider();
  const userId = `usr_export_ratelimit_${Date.now()}`;
  const jwt = tokenFor(userId);
  const testIp = fakeIp(62);
  let sawRateLimit = false;
  let sawNonRateLimited = false;

  for (let i = 0; i < 15; i++) {
    const req = new Request('http://localhost:3000/api/export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'x-forwarded-for': testIp, 'content-type': 'application/json' },
      // No real scanId -- irrelevant here, the rate-limit gate runs before scanId is even read.
      body: JSON.stringify({}),
    });
    const res = await exportPOST(req);
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
    if (res.status === 400) sawNonRateLimited = true; // "scanId and format are required fields"
  }

  assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must get past the rate-limit gate');
  assert.ok(sawRateLimit, '/api/export must be rate-limited within 15 rapid requests from the same IP (limit is 10/min)');
});

test('GET /api/report is rate-limited (was previously unthrottled)', async () => {
  RepositoryFactory.resetProvider();
  const userId = `usr_report_ratelimit_${Date.now()}`;
  const jwt = tokenFor(userId);
  const testIp = fakeIp(63);
  let sawRateLimit = false;
  let sawNonRateLimited = false;

  for (let i = 0; i < 15; i++) {
    const req = new Request('http://localhost:3000/api/report', {
      headers: { Authorization: `Bearer ${jwt}`, 'x-forwarded-for': testIp },
    });
    const res = await reportGET(req);
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
    if (res.status === 200) sawNonRateLimited = true;
  }

  assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must succeed');
  assert.ok(sawRateLimit, '/api/report must be rate-limited within 15 rapid requests from the same IP (limit is 10/min)');
});

test('GET /api/search is rate-limited even for requests with no Authorization header (rate limit runs before auth is enforced)', async () => {
  RepositoryFactory.resetProvider();
  const testIp = fakeIp(64);
  let sawRateLimit = false;
  let sawNonRateLimited = false;

  for (let i = 0; i < 35; i++) {
    // Deliberately NO Authorization header. /api/search now correctly rejects this with 401 (see
    // tests/search-auth-enforcement.test.ts for the dedicated auth-enforcement coverage) -- this
    // test only proves the rate limit itself still applies before that auth check runs, so a flood
    // of missing-token requests is bounded too, not just successfully-authenticated ones.
    const req = new Request(`http://localhost:3000/api/search?q=test`, {
      headers: { 'x-forwarded-for': testIp },
    });
    const res = await searchGET(req);
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
    if (res.status === 401) sawNonRateLimited = true;
  }

  assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must get past the rate-limit gate (reaching the 401 for missing auth)');
  assert.ok(sawRateLimit, '/api/search must be rate-limited within 35 rapid unauthenticated requests from the same IP (limit is 30/min)');
});

test('POST /api/submissions is rate-limited (was previously unthrottled, same cost profile as /api/scan)', async () => {
  RepositoryFactory.resetProvider();
  const userId = `usr_submissions_ratelimit_${Date.now()}`;
  const jwt = tokenFor(userId);
  const testIp = fakeIp(65);
  let sawRateLimit = false;
  let sawNonRateLimited = false;

  for (let i = 0; i < 20; i++) {
    const req = new Request('http://localhost:3000/api/submissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'x-forwarded-for': testIp, 'content-type': 'application/json' },
      // Missing `code` -- irrelevant, the rate-limit gate runs before the body is validated.
      body: JSON.stringify({}),
    });
    const res = await submissionsPOST(req);
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
    if (res.status === 400) sawNonRateLimited = true; // "Code content is required"
  }

  assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must get past the rate-limit gate');
  assert.ok(sawRateLimit, '/api/submissions must be rate-limited within 20 rapid requests from the same IP (limit is 15/min)');
});

test('POST /api/projects is rate-limited (was previously unthrottled — unbounded project-creation vector)', async () => {
  RepositoryFactory.resetProvider();
  const userId = `usr_projects_ratelimit_${Date.now()}`;
  const jwt = tokenFor(userId);
  const testIp = fakeIp(66);
  let sawRateLimit = false;
  let sawNonRateLimited = false;

  for (let i = 0; i < 15; i++) {
    const req = new Request('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'x-forwarded-for': testIp, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x' }), // fails INVALID_NAME (< 2 chars) -- irrelevant, rate limit runs first
    });
    const res = await projectsPOST(req);
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
    if (res.status === 400) sawNonRateLimited = true;
  }

  assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must get past the rate-limit gate');
  assert.ok(sawRateLimit, '/api/projects (create) must be rate-limited within 15 rapid requests from the same IP (limit is 10/min)');
});

test('POST /api/projects/[id]/duplicate is rate-limited (was previously unthrottled)', async () => {
  RepositoryFactory.resetProvider();
  const userId = `usr_duplicate_ratelimit_${Date.now()}`;
  const jwt = tokenFor(userId);
  const testIp = fakeIp(67);
  let sawRateLimit = false;
  let sawNonRateLimited = false;

  for (let i = 0; i < 15; i++) {
    const req = new Request('http://localhost:3000/api/projects/does-not-exist/duplicate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'x-forwarded-for': testIp },
    });
    const res = await duplicatePOST(req, { params: { id: 'does-not-exist' } });
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
    if (res.status === 404) sawNonRateLimited = true; // "Project not found" -- got past the rate-limit gate
  }

  assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must get past the rate-limit gate');
  assert.ok(sawRateLimit, '/api/projects/[id]/duplicate must be rate-limited within 15 rapid requests from the same IP (limit is 10/min)');
});
