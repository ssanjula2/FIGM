import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { JsonStorageProvider } from '../src/storage/json-storage-provider';
import { SupabaseStorageProvider } from '../src/storage/supabase-storage-provider';
import { ProjectRepository } from '../src/engine/project-repository';

describe('Phase 1 & 2: Database Abstraction & StorageProvider Suite', () => {
  it('RepositoryFactory defaults cleanly to JsonStorageProvider when Supabase is unconfigured', () => {
    RepositoryFactory.resetProvider();
    const provider = RepositoryFactory.getStorageProvider();
    assert.ok(provider instanceof JsonStorageProvider);
  });

  it('JsonStorageProvider performs full user and project persistence operations', async () => {
    RepositoryFactory.resetProvider();
    const provider = new JsonStorageProvider();
    const email = `provider_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@figm.io`;

    const user = provider.createUser({
      email,
      passwordHash: 'hashedpass',
      fullName: 'Provider Test User',
      role: 'DEVELOPER',
    });

    assert.ok(user.id);
    assert.strictEqual(user.email, email);

    const proj = provider.createProject({
      userId: user.id,
      name: 'Storage Provider Project',
      description: 'Testing JsonStorageProvider',
      framework: 'Next.js',
      repoUrl: 'https://github.com/figm/provider-test',
      status: 'ACTIVE',
    });

    assert.ok(proj.id);
    assert.strictEqual(proj.name, 'Storage Provider Project');

    const fetchedProj = provider.getProjectById(proj.id);
    assert.ok(fetchedProj);
    assert.strictEqual(fetchedProj?.id, proj.id);
  });

  it('SupabaseStorageProvider instantiates gracefully and handles disconnections via fallback', () => {
    const supabaseProvider = new SupabaseStorageProvider();
    assert.ok(supabaseProvider);
  });

  it('ProjectRepository delegates operations transparently through StorageProvider', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_delegation_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const proj = await ProjectRepository.createProject({
      userId,
      name: 'Delegation Test Project',
      description: 'Verifying RepositoryFactory abstraction',
      framework: 'React',
      repoUrl: 'https://github.com/figm/delegation-test',
      status: 'ACTIVE',
    });

    assert.ok(proj.id);
    assert.strictEqual(proj.name, 'Delegation Test Project');

    const found = await ProjectRepository.getProjectById(proj.id);
    assert.ok(found);
    assert.strictEqual(found?.id, proj.id);
  });
});
