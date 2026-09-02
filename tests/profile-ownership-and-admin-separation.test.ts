import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, signJWT } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { GET as profileGET, PATCH as profilePATCH, DELETE as profileDELETE } from '../app/api/profile/route';

/**
 * Regression coverage for the "FINAL USER PROFILE + ADMIN PROFILE + ROLE SEPARATION" pass:
 * /api/profile must always resolve identity from the verified session token, never from anything
 * a client controls (URL, query string, request body, headers) -- and one user's own profile
 * request must never be able to read or mutate another user's record, regardless of role.
 */

function authedRequest(url: string, opts: RequestInit, jwt: string): Request {
  const headers = new Headers(opts.headers);
  headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function makeRealUser(label: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER') {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const user = UserDB.createUser({
    email: `${label}_${suffix}@profile-ownership-test.local`,
    passwordHash: hashPassword('TestPass123'),
    fullName: `${label} Test User`,
    role,
  });
  const token = signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: user.role });
  return { user, token };
}

test('GET /api/profile: identity always comes from the verified session, never from client-controlled input', async (t) => {
  const { user, token } = makeRealUser('ownercheck');

  await t.test('a forged userId/email in the query string is completely ignored', async () => {
    const maliciousUrl = `http://localhost:3000/api/profile?userId=some-other-user&email=admin@figm.io`;
    const res = await profileGET(authedRequest(maliciousUrl, {}, token));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.user.id, user.id, 'response must reflect the authenticated caller, not the forged query param');
    assert.equal(body.user.email, user.email);
  });

  await t.test('response never includes passwordHash or refreshToken', async () => {
    const res = await profileGET(authedRequest('http://localhost:3000/api/profile', {}, token));
    const body = await res.json();
    const serialized = JSON.stringify(body);
    assert.equal(/passwordHash/i.test(serialized), false, 'passwordHash must never be serialized into the profile response');
    assert.equal(/refreshToken/i.test(serialized), false, 'refreshToken must never be serialized into the profile response');
  });

  await t.test('an unauthenticated request is rejected before any user data is read', async () => {
    const res = await profileGET(new Request('http://localhost:3000/api/profile'));
    assert.equal(res.status, 401);
  });
});

test('PATCH /api/profile: a forged userId in the request body cannot redirect the update to another account', async (t) => {
  const { user: userA, token: tokenA } = makeRealUser('patchowner_a');
  const { user: userB } = makeRealUser('patchowner_b');

  await t.test('updateProfile is applied to the authenticated caller, ignoring a userId field in the body', async () => {
    const res = await profilePATCH(
      authedRequest(
        'http://localhost:3000/api/profile',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userB.id, fullName: 'Renamed By A' }),
        },
        tokenA
      )
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.user.id, userA.id, 'the update must apply to the authenticated caller (A), never the forged body userId (B)');

    const bRecordAfter = UserDB.findUserById(userB.id);
    assert.notEqual(bRecordAfter?.fullName, 'Renamed By A', "user B's own record must be untouched by A's forged-userId PATCH");

    const aRecordAfter = UserDB.findUserById(userA.id);
    assert.equal(aRecordAfter?.fullName, 'Renamed By A', "the rename correctly landed on A's own record");
  });
});

test('DELETE /api/profile: only ever deletes the authenticated caller\'s own account', async (t) => {
  const { user: userA, token: tokenA } = makeRealUser('deleteowner_a');
  const { user: userB } = makeRealUser('deleteowner_b');

  await t.test('deleting as A leaves B fully intact', async () => {
    const res = await profileDELETE(authedRequest('http://localhost:3000/api/profile', { method: 'DELETE' }, tokenA));
    assert.equal(res.status, 200);
    assert.equal(UserDB.findUserById(userA.id), undefined, "A's own account must be gone");
    assert.notEqual(UserDB.findUserById(userB.id), undefined, "B's account must be completely unaffected by A's own account deletion");
  });
});

test('Two-user isolation: A and B never see or affect each other through /api/profile', async (t) => {
  const { user: userA, token: tokenA } = makeRealUser('isolation_a');
  const { user: userB, token: tokenB } = makeRealUser('isolation_b');

  await t.test('A fetching their own profile never returns B\'s data, and vice versa', async () => {
    const resA = await profileGET(authedRequest('http://localhost:3000/api/profile', {}, tokenA));
    const bodyA = await resA.json();
    assert.equal(bodyA.user.id, userA.id);
    assert.notEqual(bodyA.user.id, userB.id);

    const resB = await profileGET(authedRequest('http://localhost:3000/api/profile', {}, tokenB));
    const bodyB = await resB.json();
    assert.equal(bodyB.user.id, userB.id);
    assert.notEqual(bodyB.user.id, userA.id);
  });
});

test('ADMIN role has no special-cased impersonation path on /api/profile', async (t) => {
  const { user: adminUser, token: adminToken } = makeRealUser('adminself', 'ADMIN');
  const { user: otherUser } = makeRealUser('adminother', 'DEVELOPER');

  await t.test('an ADMIN calling /api/profile always gets their own record, never an arbitrary other user\'s, even by forged query param', async () => {
    const res = await profileGET(
      authedRequest(`http://localhost:3000/api/profile?userId=${otherUser.id}`, {}, adminToken)
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.user.id, adminUser.id, 'an ADMIN\'s own /api/profile call must resolve to their own account, not the forged target user');
    assert.equal(body.user.role, 'ADMIN');
  });
});
