import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PROD-01 regression: next.config.mjs's headers() must keep shipping a real
 * Content-Security-Policy, Strict-Transport-Security, and Permissions-Policy on every route,
 * alongside the pre-existing X-Content-Type-Options/X-Frame-Options/Referrer-Policy.
 *
 * Source-level regression guard (same established pattern as
 * tests/accessibility-regression.test.ts): this repo has no jsdom/browser test runner to make a
 * real HTTP request and inspect response headers against a running server, so this reads the real
 * config source and asserts the specific directives are still present, catching a future edit
 * silently dropping one.
 */
test('Security headers (PROD-01): next.config.mjs headers()', async (t) => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'next.config.mjs'), 'utf-8');

  await t.test('all six response headers are configured', () => {
    for (const key of [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'Permissions-Policy',
    ]) {
      assert.match(src, new RegExp(`key: '${key}'`), `${key} header must be configured`);
    }
  });

  await t.test('the CSP restricts default-src to self and blocks framing/plugins/base-uri manipulation', () => {
    assert.match(src, /default-src 'self'/);
    assert.match(src, /object-src 'none'/, 'object-src must be none (blocks Flash/plugin-based exploitation)');
    assert.match(src, /frame-ancestors 'none'/, 'frame-ancestors must be none (clickjacking defense-in-depth alongside X-Frame-Options)');
    assert.match(src, /base-uri 'self'/, 'base-uri must be self (blocks <base> tag injection redirecting relative URLs)');
    assert.match(src, /form-action 'self'/, 'form-action must be self');
  });

  await t.test('cdn.jsdelivr.net (Monaco Editor\'s real, confirmed default asset host) is scoped only to the directives that actually need it', () => {
    // Confirmed via node_modules/@monaco-editor/loader's own default config, not assumed --
    // script-src, style-src, font-src, worker-src, connect-src. It must NOT appear in default-src
    // (which would make every unscoped directive implicitly trust it too).
    assert.doesNotMatch(src, /default-src 'self' https:\/\/cdn\.jsdelivr\.net/, 'jsdelivr must not be folded into default-src');
    for (const directive of ['script-src', 'style-src', 'font-src', 'worker-src', 'connect-src']) {
      const re = new RegExp(`${directive}[^;\`]*cdn\\.jsdelivr\\.net`);
      assert.match(src, re, `${directive} must include cdn.jsdelivr.net`);
    }
  });

  await t.test('unsafe-eval and the HMR websocket allowance are dev-only, never unconditionally present', () => {
    // Both must appear only inside the isDev-conditional template literal branch, not as a bare
    // always-on directive value.
    assert.match(src, /isDev \? " 'unsafe-eval'" : ''/, "'unsafe-eval' must be gated behind isDev");
    assert.match(src, /isDev \? ' ws:\/\/localhost:\* ws:\/\/127\.0\.0\.1:\*' : ''/, 'the HMR websocket allowance must be gated behind isDev');
  });

  await t.test('HSTS uses a real max-age with includeSubDomains', () => {
    assert.match(src, /Strict-Transport-Security[\s\S]{0,40}max-age=\d{7,}/);
    assert.match(src, /includeSubDomains/);
  });
});
