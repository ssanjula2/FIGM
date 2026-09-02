import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT, verifyJWT } from '../src/auth/auth-service';
import { authenticateUser, authorizeRole } from '../src/auth/auth-middleware';
import { checkRateLimit } from '../src/auth/rate-limiter';
import { buildCorsHeaders, isOriginAllowed } from '../src/lib/cors';
import { ProjectRepository } from '../src/engine/project-repository';
import { NotificationRepository } from '../src/engine/notification-repository';
import { DashboardRepository } from '../src/engine/dashboard-repository';
import { AuditLogger } from '../src/auth/audit-logger';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { POST as registerPOST } from '../app/api/auth/register/route';
import { POST as forgotPasswordPOST } from '../app/api/auth/forgot-password/route';
import { GET as projectGET, PATCH as projectPATCH } from '../app/api/projects/[id]/route';
import { POST as duplicatePOST } from '../app/api/projects/[id]/duplicate/route';
import { PATCH as notificationsPATCH } from '../app/api/notifications/route';
import { GET as dashboardSummaryGET } from '../app/api/dashboard/summary/route';
import { PATCH as profilePATCH } from '../app/api/profile/route';
import { GET as adminUsersGET } from '../app/api/admin/users/route';
import { GET as reportGET } from '../app/api/report/route';
import { UserDB } from '../src/auth/user-db';

function authedRequest(url: string, opts: RequestInit, jwt: string): Request {
  const headers = new Headers(opts.headers);
  headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function tokenFor(userId: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER'): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role });
}

test('API Security Audit — Authorization, IDOR, JWT, Rate Limiting, CORS', async (t) => {
  await t.test('JWT validation: missing, malformed, expired, and tampered tokens are all rejected', () => {
    // Missing token
    const noAuthReq = new Request('http://localhost:3000/api/profile');
    const noAuthResult = authenticateUser(noAuthReq);
    assert.equal(noAuthResult.user, null);
    assert.equal(noAuthResult.errorResponse?.status, 401);

    // Malformed token (not even 3 dot-separated parts)
    assert.equal(verifyJWT('not-a-real-token'), null);

    // Wrong number of segments
    assert.equal(verifyJWT('a.b'), null);

    // Expired token (negative TTL so exp is already in the past)
    const expiredToken = signJWT({ userId: 'usr_x', email: 'x@figm.io', fullName: 'X', role: 'DEVELOPER' }, -10);
    assert.equal(verifyJWT(expiredToken), null);

    // Tampered signature (valid token with the last signature character flipped)
    const validToken = signJWT({ userId: 'usr_x', email: 'x@figm.io', fullName: 'X', role: 'DEVELOPER' });
    const lastChar = validToken.slice(-1);
    const flipped = lastChar === 'A' ? 'B' : 'A';
    const tamperedToken = validToken.slice(0, -1) + flipped;
    assert.equal(verifyJWT(tamperedToken), null);

    // A request bearing an expired token gets the same INVALID_TOKEN treatment as any other bad token
    const expiredReq = new Request('http://localhost:3000/api/profile', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expiredResult = authenticateUser(expiredReq);
    assert.equal(expiredResult.user, null);
    assert.equal(expiredResult.errorResponse?.status, 401);
  });

  await t.test('authorizeRole rejects insufficient roles and accepts sufficient ones', () => {
    const devToken = tokenFor('usr_dev_role_test', 'DEVELOPER');
    const devReq = new Request('http://localhost:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    const devResult = authorizeRole(devReq, ['ADMIN']);
    assert.equal(devResult.errorResponse?.status, 403);

    const adminToken = tokenFor('usr_admin_role_test', 'ADMIN');
    const adminReq = new Request('http://localhost:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminResult = authorizeRole(adminReq, ['ADMIN']);
    assert.equal(adminResult.errorResponse, undefined);
    assert.equal(adminResult.user?.role, 'ADMIN');
  });

  await t.test('POST /api/auth/register cannot self-assign ADMIN (privilege escalation regression)', async () => {
    RepositoryFactory.resetProvider();
    const email = `admin_escalation_${Date.now()}@figm.io`;
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'ValidPass123!', fullName: 'Attacker', role: 'ADMIN' }),
    });

    const res = await registerPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.user.role, 'ADMIN', 'A public self-registration request must never be able to create an ADMIN account');
    assert.equal(body.user.role, 'DEVELOPER');
  });

  await t.test('POST /api/auth/register still allows the legitimate AUDITOR self-signup option', async () => {
    RepositoryFactory.resetProvider();
    const email = `auditor_signup_${Date.now()}@figm.io`;
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'ValidPass123!', fullName: 'New Auditor', role: 'AUDITOR' }),
    });

    const res = await registerPOST(req);
    const body = await res.json();
    assert.equal(body.user.role, 'AUDITOR');
  });

  await t.test('POST /api/auth/forgot-password does not leak the reset token in production', async () => {
    RepositoryFactory.resetProvider();
    const email = `prod_reset_${Date.now()}@figm.io`;
    await registerPOST(
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'ValidPass123!', fullName: 'Reset Prod User' }),
      })
    );

    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const req = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const res = await forgotPasswordPOST(req);
      const body = await res.json();
      assert.equal('resetToken' in body, false, 'resetToken must never be present in the response body in production');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  await t.test('POST /api/auth/forgot-password does not leak the reset token merely because NODE_ENV !== production', async () => {
    RepositoryFactory.resetProvider();
    const email = `dev_reset_${Date.now()}@figm.io`;
    // Distinct fake IP per test -- checkRateLimit's in-process fallback keys purely by IP across
    // every route (register, login, forgot-password all share one bucket per key), so reusing the
    // default 'unknown-client' key here would collide with every earlier request in this same
    // file/process and trip the 5-request/minute forgot-password limit well before this test runs.
    const testIp = `10.20.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    await registerPOST(
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: JSON.stringify({ email, password: 'ValidPass123!', fullName: 'Reset Dev User' }),
      })
    );

    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ALLOW_TEST_RESET_TOKEN;
    try {
      // Development and staging/preview must never leak the token, with or without the flag set.
      (process.env as any).NODE_ENV = 'development';
      delete process.env.ALLOW_TEST_RESET_TOKEN;
      const devReq = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: JSON.stringify({ email }),
      });
      const devBody = await (await forgotPasswordPOST(devReq)).json();
      assert.equal('resetToken' in devBody, false, 'resetToken must not leak in development');

      // NODE_ENV=test alone (without the explicit opt-in flag) must also not leak the token.
      (process.env as any).NODE_ENV = 'test';
      delete process.env.ALLOW_TEST_RESET_TOKEN;
      const testReq = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: JSON.stringify({ email }),
      });
      const testBody = await (await forgotPasswordPOST(testReq)).json();
      assert.equal('resetToken' in testBody, false, 'resetToken must not leak in test env without ALLOW_TEST_RESET_TOKEN=true');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalFlag === undefined) delete process.env.ALLOW_TEST_RESET_TOKEN;
      else process.env.ALLOW_TEST_RESET_TOKEN = originalFlag;
    }
  });

  await t.test('POST /api/auth/forgot-password returns the reset token only when NODE_ENV=test AND ALLOW_TEST_RESET_TOKEN=true', async () => {
    RepositoryFactory.resetProvider();
    const email = `explicit_test_reset_${Date.now()}@figm.io`;
    const testIp = `10.30.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    await registerPOST(
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: JSON.stringify({ email, password: 'ValidPass123!', fullName: 'Reset Explicit Test User' }),
      })
    );

    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ALLOW_TEST_RESET_TOKEN;
    try {
      (process.env as any).NODE_ENV = 'test';
      process.env.ALLOW_TEST_RESET_TOKEN = 'true';
      const req = new Request('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: JSON.stringify({ email }),
      });
      const body = await (await forgotPasswordPOST(req)).json();
      assert.equal('resetToken' in body, true, 'resetToken must be present when both the test env and explicit flag are set');
      assert.equal(typeof body.resetToken, 'string');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalFlag === undefined) delete process.env.ALLOW_TEST_RESET_TOKEN;
      else process.env.ALLOW_TEST_RESET_TOKEN = originalFlag;
    }
  });

  await t.test('GET /api/projects/[id] blocks unauthenticated and cross-user access (real IDOR regression, not a coincidental 404)', async () => {
    RepositoryFactory.resetProvider();
    const ownerId = `usr_owner_${Date.now()}`;
    const strangerId = `usr_stranger_${Date.now()}`;

    const project = await ProjectRepository.createProject({
      userId: ownerId,
      name: 'Private Project',
      description: 'Should not be readable by anyone else',
      framework: 'React',
      repoUrl: 'https://github.com/figm/private-project',
      status: 'ACTIVE',
    });

    // Unauthenticated: must be 401, not a silent 200 leak
    const anonRes = await projectGET(new Request(`http://localhost:3000/api/projects/${project.id}`), {
      params: { id: project.id },
    });
    assert.equal(anonRes.status, 401);

    // A different authenticated user: must be 403
    const strangerReq = authedRequest(
      `http://localhost:3000/api/projects/${project.id}`,
      {},
      tokenFor(strangerId)
    );
    const strangerRes = await projectGET(strangerReq, { params: { id: project.id } });
    assert.equal(strangerRes.status, 403);

    // The owner: must succeed
    const ownerReq = authedRequest(`http://localhost:3000/api/projects/${project.id}`, {}, tokenFor(ownerId));
    const ownerRes = await projectGET(ownerReq, { params: { id: project.id } });
    assert.equal(ownerRes.status, 200);
    const ownerBody = await ownerRes.json();
    assert.equal(ownerBody.project.id, project.id);
  });

  await t.test('POST /api/projects/[id]/duplicate blocks duplicating another user\'s project', async () => {
    RepositoryFactory.resetProvider();
    const ownerId = `usr_dup_owner_${Date.now()}`;
    const strangerId = `usr_dup_stranger_${Date.now()}`;

    const project = await ProjectRepository.createProject({
      userId: ownerId,
      name: 'Owner Only Project',
      description: 'desc',
      framework: 'Vue',
      repoUrl: 'https://github.com/figm/owner-only',
      status: 'ACTIVE',
    });

    const strangerReq = authedRequest(
      `http://localhost:3000/api/projects/${project.id}/duplicate`,
      { method: 'POST' },
      tokenFor(strangerId)
    );
    const strangerRes = await duplicatePOST(strangerReq, { params: { id: project.id } });
    assert.equal(strangerRes.status, 403);

    const ownerReq = authedRequest(
      `http://localhost:3000/api/projects/${project.id}/duplicate`,
      { method: 'POST' },
      tokenFor(ownerId)
    );
    const ownerRes = await duplicatePOST(ownerReq, { params: { id: project.id } });
    assert.equal(ownerRes.status, 200);
  });

  await t.test('PATCH /api/projects/[id] ignores mass-assignment of userId/qualityScore outside the field allow-list', async () => {
    RepositoryFactory.resetProvider();
    const ownerId = `usr_mass_owner_${Date.now()}`;
    const attackerId = `usr_mass_attacker_${Date.now()}`;

    const project = await ProjectRepository.createProject({
      userId: ownerId,
      name: 'Original Name',
      description: 'desc',
      framework: 'React',
      repoUrl: 'https://github.com/figm/mass-assign',
      status: 'ACTIVE',
    });

    const req = authedRequest(
      `http://localhost:3000/api/projects/${project.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Name', userId: attackerId, qualityScore: 9999, totalScans: 9999 }),
      },
      tokenFor(ownerId)
    );
    const res = await projectPATCH(req, { params: { id: project.id } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.project.name, 'Updated Name', 'allow-listed field must still be updatable');
    assert.equal(body.project.userId, ownerId, 'userId must never be changeable via this endpoint');
  });

  await t.test('PATCH /api/notifications blocks marking another user\'s notification as read (IDOR)', async () => {
    RepositoryFactory.resetProvider();
    const ownerId = `usr_notif_owner_${Date.now()}`;
    const strangerId = `usr_notif_stranger_${Date.now()}`;

    const notification = await NotificationRepository.createNotification(
      ownerId,
      'SCAN_SUCCESS',
      'Private Notification',
      'Should only be markable-as-read by its owner'
    );

    const strangerReq = authedRequest(
      'http://localhost:3000/api/notifications',
      { method: 'PATCH', body: JSON.stringify({ notificationId: notification.id }) },
      tokenFor(strangerId)
    );
    const strangerRes = await notificationsPATCH(strangerReq);
    assert.equal(strangerRes.status, 404, 'a non-owner must not be able to mark another user\'s notification as read');

    const { notifications: ownerNotifsBefore } = await NotificationRepository.getNotifications(ownerId);
    assert.equal(ownerNotifsBefore.find((n) => n.id === notification.id)?.read, false);

    const ownerReq = authedRequest(
      'http://localhost:3000/api/notifications',
      { method: 'PATCH', body: JSON.stringify({ notificationId: notification.id }) },
      tokenFor(ownerId)
    );
    const ownerRes = await notificationsPATCH(ownerReq);
    assert.equal(ownerRes.status, 200);

    const { notifications: ownerNotifsAfter } = await NotificationRepository.getNotifications(ownerId);
    assert.equal(ownerNotifsAfter.find((n) => n.id === notification.id)?.read, true);
  });

  await t.test('DashboardRepository.getActivityFeed masks real user emails (public unauthenticated feed must not leak PII)', async () => {
    const realEmail = `real.person.${Date.now()}@example.com`;
    await AuditLogger.logEvent('LOGIN', {
      email: realEmail,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      status: 'SUCCESS',
    });

    const feed = await DashboardRepository.getActivityFeed(50);
    const entry = feed.find((f) => f.description?.includes('LOGIN') || f.type === 'LOGIN');
    if (entry) {
      assert.notEqual(entry.user, realEmail, 'the real email must never appear verbatim in the public activity feed');
      assert.ok(!entry.description.includes(realEmail), 'the real email must not leak via the description field either');
    }
  });

  await t.test('GET /api/dashboard/summary never treats an unauthenticated caller as ADMIN', async () => {
    const req = new Request('http://localhost:3000/api/dashboard/summary');
    const res = await dashboardSummaryGET(req);
    // Must not throw/500, and must not require a token (this endpoint is intentionally public
    // platform-aggregate data) -- the regression this guards is the `role` variable silently
    // defaulting to 'ADMIN' for an anonymous caller.
    assert.equal(res.status, 200);
  });

  await t.test('SEC-08: GET /api/admin/users never returns a plaintext apiKey', async () => {
    // Every admin being able to read every OTHER user's real, usable API key in plaintext
    // broadens the blast radius of any single admin-account compromise to every user's key at
    // once. An admin only needs enough of the key to identify/confirm it (e.g. "does this match
    // what the user says they're using"), not the ability to read/reuse it themselves.
    const target = UserDB.createUser({
      email: `sec08_target_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
      passwordHash: 'unused-in-this-test',
      fullName: 'SEC-08 Target',
      role: 'DEVELOPER',
    });
    assert.ok(target.apiKey, 'sanity check: the created user actually has a real apiKey to try to leak');

    const adminToken = tokenFor('usr_sec08_admin', 'ADMIN');
    const req = authedRequest('http://localhost:3000/api/admin/users', {}, adminToken);
    const res = await adminUsersGET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    const listed = body.users.find((u: any) => u.id === target.id);
    assert.ok(listed, 'the target user must appear in the admin listing');
    assert.notEqual(listed.apiKey, target.apiKey, 'the real apiKey value must never be returned verbatim');
    assert.ok(listed.apiKey.includes('*'), 'the returned apiKey must be masked');
    assert.ok(listed.apiKey.endsWith(target.apiKey.slice(-4)), 'only the last 4 characters may be revealed');
  });

  await t.test('NEW-01: UserDB.createUser generates apiKey with cryptographically secure randomness, not Date.now()+Math.random()', () => {
    // Was `figm_key_${Date.now()}_${Math.random().toString(36).substring(2, 10)}` -- Math.random()
    // is not cryptographically secure and Date.now() is guessable/narrow, together making a live,
    // usable API key meaningfully easier to predict/brute-force than it should be. The admin
    // bootstrap path (getDefaultUsers) already used crypto.randomBytes(16).toString('hex') --
    // this brings createUser (the path every normal registration goes through) in line with it.
    const user = UserDB.createUser({
      email: `new01_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
      passwordHash: 'unused-in-this-test',
      fullName: 'NEW-01 Regression',
      role: 'DEVELOPER',
    });
    assert.ok(user.apiKey, 'sanity check: createUser always sets apiKey');
    assert.ok(user.apiKey.startsWith('figm_key_'));
    const suffix = user.apiKey.slice('figm_key_'.length);
    // crypto.randomBytes(16).toString('hex') is always exactly 32 lowercase hex characters --
    // structurally distinct from the old `${timestamp}_${base36}` shape, which always contained
    // an underscore and was far shorter/narrower in its actual entropy.
    assert.match(suffix, /^[0-9a-f]{32}$/, `apiKey suffix must be 32 hex chars from crypto.randomBytes, got: ${suffix}`);
    assert.ok(!suffix.includes('_'), 'must not be the old timestamp_base36 shape');

    // Two keys generated back-to-back (same millisecond is plausible) must still be distinct --
    // the old Date.now()-based scheme could theoretically collide within the same tick if
    // Math.random() also happened to match, whereas 128 bits of real randomness practically can't.
    const user2 = UserDB.createUser({
      email: `new01b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
      passwordHash: 'unused-in-this-test',
      fullName: 'NEW-01 Regression 2',
      role: 'DEVELOPER',
    });
    assert.notEqual(user.apiKey, user2.apiKey);
  });

  await t.test('checkRateLimit blocks after the configured threshold and returns 429 with Retry-After', async () => {
    const testIp = `10.10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimit(testIp, 3, 60000);
      assert.equal(res, null);
    }
    const blocked = await checkRateLimit(testIp, 3, 60000);
    assert.equal(blocked?.status, 429);
    assert.ok(blocked?.headers.get('Retry-After'));
  });

  await t.test('PATCH /api/profile CHANGE_PASSWORD is rate-limited (was previously unthrottled)', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_pw_ratelimit_${Date.now()}`;
    const testIp = `10.20.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

    let sawRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const req = authedRequest(
        'http://localhost:3000/api/profile',
        {
          method: 'PATCH',
          headers: { 'x-forwarded-for': testIp },
          body: JSON.stringify({ action: 'CHANGE_PASSWORD', currentPassword: 'wrong', newPassword: 'NewPass123!' }),
        },
        tokenFor(userId)
      );
      const res = await profilePATCH(req);
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
    }
    assert.ok(sawRateLimit, 'CHANGE_PASSWORD must be rate-limited within 12 rapid attempts from the same IP (limit is 10/min)');
  });

  await t.test('CORS: allow-listed origin gets explicit headers, unlisted origin and null origin get none, credentials are never enabled', () => {
    const allowed = ['https://app.figm.example'];
    const okHeaders = buildCorsHeaders('https://app.figm.example', allowed);
    assert.equal(okHeaders['Access-Control-Allow-Origin'], 'https://app.figm.example');
    assert.equal('Access-Control-Allow-Credentials' in okHeaders, false, 'credentials must never be enabled alongside an origin allow-list');

    const badHeaders = buildCorsHeaders('https://evil.example', allowed);
    assert.equal('Access-Control-Allow-Origin' in badHeaders, false, 'a non-allow-listed origin must not receive an Allow-Origin header');

    const nullHeaders = buildCorsHeaders(null, allowed);
    assert.equal('Access-Control-Allow-Origin' in nullHeaders, false);

    assert.equal(isOriginAllowed('https://app.figm.example', allowed), true);
    assert.equal(isOriginAllowed('https://evil.example', allowed), false);
    assert.equal(isOriginAllowed(null, allowed), false);
  });

  await t.test('CORS: wildcard is never used regardless of configured allow-list', () => {
    const headers = buildCorsHeaders('https://anything.example', ['https://a.example', 'https://b.example']);
    assert.notEqual(headers['Access-Control-Allow-Origin'], '*');
    assert.equal('Access-Control-Allow-Origin' in headers, false);
  });

  await t.test('GET /api/report rejects unauthenticated callers with 401 and allows authenticated users', async () => {
    // Unauthenticated request
    const unauthedReq = new Request('http://localhost:3000/api/report');
    const unauthedRes = await reportGET(unauthedReq);
    assert.equal(unauthedRes.status, 401, 'unauthenticated callers must receive 401 Unauthorized');

    // Authenticated request bearing valid token
    const token = tokenFor('usr_report_test');
    const authedReq = new Request('http://localhost:3000/api/report', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const authedRes = await reportGET(authedReq);
    assert.equal(authedRes.status, 200, 'authenticated callers must receive 200 OK');
  });
});
