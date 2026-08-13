import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signJWT,
  verifyJWT,
  signRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  validateEmail,
  validatePassword,
  validateRole,
} from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { checkRateLimit } from '../src/auth/rate-limiter';
import { AuditLogger } from '../src/auth/audit-logger';

test('Production Auth System Suite', async (t) => {
  await t.test('Password Hashing and PBKDF2 SHA-512 Verification', () => {
    const password = 'SecretPassword123!';
    const hash = hashPassword(password);

    assert.ok(hash.includes(':'), 'Hash must contain salt delimiter');
    assert.strictEqual(verifyPassword(password, hash), true, 'Password should match stored hash');
    assert.strictEqual(verifyPassword('WrongPassword123!', hash), false, 'Incorrect password must fail');
  });

  await t.test('Input Validation Utilities', () => {
    assert.strictEqual(validateEmail('test@figm.io'), true);
    assert.strictEqual(validateEmail('invalid-email'), false);

    assert.strictEqual(validatePassword('Short1!').valid, false);
    assert.strictEqual(validatePassword('alllowercase1!').valid, false);
    assert.strictEqual(validatePassword('NoNumbersHere!').valid, false);
    assert.strictEqual(validatePassword('ValidPass123!').valid, true);

    assert.strictEqual(validateRole('ADMIN'), 'ADMIN');
    assert.strictEqual(validateRole('AUDITOR'), 'AUDITOR');
    assert.strictEqual(validateRole('DEVELOPER'), 'DEVELOPER');
    assert.strictEqual(validateRole('UNKNOWN'), 'DEVELOPER');
  });

  await t.test('Access & Refresh JWT Token Lifecycle', () => {
    const payload = {
      userId: 'usr_test_123',
      email: 'admin@figm.io',
      fullName: 'Admin User',
      role: 'ADMIN' as const,
    };

    const accessToken = signJWT(payload, 3600);
    const decodedAccess = verifyJWT(accessToken);

    assert.ok(decodedAccess !== null);
    assert.strictEqual(decodedAccess?.userId, payload.userId);
    assert.strictEqual(decodedAccess?.email, payload.email);
    assert.strictEqual(decodedAccess?.role, 'ADMIN');

    const refreshToken = signRefreshToken(payload, 604800);
    const decodedRefresh = verifyRefreshToken(refreshToken);

    assert.ok(decodedRefresh !== null);
    assert.strictEqual(decodedRefresh?.userId, payload.userId);
    assert.strictEqual(decodedRefresh?.email, payload.email);
  });

  await t.test('UserDB CRUD & Role-based Storage', () => {
    const email = `test_${Date.now()}@figm.io`;
    const passwordHash = hashPassword('Password123!');
    const user = UserDB.createUser({
      email,
      passwordHash,
      fullName: 'Test Auditor',
      role: 'AUDITOR',
    });

    assert.ok(user.id.startsWith('usr_'));
    assert.strictEqual(user.email, email);
    assert.strictEqual(user.role, 'AUDITOR');

    const found = UserDB.findUserByEmail(email);
    assert.ok(found !== undefined);
    assert.strictEqual(found?.id, user.id);

    const updated = UserDB.updateUser(user.id, { fullName: 'Updated Auditor Name' });
    assert.strictEqual(updated?.fullName, 'Updated Auditor Name');
  });

  await t.test('Forgot & Reset Password Token Lifecycle', () => {
    const email = `reset_${Date.now()}@figm.io`;
    const user = UserDB.createUser({
      email,
      passwordHash: hashPassword('OldPassword123!'),
      fullName: 'Reset User',
      role: 'DEVELOPER',
    });

    const { token, expiry } = generateResetToken();
    UserDB.updateUser(user.id, { resetToken: token, resetTokenExpiry: expiry });

    const foundUser = UserDB.findUserByResetToken(token);
    assert.ok(foundUser !== undefined);
    assert.strictEqual(foundUser?.id, user.id);

    const newHash = hashPassword('NewPassword123!');
    UserDB.updateUser(user.id, {
      passwordHash: newHash,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    const updatedUser = UserDB.findUserById(user.id);
    assert.strictEqual(verifyPassword('NewPassword123!', updatedUser!.passwordHash), true);
    assert.strictEqual(updatedUser?.resetToken, undefined);
  });

  await t.test('Audit Logger Event Verification', async () => {
    const email = `audit_${Date.now()}@figm.io`;
    const log = await AuditLogger.logEvent('LOGIN', {
      email,
      ipAddress: '192.168.1.50',
      userAgent: 'TestBrowser/1.0',
      status: 'SUCCESS',
    });

    assert.ok(log.id.startsWith('log_'));
    assert.strictEqual(log.action, 'LOGIN');
    assert.strictEqual(log.email, email);

    const recent = await AuditLogger.getRecentLogs(10);
    assert.ok(recent.length > 0);
  });

  await t.test('Rate Limiter Enforcement', async () => {
    const testIp = `10.0.0.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit(testIp, 5, 60000);
      assert.strictEqual(res, null, `Request ${i + 1} should pass`);
    }

    const blockedRes = await checkRateLimit(testIp, 5, 60000);
    assert.ok(blockedRes !== null, 'Request 6 should be blocked');
    assert.strictEqual(blockedRes?.status, 429);
  });
});
