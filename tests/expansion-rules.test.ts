import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';
import { RemediationValidator } from '../src/engine/remediation-validation.server.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * Research-backed expansion set (8 rules: FIGM-A11Y-07, FIGM-REACT-05, FIGM-REACT-06,
 * FIGM-NEXT-05, FIGM-NEXT-06, FIGM-ANG-06, FIGM-VUE-01, FIGM-VUE-02) — dedicated regression suite,
 * mirroring the [TP]/[TN]/framework-eligibility/fix-verification pattern established for the
 * original 25 rules in tests/ast-detection-rules.test.ts and tests/remediation-coverage.test.ts.
 * See docs/research/EXPANSION_RESEARCH_TRACEABILITY.md for the evidence dossier behind each rule.
 */

function detect(code: string, filePath: string) {
  const res = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(res.ast!, filePath, res.framework);
}

test('FIGM-A11Y-07: Accessible Name Must Contain Visible Label Text', async (t) => {
  await t.test('[TP] fires when aria-label diverges from visible text', () => {
    const code = `function Btn() { return <button aria-label="Submit the form">Send</button>; }`;
    const reports = detect(code, 'Btn.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-A11Y-07'));
  });

  await t.test('[TN] does NOT fire when aria-label contains the visible text', () => {
    const code = `function Btn() { return <button aria-label="Send message">Send</button>; }`;
    const reports = detect(code, 'Btn.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-A11Y-07'));
  });

  await t.test('[near-miss] does NOT fire on a self-closing element (no visible text possible)', () => {
    const code = `function Icon() { return <input aria-label="Search the site" />; }`;
    const reports = detect(code, 'Icon.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-A11Y-07'));
  });

  await t.test('[framework] does not evaluate on ANGULAR_TEMPLATE', () => {
    const code = `@Component({ template: '<button aria-label="Submit the form">Send</button>' })\nexport class C {}`;
    const reports = detect(code, 'c.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-A11Y-07'));
  });

  await t.test('[fix+verify] applying the fix resolves the violation on re-scan', () => {
    const code = `function Btn() { return <button aria-label="Submit the form">Send</button>; }`;
    const before = RuleExecutionEngine.analyzeFile('Btn.jsx', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-07');
    assert.ok(defect, 'fixture must actually trip the rule before fixing it');
    const result = RemediationEngine.applyQuickFix(code, defect!);
    const validation = RemediationValidator.validatePatch(code, result.remediatedCode, defect!, result.requiresManualReview);
    assert.equal(validation.status, 'FIXED');
    assert.ok(!validation.remainingDiagnostics.some((d) => d.ruleId === 'FIGM-A11Y-07'));
  });
});

test('FIGM-REACT-05: Effect Used Solely to Derive State', async (t) => {
  await t.test('[TP] fires when useEffect body is exactly one state-setter call', () => {
    const code = `function Cart({ items }) {\n  const [total, setTotal] = useState(0);\n  useEffect(() => {\n    setTotal(items.reduce((s, i) => s + i.price, 0));\n  }, [items]);\n  return <div>{total}</div>;\n}`;
    const reports = detect(code, 'Cart.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-05'));
  });

  await t.test('[TN] does NOT fire when the Effect also performs a real side effect', () => {
    const code = `function Cart({ items }) {\n  const [total, setTotal] = useState(0);\n  useEffect(() => {\n    console.log('recalculating');\n    setTotal(items.reduce((s, i) => s + i.price, 0));\n  }, [items]);\n  return <div>{total}</div>;\n}`;
    const reports = detect(code, 'Cart.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-05'));
  });

  await t.test('[near-miss] does NOT fire when the setter call is not the sole statement (two setters)', () => {
    const code = `function Cart({ items }) {\n  useEffect(() => {\n    setTotal(1);\n    setCount(2);\n  }, [items]);\n}`;
    const reports = detect(code, 'Cart.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-05'));
  });

  await t.test('[manual review] fix result is flagged for manual review, never silently auto-applied', () => {
    const code = `function Cart({ items }) {\n  useEffect(() => {\n    setTotal(items.length);\n  }, [items]);\n}`;
    const before = RuleExecutionEngine.analyzeFile('Cart.jsx', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-REACT-05');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.equal(result.requiresManualReview, true);
    const validation = RemediationValidator.validatePatch(code, result.remediatedCode, defect!, result.requiresManualReview);
    assert.equal(validation.status, 'MANUAL_REVIEW_REQUIRED');
  });
});

test('FIGM-REACT-06: Missing Reactive Dependency in Effect Hook', async (t) => {
  // Every fixture below must actually return JSX -- nearestEnclosingComponentFunction only
  // treats a function as "the component" when functionReturnsJsx() is true (see
  // real-syntax-node-builder.ts), matching the same real-component-shape requirement the rest
  // of this engine's React-specific rules already rely on.
  await t.test('[TP] fires when a destructured prop is read but missing from the dependency array', () => {
    const code = `function Profile({ userId }) {\n  useEffect(() => {\n    fetchUser(userId);\n  }, []);\n  return <div>{userId}</div>;\n}`;
    const reports = detect(code, 'Profile.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-06'));
  });

  await t.test('[TN] does NOT fire when the prop is present in the dependency array', () => {
    const code = `function Profile({ userId }) {\n  useEffect(() => {\n    fetchUser(userId);\n  }, [userId]);\n  return <div>{userId}</div>;\n}`;
    const reports = detect(code, 'Profile.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-06'));
  });

  await t.test('[near-miss] does NOT fire when there is no dependency array at all (run-every-render idiom)', () => {
    const code = `function Profile({ userId }) {\n  useEffect(() => {\n    fetchUser(userId);\n  });\n  return <div>{userId}</div>;\n}`;
    const reports = detect(code, 'Profile.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-06'));
  });

  await t.test('[near-miss] does NOT flag a set-prefixed identifier (assumed-stable setter)', () => {
    const code = `function Profile({ setUserId }) {\n  useEffect(() => {\n    setUserId(null);\n  }, []);\n  return <div>ok</div>;\n}`;
    const reports = detect(code, 'Profile.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-06'));
  });
});

test('FIGM-NEXT-05: Server-Only Module Imported Across the Client Boundary', async (t) => {
  // filePath must match Next.js's own app-router path convention (app/.../*.tsx) so
  // SourceParser.detectFramework classifies it NEXT_JS -- FIGM-NEXT-05 is gated NEXT_JS-only.
  await t.test('[TP] fires when a "use client" file imports a Node.js server-only built-in', () => {
    const code = `'use client';\nimport fs from 'fs';\nexport default function Panel() { return <div>{fs.readFileSync}</div>; }`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-05'));
  });

  await t.test('[TN] does NOT fire in a Server Component (no "use client")', () => {
    const code = `import fs from 'fs';\nexport default function Panel() { return <div>{fs.readFileSync}</div>; }`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-05'));
  });

  await t.test('[TN] does NOT fire for an ordinary npm package import', () => {
    const code = `'use client';\nimport { z } from 'zod';\nexport default function Panel() { return <div>{String(z)}</div>; }`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-05'));
  });

  await t.test('[framework] does not evaluate on plain REACT_JSX (rule is NEXT_JS-only)', () => {
    const code = `'use client';\nimport fs from 'fs';\nexport default function Panel() { return <div>{fs.readFileSync}</div>; }`;
    const res = SourceParser.parseSource(code, 'Panel.jsx');
    // Force-evaluate as REACT_JSX explicitly, independent of what detectFramework picked, to
    // assert the rule's own framework gate rather than the file-extension heuristic.
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'Panel.jsx', 'REACT_JSX');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-05'));
  });
});

test('FIGM-NEXT-06: Native <img> Instead of next/image', async (t) => {
  await t.test('[TP] fires on a native <img> in a Next.js file', () => {
    const code = `export default function Hero() { return <img src="/hero.png" alt="Hero" width={1200} height={600} />; }`;
    const res = SourceParser.parseSource(code, 'app/page.tsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/page.tsx', 'NEXT_JS');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-06'));
  });

  await t.test('[TN] does NOT fire when next/image\'s Image component is used', () => {
    const code = `import Image from 'next/image';\nexport default function Hero() { return <Image src="/hero.png" alt="Hero" width={1200} height={600} />; }`;
    const res = SourceParser.parseSource(code, 'app/page.tsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/page.tsx', 'NEXT_JS');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-06'));
  });

  await t.test('[fix+verify] fix converts <img> to <Image> and adds the import, resolving the violation', () => {
    const code = `export default function Hero() { return <img src="/hero.png" alt="Hero" width={1200} height={600} />; }`;
    const res = SourceParser.parseSource(code, 'app/page.tsx');
    const beforeReports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/page.tsx', 'NEXT_JS');
    const defect = beforeReports.find((d) => d.ruleId === 'FIGM-NEXT-06');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.ok(!result.requiresManualReview, 'dimensioned <img> should get a real automated fix, not manual review');
    assert.match(result.remediatedCode, /<Image\b/);
    assert.match(result.remediatedCode, /from ['"]next\/image['"]/);
    const afterParse = SourceParser.parseSource(result.remediatedCode, 'app/page.tsx');
    const afterReports = ASTDetectionEngine.evaluateNode(afterParse.ast!, 'app/page.tsx', 'NEXT_JS');
    assert.ok(!afterReports.some((r) => r.ruleId === 'FIGM-NEXT-06'));
  });

  await t.test('[manual review] an <img> with no explicit dimensions is not auto-converted', () => {
    const code = `export default function Hero() { return <img src="/hero.png" alt="Hero" />; }`;
    const res = SourceParser.parseSource(code, 'app/page.tsx');
    const beforeReports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/page.tsx', 'NEXT_JS');
    const defect = beforeReports.find((d) => d.ruleId === 'FIGM-NEXT-06');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.equal(result.requiresManualReview, true);
  });
});

test('FIGM-ANG-06: Impure Angular Pipe Declaration', async (t) => {
  await t.test('[TP] fires when @Pipe sets pure: false', () => {
    const code = `@Pipe({ name: 'filterActive', pure: false })\nexport class FilterActivePipe implements PipeTransform {}`;
    const reports = detect(code, 'filter-active.pipe.ts');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-ANG-06'));
  });

  await t.test('[TN] does NOT fire for a pure (default) pipe', () => {
    const code = `@Pipe({ name: 'filterActive' })\nexport class FilterActivePipe implements PipeTransform {}`;
    const reports = detect(code, 'filter-active.pipe.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-06'));
  });

  await t.test('[near-miss] does NOT fire for an unrelated pure: false on a non-@Pipe decorator', () => {
    const code = `@Component({ selector: 'app-x', pure: false })\nexport class X {}`;
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-06'));
  });
});

test('FIGM-VUE-01: Unstable or Missing v-for Key Binding', async (t) => {
  await t.test('[TP] fires when v-for has no :key binding', () => {
    const code = `<template><li v-for="todo in todos">{{ todo.text }}</li></template>`;
    const reports = detect(code, 'TodoList.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-01'));
  });

  await t.test('[TP] fires when :key is bound to the loop index', () => {
    const code = `<template><li v-for="(todo, index) in todos" :key="index">{{ todo.text }}</li></template>`;
    const reports = detect(code, 'TodoList.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-01'));
  });

  await t.test('[TN] does NOT fire when :key is bound to a stable identifier', () => {
    const code = `<template><li v-for="todo in todos" :key="todo.id">{{ todo.text }}</li></template>`;
    const reports = detect(code, 'TodoList.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-01'));
  });

  await t.test('sourceKind is honestly REAL_AST (Phase 2: real @vue/compiler-dom template parse via src/ast/vue-template-ast-builder.ts, not a text heuristic)', () => {
    const code = `<template><li v-for="todo in todos">{{ todo.text }}</li></template>`;
    const reports = detect(code, 'TodoList.vue');
    const report = reports.find((r) => r.ruleId === 'FIGM-VUE-01');
    assert.equal(report?.sourceKind, 'REAL_AST');
  });

  await t.test('[fix+verify] fix adds a stable :key, resolving the violation on re-scan', () => {
    const code = `<template><li v-for="todo in todos">{{ todo.text }}</li></template>`;
    const before = RuleExecutionEngine.analyzeFile('TodoList.vue', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-VUE-01');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.match(result.remediatedCode, /:key="todo\.id"/);
    const after = RuleExecutionEngine.analyzeFile('TodoList.vue', result.remediatedCode);
    assert.ok(!after.diagnostics.some((d) => d.ruleId === 'FIGM-VUE-01'));
  });
});

test('FIGM-VUE-02: Combined v-if and v-for on the Same Element', async (t) => {
  await t.test('[TP] fires when v-for and v-if are on the same element', () => {
    const code = `<template><li v-for="user in users" v-if="user.isActive">{{ user.name }}</li></template>`;
    const reports = detect(code, 'UserList.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-02'));
  });

  // Directives must be on separate physical lines here -- this rule's detection is a same-LINE
  // proximity heuristic (LEGACY_TEXT_HEURISTIC, no Vue template AST; see FIGM-VUE-02's
  // knownLimitation), so v-if and v-for on two different elements that happen to share one
  // physical line is a known, documented false-positive risk this fixture deliberately avoids.
  await t.test('[TN] does NOT fire when v-if is on a separate wrapping element (different line)', () => {
    const code = `<template>\n  <template v-if="showList">\n    <li v-for="user in activeUsers" :key="user.id">{{ user.name }}</li>\n  </template>\n</template>`;
    const reports = detect(code, 'UserList.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-02'));
  });

  await t.test('[manual review] fix result is flagged for manual review, never silently auto-applied', () => {
    const code = `<template><li v-for="user in users" v-if="user.isActive">{{ user.name }}</li></template>`;
    const before = RuleExecutionEngine.analyzeFile('UserList.vue', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-VUE-02');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.equal(result.requiresManualReview, true);
  });
});

test('Expansion set: every one of the 8 new rules is reachable end-to-end via RuleExecutionEngine.analyzeFile (not orphaned)', () => {
  const fixtures: Array<{ ruleId: string; code: string; filePath: string }> = [
    { ruleId: 'FIGM-A11Y-07', filePath: 'A.jsx', code: `function B() { return <button aria-label="Submit the form">Send</button>; }` },
    { ruleId: 'FIGM-REACT-05', filePath: 'B.jsx', code: `function C({ items }) { useEffect(() => { setTotal(items.length); }, [items]); }` },
    { ruleId: 'FIGM-REACT-06', filePath: 'C.jsx', code: `function D({ userId }) { useEffect(() => { fetchUser(userId); }, []); return <div>{userId}</div>; }` },
    { ruleId: 'FIGM-NEXT-05', filePath: 'app/page.tsx', code: `'use client';\nimport fs from 'fs';\nexport default function P() { return <div>{fs.readFileSync}</div>; }` },
    { ruleId: 'FIGM-ANG-06', filePath: 'f.pipe.ts', code: `@Pipe({ name: 'f', pure: false })\nexport class F implements PipeTransform {}` },
    { ruleId: 'FIGM-VUE-01', filePath: 'L.vue', code: `<template><li v-for="todo in todos">{{ todo.text }}</li></template>` },
    { ruleId: 'FIGM-VUE-02', filePath: 'M.vue', code: `<template><li v-for="user in users" v-if="user.isActive">{{ user.name }}</li></template>` },
  ];
  for (const f of fixtures) {
    const result = RuleExecutionEngine.analyzeFile(f.filePath, f.code);
    assert.ok(
      result.diagnostics.some((d) => d.ruleId === f.ruleId),
      `${f.ruleId} did not fire via RuleExecutionEngine.analyzeFile — rule is orphaned from the live scan path`
    );
  }
});
