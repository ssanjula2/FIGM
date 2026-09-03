import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ProjectRepository } from '../src/engine/project-repository';
import { ScanRepository } from '../src/engine/scan-repository';
import { DELETE as projectDELETE } from '../app/api/projects/[id]/route';
import { GET as projectsListGET } from '../app/api/projects/route';
import { POST as exportPOST } from '../app/api/export/route';

/**
 * Targeted IDOR/RBAC regression coverage for the three route groups audited in the
 * "Final Security Closure + Acceptance Verification" pass (app/api/projects/**,
 * app/api/export/**, app/api/notifications/**). Source reading found every ownership/role check
 * in these routes already correct (no unsafe `userId ? {userId} : {}` fallback is reachable by a
 * non-admin caller anywhere in the call chain) -- no production code was changed. These tests
 * fill three specific coverage gaps found during that audit, without duplicating the existing
 * IDOR coverage in tests/api-security-audit.test.ts and tests/regression-security.test.ts
 * (GET/PATCH /api/projects/[id], POST duplicate, PATCH /api/notifications are already covered
 * there):
 *
 *   1. DELETE /api/projects/[id] -- imported but never actually exercised by any existing test.
 *   2. POST /api/export -- had zero test coverage of its cross-user ownership check anywhere.
 *   3. GET /api/projects (list) -- the DEVELOPER-self-scoped vs ADMIN-global split had no test.
 */

function authedRequest(url: string, opts: RequestInit, jwt?: string): Request {
  const headers = new Headers(opts.headers);
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function tokenFor(userId: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER'): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role }, 0);
}

test('DELETE /api/projects/[id] is ownership-checked (IDOR)', async (t) => {
  RepositoryFactory.resetProvider();
  const ownerId = `usr_del_owner_${Date.now()}`;
  const strangerId = `usr_del_stranger_${Date.now()}`;

  const project = await ProjectRepository.createProject({
    userId: ownerId,
    name: 'Delete-IDOR Fixture',
    description: '',
    framework: 'React',
    repoUrl: '',
    status: 'ACTIVE',
  });

  await t.test('anonymous cannot delete', async () => {
    const res = await projectDELETE(new Request(`http://localhost:3000/api/projects/${project.id}`, { method: 'DELETE' }), {
      params: { id: project.id },
    });
    assert.equal(res.status, 401);
  });

  await t.test('a non-owner DEVELOPER cannot delete another user\'s project', async () => {
    const res = await projectDELETE(
      authedRequest(`http://localhost:3000/api/projects/${project.id}`, { method: 'DELETE' }, tokenFor(strangerId)),
      { params: { id: project.id } }
    );
    assert.equal(res.status, 403);

    const stillThere = await ProjectRepository.getProjectById(project.id);
    assert.ok(stillThere, 'a forged delete attempt must not remove the project');
  });

  await t.test('the real owner can delete their own project', async () => {
    const res = await projectDELETE(
      authedRequest(`http://localhost:3000/api/projects/${project.id}`, { method: 'DELETE' }, tokenFor(ownerId)),
      { params: { id: project.id } }
    );
    assert.equal(res.status, 200);

    const gone = await ProjectRepository.getProjectById(project.id);
    assert.equal(gone, undefined);
  });
});

test('POST /api/export is ownership-checked (IDOR) -- no prior coverage existed', async (t) => {
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();
  const ownerId = `usr_export_owner_${Date.now()}`;
  const strangerId = `usr_export_stranger_${Date.now()}`;

  const record = await provider.createScanRecord({
    userId: ownerId,
    fileName: 'ExportIdorFixture.tsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 0,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });

  await t.test('anonymous cannot export', async () => {
    const res = await exportPOST(
      new Request('http://localhost:3000/api/export', { method: 'POST', body: JSON.stringify({ scanId: record.id, format: 'JSON' }) })
    );
    assert.equal(res.status, 401);
  });

  await t.test('a non-owner cannot export another user\'s scan report', async () => {
    const res = await exportPOST(
      authedRequest(
        'http://localhost:3000/api/export',
        { method: 'POST', body: JSON.stringify({ scanId: record.id, format: 'JSON' }) },
        tokenFor(strangerId)
      )
    );
    assert.equal(res.status, 403);
  });

  await t.test('the real owner can export their own scan report', async () => {
    const res = await exportPOST(
      authedRequest(
        'http://localhost:3000/api/export',
        { method: 'POST', body: JSON.stringify({ scanId: record.id, format: 'JSON' }) },
        tokenFor(ownerId)
      )
    );
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /ExportIdorFixture\.tsx/);
  });

  await t.test('ADMIN can export any user\'s scan report (explicit global-access branch)', async () => {
    const res = await exportPOST(
      authedRequest(
        'http://localhost:3000/api/export',
        { method: 'POST', body: JSON.stringify({ scanId: record.id, format: 'JSON' }) },
        tokenFor(`usr_export_admin_${Date.now()}`, 'ADMIN')
      )
    );
    assert.equal(res.status, 200);
  });
});

test('GET /api/projects: DEVELOPER is self-scoped, ADMIN is explicitly global, never an accidental fallback', async (t) => {
  RepositoryFactory.resetProvider();
  const ownerA = `usr_list_a_${Date.now()}`;
  const ownerB = `usr_list_b_${Date.now()}`;

  await ProjectRepository.createProject({ userId: ownerA, name: 'Owner A Project', description: '', framework: 'React', repoUrl: '', status: 'ACTIVE' });
  await ProjectRepository.createProject({ userId: ownerB, name: 'Owner B Project', description: '', framework: 'React', repoUrl: '', status: 'ACTIVE' });

  await t.test('anonymous is rejected, not silently given an empty or global list', async () => {
    const res = await projectsListGET(new Request('http://localhost:3000/api/projects'));
    assert.equal(res.status, 401);
  });

  await t.test('a DEVELOPER only ever sees their own projects, even when querying without filters', async () => {
    const res = await projectsListGET(authedRequest('http://localhost:3000/api/projects', {}, tokenFor(ownerA)));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.projects.every((p: any) => p.userId === ownerA), 'a DEVELOPER must never see another user\'s project in the list');
    assert.ok(body.projects.some((p: any) => p.name === 'Owner A Project'));
    assert.ok(!body.projects.some((p: any) => p.name === 'Owner B Project'));
  });

  await t.test('a DEVELOPER cannot widen scope via query parameters (no userId param exists to manipulate, and none is honored)', async () => {
    // This route has no userId/participantId query parameter at all -- scope comes exclusively
    // from the verified JWT. Confirms an attacker-supplied query string can't do anything the
    // safe explicit-role check doesn't already allow.
    const res = await projectsListGET(
      authedRequest(`http://localhost:3000/api/projects?userId=${ownerB}&admin=true`, {}, tokenFor(ownerA))
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(!body.projects.some((p: any) => p.userId === ownerB), 'a forged userId/admin query string must have no effect');
  });

  await t.test('ADMIN sees the real global list (explicit role branch, not an accidental empty-userId fallback)', async () => {
    const res = await projectsListGET(authedRequest('http://localhost:3000/api/projects', {}, tokenFor(`usr_list_admin_${Date.now()}`, 'ADMIN')));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.projects.some((p: any) => p.userId === ownerA));
    assert.ok(body.projects.some((p: any) => p.userId === ownerB));
  });

  await t.test('AUDITOR is self-scoped like DEVELOPER -- no admin-global reach for this role on this route', async () => {
    const res = await projectsListGET(authedRequest('http://localhost:3000/api/projects', {}, tokenFor(ownerA, 'AUDITOR')));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(!body.projects.some((p: any) => p.userId === ownerB), 'AUDITOR must not get global project access -- this route explicitly only special-cases ADMIN');
  });
});
