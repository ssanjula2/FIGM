import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB, DBUser } from '../src/auth/user-db';
import { ScanRepository } from '../src/engine/scan-repository';
import { signJWT, signRefreshToken } from '../src/auth/auth-service';
import { POST as scanPOST } from '../app/api/scan/route';
import { POST as refreshPOST } from '../app/api/auth/refresh/route';

/**
 * End-to-end, server-side proof of the real fix for the production incident: an authenticated
 * AI-assisted fix (FIGM-REACT-01, provider GEMINI, verified:true) produced no AiHistory row
 * because the access token had expired and nothing ever refreshed it (see
 * src/auth/session-client.ts's doc comment, and app/live-scan/page.tsx's applyFix, which now
 * routes its fix request through sessionClient.authFetch instead of a plain fetch).
 *
 * This file proves the SERVER-side half of that fix directly against the real route handlers
 * (no browser needed): given an already-expired access token, a real call to the existing
 * POST /api/auth/refresh (using the existing figm_refresh_token flow, unmodified) issues a fresh
 * access token, and a fix request made with that fresh token succeeds and persists exactly one
 * real AiHistory row -- proving requirement 9 ("authenticated AI Fix after refresh can persist
 * AiHistory telemetry") without touching AI provider routing, patch generation, validation,
 * re-scan behavior, or the AiHistory write path itself (all already covered by
 * tests/ai-history-telemetry.test.ts and left untouched here).
 */

let userCounter = 0;
function makeUser(labelPrefix: string): DBUser {
  userCounter += 1;
  return UserDB.createUser({
    email: `${labelPrefix}_${Date.now()}_${userCounter}_${Math.random().toString(36).slice(2, 6)}@figm.io`,
    passwordHash: 'unused-in-tests',
    fullName: `${labelPrefix} Test User`,
    role: 'DEVELOPER',
  });
}

function scanRequest(body: Record<string, unknown>, token?: string, ip = '203.0.113.180'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': ip };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('http://localhost:3000/api/scan', { method: 'POST', headers, body: JSON.stringify(body) });
}

function refreshRequest(refreshToken: string, ip = '203.0.113.181'): Request {
  return new Request('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ refreshToken }),
  });
}

function geminiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

function mockGeminiFetch(handler: () => Promise<Response> | Response) {
  const original = global.fetch;
  (global as any).fetch = async (url: string) => {
    if (!String(url).includes('generativelanguage.googleapis.com')) {
      throw new Error(`Unexpected non-Gemini fetch call in this test: ${url}`);
    }
    return handler();
  };
  return {
    restore: () => {
      global.fetch = original;
    },
  };
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const originals: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) originals[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const BASE_ENV = {
  OLLAMA_BASE_URL: undefined,
  OLLAMA_MODEL: undefined,
  AI_PRIMARY_PROVIDER: undefined,
  AI_FALLBACK_PROVIDER: undefined,
  ANTHROPIC_API_KEY: undefined,
  GEMINI_API_KEY: 'gm_test_key_not_real',
};

// Same real, no-deterministic-fixer fixture used throughout this investigation (see
// src/ai/ai-remediation-router.ts's own doc comment naming FIGM-REACT-01 explicitly).
const REACT01_CODE = [
  `import React from 'react';`,
  ``,
  `function List({ items }) {`,
  `  const sorted = items.sort((a, b) => a - b);`,
  `  return <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>;`,
  `}`,
  ``,
  `export default List;`,
].join('\n');

const REACT01_DEFECT = {
  ruleId: 'FIGM-REACT-01',
  ruleName: 'Memoize Expensive Derived Computations',
  message: 'Expensive derived array computation inside render routine should be wrapped in useMemo.',
  domain: 'PERFORMANCE',
  concern: 'INVARIANT_ALLOCATIONS',
  severity: 'HIGH',
  filePath: 'src/List.jsx',
  location: { start: { line: 4, column: 17 }, end: { line: 4, column: 44 } },
  offendingCodeSnippet: 'const sorted = items.sort((a, b) => a - b);',
  remediation: 'Wrap heavy derived data computations inside React.useMemo.',
  standardReference: 'ISO/IEC 25010',
};

const REACT01_FIXED_CODE = REACT01_CODE
  .replace(`import React from 'react';`, `import React, { useMemo } from 'react';`)
  .replace('const sorted = items.sort((a, b) => a - b);', 'const sorted = useMemo(() => items.sort((a, b) => a - b), [items]);');

test('expired access token -> real POST /api/auth/refresh issues a fresh one -> retried fix succeeds and persists exactly one AiHistory row', async () => {
  RepositoryFactory.resetProvider();
  const user = makeUser('session_refresh_ai_history');

  // Mirrors what a real login does: an issued, DB-persisted refresh token this exact user can
  // later redeem -- never fabricated, exercised through the real refresh route below.
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, 604800);
  await RepositoryFactory.getStorageProvider().updateUser(user.id, { refreshToken });

  // A real, already-expired access token -- exactly the production scenario (1-hour lifetime,
  // nothing ever refreshed it). expiresInSeconds is negative so `exp` is already in the past.
  const expiredAccessToken = signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, 0, -10);

  const mock = mockGeminiFetch(() =>
    geminiChatResponse(
      JSON.stringify({ status: 'PATCH', patch: REACT01_FIXED_CODE, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 })
    )
  );
  try {
    // Step 1 -- reproduces the bug: the expired token means telemetry is skipped, even though the
    // fix itself still succeeds (matches the exact production symptom).
    const staleFixRes = await withEnv(BASE_ENV, () =>
      scanPOST(scanRequest({ code: REACT01_CODE, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: REACT01_DEFECT }, expiredAccessToken))
    );
    assert.equal(staleFixRes.status, 200, 'the fix itself is never gated on authentication');
    const staleFixData = await staleFixRes.json();
    assert.equal(staleFixData.verified, true);
    assert.equal((await ScanRepository.getAiHistoryByUserId(user.id)).length, 0, 'no telemetry yet -- the access token used above was already expired');

    // Step 2 -- the actual fix: a real call to the existing, unmodified refresh route.
    const refreshRes = await refreshPOST(refreshRequest(refreshToken));
    assert.equal(refreshRes.status, 200);
    const refreshData = await refreshRes.json();
    assert.ok(typeof refreshData.accessToken === 'string' && refreshData.accessToken.length > 0);

    // Step 3 -- retry the SAME fix request, now with the freshly-issued access token (exactly what
    // sessionClient.authFetch does client-side: refresh once, then retry the original request).
    const retriedFixRes = await withEnv(BASE_ENV, () =>
      scanPOST(scanRequest({ code: REACT01_CODE, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: REACT01_DEFECT }, refreshData.accessToken))
    );
    assert.equal(retriedFixRes.status, 200);
    const retriedFixData = await retriedFixRes.json();
    assert.equal(retriedFixData.engineType, 'AI_ASSISTED_FIX');
    assert.equal(retriedFixData.provider, 'GEMINI');
    assert.equal(retriedFixData.verified, true);
    assert.equal(retriedFixData.verificationStatus, 'FIXED');

    const history = await ScanRepository.getAiHistoryByUserId(user.id);
    assert.equal(history.length, 1, 'the retried, now-authenticated fix must persist exactly one AiHistory row');
    assert.equal(history[0].ruleId, 'FIGM-REACT-01');
    assert.equal(history[0].applied, true, 'applied must reflect the real verified flag');
  } finally {
    mock.restore();
  }
});
