import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UserRepository } from '../src/engine/user-repository';
import { FOUR_LAYER_MAPPINGS } from '../src/matrix/four-layer-meta-model';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';

describe('SaaS Production Features 8 & 9: Search & Admin Suite', () => {
  it('Guideline Matrix provides FIGM rules for global search', async () => {
    assert.ok(FOUR_LAYER_MAPPINGS.length >= 23);
    const perfRule = FOUR_LAYER_MAPPINGS.find((m) => m.rule.ruleId === 'FIGM-PERF-01');
    assert.ok(perfRule);
  });

  it('Admin User Management allows listing users, updating roles, and resetting passwords', async () => {
    RepositoryFactory.resetProvider();

    const targetEmail = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@figm.io`;
    const targetUser = UserDB.createUser({
      email: targetEmail,
      passwordHash: 'dummy',
      fullName: 'Dev User',
      role: 'DEVELOPER',
    });

    const allUsers = await UserRepository.getAllUsers();
    assert.ok(Array.isArray(allUsers));

    const updatedRole = await UserRepository.updateUserRole(targetUser.id, 'AUDITOR');
    assert.ok(updatedRole);
    assert.strictEqual(updatedRole?.role, 'AUDITOR');

    const resetPass = await UserRepository.adminResetPassword(targetUser.id, 'NewAdminPass123!');
    assert.ok(resetPass);

    const deleted = await UserRepository.deleteAccount(targetUser.id);
    assert.strictEqual(deleted, true);

    const profile = await UserRepository.getUserProfile(targetUser.id);
    assert.strictEqual(profile.user, undefined);
  });
});
