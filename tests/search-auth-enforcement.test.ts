import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ProjectRepository } from '../src/engine/project-repository';
import { GET as searchGET } from '../app/api/search/route';

/**
 * Regression coverage for a Phase-1-follow-up security fix: GET /api/search previously computed
 * `auth` via authenticateUser(request) but never checked auth.errorResponse, so a request with a
 * missing or invalid token fell through with userId=undefined instead of being rejected -- the
 * only route in this codebase that didn't enforce auth the way every sibling route does. No data
 * ever actually leaked (project/scan results were still correctly scoped to an empty set for
 * userId=undefined, and the admin user-search branch was already isAdmin-gated), but the endpoint
 * was reachable without authentication at all. This suite proves: the fix genuinely rejects a
 * missing/invalid token with 401, a valid token's search behavior and result scoping are
 * unchanged, and the ADMIN-only user-search gate still holds.
 *
 * A single fixed fake IP is used for every request in this file (rather than 'unknown-client',
 * the default for a request with no X-Forwarded-For) so this suite's own request volume can never
 * cross paths with the shared in-process rate-limit bucket other test files might also be using.
 */

const TEST_IP = `10.90.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

function tokenFor(userId: string, role: 'DEVELOPER' | 'ADMIN' = 'DEVELOPER'): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role }, 0);
}

function createTestUser(label: string, role: 'DEVELOPER' | 'ADMIN' = 'DEVELOPER') {
  return UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-these-tests',
    fullName: label,
    role,
  });
}

function searchRequest(q: string, jwt?: string): Request {
  const headers = new Headers({ 'x-forwarded-for': TEST_IP });
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(`http://localhost:3000/api/search?q=${encodeURIComponent(q)}`, { headers });
}

test('GET /api/search auth enforcement', async (t) => {
  await t.test('missing Authorization header -> 401', async () => {
    RepositoryFactory.resetProvider();
    const res = await searchGET(searchRequest('anything'));
    assert.equal(res.status, 401);
  });

  await t.test('invalid (malformed) and expired Authorization tokens -> 401', async () => {
    RepositoryFactory.resetProvider();

    const malformedRes = await searchGET(searchRequest('anything', 'this-is-not-a-real-jwt'));
    assert.equal(malformedRes.status, 401, 'a malformed/garbage token must be rejected with 401');

    const expiredToken = signJWT({ userId: 'usr_search_expired', email: 'x@figm.io', fullName: 'X', role: 'DEVELOPER' }, 0, -10);
    const expiredRes = await searchGET(searchRequest('anything', expiredToken));
    assert.equal(expiredRes.status, 401, 'an expired token must be rejected with 401');
  });

  await t.test('valid DEVELOPER token: existing search behavior and result scoping are unchanged', async () => {
    RepositoryFactory.resetProvider();
    const user = createTestUser('search-dev-behavior');
    const jwt = tokenFor(user.id, 'DEVELOPER');
    const uniqueName = `SearchProbe-${Date.now()}`;
    await ProjectRepository.createProject({
      userId: user.id,
      name: uniqueName,
      description: '',
      framework: 'React',
      repoUrl: '',
      status: 'ACTIVE',
    });

    const res = await searchGET(searchRequest(uniqueName, jwt));
    assert.equal(res.status, 200, 'a valid token must still succeed');
    const body = await res.json();
    assert.ok(
      body.projects.some((p: { name: string }) => p.name === uniqueName),
      "the caller's own matching project must still appear in results, exactly as before this fix"
    );
    assert.deepEqual(body.users, [], 'a non-admin caller must never receive user-search results, even with a matching query');

    // Empty query still returns the same all-empty shape it always did (pre-existing behavior,
    // confirmed unchanged).
    const emptyRes = await searchGET(searchRequest('', jwt));
    assert.equal(emptyRes.status, 200);
    const emptyBody = await emptyRes.json();
    assert.deepEqual(emptyBody, { projects: [], scans: [], rules: [], users: [], repositories: [] });
  });

  await t.test('admin user-search remains ADMIN-only after the fix', async () => {
    RepositoryFactory.resetProvider();
    const targetLabel = `search-target-${Date.now()}`;
    createTestUser(targetLabel, 'DEVELOPER');

    const devUser = createTestUser('search-nonadmin-caller');
    const devJwt = tokenFor(devUser.id, 'DEVELOPER');
    const devRes = await searchGET(searchRequest(targetLabel, devJwt));
    assert.equal(devRes.status, 200);
    const devBody = await devRes.json();
    assert.deepEqual(devBody.users, [], 'a non-admin, authenticated caller must still never see user-search results');

    const adminUser = createTestUser('search-admin-caller', 'ADMIN');
    const adminJwt = tokenFor(adminUser.id, 'ADMIN');
    const adminRes = await searchGET(searchRequest(targetLabel, adminJwt));
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.ok(
      adminBody.users.some((u: { fullName: string }) => u.fullName === targetLabel),
      'an authenticated ADMIN caller must still see the matching user in user-search results'
    );
  });
});
