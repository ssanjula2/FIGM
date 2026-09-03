import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { getClientIp } from '../src/auth/rate-limiter';
import { UserDB } from '../src/auth/user-db';
import { ScanRepository } from '../src/engine/scan-repository';
import { ProjectRepository } from '../src/engine/project-repository';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { GET as reportsGET } from '../app/api/dashboard/reports/route';
import { GET as projectsGET } from '../app/api/projects/route';
import { POST as scansPOST } from '../app/api/scans/route';
import { POST as registerPOST } from '../app/api/auth/register/route';

/**
 * Regression coverage for the CRITICAL findings in audit/new.md:
 *   SEC-03 -- GET /api/dashboard/reports and GET /api/projects fell through to an unscoped
 *            "return every user's records" query for unauthenticated/failed-auth requests.
 *   SEC-04 -- POST /api/scans accepted an arbitrary client-supplied participantId and trusted
 *            client-supplied qualityScore/diagnostics verbatim.
 *   Rate limiting -- every route derived its rate-limit identity from a client-suppliable
 *            X-Forwarded-For value with no notion of "trusted hop."
 */

function authedRequest(url: string, opts: RequestInit, jwt?: string): Request {
  const headers = new Headers(opts.headers);
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function tokenFor(userId: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER'): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role }, 0);
}

function createTestUser(label: string) {
  return UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-these-tests',
    fullName: label,
    role: 'DEVELOPER',
  });
}

test('API Security Fixes — dashboard/reports, projects, scans ownership, rate-limit spoofing', async (t) => {
  RepositoryFactory.resetProvider();

  await t.test('GET /api/dashboard/reports: anonymous request is rejected with 401, not "all users"', async () => {
    const req = new Request('http://localhost:3000/api/dashboard/reports');
    const res = await reportsGET(req);
    assert.equal(res.status, 401);
  });

  await t.test('GET /api/dashboard/reports: invalid JWT is rejected with 401', async () => {
    const res = await reportsGET(authedRequest('http://localhost:3000/api/dashboard/reports', {}, 'not-a-real-token'));
    assert.equal(res.status, 401);
  });

  await t.test('GET /api/dashboard/reports: expired JWT is rejected with 401', async () => {
    const expired = signJWT({ userId: 'usr_x', email: 'x@figm.io', fullName: 'X', role: 'DEVELOPER' }, 0, -10);
    const res = await reportsGET(authedRequest('http://localhost:3000/api/dashboard/reports', {}, expired));
    assert.equal(res.status, 401);
  });

  await t.test('GET /api/dashboard/reports: an authenticated user only ever receives their own scan history, never another user\'s', async () => {
    const userA = createTestUser('reports_owner_a');
    const userB = createTestUser('reports_owner_b');

    const scanA = await ScanRepository.createScanRecord({
      userId: userA.id,
      fileName: 'OwnerAFile.tsx',
      framework: 'React',
      scanTimeMs: 1,
      memoryUsageMb: 1,
      qualityScore: 90,
      ruleCount: 0,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    });
    await ScanRepository.createScanRecord({
      userId: userB.id,
      fileName: 'OwnerBFile.tsx',
      framework: 'React',
      scanTimeMs: 1,
      memoryUsageMb: 1,
      qualityScore: 90,
      ruleCount: 0,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    });

    const res = await reportsGET(authedRequest('http://localhost:3000/api/dashboard/reports', {}, tokenFor(userA.id)));
    assert.equal(res.status, 200);
    const body = await res.json();
    const fileNames = body.reports.map((r: any) => r.fileName);
    assert.ok(fileNames.includes(scanA.fileName), 'must include the caller\'s own report');
    assert.ok(!fileNames.includes('OwnerBFile.tsx'), 'must never include another user\'s report');
  });

  await t.test('GET /api/projects: anonymous request is rejected with 401, not "all users"', async () => {
    const req = new Request('http://localhost:3000/api/projects');
    const res = await projectsGET(req);
    assert.equal(res.status, 401);
  });

  await t.test('GET /api/projects: invalid JWT is rejected with 401', async () => {
    const res = await projectsGET(authedRequest('http://localhost:3000/api/projects', {}, 'garbage.not.a.jwt'));
    assert.equal(res.status, 401);
  });

  await t.test('GET /api/projects: expired JWT is rejected with 401', async () => {
    const expired = signJWT({ userId: 'usr_y', email: 'y@figm.io', fullName: 'Y', role: 'DEVELOPER' }, 0, -30);
    const res = await projectsGET(authedRequest('http://localhost:3000/api/projects', {}, expired));
    assert.equal(res.status, 401);
  });

  await t.test('GET /api/projects: a stranger never sees another user\'s projects in the list', async () => {
    const owner = createTestUser('projects_owner');
    const stranger = createTestUser('projects_stranger');

    const ownerProject = await ProjectRepository.createProject({
      userId: owner.id,
      name: 'Owner Only Project',
      description: '',
      framework: 'React',
      repoUrl: '',
      status: 'ACTIVE',
    });

    const strangerRes = await projectsGET(authedRequest('http://localhost:3000/api/projects', {}, tokenFor(stranger.id)));
    assert.equal(strangerRes.status, 200);
    const strangerBody = await strangerRes.json();
    assert.ok(
      !strangerBody.projects.some((p: any) => p.id === ownerProject.id),
      'a stranger\'s project list must never contain another user\'s project'
    );

    const ownerRes = await projectsGET(authedRequest('http://localhost:3000/api/projects', {}, tokenFor(owner.id)));
    const ownerBody = await ownerRes.json();
    assert.ok(ownerBody.projects.some((p: any) => p.id === ownerProject.id), 'the owner must still see their own project');
  });

  await t.test('POST /api/scans: anonymous request is rejected with 401', async () => {
    const req = new Request('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'const x = 1;', fileName: 'X.tsx' }),
    });
    const res = await scansPOST(req);
    assert.equal(res.status, 401);
  });

  await t.test('POST /api/scans: missing code is rejected with 400 (no default/guest fabricated result)', async () => {
    const user = createTestUser('scans_missing_code');
    const req = authedRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'X.tsx' }),
    }, tokenFor(user.id));
    const res = await scansPOST(req);
    assert.equal(res.status, 400);
  });

  await t.test('POST /api/scans: forged participantId in the request body is ignored -- the record is always attributed to the authenticated caller', async () => {
    const caller = createTestUser('scans_forger');
    const victim = createTestUser('scans_forgery_victim');

    const req = authedRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: 'const x = 1;',
        fileName: 'Forged.tsx',
        participantId: victim.id, // attacker attempts to attribute the record to someone else
      }),
    }, tokenFor(caller.id));

    const res = await scansPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.record.userId, caller.id, 'record must be attributed to the authenticated caller');
    assert.notEqual(body.record.userId, victim.id, 'participantId must never redirect ownership to another user');
  });

  await t.test('POST /api/scans: forged qualityScore and diagnostics are discarded -- the server always re-derives them from the real engine', async () => {
    const user = createTestUser('scans_score_forger');
    // A real FIGM-PERF-03 violation (addEventListener with no matching removeEventListener) so the
    // real engine is guaranteed to report at least one diagnostic and a score below 100.
    const vulnerableCode = "function mount() {\n  window.addEventListener('resize', () => {});\n}";

    const req = authedRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: vulnerableCode,
        fileName: 'Forged.tsx',
        qualityScore: 100,
        diagnostics: [],
        ruleCount: 0,
      }),
    }, tokenFor(user.id));

    const res = await scansPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.record.qualityScore, 100, 'the forged qualityScore=100 must never be stored verbatim');
    assert.ok(body.record.diagnostics.length > 0, 'the forged empty diagnostics array must be replaced by the real, server-derived findings');
    assert.ok(
      body.record.diagnostics.some((d: any) => d.ruleId === 'FIGM-PERF-03'),
      'the real violation actually present in the code must be the one that is stored'
    );
  });

  await t.test('POST /api/scans: a projectId belonging to another user is not honored (prevents inflating a stranger\'s project stats)', async () => {
    const owner = createTestUser('scans_project_owner');
    const attacker = createTestUser('scans_project_attacker');

    const ownerProject = await ProjectRepository.createProject({
      userId: owner.id,
      name: 'Victim Project',
      description: '',
      framework: 'React',
      repoUrl: '',
      status: 'ACTIVE',
    });

    const req = authedRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'const x = 1;', fileName: 'X.tsx', projectId: ownerProject.id }),
    }, tokenFor(attacker.id));

    const res = await scansPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.record.userId, attacker.id);
    assert.notEqual(body.record.projectId, ownerProject.id, 'a project the caller does not own must never be linked to their scan');
  });

  await t.test('getClientIp: an attacker-controlled X-Forwarded-For prefix does not change the resolved identity as long as the trusted (last) hop is unchanged', () => {
    const base = new Request('http://localhost:3000/x', { headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.50' } });
    const rotated1 = new Request('http://localhost:3000/x', { headers: { 'x-forwarded-for': '1.1.1.1, 203.0.113.50' } });
    const rotated2 = new Request('http://localhost:3000/x', { headers: { 'x-forwarded-for': '8.8.8.8, 7.7.7.7, 6.6.6.6, 203.0.113.50' } });

    assert.equal(getClientIp(base), '203.0.113.50');
    assert.equal(getClientIp(rotated1), getClientIp(base), 'rotating the attacker-suppliable prefix must not change the resolved client identity');
    assert.equal(getClientIp(rotated2), getClientIp(base));
  });

  await t.test('getClientIp: two genuinely different trusted last-hop addresses resolve to two different identities', () => {
    const clientA = new Request('http://localhost:3000/x', { headers: { 'x-forwarded-for': '203.0.113.10' } });
    const clientB = new Request('http://localhost:3000/x', { headers: { 'x-forwarded-for': '203.0.113.99' } });
    assert.notEqual(getClientIp(clientA), getClientIp(clientB));
  });

  await t.test('rate limiting: rotating a spoofed X-Forwarded-For prefix on every request does not bypass the limit, because the trusted last hop stays the same', async () => {
    const REAL_IP = '198.51.100.42'; // fixed, simulates the one hop Vercel's edge itself appended
    const makeRequest = (i: number) =>
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // A different, attacker-controlled prefix on every single call -- only the last entry
          // (REAL_IP) stays constant, exactly as it would if a real client rotated this header.
          'x-forwarded-for': `${i}.${i}.${i}.${i}, ${REAL_IP}`,
        },
        body: JSON.stringify({
          email: `rl_spoof_${i}_${Date.now()}@figm.io`,
          password: 'ValidPass123!',
          fullName: `Spoof Test ${i}`,
        }),
      });

    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await registerPOST(makeRequest(i));
      statuses.push(res.status);
    }

    assert.ok(statuses.includes(429), `expected at least one 429 among ${JSON.stringify(statuses)} -- spoofing the header prefix must not let every request reset the counter`);

    // A genuinely different real client (different trusted last hop) must NOT be caught by the
    // same bucket -- proves the fix isn't simply "rate-limit everyone together."
    const otherClientReq = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.200' },
      body: JSON.stringify({
        email: `rl_other_client_${Date.now()}@figm.io`,
        password: 'ValidPass123!',
        fullName: 'Other Client',
      }),
    });
    const otherRes = await registerPOST(otherClientReq);
    assert.notEqual(otherRes.status, 429, 'a different real client must not be blocked by another client\'s exhausted limit');
  });
});
