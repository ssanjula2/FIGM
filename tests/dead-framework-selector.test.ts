import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for Phase 17 closure: HeaderBar.tsx rendered a "Framework filter" <select>
 * (Next.js/React/Angular) backed by local `framework` state that was set on change but never read
 * anywhere else in the file -- it filtered nothing, updated no global state, and had no effect on
 * search results or scan history. A misleading control that looks interactive but does nothing.
 * Removed rather than wired up (wiring it would require deciding what it should filter, a design
 * decision out of scope for a defect fix).
 */

test('HeaderBar.tsx no longer contains the dead, unwired framework selector', () => {
  const content = fs.readFileSync(path.join(rootDir, 'app/HeaderBar.tsx'), 'utf-8');
  assert.doesNotMatch(content, /Framework filter/i, 'the dead framework selector must not be reintroduced without being wired to real functionality');
  assert.doesNotMatch(content, /const \[framework, setFramework\]/);
});
