import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/** Regression coverage for the Stage 7C ENV_VARIABLES.md categorization (Section 18). */

function readEnvDoc(): string {
  return fs.readFileSync(path.join(rootDir, 'ENV_VARIABLES.md'), 'utf-8');
}

/**
 * Pulls every `VAR_NAME` code-span out of one category's actual variable list -- i.e. the first
 * sentence after the category's introductory colon (e.g. "...outside local development/test:
 * `JWT_SECRET`, `REFRESH_SECRET`, ... `NODE_ENV`.") -- not the whole prose block that follows,
 * which may mention an unrelated variable in passing (RESEARCH_ONLY's explanation references
 * NODE_ENV without placing it in that category).
 */
function varsUnderCategory(doc: string, category: string): string[] {
  const start = doc.indexOf(`**${category}**`);
  assert.ok(start >= 0, `ENV_VARIABLES.md must contain a **${category}** section`);
  const colonIdx = doc.indexOf(':', start);
  assert.ok(colonIdx >= 0, `**${category}** section must introduce its variable list with a colon`);
  const periodIdx = doc.indexOf('.', colonIdx);
  const listText = doc.slice(colonIdx, periodIdx >= 0 ? periodIdx + 1 : undefined);
  return [...listText.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]);
}

const CATEGORIES = ['REQUIRED_PRODUCTION', 'OPTIONAL_PRODUCTION', 'DEVELOPMENT_ONLY', 'RESEARCH_ONLY'];

test('ENV_VARIABLES.md declares all four Stage 7C categories', () => {
  const doc = readEnvDoc();
  for (const category of CATEGORIES) {
    assert.match(doc, new RegExp(`\\*\\*${category}\\*\\*`), `missing category: ${category}`);
  }
});

test('every variable placed in a category also has a row in the detailed Environment Variables Matrix', () => {
  const doc = readEnvDoc();
  const matrixStart = doc.indexOf('## Environment Variables Matrix');
  assert.ok(matrixStart >= 0, 'ENV_VARIABLES.md must still have the detailed matrix section');
  const matrixSection = doc.slice(matrixStart);
  const matrixVars = new Set([...matrixSection.matchAll(/^\|\s*`([A-Z][A-Z0-9_]+)`/gm)].map((m) => m[1]));

  const uncategorized: string[] = [];
  for (const category of CATEGORIES) {
    for (const v of varsUnderCategory(doc, category)) {
      if (!matrixVars.has(v)) uncategorized.push(`${v} (in ${category})`);
    }
  }
  assert.deepEqual(uncategorized, [], `variable(s) categorized but missing from the matrix: ${uncategorized.join(', ')}`);
});

test('no variable is placed in more than one of the four categories', () => {
  const doc = readEnvDoc();
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const category of CATEGORIES) {
    for (const v of varsUnderCategory(doc, category)) {
      const existing = seen.get(v);
      if (existing && existing !== category) duplicates.push(`${v} in both ${existing} and ${category}`);
      seen.set(v, category);
    }
  }
  assert.deepEqual(duplicates, [], `variable(s) double-categorized: ${duplicates.join(', ')}`);
});

test('the security-critical secrets are classified REQUIRED_PRODUCTION, not left optional', () => {
  const doc = readEnvDoc();
  const required = varsUnderCategory(doc, 'REQUIRED_PRODUCTION');
  for (const v of ['JWT_SECRET', 'REFRESH_SECRET', 'DATABASE_URL']) {
    assert.ok(required.includes(v), `${v} must be classified REQUIRED_PRODUCTION`);
  }
});
