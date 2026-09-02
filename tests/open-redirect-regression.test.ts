import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeRedirect } from '../src/utils/safe-redirect';

/**
 * Regression coverage for the login page's post-login `?redirect=` validation (Phase 13 closure):
 * a bare `startsWith('/')` check wrongly admits protocol-relative URLs like `//evil.com`, which
 * browsers resolve as an absolute cross-origin URL, not a same-origin path.
 */

test('isSafeRedirect rejects protocol-relative and absolute redirect targets', () => {
  assert.equal(isSafeRedirect('//evil.com'), false, 'protocol-relative URL must be rejected');
  assert.equal(isSafeRedirect('/\\evil.com'), false, 'backslash variant must be rejected');
  assert.equal(isSafeRedirect('https://evil.com'), false, 'absolute URL must be rejected');
  assert.equal(isSafeRedirect('http://evil.com'), false, 'absolute URL must be rejected');
  assert.equal(isSafeRedirect('javascript:alert(1)'), false, 'protocol injection must be rejected');
});

test('isSafeRedirect rejects empty, null, and non-rooted targets', () => {
  assert.equal(isSafeRedirect(null), false);
  assert.equal(isSafeRedirect(''), false);
  assert.equal(isSafeRedirect('dashboard'), false, 'must start with a single /');
});

test('isSafeRedirect accepts genuine same-origin relative paths', () => {
  assert.equal(isSafeRedirect('/'), true);
  assert.equal(isSafeRedirect('/dashboard'), true);
  assert.equal(isSafeRedirect('/projects/123?tab=findings'), true);
});
