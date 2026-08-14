'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export type RuleCategory = 'COMMON' | 'NEXTJS' | 'REACT' | 'ANGULAR';

interface FrameworkExample {
  framework: 'Next.js' | 'React' | 'Angular' | 'Common';
  tip: string;
}

interface GuidelineSpec {
  id: string;
  name: string;
  category: RuleCategory;
  domain: 'PERF' | 'A11Y';
  concern: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetConstruct: string;
  predicate: string;
  remediation: string;
  standard: string;
  frameworks: FrameworkExample[];
}

const CORE_GUIDELINES: GuidelineSpec[] = [
  // ================= COMMON CROSS-FRAMEWORK RULES =================
  {
    id: 'FIGM-PERF-01',
    name: 'Avoid Creating Objects Inside Loops',
    category: 'COMMON',
    domain: 'PERF',
    concern: 'Creating new objects inside loops causes high memory usage and slows down execution.',
    severity: 'CRITICAL',
    targetConstruct: 'For Loops / While Loops / Array Map Loops',
    predicate: 'Creating static objects inside a loop body',
    remediation: 'Move static objects outside the loop or reuse pre-created variables',
    standard: 'Core Web Vitals (Speed & Memory)',
    frameworks: [
      { framework: 'Next.js', tip: 'Hoist static configs outside Server & Client Component map functions' },
      { framework: 'React', tip: 'Move constant objects outside render loops or wrap with useMemo' },
      { framework: 'Angular', tip: 'Pre-allocate helper objects outside ngFor transform loops' },
    ],
  },
  {
    id: 'FIGM-PERF-02',
    name: 'Always Provide Image Width and Height',
    category: 'COMMON',
    domain: 'PERF',
    concern: 'Images without fixed dimensions cause web pages to jump around while loading (Cumulative Layout Shift).',
    severity: 'HIGH',
    targetConstruct: '<img> tags or Next.js <Image> components',
    predicate: 'Image tag missing explicit width, height, or CSS aspect-ratio',
    remediation: 'Add explicit width and height attributes (e.g. width="300" height="200")',
    standard: 'W3C CSS & Web Vitals Layout Standards',
    frameworks: [
      { framework: 'Next.js', tip: 'Use Next.js <Image src="..." width={500} height={300} alt="..." />' },
      { framework: 'React', tip: 'Always pass explicit width and height props to <img> JSX elements' },
      { framework: 'Angular', tip: 'Annotate <img> templates with width/height attributes or NgOptimizedImage' },
    ],
  },
  {
    id: 'FIGM-PERF-03',
    name: 'Clean Up Event Listeners When Unmounting',
    category: 'COMMON',
    domain: 'PERF',
    concern: 'Event listeners left active after a component closes accumulate in memory and cause memory leaks.',
    severity: 'CRITICAL',
    targetConstruct: 'addEventListener calls',
    predicate: 'Event listener added without a corresponding removeEventListener in component cleanup',
    remediation: 'Always call removeEventListener inside cleanup function (e.g. useEffect return)',
    standard: 'ECMAScript Event Cleanup Rules',
    frameworks: [
      { framework: 'Next.js', tip: 'Return cleanup function in useEffect: return () => window.removeEventListener(...)' },
      { framework: 'React', tip: 'Always pair addEventListener with removeEventListener in useEffect return' },
      { framework: 'Angular', tip: 'Detach subscriptions & listeners inside ngOnDestroy() lifecycle hook' },
    ],
  },
  {
    id: 'FIGM-PERF-04',
    name: 'Use Dynamic Imports for Heavy Modules',
    category: 'COMMON',
    domain: 'PERF',
    concern: 'Importing heavy libraries at the top of a file increases initial download bundle size and slows load time.',
    severity: 'MEDIUM',
    targetConstruct: 'Top-level import statements',
    predicate: 'Static top-level import of heavy module used only conditionally',
    remediation: 'Use dynamic import() or React.lazy() to load the module only when needed',
    standard: 'SPA Bundle Size Guidelines',
    frameworks: [
      { framework: 'Next.js', tip: 'Use next/dynamic: const Chart = dynamic(() => import("./Chart"))' },
      { framework: 'React', tip: 'Use React.lazy(() => import("./HeavyModule")) inside Suspense' },
      { framework: 'Angular', tip: 'Use lazy-loaded routes with loadComponent: () => import(...)`' },
    ],
  },
  {
    id: 'FIGM-PERF-05',
    name: 'Avoid Unbounded Inline Functions in Render Loops',
    category: 'COMMON',
    domain: 'PERF',
    concern: 'Instantiating new closure functions inside large map loops creates excessive Garbage Collection pressure.',
    severity: 'MEDIUM',
    targetConstruct: 'Render / Template Array Mapping',
    predicate: 'Inline arrow function instantiated inside map loop passed to interactive element',
    remediation: 'Bind handlers at component level or pass item ID to single delegate callback',
    standard: 'ECMAScript Engine Garbage Collection Optimization',
    frameworks: [
      { framework: 'Next.js', tip: 'Extract inline event handlers outside map loops into standalone callback functions' },
      { framework: 'React', tip: 'Use a single event handler function and pass item ID via data-id attribute' },
      { framework: 'Angular', tip: 'Call method with item ID: (click)="onSelectItem(item.id)" in ngFor template' },
    ],
  },
  {
    id: 'FIGM-PERF-06',
    name: 'Avoid Synchronous Storage Access in High-Frequency Loops',
    category: 'COMMON',
    domain: 'PERF',
    concern: 'Reading localStorage or sessionStorage synchronously inside animation loops causes CPU thread blocking.',
    severity: 'HIGH',
    targetConstruct: 'localStorage / sessionStorage Access',
    predicate: 'localStorage.getItem() invoked inside render loops or scroll/mousemove handlers',
    remediation: 'Cache storage values in component state or memory variables',
    standard: 'W3C Web Storage & Thread Responsiveness',
    frameworks: [
      { framework: 'Next.js', tip: 'Cache localStorage reads inside useEffect or state; do not query synchronously during render' },
      { framework: 'React', tip: 'Read localStorage once on component mount inside useState initializer function' },
      { framework: 'Angular', tip: 'Inject an in-memory StorageService to cache synchronous localStorage reads' },
    ],
  },
  {
    id: 'FIGM-A11Y-01',
    name: 'Add Keyboard Listeners to Clickable Elements',
    category: 'COMMON',
    domain: 'A11Y',
    concern: 'Clickable <div> or <span> elements without keyboard handlers block users who navigate using the Tab key.',
    severity: 'CRITICAL',
    targetConstruct: '<div> or <span> with onClick handler',
    predicate: 'Click listener attached to non-interactive element lacking keyboard event listener',
    remediation: 'Use a native <button> tag or add tabIndex={0} and onKeyDown handler',
    standard: 'WCAG 2.1 Success Criterion 2.1.1 (Keyboard)',
    frameworks: [
      { framework: 'Next.js', tip: 'Use native <button> or add onKeyDown={(e) => e.key === "Enter" && handle()}' },
      { framework: 'React', tip: 'Pair onClick with onKeyDown or replace clickable <div> with <button>' },
      { framework: 'Angular', tip: 'Bind (keyup.enter)="onSearch()" alongside (click)="onSearch()"' },
    ],
  },
  {
    id: 'FIGM-A11Y-02',
    name: 'Add ARIA Roles and Labels to Custom Controls',
    category: 'COMMON',
    domain: 'A11Y',
    concern: 'Custom buttons or tabs without ARIA roles cannot be announced properly by screen readers.',
    severity: 'HIGH',
    targetConstruct: 'Custom interactive UI elements',
    predicate: 'Custom clickable control lacking role and aria-label attributes',
    remediation: 'Add role="button" and an explicit aria-label description',
    standard: 'WCAG 2.1 ARIA 1.2 Standards',
    frameworks: [
      { framework: 'Next.js', tip: 'Pass role="button" and aria-label="Open menu" to custom components' },
      { framework: 'React', tip: 'Add role="button" tabIndex={0} aria-label="..." props to custom div controls' },
      { framework: 'Angular', tip: 'Add [attr.role]="\'button\'" and [attr.aria-label]="\'Search\'" attributes' },
    ],
  },
  {
    id: 'FIGM-A11Y-05',
    name: 'Ensure Form Inputs Have Associated Labels',
    category: 'COMMON',
    domain: 'A11Y',
    concern: 'Text inputs, checkboxes, and selects without associated labels cannot be identified by screen reader users.',
    severity: 'HIGH',
    targetConstruct: '<input>, <select>, or <textarea> elements',
    predicate: 'Form control lacking matching <label htmlFor="..."> or aria-label attribute',
    remediation: 'Provide a <label htmlFor="id"> element or add an aria-label attribute',
    standard: 'WCAG 2.1 Success Criterion 1.3.1 (Info and Relationships)',
    frameworks: [
      { framework: 'Next.js', tip: 'Always associate <label htmlFor="email"> with <input id="email" />' },
      { framework: 'React', tip: 'Use htmlFor in JSX: <label htmlFor="user">Name</label><input id="user" />' },
      { framework: 'Angular', tip: 'Associate <label for="search"> with <input id="search"> in templates' },
    ],
  },
  {
    id: 'FIGM-A11Y-06',
    name: 'Avoid Positive Tabindex Values (>0)',
    category: 'COMMON',
    domain: 'A11Y',
    concern: 'Setting tabIndex values greater than 0 creates an unpredictable keyboard tab navigation order.',
    severity: 'MEDIUM',
    targetConstruct: 'HTML / JSX Elements with tabIndex attribute',
    predicate: 'Element with tabIndex > 0 (e.g. tabIndex={1})',
    remediation: 'Use tabIndex={0} for focusable controls or tabIndex={-1} for programmatically focused elements',
    standard: 'WCAG 2.1 Success Criterion 2.4.3 (Focus Order)',
    frameworks: [
      { framework: 'Next.js', tip: 'Never use tabIndex={1}. Rely on natural DOM order or tabIndex={0}' },
      { framework: 'React', tip: 'Replace positive tabIndex values with natural DOM element placement' },
      { framework: 'Angular', tip: 'Avoid [tabIndex]="1" in component templates; use standard DOM tab flow' },
    ],
  },

  // ================= NEXT.JS SPECIFIC RULES =================
  {
    id: 'FIGM-NEXT-01',
    name: 'Isolate Client State Hooks Behind "use client"',
    category: 'NEXTJS',
    domain: 'PERF',
    concern: 'Using useState, useEffect, or browser APIs inside Server Components triggers build errors in Next.js.',
    severity: 'HIGH',
    targetConstruct: 'Next.js App Router Server Component',
    predicate: 'useState / useEffect / window reference inside server page without "use client" directive',
    remediation: 'Add "use client"; directive at the top of interactive component files',
    standard: 'Next.js App Router Architecture Specification',
    frameworks: [
      { framework: 'Next.js', tip: 'Place "use client" directive on the first line of client-side interactive component files' },
    ],
  },
  {
    id: 'FIGM-NEXT-02',
    name: 'Disable SSR for Heavy Browser-Only Components',
    category: 'NEXTJS',
    domain: 'PERF',
    concern: 'Rendering browser-only packages (e.g. Monaco Editor, Canvas) during server rendering causes hydration mismatches.',
    severity: 'MEDIUM',
    targetConstruct: 'next/dynamic import call',
    predicate: 'Browser-only component imported statically without { ssr: false }',
    remediation: 'Use dynamic(() => import("./Editor"), { ssr: false }) for client-only UI widgets',
    standard: 'Next.js Hydration & SSR Optimization',
    frameworks: [
      { framework: 'Next.js', tip: 'Pass { ssr: false } to dynamic import when rendering browser-only canvas or editor components' },
    ],
  },
  {
    id: 'FIGM-NEXT-03',
    name: 'Configure Explicit Route Segment Caching',
    category: 'NEXTJS',
    domain: 'PERF',
    concern: 'Missing explicit revalidation rules in App Router pages can lead to stale cached static content.',
    severity: 'MEDIUM',
    targetConstruct: 'Next.js Route Segment Config',
    predicate: 'Dynamic data route missing export const revalidate or export const dynamic declaration',
    remediation: 'Declare export const revalidate = 60 or export const dynamic = "force-dynamic"',
    standard: 'Next.js Route Segment Caching Protocol',
    frameworks: [
      { framework: 'Next.js', tip: 'Add export const revalidate = 60 to specify data refresh intervals' },
    ],
  },
  {
    id: 'FIGM-NEXT-04',
    name: 'Use next/font for Zero-Layout-Shift Web Fonts',
    category: 'NEXTJS',
    domain: 'PERF',
    concern: 'Loading external web fonts via standard <link> tags causes text invisible flash (FOIT) and layout shifts.',
    severity: 'MEDIUM',
    targetConstruct: 'Next.js App Layout / Font Import',
    predicate: 'External font loaded via raw HTML link tag instead of next/font/google',
    remediation: 'Import fonts using import { Inter } from "next/font/google"',
    standard: 'Next.js Zero-CLS Font Loading Standard',
    frameworks: [
      { framework: 'Next.js', tip: 'Use next/font/google to automatically optimize and inline font CSS files' },
    ],
  },

  // ================= REACT SPECIFIC RULES =================
  {
    id: 'FIGM-REACT-01',
    name: 'Memoize Expensive Derived State with useMemo',
    category: 'REACT',
    domain: 'PERF',
    concern: 'Re-running complex array filtering or sorting on every single render slows UI response time.',
    severity: 'MEDIUM',
    targetConstruct: 'React Component Functional Body',
    predicate: 'Complex array operation executed inside functional component without useMemo wrapper',
    remediation: 'Wrap heavy computation in const data = useMemo(() => compute(), [deps])',
    standard: 'React Performance Optimization Guidelines',
    frameworks: [
      { framework: 'React', tip: 'Use useMemo to cache expensive list sorting and filtering operations' },
    ],
  },
  {
    id: 'FIGM-REACT-02',
    name: 'Avoid Array Index as Stable Key Prop',
    category: 'REACT',
    domain: 'PERF',
    concern: 'Using array index as key when list order changes causes unexpected component state bugs and re-renders.',
    severity: 'MEDIUM',
    targetConstruct: 'JSX Array Map Expression',
    predicate: 'map((item, index) => <Component key={index} />) where list is dynamic',
    remediation: 'Use unique item IDs for key props (e.g. key={item.id})',
    standard: 'React Reconciliation Algorithm Specification',
    frameworks: [
      { framework: 'React', tip: 'Always pass a unique model identifier like item.id as the key prop in map loops' },
    ],
  },
  {
    id: 'FIGM-REACT-03',
    name: 'Avoid Direct React State Mutation',
    category: 'REACT',
    domain: 'PERF',
    concern: 'Mutating state objects directly (e.g. state.user.name = "X") bypasses React re-render triggers and creates subtle UI bugs.',
    severity: 'CRITICAL',
    targetConstruct: 'React useState Setter Call',
    predicate: 'Direct property assignment on state variable prior to setState call',
    remediation: 'Always pass a new object copy (e.g. setUser(prev => ({ ...prev, name: "X" })))',
    standard: 'React State Immutability Architecture',
    frameworks: [
      { framework: 'React', tip: 'Treat React state as immutable; use object spread ({ ...state, field: val })' },
    ],
  },
  {
    id: 'FIGM-REACT-04',
    name: 'Wrap Child Callback Props in useCallback',
    category: 'REACT',
    domain: 'PERF',
    concern: 'Passing inline functions to memoized child components causes child re-renders on every parent render.',
    severity: 'MEDIUM',
    targetConstruct: 'React Event Callback Prop',
    predicate: 'Unmemoized inline callback passed as prop to React.memo child component',
    remediation: 'Wrap callback handler in const handle = useCallback(() => {}, [deps])',
    standard: 'React Child Re-render Minimization',
    frameworks: [
      { framework: 'React', tip: 'Use useCallback for functions passed as props to React.memo child components' },
    ],
  },

  // ================= ANGULAR SPECIFIC RULES =================
  {
    id: 'FIGM-ANG-01',
    name: 'Unsubscribe RxJS Observables in Component Teardown',
    category: 'ANGULAR',
    domain: 'PERF',
    concern: 'Active RxJS subscriptions retained after component destruction create permanent memory leaks.',
    severity: 'CRITICAL',
    targetConstruct: 'Angular Component Class Body',
    predicate: 'Observable.subscribe() called without takeUntilDestroyed() or unsubscribe() in ngOnDestroy',
    remediation: 'Use takeUntilDestroyed() operator or store Subscription and call .unsubscribe() in ngOnDestroy()',
    standard: 'Angular RxJS Memory Management Rules',
    frameworks: [
      { framework: 'Angular', tip: 'Use inject(DestroyRef) with takeUntilDestroyed() or call subscription.unsubscribe() in ngOnDestroy()' },
    ],
  },
  {
    id: 'FIGM-ANG-02',
    name: 'Use OnPush Change Detection Strategy',
    category: 'ANGULAR',
    domain: 'PERF',
    concern: 'Default change detection checks every component on every DOM event, causing CPU lag on large applications.',
    severity: 'MEDIUM',
    targetConstruct: '@Component Decorator Metadata',
    predicate: 'Component lacking changeDetection property in decorator',
    remediation: 'Set changeDetection: ChangeDetectionStrategy.OnPush in component decorator metadata',
    standard: 'Angular Core Change Detection Optimization',
    frameworks: [
      { framework: 'Angular', tip: 'Add changeDetection: ChangeDetectionStrategy.OnPush to component decorators' },
    ],
  },
  {
    id: 'FIGM-ANG-03',
    name: 'Use trackBy Function in ngFor Directives',
    category: 'ANGULAR',
    domain: 'PERF',
    concern: 'Using *ngFor without a trackBy function causes Angular to tear down and recreate all DOM elements when items change.',
    severity: 'HIGH',
    targetConstruct: 'Angular Template *ngFor Directive',
    predicate: '*ngFor directive missing trackBy: trackById reference',
    remediation: 'Provide a trackBy function in component class (e.g. trackById(index, item) { return item.id; })',
    standard: 'Angular Template DOM Reuse Architecture',
    frameworks: [
      { framework: 'Angular', tip: 'Add trackBy: trackById to *ngFor="let item of items; trackBy: trackById"' },
    ],
  },
  {
    id: 'FIGM-ANG-04',
    name: 'Avoid Executing Heavy Functions Directly in HTML Templates',
    category: 'ANGULAR',
    domain: 'PERF',
    concern: 'Invoking methods inside template interpolations {{ computeTotal(item) }} forces function re-execution on every change detection pass.',
    severity: 'HIGH',
    targetConstruct: 'Angular Template Interpolation {{ }}',
    predicate: 'Function execution expression inside template interpolation {{ fn() }}',
    remediation: 'Pre-compute values inside component TS file or use a pure Pipe',
    standard: 'Angular Template Binding Performance',
    frameworks: [
      { framework: 'Angular', tip: 'Pre-compute values in component state or create a @Pipe({ name: "compute", pure: true })' },
    ],
  },
  {
    id: 'FIGM-ANG-05',
    name: 'Avoid Direct ElementRef NativeElement DOM Mutations',
    category: 'ANGULAR',
    domain: 'PERF',
    concern: 'Bypassing Angular Renderer2 or Signals with direct elementRef.nativeElement mutations creates SSR security & hydration risks.',
    severity: 'HIGH',
    targetConstruct: 'Angular Direct DOM Manipulation',
    predicate: 'elementRef.nativeElement.style or elementRef.nativeElement.innerHTML assignment',
    remediation: 'Use Angular Renderer2 (renderer.setStyle) or property bindings [style.color]="..."',
    standard: 'Angular Security & SSR Abstraction Guidelines',
    frameworks: [
      { framework: 'Angular', tip: 'Use Renderer2.setStyle() or [ngStyle] property bindings instead of direct nativeElement mutation' },
    ],
  },
];

export default function GuidelinesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filterRules = (category: string) => {
    return CORE_GUIDELINES.filter((g) => {
      if (category !== 'ALL' && g.category !== category) return false;
      if (selectedDomain !== 'ALL' && g.domain !== selectedDomain) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = g.id.toLowerCase().includes(q);
        const matchName = g.name.toLowerCase().includes(q);
        const matchConcern = g.concern.toLowerCase().includes(q);
        const matchConstruct = g.targetConstruct.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchConcern && !matchConstruct) return false;
      }
      return true;
    });
  };

  const commonRules = filterRules('COMMON');
  const nextRules = filterRules('NEXTJS');
  const reactRules = filterRules('REACT');
  const angularRules = filterRules('ANGULAR');

  const totalDisplayed =
    (selectedCategory === 'ALL' || selectedCategory === 'COMMON' ? commonRules.length : 0) +
    (selectedCategory === 'ALL' || selectedCategory === 'NEXTJS' ? nextRules.length : 0) +
    (selectedCategory === 'ALL' || selectedCategory === 'REACT' ? reactRules.length : 0) +
    (selectedCategory === 'ALL' || selectedCategory === 'ANGULAR' ? angularRules.length : 0);

  const renderRuleCard = (rule: GuidelineSpec) => (
    <div
      key={rule.id}
      id={rule.id}
      className="glass-panel"
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '18px',
        scrollMarginTop: '80px',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge badge-domain">{rule.id}</span>
            <span className={`badge badge-${rule.severity.toLowerCase()}`}>{rule.severity}</span>
          </div>

          {/* Category Badge */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {rule.category === 'COMMON' && (
              <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 700 }}>
                🌐 Cross-Framework Common
              </span>
            )}
            {rule.category === 'NEXTJS' && (
              <span style={{ fontSize: '11px', background: '#000000', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #334155', fontWeight: 700 }}>
                ▲ Next.js Specific
              </span>
            )}
            {rule.category === 'REACT' && (
              <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.4)', fontWeight: 700 }}>
                ⚛️ React Specific
              </span>
            )}
            {rule.category === 'ANGULAR' && (
              <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}>
                🅰️ Angular Specific
              </span>
            )}
          </div>
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
          {rule.name}
        </h2>

        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.5 }}>
          <strong style={{ color: '#cbd5e1' }}>Why it matters:</strong> {rule.concern}
        </div>

        {/* Target Construct Box */}
        <div
          style={{
            background: '#090d16',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono',
            color: '#38bdf8',
            marginBottom: '14px',
            border: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div>
            <span style={{ color: '#7c8ba6' }}>Target Code Element: </span>
            <span style={{ color: '#f8fafc' }}>{rule.targetConstruct}</span>
          </div>
          <div>
            <span style={{ color: '#7c8ba6' }}>What is checked: </span>
            <span style={{ color: '#cbd5e1' }}>{rule.predicate}</span>
          </div>
        </div>

        {/* Framework Specific Implementation Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#7c8ba6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
            Implementation Guidance:
          </div>
          {rule.frameworks.map((fw, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: fw.framework === 'Next.js' ? 'rgba(255, 255, 255, 0.04)' : fw.framework === 'React' ? 'rgba(56, 189, 248, 0.06)' : fw.framework === 'Angular' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)',
                border: '1px solid var(--border)',
                color: '#cbd5e1',
              }}
            >
              <strong style={{ color: fw.framework === 'Next.js' ? '#ffffff' : fw.framework === 'React' ? '#38bdf8' : fw.framework === 'Angular' ? '#ef4444' : '#22c55e' }}>
                [{fw.framework}]
              </strong>{' '}
              {fw.tip}
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', color: '#86efac', background: 'rgba(34, 197, 94, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          💡 <strong>How to Fix:</strong> {rule.remediation}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#7c8ba6' }}>
            Standard: {rule.standard}
          </span>
          <Link
            href="/live-scan"
            style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
          >
            Test in Inspector &rarr;
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.4px' }}>
            📚 Code Quality Rule Book ({CORE_GUIDELINES.length} Guidelines)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            Explore universal common guidelines alongside framework-specific rules for <strong>Next.js</strong>, <strong>React</strong>, and <strong>Angular</strong>.
          </p>
        </div>

        <div style={{ fontSize: '13px', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.6)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          Showing <strong>{totalDisplayed}</strong> of {CORE_GUIDELINES.length} Rules
        </div>
      </div>

      {/* Framework Filter Buttons */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Filter Rules by Framework Category:
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: `🌐 All Guidelines (${CORE_GUIDELINES.length})`, color: '#f8fafc' },
            { key: 'COMMON', label: `🌐 Common Rules (${commonRules.length})`, color: '#38bdf8' },
            { key: 'NEXTJS', label: `▲ Next.js Rules (${nextRules.length})`, color: '#ffffff' },
            { key: 'REACT', label: `⚛️ React Rules (${reactRules.length})`, color: '#38bdf8' },
            { key: 'ANGULAR', label: `🅰️ Angular Rules (${angularRules.length})`, color: '#ef4444' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedCategory(item.key)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: selectedCategory === item.key ? `1px solid ${item.color}` : '1px solid var(--border)',
                background: selectedCategory === item.key ? 'rgba(56, 189, 248, 0.15)' : 'rgba(9, 13, 22, 0.6)',
                color: selectedCategory === item.key ? item.color : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Domain Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search rules by framework, keyword, element, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ width: '100%', paddingLeft: '34px' }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7c8ba6' }}>🔍</span>
        </div>

        {/* Domain Filter Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'ALL', label: 'All Concerns' },
            { key: 'PERF', label: '⚡ Speed & Performance' },
            { key: 'A11Y', label: '♿ Accessibility' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedDomain(item.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedDomain === item.key ? '1px solid #38bdf8' : '1px solid var(--border)',
                background: selectedDomain === item.key ? 'rgba(56, 189, 248, 0.15)' : 'rgba(9, 13, 22, 0.6)',
                color: selectedDomain === item.key ? '#38bdf8' : '#94a3b8',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Common Cross-Framework Rules */}
      {(selectedCategory === 'ALL' || selectedCategory === 'COMMON') && commonRules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
            <span style={{ fontSize: '22px' }}>🌐</span>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>
                Universal Common Rules ({commonRules.length} Guidelines)
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Core web quality rules that apply universally across Next.js, React, and Angular single page applications.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {commonRules.map(renderRuleCard)}
          </div>
        </div>
      )}

      {/* Section 2: Next.js Specific Rules */}
      {(selectedCategory === 'ALL' || selectedCategory === 'NEXTJS') && nextRules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
            <span style={{ fontSize: '22px' }}>▲</span>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Next.js Specific Guidelines ({nextRules.length} Guidelines)
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Rules dedicated to Next.js App Router, Server Components, SSR hydration, font optimization, and route segment caching.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {nextRules.map(renderRuleCard)}
          </div>
        </div>
      )}

      {/* Section 3: React Specific Rules */}
      {(selectedCategory === 'ALL' || selectedCategory === 'REACT') && reactRules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
            <span style={{ fontSize: '22px' }}>⚛️</span>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>
                React Specific Guidelines ({reactRules.length} Guidelines)
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Rules dedicated to React state immutability, key props, useCallback wrappers, reconciliation performance, and useMemo.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {reactRules.map(renderRuleCard)}
          </div>
        </div>
      )}

      {/* Section 4: Angular Specific Rules */}
      {(selectedCategory === 'ALL' || selectedCategory === 'ANGULAR') && angularRules.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
            <span style={{ fontSize: '22px' }}>🅰️</span>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>
                Angular Specific Guidelines ({angularRules.length} Guidelines)
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Rules dedicated to Angular ChangeDetection Strategy, Renderer2 DOM safety, trackBy DOM reuse, template function calls, and RxJS subscriptions.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {angularRules.map(renderRuleCard)}
          </div>
        </div>
      )}
    </div>
  );
}
