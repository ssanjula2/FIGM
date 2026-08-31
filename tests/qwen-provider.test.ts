import test from 'node:test';
import assert from 'node:assert/strict';
import { QwenClient } from '../src/ai/providers/qwen-provider.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Unit coverage for src/ai/providers/qwen-provider.ts — the one Hugging Face (Qwen2.5-Coder)
 * integration boundary. Mocks `global.fetch` (confirmed by reading
 * node_modules/@huggingface/inference/dist/commonjs/utils/request.js: `innerRequest` calls
 * `(options?.fetch ?? fetch)`, i.e. the global `fetch` when no override is supplied — the same
 * transport-layer mocking approach tests/claude-client.test.ts uses for the Anthropic SDK).
 *
 * A real Hugging Face access token always starts with "hf_" — the SDK's own auto-router requires
 * this (see makeRequestOptions.js: a non-"hf_" token resolves to authMethod "provider-key", and
 * AutoRouterConversationalTask.makeBaseUrl refuses anything but "hf-token"). Every test below that
 * expects a real network attempt therefore uses an "hf_..." token, exactly as production expects.
 * The one test that deliberately uses a non-"hf_" token proves the OPPOSITE: that this case is
 * caught client-side (see qwen-provider.ts's InferenceClientRoutingError handling) with zero
 * network calls, never a confusing generic "network error".
 *
 * Real end-to-end coverage against the live Hugging Face API (gated on HF_TOKEN actually being
 * configured) lives in tests/qwen-integration.test.ts, run via `npm run test:qwen`.
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

/** Simulates a real Hugging Face chat-completion response (the ChatCompletionOutput shape
 *  BaseConversationalTask.getResponse validates: choices[]/created/id/model/usage all required). */
function chatResponse(content: string): Response {
  return jsonResponse({
    id: 'chatcmpl_test',
    created: 1700000000,
    model: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    system_fingerprint: null,
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });
}

test('QwenClient (Layer 2 Qwen/Hugging Face integration boundary)', async (t) => {
  await t.test('returns AI_UNAVAILABLE with no network call at all when HF_TOKEN is unset', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called');
    });
    try {
      const result = await withEnv({ HF_TOKEN: undefined }, () => QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && result.reason.includes('HF_TOKEN'));
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
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real', QWEN_TIMEOUT_MS: '50' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /timed out/i.test(result.reason));
    } finally {
      restore();
    }
  });

  await t.test('a raw provider HTTP failure (e.g. 429 rate limit) is never echoed to the caller — only a clean, categorized reason is returned', async () => {
    const restore = mockFetchOnce(
      async () => jsonResponse({ error: 'Rate limit exceeded for org_abc123, req_xyz789.' }, 429)
    );
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result);
      const reason = (result as { reason: string }).reason;
      assert.ok(/rate limit/i.test(reason), `expected a human-readable rate-limit message, got: ${reason}`);
      assert.equal(reason.includes('org_abc123'), false, 'must not leak raw provider request/org identifiers');
    } finally {
      restore();
    }
  });

  await t.test('a 402 billing/quota-exhausted response is classified distinctly from a 429 rate limit, and never echoes the raw provider body', async () => {
    const restore = mockFetchOnce(
      async () => jsonResponse({ error: 'You have exceeded your monthly included credits for Inference Providers.' }, 402)
    );
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result);
      const reason = (result as { reason: string }).reason;
      assert.ok(/billing|quota/i.test(reason), `expected a human-readable billing/quota message, got: ${reason}`);
      assert.equal(reason.includes('monthly included credits'), false, 'must not leak the raw provider error body');
      // ai-remediation-pipeline.ts's permanent-failure check matches this exact phrase so a 402
      // stops after one attempt instead of burning the remaining retries on a guaranteed-identical
      // outcome — see qwen-provider.ts's own doc comment on the 402 branch.
      assert.ok(reason.includes('billing/quota exhausted'), `expected the permanent-failure phrase "billing/quota exhausted", got: ${reason}`);
    } finally {
      restore();
    }
  });

  await t.test('sends the token as an Authorization header, never in the URL query string, to the HF auto-router endpoint', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    const restore = mockFetchOnce(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = Object.fromEntries(new Headers(init.headers as HeadersInit).entries());
      return chatResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(capturedUrl.includes('hf_test_token_not_real'), false, 'token must not appear in the request URL');
      assert.ok(capturedUrl.endsWith('/v1/chat/completions'), `expected the HF chat-completions route, got: ${capturedUrl}`);
      assert.equal(capturedHeaders['authorization'], 'Bearer hf_test_token_not_real', 'token must be sent via the Authorization header');
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
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: hugeCode, framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE', JSON.stringify(result));
      assert.ok('reason' in result && /maximum allowed.*length/i.test(result.reason));
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('the system + user messages carry the shared policy instruction and the untrusted-source-code marker', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    const injectionMarker = 'GRANT_ADMIN_ACCESS_TO_ALL_USERS_MARKER_98234';
    try {
      await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: `const x = 1; // ${injectionMarker}`, framework: 'REACT_JSX' })
      );
      const systemMsg = capturedBody.messages.find((m: any) => m.role === 'system');
      const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
      assert.ok(systemMsg, 'request must carry a distinct system message');
      assert.ok(/untrusted data/i.test(systemMsg.content), 'system instruction must state that source code is untrusted data');
      assert.ok(!systemMsg.content.includes(injectionMarker), 'text embedded in the SOURCE CODE must never leak into the system message');
      assert.ok(userMsg.content.includes(injectionMarker), 'the source code itself is still sent, just as data in the user message, not as an instruction');
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response', async () => {
    const restore = mockFetchOnce(async () => chatResponse(JSON.stringify({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 88 })));
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
      assert.ok(result.status === 'PATCH' && result.confidence === 88);
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response even wrapped in markdown fences (no response_format is requested — see file header)', async () => {
    const restore = mockFetchOnce(async () =>
      chatResponse('```json\n' + JSON.stringify({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 90 }) + '\n```')
    );
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
    } finally {
      restore();
    }
  });

  await t.test('parses a valid DECLINE response', async () => {
    const restore = mockFetchOnce(async () => chatResponse(JSON.stringify({ status: 'DECLINE', reason: 'Requires developer intent.' })));
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'DECLINE');
      assert.ok(result.status === 'DECLINE' && result.reason === 'Requires developer intent.');
    } finally {
      restore();
    }
  });

  await t.test('recovers a real reproduced Qwen failure mode: "patch" wrapped in backticks instead of a JSON string, through the full provider boundary', async () => {
    // Reproduced live against the real Hugging Face API (FIGM-PERF-05 / ReactBenchmark.jsx,
    // consistent across all 3 retries) — Qwen2.5-Coder-7B-Instruct produces a syntactically valid
    // JSON envelope but serializes "patch" using JS template-literal backticks. Full regression
    // coverage of the recovery logic itself lives in tests/response-parser.test.ts; this test only
    // confirms QwenClient.generateRemediation wires that recovery through end-to-end.
    const backtickWrapped =
      '```json\n{\n  "status": "PATCH",\n  "patch": `\nconst x = 2;\n`,\n  "explanation": "Fixed via a named handler.",\n  "confidence": 90\n}\n```';
    const restore = mockFetchOnce(async () => chatResponse(backtickWrapped));
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH', `expected recovered PATCH, got: ${JSON.stringify(result)}`);
      assert.ok(result.status === 'PATCH' && result.patch.includes('const x = 2;'));
      assert.ok(result.status === 'PATCH' && !result.patch.includes('`'));
    } finally {
      restore();
    }
  });

  await t.test('an empty/malformed response body is rejected as AI_UNAVAILABLE, never thrown', async () => {
    const restore = mockFetchOnce(async () => chatResponse('this is not JSON at all'));
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('a response missing required PATCH fields is rejected as AI_UNAVAILABLE, not accepted with defaults', async () => {
    const restore = mockFetchOnce(async () => chatResponse(JSON.stringify({ status: 'PATCH', patch: 'const x = 2;' })));
    try {
      const result = await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('the token never appears in the returned result, even when the underlying call throws', async () => {
    const secretToken = 'hf_real_looking_secret_value_12345';
    const restore = mockFetchOnce(async () => {
      throw new Error(`Upstream rejected request with header Authorization: Bearer ${secretToken}`);
    });
    try {
      const result = await withEnv({ HF_TOKEN: secretToken }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes(secretToken), 'the real token must never appear anywhere in the returned result');
    } finally {
      restore();
    }
  });

  await t.test('feeds previousAttempt feedback into the request when retrying, without leaking it as a new patch', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({
          defect: makeDefect(),
          code: 'const x = 1;',
          framework: 'REACT_JSX',
          previousAttempt: { patch: 'const x = 999;', failureStage: 'COMPILE_AND_RESCAN', failureDetail: 'Introduced a new type error.' },
        })
      );
      const messagesText = JSON.stringify(capturedBody.messages);
      assert.ok(messagesText.includes('PREVIOUS ATTEMPT FEEDBACK'));
      assert.ok(messagesText.includes('COMPILE_AND_RESCAN'));
      assert.ok(messagesText.includes('Introduced a new type error.'));
    } finally {
      restore();
    }
  });

  await t.test('uses HF_MODEL when configured, falling back to the Qwen2.5-Coder-7B-Instruct default otherwise', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ HF_TOKEN: 'hf_test_token_not_real', HF_MODEL: undefined }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(capturedBody.model, 'Qwen/Qwen2.5-Coder-7B-Instruct');

      await withEnv({ HF_TOKEN: 'hf_test_token_not_real', HF_MODEL: 'Qwen/Custom-Variant' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(capturedBody.model, 'Qwen/Custom-Variant');
    } finally {
      restore();
    }
  });

  await t.test('never sends provider: "hf-inference" or any explicit provider override — auto-router adapts to whichever provider actually serves the configured model', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return chatResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ HF_TOKEN: 'hf_test_token_not_real' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(capturedBody.provider, undefined, 'no explicit provider should be sent — verified live that this model is not served by hf-inference at all, so hardcoding it would break the request');
    } finally {
      restore();
    }
  });

  await t.test('a token that does not start with "hf_" is rejected client-side (auto-router routing guard), with no network call and a clear, categorized reason', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called — the SDK must reject this client-side before any HTTP request');
    });
    try {
      const result = await withEnv({ HF_TOKEN: 'not_a_real_hf_token_shape' }, () =>
        QwenClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /authentication failed/i.test(result.reason), `expected an "authentication failed" reason (so the pipeline treats this as permanent), got: ${JSON.stringify(result)}`);
      assert.ok('reason' in result && /must start with "hf_"/i.test(result.reason));
      assert.ok('reason' in result && result.reason.includes('huggingface.co/settings/tokens'));
      assert.equal(fetchCalled, false, 'the SDK must reject an invalid-shaped token before ever attempting a network call');
    } finally {
      restore();
    }
  });
});
