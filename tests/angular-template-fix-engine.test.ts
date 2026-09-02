import test from 'node:test';
import assert from 'node:assert/strict';
import * as ts from 'typescript';
import { parseHtml } from 'angular-html-parser';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { AngularTemplateFixEngine, ANGULAR_TEMPLATE_RULE_META } from '../src/engine/angular-template-fix-engine.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Phase 03 validation suite for the Angular Template AST Deterministic Fix Layer
 * (src/engine/angular-template-fix-engine.ts). For each of the 4 FIGM-ANG template rules this
 * proves, against the REAL detection pipeline (SourceParser + ASTDetectionEngine — the same one
 * production scans use):
 *
 *   detect(before) -> locate+fix() -> compile-check(after) -> re-scan(after) -> violation gone?
 *
 * "Compile-check" here means what real tooling is actually installed in this repo: the outer
 * .component.ts file still parses as valid TypeScript with zero new syntax errors (ts.createSourceFile),
 * and the patched inline template still parses successfully as Angular template markup
 * (angular-html-parser, tokenizeAngularBlocks). This repo has no @angular/compiler AOT type-checker
 * installed, so this suite does not claim to run one — that would be exactly the kind of
 * unverified claim this project's own history warns against.
 *
 * FIGM-ANG-03 and FIGM-ANG-08 get real deterministic rewrites, verified end-to-end. FIGM-ANG-04
 * and FIGM-ANG-10 are proven to genuinely LOCATE the violating node (so declining isn't a cop-out
 * for "couldn't find it") and then decline with requiresManualReview: true — that decline is the
 * correct, honest outcome for these two rules, not a bug to be fixed.
 */

function detect(code: string, filePath: string): DiagnosticReport[] {
  const parsed = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
}

function assertOuterFileStillParses(code: string, filePath: string) {
  const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const parseDiagnostics = (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? [];
  assert.equal(parseDiagnostics.length, 0, `patched .component.ts must still be syntactically valid TypeScript, got:\n${code}`);
}

function extractInlineTemplate(code: string): string {
  const match = /template\s*:\s*`([\s\S]*?)`/.exec(code);
  assert.ok(match, 'expected an inline `template: `...`` block in the patched code');
  return match![1];
}

function assertTemplateStillParses(code: string) {
  const templateContent = extractInlineTemplate(code);
  assert.doesNotThrow(() => parseHtml(templateContent, { tokenizeAngularBlocks: true }), 'patched Angular template markup must still parse cleanly');
}

test('Angular Template AST Deterministic Fix Layer (Phase 03)', async (t) => {
  await t.test('rule metadata covers exactly FIGM-ANG-03/04/08/10, matching SUPPORTED_RULE_IDS', () => {
    assert.deepEqual(
      new Set(ANGULAR_TEMPLATE_RULE_META.map((m) => m.id)),
      AngularTemplateFixEngine.SUPPORTED_RULE_IDS
    );
    assert.equal(ANGULAR_TEMPLATE_RULE_META.length, 4);
    const autoFix = ANGULAR_TEMPLATE_RULE_META.filter((m) => m.autoFixAvailable).map((m) => m.id).sort();
    const manual = ANGULAR_TEMPLATE_RULE_META.filter((m) => !m.autoFixAvailable).map((m) => m.id).sort();
    assert.deepEqual(autoFix, ['FIGM-ANG-03', 'FIGM-ANG-08']);
    assert.deepEqual(manual, ['FIGM-ANG-04', 'FIGM-ANG-10']);
  });

  await t.test('FIGM-ANG-03: *ngFor missing trackBy -> trackBy: trackById, verified end-to-end', () => {
    const before = `@Component({
  selector: 'app-list',
  template: \`
    <div *ngFor="let item of items">{{ item.name }}</div>
  \`
})
export class ListComponent {}`;
    const filePath = 'list.component.ts';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-ANG-03');
    assert.ok(defect, 'FIGM-ANG-03 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = AngularTemplateFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, true, outcome.description);
    assert.notEqual(outcome.patchedCode, before);
    assert.ok(outcome.patchedCode.includes('*ngFor="let item of items; trackBy: trackById"'), `got:\n${outcome.patchedCode}`);
    // Only the *ngFor attribute value changed — everything else in the file, including the
    // interpolation and the class body, must be byte-identical.
    assert.ok(outcome.patchedCode.includes('{{ item.name }}'));
    assert.ok(outcome.patchedCode.includes('export class ListComponent {}'));

    assertOuterFileStillParses(outcome.patchedCode, filePath);
    assertTemplateStillParses(outcome.patchedCode);

    const afterDiags = detect(outcome.patchedCode, filePath);
    assert.ok(!afterDiags.some((d) => d.ruleId === 'FIGM-ANG-03'), 'FIGM-ANG-03 must be genuinely resolved on re-scan');
  });

  await t.test('FIGM-ANG-08: @for track $index -> track item.id, verified end-to-end', () => {
    const before = `@Component({
  selector: 'app-list',
  template: \`
    @for (item of items; track $index) {
      <div>{{ item.name }}</div>
    }
  \`
})
export class ListComponent {}`;
    const filePath = 'list.component.ts';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-ANG-08');
    assert.ok(defect, 'FIGM-ANG-08 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = AngularTemplateFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, true, outcome.description);
    assert.notEqual(outcome.patchedCode, before);
    assert.ok(outcome.patchedCode.includes('@for (item of items; track item.id)'), `got:\n${outcome.patchedCode}`);
    assert.ok(!outcome.patchedCode.includes('track $index'));

    assertOuterFileStillParses(outcome.patchedCode, filePath);
    assertTemplateStillParses(outcome.patchedCode);

    const afterDiags = detect(outcome.patchedCode, filePath);
    assert.ok(!afterDiags.some((d) => d.ruleId === 'FIGM-ANG-08'), 'FIGM-ANG-08 must be genuinely resolved on re-scan');
  });

  await t.test('FIGM-ANG-04: template method call is located but declines with requiresManualReview (routes to AI layer)', () => {
    const before = `@Component({
  selector: 'app-total',
  template: \`
    <span>{{ computeTotal() }}</span>
  \`
})
export class TotalComponent {}`;
    const filePath = 'total.component.ts';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-ANG-04');
    assert.ok(defect, 'FIGM-ANG-04 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = AngularTemplateFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, false, 'FIGM-ANG-04 must never be auto-fixed — it requires knowing what the method computes');
    assert.equal(outcome.requiresManualReview, true);
    assert.equal(outcome.patchedCode, before, 'a declined fix must never mutate the source');
    assert.ok(!outcome.description.toLowerCase().includes('could not locate'), 'the node WAS located — this must decline for a real reason, not a lookup failure');
  });

  await t.test('FIGM-ANG-10: duplicate async pipe is located but declines with requiresManualReview (routes to AI layer)', () => {
    const before = `@Component({
  selector: 'app-data',
  template: \`
    <div>{{ data$ | async }}</div>
    <div>{{ (data$ | async)?.length }}</div>
  \`
})
export class DataComponent {}`;
    const filePath = 'data.component.ts';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-ANG-10');
    assert.ok(defect, 'FIGM-ANG-10 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = AngularTemplateFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, false, 'FIGM-ANG-10 must never be auto-fixed — it requires restructuring the surrounding markup');
    assert.equal(outcome.requiresManualReview, true);
    assert.equal(outcome.patchedCode, before, 'a declined fix must never mutate the source');
    assert.ok(!outcome.description.toLowerCase().includes('could not locate'), 'the node WAS located — this must decline for a real reason, not a lookup failure');
  });

  await t.test('declines gracefully (never throws, never mutates) when no inline template exists at all', () => {
    const before = `@Component({ selector: 'app-x', templateUrl: './x.component.html' })\nexport class XComponent {}`;
    const defect: DiagnosticReport = {
      ruleId: 'FIGM-ANG-03',
      ruleName: 'n/a',
      message: 'n/a',
      domain: 'ACCESSIBILITY',
      concern: 'n/a',
      severity: 'HIGH',
      filePath: 'x.component.ts',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      offendingCodeSnippet: before,
      remediation: 'n/a',
      standardReference: 'n/a',
    } as unknown as DiagnosticReport;

    const outcome = AngularTemplateFixEngine.tryFix(before, defect, 'x.component.ts');
    assert.equal(outcome.success, false);
    assert.equal(outcome.patchedCode, before);
  });

  await t.test('a rule outside the Angular template subset is declined, not attempted', () => {
    assert.equal(AngularTemplateFixEngine.isEligible('FIGM-ANG-02'), false);
  });
});
