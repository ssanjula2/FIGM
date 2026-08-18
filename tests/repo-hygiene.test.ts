import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());

describe('Repository Hygiene Guard Suite', () => {
  test('.gitignore excludes the developer/audit scratch directory', () => {
    // Regression guard for audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md finding HIGH-SCRATCH: scratch/
    // has repeatedly accumulated files containing live JWT access/refresh tokens from manual test
    // sessions. This must never again be one `git add -A` away from being committed, the same
    // structural failure mode that originally leaked figm-user-db.json/.env (see SEC-01 history).
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    const lines = gitignore.split('\n').map((l) => l.trim());
    assert.ok(
      lines.includes('scratch/') || lines.includes('scratch'),
      '.gitignore must exclude scratch/ -- do not remove this entry'
    );
  });

  test('.gitignore still excludes the legacy JSON user-database file (SEC-01 regression guard)', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('figm-user-db.json'), '.gitignore must exclude figm-user-db.json');
  });

  test('.gitignore still excludes .env and its variants', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    const lines = gitignore.split('\n').map((l) => l.trim());
    assert.ok(lines.includes('.env') || lines.includes('.env*'), '.gitignore must exclude .env files');
  });
});
