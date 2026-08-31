import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * End-to-end coverage of the full Qwen fallback path through the REAL pipeline (routing -> Qwen
 * provider -> sandbox validation -> FIGM re-scan), with only the Hugging Face network boundary
 * mocked (`global.fetch` — see tests/qwen-provider.test.ts's own header for why this is a mock of
 * the real transport, not a fake one). This is the scenario architecture rule #22 of the
 * integration task describes: a rule with no deterministic fixer, routed to the AI-assisted layer,
 * where Qwen is the active provider (HF_TOKEN configured, ANTHROPIC_API_KEY deliberately left
 * unset so a pass here can only be Qwen, never an accidental Claude fallback).
 */

// FIGM-REACT-01 is "Memoize Expensive Derived Computations" (src/matrix/four-layer-meta-model.ts)
// — an expensive derived array computation (`items.sort(...)`) inside a render routine that
// should be wrapped in `React.useMemo`. It routes AI_ASSISTED (no deterministic fixer; confirmed
// by tests/claude-integration.test.ts's own routing assertion), which is exactly why it is reused
// here to exercise the Qwen fallback path end-to-end.
const reactDefect: DiagnosticReport = {
  ruleId: 'FIGM-REACT-01',
  ruleName: 'Memoize Expensive Derived Computations',
  message: 'Expensive derived array computation inside render routine should be wrapped in useMemo.',
  domain: 'PERFORMANCE',
  concern: 'INVARIANT_ALLOCATIONS',
  severity: 'HIGH',
  filePath: 'src/List.jsx',
  location: { start: { line: 2, column: 17 }, end: { line: 2, column: 44 } },
  offendingCodeSnippet: 'const sorted = items.sort((a, b) => a - b);',
  remediation: 'Wrap heavy derived data computations inside React.useMemo.',
  standardReference: 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization',
};
const reactCode = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li>{n}</li>)}</ul>;\n}`;

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

function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const original = global.fetch;
  (global as any).fetch = handler;
  return () => {
    global.fetch = original;
  };
}

function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl_test',
      created: 1700000000,
      model: 'Qwen/Qwen2.5-Coder-7B-Instruct',
      system_fingerprint: null,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

test('AIRemediationPipeline — Qwen fallback path end-to-end', async (t) => {
  await t.test('a valid Qwen patch that genuinely resolves the violation is VERIFIED, engineType AI_ASSISTED_FIX, provider QWEN', async () => {
    const fixedCode = `import { useMemo } from 'react';\nfunction List({ items }) {\n  const sorted = useMemo(() => items.sort((a, b) => a - b), [items]);\n  return <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>;\n}`;
    const restore = mockFetch(async () =>
      chatResponse(JSON.stringify({ status: 'PATCH', patch: fixedCode, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 }))
    );
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, HF_TOKEN: 'hf_test_token_not_real', ANTHROPIC_API_KEY: undefined }, () =>
        AIRemediationPipeline.remediateDefect(reactCode, reactDefect, 'REACT_JSX')
      );
      assert.equal(result.engineType, 'AI_ASSISTED_FIX');
      assert.equal(result.provider, 'QWEN');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      assert.ok(result.remediatedCode.includes('useMemo'));
      assert.ok(result.suggestedFix?.explanation.includes('QWEN'), 'the generated fix description should credit the actual provider, not a hardcoded vendor name');
    } finally {
      restore();
    }
  });

  await t.test('a Qwen patch that does NOT resolve the violation is REJECTED — original source untouched, never reported as fixed', async () => {
    // Superficially plausible but leaves the original violation (unmemoized sort) fully intact.
    const nonFix = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>;\n}`;
    const restore = mockFetch(async () => chatResponse(JSON.stringify({ status: 'PATCH', patch: nonFix, explanation: 'Added a stable key prop.', confidence: 70 })));
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, HF_TOKEN: 'hf_test_token_not_real', ANTHROPIC_API_KEY: undefined }, () =>
        AIRemediationPipeline.remediateDefect(reactCode, reactDefect, 'REACT_JSX')
      );
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.equal(result.provider, 'QWEN');
      assert.equal(result.verified, false);
      assert.equal(result.verificationStatus, 'UNRESOLVED');
      assert.equal(result.remediatedCode, reactCode, 'a rejected AI patch must never mutate the code returned to the caller');
      assert.ok(result.fallbackReason?.includes('QWEN'));
    } finally {
      restore();
    }
  });

  await t.test('a Qwen patch with a raw syntax error is REJECTED by the sandbox before ever being applied', async () => {
    const brokenPatch = `function List({ items } {\n  return <ul></ul>;\n}`; // missing closing paren — real syntax error
    const restore = mockFetch(async () => chatResponse(JSON.stringify({ status: 'PATCH', patch: brokenPatch, explanation: 'broken', confidence: 50 })));
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, HF_TOKEN: 'hf_test_token_not_real', ANTHROPIC_API_KEY: undefined }, () =>
        AIRemediationPipeline.remediateDefect(reactCode, reactDefect, 'REACT_JSX')
      );
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.equal(result.verified, false);
      assert.equal(result.remediatedCode, reactCode, 'original source must remain unchanged after a failed AI attempt');
    } finally {
      restore();
    }
  });

  await t.test('a real HTTP 402 (billing/quota exhausted) is AI_UNAVAILABLE, not UNRESOLVED, and stops after one attempt (no wasted retries)', async () => {
    let fetchCallCount = 0;
    const restore = mockFetch(async () => {
      fetchCallCount += 1;
      return new Response(JSON.stringify({ error: 'You have exceeded your monthly included credits.' }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      });
    });
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, HF_TOKEN: 'hf_test_token_not_real', ANTHROPIC_API_KEY: undefined }, () =>
        AIRemediationPipeline.remediateDefect(reactCode, reactDefect, 'REACT_JSX')
      );
      assert.equal(fetchCallCount, 1, 'a 402 is a permanent failure — the pipeline must not burn MAX_AI_ATTEMPTS retrying it');
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.equal(result.provider, 'QWEN');
      assert.equal(result.verified, false);
      // Never UNRESOLVED here: no PATCH was ever produced, so the UI must not claim "a patch was
      // generated". See AIRemediationPipelineResult.verificationStatus's doc comment.
      assert.equal(result.verificationStatus, 'AI_UNAVAILABLE');
      assert.equal(result.remediatedCode, reactCode, 'no code change when no patch was ever produced');
      assert.ok(result.fallbackReason?.includes('billing/quota exhausted'));
    } finally {
      restore();
    }
  });
});
