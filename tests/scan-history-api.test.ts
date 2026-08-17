import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ScanRepository } from '../src/engine/scan-repository';
import { GET as scansGET, POST as scansPOST } from '../app/api/scans/route';
import { GET as scanGET, PATCH as scanPATCH, DELETE as scanDELETE } from '../app/api/scans/[id]/route';
import { POST as registerPOST } from '../app/api/auth/register/route';
import { POST as loginPOST } from '../app/api/auth/login/route';

/**
 * Production-readiness coverage for the Scan History API (the authoritative backend for a real
 * user's persisted scan history -- see the brief this implements). Every test here invokes the
 * real Next.js route handlers directly (no mocking, matching this repo's existing convention),
 * against the real ScanRepository/UserDB stack, so a passing test means the actual production
 * code path works, not a simulation of it.
 */

function authedRequest(url: string, opts: RequestInit, jwt?: string): Request {
  const headers = new Headers(opts.headers);
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function tokenFor(userId: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER'): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role });
}

function createTestUser(label: string) {
  return UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-these-tests',
    fullName: label,
    role: 'DEVELOPER',
  });
}

// A real FIGM violation (addEventListener with no matching removeEventListener) so every scan in
// this file is guaranteed at least one genuine, server-derived diagnostic -- never an empty/no-op
// scan that could pass these tests by accident.
const VIOLATING_CODE = "function mount() {\n  window.addEventListener('resize', () => {});\n}";

test('Scan History API — full persistence flow (register -> login -> scan -> logout -> re-login -> history)', async (t) => {
  RepositoryFactory.resetProvider();

  await t.test('database persistence test: create, persist, and re-fetch after a fresh re-login session', async () => {
    // 1. Register user A.
    const email = `persist_a_${Date.now()}@figm.io`;
    const password = 'ValidPass123!';
    const registerRes = await registerPOST(
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, fullName: 'Persist Tester A' }),
      })
    );
    assert.equal(registerRes.status, 200);
    const registerBody = await registerRes.json();
    const userId = registerBody.user.userId;
    const firstSessionToken = registerBody.accessToken;

    // 2. "Login" (a real call to the login route, minting an independent session).
    const loginRes = await loginPOST(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.equal(loginBody.user.userId, userId);

    // 3 & 4. Perform a real scan and save it via the authoritative persistence endpoint.
    const scanRes = await scansPOST(
      authedRequest(
        'http://localhost:3000/api/scans',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: VIOLATING_CODE, fileName: 'Persisted.tsx' }),
        },
        loginBody.accessToken
      )
    );
    assert.equal(scanRes.status, 200);
    const scanBody = await scanRes.json();
    assert.ok(scanBody.record.id);

    // 5 & 6. Read the scan directly from the database (repository layer, bypassing HTTP).
    const dbRecord = await ScanRepository.getScanRecordById(scanBody.record.id);
    assert.ok(dbRecord, 'the scan must be readable directly from the database');

    // 6 (cont'd). Confirm scan.userId === A.id.
    assert.equal(dbRecord!.userId, userId);
    assert.ok(dbRecord!.diagnostics.length > 0, 'the real engine must have produced at least one diagnostic');
    assert.ok(dbRecord!.criticalCount + dbRecord!.highCount + dbRecord!.mediumCount + dbRecord!.lowCount > 0);

    // 7. "Logout" -- in this stateless-JWT architecture there is no server-side session to
    // invalidate beyond token discard; the meaningful thing to prove is that persistence survives
    // independently of any specific token, which step 8 (a genuinely fresh login call, minting a
    // brand new token) demonstrates.
    void firstSessionToken; // the original registration token is deliberately never reused below

    // 8. Re-authenticate (a second, independent login call = a fresh session after "logout").
    const reloginRes = await loginPOST(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    assert.equal(reloginRes.status, 200);
    const reloginBody = await reloginRes.json();
    assert.notEqual(reloginBody.accessToken, loginBody.accessToken, 'a fresh login must mint a genuinely new token, not reuse the old one');

    // 9. Call GET /api/scans with the NEW session's token.
    const historyRes = await scansGET(
      authedRequest('http://localhost:3000/api/scans', {}, reloginBody.accessToken)
    );
    assert.equal(historyRes.status, 200);
    const historyBody = await historyRes.json();

    // 10. Confirm the scan appears in the fresh session's history.
    assert.ok(
      historyBody.records.some((r: any) => r.id === scanBody.record.id),
      'the scan created in an earlier session must appear in a brand-new session\'s history'
    );
    const listedRecord = historyBody.records.find((r: any) => r.id === scanBody.record.id);
    assert.equal(listedRecord.userId, userId);
    assert.ok(!('diagnostics' in listedRecord), 'the list endpoint must never include the full diagnostics blob');

    // Single-scan detail endpoint DOES include full diagnostics.
    const detailRes = await scanGET(
      authedRequest(`http://localhost:3000/api/scans/${scanBody.record.id}`, {}, reloginBody.accessToken),
      { params: { id: scanBody.record.id } }
    );
    assert.equal(detailRes.status, 200);
    const detailBody = await detailRes.json();
    assert.ok(Array.isArray(detailBody.record.diagnostics) && detailBody.record.diagnostics.length > 0);
  });
});

test('Scan History API — cross-user security', async (t) => {
  RepositoryFactory.resetProvider();

  await t.test('anonymous GET /api/scans -> 401', async () => {
    const res = await scansGET(new Request('http://localhost:3000/api/scans'));
    assert.equal(res.status, 401);
  });

  await t.test('anonymous GET /api/scans/[id] -> 401', async () => {
    const res = await scanGET(new Request('http://localhost:3000/api/scans/anything'), { params: { id: 'anything' } });
    assert.equal(res.status, 401);
  });

  await t.test('anonymous DELETE /api/scans/[id] -> 401', async () => {
    const res = await scanDELETE(new Request('http://localhost:3000/api/scans/anything', { method: 'DELETE' }), { params: { id: 'anything' } });
    assert.equal(res.status, 401);
  });

  await t.test('anonymous POST /api/scans -> 401', async () => {
    const res = await scansPOST(
      new Request('http://localhost:3000/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'const x = 1;', fileName: 'X.tsx' }),
      })
    );
    assert.equal(res.status, 401);
  });

  await t.test('User B cannot list, open, delete, or otherwise access User A\'s scan', async () => {
    const userA = createTestUser('xuser_a');
    const userB = createTestUser('xuser_b');

    const scanA = await ScanRepository.createScanRecord({
      userId: userA.id,
      fileName: 'SecretA.tsx',
      framework: 'React',
      scanTimeMs: 1,
      memoryUsageMb: 1,
      qualityScore: 90,
      ruleCount: 0,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    });

    // Cannot list: B's own list must never contain A's scan.
    const listRes = await scansGET(authedRequest('http://localhost:3000/api/scans', {}, tokenFor(userB.id)));
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(!listBody.records.some((r: any) => r.id === scanA.id), 'B\'s list must never contain A\'s scan');

    // Cannot open: B opening A's scan by ID must be denied, not served.
    const openRes = await scanGET(
      authedRequest(`http://localhost:3000/api/scans/${scanA.id}`, {}, tokenFor(userB.id)),
      { params: { id: scanA.id } }
    );
    assert.equal(openRes.status, 403);

    // Cannot modify (favorite-toggle uses the same ownership gate as delete).
    const patchRes = await scanPATCH(
      authedRequest(`http://localhost:3000/api/scans/${scanA.id}`, { method: 'PATCH' }, tokenFor(userB.id)),
      { params: { id: scanA.id } }
    );
    assert.equal(patchRes.status, 403);

    // Cannot delete: B deleting A's scan must be denied, and the record must still exist after.
    const deleteRes = await scanDELETE(
      authedRequest(`http://localhost:3000/api/scans/${scanA.id}`, { method: 'DELETE' }, tokenFor(userB.id)),
      { params: { id: scanA.id } }
    );
    assert.equal(deleteRes.status, 403);
    const stillThere = await ScanRepository.getScanRecordById(scanA.id);
    assert.ok(stillThere, 'A\'s scan must still exist after B\'s denied delete attempt');

    // A can still access their own scan.
    const ownerOpenRes = await scanGET(
      authedRequest(`http://localhost:3000/api/scans/${scanA.id}`, {}, tokenFor(userA.id)),
      { params: { id: scanA.id } }
    );
    assert.equal(ownerOpenRes.status, 200);
  });

  await t.test('GET /api/scans/[id]: a nonexistent scan ID returns 404, not a crash or a leak', async () => {
    const user = createTestUser('missing_scan_user');
    const res = await scanGET(
      authedRequest('http://localhost:3000/api/scans/does-not-exist', {}, tokenFor(user.id)),
      { params: { id: 'does-not-exist' } }
    );
    assert.equal(res.status, 404);
  });

  await t.test('DELETE /api/scans/[id]: the owner can delete their own scan, and it is genuinely gone', async () => {
    const owner = createTestUser('delete_owner');
    const scan = await ScanRepository.createScanRecord({
      userId: owner.id,
      fileName: 'ToDelete.tsx',
      framework: 'React',
      scanTimeMs: 1,
      memoryUsageMb: 1,
      qualityScore: 100,
      ruleCount: 0,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    });

    const deleteRes = await scanDELETE(
      authedRequest(`http://localhost:3000/api/scans/${scan.id}`, { method: 'DELETE' }, tokenFor(owner.id)),
      { params: { id: scan.id } }
    );
    assert.equal(deleteRes.status, 200);

    const afterDelete = await ScanRepository.getScanRecordById(scan.id);
    assert.equal(afterDelete, undefined);

    // Deleting it again is a 404, not a crash.
    const secondDeleteRes = await scanDELETE(
      authedRequest(`http://localhost:3000/api/scans/${scan.id}`, { method: 'DELETE' }, tokenFor(owner.id)),
      { params: { id: scan.id } }
    );
    assert.equal(secondDeleteRes.status, 404);
  });

  await t.test('ADMIN can read (but this test does not assert ADMIN can delete) another user\'s scan -- documents the existing RBAC exception', async () => {
    const user = createTestUser('admin_visible_user');
    const scan = await ScanRepository.createScanRecord({
      userId: user.id,
      fileName: 'AdminVisible.tsx',
      framework: 'React',
      scanTimeMs: 1,
      memoryUsageMb: 1,
      qualityScore: 100,
      ruleCount: 0,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    });

    const adminRes = await scanGET(
      authedRequest(`http://localhost:3000/api/scans/${scan.id}`, {}, tokenFor('usr_admin_probe', 'ADMIN')),
      { params: { id: scan.id } }
    );
    assert.equal(adminRes.status, 200);
  });
});

test('Scan History API — query parameter validation', async (t) => {
  RepositoryFactory.resetProvider();
  const user = createTestUser('validation_user');

  await t.test('invalid page (non-numeric) -> 400', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?page=abc', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('invalid page (zero/negative) -> 400', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?page=0', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('pageSize exceeding the server-enforced maximum -> 400, not silently clamped', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?pageSize=99999', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('invalid minScore (out of 0-100 range) -> 400', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?minScore=500', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('invalid sortBy (not a real column) -> 400', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?sortBy=password_hash', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('invalid sortOrder -> 400', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?sortOrder=sideways', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('invalid from/to date -> 400', async () => {
    const res = await scansGET(authedRequest('http://localhost:3000/api/scans?from=not-a-date', {}, tokenFor(user.id)));
    assert.equal(res.status, 400);
  });

  await t.test('valid query parameters -> 200 with a well-formed pagination envelope', async () => {
    const res = await scansGET(
      authedRequest('http://localhost:3000/api/scans?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc&framework=React', {}, tokenFor(user.id))
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 5);
    assert.ok(Array.isArray(body.records));
    assert.ok(typeof body.total === 'number');
    assert.ok(typeof body.totalPages === 'number');
  });

  await t.test('from/to date range actually filters results', async () => {
    const rangeUser = createTestUser('date_range_user');
    await ScanRepository.createScanRecord({
      userId: rangeUser.id,
      fileName: 'DateRanged.tsx',
      framework: 'React',
      scanTimeMs: 1,
      memoryUsageMb: 1,
      qualityScore: 100,
      ruleCount: 0,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    });

    const futureFrom = new Date(Date.now() + 3600_000).toISOString(); // 1 hour in the future
    const res = await scansGET(
      authedRequest(`http://localhost:3000/api/scans?from=${encodeURIComponent(futureFrom)}`, {}, tokenFor(rangeUser.id))
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.total, 0, 'a from-date in the future must exclude every existing scan');
  });
});

test('Scan History API — project ownership on scan creation', async (t) => {
  RepositoryFactory.resetProvider();

  await t.test('a scan cannot be attached to a project the caller does not own, but is still saved under the caller\'s own userId', async () => {
    const { ProjectRepository } = await import('../src/engine/project-repository');
    const owner = createTestUser('proj_owner_x');
    const attacker = createTestUser('proj_attacker_x');

    const project = await ProjectRepository.createProject({
      userId: owner.id,
      name: 'Not Yours',
      description: '',
      framework: 'React',
      repoUrl: '',
      status: 'ACTIVE',
    });

    const res = await scansPOST(
      authedRequest(
        'http://localhost:3000/api/scans',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: VIOLATING_CODE, fileName: 'X.tsx', projectId: project.id }),
        },
        tokenFor(attacker.id)
      )
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.record.userId, attacker.id);
    assert.notEqual(body.record.projectId, project.id);
  });
});
