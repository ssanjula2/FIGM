import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT, hashPassword } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { PATCH as adminUsersPATCH } from '../app/api/admin/users/route';
import { POST as registerPOST } from '../app/api/auth/register/route';
import { isEngineeringTestEmail, isEngineeringTestAccount } from '../src/lib/engineering-test-accounts';

/**
 * Stage 7D (Sections 4-5): regression coverage for the real, persisted `User.accountType` column
 * (prisma/migrations/20260903072448_add_account_type, applied this stage) and its server-only
 * write path. Covers: (1) normal public registration always creates a NORMAL account even if a
 * client sends an `accountType` field, (2) only an ADMIN-authorized PATCH /api/admin/users can set
 * ENGINEERING_TEST, (3) isEngineeringTestAccount's dual accountType/email-convention logic.
 */

function createTestUser(label: string, role: 'DEVELOPER' | 'ADMIN' = 'DEVELOPER', accountType?: 'NORMAL' | 'ENGINEERING_TEST') {
  const user = UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: hashPassword('ValidPass123'),
    fullName: label,
    role,
    ...(accountType ? { accountType } : {}),
  } as any);
  return user;
}

function authedRequest(url: string, jwt: string, body: unknown, method = 'PATCH'): Request {
  return new Request(url, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('isEngineeringTestAccount: real accountType column takes precedence, email convention is a fallback', () => {
  assert.equal(isEngineeringTestAccount({ email: 'real.user@example.com', accountType: 'ENGINEERING_TEST' }), true);
  assert.equal(isEngineeringTestAccount({ email: 'engtest.someone@figm.io', accountType: 'NORMAL' }), true, 'pre-migration engtest*/curltest* accounts default to NORMAL after migration but must still be caught by the email fallback');
  assert.equal(isEngineeringTestAccount({ email: 'real.user@example.com', accountType: 'NORMAL' }), false);
  assert.equal(isEngineeringTestAccount({ email: 'real.user@example.com' }), false, 'no accountType at all (undefined) must not be treated as engineering-test');
  assert.equal(isEngineeringTestAccount(undefined), false);
  assert.equal(isEngineeringTestEmail('curltest1@figm.io'), true);
});

test('POST /api/auth/register: a client-supplied accountType field is completely ignored', async () => {
  RepositoryFactory.resetProvider();
  const email = `regtest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`;

  const req = new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.11' },
    body: JSON.stringify({
      email,
      password: 'ValidPass123',
      fullName: 'Registration AccountType Probe',
      accountType: 'ENGINEERING_TEST', // must never be honored from a public client
    }),
  });

  const res = await registerPOST(req);
  assert.equal(res.status, 200);

  const created = UserDB.findUserByEmail(email);
  assert.ok(created, 'user must have been created');
  assert.notEqual(created!.accountType, 'ENGINEERING_TEST', 'a self-registered account must never become ENGINEERING_TEST via a client-supplied field');
});

test('PATCH /api/admin/users: an ADMIN can explicitly set accountType to ENGINEERING_TEST', async () => {
  RepositoryFactory.resetProvider();
  const admin = createTestUser('acct_type_admin', 'ADMIN');
  const target = createTestUser('acct_type_target', 'DEVELOPER');
  const adminJwt = signJWT({ userId: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN' }, admin.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', adminJwt, {
      userId: target.id,
      accountType: 'ENGINEERING_TEST',
    })
  );
  assert.equal(res.status, 200);

  const updated = UserDB.findUserById(target.id);
  assert.equal(updated?.accountType, 'ENGINEERING_TEST');
});

test('PATCH /api/admin/users: an invalid accountType value is rejected with 400, not persisted', async () => {
  RepositoryFactory.resetProvider();
  const admin = createTestUser('acct_type_admin_invalid', 'ADMIN');
  const target = createTestUser('acct_type_target_invalid', 'DEVELOPER');
  const adminJwt = signJWT({ userId: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN' }, admin.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', adminJwt, {
      userId: target.id,
      accountType: 'SUPERUSER_TEST', // not a real AccountType value
    })
  );
  assert.equal(res.status, 400);

  const unchanged = UserDB.findUserById(target.id);
  assert.notEqual(unchanged?.accountType, 'SUPERUSER_TEST');
});

test('PATCH /api/admin/users: a non-ADMIN caller cannot set accountType (authorization is not bypassed by this new field)', async () => {
  RepositoryFactory.resetProvider();
  const developer = createTestUser('acct_type_dev_unauthorized', 'DEVELOPER');
  const target = createTestUser('acct_type_target_unauth', 'DEVELOPER');
  const devJwt = signJWT({ userId: developer.id, email: developer.email, fullName: developer.fullName, role: 'DEVELOPER' }, developer.tokenVersion ?? 0);

  const res = await adminUsersPATCH(
    authedRequest('http://localhost:3000/api/admin/users', devJwt, {
      userId: target.id,
      accountType: 'ENGINEERING_TEST',
    })
  );
  assert.equal(res.status, 403);

  const unchanged = UserDB.findUserById(target.id);
  assert.notEqual(unchanged?.accountType, 'ENGINEERING_TEST');
});

test('GET /api/admin/users: accountType is exposed to the admin UI so engineering-test accounts are visible for cleanup', async () => {
  RepositoryFactory.resetProvider();
  const { GET: adminUsersGET } = await import('../app/api/admin/users/route');
  const admin = createTestUser('acct_type_list_admin', 'ADMIN');
  createTestUser('acct_type_list_eng', 'DEVELOPER', 'ENGINEERING_TEST');
  const adminJwt = signJWT({ userId: admin.id, email: admin.email, fullName: admin.fullName, role: 'ADMIN' }, admin.tokenVersion ?? 0);

  const res = await adminUsersGET(
    new Request('http://localhost:3000/api/admin/users', { headers: { Authorization: `Bearer ${adminJwt}` } })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.users.some((u: any) => u.accountType === 'ENGINEERING_TEST'));
});
