import test from 'node:test';
import assert from 'node:assert/strict';
import { TypeCheckerService } from '../src/analysis/type-checker-service.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { POST as scanPOST } from '../app/api/scan/route.js';

/**
 * REGRESSION (found live, reproduced from a real report of "broken code reports 0 issues / Quality
 * 100 / No Issues Found"): TypeCheckerService.checkCode used to skip ALL TypeScript compiler
 * diagnostics for a .js/.jsx file unless the code happened to contain a type-annotation-shaped
 * substring (`': '`, `'interface '`, `'type '`) — including genuine SYNTAX errors the compiler's
 * own parser catches independent of type checking (e.g. TS17008 "JSX element has no corresponding
 * closing tag"). A plain .jsx file containing only `<SomeComponent>` (no closing tag) came back
 * with zero diagnostics. Fixed by always running the cheap syntactic-diagnostics pass regardless
 * of file extension/content, and only gating the expensive semantic/type-inference pass behind the
 * "is there anything type-shaped to check" heuristic.
 */

function scanRequest(code: string, fileName: string, ip: string): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ code, fileName }),
  });
}
async function scan(code: string, fileName: string, ip: string): Promise<any> {
  const res = await scanPOST(scanRequest(code, fileName, ip));
  assert.equal(res.status, 200);
  return res.json();
}

test('TypeCheckerService — syntax diagnostics on plain JS/JSX (not just TS/TSX)', async (t) => {
  await t.test('unclosed JSX tag is detected directly via TypeCheckerService for .jsx', () => {
    const result = TypeCheckerService.checkCode('<SomeComponent>', 'Bare.jsx');
    assert.ok(result.hasTypeErrors, 'expected a real diagnostic for an unclosed JSX tag in a .jsx file');
    assert.ok(result.diagnostics.some((d) => d.ruleId === 'TYPE-TS-17008'));
  });

  await t.test('unclosed JSX tag is detected directly via TypeCheckerService for plain .js', () => {
    const result = TypeCheckerService.checkCode('<SomeComponent>', 'Bare.js');
    assert.ok(result.hasTypeErrors, 'expected a real diagnostic for an unclosed JSX tag in a .js file');
    assert.ok(result.diagnostics.some((d) => d.ruleId === 'TYPE-TS-17008'));
  });

  await t.test('valid JSX in a .jsx file produces no false positives', () => {
    const result = TypeCheckerService.checkCode('function X() { return <div>Hello</div>; }', 'Valid.jsx');
    assert.equal(result.hasTypeErrors, false, `expected no diagnostics, got: ${JSON.stringify(result.diagnostics)}`);
  });

  await t.test('a .js/.jsx file with real type annotations still runs the full semantic check (regression: the gate itself must still work)', () => {
    // `: number` is exactly the "type-shaped" heuristic substring that must still enable the full
    // semantic pass — confirms the fix did not accidentally disable semantic checking altogether.
    const result = TypeCheckerService.checkCode('/** @type {string} */\nconst x: number = "not a number";', 'Typed.js');
    assert.ok(result.diagnostics.length > 0, 'expected the semantic type-mismatch to still be caught');
  });

  await t.test('end-to-end via RuleExecutionEngine.analyzeFile: unclosed JSX tag in a real .jsx fixture is a real GENERAL_CODE_ERROR', () => {
    const code = `export default function Page() {\n  return (\n    <SomeComponent>\n  );\n}\n`;
    const scanResult = RuleExecutionEngine.analyzeFile('Broken.jsx', code);
    assert.ok(scanResult.diagnostics.length > 0, 'expected a real diagnostic for the unclosed JSX tag');
    assert.ok(scanResult.diagnostics.some((d) => d.kind === 'GENERAL_CODE_ERROR'));
    assert.equal(scanResult.generalCodeErrorCount > 0, true);
  });

  await t.test('end-to-end via the real /api/scan route: broken .jsx source must never report "No Issues Found" (totalErrors=0, quality=100)', async () => {
    const code = `export default function Page() {\n  return (\n    <SomeComponent>\n  );\n}\n`;
    const body = await scan(code, 'RouteBroken.jsx', '203.0.113.230');
    assert.ok(body.totalErrors > 0, `expected totalErrors > 0, got: ${JSON.stringify({ totalErrors: body.totalErrors, qualityScore: body.qualityScore, diagnostics: body.diagnostics })}`);
    assert.notEqual(body.qualityScore, 100, 'a broken file must never score a perfect 100');
    assert.equal(body.figmRuleCount + body.generalCodeErrorCount, body.diagnostics.length);
  });

  await t.test('end-to-end via the real /api/scan route: genuinely valid .jsx source correctly reports zero issues (no over-correction / false positives)', async () => {
    const code = `export default function Page() {\n  return <div>Hello</div>;\n}\n`;
    const body = await scan(code, 'RouteValid.jsx', '203.0.113.231');
    assert.equal(body.totalErrors, 0);
    assert.equal(body.qualityScore, 100);
    assert.equal(body.diagnostics.length, 0);
  });
});
