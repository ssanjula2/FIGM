import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as scanPOST } from '../app/api/scan/route';

/**
 * Regression coverage for Phase 1 (Security Close-out) — audit finding "Unauthenticated AI-cost
 * path": app/api/scan/route.ts's fix-action branch (action='fix-figm-rule'/'fix-code-error'/
 * 'ai-fix') calls out to a real AI provider on arbitrary, including fully anonymous, input —
 * BEFORE authenticateUser is ever called in that branch — bounded only by a per-IP rate limit
 * (15/min). A caller that rotates its IP (trivial via a proxy/VPN pool, or simply forging
 * X-Forwarded-For — see rate-limiter.ts's getClientIp doc comment on why only the LAST hop is
 * trusted) defeated that limit entirely while keeping every other request characteristic
 * identical. This suite proves the ADDED per-client-fingerprint dimension (getClientFingerprint —
 * hashed User-Agent/Accept-Language/Accept-Encoding, deliberately IP-independent) catches exactly
 * that case, without over-throttling either a normal fix-action user or the plain scan path.
 */

function fixRequest(ip: string, userAgent: string): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': userAgent,
    },
    // No `code`/`defect` — irrelevant here: the rate-limit gate runs before either is validated,
    // so a request that gets PAST both rate limits simply falls through to the existing 400
    // ("Code string is required"), which is how this suite distinguishes "not rate-limited yet"
    // from "rate-limited" (429) without needing a real AI provider configured.
    body: JSON.stringify({ action: 'fix-figm-rule' }),
  });
}

function scanRequest(ip: string, userAgent: string): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': userAgent,
    },
    body: JSON.stringify({ code: 'const x = 1;', fileName: 'x.ts' }),
  });
}

test('scan fix-action per-fingerprint rate limiting', async (t) => {
  await t.test('a caller that rotates its IP on every fix-action request, but keeps the same User-Agent, is still caught by the fingerprint-keyed limit', async () => {
    const userAgent = `figm-fingerprint-test-ua-${Date.now()}`;
    let sawRateLimit = false;
    let sawNonRateLimited = false;

    for (let i = 0; i < 20; i++) {
      // A fresh, never-before-seen IP on every single request — defeats getClientIp's own
      // 15/min limit entirely (each IP is seen at most once), isolating this test to the
      // fingerprint dimension alone.
      const rotatingIp = `10.77.${Math.floor(Math.random() * 255)}.${i}`;
      const res = await scanPOST(fixRequest(rotatingIp, userAgent));
      if (res.status === 429) {
        sawRateLimit = true;
        assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
        break;
      }
      if (res.status === 400) sawNonRateLimited = true; // "Code string is required" — got past both rate limits
    }

    assert.ok(sawNonRateLimited, 'at least the first few requests under the limit must get past the rate-limit gate (reaching the 400 for missing code)');
    assert.ok(sawRateLimit, 'a fixed User-Agent across 20 IP-rotated fix-action requests must eventually trip the per-fingerprint limit (15/min), even though no single IP was ever reused');
  });

  await t.test('two DIFFERENT fingerprints sharing the same rotating-IP pattern are tracked independently', async () => {
    const userAgentA = `figm-fingerprint-test-ua-A-${Date.now()}`;
    const userAgentB = `figm-fingerprint-test-ua-B-${Date.now()}`;

    // Exhaust fingerprint A's budget.
    let aWasLimited = false;
    for (let i = 0; i < 20; i++) {
      const res = await scanPOST(fixRequest(`10.78.${Math.floor(Math.random() * 255)}.${i}`, userAgentA));
      if (res.status === 429) {
        aWasLimited = true;
        break;
      }
    }
    assert.ok(aWasLimited, 'fixture assumption: fingerprint A must have been rate-limited by the loop above');

    // Fingerprint B (different User-Agent, also IP-rotated) must not inherit A's exhausted budget.
    const resB = await scanPOST(fixRequest(`10.78.${Math.floor(Math.random() * 255)}.200`, userAgentB));
    assert.notEqual(resB.status, 429, 'a genuinely different fingerprint must not be blocked by another fingerprint\'s exhausted limit');
  });

  await t.test('the plain (non-fix) scan path is unaffected by the fingerprint check even under IP rotation', async () => {
    const userAgent = `figm-fingerprint-test-ua-scan-${Date.now()}`;
    let sawRateLimit = false;
    let sawSuccess = false;

    // The scan path's own per-IP limit is 60/min and each IP here is used only once, so this
    // loop should never legitimately trip ANY rate limit -- proving the new fingerprint gate
    // (fix-action only) was not accidentally applied to the plain scan path too.
    for (let i = 0; i < 15; i++) {
      const res = await scanPOST(scanRequest(`10.79.${Math.floor(Math.random() * 255)}.${i}`, userAgent));
      if (res.status === 429) sawRateLimit = true;
      if (res.status === 200) sawSuccess = true;
    }

    assert.equal(sawRateLimit, false, 'the plain scan path must never be throttled by the fix-action-only fingerprint gate');
    assert.ok(sawSuccess, 'plain scans of trivial, valid code must succeed normally');
  });
});
