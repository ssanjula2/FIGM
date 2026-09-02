import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { CodeErrorFixPipeline } from '../src/ai/code-error-fix-pipeline.js';
import { FigmFixPipeline } from '../src/ai/figm-fix-pipeline.js';
import { TypeCheckerService } from '../src/analysis/type-checker-service.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * TEST C from the remediation-pipeline verification: a genuine syntax/compiler error (not a FIGM
 * rule) routed through CodeErrorFixPipeline -> AIRemediationPipeline -> the active AI provider
 * (mocked Gemini transport here, matching tests/gemini-provider.test.ts's approach) -> validation ->
 * FIGM re-scan -> VERIFIED. Uses the REAL RuleExecutionEngine.analyzeFile to produce the defect
 * (not a hand-constructed one), so this also exercises source-parser.ts's corrected unclosed-
 * bracket location logic end-to-end: the offendingCodeSnippet embedded in the AI prompt must
 * actually match the real current source, or the pipeline's STALE_VIOLATION_CONTEXT guard would
 * reject it before ever reaching the provider.
 */

function mockFetchOnce(handler: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const original = global.fetch;
  (global as any).fetch = handler;
  return () => {
    global.fetch = original;
  };
}

function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
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

test('CodeErrorFixPipeline — general syntax error through the real AI remediation path', async (t) => {
  await t.test('a real unclosed-brace file is detected, and a real-shaped Gemini fix that closes it is VERIFIED', async () => {
    const brokenCode = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return (\n    <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>\n`;
    const filePath = 'src/List.tsx';
    const scan = RuleExecutionEngine.analyzeFile(filePath, brokenCode);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'SYNTAX-PARSE-ERROR');
    assert.ok(defect, 'expected a real SYNTAX-PARSE-ERROR diagnostic');
    assert.equal(defect!.kind, 'GENERAL_CODE_ERROR');
    // Confirms the source-parser fix: the reported line must be the real unclosed bracket (line 1
    // -- the function body's own opening brace), not the last line of this 4-line file.
    assert.equal(defect!.location?.start?.line, 1);
    assert.ok(brokenCode.includes((defect!.offendingCodeSnippet || '').trim()), 'offendingCodeSnippet must actually appear in the source (proves the location fix, not asserted separately)');

    const fixedCode = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return (\n    <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>\n  );\n}\n`;
    const restore = mockFetchOnce(async () =>
      chatResponse(JSON.stringify({ status: 'PATCH', patch: fixedCode, explanation: 'Closed the unclosed return(...) expression and function body.', confidence: 90 }))
    );
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        CodeErrorFixPipeline.apply(brokenCode, defect!, scan.framework)
      );
      assert.equal(result.engineType, 'AI_ASSISTED_FIX');
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');

      const rescan = RuleExecutionEngine.analyzeFile(filePath, result.remediatedCode);
      assert.ok(!rescan.diagnostics.some((d) => d.ruleId === 'SYNTAX-PARSE-ERROR'), 'the syntax error must genuinely be gone on re-scan');
    } finally {
      restore();
    }
  });

  await t.test('refuses a FIGM rule ID outright (scope guard, mirror of FigmFixPipeline)', async () => {
    const figmDefect: DiagnosticReport = {
      ruleId: 'FIGM-REACT-01', ruleName: 'x', message: 'x', domain: 'PERFORMANCE', concern: 'INVARIANT_ALLOCATIONS', severity: 'HIGH',
      filePath: 'x.tsx', location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      offendingCodeSnippet: 'x', remediation: 'x', standardReference: 'x',
    } as DiagnosticReport;
    await assert.rejects(() => CodeErrorFixPipeline.apply('const x = 1;', figmDefect, 'REACT_JSX'), /FigmFixPipeline instead/);
  });

  await t.test('FigmFixPipeline refuses a general code error outright (mirror scope guard)', async () => {
    const syntaxDefect: DiagnosticReport = {
      ruleId: 'SYNTAX-PARSE-ERROR', ruleName: 'x', message: 'x', domain: 'PERFORMANCE', concern: 'RESOURCE_UTILIZATION', severity: 'CRITICAL',
      filePath: 'x.tsx', location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      offendingCodeSnippet: 'x', remediation: 'x', standardReference: 'x',
    } as DiagnosticReport;
    await assert.rejects(() => FigmFixPipeline.apply('const x = 1;', syntaxDefect, 'REACT_JSX'), /CodeErrorFixPipeline instead/);
  });

  // ── General compile/type/syntax error auto-remediation (deterministic + AI fallback) ────────
  await t.test('REAL E2E: "export async funtion GET()" — three real TypeScript diagnostics deduplicated into ONE target, fixed deterministically (no AI call), and independently re-verified via a fresh real scan', async () => {
    const code = `export async funtion GET() {\n  return Response.json({ ok: true });\n}\n`;
    const filePath = 'route.ts';
    const scan = TypeCheckerService.checkCode(code, filePath);
    assert.deepEqual(scan.diagnostics.map((d) => d.ruleId), ['TYPE-TS-1434', 'TYPE-TS-1435', 'TYPE-TS-2552']);

    // Worst-case caller selection: the diagnostic with no usable suggestion of its own.
    const target = scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-1434')!;
    let fetchCalled = false;
    const restore = mockFetchOnce(async () => {
      fetchCalled = true;
      throw new Error('AI must never be called — a safe deterministic fix exists');
    });
    try {
      const result = await CodeErrorFixPipeline.apply(code, target, 'GENERIC_ESTREE', scan.diagnostics);
      assert.equal(fetchCalled, false, 'AI must never be reached when a safe deterministic fix exists');
      assert.equal(result.engineType, 'AST_DETERMINISTIC_FIX');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      assert.equal(result.remediatedCode, code.replace('funtion', 'function'), 'ONLY the typo must change — every other byte must be identical');

      const rescan = TypeCheckerService.checkCode(result.remediatedCode, filePath);
      assert.deepEqual(rescan.diagnostics, [], 'an independent, fresh re-scan must confirm ALL THREE original diagnostics (not just the one clicked) are gone');
    } finally {
      restore();
    }
  });

  await t.test('a general compile error with NO safe deterministic fix (a real type mismatch, not a typo) falls through to AI, whose oversized patch is rejected by PATCH_SCOPE and whose minimal patch is then accepted and verified', async () => {
    const codeLines = [
      `function computeTotal(items) {`,
      `  let total: number = "0";`,
      `  for (const item of items) {`,
      `    total += item.price;`,
      `  }`,
      `  return total;`,
      `}`,
      ``,
      `function formatTotal(total) {`,
      `  return \`$\${total.toFixed(2)}\`;`,
      `}`,
      ``,
      `export { computeTotal, formatTotal };`,
    ];
    const code = codeLines.join('\n');
    const filePath = 'totals.ts';
    const scan = TypeCheckerService.checkCode(code, filePath);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-2322');
    assert.ok(defect, 'expected a real TS2322 type-mismatch diagnostic (not a typo — LexicalTypoFixEngine must decline this)');

    const minimalFixLines = [...codeLines];
    minimalFixLines[1] = `  let total: number = 0;`;
    const minimalFixCode = minimalFixLines.join('\n');
    const oversizedFixLines = [minimalFixLines[0], ...Array.from({ length: 20 }, (_, i) => `  // unrelated rewritten padding line ${i}`), ...minimalFixLines.slice(1)];
    const oversizedFixCode = oversizedFixLines.join('\n');

    let callCount = 0;
    const restore = mockFetchOnce(async () => {
      callCount += 1;
      const patch = callCount < 2 ? oversizedFixCode : minimalFixCode;
      return chatResponse(JSON.stringify({ status: 'PATCH', patch, explanation: callCount < 2 ? 'Rewrote the file.' : 'Changed the initializer to a number literal.', confidence: callCount < 2 ? 60 : 95 }));
    });
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        CodeErrorFixPipeline.apply(code, defect!, 'GENERIC_ESTREE', scan.diagnostics)
      );
      assert.equal(callCount, 2, 'expected 1 oversized rejection then 1 accepted minimal patch');
      assert.equal(result.engineType, 'AI_ASSISTED_FIX');
      assert.equal(result.provider, 'GEMINI');
      assert.equal(result.verified, true);
      assert.equal(result.verificationStatus, 'FIXED');
      assert.equal(result.remediatedCode, minimalFixCode);

      const rescan = TypeCheckerService.checkCode(result.remediatedCode, filePath);
      assert.equal(rescan.diagnostics.some((d) => d.ruleId === 'TYPE-TS-2322'), false, 'the real type-mismatch violation must be confirmed gone by re-scan');
    } finally {
      restore();
    }
  });

  await t.test('CRITICAL regression: a patch that silences only the representative diagnostic while a genuinely related sibling (same line, real TypeScript diagnostic, different ruleId) still remains is REJECTED, never reported FIXED, and the original source is untouched', async () => {
    // Real, reproduced fixture: `funtion` typo + an unrelated type mismatch on the SAME line
    // produce THREE real diagnostics (TYPE-TS-2322, TYPE-TS-1435, TYPE-TS-2552) grouped together.
    const code = `const a: number = "x"; funtion foo() {}\n`;
    const filePath = 'mixed.ts';
    const scan = TypeCheckerService.checkCode(code, filePath);
    assert.deepEqual(scan.diagnostics.map((d) => d.ruleId).sort(), ['TYPE-TS-1435', 'TYPE-TS-2322', 'TYPE-TS-2552'].sort());
    const target = scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-2322')!;

    // The AI patch fixes ONLY the type mismatch (`a`) and leaves the `funtion` typo completely
    // untouched — a real, syntactically valid, minimally-scoped patch that nonetheless fixes only
    // PART of the grouped defect.
    const partialPatch = `const a: number = 1; funtion foo() {}\n`;
    const restore = mockFetchOnce(async () => chatResponse(JSON.stringify({ status: 'PATCH', patch: partialPatch, explanation: 'Fixed the type mismatch.', confidence: 90 })));
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        CodeErrorFixPipeline.apply(code, target, 'GENERIC_ESTREE', scan.diagnostics)
      );
      assert.notEqual(result.verificationStatus, 'FIXED', 'a patch that leaves a related sibling diagnostic (from the SAME underlying defect) present must never be reported FIXED');
      assert.equal(result.remediatedCode, code, 'the original source must be completely untouched when the candidate is rejected');
    } finally {
      restore();
    }
  });

  await t.test('three failed AI attempts on a general compile error result in UNRESOLVED, never bypassing validation', async () => {
    const code = `function greet(name) {\n  const message: number = "hello " + name;\n  return message;\n}\n\nexport { greet };\n`;
    const filePath = 'greet.ts';
    const scan = TypeCheckerService.checkCode(code, filePath);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-2322');
    assert.ok(defect);

    // A patch that never actually fixes the type mismatch (renames an unrelated local only).
    const neverFixes = code.replace('function greet(name)', 'function greet(name /* renamed nothing */)');
    let callCount = 0;
    const restore = mockFetchOnce(async () => {
      callCount += 1;
      return chatResponse(JSON.stringify({ status: 'PATCH', patch: neverFixes, explanation: 'attempt', confidence: 50 }));
    });
    try {
      const result = await withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test_key_not_real' }, () =>
        CodeErrorFixPipeline.apply(code, defect!, 'GENERIC_ESTREE', scan.diagnostics)
      );
      assert.equal(callCount, 3, 'a real compile-error rejection must be retried up to the existing budget, never treated as a permanent provider failure');
      assert.equal(result.engineType, 'UNAVAILABLE');
      assert.equal(result.verified, false);
      assert.equal(result.verificationStatus, 'UNRESOLVED');
      assert.equal(result.remediatedCode, code, 'the original source must remain unchanged after all attempts are exhausted');
    } finally {
      restore();
    }
  });
});
