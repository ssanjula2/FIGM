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

  await t.test('[Regression] categorical non-state root identifiers (document/router) and ref.current are excluded even when the same file has genuine, separate React state evidence (FIGM-REACT-03)', () => {
    // Companion to the previous test: that one proves "no evidence anywhere in the file" is
    // enough to suppress a false positive. This proves the categorical exclusions
    // (NON_STATE_ROOT_IDENTIFIERS / isRefCurrentAccess in real-syntax-node-builder.ts) hold even
    // in the harder case where the SAME file legitimately has useState evidence for an unrelated
    // variable -- i.e. the exclusion is a real structural check on the mutation target, not just
    // a side effect of the file having no React content at all. Found live via bb01d1c1 dogfooding
    // FIGM's own auth/login, diagnostics, and profile pages, which mix real useState calls with
    // `router.push(...)` navigation and `document.body.style.overflow = 'hidden'` scroll locks.
    const refCase = `import { useRef } from 'react';\nfunction Widget() {\n  const boxRef = useRef(null);\n  function focusIt() { boxRef.current.value = 'x'; }\n  return null;\n}`;
    const refResult = RuleExecutionEngine.analyzeFile('RefWidget.tsx', refCase);
    assert.equal(refResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'ref.current assignment must never be flagged as state mutation, regardless of ref variable name');

    const scrollLockCase = `import { useState } from 'react';\nfunction Modal() {\n  const [count, setCount] = useState(0);\n  function lock() { document.body.style.overflow = 'hidden'; }\n  function bump() { count.value = 1; }\n  return null;\n}`;
    const scrollLockResult = RuleExecutionEngine.analyzeFile('Modal.tsx', scrollLockCase);
    const scrollLockHits = scrollLockResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03');
    assert.equal(scrollLockHits.length, 1, 'only the genuine count.value mutation should fire, not the document.body.style scroll lock in the same file');
    assert.ok(!scrollLockHits[0].offendingCodeSnippet?.includes('document.body.style'), 'the single reported finding must be the real state mutation, not the DOM style assignment');

    const routerCase = `import { useState } from 'react';\nfunction Nav() {\n  const [count, setCount] = useState(0);\n  const router = useRouter();\n  function go() { router.push('/guidelines'); }\n  return null;\n}`;
    const routerResult = RuleExecutionEngine.analyzeFile('Nav.tsx', routerCase);
    assert.equal(routerResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'router.push() navigation must never be flagged as a state mutation, even in a file with unrelated real useState evidence');
  });

  await t.test('[Regression] a Karma test-runner config file and a plain local-object-property helper are not flagged, and non-React/Vue framework files never evaluate the rule (FIGM-REACT-03)', () => {
    // Karma config is called out separately here (rather than folded into the module.exports case
    // above) because it is the exact real-world artifact the benchmark spot-check found
    // (benchmarks/real-world/SPOT_CHECK.md #8) -- a `.js` file with zero JSX/React syntax at all,
    // so it also exercises the framework-detection path (not just the state-evidence path).
    const karmaCode = `module.exports = function(config) {\n  config.set({\n    frameworks: ['jasmine'],\n    files: ['src/**/*.spec.ts'],\n    browsers: ['ChromeHeadless'],\n  });\n};`;
    const karmaResult = RuleExecutionEngine.analyzeFile('karma.conf.js', karmaCode);
    assert.equal(karmaResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'a Karma test-runner config must not be flagged as a React state mutation');

    // Local object property assignment (not an array), same "no state evidence" root cause as the
    // rows.push() array case above but exercising Shape B (obj.prop = value) instead of Shape A.
    const localObjectCode = `function buildOptions() {\n  const opts = {};\n  opts.color = 'blue';\n  opts.size = 'lg';\n  return opts;\n}`;
    const localObjectResult = RuleExecutionEngine.analyzeFile('helpers.js', localObjectCode);
    assert.equal(localObjectResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'a plain local object built and mutated inside a helper function must not be flagged as a React state mutation');

    // Vue Options API `this.count = ...` inside a `.vue` file's methods block: structurally
    // identical to a React class's `this.state.x = value` shape, but this is Vue's own idiomatic
    // reactive-data mutation pattern, not React state -- the FIGM-REACT-03 rule is React/Next-only
    // (see evalReact03's framework gate in ast-detection-engine.ts) and must stay that way rather
    // than being broadened onto other frameworks' `this.*` conventions.
    const vueCode = `export default {\n  data() { return { count: 0 }; },\n  methods: {\n    inc() { this.count = this.count + 1; }\n  }\n};`;
    const vueResult = RuleExecutionEngine.analyzeFile('Widget.vue', vueCode);
    assert.equal(vueResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'Vue Options API this.count mutation must not be flagged by the React-specific state-mutation rule');
  });

  await t.test('[Positive] genuine state mutation is still detected inside a nested function, and across multiple components in one file (FIGM-REACT-03)', () => {
    // Nested function: the file-wide identifier search that replaced the old unconditional
    // heuristic must not accidentally become scope-limited to only the top-level function body.
    const nestedCode = `import { useState } from 'react';\nfunction A() {\n  const [list, setList] = useState([]);\n  function outer() {\n    function inner() { list.push(1); }\n    inner();\n  }\n  return null;\n}`;
    const nestedResult = RuleExecutionEngine.analyzeFile('Nested.tsx', nestedCode);
    assert.ok(nestedResult.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-03'), 'a genuine state mutation two function scopes deep must still be detected');

    // Multiple components in one file: component B's plain, non-state `cfg.color = ...` must not
    // be dragged in just because component A elsewhere in the same file has real useState evidence
    // for a differently-named variable.
    const multiComponentCode = `import { useState } from 'react';\nfunction A() {\n  const [items, setItems] = useState([]);\n  function add(x) { items.push(x); }\n  return null;\n}\nfunction B() {\n  const cfg = {};\n  cfg.color = 'blue';\n  return null;\n}`;
    const multiResult = RuleExecutionEngine.analyzeFile('MultiComponent.tsx', multiComponentCode);
    const multiHits = multiResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03');
    assert.equal(multiHits.length, 1, 'exactly one finding: component A\'s real items.push(), not component B\'s unrelated cfg.color');
    assert.ok(multiHits[0].offendingCodeSnippet?.includes('items.push'), 'the one finding must be the genuine state mutation in component A');
  });

  await t.test('[Known limitation, documented] the file-wide state-name search is name-based, not scope-based, so an unrelated identical identifier name elsewhere in the file can still over-match (FIGM-REACT-03)', () => {
    // This is the documented, disclosed residual limitation of the fix in
    // real-syntax-node-builder.ts (see findStateLikeNames's own doc comment: "it can still under-
    // or over-match if two unrelated functions in the same file happen to reuse an identifier
    // name"). This test locks in that ACTUAL current behavior so it can't silently regress further
    // (e.g. to flagging unconditionally again) without this test forcing a conscious update, while
    // being explicit in this test's own name that the false positive here is a known, bounded,
    // accepted tradeoff -- not a claim that this rule does full lexical-scope/type-checker binding
    // resolution. See docs/architecture/RULE_ENGINEERING_AUDIT.md FIGM-REACT-03 section.
    const code = `import { useState } from 'react';\nfunction A() {\n  const [count, setCount] = useState(0);\n  function bump() { count.value = 1; }\n  return null;\n}\nfunction unrelatedHelper() {\n  const count = { value: 0 };\n  count.value = 99;\n  return count;\n}`;
    const result = RuleExecutionEngine.analyzeFile('NameCollision.tsx', code);
    const hits = result.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03');
    assert.equal(hits.length, 2, 'KNOWN LIMITATION: both the genuine count.value mutation in A and the unrelated same-named local in unrelatedHelper fire, since the search is file-wide by identifier name, not by lexical binding/scope');
  });

  await t.test('[Regression] a plain vanilla-JS file with its own unrelated function coincidentally named setX(...) is not flagged, but the same setX naming convention still works in real React/JSX files (FIGM-REACT-03)', () => {
    // Found via re-running benchmarks/real-world/run-real-world-benchmark.ts against
    // bradtraversy/vanillawebprojects after the file-wide-evidence fix above (this test's sibling
    // "no evidence anywhere in the file" regression test) had already eliminated that benchmark's
    // other FIGM-REACT-03 false positives: memory-cards/script.js defines `const cardsData = ...`
    // and a plain, entirely non-React helper `function setCardsData(cards) { ... }` (the common
    // "function that updates X" naming convention, unrelated to React's hook setters) and then
    // does `cardsData.push(newCard); setCardsData(cardsData);` -- zero JSX, zero React import,
    // GENERIC_ESTREE framework. The setX(...)-naming-convention evidence signal (kind 2 in
    // findStateLikeNames' doc comment) fired purely on the name coincidence. Fixed by gating that
    // signal on the file having real React/JSX context (REACT_JSX/NEXT_JS framework, a real
    // `import ... from 'react'`, or actual JSX syntax) -- the stronger useState-destructuring
    // signal (kind 1) needs no such gate and is unaffected.
    const vanillaCode = `const cardsData = getCardsData();\nfunction setCardsData(cards) { localStorage.setItem('cards', JSON.stringify(cards)); }\nfunction addCard(newCard) {\n  cardsData.push(newCard);\n  setCardsData(cardsData);\n}`;
    const vanillaResult = RuleExecutionEngine.analyzeFile('script.js', vanillaCode);
    assert.equal(vanillaResult.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-03').length, 0, 'a vanilla-JS setX helper with no React context must not be misclassified as a state setter');

    // The same setX naming-convention signal must still fire for real React code with no
    // useState(...) call literally present in the mutating function's own snippet -- this is the
    // exact shape several of this rule's own pre-existing regression fixtures use (a .jsx file is
    // itself real, deliberate React authoring context).
    const reactCode = `function update() {\n  user.name = 'John';\n  setUser(user);\n}`;
    const reactResult = RuleExecutionEngine.analyzeFile('UserProfile.jsx', reactCode);
    assert.ok(reactResult.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-03'), 'setUser(...) naming-convention evidence must still fire inside a real .jsx React file');
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
