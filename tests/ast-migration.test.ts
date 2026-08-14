import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { TypeScriptFrameworkParser } from '../src/parser/typescript-framework-parser.js';
import { buildRealSyntaxNodes, canAttemptRealAstParse } from '../src/ast/real-syntax-node-builder.js';

/**
 * AST Migration (docs/architecture/AST_MIGRATION_MAP.md) — dedicated regression suite for the
 * migration itself, layered on TOP of the existing rule-behavior oracles (rule-detection-matrix,
 * qa-matrix-boundary-adversarial, adversarial-complete-detection, react-ast-rules), which already
 * re-ran green against this migration and are the primary proof detection *behavior* is preserved.
 * This file instead targets things specific to the migration: real-parser resilience, the
 * REAL_AST/LEGACY_TEXT_HEURISTIC provenance label, the exact framework gates, and two concrete
 * regressions found and fixed during this migration (kept here as permanent guards).
 */

function diagnosticsFor(code: string, filePath: string) {
  return RuleExecutionEngine.analyzeFile(filePath, code).diagnostics;
}

function ruleIds(diags: ReturnType<typeof diagnosticsFor>): string[] {
  return diags.map((d) => d.ruleId);
}

test('AST Migration — parser abstraction resilience (Phase 2)', async (t) => {
  await t.test('never throws on malformed input, reports structured diagnostics instead', () => {
    const parser = new TypeScriptFrameworkParser();
    assert.doesNotThrow(() => parser.parse('const x = ;', 'broken.tsx'));
    assert.ok(parser.getDiagnostics().length > 0);
    assert.equal(parser.getDiagnostics()[0].severity, 'error');
    // TypeScript's parser is error-tolerant -- it still produces a best-effort tree even for
    // clearly broken input, so getRoot() is non-null here (this is intentional/documented, not
    // a bug: the caller decides what to do with a tree that also has diagnostics attached).
    assert.ok(parser.getRoot() !== null);
  });

  await t.test('never throws on empty input', () => {
    const parser = new TypeScriptFrameworkParser();
    assert.doesNotThrow(() => parser.parse('', 'empty.tsx'));
    assert.ok(parser.getRoot() !== null);
  });

  await t.test('never throws on deeply pathological/garbage input', () => {
    const parser = new TypeScriptFrameworkParser();
    const garbage = '{{{{{{{{{{ ]]]]] <<<<< ))))) ==== @@@@ ####'.repeat(50);
    assert.doesNotThrow(() => parser.parse(garbage, 'garbage.tsx'));
  });

  await t.test('getSourceRange resolves real 1-based line / 0-based column positions', () => {
    const parser = new TypeScriptFrameworkParser();
    parser.parse('const x = 1;\nconst y = 2;', 'positions.ts');
    const root = parser.getRoot()!;
    let sawLineTwo = false;
    parser.visit((node, range) => {
      if (range.start.line === 2) sawLineTwo = true;
    });
    assert.ok(sawLineTwo, 'expected at least one node located on line 2');
    void root;
  });

  await t.test('canAttemptRealAstParse excludes VUE_SFC and SVELTE, includes everything else', () => {
    assert.equal(canAttemptRealAstParse('VUE_SFC'), false);
    assert.equal(canAttemptRealAstParse('SVELTE'), false);
    assert.equal(canAttemptRealAstParse('REACT_JSX'), true);
    assert.equal(canAttemptRealAstParse('NEXT_JS'), true);
    assert.equal(canAttemptRealAstParse('GENERIC_ESTREE'), true);
    assert.equal(canAttemptRealAstParse('ANGULAR_TEMPLATE'), true);
  });

  await t.test('buildRealSyntaxNodes never attempts to parse VUE_SFC content, even garbage SFC markup', () => {
    const vueGarbage = '<template><div v-for="x in y" :style="{ a: 1 }"><<<broken>>></div></template>\n<script>export default {}</script>';
    assert.doesNotThrow(() => buildRealSyntaxNodes(vueGarbage, 'Component.vue', 'VUE_SFC'));
    const result = buildRealSyntaxNodes(vueGarbage, 'Component.vue', 'VUE_SFC');
    assert.deepEqual(result.nodes, []);
    assert.deepEqual(result.diagnostics, []);
  });
});

test('AST Migration — sourceKind provenance labeling (Phase 8)', async (t) => {
  await t.test('a real-AST-migrated rule on an eligible framework is labeled REAL_AST, never LEGACY_TEXT_HEURISTIC', () => {
    const code = `function Component({ items }) {\n  return items.map(item => {\n    const cfg = { theme: 'dark' };\n    return <span key={item.id}>{cfg.theme}</span>;\n  });\n}`;
    const diags = diagnosticsFor(code, 'component.tsx');
    const perf01 = diags.find((d) => d.ruleId === 'FIGM-PERF-01');
    assert.ok(perf01, 'expected FIGM-PERF-01 to fire');
    assert.equal(perf01!.sourceKind, 'REAL_AST');
    assert.match(perf01!.evidence ?? '', /^Real AST \(TypeScript compiler\)/);
  });

  await t.test('a rule not yet migrated (e.g. FIGM-A11Y-05) is labeled LEGACY_TEXT_HEURISTIC, never REAL_AST', () => {
    const code = `<input type="text" />`;
    const diags = diagnosticsFor(code, 'component.jsx');
    const a11y05 = diags.find((d) => d.ruleId === 'FIGM-A11Y-05');
    assert.ok(a11y05, 'expected FIGM-A11Y-05 to fire (unlabeled input)');
    assert.equal(a11y05!.sourceKind, 'LEGACY_TEXT_HEURISTIC');
    assert.match(a11y05!.evidence ?? '', /^Legacy text-heuristic pattern match/);
  });

  await t.test('every rule fired on a VUE_SFC file is labeled LEGACY_TEXT_HEURISTIC (Vue is never real-AST-parsed)', () => {
    const code = `<template>\n  <div @click="onClick" class="status-panel">{{ count }}</div>\n</template>\n<script>\nexport default { methods: { onClick() {} } };\n</script>`;
    const diags = diagnosticsFor(code, 'Component.vue');
    assert.ok(diags.length > 0, 'expected at least one diagnostic on this Vue fixture');
    for (const d of diags) {
      assert.equal(d.sourceKind, 'LEGACY_TEXT_HEURISTIC', `${d.ruleId} must be LEGACY_TEXT_HEURISTIC for a Vue file`);
    }
  });
});

test('AST Migration — regression: FIGM-PERF-01 scope narrowed to declaration initializers only (not any object literal)', async (t) => {
  await t.test('a bare `return {...}` inside a loop is NOT flagged (legacy behavior only ever matched a const/let/var declaration)', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    return { ...item, extra: true };\n  });\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(!ruleIds(diags).includes('FIGM-PERF-01'), 'a returned object literal (not a declaration) must not fire FIGM-PERF-01');
  });

  await t.test('an object literal passed directly as a call argument inside a loop is NOT flagged', () => {
    const code = `function render(items) {\n  return items.map(item => track({ id: item.id, ts: Date.now() }));\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(!ruleIds(diags).includes('FIGM-PERF-01'));
  });

  await t.test('a `const x = {...}` declaration inside a loop IS still flagged (the actual, preserved scope)', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    const cfg = { theme: 'dark' };\n    return cfg;\n  });\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(ruleIds(diags).includes('FIGM-PERF-01'));
  });

  await t.test('the fixed FIGM-PERF-01 remediation output (hoisted const, Object.freeze-wrapped) no longer fires', () => {
    // Regression for the exact bug found via tests/ai-remediation.test.ts during this migration:
    // an overly broad real-AST PERF-01 detector flagged the *unrelated* `return { ...item,
    // ...defaultConfig }` in the already-fixed code, because it matched ANY object literal in
    // loop scope rather than only a declaration's initializer.
    const fixedCode = `const HOISTED = Object.freeze({ theme: 'dark' });\nfunction processItems(items) {\n  return items.map(item => {\n    const defaultConfig = HOISTED;\n    return { ...item, ...defaultConfig };\n  });\n}`;
    const diags = diagnosticsFor(fixedCode, 'component.jsx');
    assert.ok(!ruleIds(diags).includes('FIGM-PERF-01'), 'the already-fixed code must not be re-flagged');
  });
});

test('AST Migration — regression: FIGM-NEXT-01 restricted to NEXT_JS, never plain REACT_JSX', async (t) => {
  await t.test('a plain React component using useState/useEffect (no Next.js signal at all) does NOT fire FIGM-NEXT-01', () => {
    // Regression for the exact bug found via the live benchmark re-run during this migration: the
    // real-AST builder initially copied evalNext01's (deliberately permissive) predicate gate
    // instead of the legacy PARSER's stricter trigger gate, causing every ordinary React
    // component using hooks to be incorrectly flagged.
    const code = `import { useState, useEffect } from 'react';\nfunction Widget() {\n  const [count, setCount] = useState(0);\n  useEffect(() => { document.title = String(count); }, [count]);\n  return <div>{count}</div>;\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(!ruleIds(diags).includes('FIGM-NEXT-01'), 'a plain REACT_JSX file must never be flagged FIGM-NEXT-01');
  });

  await t.test('the same code as a genuine Next.js App Router page (no "use client") DOES fire FIGM-NEXT-01', () => {
    const code = `import { useState } from 'react';\nexport default function Page() {\n  const [count, setCount] = useState(0);\n  return <div>{count}</div>;\n}`;
    const diags = diagnosticsFor(code, 'app/dashboard/page.tsx');
    assert.ok(ruleIds(diags).includes('FIGM-NEXT-01'), 'a real Next.js page missing "use client" must still be flagged');
  });
});

test('AST Migration — real-AST rules are structurally immune to comment/string false positives (no stripCommentsAndStrings needed)', async (t) => {
  await t.test('FIGM-A11Y-01 trigger text inside a comment does not fire', () => {
    const code = `function Widget() {\n  // Example of a bad pattern: <div onClick={handleClick}>bad</div>\n  return <div className="safe">Nothing here</div>;\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(!ruleIds(diags).includes('FIGM-A11Y-01'));
  });

  await t.test('FIGM-A11Y-02 trigger text inside a string literal (not real JSX) does not fire', () => {
    const code = `function Widget() {\n  const docs = "Example: <CustomDropdown /> is not accessible without a role.";\n  return <p>{docs}</p>;\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(!ruleIds(diags).includes('FIGM-A11Y-02'));
  });

  await t.test('real JSX spread across many physical lines is still detected (multi-line JSX is native to the parser, not a scanner workaround)', () => {
    const code = `function Widget({ onExport }) {\n  return (\n    <div\n      className="export-btn"\n      onClick={\n        () => onExport()\n      }\n    >\n      Export\n    </div>\n  );\n}`;
    const diags = diagnosticsFor(code, 'component.jsx');
    assert.ok(ruleIds(diags).includes('FIGM-A11Y-01'), 'a real multi-line JSX opening tag must still be detected');
  });
});

test('AST Migration — Angular class-body rules (Group 2: ANG-01/02/05 real-AST, ANG-03/04 still legacy)', async (t) => {
  await t.test('FIGM-ANG-01: an RxJS .subscribe() with no managed teardown fires, via real AST', () => {
    const code = `import { Component } from '@angular/core';\n@Component({ selector: 'app-x', template: '<div></div>' })\nexport class WidgetComponent {\n  ngOnInit() {\n    this.service.data$.subscribe(x => console.log(x));\n  }\n}`;
    const diags = diagnosticsFor(code, 'widget.component.ts');
    const ang01 = diags.find((d) => d.ruleId === 'FIGM-ANG-01');
    assert.ok(ang01);
    assert.equal(ang01!.sourceKind, 'REAL_AST');
  });

  await t.test('FIGM-ANG-01: does NOT fire when takeUntilDestroyed is present anywhere in the file', () => {
    const code = `import { Component } from '@angular/core';\nimport { takeUntilDestroyed } from '@angular/core/rxjs-interop';\n@Component({ selector: 'app-x', template: '<div></div>' })\nexport class WidgetComponent {\n  ngOnInit() {\n    this.service.data$.pipe(takeUntilDestroyed()).subscribe(x => console.log(x));\n  }\n}`;
    const diags = diagnosticsFor(code, 'widget.component.ts');
    assert.ok(!ruleIds(diags).includes('FIGM-ANG-01'));
  });

  await t.test('FIGM-ANG-02: a @Component decorator missing ChangeDetectionStrategy.OnPush fires, via real AST', () => {
    const code = `import { Component } from '@angular/core';\n@Component({ selector: 'app-x', template: '<div></div>' })\nexport class WidgetComponent {}`;
    const diags = diagnosticsFor(code, 'widget.component.ts');
    const ang02 = diags.find((d) => d.ruleId === 'FIGM-ANG-02');
    assert.ok(ang02);
    assert.equal(ang02!.sourceKind, 'REAL_AST');
  });

  await t.test('FIGM-ANG-05: direct .nativeElement mutation (no Renderer2 nearby) fires, via real AST', () => {
    const code = `import { Component, ElementRef } from '@angular/core';\n@Component({ selector: 'app-x', template: '<div></div>', changeDetection: 0 })\nexport class WidgetComponent {\n  constructor(private el: ElementRef) {}\n  paint() {\n    this.el.nativeElement.style.color = 'red';\n  }\n}`;
    const diags = diagnosticsFor(code, 'widget.component.ts');
    const ang05 = diags.find((d) => d.ruleId === 'FIGM-ANG-05');
    assert.ok(ang05);
    assert.equal(ang05!.sourceKind, 'REAL_AST');
  });

  await t.test('FIGM-ANG-03/04 (template-markup rules) remain LEGACY_TEXT_HEURISTIC even on an ANGULAR_TEMPLATE file', () => {
    const code = `import { Component } from '@angular/core';\n@Component({\n  selector: 'app-x',\n  changeDetection: 0,\n  template: \`<li *ngFor="let item of items">{{ formatItem() }}</li>\`\n})\nexport class WidgetComponent {}`;
    const diags = diagnosticsFor(code, 'widget.component.ts');
    const ang03 = diags.find((d) => d.ruleId === 'FIGM-ANG-03');
    const ang04 = diags.find((d) => d.ruleId === 'FIGM-ANG-04');
    assert.ok(ang03, 'expected FIGM-ANG-03 (*ngFor without trackBy) to still fire via the legacy path');
    assert.equal(ang03!.sourceKind, 'LEGACY_TEXT_HEURISTIC');
    assert.ok(ang04, 'expected FIGM-ANG-04 (template method call) to still fire via the legacy path');
    assert.equal(ang04!.sourceKind, 'LEGACY_TEXT_HEURISTIC');
  });
});

test('AST Migration — multiple simultaneous real-AST violations in one file are all reported independently', () => {
  const code = `import HeavyChart from 'heavy-chart';\n\nfunction Dashboard({ items, isOpen }) {\n  if (items.length) {\n    console.log(HeavyChart);\n  }\n  return (\n    <div>\n      <img src="/a.png" alt="a" />\n      <div onClick={() => {}} className="clickable">x</div>\n      <CustomSelect options={items} />\n      {items.map(item => {\n        const style = { color: 'red' };\n        return <span key={item.id} style={style}>{item.name}</span>;\n      })}\n      {isOpen && <Modal isOpen={isOpen}><p>content</p></Modal>}\n    </div>\n  );\n}`;
  const diags = diagnosticsFor(code, 'dashboard.jsx');
  const ids = new Set(ruleIds(diags));
  for (const expected of ['FIGM-PERF-04', 'FIGM-PERF-02', 'FIGM-A11Y-01', 'FIGM-A11Y-02', 'FIGM-PERF-01', 'FIGM-A11Y-04']) {
    assert.ok(ids.has(expected), `expected ${expected} among: ${[...ids].join(', ')}`);
  }
  // Every diagnostic that fired from this migrated set must be genuinely REAL_AST-labeled.
  for (const d of diags) {
    if (['FIGM-PERF-04', 'FIGM-PERF-02', 'FIGM-A11Y-01', 'FIGM-A11Y-02', 'FIGM-PERF-01', 'FIGM-A11Y-04'].includes(d.ruleId)) {
      assert.equal(d.sourceKind, 'REAL_AST', `${d.ruleId} should be REAL_AST here`);
    }
  }
});

test('AST Migration — end-to-end: SourceParser + ASTDetectionEngine still agree with RuleExecutionEngine (no double-counting from the legacy+real dual paths)', () => {
  const code = `function Dashboard({ items }) {\n  return items.map(item => {\n    const cfg = { theme: 'dark' };\n    return <span key={item.id} style={cfg}>{item.name}</span>;\n  });\n}`;
  const parseRes = SourceParser.parseSource(code, 'dashboard.jsx');
  const rawDiags = ASTDetectionEngine.evaluateNode(parseRes.ast!, 'dashboard.jsx', parseRes.framework);
  const perf01Count = rawDiags.filter((d) => d.ruleId === 'FIGM-PERF-01').length;
  assert.equal(perf01Count, 1, `FIGM-PERF-01 must fire exactly once, not be double-counted by both the legacy and real-AST paths (got ${perf01Count})`);
});
