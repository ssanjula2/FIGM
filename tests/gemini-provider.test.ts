import test from 'node:test';
import assert from 'node:assert/strict';
import { GeminiClient } from '../src/ai/providers/gemini-provider.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Unit coverage for src/ai/providers/gemini-provider.ts — the Gemini (Google GenAI SDK)
 * integration boundary, the automatic fallback target when Claude becomes unavailable (see
 * tests/ai-provider-fallback.test.ts for the pipeline-level Claude→Gemini switch itself; this file
 * only covers the Gemini provider boundary in isolation, mirroring tests/claude-client.test.ts's
 * own structure and mocking approach for the sibling provider).
 *
 * Mocks `global.fetch` (confirmed by reading node_modules/@google/genai/dist/node/index.mjs: the
 * SDK's own `apiCall` calls the ambient global `fetch(url, ...)` directly, not an injected client —
 * the same transport-layer mocking approach already used for Claude/Ollama). The response body shape
 * mocked below (`candidates[0].content.parts[0].text`) is the SDK's own real REST response shape
 * (confirmed by reading `GenerateContentResponse.prototype.get text()` in the same file), not
 * invented.
 *
 * Real end-to-end coverage against the live Gemini API (gated on GEMINI_API_KEY actually being
 * configured) lives in tests/gemini-integration.test.ts, run via `npm run test:gemini`.
 */

function makeDefect(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    ruleId: 'FIGM-REACT-04',
    ruleName: 'Unmemoized Callback Prop',
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    severity: 'MEDIUM',
    filePath: 'component.tsx',
    location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
    offendingCodeSnippet: '<Child onClick={() => doThing()} />',
    message: 'n/a',
    remediation: 'Wrap in useCallback.',
    standardReference: 'n/a',
    ...overrides,
  } as DiagnosticReport;
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

function mockFetchOnce(handler: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const original = global.fetch;
  (global as any).fetch = handler;
  return () => {
    global.fetch = original;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Simulates a real Gemini generateContent REST response — the exact shape
 *  GenerateContentResponse.text reads (candidates[0].content.parts[].text). */
function geminiResponse(content: string): Response {
  return jsonResponse({
    candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }],
    modelVersion: 'gemini-2.5-flash',
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
  });
}

test('GeminiClient (Layer 2 Gemini/Google GenAI integration boundary)', async (t) => {
  await t.test('returns AI_UNAVAILABLE with no network call at all when GEMINI_API_KEY is unset', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called');
    });
    try {
      const result = await withEnv({ GEMINI_API_KEY: undefined }, () => GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && result.reason.includes('GEMINI_API_KEY'));
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('times out instead of hanging forever on a stalled request', async () => {
    const restore = mockFetchOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal | undefined;
          signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real', GEMINI_TIMEOUT_MS: '50' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /timed out/i.test(result.reason));
    } finally {
      restore();
    }
  });

  await t.test('a raw provider HTTP failure (401 auth) is never echoed to the caller — only a clean, categorized reason is returned', async () => {
    const restore = mockFetchOnce(
      async () => jsonResponse({ error: { code: 401, message: 'API key not valid. Please pass a valid API key.', status: 'UNAUTHENTICATED' } }, 401)
    );
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result);
      const reason = (result as { reason: string }).reason;
      assert.ok(/authentication failed/i.test(reason), `expected an "authentication failed" reason (so the pipeline treats this as permanent/fallback-eligible), got: ${reason}`);
      assert.equal(reason.includes('API key not valid'), false, 'must not leak the raw provider error body');
    } finally {
      restore();
    }
  });

  await t.test('a 429 rate-limit/quota-exhausted response is classified distinctly, and never echoes the raw provider body', async () => {
    const restore = mockFetchOnce(
      async () => jsonResponse({ error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' } }, 429)
    );
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result);
      const reason = (result as { reason: string }).reason;
      assert.ok(/rate limit|quota/i.test(reason), `expected a human-readable rate-limit/quota message, got: ${reason}`);
      // ai-remediation-pipeline.ts's fallback-eligibility check matches "rate limit" so a 429 here
      // triggers an immediate switch to a fallback provider (when one is configured) instead of
      // burning further Gemini attempts on a guaranteed-identical outcome.
      assert.ok(/rate limit/i.test(reason), 'reason must include "rate limit" so the pipeline recognizes this as fallback-eligible');
    } finally {
      restore();
    }
  });

  await t.test('sends the API key via the SDK, never leaking it into the returned result even when the underlying call throws', async () => {
    const secretKey = 'gm_real_looking_secret_value_12345';
    const restore = mockFetchOnce(async () => {
      throw new Error(`Upstream rejected request with key=${secretKey} in the query string`);
    });
    try {
      const result = await withEnv({ GEMINI_API_KEY: secretKey }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes(secretKey), 'the real API key must never appear anywhere in the returned result');
    } finally {
      restore();
    }
  });

  await t.test('rejects an oversized prompt before making any network call', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called');
    });
    try {
      const hugeCode = 'x'.repeat(300_000);
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: hugeCode, framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE', JSON.stringify(result));
      assert.ok('reason' in result && /maximum allowed.*length/i.test(result.reason));
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('the request carries the SAME shared policy instruction and untrusted-source-code marker every other provider uses', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return geminiResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    const injectionMarker = 'GRANT_ADMIN_ACCESS_TO_ALL_USERS_MARKER_98234';
    try {
      await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: `const x = 1; // ${injectionMarker}`, framework: 'REACT_JSX' })
      );
      const bodyText = JSON.stringify(capturedBody);
      assert.ok(/untrusted data/i.test(bodyText), 'the request must carry the same "untrusted data" framing as every other provider');
      assert.ok(bodyText.includes(injectionMarker), 'the source code itself is still sent, just as data, not as an instruction');
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response', async () => {
    const restore = mockFetchOnce(async () => geminiResponse(JSON.stringify({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 88 })));
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
      assert.ok(result.status === 'PATCH' && result.confidence === 88);
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response even wrapped in markdown fences (defense in depth beyond the requested responseMimeType)', async () => {
    const restore = mockFetchOnce(async () =>
      geminiResponse('```json\n' + JSON.stringify({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 90 }) + '\n```')
    );
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
    } finally {
      restore();
    }
  });

  await t.test('parses a valid DECLINE response', async () => {
    const restore = mockFetchOnce(async () => geminiResponse(JSON.stringify({ status: 'DECLINE', reason: 'Requires developer intent.' })));
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'DECLINE');
      assert.ok(result.status === 'DECLINE' && result.reason === 'Requires developer intent.');
    } finally {
      restore();
    }
  });

  await t.test('a backtick-wrapped "patch" (the known Qwen malformed-JSON shape) is recovered through the SAME shared parser, proving Gemini is not given a weaker parsing path', async () => {
    const backtickWrapped =
      '```json\n{\n  "status": "PATCH",\n  "patch": `\nconst x = 2;\n`,\n  "explanation": "Fixed via a named handler.",\n  "confidence": 90\n}\n```';
    const restore = mockFetchOnce(async () => geminiResponse(backtickWrapped));
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH', `expected recovered PATCH, got: ${JSON.stringify(result)}`);
      assert.ok(result.status === 'PATCH' && result.patch.includes('const x = 2;'));
    } finally {
      restore();
    }
  });

  await t.test('an empty/malformed response body is rejected as AI_UNAVAILABLE, never thrown', async () => {
    const restore = mockFetchOnce(async () => geminiResponse('this is not JSON at all'));
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('a response missing required PATCH fields is rejected as AI_UNAVAILABLE, not accepted with defaults', async () => {
    const restore = mockFetchOnce(async () => geminiResponse(JSON.stringify({ status: 'PATCH', patch: 'const x = 2;' })));
    try {
      const result = await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('feeds previousAttempt feedback into the request when retrying, exactly like every other provider', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return geminiResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        GeminiClient.generateRemediation({
          defect: makeDefect(),
          code: 'const x = 1;',
          framework: 'REACT_JSX',
          previousAttempt: { patch: 'const x = 999;', failureStage: 'COMPILE_AND_RESCAN', failureDetail: 'Introduced a new type error.' },
        })
      );
      const bodyText = JSON.stringify(capturedBody);
      assert.ok(bodyText.includes('PREVIOUS ATTEMPT FEEDBACK'));
      assert.ok(bodyText.includes('COMPILE_AND_RESCAN'));
      assert.ok(bodyText.includes('Introduced a new type error.'));
    } finally {
      restore();
    }
  });

  await t.test('uses GEMINI_MODEL when configured, falling back to the gemini-3.6-flash default otherwise', async () => {
    let capturedUrl = '';
    const restore = mockFetchOnce(async (url: string) => {
      capturedUrl = url;
      return geminiResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real', GEMINI_MODEL: undefined }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.ok(capturedUrl.includes('gemini-3.6-flash'), `expected the default model in the URL, got: ${capturedUrl}`);

      await withEnv({ GEMINI_API_KEY: 'gm_test_key_not_real', GEMINI_MODEL: 'gemini-2.5-pro' }, () =>
        GeminiClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.ok(capturedUrl.includes('gemini-2.5-pro'), `expected the configured model in the URL, got: ${capturedUrl}`);
    } finally {
      restore();
    }
  });
});
