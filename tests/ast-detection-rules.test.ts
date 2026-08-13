import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';

test('FIGM Complete 25-Rule AST Detection Suite', async (t) => {
  // 1. Universal Common Rules
  await t.test('FIGM-PERF-01: Detects object allocation inside loops', () => {
    const code = `function loop(items) {\n  return items.map(item => {\n    const config = { theme: 'dark' };\n    return config;\n  });\n}`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-PERF-01'));
  });

  await t.test('FIGM-PERF-02: Detects un-dimensioned visual image elements', () => {
    const code = `<img src="/logo.png" alt="Logo" />`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-PERF-02'));
  });

  await t.test('FIGM-PERF-03: Detects addEventListener without teardown', () => {
    const code = `window.addEventListener('resize', handleResize);`;
    const res = SourceParser.parseSource(code, 'component.js');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.js', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-PERF-03'));
  });

  await t.test('FIGM-PERF-04: Detects static imports in conditional paths', () => {
    const code = `import HeavyChart from 'heavy-chart';\nif(condition) {\n  console.log(HeavyChart);\n}`;
    const res = SourceParser.parseSource(code, 'component.js');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.js', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-PERF-04'));
  });

  await t.test('FIGM-PERF-05: Detects inline arrow function inside map loop', () => {
    const code = `items.map(item => <Card onClick={() => handleClick(item.id)} />)`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-PERF-05'));
  });

  await t.test('FIGM-PERF-06: Detects localStorage access inside loop', () => {
    const code = `items.map(item => {\n  const token = localStorage.getItem('token');\n  return token;\n})`;
    const res = SourceParser.parseSource(code, 'component.js');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.js', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-PERF-06'));
  });

  await t.test('FIGM-A11Y-01: Detects non-interactive element with onClick lacking keyboard listener', () => {
    const code = `<div onClick={handleClick}>Click me</div>`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-A11Y-01'));
  });

  await t.test('FIGM-A11Y-02: Detects custom control missing role/aria-label', () => {
    const code = `<CustomDropdown option="1" />`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-A11Y-02'));
  });

  await t.test('FIGM-A11Y-03: Detects dynamic status container missing aria-live', () => {
    const code = `<div className="status-container">{status}</div>`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-A11Y-03'));
  });

  await t.test('FIGM-A11Y-04: Detects Modal missing focus restoration', () => {
    const code = `<Modal isOpen={true} />`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-A11Y-04'));
  });

  await t.test('FIGM-A11Y-05: Detects unlabeled form input field', () => {
    const code = `<input type="text" placeholder="Enter name" />`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-A11Y-05'));
  });

  await t.test('FIGM-A11Y-06: Detects positive tabindex > 0', () => {
    const code = `<button tabIndex="5">Submit</button>`;
    const res = SourceParser.parseSource(code, 'component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-A11Y-06'));
  });

  // 2. Next.js Rules
  await t.test('FIGM-NEXT-01: Detects client hooks in Next.js without "use client"', () => {
    const code = `import { useState } from 'react';\nexport default function Page() {\n  const [s] = useState(0);\n}`;
    const res = SourceParser.parseSource(code, 'app/dashboard/page.tsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/dashboard/page.tsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-NEXT-01'));
  });

  await t.test('FIGM-NEXT-02: Detects heavy static import in Next.js', () => {
    const code = `import MonacoEditor from 'monaco-editor';`;
    const res = SourceParser.parseSource(code, 'app/editor/page.tsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/editor/page.tsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-NEXT-02'));
  });

  await t.test('FIGM-NEXT-03: Detects missing export const revalidate in App Router page', () => {
    const code = `export default async function Page() { return <div>Data</div>; }`;
    const res = SourceParser.parseSource(code, 'app/feed/page.tsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/feed/page.tsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-NEXT-03'));
  });

  await t.test('FIGM-NEXT-04: Detects external Google Fonts CSS link tag', () => {
    const code = `<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" />`;
    const res = SourceParser.parseSource(code, 'app/layout.tsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'app/layout.tsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-NEXT-04'));
  });

  // 3. React Rules
  await t.test('FIGM-REACT-01: Detects expensive array sort without useMemo', () => {
    const code = `function Component({ items }) {\n  const sorted = items.sort((a,b) => a - b);\n  return <div>{sorted}</div>;\n}`;
    const res = SourceParser.parseSource(code, 'Component.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'Component.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-REACT-01'));
  });

  await t.test('FIGM-REACT-02: Detects key={index} array index keys', () => {
    const code = `items.map((item, index) => <li key={index}>{item}</li>)`;
    const res = SourceParser.parseSource(code, 'List.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'List.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-REACT-02'));
  });

  await t.test('FIGM-REACT-03: Detects direct state mutation', () => {
    const code = `function update() {\n  user.name = 'John';\n  setUser(user);\n}`;
    const res = SourceParser.parseSource(code, 'UserProfile.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'UserProfile.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-REACT-03'));
  });

  await t.test('FIGM-REACT-04: Detects inline callback prop passed to child component', () => {
    const code = `<CustomCard onClick={() => handleClick()} />`;
    const res = SourceParser.parseSource(code, 'Dashboard.jsx');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'Dashboard.jsx', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-REACT-04'));
  });

  // 4. Angular Rules
  await t.test('FIGM-ANG-01: Detects unsubscribed RxJS observable in Angular', () => {
    const code = `@Component({ selector: 'app-test' })\nexport class TestComponent {\n  ngOnInit() {\n    this.service.getStream().subscribe();\n  }\n}`;
    const res = SourceParser.parseSource(code, 'test.component.ts');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'test.component.ts', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-ANG-01'));
  });

  await t.test('FIGM-ANG-02: Detects Angular component missing ChangeDetectionStrategy.OnPush', () => {
    const code = `@Component({ selector: 'app-card', template: '<div>Card</div>' })\nexport class CardComponent {}`;
    const res = SourceParser.parseSource(code, 'card.component.ts');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'card.component.ts', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-ANG-02'));
  });

  await t.test('FIGM-ANG-03: Detects *ngFor directive without trackBy', () => {
    const code = `<div *ngFor="let item of items">{{ item.name }}</div>`;
    const res = SourceParser.parseSource(code, 'search.component.ts');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'search.component.ts', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-ANG-03'));
  });

  await t.test('FIGM-ANG-04: Detects function call in Angular template', () => {
    const code = `<span>{{ computeTotal() }}</span>`;
    const res = SourceParser.parseSource(code, 'total.component.ts');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'total.component.ts', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-ANG-04'));
  });

  await t.test('FIGM-ANG-05: Detects direct nativeElement mutation in Angular', () => {
    const code = `this.el.nativeElement.style.color = 'red';`;
    const res = SourceParser.parseSource(code, 'color.directive.ts');
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, 'color.directive.ts', res.framework);
    assert.ok(reports.some(r => r.ruleId === 'FIGM-ANG-05'));
  });
});
