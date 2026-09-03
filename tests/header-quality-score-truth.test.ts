import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Stage 7G Section 7/22-D: the top-bar "Quality Score" badge (app/HeaderBar.tsx) previously
 * averaged every one of a user's scans with a `s.qualityScore || 90` fallback (masking a real 0%
 * score back to a fabricated 90%) and, for a brand-new account with zero real scans, fell back to
 * a hardcoded "90% (PASSED)" -- an invented badge shown to every first-time user regardless of
 * whether they had ever run a scan. Source-level regression, same convention as
 * tests/dashboard-loading-error-accessibility.test.ts (no jsdom/testing-library dependency here).
 */

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

test('Regression: app/HeaderBar.tsx top-bar quality score is real, latest-scan-only, and never fabricated', () => {
  const src = read('app/HeaderBar.tsx');

  assert.doesNotMatch(src, /qualityScore \|\| 90/, 'must not silently replace a real 0% score with a fabricated 90%');
  assert.doesNotMatch(src, /:\s*90;/, 'must not fall back to a hardcoded 90% for an account with no real scans');
  assert.match(src, /No scans yet/, 'a user with zero scans must see an honest no-data state, not a fake percentage');
  assert.match(src, /records\[0\]/, 'must derive the badge from the latest scan record, not an average across all of them');
});
