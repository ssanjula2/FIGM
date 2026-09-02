import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeClient } from '../src/ai/claude-client.server.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Unit coverage for src/ai/claude-client.server.ts — the one Claude integration boundary.
 * Mocks `global.fetch` (confirmed by reading node_modules/@anthropic-ai/sdk/client.js: the SDK's
 * default transport calls the global `fetch`, the same thing the prior Gemini integration's SDK
 * used, so this is a real mock of the actual transport layer, not a fake one).
 *
 * Real end-to-end coverage against the live Claude API (gated on ANTHROPIC_API_KEY actually being
 * configured) lives in tests/claude-integration.test.ts.
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

/** Simulates a real Claude /v1/messages response carrying exactly one forced tool_use block for
 *  the submit_remediation tool — the shape claude-client.server.ts's SUBMIT_REMEDIATION_TOOL
 *  forces via tool_choice. */
function toolUseResponse(input: unknown): Response {
  return jsonResponse({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'tool_use', id: 'toolu_test', name: 'submit_remediation', input }],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });
}

test('ClaudeClient (Layer 2 Claude integration boundary)', async (t) => {
  await t.test('returns AI_UNAVAILABLE with no network call at all when ANTHROPIC_API_KEY is unset', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called');
    });
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: undefined }, () => ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && result.reason.includes('ANTHROPIC_API_KEY'));
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
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_TIMEOUT_MS: '50' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /timed out/i.test(result.reason));
    } finally {
      restore();
    }
  });

  await t.test('a raw provider HTTP failure (e.g. 429 rate limit) is never echoed to the caller — only a clean, categorized reason is returned', async () => {
    const rawRateLimitBody = JSON.stringify({
      type: 'error',
      error: { type: 'rate_limit_error', message: 'This request would exceed the rate limit for your organization (org_abc123, req_xyz789).' },
    });
    const restore = mockFetchOnce(async () => new Response(rawRateLimitBody, { status: 429 }));
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result);
      const reason = (result as { reason: string }).reason;
      assert.ok(/rate limit/i.test(reason), `expected a human-readable rate-limit message, got: ${reason}`);
      assert.equal(reason.includes('org_abc123'), false, 'must not leak raw provider request/org identifiers');
      assert.equal(reason.includes('rate_limit_error'), false, 'must not leak the raw provider error type');
    } finally {
      restore();
    }
  });

  await t.test('sends the API key as a header, never in the URL query string', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    const restore = mockFetchOnce(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = Object.fromEntries(new Headers(init.headers as HeadersInit).entries());
      return toolUseResponse({ status: 'DECLINE', reason: 'test' });
    });
    try {
      await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(capturedUrl.includes('key='), false, 'API key must not appear in the request URL');
      assert.equal(capturedHeaders['x-api-key'], 'test-key-not-real', 'API key must be sent via the x-api-key header');
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
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: hugeCode, framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE', JSON.stringify(result));
      assert.ok('reason' in result && /maximum allowed.*length/i.test(result.reason));
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('the system instruction (policy) is sent as a distinct field from the user content (rule context + source) — real structural separation, not string concatenation', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return toolUseResponse({ status: 'DECLINE', reason: 'test' });
    });
    // A distinctive marker NOT already used as one of SYSTEM_INSTRUCTION's own example injection
    // phrases (it illustrates a few, e.g. "ignore previous instructions" — reusing one of those
    // would make this assertion meaningless, since it would legitimately appear in the policy text
    // itself for an unrelated reason).
    const injectionMarker = 'GRANT_ADMIN_ACCESS_TO_ALL_USERS_MARKER_98234';
    try {
      await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: `const x = 1; // ${injectionMarker}`, framework: 'REACT_JSX' })
      );
      assert.ok(capturedBody.system, 'request body must carry a distinct system field');
      const systemText = JSON.stringify(capturedBody.system);
      assert.ok(/untrusted data/i.test(systemText), 'system instruction must state that source code is untrusted data');
      const messagesText = JSON.stringify(capturedBody.messages);
      assert.ok(!systemText.includes(injectionMarker), 'text embedded in the SOURCE CODE must never leak into the system field');
      assert.ok(messagesText.includes(injectionMarker), 'the source code itself is still sent, just as data in messages, not as an instruction');
    } finally {
      restore();
    }
  });

  await t.test('forces a single tool call rather than free-form text — tool_choice names submit_remediation', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return toolUseResponse({ status: 'DECLINE', reason: 'test' });
    });
    try {
      await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.deepEqual(capturedBody.tool_choice, { type: 'tool', name: 'submit_remediation' });
      assert.equal(capturedBody.tools?.[0]?.name, 'submit_remediation');
      assert.equal(capturedBody.tools?.[0]?.strict, true);
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response', async () => {
    const restore = mockFetchOnce(async () => toolUseResponse({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 88 }));
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
      assert.ok(result.status === 'PATCH' && result.confidence === 88);
    } finally {
      restore();
    }
  });

  await t.test('parses a valid DECLINE response', async () => {
    const restore = mockFetchOnce(async () => toolUseResponse({ status: 'DECLINE', reason: 'Requires developer intent.' }));
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'DECLINE');
      assert.ok(result.status === 'DECLINE' && result.reason === 'Requires developer intent.');
    } finally {
      restore();
    }
  });

  await t.test('a response with no tool_use block (e.g. a safety refusal) is rejected as AI_UNAVAILABLE, never thrown', async () => {
    const restore = mockFetchOnce(async () =>
      jsonResponse({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [{ type: 'text', text: 'I cannot help with that.' }],
        stop_reason: 'refusal',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    );
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('a response missing required PATCH fields is rejected as AI_UNAVAILABLE, not accepted with defaults', async () => {
    const restore = mockFetchOnce(async () => toolUseResponse({ status: 'PATCH', patch: 'const x = 2;' }));
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('the API key never appears in the returned result, even when the underlying call throws', async () => {
    const secretKey = 'sk-ant-real-looking-secret-value-12345';
    const restore = mockFetchOnce(async () => {
      throw new Error(`Upstream rejected request with header x-api-key: ${secretKey}`);
    });
    try {
      const result = await withEnv({ ANTHROPIC_API_KEY: secretKey }, () =>
        ClaudeClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes(secretKey), 'the real API key must never appear anywhere in the returned result');
    } finally {
      restore();
    }
  });

  await t.test('feeds previousAttempt feedback into the request when retrying, without leaking it as a new patch', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return toolUseResponse({ status: 'DECLINE', reason: 'test' });
    });
    try {
      await withEnv({ ANTHROPIC_API_KEY: 'test-key-not-real' }, () =>
        ClaudeClient.generateRemediation({
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
});
