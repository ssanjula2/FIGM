import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signJWT, verifyJWT } from '../src/auth/auth-service.js';
import { UserDB } from '../src/auth/user-db.js';

test('Multi-Tenant Authentication & Session Management', async (t) => {
  await t.test('hashPassword and verifyPassword function correctly with salt', () => {
    const rawPass = 'SecretDevPass123!';
    const hashed = hashPassword(rawPass);

    assert.notEqual(hashed, rawPass);
    assert.equal(verifyPassword(rawPass, hashed), true);
    assert.equal(verifyPassword('WrongPassword', hashed), false);
  });

  await t.test('signJWT and verifyJWT generate valid isolated tokens', () => {
    const payload = {
      userId: 'usr_tenant_alpha_123',
      email: 'alpha@developer.com',
      fullName: 'Tenant Alpha Developer',
      role: 'DEVELOPER' as const,
    };

    const token = signJWT(payload, 0);
    assert.ok(token);

    const decoded = verifyJWT(token);
    assert.ok(decoded);
    assert.equal(decoded.userId, 'usr_tenant_alpha_123');
    assert.equal(decoded.email, 'alpha@developer.com');
  });

  await t.test('UserDB enforces tenant isolation for submissions', () => {
    // Unique per run -- the JSON storage backend persists to a real file across separate `npm
    // test` invocations, and UserDB.createUser now correctly rejects a duplicate email (mirroring
    // Postgres's real unique constraint; see the Phase 11 participant-provisioning-race fix), so a
    // hardcoded literal here would collide with this same test's leftover data from a prior run.
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const userA = UserDB.createUser({
      email: `usera_${suffix}@test.com`,
      passwordHash: hashPassword('passA'),
      fullName: 'User A',
      role: 'DEVELOPER',
    });

    const userB = UserDB.createUser({
      email: `userb_${suffix}@test.com`,
      passwordHash: hashPassword('passB'),
      fullName: 'User B',
      role: 'DEVELOPER',
    });

    UserDB.createSubmission({
      userId: userA.id,
      fileName: 'UserA_Component.tsx',
      framework: 'REACT',
      codeContent: 'export function ComponentA() {}',
      executionTimeMs: 12,
      qualityScore: 95,
      diagnosticsCount: 1,
    });

    UserDB.createSubmission({
      userId: userB.id,
      fileName: 'UserB_Service.ts',
      framework: 'ANGULAR',
      codeContent: 'export class ServiceB {}',
      executionTimeMs: 18,
      qualityScore: 90,
      diagnosticsCount: 2,
    });

    const submissionsA = UserDB.getSubmissionsByUserId(userA.id);
    const submissionsB = UserDB.getSubmissionsByUserId(userB.id);

    assert.equal(submissionsA.length >= 1, true);
    assert.equal(submissionsA.every((s) => s.userId === userA.id), true);

    assert.equal(submissionsB.length >= 1, true);
    assert.equal(submissionsB.every((s) => s.userId === userB.id), true);

    // Cross-tenant access isolation verification
    const leakAttempt = UserDB.getSubmissionById(submissionsA[0].id, userB.id);
    assert.equal(leakAttempt, undefined, 'User B must NOT be able to query User A submission history!');
  });
});
