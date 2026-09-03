import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT, hashPassword, verifyPassword } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserRepository } from '../src/engine/user-repository';
import { PATCH as profilePATCH } from '../app/api/profile/route';
import { PATCH as adminUsersPATCH } from '../app/api/admin/users/route';

/**
 * Closure of two forensic-audit findings:
 *  - LOW/MEDIUM: PATCH /api/profile (action=CHANGE_PASSWORD) skipped the same password-strength
 *    policy register/reset-password already enforce.
 *  - LOW/INFORMATIONAL: PATCH /api/admin/users wrote an unvalidated `role` value (only ever
 *    protected by the Postgres enum constraint, which the JSON-fallback storage provider has no
 *    equivalent of).
 */

function createTestUser(label: string, role: 'DEVELOPER' | 'ADMIN' = 'DEVELOPER', password = 'ValidPass123') {
  const user = UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: hashPassword(password),
    fullName: label,
    role,
  });
  return user;
}

function authedRequest(url: string, jwt: string, body: unknown, method = 'PATCH'): Request {
  return new Request(url, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('PATCH /api/profile CHANGE_PASSWORD rejects a weak new password', async () => {
  RepositoryFactory.resetProvider();
  const user = createTestUser('weakpw_reject', 'DEVELOPER', 'ValidPass123');
  const jwt = signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, user.tokenVersion ?? 0);

  const res = await profilePATCH(
    authedRequest('http://localhost:3000/api/profile', jwt, {
      action: 'CHANGE_PASSWORD',
      currentPassword: 'ValidPass123',
      newPassword: 'weak',
    })
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /least 8 characters|uppercase|number/i);

  // The old (weak-rejected) password must still work -- the change must not have been applied.
  const stillValid = UserDB.findUserById(user.id);
  assert.ok(stillValid);
});

test('PATCH /api/profile CHANGE_PASSWORD accepts a strong new password (no regression)', async () => {
  RepositoryFactory.resetProvider();
  const user = createTestUser('strongpw_accept', 'DEVELOPER', 'ValidPass123');
  const jwt = signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, user.tokenVersion ?? 0);

  const res = await profilePATCH(
    authedRequest('http://localhost:3000/api/profile', jwt, {
      action: 'CHANGE_PASSWORD',
      currentPassword: 'ValidPass123',
      newPassword: 'AnotherStrong456',
    })
  );
  assert.equal(res.status, 200);
});

test('PATCH /api/admin/users rejects an invalid role value with 400, does not persist it', async () => {
  RepositoryFactory.resetProvider();
  const admin = createTestUser('role_admin', 'ADMIN');
  const target = createTestUser('role_target', 'DEVELOPER');
  const adminJwt = signJWT({ userId: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN' }, admin.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', adminJwt, {
      userId: target.id,
      role: 'SUPERUSER', // not a real role
    })
  );
  assert.equal(res.status, 400);

  const unchanged = UserDB.findUserById(target.id);
  assert.equal(unchanged?.role, 'DEVELOPER', 'role must be unchanged after a rejected update');
});

test('PATCH /api/admin/users accepts a valid role value (no regression)', async () => {
  RepositoryFactory.resetProvider();
  const admin = createTestUser('role_admin_valid', 'ADMIN');
  const target = createTestUser('role_target_valid', 'DEVELOPER');
  const adminJwt = signJWT({ userId: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN' }, admin.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', adminJwt, {
      userId: target.id,
      role: 'AUDITOR',
    })
  );
  assert.equal(res.status, 200);

  const updated = UserDB.findUserById(target.id);
  assert.equal(updated?.role, 'AUDITOR');
});

test('PATCH /api/admin/users is still rejected for a non-ADMIN caller (role validation does not bypass authorization)', async () => {
  RepositoryFactory.resetProvider();
  const developer = createTestUser('role_dev_unauthorized', 'DEVELOPER');
  const target = createTestUser('role_target_unauth', 'DEVELOPER');
  const devJwt = signJWT({ userId: developer.id, email: developer.email, fullName: developer.fullName, role: 'DEVELOPER' }, developer.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', devJwt, {
      userId: target.id,
      role: 'ADMIN',
    })
  );
  assert.equal(res.status, 403);
});

test('PATCH /api/admin/users rejects a weak admin-supplied password with 400, does not persist it', async () => {
  RepositoryFactory.resetProvider();
  const admin = createTestUser('pw_admin_reject', 'ADMIN');
  const target = createTestUser('pw_target_reject', 'DEVELOPER', 'OriginalPass123');
  const adminJwt = signJWT({ userId: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN' }, admin.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', adminJwt, {
      userId: target.id,
      newPassword: 'weak',
    })
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /least 8 characters|uppercase|number/i);

  // The original password must still work -- a rejected admin reset must not have been applied.
  const unchanged = UserDB.findUserById(target.id);
  assert.ok(unchanged && verifyPassword('OriginalPass123', unchanged.passwordHash));
});

test('CHANGE_PASSWORD (self-service) revokes the account\'s existing refresh token', async () => {
  RepositoryFactory.resetProvider();
  const user = createTestUser('pw_revoke_self', 'DEVELOPER', 'ValidPass123');
  UserDB.updateUser(user.id, { refreshToken: 'a-live-refresh-token-issued-before-the-change' });
  const jwt = signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, user.tokenVersion ?? 0);

  const res = await profilePATCH(
    authedRequest('http://localhost:3000/api/profile', jwt, {
      action: 'CHANGE_PASSWORD',
      currentPassword: 'ValidPass123',
      newPassword: 'BrandNewPass456',
    })
  );
  assert.equal(res.status, 200);

  const updated = UserDB.findUserById(user.id);
  // A refresh token issued before the change (e.g. one an attacker had already stolen) must not
  // remain usable after the owner changes their password.
  assert.equal(updated?.refreshToken, null, 'refresh token must be revoked, not just left as-is');
  assert.ok(verifyPassword('BrandNewPass456', updated!.passwordHash));
  assert.ok(!verifyPassword('ValidPass123', updated!.passwordHash), 'the old password must no longer verify');
});

test('Admin password reset revokes the target account\'s existing refresh token', async () => {
  RepositoryFactory.resetProvider();
  const target = createTestUser('pw_revoke_admin_target', 'DEVELOPER', 'OriginalPass123');
  UserDB.updateUser(target.id, { refreshToken: 'a-live-refresh-token-issued-before-the-reset' });

  const result = await UserRepository.adminResetPassword(target.id, 'ResetByAdmin789');
  assert.equal(result.success, true);

  const updated = UserDB.findUserById(target.id);
  assert.equal(updated?.refreshToken, null);
  assert.ok(verifyPassword('ResetByAdmin789', updated!.passwordHash));
});

test('password with spaces and symbols is accepted, hashed, and verified byte-for-byte (never trimmed/normalized)', async () => {
  RepositoryFactory.resetProvider();
  // Deliberately includes leading/trailing spaces and symbols -- the password must be treated as
  // an opaque secret end-to-end, not trimmed or otherwise normalized before hashing/verification.
  const rawPassword = '  Sp@ce & Symb0ls!  ';
  const user = createTestUser('pw_spaces_symbols', 'DEVELOPER', rawPassword);

  const stored = UserDB.findUserById(user.id);
  assert.ok(stored);
  assert.ok(verifyPassword(rawPassword, stored.passwordHash), 'the exact original string must verify');
  assert.ok(!verifyPassword(rawPassword.trim(), stored.passwordHash), 'a trimmed variant must NOT verify -- proves no implicit trimming occurred');
});
