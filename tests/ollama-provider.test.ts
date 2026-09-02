import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaClient } from '../src/ai/providers/ollama-provider.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Unit coverage for src/ai/providers/ollama-provider.ts — the one local Ollama (qwen2.5-coder)
 * integration boundary. Mocks `global.fetch` directly (this provider talks to Ollama's native HTTP
 * API with no SDK in between), the same transport-layer mocking approach
 * tests/gemini-provider.test.ts / tests/claude-client.test.ts use for their own SDKs.
 *
 * Real end-to-end coverage against a live local Ollama server (gated on OLLAMA_BASE_URL/
 * OLLAMA_MODEL actually being configured) lives in tests/ollama-integration.test.ts, run via
 * `npm run test:ollama`.
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

/** Simulates a real `/api/generate` response with `stream: false` — a single JSON object whose
 *  `response` field carries the full generated text. */
function generateResponse(response: string): Response {
  return jsonResponse({
    model: 'qwen2.5-coder:7b',
    created_at: '2026-08-31T00:00:00Z',
    response,
    done: true,
    done_reason: 'stop',
  });
}

const ENV_KEYS = { OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, OLLAMA_TIMEOUT_MS: undefined };

test('OllamaClient (Layer 2 local Ollama integration boundary)', async (t) => {
  await t.test('returns AI_UNAVAILABLE with no network call at all when neither OLLAMA_BASE_URL nor OLLAMA_MODEL is set', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called');
    });
    try {
      const result = await withEnv(ENV_KEYS, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && result.reason.includes('environment variable is not configured'));
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('activates from OLLAMA_MODEL alone, defaulting the base URL to 127.0.0.1:11434', async () => {
    let capturedUrl = '';
    const restore = mockFetchOnce(async (url: string) => {
      capturedUrl = url;
      return generateResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(capturedUrl, 'http://127.0.0.1:11434/api/generate');
    } finally {
      restore();
    }
  });

  await t.test('connection refused (Ollama not running) is mapped to a clean AI_UNAVAILABLE reason, not thrown', async () => {
    const restore = mockFetchOnce(async () => {
      const err = new Error('fetch failed');
      (err as any).cause = { code: 'ECONNREFUSED' };
      throw err;
    });
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /unreachable/i.test(result.reason));
      assert.ok('reason' in result && /ollama serve/i.test(result.reason));
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
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b', OLLAMA_TIMEOUT_MS: '50' }, () =>
        OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' })
      );
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /timed out/i.test(result.reason));
    } finally {
      restore();
    }
  });

  await t.test('a generic HTTP 500 is mapped to a clean, categorized reason — never the raw body echoed to the caller', async () => {
    const restore = mockFetchOnce(async () => jsonResponse({ error: 'internal server error with sensitive internal path /etc/secret' }, 500));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /HTTP 500/.test(result.reason));
      assert.equal((result as any).reason.includes('/etc/secret'), false, 'must not leak the raw upstream error body');
    } finally {
      restore();
    }
  });

  await t.test('the reproduced CUDA_Host/insufficient-memory model-load failure is surfaced as a clean, categorized reason', async () => {
    const restore = mockFetchOnce(async () =>
      new Response(
        'Error: 500 Internal Server Error: llama-server process has terminated: exit status 1:\nggml_backend_cpu_buffer_type_alloc_buffer: failed to allocate buffer of size 2679209984\nalloc_tensor_range: failed to allocate CUDA_Host buffer\nerror loading model: unable to allocate CUDA_Host buffer',
        { status: 500 }
      )
    );
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /failed to load model/i.test(result.reason));
      assert.ok('reason' in result && /insufficient memory/i.test(result.reason));
      assert.equal((result as any).reason.includes('ggml_backend_cpu_buffer_type_alloc_buffer'), false, 'must not leak the raw llama-server crash text');
    } finally {
      restore();
    }
  });

  await t.test('HTTP 404 (model not pulled) is reported with a clear `ollama pull` remediation hint', async () => {
    const restore = mockFetchOnce(async () => jsonResponse({ error: 'model "qwen2.5-coder:7b" not found, try pulling it first' }, 404));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /model not found/i.test(result.reason));
      assert.ok('reason' in result && /ollama pull qwen2\.5-coder:7b/.test(result.reason));
    } finally {
      restore();
    }
  });

  await t.test('a malformed (non-JSON) response body is rejected as AI_UNAVAILABLE, never thrown', async () => {
    const restore = mockFetchOnce(async () => new Response('not json at all', { status: 200 }));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('an empty "response" field is rejected as AI_UNAVAILABLE with a clear reason', async () => {
    const restore = mockFetchOnce(async () => jsonResponse({ model: 'qwen2.5-coder:7b', response: '', done: true }));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && /no response text/i.test(result.reason));
    } finally {
      restore();
    }
  });

  await t.test('a response whose generated text is not valid JSON is rejected as AI_UNAVAILABLE, not thrown', async () => {
    const restore = mockFetchOnce(async () => generateResponse('this is not JSON at all'));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE');
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response', async () => {
    const restore = mockFetchOnce(async () => generateResponse(JSON.stringify({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 85 })));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
      assert.ok(result.status === 'PATCH' && result.confidence === 85);
    } finally {
      restore();
    }
  });

  await t.test('parses a valid PATCH response even wrapped in markdown fences', async () => {
    const restore = mockFetchOnce(async () => generateResponse('```json\n' + JSON.stringify({ status: 'PATCH', patch: 'const x = 2;', explanation: 'Changed the value.', confidence: 90 }) + '\n```'));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'PATCH');
      assert.ok(result.status === 'PATCH' && result.patch === 'const x = 2;');
    } finally {
      restore();
    }
  });

  await t.test('parses a valid DECLINE response', async () => {
    const restore = mockFetchOnce(async () => generateResponse(JSON.stringify({ status: 'DECLINE', reason: 'Requires developer intent.' })));
    try {
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(result.status, 'DECLINE');
      assert.ok(result.status === 'DECLINE' && result.reason === 'Requires developer intent.');
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
      const result = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: hugeCode, framework: 'REACT_JSX' }));
      assert.equal(result.status, 'AI_UNAVAILABLE', JSON.stringify(result));
      assert.ok('reason' in result && /maximum allowed.*length/i.test(result.reason));
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('sends the exact configured model (server-authoritative — no client override possible via the request shape)', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return generateResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.generateRemediation({ defect: makeDefect(), code: 'const x = 1;', framework: 'REACT_JSX' }));
      assert.equal(capturedBody.model, 'qwen2.5-coder:7b');
      assert.equal(capturedBody.stream, false);
    } finally {
      restore();
    }
  });

  await t.test('the untrusted-source-code marker and shared policy instruction are both present in the flat prompt', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return generateResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    const injectionMarker = 'GRANT_ADMIN_ACCESS_TO_ALL_USERS_MARKER_98234';
    try {
      await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () =>
        OllamaClient.generateRemediation({ defect: makeDefect(), code: `const x = 1; // ${injectionMarker}`, framework: 'REACT_JSX' })
      );
      assert.ok(/untrusted data/i.test(capturedBody.prompt), 'prompt must state that source code is untrusted data');
      assert.ok(capturedBody.prompt.includes(injectionMarker), 'the source code itself is still sent, just as data, not as an instruction');
    } finally {
      restore();
    }
  });

  await t.test('feeds previousAttempt feedback into the prompt when retrying', async () => {
    let capturedBody: any;
    const restore = mockFetchOnce(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return generateResponse(JSON.stringify({ status: 'DECLINE', reason: 'test' }));
    });
    try {
      await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () =>
        OllamaClient.generateRemediation({
          defect: makeDefect(),
          code: 'const x = 1;',
          framework: 'REACT_JSX',
          previousAttempt: { patch: 'const x = 999;', failureStage: 'COMPILE_AND_RESCAN', failureDetail: 'Introduced a new type error.' },
        })
      );
      assert.ok(capturedBody.prompt.includes('PREVIOUS ATTEMPT FEEDBACK'));
      assert.ok(capturedBody.prompt.includes('COMPILE_AND_RESCAN'));
      assert.ok(capturedBody.prompt.includes('Introduced a new type error.'));
    } finally {
      restore();
    }
  });
});

test('OllamaClient.checkHealth (health-check probe, never used for remediation)', async (t) => {
  await t.test('reports not configured with no network call when neither var is set', async () => {
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('fetch should not have been called');
    });
    try {
      const health = await withEnv(ENV_KEYS, () => OllamaClient.checkHealth());
      assert.equal(health.configured, false);
      assert.equal(fetchCalled, false);
    } finally {
      restore();
    }
  });

  await t.test('reports reachable + modelAvailable when /api/tags lists the configured model', async () => {
    const restore = mockFetchOnce(async () => jsonResponse({ models: [{ name: 'qwen2.5-coder:7b' }, { name: 'qwen2.5-coder:3b' }] }));
    try {
      const health = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.checkHealth());
      assert.equal(health.configured, true);
      assert.equal(health.reachable, true);
      assert.equal(health.modelAvailable, true);
    } finally {
      restore();
    }
  });

  await t.test('reports reachable but modelAvailable=false when the configured model is not pulled', async () => {
    const restore = mockFetchOnce(async () => jsonResponse({ models: [{ name: 'qwen2.5-coder:3b' }] }));
    try {
      const health = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.checkHealth());
      assert.equal(health.reachable, true);
      assert.equal(health.modelAvailable, false);
      assert.ok(health.error && /qwen2\.5-coder:7b/.test(health.error));
    } finally {
      restore();
    }
  });

  await t.test('reports unreachable (not thrown) when the connection is refused', async () => {
    const restore = mockFetchOnce(async () => {
      const err = new Error('fetch failed');
      (err as any).cause = { code: 'ECONNREFUSED' };
      throw err;
    });
    try {
      const health = await withEnv({ ...ENV_KEYS, OLLAMA_MODEL: 'qwen2.5-coder:7b' }, () => OllamaClient.checkHealth());
      assert.equal(health.reachable, false);
      assert.ok(health.error);
    } finally {
      restore();
    }
  });
});
