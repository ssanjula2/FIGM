import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * Second research-backed expansion set (17 rules: FIGM-NEXT-07..10, FIGM-VUE-03..06,
 * FIGM-ANG-07..10, FIGM-REACT-07..11) -- dedicated regression suite, mirroring the pattern
 * established for the first expansion pass in tests/expansion-rules.test.ts. See
 * docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md for the evidence dossier behind each rule,
 * including the 3 replaced candidates and 1 corrected premise.
 */

function detect(code: string, filePath: string) {
  const res = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(res.ast!, filePath, res.framework);
}

test('FIGM-NEXT-07: Async Client Component Misuse', async (t) => {
  await t.test('[TP] fires on an async function component in a "use client" file', () => {
    const code = `'use client';\nexport default async function Panel() {\n  const data = await fetchClientData();\n  return <div>{data}</div>;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-07'));
  });

  await t.test('[TN] does NOT fire on an async Server Component (no "use client")', () => {
    const code = `export default async function Panel() {\n  const data = await fetchServerData();\n  return <div>{data}</div>;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-07'));
  });

  await t.test('[TN] does NOT fire on a synchronous Client Component', () => {
    const code = `'use client';\nexport default function Panel() {\n  return <div>ok</div>;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-07'));
  });
});

test('FIGM-NEXT-08: useSearchParams Without a Suspense Boundary', async (t) => {
  await t.test('[TP] fires when useSearchParams is called with no <Suspense> in the file', () => {
    const code = `'use client';\nimport { useSearchParams } from 'next/navigation';\nexport default function Filters() {\n  const params = useSearchParams();\n  return <div>{params.get('q')}</div>;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-08'));
  });

  await t.test('[TN] does NOT fire when a <Suspense> element is present in the same file', () => {
    const code = `'use client';\nimport { Suspense } from 'react';\nimport { useSearchParams } from 'next/navigation';\nfunction Filters() {\n  const params = useSearchParams();\n  return <div>{params.get('q')}</div>;\n}\nexport default function Page() {\n  return <Suspense fallback={null}><Filters /></Suspense>;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-08'));
  });
});

test('FIGM-NEXT-09: Metadata API Used from an Invalid Client Boundary', async (t) => {
  await t.test('[TP] fires when metadata is exported from a "use client" file', () => {
    const code = `'use client';\nexport const metadata = { title: 'Dashboard' };\nexport default function Page() { return <div />; }`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-09'));
  });

  await t.test('[TP] fires for generateMetadata too', () => {
    const code = `'use client';\nexport function generateMetadata() { return { title: 'x' }; }\nexport default function Page() { return <div />; }`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-09'));
  });

  await t.test('[TN] does NOT fire in a Server Component (no "use client")', () => {
    const code = `export const metadata = { title: 'Dashboard' };\nexport default function Page() { return <div />; }`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-09'));
  });
});

test('FIGM-NEXT-10: Unnecessary Forced Dynamic Rendering', async (t) => {
  await t.test('[TP] fires when force-dynamic is set with no request-time API call visible', () => {
    const code = `export const dynamic = 'force-dynamic';\nexport default async function Page() {\n  const posts = await fetch('https://api.example.com/posts').then(r => r.json());\n  return <PostList posts={posts} />;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-NEXT-10'));
  });

  await t.test('[TN] does NOT fire when cookies() is used in the same file', () => {
    const code = `import { cookies } from 'next/headers';\nexport const dynamic = 'force-dynamic';\nexport default async function Page() {\n  const session = cookies().get('session');\n  return <div>{session?.value}</div>;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-10'));
  });

  await t.test('[TN] does NOT fire when a no-store fetch is used', () => {
    const code = `export const dynamic = 'force-dynamic';\nexport default async function Page() {\n  const posts = await fetch('https://api.example.com/posts', { cache: 'no-store' }).then(r => r.json());\n  return <PostList posts={posts} />;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-10'));
  });

  await t.test('[near-miss] does NOT fire when dynamic is not "force-dynamic"', () => {
    const code = `export const dynamic = 'auto';\nexport default async function Page() {\n  const posts = await fetch('https://api.example.com/posts').then(r => r.json());\n  return <PostList posts={posts} />;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-NEXT-10'));
  });
});

test('FIGM-VUE-03: Side Effect Inside Computed Getter', async (t) => {
  await t.test('[TP] fires when a computed getter assigns to another ref\'s .value', () => {
    const code = `<template><div /></template>\n<script setup>\nconst fullName = computed(() => {\n  logCount.value = logCount.value + 1;\n  return first.value + ' ' + last.value;\n});\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-03'));
  });

  await t.test('[TP] fires when a computed getter calls fetch()', () => {
    const code = `<template><div /></template>\n<script setup>\nconst data = computed(() => {\n  fetch('/api/log');\n  return raw.value;\n});\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-03'));
  });

  await t.test('[TN] does NOT fire for a pure computed getter', () => {
    const code = `<template><div /></template>\n<script setup>\nconst fullName = computed(() => first.value + ' ' + last.value);\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-03'));
  });

  await t.test('sourceKind is REAL_AST (script-block extraction, not heuristic)', () => {
    const code = `<template><div /></template>\n<script setup>\nconst fullName = computed(() => {\n  logCount.value = logCount.value + 1;\n  return first.value;\n});\n</script>`;
    const report = detect(code, 'C.vue').find((r) => r.ruleId === 'FIGM-VUE-03');
    assert.equal(report?.sourceKind, 'REAL_AST');
  });
});

test('FIGM-VUE-04: Direct Mutation of Computed Result', async (t) => {
  await t.test('[TP] fires when computed .value contents are mutated via an array method', () => {
    const code = `<template><div /></template>\n<script setup>\nconst sortedItems = computed(() => [...items.value].sort());\nfunction addItem(x) {\n  sortedItems.value.push(x);\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-04'));
  });

  await t.test('[TP] fires when a nested property of computed .value is assigned', () => {
    const code = `<template><div /></template>\n<script setup>\nconst config = computed(() => ({ theme: mode.value }));\nfunction setTheme(t) {\n  config.value.theme = t;\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-04'));
  });

  await t.test('[TN] does NOT fire for a bare reassignment of .value itself (Vue already runtime-warns about this)', () => {
    const code = `<template><div /></template>\n<script setup>\nconst sortedItems = computed(() => [...items.value].sort());\nfunction reset() {\n  sortedItems.value = [];\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-04'));
  });

  await t.test('[TN] does NOT fire when the underlying source ref is mutated instead', () => {
    const code = `<template><div /></template>\n<script setup>\nconst sortedItems = computed(() => [...items.value].sort());\nfunction addItem(x) {\n  items.value.push(x);\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-04'));
  });
});

test('FIGM-VUE-05: Direct Prop Mutation', async (t) => {
  await t.test('[TP] fires on a nested prop field assignment', () => {
    const code = `<template><div /></template>\n<script setup>\nconst props = defineProps(['todo']);\nfunction complete() {\n  props.todo.done = true;\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-05'));
  });

  await t.test('[TP] fires on an array-mutator call rooted at a prop', () => {
    const code = `<template><div /></template>\n<script setup>\nconst props = defineProps(['items']);\nfunction addItem(x) {\n  props.items.push(x);\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-05'));
  });

  await t.test('[TN] does NOT fire when props are read, not mutated', () => {
    const code = `<template><div /></template>\n<script setup>\nconst props = defineProps(['todo']);\nfunction log() {\n  console.log(props.todo.done);\n}\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-05'));
  });
});

test('FIGM-VUE-06: Arrow Function Used as Options API Method', async (t) => {
  await t.test('[TP] fires on an arrow function method', () => {
    const code = `<template><div /></template>\n<script>\nexport default {\n  methods: {\n    increment: () => {\n      this.count++;\n    }\n  }\n};\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-VUE-06'));
  });

  await t.test('[TN] does NOT fire on a regular method shorthand', () => {
    const code = `<template><div /></template>\n<script>\nexport default {\n  methods: {\n    increment() {\n      this.count++;\n    }\n  }\n};\n</script>`;
    const reports = detect(code, 'C.vue');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-VUE-06'));
  });

  await t.test('[fix+verify] converting to method shorthand resolves the violation on re-scan', () => {
    const code = `<template><div /></template>\n<script>\nexport default {\n  methods: {\n    increment: () => {\n      this.count++;\n    }\n  }\n};\n</script>`;
    const before = RuleExecutionEngine.analyzeFile('C.vue', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-VUE-06');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.ok(!result.requiresManualReview);
    const after = RuleExecutionEngine.analyzeFile('C.vue', result.remediatedCode);
    assert.ok(!after.diagnostics.some((d) => d.ruleId === 'FIGM-VUE-06'));
  });
});

test('FIGM-ANG-07: Complex Logic in Angular Component Constructor', async (t) => {
  await t.test('[TP] fires when the constructor contains a service call', () => {
    const code = `@Component({ selector: 'app-x' })\nexport class X {\n  constructor(private dataService: DataService) {\n    this.items = this.dataService.getInitialItems();\n  }\n}`;
    const reports = detect(code, 'x.component.ts');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-ANG-07'));
  });

  await t.test('[TN] does NOT fire on a bare field-assignment-only constructor', () => {
    const code = `@Component({ selector: 'app-x' })\nexport class X {\n  count = 0;\n  constructor(private dataService: DataService) {\n    this.dataService = dataService;\n  }\n}`;
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-07'));
  });

  // Regression guard (real-world false positive confirmed via a fresh benchmark re-scan of
  // trekhleb/javascript-algorithms -- a zero-Angular plain-JS repository -- which reported 11
  // FIGM-ANG-07 findings on ordinary data-structure class constructors, e.g. Sort.js's
  // `constructor(originalCallbacks) { ... }`, recommending "move to ngOnInit" for code with no
  // Angular runtime at all. Closed via hasAngularContext -- see its doc comment in
  // real-syntax-node-builder.ts for why this rule specifically needed the gate while its sibling
  // Angular rules (ANG-01/02/05/06/09) did not.)
  await t.test('[TN, regression] does NOT fire on a plain (non-Angular) JS/TS class with real constructor logic and no Angular evidence', () => {
    const code = `export class Sort {\n  constructor(originalCallbacks) {\n    this.originalMethods = originalCallbacks;\n    this.callbacks = this.initSortingCallbacks(originalCallbacks);\n  }\n}`;
    const reports = detect(code, 'Sort.js');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-07'), 'a plain non-Angular class constructor must not be flagged as an Angular anti-pattern');
  });

  // Boundary case: a GENERIC_ESTREE (.ts, not .component.ts) file that IS genuinely an Angular
  // class -- via a real @angular/core import, without an ANGULAR_TEMPLATE-triggering filename or
  // decorator -- must still be covered, not silently excluded by the new gate.
  await t.test('[TP, boundary] still fires on a genuine Angular class in a plain .ts file, via an @angular/core import', () => {
    const code = `import { Injectable } from '@angular/core';\nexport class DataService {\n  constructor(private http: HttpClient) {\n    this.cache = this.http.get('/api/init').toPromise();\n  }\n}`;
    const reports = detect(code, 'data.service.ts');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-ANG-07'), 'a real Angular service class (evidenced by an @angular/core import) must still be covered even without a .component.ts filename');
  });
});

test('FIGM-ANG-08: Unstable @for Track Expression', async (t) => {
  await t.test('[TP] fires when track is $index', () => {
    const code = '@Component({ template: `@for (item of items; track $index) { <li>{{ item.name }}</li> }` })\nexport class X {}';
    const reports = detect(code, 'x.component.ts');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-ANG-08'));
  });

  await t.test('[TP] fires when track is the bare loop variable', () => {
    const code = '@Component({ template: `@for (item of items; track item) { <li>{{ item.name }}</li> }` })\nexport class X {}';
    const reports = detect(code, 'x.component.ts');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-ANG-08'));
  });

  await t.test('[TN] does NOT fire when track is a stable property', () => {
    const code = '@Component({ template: `@for (item of items; track item.id) { <li>{{ item.name }}</li> }` })\nexport class X {}';
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-08'));
  });

  // Upgraded to REAL_AST in the Scientific Hardening Pass, via angular-html-parser's
  // tokenizeAngularBlocks mode -- see src/ast/angular-template-ast-builder.ts.
  await t.test('sourceKind is honestly REAL_AST, never LEGACY_TEXT_HEURISTIC', () => {
    const code = '@Component({ template: `@for (item of items; track $index) { <li>{{ item.name }}</li> }` })\nexport class X {}';
    const report = detect(code, 'x.component.ts').find((r) => r.ruleId === 'FIGM-ANG-08');
    assert.equal(report?.sourceKind, 'REAL_AST');
  });
});

test('FIGM-ANG-09: Mutable Signal Input Declaration', async (t) => {
  await t.test('[TP] fires when an input() property is missing readonly', () => {
    const code = `@Component({ selector: 'app-user' })\nexport class UserCard {\n  userId = input();\n}`;
    const reports = detect(code, 'x.component.ts');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-ANG-09'));
  });

  await t.test('[TN] does NOT fire when the property is readonly', () => {
    const code = `@Component({ selector: 'app-user' })\nexport class UserCard {\n  readonly userId = input();\n}`;
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-09'));
  });

  await t.test('[near-miss] does NOT fire for an ordinary property initializer unrelated to input/model', () => {
    const code = `@Component({ selector: 'app-user' })\nexport class UserCard {\n  count = computeDefault();\n}`;
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-09'));
  });

  await t.test('[fix+verify] adding readonly resolves the violation on re-scan', () => {
    const code = `@Component({ selector: 'app-user' })\nexport class UserCard {\n  userId = input();\n}`;
    const before = RuleExecutionEngine.analyzeFile('x.component.ts', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-ANG-09');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.ok(!result.requiresManualReview);
    const after = RuleExecutionEngine.analyzeFile('x.component.ts', result.remediatedCode);
    assert.ok(!after.diagnostics.some((d) => d.ruleId === 'FIGM-ANG-09'));
  });
});

test('FIGM-ANG-10: Duplicate Async Pipe Subscriptions in Template', async (t) => {
  await t.test('[TP] fires when the same observable is piped through async twice', () => {
    const code = '@Component({ template: `<div>{{ (user$ | async)?.name }}</div><div>{{ (user$ | async)?.email }}</div>` })\nexport class X {}';
    const reports = detect(code, 'x.component.ts');
    assert.ok(reports.filter((r) => r.ruleId === 'FIGM-ANG-10').length >= 1);
  });

  await t.test('[TN] does NOT fire when the observable is only piped once', () => {
    const code = '@Component({ template: `<div>{{ (user$ | async)?.name }}</div>` })\nexport class X {}';
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-10'));
  });

  await t.test('[TN] does NOT fire for two DIFFERENT observables each piped once', () => {
    const code = '@Component({ template: `<div>{{ (user$ | async)?.name }}</div><div>{{ (settings$ | async)?.theme }}</div>` })\nexport class X {}';
    const reports = detect(code, 'x.component.ts');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-ANG-10'));
  });
});

test('FIGM-REACT-07: Hook Used Inside Conditional, Loop, or Nested Function', async (t) => {
  await t.test('[TP] fires when a Hook is called inside an if statement', () => {
    const code = `function Profile({ isActive }) {\n  if (isActive) {\n    const [count, setCount] = useState(0);\n  }\n  return <div />;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-07'));
  });

  await t.test('[TP] fires when a Hook is called inside a nested ordinary function', () => {
    const code = `function Profile() {\n  function helper() {\n    const [x, setX] = useState(0);\n  }\n  return <div />;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-07'));
  });

  await t.test('[TN] does NOT fire for a Hook at the top level of a component', () => {
    const code = `function Profile({ isActive }) {\n  const [count, setCount] = useState(0);\n  if (isActive) {\n    console.log(count);\n  }\n  return <div />;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-07'));
  });

  await t.test('[TN] does NOT fire for a Hook at the top level of a custom Hook', () => {
    const code = `function useCounter() {\n  const [count, setCount] = useState(0);\n  return count;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-07'));
  });
});

test('FIGM-REACT-08: Direct Mutation of Component Props', async (t) => {
  await t.test('[TP] fires when a destructured prop field is assigned', () => {
    const code = `function TodoItem({ todo }) {\n  todo.done = true;\n  return <li>{todo.text}</li>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-08'));
  });

  await t.test('[TN] does NOT fire when props are read, not mutated', () => {
    const code = `function TodoItem({ todo }) {\n  return <li className={todo.done ? 'done' : ''}>{todo.text}</li>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-08'));
  });

  await t.test('[near-miss] does NOT duplicate FIGM-REACT-03 (state, not props)', () => {
    const code = `function Counter() {\n  const [state, setState] = useState({ count: 0 });\n  state.count = 1;\n  return <div>{state.count}</div>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-08'), 'a state mutation with no destructured prop parameter should not trip the props-mutation rule');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-03'), 'the existing state-mutation rule should still be the one that fires here');
  });
});

test('FIGM-REACT-09: Side Effect Executed During Render', async (t) => {
  await t.test('[TP] fires on a storage call directly in the render body', () => {
    const code = `function Logger({ message }) {\n  localStorage.setItem('lastMessage', message);\n  return <p>{message}</p>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-09'));
  });

  await t.test('[TN] does NOT fire when the call is inside useEffect', () => {
    const code = `function Logger({ message }) {\n  useEffect(() => { localStorage.setItem('lastMessage', message); }, [message]);\n  return <p>{message}</p>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-09'));
  });

  await t.test('[TN] does NOT fire on fetch() in an async Server Component render body (the documented correct Next.js pattern)', () => {
    const code = `export default async function Page() {\n  const posts = await fetch('https://api.example.com/posts').then(r => r.json());\n  return <PostList posts={posts} />;\n}`;
    const reports = detect(code, 'app/page.tsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-09'));
  });
});

test('FIGM-REACT-10: Component Function Called Directly Instead of Rendered as JSX', async (t) => {
  await t.test('[TP] fires when a component is called as a plain function inside JSX', () => {
    const code = `function Layout({ children }) {\n  return <div>{Article()}</div>;\n}\nfunction Article() { return <p>hi</p>; }`;
    const reports = detect(code, 'C.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-10'));
  });

  await t.test('[TN] does NOT fire when the component is rendered as JSX', () => {
    const code = `function Layout({ children }) {\n  return <div><Article /></div>;\n}\nfunction Article() { return <p>hi</p>; }`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-10'));
  });

  await t.test('[fix+verify] converting to JSX resolves the violation on re-scan', () => {
    const code = `function Layout({ children }) {\n  return <div>{Article()}</div>;\n}\nfunction Article() { return <p>hi</p>; }`;
    const before = RuleExecutionEngine.analyzeFile('C.jsx', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-REACT-10');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.ok(!result.requiresManualReview);
    const after = RuleExecutionEngine.analyzeFile('C.jsx', result.remediatedCode);
    assert.ok(!after.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-10'));
  });
});

test('FIGM-REACT-11: Unmemoized Context Provider Value', async (t) => {
  await t.test('[TP] fires on an inline object literal Provider value', () => {
    const code = `function AuthProvider({ children }) {\n  const [user, setUser] = useState(null);\n  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(reports.some((r) => r.ruleId === 'FIGM-REACT-11'));
  });

  await t.test('[TN] does NOT fire when the value is memoized', () => {
    const code = `function AuthProvider({ children }) {\n  const [user, setUser] = useState(null);\n  const value = useMemo(() => ({ user, setUser }), [user]);\n  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-REACT-11'));
  });

  await t.test('[near-miss] does NOT duplicate FIGM-PERF-01 (a JSX attribute value, not a variable-declaration initializer)', () => {
    const code = `function AuthProvider({ children }) {\n  const [user, setUser] = useState(null);\n  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;\n}`;
    const reports = detect(code, 'C.jsx');
    assert.ok(!reports.some((r) => r.ruleId === 'FIGM-PERF-01'), 'FIGM-PERF-01 only matches a const-declaration object literal initializer, not a JSX value= expression');
  });

  await t.test('[fix+verify] wrapping in useMemo resolves the violation on re-scan', () => {
    const code = `function AuthProvider({ children }) {\n  const [user, setUser] = useState(null);\n  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;\n}`;
    const before = RuleExecutionEngine.analyzeFile('C.jsx', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-REACT-11');
    assert.ok(defect);
    const result = RemediationEngine.applyQuickFix(code, defect!);
    assert.ok(!result.requiresManualReview);
    const after = RuleExecutionEngine.analyzeFile('C.jsx', result.remediatedCode);
    assert.ok(!after.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-11'));
  });
});

test('Second expansion set: every one of the 17 new rules is reachable end-to-end via RuleExecutionEngine.analyzeFile (not orphaned)', () => {
  const fixtures: Array<{ ruleId: string; code: string; filePath: string }> = [
    { ruleId: 'FIGM-NEXT-07', filePath: 'app/page.tsx', code: `'use client';\nexport default async function P() { const d = await f(); return <div>{d}</div>; }` },
    { ruleId: 'FIGM-NEXT-08', filePath: 'app/page.tsx', code: `'use client';\nimport { useSearchParams } from 'next/navigation';\nexport default function F() { const p = useSearchParams(); return <div>{p.get('q')}</div>; }` },
    { ruleId: 'FIGM-NEXT-09', filePath: 'app/page.tsx', code: `'use client';\nexport const metadata = { title: 'x' };\nexport default function P() { return <div />; }` },
    { ruleId: 'FIGM-NEXT-10', filePath: 'app/page.tsx', code: `export const dynamic = 'force-dynamic';\nexport default async function P() { const d = await fetch('https://x.com').then(r => r.json()); return <div>{d}</div>; }` },
    { ruleId: 'FIGM-VUE-03', filePath: 'C.vue', code: `<template><div /></template>\n<script setup>\nconst x = computed(() => { y.value = y.value + 1; return z.value; });\n</script>` },
    { ruleId: 'FIGM-VUE-04', filePath: 'C.vue', code: `<template><div /></template>\n<script setup>\nconst s = computed(() => [...a.value]);\nfunction add(x) { s.value.push(x); }\n</script>` },
    { ruleId: 'FIGM-VUE-05', filePath: 'C.vue', code: `<template><div /></template>\n<script setup>\nconst props = defineProps(['todo']);\nfunction c() { props.todo.done = true; }\n</script>` },
    { ruleId: 'FIGM-VUE-06', filePath: 'C.vue', code: `<template><div /></template>\n<script>\nexport default { methods: { inc: () => { this.n++; } } };\n</script>` },
    { ruleId: 'FIGM-ANG-07', filePath: 'x.component.ts', code: `@Component({ selector: 'app-x' })\nexport class X {\n  constructor(private s: S) { this.items = this.s.get(); }\n}` },
    { ruleId: 'FIGM-ANG-08', filePath: 'x.component.ts', code: '@Component({ template: `@for (item of items; track $index) { <li>{{ item.name }}</li> }` })\nexport class X {}' },
    { ruleId: 'FIGM-ANG-09', filePath: 'x.component.ts', code: `@Component({ selector: 'app-x' })\nexport class X { userId = input(); }` },
    { ruleId: 'FIGM-ANG-10', filePath: 'x.component.ts', code: '@Component({ template: `<div>{{ (u$ | async)?.name }}</div><div>{{ (u$ | async)?.email }}</div>` })\nexport class X {}' },
    { ruleId: 'FIGM-REACT-07', filePath: 'C.jsx', code: `function P({ a }) { if (a) { const [c, setC] = useState(0); } return <div />; }` },
    { ruleId: 'FIGM-REACT-08', filePath: 'C.jsx', code: `function T({ todo }) { todo.done = true; return <li>{todo.text}</li>; }` },
    { ruleId: 'FIGM-REACT-09', filePath: 'C.jsx', code: `function L({ m }) { localStorage.setItem('x', m); return <p>{m}</p>; }` },
    { ruleId: 'FIGM-REACT-10', filePath: 'C.jsx', code: `function L({ c }) { return <div>{A()}</div>; }\nfunction A() { return <p>hi</p>; }` },
    { ruleId: 'FIGM-REACT-11', filePath: 'C.jsx', code: `function P({ c }) { const [u, setU] = useState(null); return <Ctx.Provider value={{ u, setU }}>{c}</Ctx.Provider>; }` },
  ];
  for (const f of fixtures) {
    const result = RuleExecutionEngine.analyzeFile(f.filePath, f.code);
    assert.ok(
      result.diagnostics.some((d) => d.ruleId === f.ruleId),
      `${f.ruleId} did not fire via RuleExecutionEngine.analyzeFile — rule is orphaned from the live scan path`
    );
  }
});
