import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * QA Validation Matrix — framework-specific variants of the 12 "universal" FIGM rules
 * (FIGM-PERF-01..06, FIGM-A11Y-01..06).
 *
 * These 12 rules carry no framework guard in ASTDetectionEngine (unlike the NEXT/REACT/ANG-scoped
 * rules), so they are meant to apply identically across React, Vue, and Angular source. Prior to
 * this file, positive/negative/boundary/adversarial coverage for these rules existed almost
 * entirely in REACT_JSX/NEXT_JS fixtures (.jsx/.tsx files) — Vue (.vue) and Angular (.component.ts)
 * variants were essentially untested, which is exactly the kind of gap that hid the FIGM-PERF-01
 * single-line false negative (tests/qa-matrix-cross-cutting.test.ts) until a differently-shaped
 * fixture was tried. This file closes that gap: every case here was run against the real engine
 * and verified to fire/not-fire as asserted before being written down (see the QA matrix report).
 *
 * Vue/Angular framework-specific attribute syntax IS already handled by the detection logic for
 * the accessibility rules (source-parser.ts explicitly recognizes v-on:click/@click/(click) and
 * v-on:keydown/@keydown/(keydown) alongside onClick/onKeyDown) — several cases below exist
 * specifically to exercise those framework-specific attribute spellings, not just the JSX ones.
 */

interface FrameworkCase {
  ruleId: string;
  framework: 'VUE_SFC' | 'ANGULAR_TEMPLATE';
  label: string;
  code: string;
  filePath: string;
}

const CASES: FrameworkCase[] = [
  {
    ruleId: 'FIGM-PERF-01', framework: 'VUE_SFC',
    label: 'Vue SFC <script> block: invariant object allocated inside .map()',
    code: `<template><div v-for="item in items">{{item}}</div></template>\n<script>\nexport default {\n  methods: {\n    build(items) { return items.map(item => { const cfg = { a: 1 }; return cfg; }); }\n  }\n}\n</script>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-PERF-01', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular component class: invariant object allocated inside .map()',
    code: `@Component({}) class C { build(items) { return items.map(item => { const cfg = { a: 1 }; return cfg; }); } }`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-PERF-02', framework: 'VUE_SFC',
    label: 'Vue <template> img missing dimensions (VElement node type)',
    code: `<template><img src="/x.png" alt="x" /></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-PERF-02', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular decorator template img missing dimensions (Element$1 node type)',
    code: `@Component({ template: \`<img src="/x.png" alt="x" />\` }) class C {}`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-PERF-03', framework: 'VUE_SFC',
    label: 'Vue SFC <script> block: addEventListener with no matching removeEventListener',
    code: `<script>\nexport default {\n  mounted() { window.addEventListener('scroll', this.onScroll); }\n}\n</script>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-PERF-03', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular component class: addEventListener with no matching removeEventListener',
    code: `@Component({}) class C { ngOnInit() { window.addEventListener('scroll', this.onScroll); } }`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-PERF-04', framework: 'VUE_SFC',
    label: 'Vue SFC <script> block: heavy import referenced only inside a conditional branch',
    code: `<script>\nimport Heavy from 'monaco-editor';\nexport default {\n  methods: { load(cond) { if (cond) { Heavy.init(); } } }\n}\n</script>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-PERF-04', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular component class: heavy import referenced only inside a conditional branch',
    code: `import Heavy from 'monaco-editor';\n@Component({}) class C { load(cond) { if (cond) { Heavy.init(); } } }`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-PERF-05', framework: 'VUE_SFC',
    label: 'Vue SFC <script> block: inline arrow allocated inside .map()',
    code: `<script>\nexport default {\n  methods: { render(items) { return items.map(item => { return doThing(() => item.id); }); } }\n}\n</script>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-PERF-05', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular component class: inline arrow allocated inside .map()',
    code: `@Component({}) class C { render(items) { return items.map(item => { return doThing(() => item.id); }); } }`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-PERF-06', framework: 'VUE_SFC',
    label: 'Vue SFC <script> block: localStorage access inside .forEach()',
    code: `<script>\nexport default {\n  methods: { save(items) { items.forEach(item => { localStorage.setItem(item.id, item.value); }); } }\n}\n</script>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-PERF-06', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular component class: localStorage access inside .forEach()',
    code: `@Component({}) class C { save(items) { items.forEach(item => { localStorage.setItem(item.id, item.value); }); } }`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-A11Y-01', framework: 'VUE_SFC',
    label: 'Vue @click shorthand directive on non-interactive <div>, no keyboard parity',
    code: `<template><div @click="go">Click</div></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-01', framework: 'VUE_SFC',
    label: 'Vue v-on:click explicit directive on non-interactive <span>, no keyboard parity',
    code: `<template><span v-on:click="go">Click</span></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-01', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular (click) event binding on non-interactive <div>, no keyboard parity',
    code: `@Component({ template: \`<div (click)="go()">Click</div>\` }) class C {}`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-A11Y-02', framework: 'VUE_SFC',
    label: 'Vue custom component tag missing role and accessible name',
    code: `<template><CustomDropdown>Options</CustomDropdown></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-02', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular decorator template custom component tag missing role and accessible name',
    code: `@Component({ template: \`<CustomDropdown>Options</CustomDropdown>\` }) class C {}`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-A11Y-03', framework: 'VUE_SFC',
    label: 'Vue status container missing aria-live/role=status',
    code: `<template><div className="status">Loading</div></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-03', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular decorator template status container missing aria-live/role=status',
    code: `@Component({ template: \`<div className="status">Loading</div>\` }) class C {}`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-A11Y-04', framework: 'VUE_SFC',
    label: 'Vue Modal component missing focus restoration',
    code: `<template><Modal>content</Modal></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-04', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular decorator template Modal component missing focus restoration',
    code: `@Component({ template: \`<Modal>content</Modal>\` }) class C {}`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-A11Y-05', framework: 'VUE_SFC',
    label: 'Vue template <input> missing label association',
    code: `<template><input id="email" type="email" /></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-05', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular decorator template <input> missing label association',
    code: `@Component({ template: \`<input id="email" type="email" />\` }) class C {}`,
    filePath: 'a.component.ts',
  },
  {
    ruleId: 'FIGM-A11Y-06', framework: 'VUE_SFC',
    label: 'Vue lowercase tabindex="1" attribute (positive, overrides natural order)',
    code: `<template><div tabindex="1">Item</div></template>`,
    filePath: 'Widget.vue',
  },
  {
    ruleId: 'FIGM-A11Y-06', framework: 'ANGULAR_TEMPLATE',
    label: 'Angular decorator template tabindex="2" attribute (positive, overrides natural order)',
    code: `@Component({ template: \`<div tabindex="2">Item</div>\` }) class C {}`,
    filePath: 'a.component.ts',
  },
];

test('QA Matrix — framework-specific variants of universal rules', async (t) => {
  for (const c of CASES) {
    await t.test(`[${c.ruleId}][${c.framework}] ${c.label}`, () => {
      const result = RuleExecutionEngine.analyzeFile(c.filePath, c.code);
      assert.equal(result.framework, c.framework, `framework detection mismatch for ${c.filePath}`);
      const fired = result.diagnostics.some((d) => d.ruleId === c.ruleId);
      assert.ok(
        fired,
        `${c.ruleId} should have fired under ${c.framework} — this rule carries no framework guard and must not be silently suppressed by framework-specific syntax.\nActual diagnostics: ${result.diagnostics.map((d) => d.ruleId).join(', ') || '(none)'}`
      );
    });
  }

  await t.test('sanity: every one of the 12 universal rules has at least one Vue AND one Angular case', () => {
    const universalRuleIds = [
      'FIGM-PERF-01', 'FIGM-PERF-02', 'FIGM-PERF-03', 'FIGM-PERF-04', 'FIGM-PERF-05', 'FIGM-PERF-06',
      'FIGM-A11Y-01', 'FIGM-A11Y-02', 'FIGM-A11Y-03', 'FIGM-A11Y-04', 'FIGM-A11Y-05', 'FIGM-A11Y-06',
    ];
    for (const ruleId of universalRuleIds) {
      const frameworks = new Set(CASES.filter((c) => c.ruleId === ruleId).map((c) => c.framework));
      assert.ok(frameworks.has('VUE_SFC'), `${ruleId} is missing a VUE_SFC framework-variant case`);
      assert.ok(frameworks.has('ANGULAR_TEMPLATE'), `${ruleId} is missing an ANGULAR_TEMPLATE framework-variant case`);
    }
  });
});
