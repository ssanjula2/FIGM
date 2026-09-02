import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';
import { POST as scanPOST } from '../app/api/scan/route';

/**
 * Phase 2 (AST/Rule Coverage Gaps), item 5 — server-side Svelte unsupported signal.
 *
 * SVELTE was already a real, distinct FrameworkType value (detected by `.svelte` extension), but
 * had no server-side signal distinguishing "FIGM genuinely has no rule coverage for this
 * framework" from "a genuine clean scan" — the only such signal lived entirely client-side, in a
 * hardcoded `Set(['SVELTE'])` in app/live-scan/page.tsx that had to be manually kept in sync with
 * the server. This closes the gap using the EXISTING ScanResult.analysis.figmStatus mechanism
 * (already used for COMPLETE/PARTIAL/BLOCKED) rather than inventing a parallel signal, adding a
 * new `UNSUPPORTED_FRAMEWORK` value that RuleExecutionEngine.buildScanResult now sets whenever
 * `framework === 'SVELTE'`, checked before (and independent of) parse-success/failure.
 */

test('Svelte — server-side unsupported-framework signal (ScanResult.analysis.figmStatus)', async (t) => {
  await t.test('a clean-looking Svelte file is reported UNSUPPORTED_FRAMEWORK, never COMPLETE', () => {
    const code = `<script>\n  let count = 0;\n  function increment() { count += 1; }\n</script>\n<button on:click={increment}>{count}</button>\n`;
    const result = RuleExecutionEngine.analyzeFile('Counter.svelte', code);
    assert.equal(result.framework, 'SVELTE');
    assert.equal(result.analysis.figmStatus, 'UNSUPPORTED_FRAMEWORK', 'a Svelte scan must never be reported as a completed FIGM sweep');
  });

  await t.test('never fabricates a "clean" result — even zero diagnostics is not reported as COMPLETE for Svelte', () => {
    const code = `<script>\n  export let name;\n</script>\n<p>Hello {name}</p>\n`;
    const result = RuleExecutionEngine.analyzeFile('Greeting.svelte', code);
    assert.equal(result.analysis.figmStatus, 'UNSUPPORTED_FRAMEWORK');
    assert.notEqual(result.analysis.figmStatus, 'COMPLETE');
  });

  await t.test('UNSUPPORTED_FRAMEWORK takes precedence over PARTIAL/BLOCKED even when the Svelte source also has a real syntax error', () => {
    // A genuinely broken Svelte file: the framework-unsupported signal must still be the reported
    // status, not conflated with (or masked by) the separate parse-error-driven PARTIAL/BLOCKED
    // states, since the root reason no FIGM rules ran is the framework, not the syntax error.
    const code = `<script>\n  let count = 0\n  function increment( { count += 1; }\n</script>\n`;
    const result = RuleExecutionEngine.analyzeFile('Broken.svelte', code);
    assert.equal(result.analysis.figmStatus, 'UNSUPPORTED_FRAMEWORK');
  });

  await t.test('sibling supported frameworks are unaffected — a clean React file still reports COMPLETE', () => {
    const code = `function Widget() {\n  return <div>Hello</div>;\n}`;
    const result = RuleExecutionEngine.analyzeFile('Widget.jsx', code);
    assert.notEqual(result.framework, 'SVELTE');
    assert.equal(result.analysis.figmStatus, 'COMPLETE');
  });

  await t.test('end-to-end via the real /api/scan route: a Svelte submission surfaces the same authoritative signal', async () => {
    const code = `<script>\n  let count = 0;\n</script>\n<button on:click={() => count++}>{count}</button>\n`;
    const req = new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, fileName: 'Counter.svelte' }),
    });
    const res = await scanPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.framework, 'SVELTE');
    assert.equal(body.analysis?.figmStatus, 'UNSUPPORTED_FRAMEWORK');
  });
});
