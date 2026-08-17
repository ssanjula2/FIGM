import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';

/**
 * QA Validation Matrix — cross-cutting robustness cases (not specific to any one rule).
 * Complements the per-rule positive/negative/boundary/adversarial matrix in
 * tests/rule-detection-matrix.test.ts, tests/ast-detection-rules.test.ts, and
 * tests/adversarial-complete-detection.test.ts.
 *
 * Every assertion here was checked against the ACTUAL current engine behavior first (not
 * written against an assumed/desired behavior) — see the QA matrix report for the empirical
 * probe results this was derived from.
 */
test('QA Matrix — cross-cutting robustness', async (t) => {
  await t.test('[Empty file] does not throw, reports zero diagnostics, perfect quality score', () => {
    const result = RuleExecutionEngine.analyzeFile('Empty.tsx', '');
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.qualityScore, 100);
    assert.equal(result.parseErrors.length, 0);
  });

  await t.test('[Whitespace-only file] does not throw, reports zero diagnostics', () => {
    const result = RuleExecutionEngine.analyzeFile('Whitespace.tsx', '   \n\n\t\n   \n');
    assert.deepEqual(result.diagnostics, []);
  });

  await t.test('[Huge file] a 2000-violation, ~210KB file completes without throwing, in bounded time, with a correct-shaped diagnostics count', () => {
    const lines: string[] = [];
    for (let i = 0; i < 2000; i++) {
      lines.push(`items.map(item => { const cfg${i} = { a: ${i} }; return <span>{item}</span>; });`);
    }
    const code = lines.join('\n');
    assert.ok(code.length > 100000, 'sanity check: fixture really is a large file');

    const start = Date.now();
    const result = RuleExecutionEngine.analyzeFile('Huge.jsx', code);
    const elapsedMs = Date.now() - start;

    // Regression test for a real FIGM-PERF-01 false negative found via this fixture: the rule's
    // `const/let/var` check originally required the declaration to be the FIRST token on the
    // physical line (source-parser.ts), so this extremely common single-line
    // `.map(item => { const cfg = {...}; ... })` shape was invisible to the scanner (0
    // diagnostics instead of 2000). Fixed by matching the declaration anywhere in the line.
    const perf01 = result.diagnostics.filter((d) => d.ruleId === 'FIGM-PERF-01');
    assert.equal(perf01.length, 2000, 'one FIGM-PERF-01 invariant-object finding per line, no truncation and no duplication');
    const perf01Lines = perf01.map((d) => d.location.start.line);
    assert.equal(new Set(perf01Lines).size, 2000, 'each of the 2000 findings must be attributed to its own distinct line, not duplicated onto one');
    // The fixture also legitimately triggers one unrelated TypeScript compiler diagnostic
    // (JSX runtime module resolution, TYPE-TS-2875) -- this is a real, separate finding that
    // predates this fix and is not part of what this test is validating.
    const nonPerf01 = result.diagnostics.filter((d) => d.ruleId !== 'FIGM-PERF-01');
    assert.deepEqual(nonPerf01.map((d) => d.ruleId), ['TYPE-TS-2875']);
    assert.ok(elapsedMs < 15000, `performance regression guard: 2000-violation scan took ${elapsedMs}ms, expected under 15s`);
  });

  await t.test('[Unicode] non-ASCII identifiers, accented characters, and emoji in source do not break detection or corrupt positions', () => {
    // eslint-disable-next-line no-irregular-whitespace
    const code = `function Café({ 名前 }) {\n  const emoji = "🎉";\n  return <div onClick={() => {}}>{emoji} {名前}</div>;\n}`;
    const result = RuleExecutionEngine.analyzeFile('Unicode.jsx', code);
    assert.equal(result.diagnostics.length, 2, 'inline callback (FIGM-PERF-05) + missing keyboard handler (FIGM-A11Y-01)');
    assert.ok(result.diagnostics.some((d) => d.ruleId === 'FIGM-PERF-05'));
    assert.ok(result.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-01'));
    // Every diagnostic must carry a real, positive line number -- unicode must not corrupt line/column tracking.
    assert.ok(result.diagnostics.every((d) => (d.location?.start?.line ?? 0) > 0));
  });

  await t.test('[Multiple violations, single file] a file with several different real violations reports all of them, not just the first', () => {
    const code = [
      `import Heavy from 'monaco-editor';`,
      `function run(shouldTrack) { if (shouldTrack) { Heavy.load(); } }`,
      `window.addEventListener('scroll', () => {});`,
      `<img src={x.avatar} alt="Avatar" />`,
      `<div onClick={() => {}}>click</div>`,
    ].join('\n');
    const result = RuleExecutionEngine.analyzeFile('Multi.jsx', code);
    const ruleIds = new Set(result.diagnostics.map((d) => d.ruleId));
    assert.ok(ruleIds.size >= 3, `expected at least 3 distinct rules to fire, got: ${[...ruleIds].join(', ')}`);
  });

  await t.test('[Duplicate violations] the identical violation pattern repeated N times produces N independent diagnostics, not deduplicated to one', () => {
    const code = Array.from({ length: 5 }, () => `window.addEventListener('scroll', () => {});`).join('\n');
    const result = RuleExecutionEngine.analyzeFile('Dup.jsx', code);
    const perf03 = result.diagnostics.filter((d) => d.ruleId === 'FIGM-PERF-03');
    assert.equal(perf03.length, 5);
    const lines = perf03.map((d) => d.location.start.line);
    assert.deepEqual(new Set(lines).size, 5, 'each duplicate must be attributed to its own real line, not collapsed onto one');
  });

  await t.test('[Multiple files] scanning several files back-to-back does not leak diagnostics or state between calls', () => {
    const r1 = RuleExecutionEngine.analyzeFile('A.jsx', `window.addEventListener('scroll', () => {});`);
    const r2 = RuleExecutionEngine.analyzeFile('B.jsx', `const x = 1;`);
    const r3 = RuleExecutionEngine.analyzeFile('C.jsx', `window.addEventListener('resize', () => {});`);

    assert.equal(r1.diagnostics.length, 1);
    assert.equal(r2.diagnostics.length, 0, 'a clean file scanned between two violating files must stay clean -- no cross-contamination');
    assert.equal(r3.diagnostics.length, 1);
    assert.equal(r1.filePath, 'A.jsx');
    assert.equal(r2.filePath, 'B.jsx');
    assert.equal(r3.filePath, 'C.jsx');
  });

  await t.test('[Nested structures] a violation nested 20 levels deep inside conditionals is still detected', () => {
    let code = 'function f(items) {\n';
    for (let i = 0; i < 20; i++) code += '  '.repeat(i) + `if (items[${i}]) {\n`;
    code += '  '.repeat(21) + `window.addEventListener('scroll', () => {});\n`;
    for (let i = 20; i > 0; i--) code += '  '.repeat(i) + '}\n';
    code += '}\n';

    const result = RuleExecutionEngine.analyzeFile('Nested.jsx', code);
    assert.ok(result.diagnostics.some((d) => d.ruleId === 'FIGM-PERF-03'), 'deep nesting must not hide a real violation from the scanner');
  });

  await t.test('[Unsupported syntax] an unrecognized/unsupported framework (.svelte) degrades to zero findings rather than crashing or misapplying rules', () => {
    const result = RuleExecutionEngine.analyzeFile('Widget.svelte', '<script>let x = 1;</script><div onclick={() => {}}>{x}</div>');
    assert.equal(result.framework, 'SVELTE');
    assert.equal(result.diagnostics.length, 0, 'no FIGM rule targets SVELTE today -- must honestly report nothing rather than guessing with a mismatched framework\'s rules');
  });

  await t.test('[Parser failure / malformed syntax] an unclosed brace does not throw, across React, Vue, and Angular source shapes', () => {
    const cases: Array<[string, string]> = [
      ['React', 'function F() {\n  return <div>\n'],
      ['Vue', '<template>\n  <div>\n'],
      ['Angular', '@Component({\n  template: `<div>\n'],
    ];
    for (const [name, code] of cases) {
      assert.doesNotThrow(() => RuleExecutionEngine.analyzeFile(`Broken.${name}.tsx`, code), `${name} malformed input must not throw`);
      const result = RuleExecutionEngine.analyzeFile(`Broken.${name}.tsx`, code);
      assert.ok(Array.isArray(result.diagnostics), `${name} must still return a well-formed result shape even when malformed`);
    }
  });

  await t.test('[Regression] Vue v-for template loop with an invariant attribute-bound object literal is detected (FIGM-PERF-01)', () => {
    // Found via the real-world ground-truth benchmark (benchmarks/testbed/VueBenchmark.vue line
    // 11): Vue's template-level `v-for="item in products"` directive never matched any of the
    // JS-syntax loop triggers (.map(/.forEach(/for (/while () that set LOOP scope, AND even if it
    // had, `:style="{ color: 'blue' }"` is a template attribute binding, not a const/let/var
    // declaration -- so this was a genuine false negative in the real-world benchmark, not a
    // contrived case. Fixed by (1) recognizing `v-for=` as a LOOP scope trigger and (2) matching
    // Vue's `:attr="{...}"` object-literal attribute-binding shape alongside the JS declaration
    // shape.
    const code = `<template>\n  <div v-for="item in products" :key="item.id">\n    <span :style="{ color: 'blue', padding: '4px' }">{{ item.title }}</span>\n  </div>\n</template>`;
    const result = RuleExecutionEngine.analyzeFile('Widget.vue', code);
    assert.ok(result.diagnostics.some((d) => d.ruleId === 'FIGM-PERF-01'), 'a Vue v-for loop allocating an invariant style object must be detected, matching FIGM-PERF-01\'s existing JSX/script behavior');
  });

  await t.test('[Regression] a JSX read of `item.name` inside render output is not misclassified as a state mutation (FIGM-REACT-03)', () => {
    // Found via the real-world ground-truth benchmark (benchmarks/testbed/ReactBenchmark.jsx line
    // 39, `return <span key={item.id} style={itemConfig}>{item.name}</span>;`): the old check
    // fired on ANY line containing both an "=" ANYWHERE (including JSX `key=`/`style=` prop
    // syntax) and the substring ".name"/"state." ANYWHERE (including a plain JSX read like
    // `{item.name}`) -- a confirmed false positive on real, unmodified benchmark code, not a
    // contrived adversarial construction. Fixed by requiring ".name"/"state.<prop>" to be
    // immediately followed by a genuine single "=" assignment operator.
    const code = `function List({ items }) {\n  return items.map(item => <span key={item.id} style={itemConfig}>{item.name}</span>);\n}`;
    const result = RuleExecutionEngine.analyzeFile('List.jsx', code);
    assert.equal(result.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'a JSX read of item.name must not be misclassified as a direct state mutation');
  });

  await t.test('[Regression] a property assignment/array mutation with no React-state evidence anywhere in the file is not flagged (FIGM-REACT-03)', () => {
    // Found via the real-world benchmark (benchmarks/real-world/SPOT_CHECK.md #3, #5, #8, #15,
    // scanning 5 genuine public GitHub repos): the old check fired on ANY `obj.prop = value`
    // assignment or array-mutation-method call, with no check that `obj`/the array is actually
    // bound to React state -- 4 of the spot-check's 5 false positives all traced to this one root
    // cause: `Button.defaultProps = {...}` (a static React class property, not state),
    // `module.exports = withNextra()` and a Karma config's `module.exports = function(config)`
    // (plain CommonJS exports, zero React), and `ctx.fillStyle = ...` (a Canvas 2D context
    // property in a file with no React at all). Independently reconfirmed by FIGM dogfooding its
    // own source: app/live-scan/page.tsx's computeLineDiff() mutates a plain local `rows` array
    // (`const rows = []; rows.push(...)`) with no relation to React state, and used to be flagged
    // 7 times. Fixed by requiring positive, file-wide evidence the mutated identifier is actually
    // state (a useState-destructured binding -- including through a renamed/aliased import or the
    // React.useState namespace form --, a matching setX(...) setter call, or a this.state chain)
    // before firing at all, replacing the old "flag everything except a fixed denylist" behavior.
    const nonReactCases = [
      { label: 'static defaultProps assignment', code: `Button.defaultProps = { color: 'steelblue' };` },
      { label: 'CommonJS module.exports assignment', code: `module.exports = withNextra();` },
      { label: 'Canvas 2D context property assignment', code: `ctx.fillStyle = ball.visible ? '#0095dd' : 'transparent';` },
      { label: 'plain local array .push() with no state binding anywhere', code: `function computeLineDiff() {\n  const rows = [];\n  rows.push({ type: 'removed' });\n  return rows;\n}` },
    ];
    for (const { label, code } of nonReactCases) {
      const result = RuleExecutionEngine.analyzeFile('NonReact.js', code);
      assert.equal(result.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, `${label} must not be misclassified as a direct state mutation`);
    }

    // The same shapes, on genuinely useState-bound identifiers, must still fire -- the fix narrows
    // the false-positive surface without losing the rule's real detection capability.
    const genuineStateCases = [
      { label: 'useState-bound array .push()', code: `import { useState } from 'react';\nfunction Add() {\n  const [list, setList] = useState([]);\n  function add(item) { list.push(item); }\n  return list;\n}` },
      { label: 'this.state.list.push() in a class component', code: `class Foo extends React.Component {\n  add(x) {\n    this.state.list.push(x);\n  }\n}` },
    ];
    for (const { label, code } of genuineStateCases) {
      const result = RuleExecutionEngine.analyzeFile('GenuineState.jsx', code);
      assert.ok(result.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-03'), `${label} must still be flagged as a direct state mutation`);
    }
  });

  await t.test('[String containing code-like text] a display string that looks like a violation is not flagged (regression: see docs/audit/ADVERSARIAL_DETECTION_AUDIT.md)', () => {
    const code = `const helpText = "Example: window.addEventListener('scroll', fn) needs cleanup";\nfunction Widget() { return <div>{helpText}</div>; }`;
    const result = RuleExecutionEngine.analyzeFile('StringText.jsx', code);
    assert.equal(result.diagnostics.filter((d) => d.ruleId === 'FIGM-PERF-03').length, 0, 'a string literal describing the pattern must not itself trigger the rule');
  });

  await t.test('[Comment containing code-like text] a comment mentioning a violation pattern is not flagged', () => {
    const code = `// TODO: this used to have window.addEventListener('scroll', fn) without cleanup, now fixed\nfunction Widget() { return <div>ok</div>; }`;
    const result = RuleExecutionEngine.analyzeFile('CommentText.jsx', code);
    assert.equal(result.diagnostics.filter((d) => d.ruleId === 'FIGM-PERF-03').length, 0);
  });
});
