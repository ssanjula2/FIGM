/**
 * Framework-Independent Guideline Model (FIGM)
 * Complete 50-Rule Structural Evaluation -- Ground-Truth Case Dataset
 *
 * DISTINCT from, and does not modify or replace, the existing empirical benchmark
 * (benchmarks/ground-truth.json + src/eval/evaluation-runner.ts). This dataset exists to close a
 * different, complementary gap: EVERY one of the 50 canonical FIGM rules (the original 25, plus 8
 * in a first research-backed expansion pass -- see docs/research/EXPANSION_RESEARCH_TRACEABILITY.md
 * -- plus 17 more in a second pass -- see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md)
 * gets at least one genuine positive (EXPECTED_VIOLATION) and negative (EXPECTED_NO_VIOLATION) case,
 * each a minimal-but-realistic source snippet run through the real RuleExecutionEngine -- not a
 * synthetic promise, an empirically-verified one (see src/eval/complete-rule-evaluation-runner.ts,
 * which asserts every case here still classifies correctly every time it runs).
 *
 * Positive/negative code for each rule is derived directly from that rule's own
 * nonCompliantExample/compliantExample in src/matrix/four-layer-meta-model.ts (the project's own
 * authoritative illustration of what the rule targets), wrapped in the minimal surrounding
 * structure (component function, file path/extension, Angular @Component decorator, etc.) the
 * real parser's framework/attribute detection actually requires -- never invented independently of
 * that source of truth. Edge cases go further: each one specifically exercises a documented
 * `knownLimitation`/exclusion boundary from that same rule definition, not an arbitrary variation.
 *
 * "Do not modify the rules to fit the dataset" -- every case here was validated by running it
 * against the CURRENT, UNMODIFIED detection engine and recording the real result; nothing in
 * src/ast, src/parser, or src/matrix was changed to make a case pass.
 */

export type CaseLabel = 'EXPECTED_VIOLATION' | 'EXPECTED_NO_VIOLATION';

export interface RuleEvalCase {
  id: string;
  ruleId: string;
  label: CaseLabel;
  fileName: string;
  code: string;
  description: string;
}

export const RULE_EVAL_CASES: RuleEvalCase[] = [];

function add(ruleId: string, kind: string, fileName: string, code: string, description: string) {
  RULE_EVAL_CASES.push({
    id: `${ruleId}-${kind}`,
    ruleId,
    label: kind.startsWith('pos') ? 'EXPECTED_VIOLATION' : 'EXPECTED_NO_VIOLATION',
    fileName,
    code,
    description,
  });
}

// ---- PERF-01: Invariant object allocation in loop ----
add('FIGM-PERF-01', 'pos', 'Perf01Pos.jsx', `function renderList(items) {
  return items.map(item => {
    const config = { theme: 'dark', padding: 10 };
    return transform(item, config);
  });
}`, 'Object literal instantiated inside .map() iteration scope');
add('FIGM-PERF-01', 'neg', 'Perf01Neg.jsx', `const DEFAULT_CONFIG = Object.freeze({ theme: 'dark', padding: 10 });
function renderList(items) {
  return items.map(item => transform(item, DEFAULT_CONFIG));
}`, 'Object literal hoisted outside the loop');

// ---- PERF-02: Un-dimensioned media element ----
add('FIGM-PERF-02', 'pos', 'Perf02Pos.jsx', `function Avatar({ userAvatarUrl }) {
  return <img src={userAvatarUrl} alt="User Avatar" className="avatar" />;
}`, 'img element missing width/height/aspect-ratio');
add('FIGM-PERF-02', 'neg', 'Perf02Neg.jsx', `function Avatar({ userAvatarUrl }) {
  return <img src={userAvatarUrl} alt="User Avatar" width={48} height={48} style={{ aspectRatio: '1/1' }} className="avatar" />;
}`, 'img element has explicit width/height/aspect-ratio');

// ---- PERF-03: Event listener without disposal ----
add('FIGM-PERF-03', 'pos', 'Perf03Pos.js', `function setupResize() {
  window.addEventListener('resize', handleResize);
}`, 'addEventListener with no matching removeEventListener anywhere in file');
add('FIGM-PERF-03', 'neg', 'Perf03Neg.js', `function setupResize() {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}`, 'addEventListener paired with removeEventListener in the same file');

// ---- PERF-04: Static import in deferred execution path ----
add('FIGM-PERF-04', 'pos', 'Perf04Pos.js', `import HeavyChart from 'heavy-chart-library';

function showReport(shouldDisplay) {
  if (shouldDisplay) {
    HeavyChart.render();
  }
}`, 'Statically imported module referenced only inside a conditional branch');
add('FIGM-PERF-04', 'neg', 'Perf04Neg.js', `async function showReport(shouldDisplay) {
  if (shouldDisplay) {
    const { default: HeavyChart } = await import('heavy-chart-library');
    HeavyChart.render();
  }
}`, 'Module loaded via dynamic import() instead of a static top-level import');

// ---- PERF-05: Inline anonymous callback in render loop ----
add('FIGM-PERF-05', 'pos', 'Perf05Pos.jsx', `function List({ items }) {
  return items.map(item => <Card onClick={() => handleClick(item.id)} />);
}`, 'Inline arrow function created inside .map() render loop');
add('FIGM-PERF-05', 'neg', 'Perf05Neg.jsx', `function List({ items }) {
  return items.map(item => <Card onClick={handleCardClick} id={item.id} />);
}`, 'Stable handler reference passed instead of an inline arrow function');

// ---- PERF-06: Synchronous storage access in loop ----
add('FIGM-PERF-06', 'pos', 'Perf06Pos.js', `function processAll(items) {
  for (let i = 0; i < items.length; i++) {
    localStorage.getItem('token');
  }
}`, 'localStorage accessed inside a for-loop body');
add('FIGM-PERF-06', 'neg', 'Perf06Neg.js', `function processAll(items) {
  const token = localStorage.getItem('token');
  for (let i = 0; i < items.length; i++) {
    process(token);
  }
}`, 'localStorage read once, outside the loop');

// ---- A11Y-01: Keyboard parity on pointer handlers ----
add('FIGM-A11Y-01', 'pos', 'A11y01Pos.jsx', `function Panel({ togglePanel }) {
  return <div onClick={togglePanel}>Toggle Panel</div>;
}`, 'Non-interactive div with onClick but no onKeyDown/tabIndex');
add('FIGM-A11Y-01', 'neg', 'A11y01Neg.jsx', `function Panel({ togglePanel }) {
  return <button type="button" onClick={togglePanel}>Toggle Panel</button>;
}`, 'Native <button> element used instead of a clickable div');

// ---- A11Y-02: Accessible name/role for custom controls ----
add('FIGM-A11Y-02', 'pos', 'A11y02Pos.jsx', `function Picker({ handleSelect }) {
  return <CustomDropdown tabIndex={0} onClick={handleSelect}>Custom Select</CustomDropdown>;
}`, 'Custom-control-named element missing role and aria-label');
add('FIGM-A11Y-02', 'neg', 'A11y02Neg.jsx', `function Picker({ handleSelect }) {
  return <CustomDropdown role="combobox" aria-label="Choose Option" tabIndex={0} onClick={handleSelect}>Custom Select</CustomDropdown>;
}`, 'Custom control has explicit role and aria-label');

// ---- A11Y-03: ARIA live announcer for dynamic mutations ----
add('FIGM-A11Y-03', 'pos', 'A11y03Pos.jsx', `function StatusBanner({ statusText }) {
  return <div className="status-banner">{statusText}</div>;
}`, 'Dynamic status container missing aria-live/role=status');
add('FIGM-A11Y-03', 'neg', 'A11y03Neg.jsx', `function StatusBanner({ statusText }) {
  return <div className="status-banner" role="status" aria-live="polite">{statusText}</div>;
}`, 'Dynamic status container has role=status and aria-live');

// ---- A11Y-04: Focus containment for modals ----
add('FIGM-A11Y-04', 'pos', 'A11y04Pos.jsx', `function Overlay({ isOpen }) {
  return isOpen ? <Modal>Content</Modal> : null;
}`, 'A <Modal> overlay element with no onClose/focus-restoration prop');
add('FIGM-A11Y-04', 'neg', 'A11y04Neg.jsx', `function Overlay({ isOpen, onClose }) {
  return isOpen ? <Modal onClose={onClose}>Content</Modal> : null;
}`, 'A <Modal> overlay element carries an onClose prop (focus-restoration proxy signal)');

// ---- A11Y-05: Form input label association ----
add('FIGM-A11Y-05', 'pos', 'A11y05Pos.jsx', `function NameField() {
  return <input type="text" placeholder="Enter name" />;
}`, 'Text input with no associated label or aria-label');
add('FIGM-A11Y-05', 'neg', 'A11y05Neg.jsx', `function NameField() {
  return <label htmlFor="name">Name</label>;
  return <input id="name" type="text" />;
}`, 'A label element with htmlFor is present in the same file');

// ---- A11Y-06: Avoid positive tabindex ----
add('FIGM-A11Y-06', 'pos', 'A11y06Pos.jsx', `function SubmitButton() {
  return <button tabIndex={5}>Submit</button>;
}`, 'Positive literal tabIndex value (>0)');
add('FIGM-A11Y-06', 'neg', 'A11y06Neg.jsx', `function SubmitButton() {
  return <button tabIndex={0}>Submit</button>;
}`, 'tabIndex is 0, not positive');

// ---- NEXT-01: React hooks require use client ----
// Framework detection requires a literal app-router `page.<ext>` path segment (or a next/*
// content hint) -- see source-parser.ts's detectFramework -- so each NEXT-* fixture lives at its
// own app/<case>/page.tsx path rather than a same-named file that would collide across cases.
add('FIGM-NEXT-01', 'pos', 'app/next01pos/page.tsx', `import { useState } from 'react';
export default function Page() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`, 'useState called in a Next.js App Router page with no "use client" directive');
add('FIGM-NEXT-01', 'neg', 'app/next01neg/page.tsx', `'use client';
import { useState } from 'react';
export default function Page() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`, '"use client" directive present at the top of the file');

// ---- NEXT-02: Dynamic import for heavy browser modules ----
add('FIGM-NEXT-02', 'pos', 'app/next02pos/page.tsx', `import MonacoEditor from 'monaco-editor';
export default function Page() {
  return <MonacoEditor />;
}`, 'Known heavy package statically imported in a Next.js App Router page');
add('FIGM-NEXT-02', 'neg', 'app/next02neg/page.tsx', `import dynamic from 'next/dynamic';
const MonacoEditor = dynamic(() => import('monaco-editor'), { ssr: false });
export default function Page() {
  return <MonacoEditor />;
}`, 'Heavy package loaded via next/dynamic with ssr:false');

// ---- NEXT-03: Route segment revalidation ----
add('FIGM-NEXT-03', 'pos', 'app/next03pos/page.tsx', `export default async function Page() {
  return <div>Data</div>;
}`, 'App Router page with no export const revalidate');
add('FIGM-NEXT-03', 'neg', 'app/next03neg/page.tsx', `export const revalidate = 3600;
export default async function Page() {
  return <div>Data</div>;
}`, 'export const revalidate is present');

// ---- NEXT-04: next/font instead of external font link ----
add('FIGM-NEXT-04', 'pos', 'app/Next04Pos.tsx', `export default function Layout() {
  return (
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css?family=Inter" rel="stylesheet" />
      </head>
    </html>
  );
}`, 'External Google Fonts CSS link tag');
add('FIGM-NEXT-04', 'neg', 'app/Next04Neg.tsx', `import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
export default function Layout() {
  return <html className={inter.className}><body /></html>;
}`, 'Font loaded via next/font/google');

// ---- REACT-01: Memoize expensive derived computations ----
add('FIGM-REACT-01', 'pos', 'React01Pos.jsx', `function List({ items }) {
  const sortedData = items.sort((a, b) => a.val - b.val);
  return <ul>{sortedData.map(i => <li key={i.id}>{i.val}</li>)}</ul>;
}`, '.sort() call on render path with no useMemo wrapper');
add('FIGM-REACT-01', 'neg', 'React01Neg.jsx', `function List({ items }) {
  const sortedData = useMemo(() => items.sort((a, b) => a.val - b.val), [items]);
  return <ul>{sortedData.map(i => <li key={i.id}>{i.val}</li>)}</ul>;
}`, '.sort() call wrapped in useMemo');

// ---- REACT-02: Stable list key prop ----
add('FIGM-REACT-02', 'pos', 'React02Pos.jsx', `function List({ items }) {
  return <ul>{items.map((item, index) => <li key={index}>{item.name}</li>)}</ul>;
}`, 'Array index used directly as the key prop');
add('FIGM-REACT-02', 'neg', 'React02Neg.jsx', `function List({ items }) {
  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}`, 'Stable item.id used as the key prop');

// ---- REACT-03: Avoid direct state mutation ----
add('FIGM-REACT-03', 'pos', 'React03Pos.jsx', `function Profile() {
  const [user, setUser] = useState({ name: 'Old Name' });
  function rename() {
    user.name = 'New Name';
    setUser(user);
  }
  return <button onClick={rename}>{user.name}</button>;
}`, 'Direct property mutation of a useState-bound variable');
add('FIGM-REACT-03', 'neg', 'React03Neg.jsx', `function Profile() {
  const [user, setUser] = useState({ name: 'Old Name' });
  function rename() {
    setUser(prev => ({ ...prev, name: 'New Name' }));
  }
  return <button onClick={rename}>{user.name}</button>;
}`, 'Immutable state update via spread inside the setter');

// ---- REACT-04: Wrap child callback props in useCallback ----
add('FIGM-REACT-04', 'pos', 'React04Pos.jsx', `function Parent({ handleAction }) {
  return <ButtonCard onClick={() => handleAction()} />;
}`, 'Inline arrow function passed as onClick to a memo-named child component');
add('FIGM-REACT-04', 'neg', 'React04Neg.jsx', `function Parent({ handleAction }) {
  const handleClick = useCallback(() => handleAction(), [handleAction]);
  return <ButtonCard onClick={handleClick} />;
}`, 'Stable useCallback-wrapped handler passed instead of an inline arrow function');

// ---- ANG-01: Unsubscribe RxJS subscriptions ----
add('FIGM-ANG-01', 'pos', 'Ang01Pos.component.ts', `@Component({ selector: 'app-data' })
export class DataComponent {
  ngOnInit() {
    this.dataService.getStream().subscribe();
  }
}`, 'RxJS subscribe() with no unsubscribe/takeUntilDestroyed anywhere in file');
add('FIGM-ANG-01', 'neg', 'Ang01Neg.component.ts', `@Component({ selector: 'app-data' })
export class DataComponent {
  ngOnInit() {
    this.dataService.getStream().pipe(takeUntilDestroyed()).subscribe();
  }
}`, 'Subscription piped through takeUntilDestroyed()');

// ---- ANG-02: OnPush change detection ----
add('FIGM-ANG-02', 'pos', 'Ang02Pos.component.ts', `@Component({ selector: 'app-card', template: '<div>Card</div>' })
export class CardComponent {}`, 'Component decorator with no ChangeDetectionStrategy.OnPush');
add('FIGM-ANG-02', 'neg', 'Ang02Neg.component.ts', `@Component({ selector: 'app-card', changeDetection: ChangeDetectionStrategy.OnPush, template: '<div>Card</div>' })
export class CardComponent {}`, 'ChangeDetectionStrategy.OnPush present');

// ---- ANG-03: *ngFor trackBy ----
add('FIGM-ANG-03', 'pos', 'Ang03Pos.component.ts', `@Component({
  selector: 'app-list',
  template: \`<div *ngFor="let item of items">{{ item.name }}</div>\`
})
export class ListComponent {}`, '*ngFor with no trackBy');
add('FIGM-ANG-03', 'neg', 'Ang03Neg.component.ts', `@Component({
  selector: 'app-list',
  template: \`<div *ngFor="let item of items; trackBy: trackById">{{ item.name }}</div>\`
})
export class ListComponent {
  trackById(index: number, item: any) { return item.id; }
}`, '*ngFor has trackBy reference');

// ---- ANG-04: Minimize method calls in templates ----
add('FIGM-ANG-04', 'pos', 'Ang04Pos.component.ts', `@Component({
  selector: 'app-total',
  template: \`<span>{{ calculateTotal() }}</span>\`
})
export class TotalComponent {
  calculateTotal() { return 42; }
}`, 'Method call inside template interpolation');
add('FIGM-ANG-04', 'neg', 'Ang04Neg.component.ts', `@Component({
  selector: 'app-total',
  template: \`<span>{{ total }}</span>\`
})
export class TotalComponent {
  total = 42;
}`, 'Plain property interpolation, no method call');

// ---- ANG-05: Renderer2 DOM manipulation safety ----
add('FIGM-ANG-05', 'pos', 'Ang05Pos.component.ts', `@Component({ selector: 'app-box' })
export class BoxComponent {
  constructor(private el: ElementRef) {}
  paint() {
    this.el.nativeElement.style.color = 'red';
  }
}`, 'Direct nativeElement.style mutation, no Renderer2');
add('FIGM-ANG-05', 'neg', 'Ang05Neg.component.ts', `@Component({ selector: 'app-box' })
export class BoxComponent {
  constructor(private el: ElementRef, private renderer: Renderer2) {}
  paint() {
    this.renderer.setStyle(this.el.nativeElement, 'color', 'red');
  }
}`, 'DOM mutation goes through Renderer2.setStyle');

// ==== Edge cases -- each validates a documented knownLimitation/exclusion boundary rather than
// mechanically repeating the positive/negative shape. Not every rule gets one; only where the
// edge is genuinely illustrative of how the detector actually draws its line. ====

add('FIGM-REACT-01', 'neg-edge', 'React01Edge.jsx', `function FilterRegistration() {
  Vue.filter('currency', (value) => \`$\${value}\`);
}`, "Edge case: bare capitalized receiver (Vue.filter) is excluded from the .filter() heuristic per the rule's documented exclusion, even outside a render path");

add('FIGM-REACT-03', 'neg-edge', 'React03Edge.jsx', `function TextInput() {
  const ref = useRef(null);
  function focus() {
    ref.current.value = 'programmatically set';
  }
  return <input ref={ref} />;
}`, 'Edge case: mutation through a *.current ref-access chain is categorically excluded from the state-mutation heuristic');

add('FIGM-PERF-04', 'neg-edge', 'Perf04Edge.js', `import HeavyChart from 'heavy-chart-library';

function renderChart() {
  return HeavyChart.render();
}`, 'Edge case: a static import referenced unconditionally (not inside any conditional branch) should not be flagged as a deferred-execution candidate');

add('FIGM-A11Y-01', 'neg-edge', 'A11y01Edge.jsx', `function Panel({ togglePanel }) {
  return <div role="button" tabIndex={0} onClick={togglePanel} onKeyDown={togglePanel}>Toggle Panel</div>;
}`, 'Edge case: a non-native clickable div fully annotated with tabIndex + onKeyDown (not converted to <button>) satisfies the rule directly');

add('FIGM-PERF-02', 'neg-edge', 'Perf02Edge.jsx', `function Icon({ iconUrl }) {
  return <img src={iconUrl} alt="Icon" style={{ aspectRatio: '1/1' }} />;
}`, 'Edge case: aspect-ratio alone (no explicit width/height) is accepted as sufficient per the rule definition');

add('FIGM-ANG-01', 'neg-edge', 'Ang01Edge.component.ts', `@Component({ selector: 'app-data' })
export class DataComponent {
  ngOnInit() {
    this.dataService.getStream().subscribe();
  }
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}`, "Edge case: a file-wide unsubscribe() call (even in a different method) satisfies the teardown-keyword heuristic, matching the rule's documented file-wide (not per-subscription) matching");

// ==== Research-backed expansion set (8 rules) -- same sourcing discipline as above: every
// pos/neg pair is derived from that rule's own nonCompliantExample/compliantExample in
// four-layer-meta-model.ts. See docs/research/EXPANSION_RESEARCH_TRACEABILITY.md. ====

add('FIGM-A11Y-07', 'pos', 'A11y07Pos.jsx', `function Btn() {
  return <button aria-label="Submit the form">Send</button>;
}`, "Positive: aria-label \"Submit the form\" does not contain the visible text \"Send\"");
add('FIGM-A11Y-07', 'neg', 'A11y07Neg.jsx', `function Btn() {
  return <button aria-label="Send message">Send</button>;
}`, 'Negative: aria-label contains the visible text');

add('FIGM-REACT-05', 'pos', 'React05Pos.jsx', `function Cart({ items }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.length * 2);
  }, [items]);
  return <div>{total}</div>;
}`, 'Positive: Effect body is exactly one state-setter call deriving state from a prop');
add('FIGM-REACT-05', 'neg', 'React05Neg.jsx', `function Cart({ items }) {
  const total = items.length * 2;
  return <div>{total}</div>;
}`, 'Negative: derived value computed directly during render, no Effect at all');

add('FIGM-REACT-06', 'pos', 'React06Pos.jsx', `function Profile({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, []);
  return <div>{userId}</div>;
}`, 'Positive: Effect reads the userId prop but the dependency array is empty');
add('FIGM-REACT-06', 'neg', 'React06Neg.jsx', `function Profile({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, [userId]);
  return <div>{userId}</div>;
}`, 'Negative: userId is present in the dependency array');

add('FIGM-NEXT-05', 'pos', 'app/next05pos/page.tsx', `'use client';
import fs from 'fs';
import { useRouter } from 'next/navigation';
export default function Panel() {
  const router = useRouter();
  return <div>{typeof fs.readFileSync}{router ? '' : ''}</div>;
}`, "Positive: Node.js 'fs' module imported into a file marked 'use client'");
add('FIGM-NEXT-05', 'neg', 'app/next05neg/page.tsx', `import fs from 'fs';
import { useRouter } from 'next/navigation';
export default function Panel({ initialData }) {
  const router = useRouter();
  return <div>{typeof fs.readFileSync}{initialData}{router ? '' : ''}</div>;
}`, "Negative: same server-only import, but the file is a Server Component (no 'use client')");

add('FIGM-NEXT-06', 'pos', 'app/next06pos/page.tsx', `import { useRouter } from 'next/navigation';
export default function Hero() {
  const router = useRouter();
  return <img src="/hero.png" alt="Hero banner" width={1200} height={600} />;
}`, 'Positive: native <img> element used in a Next.js file');
add('FIGM-NEXT-06', 'neg', 'app/next06neg/page.tsx', `import Image from 'next/image';
import { useRouter } from 'next/navigation';
export default function Hero() {
  const router = useRouter();
  return <Image src="/hero.png" alt="Hero banner" width={1200} height={600} />;
}`, "Negative: next/image's Image component used instead of native <img>");

add('FIGM-ANG-06', 'pos', 'Ang06Pos.pipe.ts', `@Pipe({ name: 'filterActive', pure: false })
export class FilterActivePipe implements PipeTransform {
  transform(items: unknown[]): unknown[] {
    return items;
  }
}`, 'Positive: @Pipe declared with pure: false');
add('FIGM-ANG-06', 'neg', 'Ang06Neg.pipe.ts', `@Pipe({ name: 'filterActive' })
export class FilterActivePipe implements PipeTransform {
  transform(items: unknown[]): unknown[] {
    return items;
  }
}`, 'Negative: pipe is pure by default (no pure property at all)');

add('FIGM-VUE-01', 'pos', 'Vue01Pos.vue', `<template>
  <li v-for="(todo, index) in todos" :key="index">{{ todo.text }}</li>
</template>`, 'Positive: :key is bound to the loop index, not a stable identifier');
add('FIGM-VUE-01', 'neg', 'Vue01Neg.vue', `<template>
  <li v-for="todo in todos" :key="todo.id">{{ todo.text }}</li>
</template>`, 'Negative: :key bound to a stable identifier (todo.id)');

add('FIGM-VUE-02', 'pos', 'Vue02Pos.vue', `<template>
  <li v-for="user in users" v-if="user.isActive">{{ user.name }}</li>
</template>`, 'Positive: v-for and v-if present together on the same element');
add('FIGM-VUE-02', 'neg', 'Vue02Neg.vue', `<template>
  <li v-for="user in activeUsers">{{ user.name }}</li>
</template>`, 'Negative: list pre-filtered into activeUsers, v-if removed entirely');

// ==== Second research-backed expansion set (17 rules, 33 -> 50) -- same sourcing discipline:
// every pos/neg pair derived from that rule's own nonCompliantExample/compliantExample in
// four-layer-meta-model.ts. See docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md. ====

add('FIGM-NEXT-07', 'pos', 'app/next07pos/page.tsx', `'use client';
export default async function Panel() {
  const data = await fetchClientData();
  return <div>{data}</div>;
}`, "Positive: async function component in a file marked 'use client'");
add('FIGM-NEXT-07', 'neg', 'app/next07neg/page.tsx', `'use client';
import { useEffect, useState } from 'react';
export default function Panel() {
  const [data, setData] = useState(null);
  useEffect(() => { fetchClientData().then(setData); }, []);
  return <div>{data}</div>;
}`, 'Negative: synchronous Client Component fetching via useEffect instead');

add('FIGM-NEXT-08', 'pos', 'app/next08pos/page.tsx', `'use client';
import { useSearchParams } from 'next/navigation';
export default function Filters() {
  const params = useSearchParams();
  return <div>{params.get('q')}</div>;
}`, 'Positive: useSearchParams() with no <Suspense> boundary in the file');
add('FIGM-NEXT-08', 'neg', 'app/next08neg/page.tsx', `import { Suspense } from 'react';
import Filters from './filters';
export default function Page() {
  return <Suspense fallback={null}><Filters /></Suspense>;
}`, 'Negative: the page wraps the searchParams-reading component in <Suspense>');

add('FIGM-NEXT-09', 'pos', 'app/next09pos/page.tsx', `'use client';
export const metadata = { title: 'Dashboard' };
export default function Page() { return <div />; }`, "Positive: metadata export in a file marked 'use client'");
add('FIGM-NEXT-09', 'neg', 'app/next09neg/page.tsx', `export const metadata = { title: 'Dashboard' };
import DashboardClient from './dashboard-client';
export default function Page() { return <DashboardClient />; }`, 'Negative: metadata exported from a Server Component page, client logic split out');

add('FIGM-NEXT-10', 'pos', 'app/next10pos/page.tsx', `export const dynamic = 'force-dynamic';
export default async function Page() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return <PostList posts={posts} />;
}`, 'Positive: force-dynamic with no visible request-time dependency');
add('FIGM-NEXT-10', 'neg', 'app/next10neg/page.tsx', `export default async function Page() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return <PostList posts={posts} />;
}`, 'Negative: no force-dynamic export at all, route can be statically rendered');

add('FIGM-VUE-03', 'pos', 'Vue03Pos.vue', `<template><div /></template>
<script setup>
const fullName = computed(() => {
  logCount.value = logCount.value + 1;
  return first.value + ' ' + last.value;
});
</script>`, "Positive: computed getter mutates another ref's .value -- a side effect");
add('FIGM-VUE-03', 'neg', 'Vue03Neg.vue', `<template><div /></template>
<script setup>
const fullName = computed(() => first.value + ' ' + last.value);
</script>`, 'Negative: pure computed getter, no side effect');

add('FIGM-VUE-04', 'pos', 'Vue04Pos.vue', `<template><div /></template>
<script setup>
const sortedItems = computed(() => [...items.value].sort());
function addItem(x) {
  sortedItems.value.push(x);
}
</script>`, "Positive: mutates the computed ref's own .value contents via an array method");
add('FIGM-VUE-04', 'neg', 'Vue04Neg.vue', `<template><div /></template>
<script setup>
const sortedItems = computed(() => [...items.value].sort());
function addItem(x) {
  items.value.push(x);
}
</script>`, 'Negative: mutates the underlying source ref instead of the computed output');

add('FIGM-VUE-05', 'pos', 'Vue05Pos.vue', `<template><div /></template>
<script setup>
const props = defineProps(['todo']);
function complete() {
  props.todo.done = true;
}
</script>`, 'Positive: direct mutation of a defineProps()-bound prop field');
add('FIGM-VUE-05', 'neg', 'Vue05Neg.vue', `<template><div /></template>
<script setup>
const props = defineProps(['todo']);
const emit = defineEmits(['update:todo']);
function complete() {
  emit('update:todo', { ...props.todo, done: true });
}
</script>`, 'Negative: emits an event instead of mutating the prop directly');

add('FIGM-VUE-06', 'pos', 'Vue06Pos.vue', `<template><div /></template>
<script>
export default {
  methods: {
    increment: () => {
      this.count++;
    }
  }
};
</script>`, 'Positive: Options API method declared as an arrow function');
add('FIGM-VUE-06', 'neg', 'Vue06Neg.vue', `<template><div /></template>
<script>
export default {
  methods: {
    increment() {
      this.count++;
    }
  }
};
</script>`, 'Negative: regular method shorthand, correctly bound `this`');

add('FIGM-ANG-07', 'pos', 'Ang07Pos.component.ts', `@Component({ selector: 'app-data', changeDetection: ChangeDetectionStrategy.OnPush })
export class DataComponent {
  constructor(private dataService: DataService) {
    this.items = this.dataService.getInitialItems();
    this.dataService.refresh();
  }
}`, 'Positive: constructor performs non-trivial service calls');
add('FIGM-ANG-07', 'neg', 'Ang07Neg.component.ts', `@Component({ selector: 'app-data', changeDetection: ChangeDetectionStrategy.OnPush })
export class DataComponent {
  items = [];
  constructor(private dataService: DataService) {}
  ngOnInit(): void {
    this.items = this.dataService.getInitialItems();
  }
}`, 'Negative: constructor only does dependency injection, logic lives in ngOnInit');

add('FIGM-ANG-08', 'pos', 'Ang08Pos.component.ts', `@Component({ selector: 'app-list', changeDetection: ChangeDetectionStrategy.OnPush, template: \`@for (item of items; track $index) { <li>{{ item.name }}</li> }\` })
export class ListComponent {}`, 'Positive: @for track expression is $index');
add('FIGM-ANG-08', 'neg', 'Ang08Neg.component.ts', `@Component({ selector: 'app-list', changeDetection: ChangeDetectionStrategy.OnPush, template: \`@for (item of items; track item.id) { <li>{{ item.name }}</li> }\` })
export class ListComponent {}`, 'Negative: @for tracks by a stable identifier (item.id)');

add('FIGM-ANG-09', 'pos', 'Ang09Pos.component.ts', `@Component({ selector: 'app-user', changeDetection: ChangeDetectionStrategy.OnPush })
export class UserCard {
  userId = input<string>();
}`, 'Positive: signal input property missing the readonly modifier');
add('FIGM-ANG-09', 'neg', 'Ang09Neg.component.ts', `@Component({ selector: 'app-user', changeDetection: ChangeDetectionStrategy.OnPush })
export class UserCard {
  readonly userId = input<string>();
}`, 'Negative: signal input property correctly marked readonly');

add('FIGM-ANG-10', 'pos', 'Ang10Pos.component.ts', `@Component({ selector: 'app-user-card', changeDetection: ChangeDetectionStrategy.OnPush, template: \`<div>{{ (user$ | async)?.name }}</div><div>{{ (user$ | async)?.email }}</div>\` })
export class UserCardComponent {}`, 'Positive: the same observable is piped through | async twice');
add('FIGM-ANG-10', 'neg', 'Ang10Neg.component.ts', `@Component({ selector: 'app-user-card', changeDetection: ChangeDetectionStrategy.OnPush, template: \`<ng-container *ngIf="user$ | async as user"><div>{{ user?.name }}</div><div>{{ user?.email }}</div></ng-container>\` })
export class UserCardComponent {}`, 'Negative: subscribes once with an "as" alias and reuses the local variable');

add('FIGM-REACT-07', 'pos', 'React07Pos.jsx', `function Profile({ isActive }) {
  if (isActive) {
    const [count, setCount] = useState(0);
  }
  return <div />;
}`, 'Positive: useState called inside an if statement');
add('FIGM-REACT-07', 'neg', 'React07Neg.jsx', `function Profile({ isActive }) {
  const [count, setCount] = useState(0);
  if (isActive) {
    // use count here
  }
  return <div />;
}`, "Negative: useState at the component's top level, condition moved inside");

add('FIGM-REACT-08', 'pos', 'React08Pos.jsx', `function TodoItem({ todo }) {
  todo.done = true;
  return <li>{todo.text}</li>;
}`, 'Positive: direct mutation of a destructured prop');
add('FIGM-REACT-08', 'neg', 'React08Neg.jsx', `function TodoItem({ todo, onComplete }) {
  return <li onClick={() => onComplete({ ...todo, done: true })}>{todo.text}</li>;
}`, 'Negative: derives a new object and passes it up via a callback prop');

add('FIGM-REACT-09', 'pos', 'React09Pos.jsx', `function Logger({ message }) {
  localStorage.setItem('lastMessage', message);
  return <p>{message}</p>;
}`, 'Positive: storage call executed directly in the render body');
add('FIGM-REACT-09', 'neg', 'React09Neg.jsx', `function Logger({ message }) {
  useEffect(() => { localStorage.setItem('lastMessage', message); }, [message]);
  return <p>{message}</p>;
}`, 'Negative: the same call moved into a useEffect callback');

add('FIGM-REACT-10', 'pos', 'React10Pos.jsx', `function Layout({ children }) {
  return <div>{Article()}</div>;
}
function Article() {
  return <p>hi</p>;
}`, 'Positive: component called directly as a function inside JSX (detection requires the component to be defined in the same file)');
add('FIGM-REACT-10', 'neg', 'React10Neg.jsx', `function Layout({ children }) {
  return <div><Article /></div>;
}
function Article() {
  return <p>hi</p>;
}`, 'Negative: component rendered as JSX');

add('FIGM-REACT-11', 'pos', 'React11Pos.jsx', `function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}`, 'Positive: inline object literal passed directly as the Provider value');
add('FIGM-REACT-11', 'neg', 'React11Neg.jsx', `function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}`, 'Negative: Provider value memoized with useMemo');
