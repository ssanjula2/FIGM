import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine';
import { buildVueTemplateRealSyntaxNodes } from '../src/ast/vue-template-ast-builder';
import { DiagnosticReport } from '../src/types/ast-spec';

/**
 * Phase 2 (AST/Rule Coverage Gaps), item 1 — Vue AST coverage. FIGM-VUE-03/04/05/06 (the
 * <script>/<script setup> rules) already had real AST via real-syntax-node-builder.ts's
 * buildVueScriptRealSyntaxNodes before this change. The concrete, confirmed gap was narrower:
 * FIGM-VUE-01 (unstable/missing v-for :key) and FIGM-VUE-02 (v-if combined with v-for), the two
 * <template>-markup rules, were still LEGACY_TEXT_HEURISTIC-only. This suite proves the new
 * src/ast/vue-template-ast-builder.ts (wired into buildRealSyntaxNodes's VUE_SFC branch, with the
 * old legacy regex block for these two rules now suppressed in source-parser.ts to avoid a
 * duplicate diagnostic) detects both rules via a real `@vue/compiler-dom` template parse, matches
 * the existing testbed fixtures, and never double-reports.
 */

function scan(code: string, filePath: string): DiagnosticReport[] {
  const parsed = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
}

function find(diags: DiagnosticReport[], ruleId: string): DiagnosticReport[] {
  return diags.filter((d) => d.ruleId === ruleId);
}

test('FIGM-VUE-01 (v-for missing/unstable :key) — real AST detection', async (t) => {
  await t.test('missing :key entirely is flagged, REAL_AST, exactly once', () => {
    const code = `<template>\n  <li v-for="todo in todos">{{ todo.text }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue01.vue');
    const matches = find(diags, 'FIGM-VUE-01');
    assert.equal(matches.length, 1, 'exactly one FIGM-VUE-01 diagnostic, never zero or duplicated');
    assert.equal(matches[0].sourceKind, 'REAL_AST');
    assert.equal(matches[0].location.start.line, 2);
  });

  await t.test(':key bound to the loop index is flagged as unstable, REAL_AST', () => {
    const code = `<template>\n  <li v-for="(todo, index) in todos" :key="index">{{ todo.text }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue01b.vue');
    const matches = find(diags, 'FIGM-VUE-01');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].sourceKind, 'REAL_AST');
  });

  await t.test(':key bound to a stable per-item field is NOT flagged (negative case)', () => {
    const code = `<template>\n  <li v-for="todo in todos" :key="todo.id">{{ todo.text }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue01c.vue');
    assert.equal(find(diags, 'FIGM-VUE-01').length, 0, 'a stable :key must never be flagged');
  });

  await t.test('the exact benchmarks/testbed/Vue01Benchmark.vue fixture is detected, REAL_AST', () => {
    const code = `<!-- Defect: FIGM-VUE-01 -->\n<template>\n  <li v-for="todo in todos">{{ todo.text }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue01Benchmark.vue');
    const matches = find(diags, 'FIGM-VUE-01');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].sourceKind, 'REAL_AST');
  });
});

test('FIGM-VUE-02 (v-if combined with v-for) — real AST detection', async (t) => {
  await t.test('v-for + v-if on the same element is flagged, REAL_AST, exactly once', () => {
    const code = `<template>\n  <li v-for="user in users" :key="user.id" v-if="user.isActive">{{ user.name }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue02.vue');
    const matches = find(diags, 'FIGM-VUE-02');
    assert.equal(matches.length, 1, 'exactly one FIGM-VUE-02 diagnostic, never zero or duplicated');
    assert.equal(matches[0].sourceKind, 'REAL_AST');
  });

  await t.test('v-for alone (no v-if) is NOT flagged for FIGM-VUE-02 (negative case)', () => {
    const code = `<template>\n  <li v-for="user in users" :key="user.id">{{ user.name }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue02b.vue');
    assert.equal(find(diags, 'FIGM-VUE-02').length, 0);
  });

  await t.test('v-if alone on a DIFFERENT, non-v-for element is NOT flagged (negative case)', () => {
    const code = `<template>\n  <div v-if="loading">Loading...</div>\n  <li v-for="user in users" :key="user.id">{{ user.name }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue02c.vue');
    assert.equal(find(diags, 'FIGM-VUE-02').length, 0, 'v-if and v-for on DIFFERENT elements must never be flagged');
  });

  await t.test('the exact benchmarks/testbed/Vue02Benchmark.vue fixture is detected, REAL_AST', () => {
    const code = `<!-- Defect: FIGM-VUE-02 -->\n<template>\n  <li v-for="user in users" :key="user.id" v-if="user.isActive">{{ user.name }}</li>\n</template>\n`;
    const diags = scan(code, 'Vue02Benchmark.vue');
    const matches = find(diags, 'FIGM-VUE-02');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].sourceKind, 'REAL_AST');
  });
});

test('buildVueTemplateRealSyntaxNodes — direct unit coverage and resilience', async (t) => {
  await t.test('returns an empty list for a script-only SFC with no <template> block', () => {
    const code = `<script setup>\nimport { ref } from 'vue';\nconst x = ref(1);\n</script>\n`;
    assert.deepEqual(buildVueTemplateRealSyntaxNodes(code, 'NoTemplate.vue'), []);
  });

  await t.test('never throws on malformed template markup', () => {
    const code = `<template>\n  <li v-for="todo in todos" :key\n</template>\n`;
    assert.doesNotThrow(() => buildVueTemplateRealSyntaxNodes(code, 'Broken.vue'));
  });

  await t.test('FIGM-VUE-03..06 (already real AST via buildVueScriptRealSyntaxNodes) are unaffected by this change', () => {
    // vueComputedBodyHasSideEffect's recognized side-effect shapes are narrow and specific
    // (`.value =` assignment, fetch(), localStorage/sessionStorage.setItem) -- fetch() used here
    // to match that existing, unmodified heuristic exactly.
    const code = `<template>\n  <div>{{ total }}</div>\n</template>\n<script setup>\nimport { computed } from 'vue';\nconst total = computed(() => {\n  fetch('/api/track');\n  return 1 + 1;\n});\n</script>\n`;
    const diags = scan(code, 'Vue03.vue');
    const matches = find(diags, 'FIGM-VUE-03');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].sourceKind, 'REAL_AST', 'VUE-03 must still be REAL_AST, unchanged by this Phase 2 item');
  });
});
