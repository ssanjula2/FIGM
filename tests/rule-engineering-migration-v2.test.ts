import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * Rule Engineering Pass — Group 4 real-AST migration regression suite.
 *
 * Dedicated coverage for the seven rules migrated to real AST in this pass (see
 * docs/architecture/RULE_ENGINEERING_AUDIT.md and src/ast/real-syntax-node-builder.ts's "Group 4"
 * section): FIGM-PERF-03, FIGM-PERF-05, FIGM-PERF-06, FIGM-A11Y-05, FIGM-A11Y-06, FIGM-REACT-01,
 * FIGM-REACT-04. Each rule gets six categories: positive (clear violation), negative (clear
 * compliant code), boundary (an ambiguous/edge-case shape), adversarial (code shaped to probe the
 * detection mechanism itself, including cases that now behave differently than the pre-migration
 * legacy heuristic -- documented as intentional fixes, not accidental drift), malformed (the
 * engine must never crash), and regression (pins down a specific documented semantic decision
 * made during this migration so it cannot silently regress later).
 *
 * These complement, not replace, the existing oracles that already re-ran green against this
 * migration unchanged: tests/rule-detection-matrix.test.ts (positive+negative, all 25 rules),
 * tests/qa-matrix-boundary-adversarial.test.ts (boundary+adversarial, all 25 rules, updated in
 * this pass only where the migration demonstrably changed behavior), tests/ast-migration.test.ts
 * (sourceKind provenance).
 */

function diagnosticsFor(code: string, filePath: string) {
  return RuleExecutionEngine.analyzeFile(filePath, code).diagnostics;
}

function find(code: string, filePath: string, ruleId: string) {
  return diagnosticsFor(code, filePath).find((d) => d.ruleId === ruleId);
}

function assertFires(code: string, filePath: string, ruleId: string, msg?: string) {
  const d = find(code, filePath, ruleId);
  assert.ok(d, msg ?? `expected ${ruleId} to fire on: ${code}`);
  return d!;
}

function assertNotFires(code: string, filePath: string, ruleId: string, msg?: string) {
  const d = find(code, filePath, ruleId);
  assert.equal(d, undefined, msg ?? `expected ${ruleId} NOT to fire on: ${code}`);
}

function assertRealAst(code: string, filePath: string, ruleId: string) {
  const d = assertFires(code, filePath, ruleId);
  assert.equal(d.sourceKind, 'REAL_AST', `${ruleId} should be REAL_AST-labeled on ${filePath}`);
  assert.match(d.evidence ?? '', /^Real AST \(TypeScript compiler\)/);
  return d;
}

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-03 — addEventListener without matching removeEventListener
// ---------------------------------------------------------------------------------------------
test('FIGM-PERF-03 (real AST)', async (t) => {
  await t.test('[positive] addEventListener with no cleanup anywhere fires', () => {
    const code = `function setup() {\n  window.addEventListener('resize', handleResize);\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-03');
  });

  await t.test('[negative] addEventListener paired with removeEventListener for the same event type does not fire', () => {
    const code = `function setup() {\n  window.addEventListener('resize', handleResize);\n  return () => window.removeEventListener('resize', handleResize);\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-PERF-03');
  });

  await t.test('[boundary] a scroll listener leaks while an unrelated resize listener is cleaned up (event-type-aware pairing)', () => {
    const code = `function A() { window.addEventListener('scroll', onScroll); }\nfunction B() { window.removeEventListener('resize', onResize); }`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-03');
  });

  await t.test('[adversarial] a comment falsely claiming cleanup happens elsewhere cannot suppress the finding', () => {
    const code = `// removeEventListener happens elsewhere, trust me\nwindow.addEventListener('scroll', onScroll);`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-03');
  });

  await t.test('[malformed] unterminated addEventListener call does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`window.addEventListener('scroll', onScroll`, 'a.tsx'));
  });

  await t.test('[regression] dynamic (non-string-literal) event name falls back to "any removeEventListener suppresses" (matches legacy)', () => {
    const code = `function setup(eventName) {\n  window.addEventListener(eventName, handler);\n  window.removeEventListener('unrelated', otherHandler);\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-PERF-03');
  });
});

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-05 — inline anonymous callback in render loop
// ---------------------------------------------------------------------------------------------
test('FIGM-PERF-05 (real AST)', async (t) => {
  await t.test('[positive] inline arrow onClick inside .map() fires', () => {
    const code = `function List({ items }) {\n  return items.map(item => <Card onClick={() => handleClick(item.id)} />);\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-05');
  });

  await t.test('[negative] a stable named handler reference inside .map() does not fire', () => {
    const code = `function List({ items }) {\n  return items.map(item => <div onClick={handleClick}>{item}</div>);\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-PERF-05');
  });

  await t.test('[boundary] inline arrow handler outside any loop, directly in a component render, still fires (RENDER scope)', () => {
    const code = `function Widget() {\n  return <button onClick={() => doThing()}>Go</button>;\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-05');
  });

  await t.test('[adversarial] inline arrow bound to a local const and referenced by name (e.g. wrapped in useCallback) is correctly not flagged', () => {
    const code = `items.map((item) => { const cb = useCallback(() => doThing(item), [item]); return <div onClick={cb}>{item}</div>; });`;
    assertNotFires(code, 'a.tsx', 'FIGM-PERF-05');
  });

  await t.test('[malformed] unterminated JSX attribute expression does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`items.map(item => <div onClick={() =>`, 'a.tsx'));
  });

  await t.test('[regression] generalized beyond onClick to any on* handler prop (documented scope refinement, not a silent broadening)', () => {
    const code = `items.map(item => <input onChange={() => handleChange(item.id)} />);`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-05');
  });
});

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-06 — synchronous storage access in loop
// ---------------------------------------------------------------------------------------------
test('FIGM-PERF-06 (real AST)', async (t) => {
  await t.test('[positive] localStorage.setItem called directly inside .forEach fires', () => {
    const code = `function save(items) {\n  items.forEach(item => { localStorage.setItem(item.id, item.value); });\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-06');
  });

  await t.test('[negative] localStorage read once outside any loop does not fire', () => {
    const code = `function run(items) {\n  const token = localStorage.getItem('token');\n  return items.map(item => process(item, token));\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-PERF-06');
  });

  await t.test('[boundary] the call itself is outside the loop even though its RESULT is used inside one', () => {
    const code = `const cached = localStorage.getItem('x');\nfunction run(items) { items.forEach(item => console.log(item, cached)); }`;
    assertNotFires(code, 'a.tsx', 'FIGM-PERF-06');
  });

  await t.test('[adversarial] sessionStorage (not just localStorage) inside a for-loop also fires', () => {
    const code = `function run(items) {\n  for (let i = 0; i < items.length; i++) { sessionStorage.setItem('k' + i, items[i]); }\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-06');
  });

  await t.test('[malformed] a for-loop with a broken condition does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`for (let i = 0; i <; i++) { localStorage.getItem('x'); }`, 'a.tsx'));
  });

  await t.test('[regression] a non-storage object named "localStorage" is out of scope (unchanged from legacy -- no binding analysis)', () => {
    // KNOWN LIMITATION preserved from the legacy heuristic: detection is purely syntactic on the
    // identifier name `localStorage`/`sessionStorage`, not a real global-binding check.
    const code = `function run(items) {\n  const localStorage = { setItem() {} };\n  items.forEach(item => localStorage.setItem(item.id, item.value));\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-PERF-06');
  });
});

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-05 — unlabeled form input
// ---------------------------------------------------------------------------------------------
test('FIGM-A11Y-05 (real AST)', async (t) => {
  await t.test('[positive] <input> with no aria-label, id, or placeholder-derivable label fires', () => {
    const code = `function Field() { return <input type="text" />; }`;
    assertRealAst(code, 'a.tsx', 'FIGM-A11Y-05');
  });

  await t.test('[negative] <textarea> with an explicit aria-label does not fire', () => {
    const code = `function Field() { return <textarea aria-label="Comments" />; }`;
    assertNotFires(code, 'a.tsx', 'FIGM-A11Y-05');
  });

  await t.test('[boundary] input has an id and a matching <label htmlFor> exists elsewhere in the file', () => {
    const code = `function Field() {\n  return (\n    <div>\n      <label htmlFor="email">Email</label>\n      <input id="email" type="email" />\n    </div>\n  );\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-A11Y-05');
  });

  await t.test('[adversarial] <select> with an id but no htmlFor/for anywhere in the file is still flagged', () => {
    const code = `function Field() { return <select id="country"><option>US</option></select>; }`;
    assertRealAst(code, 'a.tsx', 'FIGM-A11Y-05');
  });

  await t.test('[malformed] unterminated input tag does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`function Field() { return <input type="text"`, 'a.tsx'));
  });

  await t.test('[regression] htmlFor presence anywhere in the file (not verified to match this exact input\'s id) is preserved as a documented over-approximation', () => {
    const code = `function Fields() {\n  return (\n    <div>\n      <label htmlFor="unrelated-field">Other</label>\n      <input id="email" type="email" />\n    </div>\n  );\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-A11Y-05');
  });
});

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-06 — positive tabIndex overrides natural focus order
// ---------------------------------------------------------------------------------------------
test('FIGM-A11Y-06 (real AST)', async (t) => {
  await t.test('[positive] tabIndex={5} fires', () => {
    const code = `function Go() { return <button tabIndex={5}>Go</button>; }`;
    assertRealAst(code, 'a.tsx', 'FIGM-A11Y-06');
  });

  await t.test('[negative] tabIndex={0} (natural order) does not fire', () => {
    const code = `function Go() { return <button tabIndex={0}>Go</button>; }`;
    assertNotFires(code, 'a.tsx', 'FIGM-A11Y-06');
  });

  await t.test('[boundary] tabIndex={-1} (removed from tab order, not overriding it) does not fire', () => {
    const code = `function Go() { return <button tabIndex={-1}>Go</button>; }`;
    assertNotFires(code, 'a.tsx', 'FIGM-A11Y-06');
  });

  await t.test('[adversarial] string-literal form tabIndex="3" (not the JSX-expression numeric form) still fires', () => {
    const code = `function Go() { return <button tabIndex="3">Go</button>; }`;
    assertRealAst(code, 'a.tsx', 'FIGM-A11Y-06');
  });

  await t.test('[malformed] unterminated tabIndex expression does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`function Go() { return <button tabIndex={`, 'a.tsx'));
  });

  await t.test('[regression] a variable-valued tabIndex (not a literal) is out of scope (unchanged from legacy -- no constant-folding)', () => {
    const code = `function Go({ order }) { return <button tabIndex={order}>Go</button>; }`;
    assertNotFires(code, 'a.tsx', 'FIGM-A11Y-06');
  });
});

// ---------------------------------------------------------------------------------------------
// FIGM-REACT-01 — expensive derived computation without useMemo
// ---------------------------------------------------------------------------------------------
test('FIGM-REACT-01 (real AST)', async (t) => {
  await t.test('[positive] .sort() with no useMemo anywhere fires', () => {
    const code = `function List({ items }) {\n  const sorted = items.sort((a, b) => a.name.localeCompare(b.name));\n  return sorted;\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-REACT-01');
  });

  await t.test('[negative] .filter() wrapped in useMemo on the same line does not fire', () => {
    const code = `function List({ items }) {\n  const filtered = useMemo(() => items.filter(x => x.active), [items]);\n  return filtered;\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-REACT-01');
  });

  await t.test('[boundary, regression] a MULTI-LINE useMemo body is now correctly recognized via real ancestor walk (fixes a same-line-only false positive)', () => {
    const code = `function List({ items }) {\n  const sorted = useMemo(() => {\n    return items.sort((a, b) => a.name.localeCompare(b.name));\n  }, [items]);\n  return sorted;\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-REACT-01');
  });

  await t.test('[adversarial] an unrelated "useMemo" substring on the same line no longer suppresses a genuinely unmemoized computation (fixes a false negative)', () => {
    const code = `function List({ items, useMemoFlag }) {\n  const sorted = items.sort((a, b) => a.name.localeCompare(b.name)); // useMemoFlag intentionally unused here\n  return sorted;\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-REACT-01');
  });

  await t.test('[malformed] unterminated .reduce() call does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`const total = items.reduce((a, b) => a + b`, 'a.tsx'));
  });

  await t.test('[regression] a fresh array built via spread + .sort() is still flagged (no scope restriction, matches legacy)', () => {
    const code = `function List({ items }) {\n  const sorted = [...items].sort((a, b) => a - b);\n  return sorted;\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-REACT-01');
  });
});

// ---------------------------------------------------------------------------------------------
// FIGM-REACT-04 — inline callback prop to child component without useCallback
// ---------------------------------------------------------------------------------------------
test('FIGM-REACT-04 (real AST)', async (t) => {
  await t.test('[positive] inline arrow onClick passed to <Button> fires', () => {
    const code = `function Toolbar() { return <Button onClick={() => doThing()}>Click</Button>; }`;
    assertRealAst(code, 'a.tsx', 'FIGM-REACT-04');
  });

  await t.test('[negative] a memoized callback reference (not an inline arrow) passed to <Card> does not fire', () => {
    const code = `function Widget() {\n  const handleClick = useCallback(() => doThing(), []);\n  return <Card onClick={handleClick}>x</Card>;\n}`;
    assertNotFires(code, 'a.tsx', 'FIGM-REACT-04');
  });

  await t.test('[boundary] inline arrow onClick passed to a lowercase host element (not a tracked custom component) does not fire', () => {
    const code = `function Widget() { return <div onClick={() => doThing()}>Click</div>; }`;
    assertNotFires(code, 'a.tsx', 'FIGM-REACT-04');
  });

  await t.test('[adversarial, regression] tag and onClick attribute on SEPARATE physical lines now correctly detected (fixes a same-line-only false negative)', () => {
    const code = `function Toolbar() {\n  return (\n    <CustomButton\n      label="Save"\n      onClick={() => doThing()}\n    >\n      Save\n    </CustomButton>\n  );\n}`;
    assertRealAst(code, 'a.tsx', 'FIGM-REACT-04');
  });

  await t.test('[malformed] unterminated <Card> JSX does not crash the engine', () => {
    assert.doesNotThrow(() => diagnosticsFor(`function Widget() { return <Card onClick={() => doThing()}`, 'a.tsx'));
  });

  await t.test('[regression] inline arrow WITH a parameter (e.g. onClick={(e) => ...}) is now detected (documented scope refinement: legacy text match required literally "() =>")', () => {
    const code = `function Widget() { return <Card onClick={(e) => doThing(e)}>x</Card>; }`;
    assertRealAst(code, 'a.tsx', 'FIGM-REACT-04');
  });
});

// ---------------------------------------------------------------------------------------------
// Cross-cutting: Vue stays fully LEGACY_TEXT_HEURISTIC for every Group-4 rule (never real-AST-parsed)
// ---------------------------------------------------------------------------------------------
test('Group 4 rules on VUE_SFC remain LEGACY_TEXT_HEURISTIC (Vue is never real-AST-parsed)', () => {
  const code = `<template>\n  <input id="email" />\n  <button tabindex="5">Go</button>\n</template>\n<script>\nexport default {};\n</script>`;
  const diags = diagnosticsFor(code, 'Component.vue');
  const relevant = diags.filter((d) => ['FIGM-A11Y-05', 'FIGM-A11Y-06'].includes(d.ruleId));
  assert.ok(relevant.length > 0, 'expected at least one Group-4 rule to fire on this Vue fixture');
  for (const d of relevant) {
    assert.equal(d.sourceKind, 'LEGACY_TEXT_HEURISTIC', `${d.ruleId} must stay LEGACY_TEXT_HEURISTIC for a Vue file`);
  }
});
