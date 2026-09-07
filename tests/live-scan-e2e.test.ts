import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as scanPOST } from '../app/api/scan/route';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';

/**
 * Live Scan end-to-end regression suite.
 *
 * Exercises the REAL, deployed pipeline exactly as the browser UI does: POST /api/scan for a
 * plain scan and for `action: 'ai-fix'`, through the actual Next.js route handler -- not a
 * mocked or simplified stand-in. This is deliberately the same `RuleExecutionEngine.analyzeFile`
 * entry point `src/eval/evaluation-runner.ts` uses for the benchmark (confirmed by reading both
 * call sites): there is exactly one real engine behind both the live product and the research
 * benchmark, never a separate "demo scanner."
 *
 * Every "apply fix" case below performs the full contractual loop the task requires: scan ->
 * locate the real diagnostic -> request a fix -> assert the API's own `verified`/
 * `verificationStatus` fields (never assumed) -> independently re-scan the returned
 * `remediatedCode` a SECOND time and confirm the original ruleId is actually gone. This
 * double-checks the server's internal verification rather than trusting it blindly.
 */

// Each top-level test() below gets its own fixed source IP so the (deliberately shared, see
// src/auth/rate-limiter.ts) per-IP request counter across scan/ai-fix calls doesn't cause one
// test's volume to spuriously rate-limit an unrelated test -- exactly like distinct real users
// would have distinct source IPs. Callers pass their own `ip` through explicitly rather than a
// module-level counter, so test execution order/parallelism can never change which test gets
// which bucket.
function scanRequest(code: string, fileName: string, ip: string): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ code, fileName }),
  });
}

function aiFixRequest(code: string, fileName: string, defect: unknown, ip: string): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ code, fileName, action: 'ai-fix', defect }),
  });
}

async function scan(code: string, fileName: string, ip: string): Promise<any> {
  const res = await scanPOST(scanRequest(code, fileName, ip));
  assert.equal(res.status, 200, `scan of ${fileName} should return 200`);
  return res.json();
}

/**
 * Full acceptance loop for one framework: scan -> detect ruleId -> apply fix -> verify the API
 * reports it FIXED -> independently re-scan the patched code a second time and confirm the
 * original violation is actually gone. Returns the scan result so callers can assert on
 * framework-specific details (evidence, sourceKind, location) too.
 */
async function scanFixVerify(code: string, fileName: string, ruleId: string, ip: string) {
  const initial = await scan(code, fileName, ip);
  const defect = initial.diagnostics.find((d: any) => d.ruleId === ruleId);
  assert.ok(defect, `expected ${ruleId} to be detected in ${fileName}; got: ${initial.diagnostics.map((d: any) => d.ruleId).join(', ')}`);

  // Every displayed finding must expose rule id/name/severity/location/evidence/explanation/fix.
  assert.ok(defect.ruleId);
  assert.ok(defect.ruleName);
  assert.ok(defect.severity);
  assert.ok(defect.location?.start?.line > 0, 'must expose a real source line');
  assert.ok(defect.message, 'must expose an explanation');
  assert.ok(defect.remediation, 'must expose fix guidance');

  const fixRes = await scanPOST(aiFixRequest(code, fileName, defect, ip));
  assert.equal(fixRes.status, 200);
  const fixData = await fixRes.json();

  // The API must NEVER claim a fix worked without having actually verified it via re-scan.
  assert.equal(fixData.verified, true, `expected ${ruleId} fix to be verified; got status=${fixData.verificationStatus}, reason=${fixData.fallbackReason}`);
  assert.equal(fixData.verificationStatus, 'FIXED');
  assert.ok(fixData.remediatedCode && fixData.remediatedCode !== code, 'a real code change must have been produced');

  // Independent re-verification: re-scan the patched code ourselves, not trusting the pipeline's
  // internal check alone -- this is the literal "re-scan patched code and confirm the violation
  // disappeared" requirement, checked a second, independent time.
  const rescan = await scan(fixData.remediatedCode, fileName, ip);
  const stillPresent = rescan.diagnostics.some((d: any) => d.ruleId === ruleId);
  assert.equal(stillPresent, false, `${ruleId} must be gone after the verified fix, but re-scan still reports it`);

  return { initial, defect, fixData, rescan };
}

test('Live Scan E2E — React', async () => {
  RepositoryFactory.resetProvider();
  const code = `function Widget({ items }) {
  return items.map(item => {
    const cfg = { theme: 'dark' };
    return <span key={item.id} style={cfg}>{item.name}</span>;
  });
}`;
  const { defect } = await scanFixVerify(code, 'Widget.jsx', 'FIGM-PERF-01', '203.0.113.1');
  assert.equal(defect.sourceKind, 'REAL_AST', 'FIGM-PERF-01 on React should be real-AST-detected');
});

test('Live Scan E2E — Next.js', async () => {
  RepositoryFactory.resetProvider();
  const code = `export default function Page({ user }) {
  return <img src={user.avatarUrl} alt="Avatar" />;
}`;
  const initial = await scan(code, 'app/dashboard/page.tsx', '203.0.113.2');
  const defect = initial.diagnostics.find((d: any) => d.ruleId === 'FIGM-PERF-02');
  assert.ok(defect, 'expected FIGM-PERF-02 to be detected');
  assert.equal(defect.sourceKind, 'REAL_AST');

  // Unlike this suite's other scanFixVerify() cases (FIGM-PERF-01/ANG-02/VUE-01), which all have
  // real deterministic fixers and so pass with or without a configured Claude key, FIGM-PERF-02
  // has no safe deterministic fixer for an image with no statically-determinable dimensions (the
  // deterministic engine correctly declines to hallucinate width/height rather than guess) and so
  // genuinely routes AI_ASSISTED. The live scan response must report fixabilityStatus:
  // 'AUTO_FIX_AVAILABLE' for this -- NOT 'NO_SAFE_FIX' -- since AI-assisted remediation is a real,
  // available path here; see tests/fixability-status-ai-fallback-regression.test.ts for the full
  // regression coverage of this exact bug (getFixabilityStatus() used to consult an independent
  // legacy dry-run instead of decideRemediation(), the same decision this pipeline actually uses).
  // `npm test` deliberately runs without ANTHROPIC_API_KEY (see tests/test-env-setup.mjs);
  // `npm run test:claude` is the dedicated suite that loads .env.local and exercises live Claude
  // calls. Branch on the actual environment rather than hardcoding either outcome, so this test is
  // correct in both.
  assert.equal(defect.fixabilityStatus, 'AUTO_FIX_AVAILABLE', 'AI-assisted remediation is available for FIGM-PERF-02; the Live Scan card must not show "No Safe Fix Available"');
  const fixRes = await scanPOST(aiFixRequest(code, 'app/dashboard/page.tsx', defect, '203.0.113.2'));
  assert.equal(fixRes.status, 200);
  const fixData = await fixRes.json();

  if (process.env.ANTHROPIC_API_KEY) {
    assert.equal(fixData.verified, true, `expected FIGM-PERF-02 fix to be verified; got status=${fixData.verificationStatus}, reason=${fixData.fallbackReason}`);
    assert.equal(fixData.verificationStatus, 'FIXED');
    const rescan = await scan(fixData.remediatedCode, 'app/dashboard/page.tsx', '203.0.113.2');
    assert.ok(!rescan.diagnostics.some((d: any) => d.ruleId === 'FIGM-PERF-02'), 'FIGM-PERF-02 must be gone after a verified fix');
  } else {
    assert.notEqual(fixData.verified, true, 'without a configured Claude key, this must never be reported as verified/fixed');
    // AI_UNAVAILABLE, not UNRESOLVED: no provider is configured at all, so no candidate patch was
    // ever produced (see AIRemediationPipelineResult's verificationStatus doc comment).
    assert.equal(fixData.verificationStatus, 'AI_UNAVAILABLE');
    assert.equal(fixData.remediatedCode, code, 'no code change may be produced when no automated fix is available');
    assert.ok(fixData.fallbackReason?.includes('ANTHROPIC_API_KEY'));
  }
});

test('Live Scan E2E — Angular', async () => {
  RepositoryFactory.resetProvider();
  const code = `import { Component } from '@angular/core';
@Component({ selector: 'app-x', template: '<div></div>' })
export class WidgetComponent {}`;
  const { defect } = await scanFixVerify(code, 'widget.component.ts', 'FIGM-ANG-02', '203.0.113.3');
  assert.equal(defect.sourceKind, 'REAL_AST');
});

test('Live Scan E2E — Vue', async () => {
  RepositoryFactory.resetProvider();
  // FIGM-VUE-01 (missing :key), not FIGM-PERF-02, deliberately: FIGM-PERF-02 on a .vue file is
  // detected via the legacy text-heuristic path (see docs/architecture/AST_MIGRATION_MAP.md) and
  // has no real deterministic fixer for Vue source — AstDeterministicFixEngine only handles
  // TS/TSX/JS, so routing it there and having it decline for a .vue file is architecturally
  // correct (routes AI_ASSISTED), not a bug. It used to appear "FIXED" here only because the now-
  // removed regex-based RemediationEngine fallback silently patched it regardless of framework —
  // exactly the fabricated-success pattern this pipeline must no longer produce (see
  // src/ai/ai-remediation-pipeline.ts's header). FIGM-VUE-01 has both real AST detection
  // (@vue/compiler-sfc/-dom) and a real deterministic fixer (VueAstFixEngine), so it proves the
  // genuine, still-working Vue deterministic-fix guarantee end to end.
  const code = `<template>
  <ul>
    <li v-for="item in items">{{ item.name }}</li>
  </ul>
</template>
<script>
export default {
  data() {
    return { items: [] };
  },
};
</script>`;
  const { defect } = await scanFixVerify(code, 'Widget.vue', 'FIGM-VUE-01', '203.0.113.4');
  // Updated for Phase 2 (AST/Rule Coverage Gaps): FIGM-VUE-01 detection is now REAL_AST (a real
  // @vue/compiler-dom <template> parse via src/ast/vue-template-ast-builder.ts), closing the
  // detection-side gap this comment used to document -- see tests/vue-template-ast-detection.test.ts
  // for dedicated coverage. VueAstFixEngine's remediation was already real-AST-based before this
  // change and remains unaffected; both detection and remediation now agree on the same real
  // @vue/compiler-sfc/-dom AST, rather than detection trailing behind remediation.
  assert.equal(defect.sourceKind, 'REAL_AST');
});

test('Live Scan E2E — plain JavaScript', async () => {
  RepositoryFactory.resetProvider();
  // Uses `const` (not `var`) for the invariant object, matching the exact declaration shape
  // RemediationEngine.applyQuickFix's FIGM-PERF-01 case recognizes (see remediation-engine.ts) --
  // consistent with the same rule's fix used in the React/TypeScript cases below.
  const code = `function build(items) {
  return items.map(function (item) {
    const cfg = { theme: 'dark' };
    return cfg;
  });
}`;
  const { defect } = await scanFixVerify(code, 'utils.js', 'FIGM-PERF-01', '203.0.113.5');
  assert.equal(defect.sourceKind, 'REAL_AST');
});

test('Live Scan E2E — TypeScript', async () => {
  RepositoryFactory.resetProvider();
  const code = `interface Item { id: string; }
function build(items: Item[]) {
  return items.map((item) => {
    const cfg = { theme: 'dark' };
    return cfg;
  });
}`;
  const { defect } = await scanFixVerify(code, 'utils.ts', 'FIGM-PERF-01', '203.0.113.6');
  assert.equal(defect.sourceKind, 'REAL_AST');
});

test('Live Scan E2E — malformed source: never crashes, reports a syntax diagnostic, never falsely claims a fix', async () => {
  RepositoryFactory.resetProvider();
  // Unbalanced braces: RemediationEngine's SYNTAX-PARSE-ERROR case only has a targeted repair for
  // the "const x = ;" / broken-destructuring shapes (see remediation-engine.ts) -- a genuinely
  // *un*repairable structural error like a missing closing brace falls through to its generic
  // "advisory comment" branch, which must NOT be reported as a verified fix (it doesn't change
  // whether the source parses). This deliberately avoids the const/function typo shapes the
  // engine CAN legitimately auto-repair, so this test exercises the actually-unfixable path.
  const malformed = `function broken(items) {\n  return items.map(item => item);\n`;
  const result = await scan(malformed, 'Broken.jsx', '203.0.113.7');
  assert.ok(Array.isArray(result.diagnostics));
  const syntaxError = result.diagnostics.find((d: any) => d.ruleId === 'SYNTAX-PARSE-ERROR');
  assert.ok(syntaxError, 'expected a SYNTAX-PARSE-ERROR diagnostic for malformed input');
  assert.ok(syntaxError.location?.start?.line > 0);

  // Attempting to "fix" a syntax error via the generic remediation path must never be reported
  // as a verified fix -- a text-template advisory comment cannot repair broken syntax.
  const fixRes = await scanPOST(aiFixRequest(malformed, 'Broken.jsx', syntaxError, '203.0.113.7'));
  assert.equal(fixRes.status, 200);
  const fixData = await fixRes.json();
  assert.notEqual(fixData.verified, true, 'a syntax error must never be reported as a verified fix');
});

test('Live Scan E2E — INFRASTRUCTURE_ERROR: an analysis-engine failure returns a sanitized 503, distinct from a code diagnostic, and never leaks internal error detail', async () => {
  // No legitimate (even pathologically malformed/deeply-nested) source input was able to make the
  // real engine throw uncaught -- it is deliberately defensive at every internal layer (see
  // TypeCheckerService's own try/catch, DynamicProfiler's fail-safe resolution). That robustness
  // is exactly why this test has to simulate the ONE failure mode it can't defend against by
  // construction: the analysis engine itself being unavailable (e.g. an unrelated dependency
  // outage). This is fault injection at the real integration seam the route actually calls
  // through, not a mock of the scan pipeline's own logic -- everything else in this suite still
  // exercises the real, undisturbed engine.
  const originalAnalyzeFileAsync = RuleExecutionEngine.analyzeFileAsync;
  const internalDetail = 'ECONNREFUSED 10.0.0.42:5432 — pool exhausted, credentials=hunter2';
  (RuleExecutionEngine as any).analyzeFileAsync = async () => {
    throw new Error(internalDetail);
  };
  try {
    const res = await scanPOST(scanRequest('const x = 1;', 'Infra.tsx', '203.0.113.42'));
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.serviceStatus?.status, 'INFRASTRUCTURE_ERROR');
    assert.equal(body.serviceStatus?.stage, 'ANALYSIS_ENGINE');
    assert.ok(body.serviceStatus?.message, 'must expose a human-readable, safe message');
    assert.equal(body.diagnostics, undefined, 'an infra failure must not masquerade as a completed scan with zero diagnostics');
    assert.ok(
      !JSON.stringify(body).includes(internalDetail),
      'the real internal error detail must never reach the client, even inside a nested field'
    );
  } finally {
    (RuleExecutionEngine as any).analyzeFileAsync = originalAnalyzeFileAsync;
  }
});

test('Live Scan E2E — empty source is rejected with a clear 400, not a crash', async () => {
  const res = await scanPOST(scanRequest('', 'Empty.jsx', '203.0.113.8'));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('Live Scan E2E — no request body is rejected with a controlled 400, not an unhandled 500', async () => {
  const res = await scanPOST(
    new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.13' },
    })
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('Live Scan E2E — malformed JSON body is rejected with a controlled 400, not an unhandled 500', async () => {
  const res = await scanPOST(
    new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.14' },
      body: '{not valid json',
    })
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('Live Scan E2E — empty JSON object still hits the existing "Code string is required" 400 validation', async () => {
  const res = await scanPOST(
    new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.15' },
      body: '{}',
    })
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Code string is required');
});

test('Live Scan E2E — huge source is rejected with 413, not a crash or hang', async () => {
  const huge = 'const x = 1;\n'.repeat(50000); // ~650KB, over the 500KB limit
  const res = await scanPOST(scanRequest(huge, 'Huge.js', '203.0.113.9'));
  assert.equal(res.status, 413);
});

test('Live Scan E2E — unsupported framework (.svelte) degrades to zero findings, not a crash', async () => {
  const code = `<script>\n  let count = 0;\n</script>\n<button on:click={() => count++}>{count}</button>`;
  const result = await scan(code, 'Counter.svelte', '203.0.113.10');
  assert.equal(result.framework, 'SVELTE');
  assert.equal(result.diagnostics.length, 0);
});

test('Live Scan E2E — multiple simultaneous violations are all reported independently, with no duplicate (ruleId, line) pairs', async () => {
  RepositoryFactory.resetProvider();
  const code = `import HeavyChart from 'heavy-chart';

function Dashboard({ items, isOpen }) {
  if (items.length) {
    console.log(HeavyChart);
  }
  return (
    <div>
      <img src="/a.png" alt="a" />
      <div onClick={() => {}} className="clickable">x</div>
      <CustomSelect options={items} />
      {items.map(item => {
        const style = { color: 'red' };
        return <span key={item.id} style={style}>{item.name}</span>;
      })}
      {isOpen && <Modal isOpen={isOpen}><p>content</p></Modal>}
    </div>
  );
}`;
  const result = await scan(code, 'Dashboard.jsx', '203.0.113.11');
  const ids = new Set(result.diagnostics.map((d: any) => d.ruleId));
  for (const expected of ['FIGM-PERF-04', 'FIGM-PERF-02', 'FIGM-A11Y-01', 'FIGM-A11Y-02', 'FIGM-PERF-01', 'FIGM-A11Y-04']) {
    assert.ok(ids.has(expected), `expected ${expected} among: ${[...ids].join(', ')}`);
  }

  // Duplicate-findings guard: no (ruleId, line) pair should be reported twice -- a real risk
  // given the dual real-AST/legacy detection paths introduced by the AST migration, each
  // gated to be mutually exclusive per rule+framework (see AST_MIGRATION_MAP.md).
  const seen = new Set<string>();
  for (const d of result.diagnostics) {
    const key = `${d.ruleId}@${d.location.start.line}`;
    assert.ok(!seen.has(key), `duplicate diagnostic detected: ${key}`);
    seen.add(key);
  }
});

test('Live Scan E2E — REGRESSION: a fix that does not actually resolve the violation must be reported honestly, never FIXED', async () => {
  // This is the exact defect found during this task: the live-scan UI's applyFix() used to
  // unconditionally display "Fixed by {engine}" for any /api/scan {action:'ai-fix'} response,
  // completely ignoring the `verified`/`verificationStatus` fields the API already computed via
  // a real re-scan. This test pins the API contract the UI now depends on: for a rule with no
  // deterministic fixer (FIGM-PERF-05 routes AI_ASSISTED — see AIRemediationRouter) and no
  // ANTHROPIC_API_KEY configured in this test environment, there is genuinely no automated path
  // left, and the response must say so honestly.
  //
  // Note: this used to assert 'MANUAL_REVIEW_REQUIRED', produced by the legacy regex-based
  // RemediationEngine's own `requiresManualReview` flag as an automatic fallback when Claude was
  // unavailable. That regex fallback has been removed from the automated remediation pipeline
  // (architecture rule: AI failure must never silently fall back to regex and report success, or
  // even report a definitive-sounding "manual review" verdict manufactured by a different, lower-
  // scrutiny engine) — 'AI_UNAVAILABLE' is the honest verdict for "no candidate patch was ever
  // produced" (no provider configured at all here), distinct both from 'UNRESOLVED' (a real patch
  // WAS generated and sandbox-validated/re-scanned but still failed — see
  // AIRemediationPipelineResult's verificationStatus doc comment) and from a rule that is
  // *permanently* MANUAL_REVIEW_ONLY at the rule level (FIGM-NEXT-08/09, FIGM-REACT-06 — see
  // tests/ai-remediation-router.test.ts).
  RepositoryFactory.resetProvider();
  const code = `function List({ items }) {
  return items.map(item => <Card onClick={() => handleClick(item.id)} />);
}`;
  const result = await scan(code, 'List.jsx', '203.0.113.12');
  const defect = result.diagnostics.find((d: any) => d.ruleId === 'FIGM-PERF-05');
  assert.ok(defect, 'expected FIGM-PERF-05 (inline callback in render loop) to be detected');

  const fixRes = await scanPOST(aiFixRequest(code, 'List.jsx', defect, '203.0.113.12'));
  assert.equal(fixRes.status, 200);
  const fixData = await fixRes.json();

  assert.notEqual(fixData.verified, true, 'a rule with no automated fix available must never be reported as verified/fixed');
  assert.equal(fixData.verificationStatus, 'AI_UNAVAILABLE');
  assert.equal(fixData.engineType, 'UNAVAILABLE');
  assert.equal(fixData.remediatedCode, code, 'no code change may be produced when no automated fix is available');
  assert.ok(fixData.fallbackReason?.includes('ANTHROPIC_API_KEY'));
});
