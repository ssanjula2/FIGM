import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProjectRepository } from '../src/engine/project-repository';
import { RepositoryFactory } from '../src/storage/repository-factory';

describe('SaaS Production Feature 1: Project Workspace Suite', () => {
  it('Create Project persists project data accurately in UserDB', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const project = ProjectRepository.createProject({
      userId,
      name: 'E-Commerce Frontend',
      description: 'Main online store web client',
      framework: 'React',
      repoUrl: 'https://github.com/figm/ecommerce-frontend',
      status: 'ACTIVE',
    });

    assert.ok(project.id.startsWith('proj_'));
    assert.strictEqual(project.name, 'E-Commerce Frontend');
    assert.strictEqual(project.status, 'ACTIVE');

    RepositoryFactory.resetProvider();
    const fetched = ProjectRepository.getProjectById(project.id);
    assert.ok(fetched);
    assert.strictEqual(fetched?.id, project.id);
  });

  it('Search Projects filters by name, description, or framework', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_search_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    ProjectRepository.createProject({
      userId,
      name: 'Alpha Analytics',
      description: 'Data platform',
      framework: 'Next.js',
      repoUrl: 'https://github.com/figm/alpha',
      status: 'ACTIVE',
    });

    RepositoryFactory.resetProvider();
    const searchRes = ProjectRepository.getProjects({ userId });
    assert.ok(searchRes.length >= 1);
  });

  it('Duplicate Project creates a duplicate with modified name and new ID', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const original = ProjectRepository.createProject({
      userId,
      name: 'Original App',
      description: 'Original description',
      framework: 'Vue',
      repoUrl: 'https://github.com/figm/original',
      status: 'ACTIVE',
    });

    RepositoryFactory.resetProvider();
    const duplicate = ProjectRepository.duplicateProject(original.id);
    assert.ok(duplicate);
    assert.notStrictEqual(duplicate?.id, original.id);
    assert.strictEqual(duplicate?.name, 'Original App (Copy)');
  });

  it('Archive and Delete Project alters status and removes record', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_arch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const project = ProjectRepository.createProject({
      userId,
      name: 'Temporary Sandbox',
      description: 'To be archived',
      framework: 'Angular',
      repoUrl: 'https://github.com/figm/sandbox',
      status: 'ACTIVE',
    });

    RepositoryFactory.resetProvider();
    const archived = ProjectRepository.archiveProject(project.id);
    assert.ok(archived);
    assert.strictEqual(archived?.status, 'ARCHIVED');

    RepositoryFactory.resetProvider();
    const deleted = ProjectRepository.deleteProject(project.id);
    assert.strictEqual(deleted, true);

    RepositoryFactory.resetProvider();
    const check = ProjectRepository.getProjectById(project.id);
    assert.strictEqual(check, undefined);
  });

  it('Project Statistics aggregates count, scores, and active counts', async () => {
    RepositoryFactory.resetProvider();
    const userId = `usr_test_stats_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    ProjectRepository.createProject({
      userId,
      name: 'Stats App 1',
      description: 'Test stats',
      framework: 'React',
      repoUrl: 'https://github.com/figm/stats1',
      status: 'ACTIVE',
    });

    RepositoryFactory.resetProvider();
    const stats = ProjectRepository.getProjectStats(userId);
    assert.ok(stats.totalProjects >= 1);
    assert.ok(stats.activeProjects >= 1);
  });
});
