import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service.js';
import { PATCH as projectPATCH } from '../app/api/projects/[id]/route.js';
import { PATCH as profilePATCH } from '../app/api/profile/route.js';
import { ProjectRepository } from '../src/engine/project-repository.js';

/**
 * QA Validation Matrix — network/API failure resilience.
 *
 * Authentication-failure, authorization-failure, rate-limiting, and CORS coverage already exists
 * in tests/api-security-audit.test.ts (JWT missing/malformed/expired/tampered, role checks, IDOR,
 * 429 rate-limit responses, CORS allow-listing) and is not duplicated here. This file covers the
 * remaining "network failures / API failures" category from the QA matrix brief: malformed
 * request bodies must degrade to a graceful error response, never an unhandled exception that
 * would crash the process or leak a stack trace to the client.
 */

function authedRequest(url: string, opts: RequestInit, jwt: string): Request {
  const headers = new Headers(opts.headers);
  headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function tokenFor(userId: string): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role: 'DEVELOPER' }, 0);
}

test('QA Matrix — network / API failure resilience', async (t) => {
  await t.test('PATCH /api/projects/[id] with a malformed (non-JSON) body returns a graceful error response, not an unhandled exception', async () => {
    const owner = await ProjectRepository.createProject({ userId: 'net-fail-user', name: 'P', framework: 'REACT_JSX', repoUrl: '', status: 'ACTIVE' } as never);
    const jwt = tokenFor('net-fail-user');
    const req = authedRequest(`http://localhost:3000/api/projects/${owner.id}`, {
      method: 'PATCH',
      body: '{not valid json!!!',
      headers: { 'Content-Type': 'application/json' },
    }, jwt);

    let res: Response;
    await assert.doesNotReject(async () => {
      res = await projectPATCH(req, { params: { id: owner.id } });
    }, 'a malformed JSON body must not throw an unhandled exception out of the route handler');

    assert.ok(res!.status >= 400 && res!.status < 600, `malformed body should produce an HTTP error status, got ${res!.status}`);
    const payload = await res!.json();
    assert.ok(!JSON.stringify(payload).includes('at Object.'), 'error response must not leak a raw stack trace to the client');
  });

  await t.test('PATCH /api/profile with an empty body does not crash and does not silently apply a no-op password change', async () => {
    const jwt = tokenFor('net-fail-user-2');
    const req = authedRequest('http://localhost:3000/api/profile', {
      method: 'PATCH',
      body: '',
      headers: { 'Content-Type': 'application/json' },
    }, jwt);

    let res: Response;
    await assert.doesNotReject(async () => {
      res = await profilePATCH(req);
    }, 'an empty request body must not throw an unhandled exception out of the route handler');
    assert.ok(res!.status >= 400 && res!.status < 600, `empty body should produce an HTTP error status, got ${res!.status}`);
  });

  await t.test('PATCH /api/projects/[id] against a non-existent project id returns 404, not a database-error 500', async () => {
    const jwt = tokenFor('net-fail-user-3');
    const req = authedRequest('http://localhost:3000/api/projects/does-not-exist-xyz', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    }, jwt);
    const res = await projectPATCH(req, { params: { id: 'does-not-exist-xyz' } });
    assert.equal(res.status, 404, 'a lookup miss must be reported as 404, not surfaced as a raw storage-layer error');
  });
});
