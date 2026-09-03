import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Stage 7E — regression coverage for the deterministic-first fix-routing contract
 * (AIRemediationPipeline.remediateDefect Path 1 vs Path 3) and the observability gap found and
 * closed this stage: a real, reproduced case (FIGM-A11Y-01's onKeyDown patch on a render-scope
 * component tripping FIGM-PERF-05's "inline anonymous callback" rule — see
 * remediation-validation.server.ts's own comment) where a deterministic patch is generated,
 * correctly REJECTED by re-scan validation, and the pipeline legitimately falls back to AI — but
 * previously logged nothing between 'ROUTED' and 'AI_PROVIDER_SELECTED' to explain why, making the
 * log sequence look contradictory even though the underlying behavior was always correct.
 *
 * Three cases, matching the intended contract:
 *   A. deterministic success -> AI is never consulted at all
 *   B. deterministic patch generated then rejected on re-scan -> explicit DETERMINISTIC_REJECTED
 *      log, then a real (mocked-network) AI fallback -> AI_ASSISTED_FIX
 *   C. no deterministic fixer for the rule at all -> AI is the route from the start, no
 *      DETERMINISTIC_REJECTED log fires (nothing was attempted to reject)
 */

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

function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  return fn()
    .then((result) => ({ result, lines }))
    .finally(() => {
      console.log = original;
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

const BASE_ENV = {
  OLLAMA_BASE_URL: undefined,
  OLLAMA_MODEL: undefined,
  AI_PRIMARY_PROVIDER: undefined,
  AI_FALLBACK_PROVIDER: undefined,
  ANTHROPIC_API_KEY: undefined,
  GEMINI_API_KEY: 'gm_test_key_not_real',
};

test('Deterministic-first fix routing contract', async (t) => {
  await t.test('A: deterministic success — AI provider is never invoked, no fallback log fires', async () => {
    const perf01Defect: DiagnosticReport = {
      ruleId: 'FIGM-PERF-01',
      ruleName: 'Avoid Object Allocation in Loops',
      message: 'Avoid Object Allocation in Loops',
      domain: 'PERFORMANCE',
      concern: 'INVARIANT_ALLOCATIONS',
      severity: 'CRITICAL',
      filePath: 'src/UserProfile.jsx',
      location: { start: { line: 3, column: 10 }, end: { line: 3, column: 45 } },
      offendingCodeSnippet: 'const defaultConfig = { theme: "dark" };',
      remediation: 'Hoist static object allocation outside loop scope.',
      standardReference: 'ISO 25010',
    };
    const code = `function processItems(items) {
  return items.map(item => {
    const defaultConfig = { theme: "dark" };
    return { ...item, ...defaultConfig };
  });
}`;

    // Poisoned fetch: if the pipeline ever reaches the AI layer, this throws immediately, failing
    // the test loudly rather than silently succeeding via an unmocked/real network call.
    const originalFetch = global.fetch;
    (global as any).fetch = async () => {
      throw new Error('AI provider must never be called when a deterministic fix succeeds');
    };
    try {
      const { result, lines } = await captureLogs(() =>
        withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(code, perf01Defect, 'REACT_JSX'))
      );
      assert.equal(result.engineType, 'AST_DETERMINISTIC_FIX');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      assert.equal(result.provider, undefined, 'engineType AST_DETERMINISTIC_FIX must never carry a provider field');

      assert.ok(lines.some((l) => l.includes('stage=DETERMINISTIC_ATTEMPTED')));
      assert.ok(lines.some((l) => l.includes('stage=DETERMINISTIC_FIX_APPLIED')));
      assert.ok(!lines.some((l) => l.includes('stage=DETERMINISTIC_REJECTED')), 'a successful deterministic fix must never log a rejection');
      assert.ok(!lines.some((l) => l.includes('stage=AI_PROVIDER_SELECTED')), 'AI must never be selected once a deterministic fix is accepted');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test('B: FIGM-A11Y-01 in a render-scope component — deterministic patch generated then correctly rejected (trips FIGM-PERF-05), explicit fallback log, real mocked-Gemini AI fix completes', async () => {
    // Exact reproduction of the Stage 7D-reported anomaly: the deterministic onKeyDown patch for
    // FIGM-A11Y-01 introduces a fresh inline-arrow-function violation (FIGM-PERF-05) because this
    // <div> sits inside a component's render-scope function — see
    // remediation-validation.server.ts's own comment naming this exact interaction.
    const code = `function Clicker(){ return <div onClick={handleClick}>Click me</div>; }`;
    const a11y01Defect: DiagnosticReport = {
      ruleId: 'FIGM-A11Y-01',
      ruleName: 'Keyboard Event Parity on Pointer Handlers',
      message: 'Non-interactive element has pointer click listener but lacks onKeyDown handler or tabindex.',
      domain: 'ACCESSIBILITY',
      concern: 'KEYBOARD_ACCESSIBILITY',
      severity: 'HIGH',
      filePath: 'Clicker.jsx',
      location: { start: { line: 1, column: 27 }, end: { line: 1, column: 50 } },
      offendingCodeSnippet: 'function Clicker(){ return <div onClick={handleClick}>Click me</div>; }',
      remediation: 'Add a keyboard handler (onKeyDown) or tabindex to the clickable element.',
      standardReference: 'WCAG 2.2 SC 2.1.1',
    };

    const mock = mockGeminiFetch(() =>
      geminiChatResponse(
        JSON.stringify({
          status: 'PATCH',
          patch: `function Clicker(){ return <button type="button" onClick={handleClick}>Click me</button>; }`,
          explanation: 'Replaced the non-interactive <div> with a native <button> for real keyboard accessibility.',
          confidence: 95,
        })
      )
    );
    try {
      const { result, lines } = await captureLogs(() =>
        withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(code, a11y01Defect, 'REACT_JSX'))
      );

      // The deterministic attempt genuinely happened and was genuinely rejected.
      assert.ok(lines.some((l) => l.includes('stage=DETERMINISTIC_ATTEMPTED')));
      const rejectedLine = lines.find((l) => l.includes('stage=DETERMINISTIC_REJECTED'));
      assert.ok(rejectedLine, 'a deterministic patch that fails re-scan validation must log an explicit DETERMINISTIC_REJECTED line');
      assert.ok(rejectedLine!.includes('finalResult=AI_FALLBACK_SELECTED'));

      // The AI selection log must be explicitly marked as a fallback, not indistinguishable from a
      // fresh AI-only route.
      const aiSelectedLine = lines.find((l) => l.includes('stage=AI_PROVIDER_SELECTED'));
      assert.ok(aiSelectedLine);
      assert.ok(aiSelectedLine!.includes('viaDeterministicFallback=true'));

      // Final result is honest: real AI fix, not a fabricated deterministic success.
      assert.equal(result.engineType, 'AI_ASSISTED_FIX');
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      assert.equal(mock.calls(), 1, 'exactly one real AI call for this fallback, not more');
    } finally {
      mock.restore();
    }
  });

  await t.test('C: rule with no deterministic fixer at all — AI is the route from the start, no DETERMINISTIC_REJECTED log (nothing was attempted)', async () => {
    const scopeFixtureCode = [
      `import React from 'react';`,
      ``,
      `function List({ items }) {`,
      `  const sorted = items.sort((a, b) => a - b);`,
      `  return <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>;`,
      `}`,
      ``,
      `export default List;`,
    ].join('\n');
    const reactDefect: DiagnosticReport = {
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
    const fixedCode = scopeFixtureCode
      .replace(`import React from 'react';`, `import React, { useMemo } from 'react';`)
      .replace('const sorted = items.sort((a, b) => a - b);', 'const sorted = useMemo(() => items.sort((a, b) => a - b), [items]);');

    const mock = mockGeminiFetch(() =>
      geminiChatResponse(JSON.stringify({ status: 'PATCH', patch: fixedCode, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 }))
    );
    try {
      const { result, lines } = await captureLogs(() =>
        withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(scopeFixtureCode, reactDefect, 'REACT_JSX'))
      );

      assert.ok(!lines.some((l) => l.includes('stage=DETERMINISTIC_ATTEMPTED')), 'no deterministic fixer exists for this rule -- nothing should ever be attempted');
      assert.ok(!lines.some((l) => l.includes('stage=DETERMINISTIC_REJECTED')));
      const aiSelectedLine = lines.find((l) => l.includes('stage=AI_PROVIDER_SELECTED'));
      assert.ok(aiSelectedLine);
      assert.ok(aiSelectedLine!.includes('viaDeterministicFallback=false'), 'this is a fresh AI-only route, not a post-rejection fallback');

      assert.equal(result.engineType, 'AI_ASSISTED_FIX');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
    } finally {
      mock.restore();
    }
  });
});
