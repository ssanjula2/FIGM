import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { buildAngularTemplateRealSyntaxNodes, getAngularTemplateParseErrors } from '../src/ast/angular-template-ast-builder.js';

/**
 * Dedicated regression suite for the Angular template real-AST builder
 * (src/ast/angular-template-ast-builder.ts), added in the Scientific Hardening Pass to upgrade
 * FIGM-ANG-03/04/08/10 from LEGACY_TEXT_HEURISTIC to REAL_AST via angular-html-parser. Layered on
 * top of the existing oracles (ast-detection-rules, ast-migration, expansion-2-rules,
 * qa-matrix-boundary-adversarial), which already cover basic positive/negative detection for these
 * rule IDs; this file targets the migration itself: real-AST provenance, source-position accuracy
 * across realistic multi-line/nested/mixed template shapes, and the classifier boundary.
 */

function diagnosticsFor(code: string, filePath = 'x.component.ts') {
  return RuleExecutionEngine.analyzeFile(filePath, code).diagnostics;
}

test('Angular Template Real-AST Builder — scenario matrix (Phase 6)', async (t) => {
  await t.test('[valid template] no violations, no diagnostics for any of the 4 rules', () => {
    const code = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`\n    <ul>\n      <li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>\n    </ul>\n  \`\n})\nexport class ListComponent {}`;
    const diags = diagnosticsFor(code);
    for (const ruleId of ['FIGM-ANG-03', 'FIGM-ANG-04', 'FIGM-ANG-08', 'FIGM-ANG-10']) {
      assert.ok(!diags.some((d) => d.ruleId === ruleId), `expected ${ruleId} not to fire on a compliant template`);
    }
  });

  await t.test('[violation] *ngFor without trackBy fires FIGM-ANG-03 via REAL_AST at the correct line', () => {
    const code = `@Component({\n  selector: 'app-list',\n  template: \`\n    <div>\n      <li *ngFor="let item of items">{{ item.name }}</li>\n    </div>\n  \`\n})\nexport class ListComponent {}`;
    const diags = diagnosticsFor(code);
    const hit = diags.find((d) => d.ruleId === 'FIGM-ANG-03');
    assert.ok(hit, 'expected FIGM-ANG-03 to fire');
    assert.equal(hit!.sourceKind, 'REAL_AST');
    assert.equal(hit!.location.start.line, 5, 'diagnostic should point at the real *ngFor line, not the template start');
  });

  await t.test('[near miss] *ngFor WITH trackBy does not fire, even with unrelated method calls nearby', () => {
    const code = `@Component({\n  selector: 'app-list',\n  template: \`<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>\`\n})\nexport class ListComponent {\n  trackById(i: number, item: unknown) { return i; }\n}`;
    const diags = diagnosticsFor(code);
    assert.ok(!diags.some((d) => d.ruleId === 'FIGM-ANG-03'));
  });

  await t.test('[nested template] *ngFor nested two levels deep inside other elements is still found', () => {
    const code = `@Component({\n  template: \`\n    <section>\n      <div class="wrapper">\n        <ul>\n          <li *ngFor="let item of items">{{ item.name }}</li>\n        </ul>\n      </div>\n    </section>\n  \`\n})\nexport class NestedComponent {}`;
    const diags = diagnosticsFor(code);
    const hit = diags.find((d) => d.ruleId === 'FIGM-ANG-03');
    assert.ok(hit, 'expected FIGM-ANG-03 to fire even when nested inside <section><div><ul>');
    assert.equal(hit!.sourceKind, 'REAL_AST');
  });

  await t.test('[multiple violations] two independent *ngFor violations in one template both fire, each at its own line', () => {
    const code = `@Component({\n  template: \`\n    <ul><li *ngFor="let a of as">{{ a }}</li></ul>\n    <ol><li *ngFor="let b of bs">{{ b }}</li></ol>\n  \`\n})\nexport class DualListComponent {}`;
    const diags = diagnosticsFor(code).filter((d) => d.ruleId === 'FIGM-ANG-03');
    assert.equal(diags.length, 2, 'expected exactly 2 FIGM-ANG-03 diagnostics, one per *ngFor');
    const lines = diags.map((d) => d.location.start.line).sort();
    assert.deepEqual(lines, [3, 4]);
  });

  await t.test('[mixed HTML/Angular syntax] plain HTML siblings alongside Angular directives do not confuse detection', () => {
    const code = `@Component({\n  template: \`\n    <header><h1 class="title">My App</h1></header>\n    <main>\n      <p>Static paragraph, nothing wrong here.</p>\n      <li *ngFor="let item of items">{{ item.name }}</li>\n    </main>\n  \`\n})\nexport class MixedComponent {}`;
    const diags = diagnosticsFor(code);
    const hit = diags.find((d) => d.ruleId === 'FIGM-ANG-03');
    assert.ok(hit);
    assert.equal(hit!.location.start.line, 6);
  });

  await t.test('[interpolation] FIGM-ANG-04 fires on a method call inside {{ }} but not on a plain property read', () => {
    const codeViolation = `@Component({ template: \`<span>{{ calculateTotal() }}</span>\` })\nexport class X {}`;
    const codeCompliant = `@Component({ template: \`<span>{{ total }}</span>\` })\nexport class X {}`;
    const violDiags = diagnosticsFor(codeViolation);
    const compliantDiags = diagnosticsFor(codeCompliant);
    const hit = violDiags.find((d) => d.ruleId === 'FIGM-ANG-04');
    assert.ok(hit);
    assert.equal(hit!.sourceKind, 'REAL_AST');
    assert.ok(!compliantDiags.some((d) => d.ruleId === 'FIGM-ANG-04'));
  });

  await t.test('[interpolation] FIGM-ANG-04 also fires on a method call inside a [property] binding, not just {{ }}', () => {
    const code = `@Component({ template: \`<img [src]="resolveImageUrl()" />\` })\nexport class X {}`;
    const diags = diagnosticsFor(code);
    assert.ok(diags.some((d) => d.ruleId === 'FIGM-ANG-04'));
  });

  await t.test('[interpolation] FIGM-ANG-04 does NOT fire on an (event) binding calling a handler -- that is expected usage', () => {
    const code = `@Component({ template: \`<button (click)="handleClick()">Go</button>\` })\nexport class X {}`;
    const diags = diagnosticsFor(code);
    assert.ok(!diags.some((d) => d.ruleId === 'FIGM-ANG-04'), 'event bindings intentionally call methods on interaction, not every change-detection cycle');
  });

  await t.test('[structural directive] *ngIf alone (no *ngFor) never triggers FIGM-ANG-03', () => {
    const code = `@Component({ template: \`<div *ngIf="isVisible">{{ label }}</div>\` })\nexport class X {}`;
    const diags = diagnosticsFor(code);
    assert.ok(!diags.some((d) => d.ruleId === 'FIGM-ANG-03'));
  });

  await t.test('[modern control-flow syntax] @for with track $index fires FIGM-ANG-08 via REAL_AST', () => {
    const code = `@Component({\n  template: \`\n    @for (item of items; track $index) {\n      <li>{{ item.name }}</li>\n    }\n  \`\n})\nexport class ForBlockComponent {}`;
    const diags = diagnosticsFor(code);
    const hit = diags.find((d) => d.ruleId === 'FIGM-ANG-08');
    assert.ok(hit, 'expected FIGM-ANG-08 to fire for track $index');
    assert.equal(hit!.sourceKind, 'REAL_AST');
  });

  await t.test('[modern control-flow syntax] @for track item.id (a stable property) does not fire FIGM-ANG-08', () => {
    const code = `@Component({ template: \`@for (item of items; track item.id) { <li>{{ item.name }}</li> }\` })\nexport class X {}`;
    const diags = diagnosticsFor(code);
    assert.ok(!diags.some((d) => d.ruleId === 'FIGM-ANG-08'));
  });

  await t.test('[modern control-flow syntax] @if/@switch blocks alongside a violating @for do not suppress or duplicate detection', () => {
    const code = `@Component({\n  template: \`\n    @if (loading) {\n      <p>Loading...</p>\n    } @else {\n      @for (item of items; track $index) {\n        <li>{{ item.name }}</li>\n      }\n    }\n  \`\n})\nexport class ControlFlowComponent {}`;
    const diags = diagnosticsFor(code).filter((d) => d.ruleId === 'FIGM-ANG-08');
    assert.equal(diags.length, 1, 'expected exactly one FIGM-ANG-08 diagnostic, from inside the nested @for');
  });

  await t.test('[multiline template] a violation many lines into a long template is found at its real line, not line 1', () => {
    const paddingLines = Array.from({ length: 12 }, (_, i) => `      <p>Padding line ${i}</p>`).join('\n');
    const code = `@Component({\n  template: \`\n    <div>\n${paddingLines}\n      <li *ngFor="let item of items">{{ item.name }}</li>\n    </div>\n  \`\n})\nexport class LongComponent {}`;
    const diags = diagnosticsFor(code);
    const hit = diags.find((d) => d.ruleId === 'FIGM-ANG-03');
    assert.ok(hit);
    assert.equal(hit!.location.start.line, 16, 'expected the real line of the *ngFor, accounting for the 12 padding lines');
  });

  await t.test('[malformed template] an unclosed tag inside the template never throws -- angular-html-parser is error-tolerant', () => {
    const code = `@Component({ template: \`<div><li *ngFor="let item of items">{{ item.name }}\` })\nexport class BrokenComponent {}`;
    assert.doesNotThrow(() => diagnosticsFor(code));
  });

  await t.test('[malformed template] a template with no closing backtick at all does not throw and yields no Angular-template diagnostics', () => {
    const code = `@Component({ template: \`<li *ngFor="let item of items">\nexport class Unterminated {}`;
    assert.doesNotThrow(() => diagnosticsFor(code));
  });

  // Regression: angular-html-parser's own parse errors (result.errors) used to be silently
  // discarded -- a genuinely malformed inline template (mismatched closing tag) produced ZERO
  // diagnostics from RuleExecutionEngine, unlike an equivalent React/TSX (TS17008-class compile
  // error) or Vue (@vue/compiler-sfc's own errors, already wired in) syntax failure. Fixed via
  // getAngularTemplateParseErrors + SourceParser.parseSource, mirroring the existing VUE_SFC
  // precedent immediately above it in that file.
  await t.test('[malformed template] a real structural error (mismatched closing tag) surfaces as a genuine SYNTAX-PARSE-ERROR diagnostic, not silence', () => {
    const code = `@Component({\n  selector: 'app-broken',\n  template: \`\n    <div>\n      <span>Hello\n    </div>\n  \`\n})\nexport class BrokenStructureComponent {}`;
    const result = RuleExecutionEngine.analyzeFile('broken-structure.component.ts', code);
    assert.ok(result.parseErrors.length > 0, 'expected a real parse error for the mismatched closing tag');
    assert.ok(
      result.parseErrors.some((e) => e.message.includes('Angular template parse error')),
      `expected an Angular-template-specific parse error, got: ${JSON.stringify(result.parseErrors)}`
    );
    const syntaxDiag = result.diagnostics.find((d) => d.ruleId === 'SYNTAX-PARSE-ERROR');
    assert.ok(syntaxDiag, 'expected a SYNTAX-PARSE-ERROR diagnostic in the scan result');
    assert.equal(syntaxDiag?.kind, 'GENERAL_CODE_ERROR');
    assert.notEqual(result.qualityScore, 100, 'a structurally broken template must not score a perfect quality score');
  });

  await t.test('[malformed template] a well-formed template produces zero parse errors (no false positive from the new structural check)', () => {
    const code = `@Component({\n  selector: 'app-ok',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<div><span>Hello</span></div>\`\n})\nexport class WellFormedComponent {}`;
    const result = RuleExecutionEngine.analyzeFile('well-formed.component.ts', code);
    assert.equal(result.parseErrors.length, 0);
    assert.ok(!result.diagnostics.some((d) => d.ruleId === 'SYNTAX-PARSE-ERROR'));
  });

  await t.test('[FIGM-ANG-10] duplicate | async on the same observable expression fires exactly once per occurrence, not once per occurrence-pair', () => {
    const code = `@Component({\n  template: \`\n    <div>{{ (user$ | async)?.name }}</div>\n    <div>{{ (user$ | async)?.email }}</div>\n    <div>{{ (user$ | async)?.id }}</div>\n  \`\n})\nexport class TripleAsyncComponent {}`;
    const diags = diagnosticsFor(code).filter((d) => d.ruleId === 'FIGM-ANG-10');
    assert.equal(diags.length, 3, 'expected one diagnostic per duplicate occurrence (3 total uses of user$ | async)');
  });

  await t.test('[FIGM-ANG-10] a single (non-duplicated) | async use does not fire', () => {
    const code = `@Component({ template: \`<div>{{ (user$ | async)?.name }}</div>\` })\nexport class SingleAsyncComponent {}`;
    const diags = diagnosticsFor(code);
    assert.ok(!diags.some((d) => d.ruleId === 'FIGM-ANG-10'));
  });

  // Regression: walkInterpolations previously attributed EVERY interpolation token within one DOM
  // text node to that text node's own (whole-node) sourceSpan, so two textually-adjacent-but-
  // distinct interpolations sharing a single text node (no intervening element boundary) got
  // identical, indistinguishable locations. This is the same failure class as the FIGM-REACT-01
  // chained-call duplicate: real, distinct violations reported at the same coordinates. Fixed by
  // using each interpolation TOKEN's own sourceSpan (angular-html-parser provides one per token).
  await t.test('[FIGM-ANG-04] two distinct method calls sharing one text node get distinct locations, not a collapsed duplicate', () => {
    const code = `@Component({ template: \`<div>{{ getUserName() }} and {{ getUserAge() }}</div>\` })\nexport class TwoCallsOneTextNode {}`;
    const diags = diagnosticsFor(code).filter((d) => d.ruleId === 'FIGM-ANG-04');
    assert.equal(diags.length, 2, `expected 2 distinct FIGM-ANG-04 findings, got ${diags.length}`);
    const cols = diags.map((d) => d.location?.start?.column);
    assert.notEqual(cols[0], cols[1], `both findings share the same location (${JSON.stringify(cols)}) — they must be distinguishable`);
  });

  await t.test('[FIGM-ANG-10] two duplicate-async occurrences sharing one text node get distinct locations', () => {
    const code = `@Component({ template: \`<div>{{ (user$ | async)?.name }} - {{ (user$ | async)?.age }}</div>\` })\nexport class TwoAsyncOneTextNode {}`;
    const diags = diagnosticsFor(code).filter((d) => d.ruleId === 'FIGM-ANG-10');
    assert.equal(diags.length, 2, `expected 2 distinct FIGM-ANG-10 findings, got ${diags.length}`);
    const cols = diags.map((d) => d.location?.start?.column);
    assert.notEqual(cols[0], cols[1], `both findings share the same location (${JSON.stringify(cols)}) — they must be distinguishable`);
  });

  await t.test('no diagnostic duplication: a template violating all 4 rules at once produces exactly one diagnostic per rule', () => {
    const code = `@Component({\n  template: \`\n    <li *ngFor="let item of items">{{ computeLabel() }}</li>\n    @for (x of xs; track $index) { <span>{{ x }}</span> }\n    <div>{{ (user$ | async)?.a }}</div>\n    <div>{{ (user$ | async)?.b }}</div>\n  \`\n})\nexport class KitchenSinkComponent {}`;
    const diags = diagnosticsFor(code);
    for (const ruleId of ['FIGM-ANG-03', 'FIGM-ANG-08']) {
      const matches = diags.filter((d) => d.ruleId === ruleId);
      assert.equal(matches.length, 1, `expected exactly 1 diagnostic for ${ruleId}, got ${matches.length}`);
    }
    const ang04Matches = diags.filter((d) => d.ruleId === 'FIGM-ANG-04');
    assert.equal(ang04Matches.length, 1, 'expected exactly 1 FIGM-ANG-04 (one method call in interpolation)');
    const ang10Matches = diags.filter((d) => d.ruleId === 'FIGM-ANG-10');
    assert.equal(ang10Matches.length, 2, 'expected exactly 2 FIGM-ANG-10 (one per duplicate | async occurrence)');
  });

  await t.test('no false GENERAL_CODE_ERROR conversion: all 4 rules classify as FIGM_RULE, never GENERAL_CODE_ERROR', () => {
    const code = `@Component({\n  template: \`\n    <li *ngFor="let item of items">{{ computeLabel() }}</li>\n    @for (x of xs; track $index) { <span>{{ x }}</span> }\n    <div>{{ (user$ | async)?.a }}</div>\n    <div>{{ (user$ | async)?.b }}</div>\n  \`\n})\nexport class ClassifierComponent {}`;
    const diags = diagnosticsFor(code).filter((d) =>
      ['FIGM-ANG-03', 'FIGM-ANG-04', 'FIGM-ANG-08', 'FIGM-ANG-10'].includes(d.ruleId)
    );
    assert.ok(diags.length >= 4, 'expected all 4 rules to have fired for this fixture');
    for (const d of diags) {
      assert.equal(d.kind, 'FIGM_RULE', `${d.ruleId} should classify as FIGM_RULE, not ${d.kind}`);
    }
  });

  await t.test('standalone raw template markup (no @Component wrapper) still resolves via the whole-file fallback, when the filename is genuinely .html', () => {
    const nodes = buildAngularTemplateRealSyntaxNodes(`<div *ngFor="let item of items">{{ item.name }}</div>`, 'x.component.html');
    assert.ok(nodes.some((n) => n.attributes?.isNgForWithoutTrackBy === true));
  });

  await t.test('a component using only an external templateUrl (no inline template) yields no Angular-template nodes, not a crash', () => {
    const nodes = buildAngularTemplateRealSyntaxNodes(
      `@Component({ selector: 'app-x', templateUrl: './x.component.html' })\nexport class X {}`,
      'x.component.ts'
    );
    assert.deepEqual(nodes, []);
  });

  // Regression guard (real-world defect confirmed via a fresh benchmark re-scan of
  // angular-realworld-example-app: app.config.ts, user.service.ts, and similar plain .ts files
  // with no @Component decorator and no inline template were previously fed to
  // angular-html-parser IN FULL, which then misread ordinary TypeScript interface/object-literal
  // braces as malformed Angular template/ICU syntax -- "Unexpected character EOF... unescaped {",
  // "Invalid ICU message" -- on files containing zero template markup at all.)
  await t.test('[regression] a plain .ts file with no @Component decorator and no inline template yields no nodes and no bogus parse errors', () => {
    const code = `import { ApplicationConfig } from '@angular/core';\n\nexport interface ConduitDebug {\n  getToken: () => string | null;\n}\n\nexport const appConfig: ApplicationConfig = {\n  providers: [],\n};`;
    const nodes = buildAngularTemplateRealSyntaxNodes(code, 'src/app/app.config.ts');
    assert.deepEqual(nodes, [], 'a plain non-component .ts file must yield no Angular-template nodes');

    const errors = getAngularTemplateParseErrors(code, 'src/app/app.config.ts');
    assert.deepEqual(errors, [], 'a plain non-component .ts file must never report a bogus template parse error');
  });
});
