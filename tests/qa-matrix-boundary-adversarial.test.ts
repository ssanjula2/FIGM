import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * QA Validation Matrix — boundary + adversarial coverage for all 25 FIGM rules.
 *
 * Complements tests/rule-detection-matrix.test.ts (clear-cut positive/negative per rule) and
 * tests/adversarial-complete-detection.test.ts (historical audit regressions) with the two matrix
 * categories that were missing for all but a handful of rules: BOUNDARY (ambiguous/edge-case code
 * where reasonable engineers could disagree, or where the current heuristic's exact threshold
 * matters) and ADVERSARIAL (code shaped specifically to probe whether a naive substring/regex
 * scanner can be fooled, or that stresses a real limitation of the line-based detection
 * architecture).
 *
 * Every expectation below was verified against the ACTUAL engine (not assumed) before being
 * written as an assertion — see the QA matrix report for the probe methodology. Three real bugs
 * were found this way and fixed at the root cause in src/parser/source-parser.ts before this file
 * was finalized:
 *   1. FIGM-PERF-01 missed the single-line `.map(item => { const cfg = {...}; ... })` shape.
 *   2. FIGM-PERF-03's cleanup check ignored event type, so an unrelated removeEventListener('resize', ...)
 *      masked a genuinely leaking addEventListener('scroll', ...).
 *   3. FIGM-PERF-04's conditional-only-import check excluded an ENTIRE `if (...)` line from usage
 *      counting, missing the common single-line-body shape `if (cond) { Heavy.load(); }`.
 *   4. FIGM-PERF-05's real-AST migration (docs/architecture/RULE_ENGINEERING_AUDIT.md, Group 4)
 *      closed a KNOWN LIMITATION this file used to pin down: the legacy line-based heuristic
 *      textually matched "map(" + "() =>" substrings anywhere on one physical line, so an inline
 *      arrow already wrapped in `useCallback` and referenced by name (`onClick={cb}`) was still
 *      (wrongly) flagged, because the unrelated `useCallback(() => ...)` on the same line also
 *      contains an "() =>" substring. Real AST only flags an ArrowFunctionExpression that is
 *      itself the DIRECT initializer of a JSX handler attribute, so a named reference to an
 *      already-memoized callback is correctly no longer flagged -- see the updated case below.
 * Where a case instead documents a genuine, currently-unfixed architectural limitation of the
 * line/regex-based detection layer (no data-flow analysis), the assertion pins down CURRENT
 * behavior honestly and the rationale says so explicitly — these are reported as remaining
 * weaknesses, not silently accepted as correct.
 */

interface BoundaryAdversarialCase {
  ruleId: string;
  kind: 'boundary' | 'adversarial';
  label: string;
  code: string;
  filePath: string;
  expectFire: boolean;
  rationale: string;
}

const CASES: BoundaryAdversarialCase[] = [
  // --- FIGM-PERF-01 ---
  {
    ruleId: 'FIGM-PERF-01', kind: 'boundary',
    label: 'object literal properties reference the loop variable itself',
    code: `items.map(item => { const cfg = { id: item.id }; return <span>{item}</span>; });`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'KNOWN LIMITATION: cfg depends on item.id so it cannot actually be hoisted (it is not truly invariant), but the line-based heuristic has no data-flow awareness of what the object references — it flags any object literal allocated in loop/render scope regardless of content. Documented over-approximation, not fixed in this pass (would require real data-flow analysis).',
  },
  {
    ruleId: 'FIGM-PERF-01', kind: 'adversarial',
    label: 'object already memoized via useMemo inside the loop callback',
    code: `items.map(item => { const cfg = useMemo(() => ({ id: item.id }), [item]); return <span>{item}</span>; });`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'cfg is assigned the RESULT of useMemo(...), not an object literal directly ("= {" never appears), so the regex correctly does not match — already-memoized allocations are not flagged.',
  },

  // --- FIGM-PERF-02 ---
  {
    ruleId: 'FIGM-PERF-02', kind: 'boundary',
    label: 'img has width but not height (partial dimensions)',
    code: `<img src="/x.png" width={100} alt="x" />`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'CLS prevention requires BOTH width and height (or aspect-ratio); a single dimension still leaves layout unconstrained on the missing axis, so the rule correctly still fires.',
  },
  {
    ruleId: 'FIGM-PERF-02', kind: 'adversarial',
    label: 'img uses inline aspect-ratio style instead of width/height',
    code: `<img src="/x.png" style="aspect-ratio: 16/9" alt="x" />`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'aspect-ratio is a valid, accepted alternative to explicit width/height for CLS prevention; correctly suppressed.',
  },

  // --- FIGM-PERF-03 ---
  {
    ruleId: 'FIGM-PERF-03', kind: 'boundary',
    label: 'scroll listener leaks while an unrelated resize listener is properly cleaned up',
    code: `function A() { window.addEventListener('scroll', onScroll); }\nfunction B() { window.removeEventListener('resize', onResize); }`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'REGRESSION for a fixed bug: cleanup pairing is now event-type-aware, so an unrelated removeEventListener for a DIFFERENT event ("resize") no longer masks the genuinely uncleaned "scroll" listener.',
  },
  {
    ruleId: 'FIGM-PERF-03', kind: 'adversarial',
    label: 'a comment falsely claims cleanup happens elsewhere',
    code: `// removeEventListener happens elsewhere, trust me\nwindow.addEventListener('scroll', onScroll);`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'Comment text is stripped before detection (ADVERSARIAL_DETECTION_AUDIT.md); a comment cannot be used to suppress a genuine violation.',
  },

  // --- FIGM-PERF-04 ---
  {
    ruleId: 'FIGM-PERF-04', kind: 'boundary',
    label: 'import used both inside and outside a conditional branch',
    code: `import { NextResponse } from 'next/server';\nfunction ok() { return NextResponse.json({}); }\nfunction err() { if (bad) { return NextResponse.error(); } }`,
    filePath: 'a.ts', expectFire: false,
    rationale: 'A binding used unconditionally ANYWHERE in the file is not exclusively-conditional, so dynamic-import advice would be wrong; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-PERF-04', kind: 'adversarial',
    label: 'single-line if-body usage: `if (cond) { Heavy.load(); }`',
    code: `import { Heavy } from 'monaco-editor';\nfunction f() { if (cond) { Heavy.load(); } }`,
    filePath: 'a.ts', expectFire: true,
    rationale: 'REGRESSION for a fixed bug: usage occurring on the SAME physical line as the guarding `if (` is now correctly counted as conditional usage instead of being silently excluded entirely.',
  },

  // --- FIGM-PERF-05 ---
  {
    ruleId: 'FIGM-PERF-05', kind: 'boundary',
    label: 'named handler reference (not an inline arrow) passed inside .map()',
    code: `items.map(item => <div onClick={handleClick}>{item}</div>);`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'onClick={handleClick} references a stable, hoisted function, not an inline arrow; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-PERF-05', kind: 'adversarial',
    label: 'inline arrow wrapped in useCallback inside .map()',
    code: `items.map((item) => { const cb = useCallback(() => doThing(item), [item]); return <div onClick={cb}>{item}</div>; });`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'REGRESSION for a fixed bug (Group 4 real-AST migration): onClick={cb} is a named reference to an already-memoized callback, not an inline arrow literal -- real AST correctly sees the JSX attribute\'s initializer is an Identifier, not an ArrowFunctionExpression, so it is no longer flagged. Previously a KNOWN LIMITATION (the legacy line-based heuristic matched "map(" + "() =>" substrings on the same physical line, including the unrelated arrow inside useCallback(...)).',
  },

  // --- FIGM-PERF-06 ---
  {
    ruleId: 'FIGM-PERF-06', kind: 'boundary',
    label: 'localStorage read once, outside any loop, result reused inside a loop',
    code: `const cached = localStorage.getItem('x');\nitems.forEach(item => console.log(item, cached));`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'The localStorage call itself is not inside loop/render scope; only the read RESULT is used in the loop, which is the correct pattern — not flagged.',
  },
  {
    ruleId: 'FIGM-PERF-06', kind: 'adversarial',
    label: 'localStorage.setItem called directly inside .forEach',
    code: `items.forEach(item => { localStorage.setItem(item.id, item.value); });`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'Synchronous storage API invoked once per iteration inside the loop body; correctly flagged.',
  },

  // --- FIGM-A11Y-01 ---
  {
    ruleId: 'FIGM-A11Y-01', kind: 'boundary',
    label: 'div has onClick and tabIndex but is still missing onKeyDown',
    code: `<div onClick={() => go()} tabIndex={0}>Click</div>`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'Full keyboard parity requires BOTH a keydown handler AND a tabIndex; a partial fix (tabIndex only) still leaves the element unreachable/inoperable via keyboard Enter/Space, so it correctly still fires.',
  },
  {
    ruleId: 'FIGM-A11Y-01', kind: 'adversarial',
    label: 'Prettier-formatted JSX with the opening tag and onClick on separate lines',
    code: `<div\n  className="card"\n  onClick={() => go()}\n>\n  Click\n</div>`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'REGRESSION guard: the multi-line attribute scanner (scanJsxOpenTagAttrs) correctly follows the tag across physical lines rather than missing the onClick that a single-line substring check would not see.',
  },

  // --- FIGM-A11Y-02 ---
  {
    ruleId: 'FIGM-A11Y-02', kind: 'boundary',
    label: 'custom control has a role but no accessible name',
    code: `<CustomDropdown role="combobox">Options</CustomDropdown>`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'Both an ARIA role AND an accessible name (aria-label/aria-labelledby) are required; role alone is insufficient, so it correctly still fires.',
  },
  {
    ruleId: 'FIGM-A11Y-02', kind: 'adversarial',
    label: 'tag name is lowercase, not PascalCase, despite containing "Dropdown"',
    code: `<customDropdown>Options</customDropdown>`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'Custom-control detection requires the tag to open with literal "<Custom", "<Select", or "<Dropdown" immediately after "<"; a lowercase-initial tag name never matches, so the parser never even builds a candidate node for it.',
  },

  // --- FIGM-A11Y-03 ---
  {
    ruleId: 'FIGM-A11Y-03', kind: 'boundary',
    label: 'status container uses role="status" instead of aria-live',
    code: `<div id="status" role="status">Loading...</div>`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'role="status" is an accepted equivalent to an explicit aria-live region for screen-reader announcement; correctly not required additionally.',
  },
  {
    ruleId: 'FIGM-A11Y-03', kind: 'adversarial',
    label: 'className merely starts with "status" but names an unrelated widget',
    code: `<div className="status-bar-widget">Info</div>`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'KNOWN LIMITATION: detection matches the literal prefix className="status (or class="status/id="status), so any className merely STARTING with "status" is treated as a dynamic status container even when unrelated to live-region semantics; documented over-approximation, not fixed in this pass.',
  },

  // --- FIGM-A11Y-04 ---
  {
    ruleId: 'FIGM-A11Y-04', kind: 'boundary',
    label: 'Modal has an onClose handler but no explicit focus-restoration marker',
    code: `<Modal onClose={() => setOpen(false)}>content</Modal>`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'KNOWN LIMITATION: presence of an onClose handler is accepted as a proxy for focus-restoration logic without verifying the handler body actually restores focus; documented over-approximation, not fixed in this pass.',
  },
  {
    ruleId: 'FIGM-A11Y-04', kind: 'adversarial',
    label: 'Modal has neither onClose nor any focus-restoration marker',
    code: `<Modal>content</Modal>`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'No evidence of focus restoration at all; correctly flagged.',
  },

  // --- FIGM-A11Y-05 ---
  {
    ruleId: 'FIGM-A11Y-05', kind: 'boundary',
    label: 'input has an id with a matching label htmlFor elsewhere in the file',
    code: `<label htmlFor="email">Email</label>\n<input id="email" type="email" />`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'A real associated <label> exists via htmlFor/id pairing (even on a different line); correctly not flagged.',
  },
  {
    ruleId: 'FIGM-A11Y-05', kind: 'adversarial',
    label: 'input has an id but no htmlFor/for anywhere in the file',
    code: `<input id="email" type="email" />`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'An id alone does not guarantee an associated label exists; correctly flagged as unlabeled.',
  },

  // --- FIGM-A11Y-06 ---
  {
    ruleId: 'FIGM-A11Y-06', kind: 'boundary',
    label: 'tabIndex={0} — the natural-order, non-overriding value',
    code: `<button tabIndex={0}>Go</button>`,
    filePath: 'a.jsx', expectFire: false,
    rationale: '0 does not override natural focus order (it just makes an otherwise-unfocusable element focusable); correctly not flagged.',
  },
  {
    ruleId: 'FIGM-A11Y-06', kind: 'adversarial',
    label: 'tabIndex={-1} — negative, removes from tab order rather than overriding it',
    code: `<button tabIndex={-1}>Go</button>`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'The positive-tabIndex regex requires [1-9] as the leading digit, so a negative value is correctly excluded from matching at all.',
  },

  // --- FIGM-NEXT-01 ---
  {
    ruleId: 'FIGM-NEXT-01', kind: 'boundary',
    label: 'useState used in a Next.js page WITH a "use client" directive present',
    code: `"use client";\nimport { useState } from 'react';\nfunction P() { const [x] = useState(0); return <div>{x}</div>; }`,
    filePath: 'app/page.tsx', expectFire: false,
    rationale: 'The directive is present, so the client hook is legitimately gated; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-NEXT-01', kind: 'adversarial',
    label: 'useState used in a Next.js page missing "use client"',
    code: `import { useState } from 'react';\nfunction P() { const [x] = useState(0); return <div>{x}</div>; }`,
    filePath: 'app/page.tsx', expectFire: true,
    rationale: 'No directive gates this client hook; correctly flagged.',
  },

  // --- FIGM-NEXT-02 ---
  {
    ruleId: 'FIGM-NEXT-02', kind: 'boundary',
    label: 'monaco-editor loaded via next/dynamic with ssr: false',
    code: `import dynamic from 'next/dynamic';\nconst Editor = dynamic(() => import('monaco-editor'), { ssr: false });`,
    filePath: 'app/page.tsx', expectFire: false,
    rationale: 'The heavy module is already behind next/dynamic (dynamic( present in source); correctly not flagged.',
  },
  {
    ruleId: 'FIGM-NEXT-02', kind: 'adversarial',
    label: 'monaco-editor imported statically at module top-level in Next.js',
    code: `import monaco from 'monaco-editor';\nexport default function P() { return <div />; }`,
    filePath: 'app/page.tsx', expectFire: true,
    rationale: 'A known-heavy browser module imported statically with no dynamic( anywhere in the file; correctly flagged.',
  },

  // --- FIGM-NEXT-03 ---
  {
    ruleId: 'FIGM-NEXT-03', kind: 'boundary',
    label: 'App Router page WITH an export const revalidate',
    code: `export const revalidate = 60;\nexport default function Page() { return <div />; }`,
    filePath: 'app/dashboard/page.tsx', expectFire: false,
    rationale: 'The route segment config is present; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-NEXT-03', kind: 'adversarial',
    label: 'App Router page missing export const revalidate entirely',
    code: `export default function Page() { return <div />; }`,
    filePath: 'app/dashboard/page.tsx', expectFire: true,
    rationale: 'No revalidate route segment config anywhere in the file; correctly flagged.',
  },

  // --- FIGM-NEXT-04 ---
  {
    ruleId: 'FIGM-NEXT-04', kind: 'boundary',
    label: 'fonts loaded via next/font instead of an external stylesheet link',
    code: `import { Inter } from 'next/font/google';\nconst inter = Inter({ subsets: ['latin'] });`,
    filePath: 'app/page.tsx', expectFire: false,
    rationale: 'No fonts.googleapis.com stylesheet link exists; using next/font is the recommended pattern and is correctly not flagged.',
  },
  {
    ruleId: 'FIGM-NEXT-04', kind: 'adversarial',
    label: 'external Google Fonts stylesheet link tag',
    code: `<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet" />`,
    filePath: 'app/page.tsx', expectFire: true,
    rationale: 'A render-blocking external font stylesheet link causing CLS; correctly flagged.',
  },

  // --- FIGM-REACT-01 ---
  {
    ruleId: 'FIGM-REACT-01', kind: 'boundary',
    label: '.filter() already wrapped in useMemo',
    code: `const filtered = useMemo(() => items.filter(x => x.active), [items]);`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'useMemo( appears on the same line as the derived computation; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-REACT-01', kind: 'adversarial',
    label: '.sort() performed inline in render with no useMemo anywhere on the line',
    code: `const sorted = items.sort((a, b) => a.name.localeCompare(b.name));`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'Expensive derived computation with no memoization; correctly flagged.',
  },

  // --- FIGM-REACT-02 (real TypeScript-compiler AST for REACT_JSX/NEXT_JS) ---
  {
    ruleId: 'FIGM-REACT-02', kind: 'boundary',
    label: 'the .map() index parameter is named something other than index/i/idx (e.g. "position")',
    code: `items.map((item, position) => <div key={position}>{item}</div>);`,
    filePath: 'a.tsx', expectFire: true,
    rationale: 'Real AST scope resolution identifies "position" as the .map() callback\'s second (index) parameter regardless of its name — something the old regex (`key={index}`/`key={i}`/`key={idx}`, literal names only) could never see.',
  },
  {
    ruleId: 'FIGM-REACT-02', kind: 'adversarial',
    label: 'a local variable is literally named "index" but is unrelated to the .map() callback\'s index parameter',
    code: `const index = 5;\nitems.map((item) => <div key={item.id}>{item}</div>);\nconsole.log(index);`,
    filePath: 'a.tsx', expectFire: false,
    rationale: 'Real AST scope resolution confirms the callback used as key (item.id) is not the enclosing .map()\'s bound index parameter, so the unrelated same-named outer variable does not cause a false positive — the exact class of bug the old naive regex-based version could not avoid.',
  },

  // --- FIGM-REACT-03 ---
  {
    ruleId: 'FIGM-REACT-03', kind: 'boundary',
    label: 'a fresh sorted copy is built via spread + .sort(), not a mutation of existing state',
    code: `const sorted = [...items].sort((a, b) => a - b);`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'The line starts with "const ", which the heuristic explicitly excludes from mutation detection (a declaration, not a mutation of an existing binding); correctly not flagged for REACT-03 (this line is still separately, correctly flagged by FIGM-REACT-01 for the unmemoized .sort()).',
  },
  {
    ruleId: 'FIGM-REACT-03', kind: 'adversarial',
    label: 'a plain local array is mutated with .push(), indistinguishable from React state without real binding analysis',
    code: `function add(item) { list.push(item); }`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'KNOWN LIMITATION: the heuristic cannot distinguish a plain local array mutation from a React state array mutation without real state-binding analysis; it flags any push/splice/pop/etc. shape not guarded by a setState/declaration pattern. Documented over-approximation, not fixed in this pass.',
  },

  // --- FIGM-REACT-04 ---
  {
    ruleId: 'FIGM-REACT-04', kind: 'boundary',
    label: 'inline arrow passed to a lowercase host element (not a tracked custom component)',
    code: `<div onClick={() => doThing()}>Click</div>`,
    filePath: 'a.jsx', expectFire: false,
    rationale: 'FIGM-REACT-04 only tracks inline callbacks passed to <Custom*>/<Button>/<Card> children (the re-render-prop-identity concern is specific to child COMPONENTS); a host element is out of scope for this rule and correctly not flagged (a plain <div onClick> is instead FIGM-A11Y-01/PERF-05 territory).',
  },
  {
    ruleId: 'FIGM-REACT-04', kind: 'adversarial',
    label: 'inline arrow passed as onClick to a <Button> child component',
    code: `<Button onClick={() => doThing()}>Click</Button>`,
    filePath: 'a.jsx', expectFire: true,
    rationale: 'A fresh function identity is passed to a child component every render with no useCallback; correctly flagged.',
  },

  // --- FIGM-ANG-01 ---
  {
    ruleId: 'FIGM-ANG-01', kind: 'boundary',
    label: 'subscribe() call exists, and takeUntilDestroyed is used elsewhere in the same file',
    code: `@Component({}) class C { ngOnInit() { this.x$.pipe(takeUntilDestroyed()).subscribe(v => this.v = v); } }`,
    filePath: 'a.component.ts', expectFire: false,
    rationale: 'takeUntilDestroyed() is present in the file, which the heuristic accepts as evidence of a managed subscription lifecycle; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-ANG-01', kind: 'adversarial',
    label: 'subscribe() call with no unsubscribe/takeUntilDestroyed/DestroyRef anywhere in the file',
    code: `@Component({}) class C { ngOnInit() { this.x$.subscribe(v => this.v = v); } }`,
    filePath: 'a.component.ts', expectFire: true,
    rationale: 'No lifecycle-managed teardown evidence anywhere in the file; correctly flagged.',
  },

  // --- FIGM-ANG-02 ---
  {
    ruleId: 'FIGM-ANG-02', kind: 'boundary',
    label: '@Component explicitly specifies ChangeDetectionStrategy.OnPush',
    code: `@Component({\n  changeDetection: ChangeDetectionStrategy.OnPush\n})\nclass C {}`,
    filePath: 'a.component.ts', expectFire: false,
    rationale: 'OnPush is present in the file; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-ANG-02', kind: 'adversarial',
    label: '@Component with no ChangeDetectionStrategy at all',
    code: `@Component({\n  selector: 'app-c'\n})\nclass C {}`,
    filePath: 'a.component.ts', expectFire: true,
    rationale: 'Default (non-OnPush) change detection strategy; correctly flagged.',
  },

  // --- FIGM-ANG-03 ---
  {
    ruleId: 'FIGM-ANG-03', kind: 'boundary',
    label: '*ngFor includes a trackBy binding',
    code: `<div *ngFor="let item of items; trackBy: trackById">{{item}}</div>`,
    filePath: 'a.component.ts', expectFire: false,
    rationale: 'trackBy is present on the same *ngFor directive; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-ANG-03', kind: 'adversarial',
    label: '*ngFor with no trackBy binding',
    code: `<div *ngFor="let item of items">{{item}}</div>`,
    filePath: 'a.component.ts', expectFire: true,
    rationale: 'No trackBy on the directive; correctly flagged.',
  },

  // --- FIGM-ANG-04 ---
  {
    ruleId: 'FIGM-ANG-04', kind: 'boundary',
    label: 'template interpolation reads a plain property, no method call',
    code: `@Component({ template: \`<div>{{ userName }}</div>\` }) class C {}`,
    filePath: 'a.component.ts', expectFire: false,
    rationale: 'The interpolation "{{ userName }}" contains no "()" call; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-ANG-04', kind: 'adversarial',
    label: 'template interpolation calls a component method directly',
    code: `@Component({ template: \`<div>{{ getUserName() }}</div>\` }) class C {}`,
    filePath: 'a.component.ts', expectFire: true,
    rationale: 'A method call inside template interpolation re-executes on every change-detection cycle; correctly flagged.',
  },

  // --- FIGM-ANG-05 ---
  {
    ruleId: 'FIGM-ANG-05', kind: 'boundary',
    label: 'nativeElement is accessed but routed through Renderer2 on the same line',
    code: `class C { set(el) { this.renderer.setStyle(el.nativeElement, 'color', 'red'); } }`,
    filePath: 'a.component.ts', expectFire: false,
    rationale: '"renderer." appears on the same line as the nativeElement access, which the heuristic accepts as evidence of the safe Renderer2 API being used; correctly not flagged.',
  },
  {
    ruleId: 'FIGM-ANG-05', kind: 'adversarial',
    label: 'nativeElement.style is mutated directly with no Renderer2 in sight',
    code: `class C { set(el) { el.nativeElement.style.color = 'red'; } }`,
    filePath: 'a.component.ts', expectFire: true,
    rationale: 'Direct DOM mutation bypassing Angular\'s Renderer2 abstraction (XSS/SSR-safety concern); correctly flagged.',
  },
];

test('QA Matrix — boundary + adversarial coverage for all 25 rules', async (t) => {
  const seenRuleIds = new Set(CASES.map((c) => c.ruleId));
  await t.test('sanity: every one of the 25 rules has both a boundary and an adversarial case', () => {
    assert.equal(seenRuleIds.size, 25, `expected 25 distinct rule IDs, got ${seenRuleIds.size}: ${[...seenRuleIds].sort().join(', ')}`);
    const counts = new Map<string, number>();
    for (const c of CASES) counts.set(c.ruleId, (counts.get(c.ruleId) ?? 0) + 1);
    for (const [ruleId, count] of counts) {
      assert.equal(count, 2, `${ruleId} should have exactly 2 cases (boundary + adversarial), found ${count}`);
    }
  });

  for (const c of CASES) {
    await t.test(`[${c.ruleId}][${c.kind}] ${c.label}`, () => {
      const result = RuleExecutionEngine.analyzeFile(c.filePath, c.code);
      const fired = result.diagnostics.some((d) => d.ruleId === c.ruleId);
      assert.equal(
        fired,
        c.expectFire,
        `${c.ruleId} ${c.expectFire ? 'should' : 'should NOT'} have fired. ${c.rationale}\nActual diagnostics: ${result.diagnostics.map((d) => d.ruleId).join(', ') || '(none)'}`
      );
    });
  }
});
