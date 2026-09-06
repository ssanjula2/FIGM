import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

function makeRequest(path: string, token?: string): NextRequest {
  const req = new NextRequest(`https://figm-model.example.test${path}`);
  if (token) {
    req.cookies.set('figm_token', token);
  }
  return req;
}

function isRedirectToLogin(res: ReturnType<typeof middleware>, expectedRedirectParam?: string): boolean {
  if (res.status !== 307) return false;
  const location = res.headers.get('location');
  if (!location || !location.includes('/auth/login')) return false;
  if (expectedRedirectParam && !location.includes(`redirect=${encodeURIComponent(expectedRedirectParam)}`)) return false;
  return true;
}

test('Middleware public-path regression: /user-study anonymous access, admin/other pages unchanged', async (t) => {
  await t.test('unauthenticated GET /user-study is allowed through, not redirected to login', () => {
    const res = middleware(makeRequest('/user-study'));
    assert.equal(isRedirectToLogin(res), false, 'the participant study page must never redirect an anonymous visitor to login');
    assert.equal(res.status, 200);
  });

  await t.test('unauthenticated GET /admin is still redirected to /auth/login (admin protection unchanged)', () => {
    const res = middleware(makeRequest('/admin'));
    assert.ok(isRedirectToLogin(res, '/admin'), 'admin must remain protected by the page-level auth gate');
  });

  await t.test('unauthenticated GET /admin/participants (nested admin page) is still redirected to login', () => {
    const res = middleware(makeRequest('/admin/participants'));
    assert.ok(isRedirectToLogin(res, '/admin/participants'));
  });

  await t.test('unauthenticated GET /live-scan (an ordinary protected app page) is still redirected to login -- the authenticated-by-default behavior for every other page is unchanged', () => {
    const res = middleware(makeRequest('/live-scan'));
    assert.ok(isRedirectToLogin(res, '/live-scan'));
  });

  await t.test('unauthenticated GET /login remains public (pre-existing allow-list entry unaffected)', () => {
    const res = middleware(makeRequest('/login'));
    assert.equal(isRedirectToLogin(res), false);
    assert.equal(res.status, 200);
  });

  await t.test('an authenticated visitor (has figm_token) can also reach /user-study normally', () => {
    const res = middleware(makeRequest('/user-study', 'fake.session.token'));
    assert.equal(isRedirectToLogin(res), false);
    assert.equal(res.status, 200);
  });

  await t.test('API routes are untouched by this change -- /api/admin/participants is not redirected by middleware (its own route handler enforces 401, verified elsewhere)', () => {
    const res = middleware(makeRequest('/api/admin/participants'));
    assert.equal(isRedirectToLogin(res), false, 'middleware must never redirect an /api/ request -- that gate is exempted entirely by design');
  });
});
