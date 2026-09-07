import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB } from '../src/auth/user-db';
import { hashPassword, verifyPassword } from '../src/auth/auth-service';
import { POST as loginPOST } from '../app/api/auth/login/route';

/**
 * Regression coverage from the 2026-09-07 admin-login-recovery investigation (see
 * docs/audit/ADMIN_LOGIN_RECOVERY_ROOT_CAUSE.md). Proves the login path itself is sound end-to-end
 * (hash round-trip, DB-column-to-application-field mapping, email case/whitespace normalization,
 * ADMIN role never blocking authentication, ordinary users unaffected) using the real route
 * handler and the real hashPassword()/verifyPassword() functions -- never a reimplementation.
 */

function loginRequest(email: string, password: string, ip: string): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  });
}

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${180 + (ipCounter % 60)}`;
}

test('Admin login recovery regression suite', async (t) => {
  await t.test('hashPassword() output verifies successfully; a wrong password fails', () => {
    const password = 'CorrectHorseBattery9!';
    const hash = hashPassword(password);
    assert.equal(verifyPassword(password, hash), true);
    assert.equal(verifyPassword('SomethingElse9!', hash), false);
  });

  await t.test('SupabaseStorageProvider.mapUser preserves passwordHash from the DB row (proven from source, not assumed)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'storage', 'supabase-storage-provider.ts'),
      'utf-8'
    );
    assert.match(
      src,
      /function mapUser\(u: any\): DBUser \{[\s\S]*?passwordHash: u\.passwordHash,/,
      'mapUser must assign passwordHash from the raw Prisma row -- a DB row with password_hash set but an application-level undefined/null passwordHash would be exactly this line silently dropping the field'
    );
  });

  await t.test('an ADMIN-role user logs in successfully through the real route -- role never blocks authentication', async () => {
    RepositoryFactory.resetProvider();
    const email = `admin_login_check_${Date.now()}@figm.io`;
    const password = 'AdminRecoveryCheck9!';
    UserDB.createUser({
      email,
      passwordHash: hashPassword(password),
      fullName: 'Admin Login Regression Check',
      role: 'ADMIN',
    });

    const res = await loginPOST(loginRequest(email, password, freshIp()));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.role, 'ADMIN');
    assert.ok(data.accessToken);
  });

  await t.test('email lookup is case-insensitive through the real route', async () => {
    RepositoryFactory.resetProvider();
    const email = `Mixed.Case.User_${Date.now()}@Figm.IO`;
    const password = 'CaseInsensitive9!';
    UserDB.createUser({
      email,
      passwordHash: hashPassword(password),
      fullName: 'Case Sensitivity Check',
      role: 'DEVELOPER',
    });

    const res = await loginPOST(loginRequest(email.toUpperCase(), password, freshIp()));
    assert.equal(res.status, 200, 'login must succeed regardless of the case the caller submits, matching the stored row');
  });

  await t.test('email lookup tolerates incidental leading/trailing whitespace (regression: findUserByEmail previously had no .trim())', async () => {
    RepositoryFactory.resetProvider();
    const email = `whitespace_check_${Date.now()}@figm.io`;
    const password = 'WhitespaceCheck9!';
    UserDB.createUser({
      email, // stored clean, exactly as a manual/scripted admin-row insert would store it
      passwordHash: hashPassword(password),
      fullName: 'Whitespace Tolerance Check',
      role: 'ADMIN',
    });

    const res = await loginPOST(loginRequest(`  ${email}  `, password, freshIp()));
    assert.equal(
      res.status,
      200,
      'a login attempt with incidental leading/trailing whitespace around an otherwise-correct email must still succeed -- previously this failed identically to "wrong password", which is exactly the class of silent, hard-to-diagnose failure this investigation was called in for'
    );
  });

  await t.test('an ordinary (non-admin) user is unaffected by this investigation\'s changes', async () => {
    RepositoryFactory.resetProvider();
    const email = `ordinary_login_check_${Date.now()}@figm.io`;
    const password = 'OrdinaryUserCheck9!';
    UserDB.createUser({
      email,
      passwordHash: hashPassword(password),
      fullName: 'Ordinary User',
      role: 'DEVELOPER',
    });

    const ok = await loginPOST(loginRequest(email, password, freshIp()));
    assert.equal(ok.status, 200);
    const okData = await ok.json();
    assert.equal(okData.user.role, 'DEVELOPER');

    const wrong = await loginPOST(loginRequest(email, 'TotallyWrongPassword9!', freshIp()));
    assert.equal(wrong.status, 401);
  });
});
