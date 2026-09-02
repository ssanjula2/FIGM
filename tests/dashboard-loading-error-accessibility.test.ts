import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Closure of the forensic-audit Section 18 MEDIUM finding: `LiveDashboardContent.tsx` (the
 * homepage/dashboard -- the first screen every authenticated user lands on) had a loading state
 * with no `role="status"`/`aria-live` region and an error state with no `role="alert"` or focus
 * management, unlike the pattern `tests/accessibility-regression.test.ts` already enforces on
 * `/notifications`, `/user-study`, and the auth pages. Same source-level-regression convention as
 * that file (no jsdom/testing-library dependency in this project -- a deliberate, established
 * choice).
 */

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

test('Accessibility regression: app/components/dashboard/LiveDashboardContent.tsx', async (t) => {
  const src = read('app/components/dashboard/LiveDashboardContent.tsx');

  await t.test('the loading state is announced to assistive tech (role="status" + aria-live)', () => {
    assert.match(src, /role="status"/, 'loading state must use role="status" so a screen reader is notified content is loading');
    assert.match(src, /aria-live="polite"/, 'loading state must use aria-live="polite", not an assertive interruption');
    assert.match(src, /className="sr-only"/, 'loading state must include a screen-reader-only text announcement (the skeleton blocks themselves have no readable content)');
  });

  await t.test('the error state is announced (role="alert") and focus-manageable, matching the auth-page pattern', () => {
    assert.match(src, /role="alert"/, 'error state must use role="alert" so it is announced when it appears');
    assert.match(src, /errorRef\.current\?\.focus\(\)/, 'focus must move to the error region when a new error appears');
    assert.match(src, /ref={errorRef}/, 'the alert container must be attached to errorRef so the focus call above has a real target');
  });

  await t.test('the decorative warning icon is hidden from assistive tech', () => {
    assert.match(src, /aria-hidden="true"[^>]*>⚠️/, 'the emoji icon is decorative -- it must not be announced as unlabeled content');
  });
});

test('Accessibility regression: .sr-only utility class exists and is visually hidden but accessible', () => {
  const css = read('app/globals.css');
  const match = css.match(/\.sr-only\s*\{([^}]*)\}/);
  assert.ok(match, '.sr-only class must be defined in app/globals.css');
  const body = match![1];
  assert.match(body, /position:\s*absolute/, '.sr-only must not affect layout flow');
  assert.doesNotMatch(body, /display:\s*none/, '.sr-only must NOT use display:none -- that would also hide it from screen readers, defeating the purpose');
});
