import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  signJWT,
  verifyJWT,
  signRefreshToken,
  verifyRefreshToken,
  hashPassword,
  isInsecureFallbackAllowed,
} from '../src/auth/auth-service';
import { UserDB, resolveBootstrapAdminPassword } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { POST as registerPOST } from '../app/api/auth/register/route';
import { POST as refreshPOST } from '../app/api/auth/refresh/route';
import { POST as logoutPOST } from '../app/api/auth/logout/route';
import { GET as profileGET } from '../app/api/profile/route';

/**
 * Regression coverage for the SEC-01/SEC-02 remediation in audit/new.md:
 *   - committed admin credentials / predictable JWT & refresh fallback secrets
 *   - caller-controlled JWT role claims
 * Every test that needs to simulate a production-equivalent environment mutates
 * process.env directly (JWT_SECRET/REFRESH_SECRET/ADMIN_BOOTSTRAP_PASSWORD/NODE_ENV are now
 * resolved lazily, per call, in src/auth/auth-service.ts and src/auth/user-db.ts -- not cached at
 * module-import time) and restores the original values in a `finally` block so it can't leak into
 * other tests in this file or (via node:test's per-file process isolation) any other file.
 */

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
  }
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('Security Remediation Regression Suite', async (t) => {
  await t.test('sanity: the automated test run itself is recognized as a safe (non-production-equivalent) environment', () => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(isInsecureFallbackAllowed(), true);
  });

  await t.test('isInsecureFallbackAllowed only exempts development/test, not staging/preview/unset', () => {
    withEnv({ NODE_ENV: 'staging' }, () => assert.equal(isInsecureFallbackAllowed(), false));
    withEnv({ NODE_ENV: 'preview' }, () => assert.equal(isInsecureFallbackAllowed(), false));
    withEnv({ NODE_ENV: 'production' }, () => assert.equal(isInsecureFallbackAllowed(), false));
    withEnv({ NODE_ENV: undefined }, () => assert.equal(isInsecureFallbackAllowed(), false));
    withEnv({ NODE_ENV: 'development' }, () => assert.equal(isInsecureFallbackAllowed(), true));
    withEnv({ NODE_ENV: 'test' }, () => assert.equal(isInsecureFallbackAllowed(), true));
  });

  await t.test('missing JWT secret: signJWT fails closed outside development/test (production, staging, and unset NODE_ENV)', () => {
    const payload = { userId: 'usr_x', email: 'x@figm.io', fullName: 'X', role: 'DEVELOPER' as const };

    for (const nodeEnv of ['production', 'staging', undefined]) {
      withEnv({ NODE_ENV: nodeEnv, JWT_SECRET: undefined }, () => {
        assert.throws(
          () => signJWT(payload, 0),
          /FATAL: JWT_SECRET environment variable is missing/,
          `signJWT must throw when JWT_SECRET is unset and NODE_ENV=${nodeEnv ?? '(unset)'}`
        );
      });
    }

    // Explicitly confirm it does NOT throw in development -- the fallback must still work locally.
    withEnv({ NODE_ENV: 'development', JWT_SECRET: undefined }, () => {
      assert.doesNotThrow(() => signJWT(payload, 0));
    });
  });

  await t.test('missing refresh secret: signRefreshToken/verifyRefreshToken fail closed outside development/test', () => {
    const payload = { userId: 'usr_x', email: 'x@figm.io', fullName: 'X', role: 'DEVELOPER' as const };

    for (const nodeEnv of ['production', 'staging', undefined]) {
      withEnv({ NODE_ENV: nodeEnv, REFRESH_SECRET: undefined }, () => {
        assert.throws(
          () => signRefreshToken(payload),
          /FATAL: REFRESH_SECRET environment variable is missing/,
          `signRefreshToken must throw when REFRESH_SECRET is unset and NODE_ENV=${nodeEnv ?? '(unset)'}`
        );
      });
    }
  });

  await t.test('a short or placeholder-looking secret is rejected outside development/test even if present', () => {
    withEnv({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }, () => {
      assert.throws(() => signJWT({ userId: 'u', email: 'u@figm.io', fullName: 'U', role: 'DEVELOPER' }, 0), /at least 32 characters/);
    });
    withEnv({ NODE_ENV: 'production', JWT_SECRET: 'YOUR_PRODUCTION_JWT_SECRET_STRING_PADDED_TO_32_CHARS' }, () => {
      assert.throws(() => signJWT({ userId: 'u', email: 'u@figm.io', fullName: 'U', role: 'DEVELOPER' }, 0), /unfilled template placeholder/);
    });
  });

  await t.test('forged ADMIN role: signJWT/verifyJWT clamp any role outside {ADMIN, AUDITOR, DEVELOPER} to DEVELOPER', () => {
    // @ts-expect-error -- deliberately passing an invalid role to prove it cannot survive signing.
    const forgedToken = signJWT({ userId: 'usr_attacker', email: 'a@figm.io', fullName: 'A', role: 'SUPERADMIN' }, 0);
    const decoded = verifyJWT(forgedToken);
    assert.equal(decoded?.role, 'DEVELOPER');

    // A syntactically valid token correctly signed with role: 'ADMIN' still decodes as ADMIN --
    // the clamp only rejects values outside the known enum, it doesn't strip legitimate elevation.
    const legitAdminToken = signJWT({ userId: 'usr_real_admin', email: 'admin@figm.io', fullName: 'Admin', role: 'ADMIN' }, 0);
    assert.equal(verifyJWT(legitAdminToken)?.role, 'ADMIN');
  });

  await t.test('forged ADMIN role: public self-registration cannot mint an ADMIN-role JWT via a client-supplied role field', async () => {
    RepositoryFactory.resetProvider();
    const email = `forge_admin_${Date.now()}@figm.io`;
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'ValidPass123!',
        fullName: 'Attacker',
        role: 'ADMIN', // client-supplied -- must never be trusted
      }),
    });

    const res = await registerPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.user.role, 'ADMIN');

    const decoded = verifyJWT(body.accessToken);
    assert.notEqual(decoded?.role, 'ADMIN');
  });

  await t.test('default credential rejection: resolveBootstrapAdminPassword never returns the old hardcoded literal and is not a fixed value', () => {
    const passwordA = withEnv({ ADMIN_BOOTSTRAP_PASSWORD: undefined }, () => resolveBootstrapAdminPassword());
    const passwordB = withEnv({ ADMIN_BOOTSTRAP_PASSWORD: undefined }, () => resolveBootstrapAdminPassword());

    assert.notEqual(passwordA, 'Admin123456!');
    assert.notEqual(passwordB, 'Admin123456!');
    // Freshly generated each call in dev/test -- proves there is no fixed, source-committed default
    // admin password anymore (previously the literal 'Admin123456!' every single time).
    assert.notEqual(passwordA, passwordB);

    // A hash of the old literal must not verify against a hash of a freshly-resolved password.
    const oldLiteralHash = hashPassword('Admin123456!');
    const freshHash = hashPassword(passwordA);
    assert.notEqual(oldLiteralHash, freshHash);
  });

  await t.test('default credential rejection: bootstrap fails closed outside development/test when ADMIN_BOOTSTRAP_PASSWORD is unset', () => {
    for (const nodeEnv of ['production', 'staging', undefined]) {
      withEnv({ NODE_ENV: nodeEnv, ADMIN_BOOTSTRAP_PASSWORD: undefined }, () => {
        assert.throws(
          () => resolveBootstrapAdminPassword(),
          /FATAL: ADMIN_BOOTSTRAP_PASSWORD/,
          `must throw when ADMIN_BOOTSTRAP_PASSWORD is unset and NODE_ENV=${nodeEnv ?? '(unset)'}`
        );
      });
    }
  });

  await t.test('default credential rejection: an explicit ADMIN_BOOTSTRAP_PASSWORD (>=12 chars) is honored verbatim', () => {
    const chosen = 'Correct-Horse-Battery-Staple-42';
    const resolved = withEnv({ NODE_ENV: 'production', ADMIN_BOOTSTRAP_PASSWORD: chosen }, () => resolveBootstrapAdminPassword());
    assert.equal(resolved, chosen);
  });

  await t.test('revoked refresh token: /api/auth/refresh rejects a validly-signed token that no longer matches the user\'s stored refresh token', async () => {
    RepositoryFactory.resetProvider();
    const email = `revoked_${Date.now()}@figm.io`;
    const user = UserDB.createUser({
      email,
      passwordHash: hashPassword('ValidPass123!'),
      fullName: 'Revocation Test User',
      role: 'DEVELOPER',
    });

    const payload = { userId: user.id, email: user.email, fullName: user.fullName, role: user.role };
    const staleRefreshToken = signRefreshToken(payload);

    // The token is well-formed and unexpired -- verifyRefreshToken alone accepts it.
    assert.ok(verifyRefreshToken(staleRefreshToken) !== null);

    // But the user's *stored* refresh token has since been rotated/revoked to something else
    // (e.g. by a subsequent login or an explicit admin revocation), so the route must reject the
    // stale one even though its own signature/expiry are still individually valid. Deliberately not
    // another signRefreshToken(payload) call here -- within the same second that would encode an
    // identical iat/exp and produce a byte-identical token, defeating the point of this test.
    UserDB.updateUser(user.id, { refreshToken: 'revoked-placeholder-not-a-real-token' });

    const req = new Request('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: staleRefreshToken }),
    });
    const res = await refreshPOST(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'TOKEN_REVOKED');
  });

  await t.test('logout actually revokes the refresh token (regression: Prisma silently ignores undefined-valued update fields)', async () => {
    // Found live against the real configured Supabase DB while auditing credential-rotation
    // procedure: app/api/auth/logout/route.ts called
    // updateUser(userId, { refreshToken: undefined }) to clear the token. Prisma's update()
    // treats an undefined-valued key as "field not included in this update" (only an explicit
    // `null` clears a nullable column) -- so on the real Supabase/Prisma-backed storage provider
    // this was a complete no-op: the stored refresh token was NEVER actually cleared, meaning a
    // stolen/leaked refresh token remained fully valid for its full 7-day life even after the
    // legitimate user "logged out." The JSON-file storage provider this test runs against
    // happened to make `undefined` work anyway (plain object spread lets an undefined value
    // override a previous key, unlike Prisma), which is exactly why no existing test caught this
    // -- this test guards the SOURCE, not just the JSON-provider's more forgiving behavior.
    RepositoryFactory.resetProvider();
    const email = `logout_revoke_${Date.now()}@figm.io`;
    const user = UserDB.createUser({
      email,
      passwordHash: hashPassword('LogoutRevokeTest123!'),
      fullName: 'Logout Revocation Test User',
      role: 'DEVELOPER',
    });
    const payload = { userId: user.id, email: user.email, fullName: user.fullName, role: user.role };
    const accessToken = signJWT(payload, user.tokenVersion ?? 0);
    const refreshToken = signRefreshToken(payload);
    UserDB.updateUser(user.id, { refreshToken });
    assert.equal(UserDB.getAllUsers().find((u) => u.id === user.id)?.refreshToken, refreshToken, 'sanity check: the refresh token is actually stored before logout');

    // Sanity check: the pre-logout access token is accepted by a real protected route (proves the
    // later 401 is actually caused by logout, not by some unrelated reason the token never worked).
    const preLogoutProfileRes = await profileGET(
      new Request('http://localhost:3000/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } })
    );
    assert.equal(preLogoutProfileRes.status, 200, 'sanity check: the access token works before logout');

    const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const logoutRes = await logoutPOST(logoutReq);
    assert.equal(logoutRes.status, 200);

    const afterLogout = UserDB.getAllUsers().find((u) => u.id === user.id);
    assert.equal(afterLogout?.refreshToken, null, 'the stored refresh token must be explicitly cleared to null, not left unchanged');

    // The real, end-to-end consequence: the pre-logout refresh token must now be rejected.
    const refreshReq = new Request('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshRes = await refreshPOST(refreshReq);
    assert.equal(refreshRes.status, 401);
    const refreshBody = await refreshRes.json();
    assert.equal(refreshBody.code, 'TOKEN_REVOKED');
  });

  await t.test('REGRESSION (Stage 7B): logout also revokes the still-unexpired ACCESS token itself, not just the refresh token', async () => {
    // This is the exact reported bug: refresh-token revocation alone (the test above) does not
    // stop a copy of the short-lived ACCESS token that already exists elsewhere -- a second open
    // tab's localStorage, or a value captured via XSS before logout -- from continuing to work
    // against every API route for up to its own remaining ~1h lifetime. Fixed via a DB-backed
    // `tokenVersion` column (prisma/schema.prisma) that authenticateUser() now checks on every
    // request (src/auth/auth-middleware.ts).
    RepositoryFactory.resetProvider();
    const email = `access_token_revoke_${Date.now()}@figm.io`;
    const user = UserDB.createUser({
      email,
      passwordHash: hashPassword('AccessRevokeTest123!'),
      fullName: 'Access Token Revocation Test User',
      role: 'DEVELOPER',
    });
    const payload = { userId: user.id, email: user.email, fullName: user.fullName, role: user.role };
    // Simulates a second tab: this exact access token is never used for the logout call itself
    // below, standing in for a copy that already exists somewhere else in the browser.
    const staleAccessToken = signJWT(payload, user.tokenVersion ?? 0);

    const preLogoutRes = await profileGET(
      new Request('http://localhost:3000/api/profile', { headers: { Authorization: `Bearer ${staleAccessToken}` } })
    );
    assert.equal(preLogoutRes.status, 200, 'sanity check: the stale token works before logout');

    // Logout happens via a freshly-signed token for the same user (e.g. the tab that actually
    // clicked "Log out") -- proving the revocation is per-USER (tokenVersion bump), not merely
    // per-token, so it reaches the OTHER tab's token too.
    const logoutToken = signJWT(payload, user.tokenVersion ?? 0);
    const logoutRes = await logoutPOST(
      new Request('http://localhost:3000/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${logoutToken}` } })
    );
    assert.equal(logoutRes.status, 200);

    const afterLogout = UserDB.getAllUsers().find((u) => u.id === user.id);
    assert.equal(afterLogout?.tokenVersion, 1, 'logout must increment tokenVersion exactly once');

    // The real bug, closed: the stale access token from "the other tab" must now be rejected, even
    // though it has not expired and its signature is still perfectly valid.
    const postLogoutRes = await profileGET(
      new Request('http://localhost:3000/api/profile', { headers: { Authorization: `Bearer ${staleAccessToken}` } })
    );
    assert.equal(postLogoutRes.status, 401, 'a stale access token from before logout must be rejected after logout');
    const postLogoutBody = await postLogoutRes.json();
    assert.equal(postLogoutBody.code, 'TOKEN_REVOKED');
  });

  await t.test('source-level guard: the logout route clears refreshToken with null, never undefined', () => {
    // Direct regression guard for the exact Prisma-specific bug above -- catches a future edit
    // reverting to `refreshToken: undefined` even in a change that doesn't touch this test's
    // JSON-provider-based functional assertions (which, as documented above, would not by
    // themselves detect a regression back to `undefined`).
    const src = fs.readFileSync(path.resolve(process.cwd(), 'app/api/auth/logout/route.ts'), 'utf-8');
    // Not anchored to `}` immediately after `null` -- Stage 7B added a sibling `tokenVersion` field
    // to the same update() call (see the access-token-revocation regression test above), so the
    // object no longer closes right after refreshToken. The guard's actual intent (an explicit
    // `null`, never a silently-ignored `undefined`) is unaffected by what other fields sit next to it.
    assert.match(src, /refreshToken:\s*null\s*[,}]/, 'logout must clear refreshToken with an explicit null');
    assert.doesNotMatch(src, /refreshToken:\s*undefined/, 'logout must never clear refreshToken with undefined (a no-op against Prisma)');
  });

  await t.test('revoked refresh token: a token for a user that no longer exists is rejected the same way', async () => {
    RepositoryFactory.resetProvider();
    const payload = { userId: 'usr_never_existed_' + Date.now(), email: 'ghost@figm.io', fullName: 'Ghost', role: 'DEVELOPER' as const };
    const ghostToken = signRefreshToken(payload);

    const req = new Request('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: ghostToken }),
    });
    const res = await refreshPOST(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'TOKEN_REVOKED');
  });
});
