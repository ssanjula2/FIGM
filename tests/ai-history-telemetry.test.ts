import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB, DBUser } from '../src/auth/user-db';
import { ScanRepository } from '../src/engine/scan-repository';
import { signJWT } from '../src/auth/auth-service';
import { POST as scanPOST } from '../app/api/scan/route';

/**
 * Regression coverage for a real production gap: a genuinely successful, authenticated,
 * AI-assisted fix (production-observed: FIGM-REACT-01, engineType AI_ASSISTED_FIX, provider
 * GEMINI, verified:true) produced no AiHistory row. This file proves the fix (explicit logging on
 * the previously-silent skip branch in app/api/scan/route.ts) without touching any remediation
 * logic, AI provider routing, patch generation, or validation -- the AI network call itself is
 * mocked (same pattern as tests/deterministic-fix-routing.test.ts's case C, the exact FIGM-REACT-01
 * fixture already proven to route to AI_ASSISTED_FIX with zero deterministic fixer involved) so
 * this suite never depends on a real Gemini/Claude/Ollama call.
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

function jwtFor(user: DBUser): string {
  return signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, 0);
}

function scanRequest(body: Record<string, unknown>, token?: string, ip = '203.0.113.170'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': ip };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('http://localhost:3000/api/scan', { method: 'POST', headers, body: JSON.stringify(body) });
}

function geminiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

/** Mocks only the outbound Gemini network call -- everything else (routing, patch validation,
 *  re-scan verification, the /api/scan route handler itself) runs for real. Throws loudly on any
 *  other outbound fetch so an accidental real network dependency fails the test instead of hanging
 *  or silently succeeding. */
function mockGeminiFetch(handler: () => Promise<Response> | Response) {
  const original = global.fetch;
  let calls = 0;
  (global as any).fetch = async (url: string) => {
    if (!String(url).includes('generativelanguage.googleapis.com')) {
      throw new Error(`Unexpected non-Gemini fetch call in this test: ${url}`);
    }
    calls += 1;
    return handler();
  };
  return {
    restore: () => {
      global.fetch = original;
    },
    calls: () => calls,
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

// Exact reproduction of the production defect (FIGM-REACT-01: no deterministic fixer exists for
// this rule at all, so it routes straight to AI -- see src/ai/ai-remediation-router.ts's own doc
// comment naming FIGM-REACT-01 explicitly).
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

test('authenticated AI-assisted fix (FIGM-REACT-01, real mocked-Gemini) verified FIXED -> exactly one AiHistory row persisted', async () => {
  RepositoryFactory.resetProvider();
  const user = makeUser('ai_history_success');
  const token = jwtFor(user);

  const mock = mockGeminiFetch(() =>
    geminiChatResponse(
      JSON.stringify({ status: 'PATCH', patch: REACT01_FIXED_CODE, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 })
    )
  );
  try {
    const fixRes = await withEnv(BASE_ENV, () =>
      scanPOST(scanRequest({ code: REACT01_CODE, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: REACT01_DEFECT }, token, '203.0.113.171'))
    );
    assert.equal(fixRes.status, 200);
    const fixData = await fixRes.json();

    // The real pipeline outcome this whole test exists to reproduce -- never asserted as a given,
    // always checked against the actual response.
    assert.equal(fixData.engineType, 'AI_ASSISTED_FIX');
    assert.equal(fixData.provider, 'GEMINI');
    assert.equal(fixData.verified, true);
    assert.equal(fixData.verificationStatus, 'FIXED');
    assert.equal(mock.calls(), 1);

    const history = await ScanRepository.getAiHistoryByUserId(user.id);
    assert.equal(history.length, 1, 'a genuinely successful authenticated AI fix must persist exactly one AiHistory row');
    assert.equal(history[0].ruleId, 'FIGM-REACT-01');
    assert.equal(history[0].applied, true, 'applied must reflect the pipeline\'s real verified flag, never be assumed true just because a patch was generated');
    assert.ok(history[0].patchContent.length > 0);
    assert.equal(history[0].scanReportId, null, 'honest limitation: this endpoint has no persisted ScanReport id to link at fix-time');
  } finally {
    mock.restore();
  }
});

test('AI-assisted fix that does NOT verify (AI_UNAVAILABLE, no provider configured) persists applied=false, never fabricated true', async () => {
  RepositoryFactory.resetProvider();
  const user = makeUser('ai_history_unavailable');
  const token = jwtFor(user);

  // No AI provider configured at all -- the pipeline must report verified:false, never a
  // fabricated success, and telemetry must honestly reflect that.
  const fixRes = await withEnv(
    { OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: undefined },
    () => scanPOST(scanRequest({ code: REACT01_CODE, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: REACT01_DEFECT }, token))
  );
  assert.equal(fixRes.status, 200);
  const fixData = await fixRes.json();
  assert.equal(fixData.verified, false);

  const history = await ScanRepository.getAiHistoryByUserId(user.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].applied, false, 'must never claim a fix was applied when the pipeline never verified one');
});

test('unauthenticated fix request never persists participant telemetry, and the skip is now explicitly logged with a reason', async () => {
  RepositoryFactory.resetProvider();

  const mock = mockGeminiFetch(() =>
    geminiChatResponse(
      JSON.stringify({ status: 'PATCH', patch: REACT01_FIXED_CODE, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 })
    )
  );
  const originalWarn = console.warn;
  const warnLines: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnLines.push(args.map(String).join(' '));
  };
  try {
    // No Authorization header at all.
    const fixRes = await withEnv(BASE_ENV, () =>
      scanPOST(scanRequest({ code: REACT01_CODE, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: REACT01_DEFECT }))
    );
    assert.equal(fixRes.status, 200, 'the fix itself is never gated on authentication -- only its telemetry is');
    const fixData = await fixRes.json();
    assert.equal(fixData.verified, true, 'the fix result itself must be unaffected by the caller being unauthenticated');

    const skipLine = warnLines.find((l) => l.includes('fix-interaction telemetry skipped'));
    assert.ok(skipLine, 'the previously-silent skip branch must now log explicitly');
    assert.ok(skipLine!.includes('reason=UNAUTHORIZED'), 'the log must carry the real machine-readable reason, not a generic message');
    assert.ok(skipLine!.includes('FIGM-REACT-01'));
  } finally {
    console.warn = originalWarn;
    mock.restore();
  }
});

test('an invalid/expired token also skips telemetry with an explicit, distinct reason -- never fabricates a userId to attribute it to', async () => {
  RepositoryFactory.resetProvider();

  const mock = mockGeminiFetch(() =>
    geminiChatResponse(
      JSON.stringify({ status: 'PATCH', patch: REACT01_FIXED_CODE, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 })
    )
  );
  const originalWarn = console.warn;
  const warnLines: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnLines.push(args.map(String).join(' '));
  };
  try {
    const garbageToken = 'not.a.validtoken';
    const fixRes = await withEnv(BASE_ENV, () =>
      scanPOST(scanRequest({ code: REACT01_CODE, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: REACT01_DEFECT }, garbageToken))
    );
    assert.equal(fixRes.status, 200);

    const skipLine = warnLines.find((l) => l.includes('fix-interaction telemetry skipped'));
    assert.ok(skipLine, 'an invalid token must also produce an explicit skip log');
    assert.ok(skipLine!.includes('reason=INVALID_TOKEN'));
  } finally {
    console.warn = originalWarn;
    mock.restore();
  }
});
