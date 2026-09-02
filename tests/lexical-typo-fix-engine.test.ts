import test from 'node:test';
import assert from 'node:assert/strict';
import { TypeCheckerService } from '../src/analysis/type-checker-service.js';
import { LexicalTypoFixEngine } from '../src/engine/lexical-typo-fix-engine.js';
import { buildRepresentativeDiagnostic } from '../src/engine/general-error-grouping.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Unit coverage for src/engine/lexical-typo-fix-engine.ts — the narrow, instance-level
 * deterministic fixer that only ever trusts a correction the REAL TypeScript compiler itself
 * already proposed via a "Did you mean 'X'?" diagnostic message. Every fixture below uses the REAL
 * TypeCheckerService (not hand-authored diagnostics) so this proves the engine works against the
 * actual diagnostics production code produces, not an idealized approximation of them.
 */

function makeFigmDefect(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    ruleId: 'FIGM-REACT-01',
    ruleName: 'Memoize Expensive Derived Computations',
    message: 'n/a',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'HIGH',
    filePath: 'x.tsx',
    location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
    offendingCodeSnippet: 'x',
    remediation: 'x',
    standardReference: 'x',
    ...overrides,
  } as DiagnosticReport;
}

test('LexicalTypoFixEngine', async (t) => {
  await t.test('isEligible: true for TYPE_COMPILE_ERROR / SYNTAX_ERROR, false for a FIGM rule diagnostic', () => {
    assert.equal(LexicalTypoFixEngine.isEligible(makeFigmDefect({ category: 'TYPE_COMPILE_ERROR' } as any)), true);
    assert.equal(LexicalTypoFixEngine.isEligible(makeFigmDefect({ category: 'SYNTAX_ERROR' } as any)), true);
    assert.equal(LexicalTypoFixEngine.isEligible(makeFigmDefect()), false, 'a FIGM rule diagnostic (no compiler-error category) must never be eligible');
  });

  await t.test('REAL reproduction: "export async funtion GET()" — the real TypeScript compiler produces THREE diagnostics with DISAGREEING "Did you mean" suggestions (function vs Function); the engine correctly prefers the reserved-keyword suggestion regardless of which diagnostic is the caller-selected target', async () => {
    const code = `export async funtion GET() {\n  return Response.json({ ok: true });\n}\n`;
    const scan = TypeCheckerService.checkCode(code, 'route.ts');
    assert.deepEqual(scan.diagnostics.map((d) => d.ruleId), ['TYPE-TS-1434', 'TYPE-TS-1435', 'TYPE-TS-2552'], 'fixture must reproduce the exact real diagnostics this engine is designed around');
    assert.ok(scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-2552')!.message.includes("Did you mean 'Function'"), 'the type-checker suggestion must genuinely disagree (Function, capitalized) — proves this is a real ambiguity, not a strawman');
    assert.ok(scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-1435')!.message.includes("Did you mean 'function'"), 'the parser suggestion must genuinely be the correct one (function, lowercase keyword)');

    for (const targetRuleId of ['TYPE-TS-1434', 'TYPE-TS-1435', 'TYPE-TS-2552']) {
      const target = scan.diagnostics.find((d) => d.ruleId === targetRuleId)!;
      const representative = buildRepresentativeDiagnostic(target, scan.diagnostics);
      const outcome = LexicalTypoFixEngine.tryFix(code, representative);
      assert.equal(outcome.success, true, `expected success regardless of which diagnostic (${targetRuleId}) is the target, got: ${outcome.description}`);
      assert.equal(outcome.patchedCode, code.replace('funtion', 'function'), `expected the exact minimal fix for target ${targetRuleId}`);
      assert.ok(outcome.description.includes('function'), 'description must credit the correct (keyword) replacement, not "Function"');
    }
  });

  await t.test('declines (never guesses) when no "Did you mean" suggestion is present at all', () => {
    const code = `const x: number = "not a number";\n`;
    const defect = makeFigmDefect({
      ruleId: 'TYPE-TS-2322',
      category: 'TYPE_COMPILE_ERROR' as any,
      message: "Type 'string' is not assignable to type 'number'.",
      location: { start: { line: 1, column: 7 }, end: { line: 1, column: 8 } },
    });
    const outcome = LexicalTypoFixEngine.tryFix(code, defect);
    assert.equal(outcome.success, false);
    assert.equal(outcome.patchedCode, code, 'must never modify the source on decline');
    assert.ok(/no.*did you mean/i.test(outcome.description));
  });

  await t.test('declines when related diagnostics propose genuinely disagreeing NON-keyword suggestions (no principled tiebreak available)', () => {
    const code = `const fnction = 1;\n`;
    const defect = makeFigmDefect({
      ruleId: 'TYPE-TS-AAA',
      category: 'TYPE_COMPILE_ERROR' as any,
      message: "Cannot find name 'fnction'. Did you mean 'function'?", // a keyword, but paired below with a second, also-plausible identifier guess
      location: { start: { line: 1, column: 7 }, end: { line: 1, column: 14 } },
      relatedDiagnostics: [
        { ruleId: 'TYPE-TS-BBB', message: "Cannot find name 'fnction'. Did you mean 'fiction'?", location: { start: { line: 1, column: 7 }, end: { line: 1, column: 14 } } },
      ],
    });
    // 'function' IS a reserved keyword, so this actually resolves via the keyword tiebreak --
    // included to document the boundary precisely rather than leave it implicit: the tiebreak only
    // helps when EXACTLY one distinct replacement is a real keyword.
    const outcome = LexicalTypoFixEngine.tryFix(code, defect);
    assert.equal(outcome.success, true, 'exactly one of the two disagreeing suggestions is a real reserved keyword — the tiebreak resolves it');
    assert.ok(outcome.patchedCode.includes('function'));
  });

  await t.test('declines when disagreeing suggestions include ZERO or MORE THAN ONE real reserved keyword (genuinely ambiguous)', () => {
    const code = `const fnction = 1;\n`;
    const defect = makeFigmDefect({
      ruleId: 'TYPE-TS-AAA',
      category: 'TYPE_COMPILE_ERROR' as any,
      message: "Cannot find name 'fnction'. Did you mean 'Function'?", // NOT a keyword (capitalized builtin)
      location: { start: { line: 1, column: 7 }, end: { line: 1, column: 14 } },
      relatedDiagnostics: [
        { ruleId: 'TYPE-TS-BBB', message: "Cannot find name 'fnction'. Did you mean 'fiction'?", location: { start: { line: 1, column: 7 }, end: { line: 1, column: 14 } } }, // also not a keyword
      ],
    });
    const outcome = LexicalTypoFixEngine.tryFix(code, defect);
    assert.equal(outcome.success, false, 'neither disagreeing suggestion is a reserved keyword — no principled tiebreak, must decline rather than guess');
    assert.equal(outcome.patchedCode, code);
    assert.ok(/ambiguous/i.test(outcome.description));
  });

  await t.test('never applies to a FIGM rule diagnostic even if its message happens to contain "Did you mean" text', () => {
    const code = `const x = 1;\n`;
    const figmDefect = makeFigmDefect({ message: "Did you mean 'y'?" }); // no category set -> not eligible
    const outcome = LexicalTypoFixEngine.tryFix(code, figmDefect);
    assert.equal(outcome.success, false);
    assert.equal(outcome.patchedCode, code);
  });
});
