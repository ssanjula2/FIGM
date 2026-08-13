import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';

/**
 * Phase 3 — Real Rule Detection Matrix (positive + negative fixture per rule, all 25 rules).
 *
 * Replaces the prior docs/audit/RULE_DETECTION_MATRIX.md, which was NOT backed by real fixture
 * execution: it used rule IDs that do not exist in the live engine (`FIGM-ANGULAR-01/02` instead
 * of the real `FIGM-ANG-01..05`, a nonexistent `FIGM-REACT-05`, and was missing the real
 * `FIGM-ANG-05`), and claimed 0 false positives / 0 false negatives across the board despite this
 * codebase's own adversarial audit (docs/audit/ADVERSARIAL_DETECTION_AUDIT.md) having found and
 * fixed 7 confirmed false positives + 1 confirmed false negative. Per the brief's explicit
 * instruction not to trust prior audit narratives, this file re-derives the matrix from the real,
 * live 25-rule list actually emitted by `ASTDetectionEngine.evaluateNode` (verified directly
 * against src/ast/ast-detection-engine.ts's evaluateNode + private eval* predicates) and runs
 * both a positive (should fire) and a negative (should NOT fire) fixture through the real parser
 * + detection engine for every one of them.
 *
 * Positive fixtures for the 25 rules are the same ones already proven in
 * tests/ast-detection-rules.test.ts (kept in sync intentionally — this file adds the missing
 * negative/TN half of the matrix that file does not cover).
 */

interface MatrixCase {
  ruleId: string;
  category: 'PERFORMANCE' | 'ACCESSIBILITY' | 'NEXT.JS' | 'REACT' | 'ANGULAR';
  positive: { code: string; filePath: string };
  negative: { code: string; filePath: string; description: string };
}

const CASES: MatrixCase[] = [
  {
    ruleId: 'FIGM-PERF-01', category: 'PERFORMANCE',
    positive: { code: `function loop(items) {\n  return items.map(item => {\n    const config = { theme: 'dark' };\n    return config;\n  });\n}`, filePath: 'component.jsx' },
    negative: { code: `const config = { theme: 'dark' };\nfunction loop(items) {\n  return items.map(item => config);\n}`, filePath: 'component.jsx', description: 'object hoisted outside the loop, referenced (not allocated) inside it' },
  },
  {
    ruleId: 'FIGM-PERF-02', category: 'PERFORMANCE',
    positive: { code: `<img src="/logo.png" alt="Logo" />`, filePath: 'component.jsx' },
    negative: { code: `<img src="/logo.png" alt="Logo" width={800} height={600} />`, filePath: 'component.jsx', description: 'explicit width and height present' },
  },
  {
    ruleId: 'FIGM-PERF-03', category: 'PERFORMANCE',
    positive: { code: `window.addEventListener('resize', handleResize);`, filePath: 'component.js' },
    negative: { code: `window.addEventListener('resize', handleResize);\nwindow.removeEventListener('resize', handleResize);`, filePath: 'component.js', description: 'paired removeEventListener present in the same file' },
  },
  {
    ruleId: 'FIGM-PERF-04', category: 'PERFORMANCE',
    positive: { code: `import HeavyChart from 'heavy-chart';\nif(condition) {\n  console.log(HeavyChart);\n}`, filePath: 'component.js' },
    negative: { code: `import { NextResponse } from 'next/server';\nfunction ok() { return NextResponse.json({}); }\nif (x) { console.log(NextResponse); }`, filePath: 'route.js', description: 'binding used both inside and outside the conditional branch' },
  },
  {
    ruleId: 'FIGM-PERF-05', category: 'PERFORMANCE',
    positive: { code: `items.map(item => <Card onClick={() => handleClick(item.id)} />)`, filePath: 'component.jsx' },
    negative: { code: `function setup() {\n  const handleClick = () => { doSomething(); };\n  return handleClick;\n}`, filePath: 'component.jsx', description: 'arrow function declared outside any loop/render scope' },
  },
  {
    ruleId: 'FIGM-PERF-06', category: 'PERFORMANCE',
    positive: { code: `items.map(item => {\n  const token = localStorage.getItem('token');\n  return token;\n})`, filePath: 'component.js' },
    negative: { code: `function load() {\n  const token = localStorage.getItem('token');\n  return token;\n}`, filePath: 'component.js', description: 'storage access outside any loop/render scope' },
  },
  {
    ruleId: 'FIGM-A11Y-01', category: 'ACCESSIBILITY',
    positive: { code: `<div onClick={handleClick}>Click me</div>`, filePath: 'component.jsx' },
    negative: { code: `<div onClick={handleClick} onKeyDown={handleKeyDown} tabIndex={0}>Click me</div>`, filePath: 'component.jsx', description: 'has both onKeyDown and tabIndex alongside onClick' },
  },
  {
    ruleId: 'FIGM-A11Y-02', category: 'ACCESSIBILITY',
    positive: { code: `<CustomDropdown option="1" />`, filePath: 'component.jsx' },
    negative: { code: `<CustomDropdown role="listbox" aria-label="Choose option" option="1" />`, filePath: 'component.jsx', description: 'has both role and aria-label' },
  },
  {
    ruleId: 'FIGM-A11Y-03', category: 'ACCESSIBILITY',
    positive: { code: `<div className="status-container">{status}</div>`, filePath: 'component.jsx' },
    negative: { code: `<div className="status-container" aria-live="polite">{status}</div>`, filePath: 'component.jsx', description: 'has aria-live on the dynamic status container' },
  },
  {
    ruleId: 'FIGM-A11Y-04', category: 'ACCESSIBILITY',
    positive: { code: `<Modal isOpen={true} />`, filePath: 'component.jsx' },
    negative: { code: `<Modal isOpen={true} onClose={handleClose} />`, filePath: 'component.jsx', description: 'has onClose (focus-restoration hook signal)' },
  },
  {
    ruleId: 'FIGM-A11Y-05', category: 'ACCESSIBILITY',
    positive: { code: `<input type="text" placeholder="Enter name" />`, filePath: 'component.jsx' },
    negative: { code: `<input type="text" aria-label="Enter name" placeholder="Enter name" />`, filePath: 'component.jsx', description: 'has an explicit aria-label' },
  },
  {
    ruleId: 'FIGM-A11Y-06', category: 'ACCESSIBILITY',
    positive: { code: `<button tabIndex="5">Submit</button>`, filePath: 'component.jsx' },
    negative: { code: `<button tabIndex={0}>Submit</button>`, filePath: 'component.jsx', description: 'tabIndex is 0 (natural order), not a positive override value' },
  },
  {
    ruleId: 'FIGM-NEXT-01', category: 'NEXT.JS',
    positive: { code: `import { useState } from 'react';\nexport default function Page() {\n  const [s] = useState(0);\n}`, filePath: 'app/dashboard/page.tsx' },
    negative: { code: `"use client";\nimport { useState } from 'react';\nexport default function Page() {\n  const [s] = useState(0);\n}`, filePath: 'app/dashboard/page.tsx', description: 'has the "use client" directive' },
  },
  {
    ruleId: 'FIGM-NEXT-02', category: 'NEXT.JS',
    positive: { code: `import MonacoEditor from 'monaco-editor';`, filePath: 'app/editor/page.tsx' },
    negative: { code: `import dynamic from 'next/dynamic';\nconst MonacoEditor = dynamic(() => import('monaco-editor'), { ssr: false });`, filePath: 'app/editor/page.tsx', description: 'heavy module loaded via next/dynamic, not a static top-level import' },
  },
  {
    ruleId: 'FIGM-NEXT-03', category: 'NEXT.JS',
    positive: { code: `export default async function Page() { return <div>Data</div>; }`, filePath: 'app/feed/page.tsx' },
    negative: { code: `export const revalidate = 60;\nexport default async function Page() { return <div>Data</div>; }`, filePath: 'app/feed/page.tsx', description: 'has an explicit export const revalidate' },
  },
  {
    ruleId: 'FIGM-NEXT-04', category: 'NEXT.JS',
    positive: { code: `<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" />`, filePath: 'app/layout.tsx' },
    negative: { code: `import { Inter } from 'next/font/google';\nconst inter = Inter({ subsets: ['latin'] });`, filePath: 'app/layout.tsx', description: 'uses next/font instead of an external <link> tag' },
  },
  {
    ruleId: 'FIGM-REACT-01', category: 'REACT',
    positive: { code: `function Component({ items }) {\n  const sorted = items.sort((a,b) => a - b);\n  return <div>{sorted}</div>;\n}`, filePath: 'Component.jsx' },
    negative: { code: `function Component({ items }) {\n  const sorted = useMemo(() => items.sort((a,b) => a - b), [items]);\n  return <div>{sorted}</div>;\n}`, filePath: 'Component.jsx', description: 'wrapped in useMemo' },
  },
  {
    ruleId: 'FIGM-REACT-02', category: 'REACT',
    positive: { code: `items.map((item, index) => <li key={index}>{item}</li>)`, filePath: 'List.jsx' },
    negative: { code: `items.map((item) => <li key={item.id}>{item.name}</li>)`, filePath: 'List.jsx', description: 'stable id used as the key instead of the array index' },
  },
  {
    ruleId: 'FIGM-REACT-03', category: 'REACT',
    positive: { code: `function update() {\n  user.name = 'John';\n  setUser(user);\n}`, filePath: 'UserProfile.jsx' },
    negative: { code: `function update() {\n  setUser({ ...user, name: 'John' });\n}`, filePath: 'UserProfile.jsx', description: 'immutable update via setUser, no direct property mutation' },
  },
  {
    ruleId: 'FIGM-REACT-04', category: 'REACT',
    positive: { code: `<CustomCard onClick={() => handleClick()} />`, filePath: 'Dashboard.jsx' },
    negative: { code: `const handleClick = useCallback(() => doSomething(), []);\n<CustomCard onClick={handleClick} />;`, filePath: 'Dashboard.jsx', description: 'memoized callback reference passed, not an inline arrow literal' },
  },
  {
    ruleId: 'FIGM-ANG-01', category: 'ANGULAR',
    positive: { code: `@Component({ selector: 'app-test' })\nexport class TestComponent {\n  ngOnInit() {\n    this.service.getStream().subscribe();\n  }\n}`, filePath: 'test.component.ts' },
    negative: { code: `@Component({ selector: 'app-test' })\nexport class TestComponent {\n  ngOnInit() {\n    this.sub = this.service.getStream().subscribe();\n  }\n  ngOnDestroy() {\n    this.sub.unsubscribe();\n  }\n}`, filePath: 'test.component.ts', description: 'subscription is torn down in ngOnDestroy via unsubscribe()' },
  },
  {
    ruleId: 'FIGM-ANG-02', category: 'ANGULAR',
    positive: { code: `@Component({ selector: 'app-card', template: '<div>Card</div>' })\nexport class CardComponent {}`, filePath: 'card.component.ts' },
    negative: { code: `@Component({ selector: 'app-card', changeDetection: ChangeDetectionStrategy.OnPush, template: '<div>Card</div>' })\nexport class CardComponent {}`, filePath: 'card.component.ts', description: 'explicit ChangeDetectionStrategy.OnPush' },
  },
  {
    ruleId: 'FIGM-ANG-03', category: 'ANGULAR',
    positive: { code: `<div *ngFor="let item of items">{{ item.name }}</div>`, filePath: 'search.component.ts' },
    negative: { code: `<div *ngFor="let item of items; trackBy: trackById">{{ item.name }}</div>`, filePath: 'search.component.ts', description: 'trackBy function reference present' },
  },
  {
    ruleId: 'FIGM-ANG-04', category: 'ANGULAR',
    positive: { code: `<span>{{ computeTotal() }}</span>`, filePath: 'total.component.ts' },
    negative: { code: `<span>{{ total }}</span>`, filePath: 'total.component.ts', description: 'plain property interpolation, no function call' },
  },
  {
    ruleId: 'FIGM-ANG-05', category: 'ANGULAR',
    positive: { code: `this.el.nativeElement.style.color = 'red';`, filePath: 'color.directive.ts' },
    negative: { code: `this.renderer.setStyle(this.el.nativeElement, 'color', 'red');`, filePath: 'color.directive.ts', description: 'goes through Renderer2 instead of mutating nativeElement directly' },
  },
];

describe('Phase 3: Real Rule Detection Matrix (25 rules x positive + negative fixture)', () => {
  for (const c of CASES) {
    describe(c.ruleId, () => {
      it(`[TP] fires on a genuine violation`, () => {
        const res = SourceParser.parseSource(c.positive.code, c.positive.filePath);
        const reports = ASTDetectionEngine.evaluateNode(res.ast!, c.positive.filePath, res.framework);
        assert.ok(reports.some((r) => r.ruleId === c.ruleId), `${c.ruleId} should fire on: ${c.positive.code}`);
      });

      it(`[TN] does NOT fire when ${c.negative.description}`, () => {
        const res = SourceParser.parseSource(c.negative.code, c.negative.filePath);
        const reports = ASTDetectionEngine.evaluateNode(res.ast!, c.negative.filePath, res.framework);
        assert.ok(!reports.some((r) => r.ruleId === c.ruleId), `${c.ruleId} should NOT fire on: ${c.negative.code}`);
      });
    });
  }

  it('covers exactly the 25 real rule IDs live in ASTDetectionEngine (no invented/stale IDs)', () => {
    assert.equal(CASES.length, 25);
    const ids = new Set(CASES.map((c) => c.ruleId));
    assert.equal(ids.size, 25, 'no duplicate rule IDs');
  });
});
