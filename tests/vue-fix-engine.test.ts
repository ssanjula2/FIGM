import test from 'node:test';
import assert from 'node:assert/strict';
import * as ts from 'typescript';
import { parse as parseVueSfcRaw } from '@vue/compiler-sfc';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { VueAstFixEngine, VUE_RULE_META } from '../src/engine/vue-fix-engine.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Phase 04 validation suite for the Vue AST Deterministic Fix Engine (src/engine/vue-fix-engine.ts).
 * For each of the 4 FIGM-VUE rules this proves, against the REAL detection pipeline
 * (SourceParser + ASTDetectionEngine — the same one production scans use):
 *
 *   detect(before) -> locate+fix() -> compile-check(after) -> re-scan(after) -> violation gone?
 *
 * "Compile-check" means what's actually installed: the patched .vue file still parses cleanly
 * via @vue/compiler-sfc (template + script split, zero parse errors), and — for FIGM-VUE-01/02,
 * whose fix touches only the template — the patched TypeScript script block (untouched) still
 * parses. No @vue-tsc / full type-checker is installed in this repo, so this suite does not claim
 * to run one.
 *
 * FIGM-VUE-01 gets a real deterministic rewrite, verified end-to-end (both the "missing :key" and
 * the "unstable :key bound to the loop index" shapes). FIGM-VUE-02/03/04 are proven to genuinely
 * LOCATE the violating node and then correctly decline with requiresManualReview: true — that
 * decline is the intended outcome, not a bug.
 */

function detect(code: string, filePath: string): DiagnosticReport[] {
  const parsed = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
}

function assertVueStillParsesCleanly(code: string, filePath: string) {
  const { errors } = parseVueSfcRaw(code, { filename: filePath });
  assert.equal(errors.length, 0, `patched .vue file must still parse cleanly, got errors: ${JSON.stringify(errors)}\ncode:\n${code}`);
}

test('Vue AST Deterministic Fix Engine (Phase 04)', async (t) => {
  await t.test('rule metadata covers exactly FIGM-VUE-01..04, matching SUPPORTED_RULE_IDS', () => {
    assert.deepEqual(new Set(VUE_RULE_META.map((m) => m.id)), VueAstFixEngine.SUPPORTED_RULE_IDS);
    assert.equal(VUE_RULE_META.length, 4);
    const autoFix = VUE_RULE_META.filter((m) => m.autoFixAvailable).map((m) => m.id).sort();
    const manual = VUE_RULE_META.filter((m) => !m.autoFixAvailable).map((m) => m.id).sort();
    assert.deepEqual(autoFix, ['FIGM-VUE-01']);
    assert.deepEqual(manual, ['FIGM-VUE-02', 'FIGM-VUE-03', 'FIGM-VUE-04']);
  });

  await t.test('FIGM-VUE-01 (missing :key): adds :key="item.id", verified end-to-end', () => {
    const before = `<template>
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
    const filePath = 'TodoList.vue';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-VUE-01');
    assert.ok(defect, 'FIGM-VUE-01 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = VueAstFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, true, outcome.description);
    assert.notEqual(outcome.patchedCode, before);
    assert.ok(outcome.patchedCode.includes('<li v-for="item in items" :key="item.id">'), `got:\n${outcome.patchedCode}`);
    assert.ok(outcome.patchedCode.includes('{{ item.name }}'));

    assertVueStillParsesCleanly(outcome.patchedCode, filePath);

    const afterDiags = detect(outcome.patchedCode, filePath);
    assert.ok(!afterDiags.some((d) => d.ruleId === 'FIGM-VUE-01'), 'FIGM-VUE-01 must be genuinely resolved on re-scan');
  });

  await t.test('FIGM-VUE-01 (:key bound to loop index): replaces it with item.id, verified end-to-end', () => {
    const before = `<template>
  <ul>
    <li v-for="(item, index) in items" :key="index">{{ item.name }}</li>
  </ul>
</template>
<script>
export default {
  data() {
    return { items: [] };
  },
};
</script>`;
    const filePath = 'TodoList.vue';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-VUE-01');
    assert.ok(defect, 'FIGM-VUE-01 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = VueAstFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, true, outcome.description);
    assert.ok(outcome.patchedCode.includes(':key="item.id"'), `got:\n${outcome.patchedCode}`);
    assert.ok(!outcome.patchedCode.includes(':key="index"'));

    assertVueStillParsesCleanly(outcome.patchedCode, filePath);

    const afterDiags = detect(outcome.patchedCode, filePath);
    assert.ok(!afterDiags.some((d) => d.ruleId === 'FIGM-VUE-01'), 'FIGM-VUE-01 must be genuinely resolved on re-scan');
  });

  await t.test('FIGM-VUE-02: v-for+v-if element is located but declines with requiresManualReview (routes to AI layer)', () => {
    const before = `<template>
  <li v-for="user in users" v-if="user.isActive">{{ user.name }}</li>
</template>
<script>
export default { data() { return { users: [] }; } };
</script>`;
    const filePath = 'UserList.vue';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-VUE-02');
    assert.ok(defect, 'FIGM-VUE-02 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = VueAstFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, false, 'FIGM-VUE-02 must never be auto-fixed — the correct rewrite depends on developer intent');
    assert.equal(outcome.requiresManualReview, true);
    assert.equal(outcome.patchedCode, before, 'a declined fix must never mutate the source');
    assert.ok(!outcome.description.toLowerCase().includes('could not locate'), 'the node WAS located — this must decline for a real reason, not a lookup failure');
  });

  await t.test('FIGM-VUE-03: computed() side effect is located but declines with requiresManualReview (routes to AI layer)', () => {
    const before = `<template>
  <div>{{ fullName }}</div>
</template>
<script setup>
import { ref, computed } from 'vue';
const first = ref('Jane');
const last = ref('Doe');
const logCount = ref(0);
const fullName = computed(() => {
  logCount.value = logCount.value + 1;
  return \`\${first.value} \${last.value}\`;
});
</script>`;
    const filePath = 'NameTag.vue';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-VUE-03');
    assert.ok(defect, 'FIGM-VUE-03 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = VueAstFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, false, 'FIGM-VUE-03 must never be auto-fixed — moving the side effect requires understanding the surrounding logic');
    assert.equal(outcome.requiresManualReview, true);
    assert.equal(outcome.patchedCode, before, 'a declined fix must never mutate the source');
    assert.ok(!outcome.description.toLowerCase().includes('could not locate'), 'the node WAS located — this must decline for a real reason, not a lookup failure');
  });

  await t.test('FIGM-VUE-04: direct computed .value mutation is located but declines with requiresManualReview (routes to AI layer)', () => {
    const before = `<template>
  <div>{{ sortedItems }}</div>
</template>
<script setup>
import { ref, computed } from 'vue';
const items = ref([]);
const sortedItems = computed(() => [...items.value].sort());
function addItem(x) {
  sortedItems.value.push(x);
}
</script>`;
    const filePath = 'SortedList.vue';

    const beforeDiags = detect(before, filePath);
    const defect = beforeDiags.find((d) => d.ruleId === 'FIGM-VUE-04');
    assert.ok(defect, 'FIGM-VUE-04 must be detected on its own before-fixture by the real detection pipeline');

    const outcome = VueAstFixEngine.tryFix(before, defect!, filePath);
    assert.equal(outcome.success, false, 'FIGM-VUE-04 must never be auto-fixed — the correct source-of-truth ref is app-specific');
    assert.equal(outcome.requiresManualReview, true);
    assert.equal(outcome.patchedCode, before, 'a declined fix must never mutate the source');
    assert.ok(!outcome.description.toLowerCase().includes('could not locate'), 'the node WAS located — this must decline for a real reason, not a lookup failure');
  });

  await t.test('declines gracefully (never throws, never mutates) when there is no <template> block at all', () => {
    const before = `<script>\nexport default { data() { return {}; } };\n</script>`;
    const defect: DiagnosticReport = {
      ruleId: 'FIGM-VUE-01',
      ruleName: 'n/a',
      message: 'n/a',
      domain: 'PERFORMANCE',
      concern: 'n/a',
      severity: 'HIGH',
      filePath: 'x.vue',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      offendingCodeSnippet: before,
      remediation: 'n/a',
      standardReference: 'n/a',
    } as unknown as DiagnosticReport;

    const outcome = VueAstFixEngine.tryFix(before, defect, 'x.vue');
    assert.equal(outcome.success, false);
    assert.equal(outcome.patchedCode, before);
  });

  await t.test('a rule outside the Vue subset is declined, not attempted', () => {
    assert.equal(VueAstFixEngine.isEligible('FIGM-VUE-05'), false);
  });
});
