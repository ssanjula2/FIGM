import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine';

/**
 * Phase 2 (AST/Rule Coverage Gaps), item 3 — FIGM-PERF-01's data-flow limitation.
 *
 * Prior behavior: any `const/let/var = {...}` declaration in loop/render scope was flagged as
 * "invariant" (hoistable) unconditionally, with no check for whether the object's own content
 * actually depended on the loop's per-iteration variable — a documented false positive (see the
 * updated case in tests/qa-matrix-boundary-adversarial.test.ts) that contradicted the rule's own
 * name and intent ("Invariant Object Allocation" should mean the object's value never changes
 * across iterations).
 *
 * Fix: src/ast/real-syntax-node-builder.ts's buildPerf01 now resolves the nearest enclosing
 * loop/array-iteration-callback's bound name(s) (loopBoundNames) and skips flagging when the
 * object literal genuinely references one of them (referencesAnyBoundName) — a narrow,
 * identifier-reference check, deliberately not a full data-flow/alias analysis (see that
 * function's own doc comment for why a broader rewrite was not attempted here).
 */

function scan(code: string, filePath: string) {
  const parsed = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
}

function fires(code: string, filePath = 'component.jsx'): boolean {
  return scan(code, filePath).some((d) => d.ruleId === 'FIGM-PERF-01');
}

test('FIGM-PERF-01 — supported data-flow cases (narrow loop-binding check)', async (t) => {
  await t.test('still flagged: a genuinely invariant object with no reference to the loop variable', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    const cfg = { theme: 'dark' };\n    return cfg;\n  });\n}`;
    assert.equal(fires(code), true, 'a truly hoistable object must still be flagged');
  });

  await t.test('NOT flagged: object built from a direct member access on the .map() loop variable', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    const cfg = { id: item.id };\n    return cfg;\n  });\n}`;
    assert.equal(fires(code), false, 'cfg depends on item.id — not actually invariant');
  });

  await t.test('NOT flagged: object built from a destructured .map() parameter', () => {
    const code = `function render(items) {\n  return items.map(({ id }) => {\n    const cfg = { id };\n    return cfg;\n  });\n}`;
    assert.equal(fires(code), false, 'cfg depends on the destructured id — not actually invariant');
  });

  await t.test('NOT flagged: object built from a .forEach() loop variable', () => {
    const code = `function render(items) {\n  const out = [];\n  items.forEach(item => {\n    const cfg = { id: item.id };\n    out.push(cfg);\n  });\n  return out;\n}`;
    assert.equal(fires(code), false);
  });

  await t.test('NOT flagged: object built from a for...of loop variable', () => {
    const code = `function render(items) {\n  const out = [];\n  for (const item of items) {\n    const cfg = { id: item.id };\n    out.push(cfg);\n  }\n  return out;\n}`;
    assert.equal(fires(code), false);
  });

  await t.test('NOT flagged: object built from a classic for-loop index variable', () => {
    const code = `function render(items) {\n  const out = [];\n  for (let i = 0; i < items.length; i++) {\n    const cfg = { index: i };\n    out.push(cfg);\n  }\n  return out;\n}`;
    assert.equal(fires(code), false);
  });

  await t.test('NOT flagged: object spreads the loop variable directly', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    const cfg = { ...item, extra: true };\n    return cfg;\n  });\n}`;
    assert.equal(fires(code), false, 'a spread of the loop variable is a direct per-item dependency');
  });

  await t.test('NOT flagged: shorthand property referencing the loop variable by the same name', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    const cfg = { item };\n    return cfg;\n  });\n}`;
    assert.equal(fires(code), false);
  });

  await t.test('NOT flagged: nested property access through a destructured object parameter', () => {
    const code = `function render(items) {\n  return items.map(({ meta }) => {\n    const cfg = { tag: meta.tag };\n    return cfg;\n  });\n}`;
    assert.equal(fires(code), false);
  });

  await t.test('still flagged: sibling declaration in the SAME loop that does NOT reference the loop variable', () => {
    const code = `function render(items) {\n  return items.map(item => {\n    const cfg = { id: item.id };\n    const style = { color: 'red' };\n    return { cfg, style };\n  });\n}`;
    const diags = scan(code, 'component.jsx').filter((d) => d.ruleId === 'FIGM-PERF-01');
    assert.equal(diags.length, 1, 'exactly one declaration (style) is genuinely invariant; cfg must not be flagged');
    assert.match(diags[0].offendingCodeSnippet, /style/);
  });
});
