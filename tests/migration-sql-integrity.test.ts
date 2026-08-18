import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

function listMigrationSqlFiles(): string[] {
  const entries = readdirSync(MIGRATIONS_DIR).filter((e) => statSync(join(MIGRATIONS_DIR, e)).isDirectory());
  const files: string[] = [];
  for (const dir of entries) {
    const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
    try {
      statSync(sqlPath);
      files.push(sqlPath);
    } catch {
      // directory without a migration.sql (shouldn't happen); skip
    }
  }
  return files;
}

describe('Prisma Migration SQL Integrity Guard', () => {
  test('every migration.sql starts with real SQL, never a stray Prisma CLI stdout banner', () => {
    // Regression guard for audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md finding MED-MIGRATION: the
    // baseline migration's first line was accidentally the CLI's own "Loaded Prisma config
    // from prisma.config.ts." stdout banner (captured by a naive `prisma migrate diff ... > file`
    // redirect in this Prisma version, which writes that banner to stdout rather than stderr) --
    // invisible against an already-baselined database (whose migration body is never re-executed),
    // but would break `prisma migrate deploy` with a syntax error on line 1 against any fresh
    // database (new dev machine, CI, disaster recovery).
    const files = listMigrationSqlFiles();
    assert.ok(files.length > 0, 'expected at least one migration.sql under prisma/migrations/');
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const firstNonEmptyLine = content.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
      assert.ok(
        !/^Loaded Prisma config/i.test(firstNonEmptyLine.trim()),
        `${file}: first non-empty line must not be the Prisma CLI's own stdout banner text, got: ${JSON.stringify(firstNonEmptyLine)}`
      );
      assert.ok(
        firstNonEmptyLine.trim().startsWith('--') || /^(CREATE|ALTER|DROP|INSERT|BEGIN|COMMENT)\b/i.test(firstNonEmptyLine.trim()),
        `${file}: first non-empty line should be a SQL comment or a real DDL/DML statement, got: ${JSON.stringify(firstNonEmptyLine)}`
      );
    }
  });

  test('every migration.sql has balanced parentheses (cheap structural well-formedness check)', () => {
    const files = listMigrationSqlFiles();
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      let depth = 0;
      for (const ch of content) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
      assert.equal(depth, 0, `${file}: unbalanced parentheses (depth ${depth}) suggests truncated/corrupted SQL`);
    }
  });
});
