import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Pipeline-level coverage for the Claude → Gemini automatic fallback (src/ai/ai-remediation-
 * pipeline.ts's retry loop + src/ai/ai-provider-selector.ts's getFallbackProvider). Exercises the
 * REAL AIRemediationPipeline.remediateDefect end-to-end (routing → provider(s) → sandbox → compile
 * → FIGM re-scan → verification), with only the network boundary (`global.fetch`, which BOTH the
 * @anthropic-ai/sdk (Claude) and the @google/genai SDK (Gemini) call directly — see
 * tests/claude-client.test.ts's and tests/gemini-provider.test.ts's own header comments for how
 * this was confirmed by reading each SDK's source) mocked, discriminated by request URL so a single
 * test can script both providers' responses independently.
 *
 * Distinguishes, exactly as src/ai/ai-provider-selector.ts's own doc comment requires: a provider-
 * AVAILABILITY failure (auth/quota/timeout — triggers a fallback switch) from a real code-quality
 * rejection (PATCH_SCOPE / an unresolved rescan — stays on the SAME provider and uses the existing
 * retry-feedback mechanism, never blamed on "the provider").
 *
 * NOTE: the Anthropic SDK retries 429/5xx/timeouts internally (maxRetries=2, i.e. up to 3 physical
 * fetch calls per single AIRemediationPipeline attempt) unless the mocked response carries the
 * `x-should-retry: false` header — this file uses that header on the Claude 429/quota fixtures so
 * "the pipeline tried Claude exactly once before falling back" stays true at the pipeline level
 * even though the transport below it could otherwise retry on its own. The one exception is the
 * timeout scenario, where there is no response object to attach a header to, so the SDK's own
 * internal retries genuinely happen — that test asserts 3 physical Claude calls, not 1, for that
 * reason (kept fast via a very short ANTHROPIC_TIMEOUT_MS).
 */

// FIGM-REACT-01 ("Memoize Expensive Derived Computations") on a realistic, larger fixture with
// genuine unrelated content — large enough (26 lines) for PATCH_SCOPE's ratio check to be
// meaningful.
const scopeFixtureLines = [
  `import React from 'react';`,
  ``,
  `function Header({ title }) {`,
  `  return <h1>{title}</h1>;`,
  `}`,
  ``,
  `function Footer() {`,
  `  return <footer>FIGM</footer>;`,
  `}`,
  ``,
  `function List({ items }) {`,
  `  const sorted = items.sort((a, b) => a - b);`,
  `  return (`,
  `    <div>`,
  `      <Header title="Items" />`,
  `      <ul>`,
  `        {sorted.map((n) => (`,
  `          <li key={n}>{n}</li>`,
  `        ))}`,
  `      </ul>`,
  `      <Footer />`,
  `    </div>`,
  `  );`,
  `}`,
  ``,
  `export default List;`,
];
const scopeFixtureCode = scopeFixtureLines.join('\n'); // 26 lines
const scopeFixtureDefect: DiagnosticReport = {
  ruleId: 'FIGM-REACT-01',
  ruleName: 'Memoize Expensive Derived Computations',
  message: 'Expensive derived array computation inside render routine should be wrapped in useMemo.',
  domain: 'PERFORMANCE',
  concern: 'INVARIANT_ALLOCATIONS',
  severity: 'HIGH',
  filePath: 'src/BigList.jsx',
  location: { start: { line: 12, column: 17 }, end: { line: 12, column: 44 } },
  offendingCodeSnippet: 'const sorted = items.sort((a, b) => a - b);',
  remediation: 'Wrap heavy derived data computations inside React.useMemo.',
  standardReference: 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization',
};
const minimalFixLines = [...scopeFixtureLines];
minimalFixLines[0] = `import React, { useMemo } from 'react';`;
minimalFixLines[11] = `  const sorted = useMemo(() => items.sort((a, b) => a - b), [items]);`;
const minimalFixCode = minimalFixLines.join('\n');
// Correct fix wrapped in a 40-line unrelated padding rewrite — reliably fails PATCH_SCOPE (>60%).
const oversizedFixLines = [minimalFixLines[0], ...Array.from({ length: 40 }, (_, i) => `// unrelated rewritten padding line ${i}`), ...minimalFixLines.slice(1)];
const oversizedFixCode = oversizedFixLines.join('\n');
// Compiles cleanly but does not remove the target violation.
const stillViolatingLines = [...scopeFixtureLines];
stillViolatingLines[3] = `  return <h1 className="renamed">{title}</h1>;`; // an unrelated, harmless edit
const stillViolatingCode = stillViolatingLines.join('\n');
// A real syntax error.
const brokenSyntaxCode = scopeFixtureCode.replace('function List({ items }) {', 'function List({ items } {');

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
  ANTHROPIC_API_KEY: 'sk-ant-test-key-not-real',
  GEMINI_API_KEY: 'gm_test_key_not_real',
};

/** Mirrors the real Claude /v1/messages response shape carrying exactly one forced tool_use block
 *  for the submit_remediation tool — see claude-client.server.ts's SUBMIT_REMEDIATION_TOOL. */
function claudeChatResponse(input: unknown): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [{ type: 'tool_use', id: 'toolu_test', name: 'submit_remediation', input }],
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
/** `x-should-retry: false` stops the Anthropic SDK's own internal retry loop (see this file's
 *  header comment) so a single mocked HTTP failure maps to exactly one physical fetch call. */
function claudeErrorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-should-retry': 'false' } });
}
function geminiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
function geminiErrorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type ProviderHandler = (init: RequestInit, callNumber: number) => Promise<Response> | Response;

/** Discriminates by URL — the Gemini REST endpoint is generativelanguage.googleapis.com; anything
 *  else in these tests is the Anthropic (Claude) endpoint. Tracks independent call counters for
 *  each so tests can assert exactly how many physical fetch calls each provider actually received. */
function mockDualFetch(claudeHandler?: ProviderHandler, geminiHandler?: ProviderHandler) {
  const original = global.fetch;
  let claudeCalls = 0;
  let geminiCalls = 0;
  (global as any).fetch = async (url: string, init: RequestInit) => {
    const isGemini = String(url).includes('generativelanguage.googleapis.com');
    if (isGemini) {
      geminiCalls += 1;
      if (!geminiHandler) throw new Error(`Unexpected Gemini call (#${geminiCalls}) in this test — no geminiHandler configured`);
      return geminiHandler(init, geminiCalls);
    }
    claudeCalls += 1;
    if (!claudeHandler) throw new Error(`Unexpected Claude call (#${claudeCalls}) in this test — no claudeHandler configured`);
    return claudeHandler(init, claudeCalls);
  };
  return {
    restore: () => {
      global.fetch = original;
    },
    counts: () => ({ claude: claudeCalls, gemini: geminiCalls }),
  };
}

test('AI provider fallback — Claude primary, Gemini automatic fallback', async (t) => {
  await t.test('A: Claude succeeds on the first attempt — Gemini is never called', async () => {
    const mock = mockDualFetch(async () => claudeChatResponse({ status: 'PATCH', patch: minimalFixCode, explanation: 'Wrapped in useMemo.', confidence: 95 }));
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.provider, 'CLAUDE');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      const counts = mock.counts();
      assert.equal(counts.claude, 1);
      assert.equal(counts.gemini, 0, 'Gemini must never be called when Claude succeeds');
    } finally {
      mock.restore();
    }
  });

  await t.test('B/G/L: Claude auth failure → automatic Gemini fallback → Gemini produces a genuinely minimal patch → sandbox PASS, compile PASS, FIGM rescan confirms the violation absent → FIXED (same pipeline, not a separate one)', async () => {
    const mock = mockDualFetch(
      async () => claudeErrorResponse(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
      async () => geminiChatResponse(JSON.stringify({ status: 'PATCH', patch: minimalFixCode, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 }))
    );
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.provider, 'GEMINI', 'the FINAL result must credit whichever provider actually produced the accepted patch');
      assert.equal(result.engineType, 'AI_ASSISTED_FIX');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      assert.equal(result.remediatedCode, minimalFixCode);
      const counts = mock.counts();
      assert.equal(counts.claude, 1, 'Claude must be tried exactly once before falling back — never burning its whole retry budget on a permanent auth failure');
      assert.equal(counts.gemini, 1, 'Gemini succeeded on its first attempt');
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes('sk-ant-test-key-not-real'), false, 'ANTHROPIC_API_KEY must never appear in the result');
      assert.equal(serialized.includes('gm_test_key_not_real'), false, 'GEMINI_API_KEY must never appear in the result');
    } finally {
      mock.restore();
    }
  });

  await t.test('C: Claude quota-exhausted 429 (server-flagged non-retryable) with Gemini configured → falls back immediately rather than exhausting Claude retries', async () => {
    const mock = mockDualFetch(
      async () => claudeErrorResponse(429, { type: 'error', error: { type: 'rate_limit_error', message: 'quota exhausted' } }),
      async () => geminiChatResponse(JSON.stringify({ status: 'PATCH', patch: minimalFixCode, explanation: 'Wrapped in useMemo.', confidence: 90 }))
    );
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verificationStatus, 'FIXED');
      const counts = mock.counts();
      assert.equal(counts.claude, 1, 'a rate-limit failure with a fallback configured must not burn further Claude attempts');
      assert.equal(counts.gemini, 1);
    } finally {
      mock.restore();
    }
  });

  await t.test('D: Claude request timeout → Gemini fallback (Claude retries internally up to its own maxRetries before this pipeline attempt reports AI_UNAVAILABLE)', async () => {
    const mock = mockDualFetch(
      (init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal | undefined;
          signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      async () => geminiChatResponse(JSON.stringify({ status: 'PATCH', patch: minimalFixCode, explanation: 'Wrapped in useMemo.', confidence: 90 }))
    );
    try {
      const result = await withEnv({ ...BASE_ENV, ANTHROPIC_TIMEOUT_MS: '50' }, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verificationStatus, 'FIXED');
      const counts = mock.counts();
      assert.equal(counts.claude, 3, 'the Anthropic SDK retries a timed-out request internally (maxRetries=2) before this single pipeline attempt reports AI_UNAVAILABLE');
      assert.equal(counts.gemini, 1);
    } finally {
      mock.restore();
    }
  });

  await t.test('E: Claude malformed/unparseable tool input — existing same-provider retry policy is preserved, Gemini is NEVER called (this is a model-quality issue, not a provider-availability one)', async () => {
    // No tool_use block at all — claude-client.server.ts maps this to AI_UNAVAILABLE with a
    // reason that does not match isPermanentFailure/isRateLimitOrTimeout, so it retries the SAME
    // provider, exactly like a Gemini/Claude malformed-JSON response always has.
    const mock = mockDualFetch(async () =>
      new Response(
        JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text: 'no tool call here' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.equal(result.verificationStatus, 'AI_UNAVAILABLE', 'no usable patch was EVER produced by either provider');
      assert.equal(result.remediatedCode, scopeFixtureCode);
      const counts = mock.counts();
      assert.equal(counts.claude, 3, 'a missing tool_use block is retried against the SAME provider up to the existing budget — unchanged behavior');
      assert.equal(counts.gemini, 0, 'Gemini must never be called for a model-quality issue, only a provider-availability one');
    } finally {
      mock.restore();
    }
  });

  await t.test('H/I: Claude auth failure → Gemini returns an oversized patch first (REJECTED at PATCH_SCOPE, never bypassed) → Gemini retries with a genuinely minimal patch (ACCEPTED) — all within the existing 3-attempt total budget', async () => {
    let geminiCallCount = 0;
    const mock = mockDualFetch(
      async () => claudeErrorResponse(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
      async () => {
        geminiCallCount += 1;
        const patch = geminiCallCount === 1 ? oversizedFixCode : minimalFixCode;
        return geminiChatResponse(JSON.stringify({ status: 'PATCH', patch, explanation: geminiCallCount === 1 ? 'Rewrote the file and memoized.' : 'Wrapped in useMemo; nothing else changed.', confidence: geminiCallCount === 1 ? 60 : 95 }));
      }
    );
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verificationStatus, 'FIXED');
      assert.equal(result.remediatedCode, minimalFixCode, 'the accepted patch must be the minimal one, never the earlier oversized rewrite');
      const counts = mock.counts();
      assert.equal(counts.claude, 1, 'attempt 1: Claude auth failure');
      assert.equal(counts.gemini, 2, 'attempt 2: Gemini oversized (rejected), attempt 3: Gemini minimal (accepted) — exactly fills the remaining budget');
    } finally {
      mock.restore();
    }
  });

  await t.test('J/K: Claude auth failure → Gemini never produces a valid fix (attempt 2: real syntax error rejected before compile/rescan; attempt 3: compiles but the target violation remains) → sandbox/rescan reject both, final result is never FIXED, and the original code is returned completely unmodified', async () => {
    let geminiCallCount = 0;
    const mock = mockDualFetch(
      async () => claudeErrorResponse(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
      async () => {
        geminiCallCount += 1;
        const patch = geminiCallCount === 1 ? brokenSyntaxCode : stillViolatingCode;
        return geminiChatResponse(JSON.stringify({ status: 'PATCH', patch, explanation: 'attempt', confidence: 70 }));
      }
    );
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.notEqual(result.verificationStatus, 'FIXED');
      assert.equal(result.remediatedCode, scopeFixtureCode, 'neither a syntactically-broken patch nor one that leaves the violation in place may ever be applied');
      const counts = mock.counts();
      assert.equal(counts.claude, 1);
      assert.equal(counts.gemini, 2);
    } finally {
      mock.restore();
    }
  });

  await t.test('M/N: Claude auth failure followed by Gemini ALSO unavailable (quota exhausted) → final result AI_UNAVAILABLE, no code modification, and neither provider had its remaining retry budget wasted', async () => {
    const mock = mockDualFetch(
      async () => claudeErrorResponse(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
      async () => geminiErrorResponse(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota exhausted' } })
    );
    try {
      const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.equal(result.verified, false);
      assert.equal(result.verificationStatus, 'AI_UNAVAILABLE', 'no patch was ever produced by either provider');
      assert.equal(result.remediatedCode, scopeFixtureCode, 'no code modification when both providers are unavailable');
      const counts = mock.counts();
      assert.equal(counts.claude, 1, 'Claude auth failure is permanent — exactly one attempt, never 3');
      assert.equal(counts.gemini, 1, 'Gemini also unavailable — exactly one attempt, never a further (nonexistent) fallback loop');
    } finally {
      mock.restore();
    }
  });

  await t.test('explicit AI_PRIMARY_PROVIDER=GEMINI skips Claude entirely — Gemini serves the request directly as primary, not as a fallback', async () => {
    const mock = mockDualFetch(
      async () => {
        throw new Error('Claude must never be called when AI_PRIMARY_PROVIDER=GEMINI');
      },
      async () => geminiChatResponse(JSON.stringify({ status: 'PATCH', patch: minimalFixCode, explanation: 'Wrapped in useMemo.', confidence: 93 }))
    );
    try {
      const result = await withEnv({ ...BASE_ENV, AI_PRIMARY_PROVIDER: 'GEMINI' }, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, scopeFixtureDefect, 'REACT_JSX'));
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verificationStatus, 'FIXED');
      const counts = mock.counts();
      assert.equal(counts.claude, 0);
      assert.equal(counts.gemini, 1);
    } finally {
      mock.restore();
    }
  });
});
