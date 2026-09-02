import test from 'node:test';
import assert from 'node:assert/strict';
import { TypeCheckerService } from '../src/analysis/type-checker-service.js';
import { groupGeneralCodeErrorDiagnostics, buildRepresentativeDiagnostic } from '../src/engine/general-error-grouping.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/** Unit coverage for src/engine/general-error-grouping.ts's deduplication of GENERAL_CODE_ERROR
 *  diagnostics likely caused by one underlying source defect. Uses the real TypeCheckerService for
 *  the primary fixture (not hand-authored diagnostics) — the exact real reproduction this module
 *  exists for. */

function figmDefect(overrides: Partial<DiagnosticReport>): DiagnosticReport {
  return {
    ruleId: 'FIGM-REACT-01', ruleName: 'x', message: 'x', domain: 'PERFORMANCE', concern: 'INVARIANT_ALLOCATIONS', severity: 'HIGH',
    filePath: 'x.tsx', location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
    offendingCodeSnippet: 'x', remediation: 'x', standardReference: 'x',
    ...overrides,
  } as DiagnosticReport;
}

test('general-error-grouping', async (t) => {
  await t.test('groups the real "funtion" typo diagnostics (all on line 1) into one group', () => {
    const code = `export async funtion GET() {\n  return Response.json({ ok: true });\n}\n`;
    const scan = TypeCheckerService.checkCode(code, 'route.ts');
    const groups = groupGeneralCodeErrorDiagnostics(scan.diagnostics);
    assert.equal(groups.length, 1, `expected exactly one group, got ${groups.length}: ${JSON.stringify(groups.map((g) => g.map((d) => d.ruleId)))}`);
    assert.equal(groups[0].length, 3);
  });

  await t.test('diagnostics on DIFFERENT lines are never grouped together', () => {
    const code = `const a: number = "x";\nconst b: number = "y";\n`;
    const scan = TypeCheckerService.checkCode(code, 'x.ts');
    assert.ok(scan.diagnostics.length >= 2, 'fixture must produce at least 2 real diagnostics');
    const groups = groupGeneralCodeErrorDiagnostics(scan.diagnostics);
    assert.equal(groups.length, scan.diagnostics.length, 'each diagnostic on its own distinct line must be its own singleton group');
  });

  await t.test('a FIGM_RULE diagnostic is NEVER merged with a GENERAL_CODE_ERROR diagnostic on the same line', () => {
    const figm = figmDefect({ filePath: 'x.tsx', location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } });
    const general: DiagnosticReport = {
      ruleId: 'TYPE-TS-1005', ruleName: 'x', category: 'TYPE_COMPILE_ERROR' as any, message: "';' expected.",
      domain: 'PERFORMANCE', concern: 'RESOURCE_UTILIZATION', severity: 'HIGH', filePath: 'x.tsx',
      location: { start: { line: 1, column: 5 }, end: { line: 1, column: 6 } }, offendingCodeSnippet: 'x', remediation: 'x', standardReference: 'x',
    } as DiagnosticReport;
    const groups = groupGeneralCodeErrorDiagnostics([figm, general]);
    assert.equal(groups.length, 2, 'a FIGM rule and a general error on the same line must never be grouped together');
  });

  await t.test('every FIGM_RULE diagnostic is always its own singleton group, even with several on the same line', () => {
    const a = figmDefect({ ruleId: 'FIGM-REACT-01', location: { start: { line: 5, column: 1 }, end: { line: 5, column: 2 } } });
    const b = figmDefect({ ruleId: 'FIGM-REACT-02', location: { start: { line: 5, column: 10 }, end: { line: 5, column: 11 } } });
    const groups = groupGeneralCodeErrorDiagnostics([a, b]);
    assert.equal(groups.length, 2, 'FIGM_RULE diagnostics are never grouped, regardless of line proximity');
  });

  await t.test('buildRepresentativeDiagnostic: populates relatedDiagnostics with every OTHER group member (ruleId + message + location), never including itself', () => {
    const code = `export async funtion GET() {\n  return Response.json({ ok: true });\n}\n`;
    const scan = TypeCheckerService.checkCode(code, 'route.ts');
    const target = scan.diagnostics.find((d) => d.ruleId === 'TYPE-TS-1434')!;
    const representative = buildRepresentativeDiagnostic(target, scan.diagnostics);
    assert.ok(representative.relatedDiagnostics);
    assert.equal(representative.relatedDiagnostics!.length, 2);
    assert.deepEqual(representative.relatedDiagnostics!.map((d) => d.ruleId).sort(), ['TYPE-TS-1435', 'TYPE-TS-2552']);
    assert.equal(representative.relatedDiagnostics!.some((d) => d.ruleId === target.ruleId), false, 'must never include itself');
    for (const d of representative.relatedDiagnostics!) {
      assert.ok(d.message, 'each related entry must carry the sibling\'s real message');
      assert.ok(d.location, 'each related entry must carry the sibling\'s real location, needed by LexicalTypoFixEngine');
    }
  });

  await t.test('buildRepresentativeDiagnostic: leaves an ungrouped (singleton) diagnostic completely unmodified', () => {
    const code = `const a: number = "x";\n`;
    const scan = TypeCheckerService.checkCode(code, 'x.ts');
    const target = scan.diagnostics[0];
    const representative = buildRepresentativeDiagnostic(target, scan.diagnostics);
    assert.deepEqual(representative, target);
    assert.equal(representative.relatedDiagnostics, undefined);
  });

  await t.test('buildRepresentativeDiagnostic: returns the target completely unmodified when it is not found in allDiagnostics (stale/mismatched data)', () => {
    const target = figmDefect({ ruleId: 'TYPE-TS-9999', category: 'TYPE_COMPILE_ERROR' as any, filePath: 'nowhere.ts' });
    const representative = buildRepresentativeDiagnostic(target, []);
    assert.deepEqual(representative, target);
  });
});
