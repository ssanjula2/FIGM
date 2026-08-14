'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RULE_CATALOG, FRAMEWORK_LABELS, SUPPORTED_FRAMEWORKS, RuleCatalogEntry } from '../../src/matrix/rule-registry';
import type { FrameworkType } from '../../src/types/ast-spec';

/**
 * Rule existence, severity, category, frameworks, description, examples, remediation status, and
 * known limitations all come live from RULE_CATALOG (src/matrix/rule-registry.ts), which is
 * derived from the same FOUR_LAYER_MAPPINGS the detection engine itself reads -- this page cannot
 * drift out of sync with the engine on those fields. What remains hand-authored below is purely
 * supplementary teaching content (the "why it matters" prose and per-framework implementation
 * tips) that has no equivalent in the engine's data model; tests/rule-catalog-consistency.test.ts
 * asserts every one of the 25 canonical rule IDs has an entry here.
 */
interface FrameworkTip {
  framework: 'Next.js' | 'React' | 'Angular' | 'Vue' | 'JS/TS';
  tip: string;
}

interface RuleUiContent {
  concern: string;
  targetConstruct: string;
  predicate: string;
  standard: string;
  tips: FrameworkTip[];
}

const RULE_UI_CONTENT: Record<string, RuleUiContent> = {
  'FIGM-PERF-01': {
    concern: 'Creating new objects inside loops causes high memory usage and slows down execution.',
    targetConstruct: 'For Loops / While Loops / Array Map Loops',
    predicate: 'Creating static objects inside a loop body',
    standard: 'Core Web Vitals (Speed & Memory)',
    tips: [
      { framework: 'Next.js', tip: 'Hoist static configs outside Server & Client Component map functions' },
      { framework: 'React', tip: 'Move constant objects outside render loops or wrap with useMemo' },
      { framework: 'Angular', tip: 'Pre-allocate helper objects outside ngFor transform loops' },
      { framework: 'Vue', tip: 'Hoist static objects out of v-for render functions or computed properties' },
    ],
  },
  'FIGM-PERF-02': {
    concern: 'Images without fixed dimensions cause web pages to jump around while loading (Cumulative Layout Shift).',
    targetConstruct: '<img> tags or Next.js <Image> components',
    predicate: 'Image tag missing explicit width, height, or CSS aspect-ratio',
    standard: 'W3C CSS & Web Vitals Layout Standards',
    tips: [
      { framework: 'Next.js', tip: 'Use Next.js <Image src="..." width={500} height={300} alt="..." />' },
      { framework: 'React', tip: 'Always pass explicit width and height props to <img> JSX elements' },
      { framework: 'Angular', tip: 'Annotate <img> templates with width/height attributes or NgOptimizedImage' },
      { framework: 'Vue', tip: 'Set explicit width/height (or CSS aspect-ratio) on <img> tags in templates' },
    ],
  },
  'FIGM-PERF-03': {
    concern: 'Event listeners left active after a component closes accumulate in memory and cause memory leaks.',
    targetConstruct: 'addEventListener calls',
    predicate: 'Event listener added without a corresponding removeEventListener in component cleanup',
    standard: 'ECMAScript Event Cleanup Rules',
    tips: [
      { framework: 'Next.js', tip: 'Return cleanup function in useEffect: return () => window.removeEventListener(...)' },
      { framework: 'React', tip: 'Always pair addEventListener with removeEventListener in useEffect return' },
      { framework: 'Angular', tip: 'Detach subscriptions & listeners inside ngOnDestroy() lifecycle hook' },
      { framework: 'Vue', tip: 'Remove listeners in onBeforeUnmount()/onUnmounted() to match onMounted() registration' },
    ],
  },
  'FIGM-PERF-04': {
    concern: 'Importing heavy libraries at the top of a file increases initial download bundle size and slows load time.',
    targetConstruct: 'Top-level import statements',
    predicate: 'Static top-level import of heavy module used only conditionally',
    standard: 'SPA Bundle Size Guidelines',
    tips: [
      { framework: 'Next.js', tip: 'Use next/dynamic: const Chart = dynamic(() => import("./Chart"))' },
      { framework: 'React', tip: 'Use React.lazy(() => import("./HeavyModule")) inside Suspense' },
      { framework: 'Angular', tip: 'Use lazy-loaded routes with loadComponent: () => import(...)' },
      { framework: 'Vue', tip: 'Use defineAsyncComponent(() => import("./Heavy.vue")) for conditional modules' },
    ],
  },
  'FIGM-PERF-05': {
    concern: 'Instantiating new closure functions inside large map loops creates excessive Garbage Collection pressure.',
    targetConstruct: 'Render / Template Array Mapping',
    predicate: 'Inline arrow function instantiated inside map loop passed to interactive element',
    standard: 'ECMAScript Engine Garbage Collection Optimization',
    tips: [
      { framework: 'Next.js', tip: 'Extract inline event handlers outside map loops into standalone callback functions' },
      { framework: 'React', tip: 'Use a single event handler function and pass item ID via data-id attribute' },
      { framework: 'Angular', tip: 'Call method with item ID: (click)="onSelectItem(item.id)" in ngFor template' },
      { framework: 'Vue', tip: 'Bind @click="onSelectItem(item.id)" instead of an inline arrow inside v-for' },
    ],
  },
  'FIGM-PERF-06': {
    concern: 'Reading localStorage or sessionStorage synchronously inside animation loops causes CPU thread blocking.',
    targetConstruct: 'localStorage / sessionStorage Access',
    predicate: 'localStorage.getItem() invoked inside render loops or scroll/mousemove handlers',
    standard: 'W3C Web Storage & Thread Responsiveness',
    tips: [
      { framework: 'Next.js', tip: 'Cache localStorage reads inside useEffect or state; do not query synchronously during render' },
      { framework: 'React', tip: 'Read localStorage once on component mount inside useState initializer function' },
      { framework: 'Angular', tip: 'Inject an in-memory StorageService to cache synchronous localStorage reads' },
      { framework: 'Vue', tip: 'Read storage once in onMounted() and cache the value in a ref, not inside v-for' },
    ],
  },
  'FIGM-A11Y-01': {
    concern: 'Clickable <div> or <span> elements without keyboard handlers block users who navigate using the Tab key.',
    targetConstruct: '<div> or <span> with onClick handler',
    predicate: 'Click listener attached to non-interactive element lacking keyboard event listener',
    standard: 'WCAG 2.2 Success Criterion 2.1.1 (Keyboard)',
    tips: [
      { framework: 'Next.js', tip: 'Use native <button> or add onKeyDown={(e) => e.key === "Enter" && handle()}' },
      { framework: 'React', tip: 'Pair onClick with onKeyDown or replace clickable <div> with <button>' },
      { framework: 'Angular', tip: 'Bind (keyup.enter)="onSearch()" alongside (click)="onSearch()"' },
      { framework: 'Vue', tip: 'Pair @click with @keydown.enter, or use a native <button> instead of a <div>' },
    ],
  },
  'FIGM-A11Y-02': {
    concern: 'Custom buttons or tabs without ARIA roles cannot be announced properly by screen readers.',
    targetConstruct: 'Custom interactive UI elements',
    predicate: 'Custom clickable control lacking role and aria-label attributes',
    standard: 'WCAG 2.2 ARIA 1.2 Standards',
    tips: [
      { framework: 'Next.js', tip: 'Pass role="button" and aria-label="Open menu" to custom components' },
      { framework: 'React', tip: 'Add role="button" tabIndex={0} aria-label="..." props to custom div controls' },
      { framework: 'Angular', tip: 'Add [attr.role]="\'button\'" and [attr.aria-label]="\'Search\'" attributes' },
      { framework: 'Vue', tip: 'Add role="button" :aria-label="label" to custom interactive template elements' },
    ],
  },
  'FIGM-A11Y-03': {
    concern: 'Search results, form submission outcomes, and other dynamically updated status text are invisible to screen reader users unless the container is marked as a live region.',
    targetConstruct: 'Dynamic status/result containers',
    predicate: 'Container populated with asynchronous status text lacking aria-live or role="status"/"alert"',
    standard: 'WCAG 2.2 Success Criterion 4.1.3 (Status Messages)',
    tips: [
      { framework: 'Next.js', tip: 'Add role="status" (or aria-live="polite") to containers showing scan/fetch results' },
      { framework: 'React', tip: 'Wrap dynamic result/loading text in a <div role="status"> so updates are announced' },
      { framework: 'Angular', tip: 'Add [attr.role]="\'status\'" to template elements bound to async pipe results' },
      { framework: 'Vue', tip: 'Add role="status" to elements whose text updates from reactive state' },
    ],
  },
  'FIGM-A11Y-04': {
    concern: 'When a modal or overlay opens without trapping focus, keyboard and screen reader users can tab behind it into hidden page content; when it closes without restoring focus, they lose their place entirely.',
    targetConstruct: 'Modal / Dialog / Overlay components',
    predicate: 'Overlay component missing a focus-trap and focus-restoration handler on close',
    standard: 'WCAG 2.2 Success Criterion 2.4.3 (Focus Order)',
    tips: [
      { framework: 'Next.js', tip: 'Trap Tab/Shift+Tab inside the open modal; call triggerRef.current?.focus() on close' },
      { framework: 'React', tip: 'Use a focus-trap effect keyed on isOpen and restore focus to the trigger on unmount' },
      { framework: 'Angular', tip: 'Use cdkTrapFocus (Angular CDK) and restore focus to the trigger element on close' },
      { framework: 'Vue', tip: 'Trap focus within the open dialog and call triggerEl.value?.focus() when it closes' },
    ],
  },
  'FIGM-A11Y-05': {
    concern: 'Text inputs, checkboxes, and selects without associated labels cannot be identified by screen reader users.',
    targetConstruct: '<input>, <select>, or <textarea> elements',
    predicate: 'Form control lacking matching <label htmlFor="..."> or aria-label attribute',
    standard: 'WCAG 2.2 Success Criterion 1.3.1 (Info and Relationships)',
    tips: [
      { framework: 'Next.js', tip: 'Always associate <label htmlFor="email"> with <input id="email" />' },
      { framework: 'React', tip: 'Use htmlFor in JSX: <label htmlFor="user">Name</label><input id="user" />' },
      { framework: 'Angular', tip: 'Associate <label for="search"> with <input id="search"> in templates' },
      { framework: 'Vue', tip: 'Associate <label for="search"> with <input id="search"> in templates' },
    ],
  },
  'FIGM-A11Y-06': {
    concern: 'Setting tabIndex values greater than 0 creates an unpredictable keyboard tab navigation order.',
    targetConstruct: 'HTML / JSX Elements with tabIndex attribute',
    predicate: 'Element with tabIndex > 0 (e.g. tabIndex={1})',
    standard: 'WCAG 2.2 Success Criterion 2.4.3 (Focus Order)',
    tips: [
      { framework: 'Next.js', tip: 'Never use tabIndex={1}. Rely on natural DOM order or tabIndex={0}' },
      { framework: 'React', tip: 'Replace positive tabIndex values with natural DOM element placement' },
      { framework: 'Angular', tip: 'Avoid [tabIndex]="1" in component templates; use standard DOM tab flow' },
      { framework: 'Vue', tip: 'Avoid :tabindex="1" in templates; rely on natural DOM order or tabindex="0"' },
    ],
  },
  'FIGM-NEXT-01': {
    concern: 'Using useState, useEffect, or browser APIs inside Server Components triggers build errors in Next.js.',
    targetConstruct: 'Next.js App Router Server Component',
    predicate: 'useState / useEffect / window reference inside server page without "use client" directive',
    standard: 'Next.js App Router Architecture Specification',
    tips: [{ framework: 'Next.js', tip: 'Place "use client" directive on the first line of client-side interactive component files' }],
  },
  'FIGM-NEXT-02': {
    concern: 'Rendering browser-only packages (e.g. Monaco Editor, Canvas) during server rendering causes hydration mismatches.',
    targetConstruct: 'next/dynamic import call',
    predicate: 'Browser-only component imported statically without { ssr: false }',
    standard: 'Next.js Hydration & SSR Optimization',
    tips: [{ framework: 'Next.js', tip: 'Pass { ssr: false } to dynamic import when rendering browser-only canvas or editor components' }],
  },
  'FIGM-NEXT-03': {
    concern: 'Missing explicit revalidation rules in App Router pages can lead to stale cached static content.',
    targetConstruct: 'Next.js Route Segment Config',
    predicate: 'Dynamic data route missing export const revalidate or export const dynamic declaration',
    standard: 'Next.js Route Segment Caching Protocol',
    tips: [{ framework: 'Next.js', tip: 'Add export const revalidate = 60 to specify data refresh intervals' }],
  },
  'FIGM-NEXT-04': {
    concern: 'Loading external web fonts via standard <link> tags causes text invisible flash (FOIT) and layout shifts.',
    targetConstruct: 'Next.js App Layout / Font Import',
    predicate: 'External font loaded via raw HTML link tag instead of next/font/google',
    standard: 'Next.js Zero-CLS Font Loading Standard',
    tips: [{ framework: 'Next.js', tip: 'Use next/font/google to automatically optimize and inline font CSS files' }],
  },
  'FIGM-REACT-01': {
    concern: 'Re-running complex array filtering or sorting on every single render slows UI response time.',
    targetConstruct: 'React Component Functional Body',
    predicate: 'Complex array operation executed inside functional component without useMemo wrapper',
    standard: 'React Performance Optimization Guidelines',
    tips: [{ framework: 'React', tip: 'Use useMemo to cache expensive list sorting and filtering operations' }],
  },
  'FIGM-REACT-02': {
    concern: 'Using array index as key when list order changes causes unexpected component state bugs and re-renders.',
    targetConstruct: 'JSX Array Map Expression',
    predicate: 'map((item, index) => <Component key={index} />) where list is dynamic',
    standard: 'React Reconciliation Algorithm Specification',
    tips: [{ framework: 'React', tip: 'Always pass a unique model identifier like item.id as the key prop in map loops' }],
  },
  'FIGM-REACT-03': {
    concern: 'Mutating state objects directly (e.g. state.user.name = "X") bypasses React re-render triggers and creates subtle UI bugs.',
    targetConstruct: 'React useState Setter Call',
    predicate: 'Direct property assignment on state variable prior to setState call',
    standard: 'React State Immutability Architecture',
    tips: [{ framework: 'React', tip: 'Treat React state as immutable; use object spread ({ ...state, field: val })' }],
  },
  'FIGM-REACT-04': {
    concern: 'Passing inline functions to memoized child components causes child re-renders on every parent render.',
    targetConstruct: 'React Event Callback Prop',
    predicate: 'Unmemoized inline callback passed as prop to React.memo child component',
    standard: 'React Child Re-render Minimization',
    tips: [{ framework: 'React', tip: 'Use useCallback for functions passed as props to React.memo child components' }],
  },
  'FIGM-ANG-01': {
    concern: 'Active RxJS subscriptions retained after component destruction create permanent memory leaks.',
    targetConstruct: 'Angular Component Class Body',
    predicate: 'Observable.subscribe() called without takeUntilDestroyed() or unsubscribe() in ngOnDestroy',
    standard: 'Angular RxJS Memory Management Rules',
    tips: [{ framework: 'Angular', tip: 'Use inject(DestroyRef) with takeUntilDestroyed() or call subscription.unsubscribe() in ngOnDestroy()' }],
  },
  'FIGM-ANG-02': {
    concern: 'Default change detection checks every component on every DOM event, causing CPU lag on large applications.',
    targetConstruct: '@Component Decorator Metadata',
    predicate: 'Component lacking changeDetection property in decorator',
    standard: 'Angular Core Change Detection Optimization',
    tips: [{ framework: 'Angular', tip: 'Add changeDetection: ChangeDetectionStrategy.OnPush to component decorators' }],
  },
  'FIGM-ANG-03': {
    concern: 'Using *ngFor without a trackBy function causes Angular to tear down and recreate all DOM elements when items change.',
    targetConstruct: 'Angular Template *ngFor Directive',
    predicate: '*ngFor directive missing trackBy: trackById reference',
    standard: 'Angular Template DOM Reuse Architecture',
    tips: [{ framework: 'Angular', tip: 'Add trackBy: trackById to *ngFor="let item of items; trackBy: trackById"' }],
  },
  'FIGM-ANG-04': {
    concern: 'Invoking methods inside template interpolations {{ computeTotal(item) }} forces function re-execution on every change detection pass.',
    targetConstruct: 'Angular Template Interpolation {{ }}',
    predicate: 'Function execution expression inside template interpolation {{ fn() }}',
    standard: 'Angular Template Binding Performance',
    tips: [{ framework: 'Angular', tip: 'Pre-compute values in component state or create a @Pipe({ name: "compute", pure: true })' }],
  },
  'FIGM-ANG-05': {
    concern: 'Bypassing Angular Renderer2 or Signals with direct elementRef.nativeElement mutations creates SSR security & hydration risks.',
    targetConstruct: 'Angular Direct DOM Manipulation',
    predicate: 'elementRef.nativeElement.style or elementRef.nativeElement.innerHTML assignment',
    standard: 'Angular Security & SSR Abstraction Guidelines',
    tips: [{ framework: 'Angular', tip: 'Use Renderer2.setStyle() or [ngStyle] property bindings instead of direct nativeElement mutation' }],
  },
};

const TIP_COLOR: Record<FrameworkTip['framework'], string> = {
  'Next.js': '#ffffff',
  React: '#38bdf8',
  Angular: '#ef4444',
  Vue: '#42b883',
  'JS/TS': '#facc15',
};

const REMEDIATION_STATUS_LABEL: Record<RuleCatalogEntry['remediationStatus'], { label: string; color: string }> = {
  AUTOMATED_FIX_VERIFIED: { label: '✓ Automated fix, re-scan-verified', color: '#86efac' },
  AUTOMATED_FIX_WITH_CAVEAT: { label: '⚠ Automated fix, partial coverage', color: '#fde047' },
  MANUAL_REVIEW_REQUIRED: { label: '✋ Manual review required', color: '#fca5a5' },
};

const CATEGORY_BADGE: Record<RuleCatalogEntry['category'], { label: string; bg: string; color: string; border: string }> = {
  COMMON: { label: '🌐 Cross-Framework Common', bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
  NEXTJS: { label: '▲ Next.js Specific', bg: '#000000', color: '#ffffff', border: '#334155' },
  REACT: { label: '⚛️ React Specific', bg: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
  ANGULAR: { label: '🅰️ Angular Specific', bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' },
};

const FRAMEWORK_FILTER_META: { key: FrameworkType; label: string; color: string }[] = [
  { key: 'REACT_JSX', label: '⚛️ React', color: '#38bdf8' },
  { key: 'NEXT_JS', label: '▲ Next.js', color: '#ffffff' },
  { key: 'ANGULAR_TEMPLATE', label: '🅰️ Angular', color: '#ef4444' },
  { key: 'VUE_SFC', label: '🟢 Vue', color: '#42b883' },
  { key: 'GENERIC_ESTREE', label: '🟨 JavaScript/TypeScript', color: '#facc15' },
];

export default function GuidelinesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFramework, setSelectedFramework] = useState<FrameworkType | 'ALL'>('ALL');
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filterRules = (category: string) => {
    return RULE_CATALOG.filter((g) => {
      if (category !== 'ALL' && g.category !== category) return false;
      if (selectedFramework !== 'ALL' && !g.frameworks.includes(selectedFramework)) return false;
      const domainCode = g.domain === 'PERFORMANCE' ? 'PERF' : 'A11Y';
      if (selectedDomain !== 'ALL' && domainCode !== selectedDomain) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ui = RULE_UI_CONTENT[g.id];
        const matchId = g.id.toLowerCase().includes(q);
        const matchName = g.name.toLowerCase().includes(q);
        const matchDescription = g.description.toLowerCase().includes(q);
        const matchConstruct = ui?.targetConstruct.toLowerCase().includes(q) ?? false;
        if (!matchId && !matchName && !matchDescription && !matchConstruct) return false;
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

  const renderRuleCard = (rule: RuleCatalogEntry) => {
    const ui = RULE_UI_CONTENT[rule.id];
    const categoryBadge = CATEGORY_BADGE[rule.category];
    const statusMeta = REMEDIATION_STATUS_LABEL[rule.remediationStatus];

    return (
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

            <span style={{ fontSize: '11px', background: categoryBadge.bg, color: categoryBadge.color, padding: '3px 8px', borderRadius: '6px', border: `1px solid ${categoryBadge.border}`, fontWeight: 700 }}>
              {categoryBadge.label}
            </span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            {rule.name}
          </h2>

          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.5 }}>
            {rule.description}
          </div>

          {ui && (
            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.5 }}>
              <strong style={{ color: '#cbd5e1' }}>Why it matters:</strong> {ui.concern}
            </div>
          )}

          {/* Supported Frameworks */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {rule.isFrameworkIndependent && (
              <span style={{ fontSize: '10px', background: 'rgba(34, 197, 94, 0.1)', color: '#86efac', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.25)', fontWeight: 700 }}>
                Framework-independent
              </span>
            )}
            {rule.frameworks
              .filter((fw) => SUPPORTED_FRAMEWORKS.includes(fw))
              .map((fw) => (
                <span key={fw} style={{ fontSize: '10px', background: 'rgba(148, 163, 184, 0.1)', color: '#cbd5e1', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.25)', fontWeight: 600 }}>
                  {FRAMEWORK_LABELS[fw]}
                </span>
              ))}
          </div>

          {/* Target Construct Box */}
          {ui && (
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
                <span style={{ color: '#f8fafc' }}>{ui.targetConstruct}</span>
              </div>
              <div>
                <span style={{ color: '#7c8ba6' }}>What is checked: </span>
                <span style={{ color: '#cbd5e1' }}>{ui.predicate}</span>
              </div>
            </div>
          )}

          {/* Code Example */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: '#7c8ba6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              Example:
            </div>
            <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'JetBrains Mono', background: '#1a0d0d', color: '#fca5a5', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#7c8ba6' }}>{'// Non-compliant\n'}</span>{rule.example.nonCompliant}
            </pre>
            <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'JetBrains Mono', background: '#0d1a10', color: '#86efac', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.25)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#7c8ba6' }}>{'// Compliant\n'}</span>{rule.example.compliant}
            </pre>
          </div>

          {/* Framework Specific Implementation Tips */}
          {ui && ui.tips.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#7c8ba6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                Implementation Guidance:
              </div>
              {ui.tips.map((fw, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '12px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    color: '#cbd5e1',
                  }}
                >
                  <strong style={{ color: TIP_COLOR[fw.framework] }}>[{fw.framework}]</strong> {fw.tip}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: '#86efac', background: 'rgba(34, 197, 94, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            💡 <strong>How to Fix:</strong> {rule.remediation}
          </div>
          <div style={{ fontSize: '12px', color: statusMeta.color, background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
            {statusMeta.label}
          </div>
          <div style={{ fontSize: '11px', color: '#7c8ba6', lineHeight: 1.5 }}>
            <strong style={{ color: '#94a3b8' }}>Known limitation:</strong> {rule.knownLimitation}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#7c8ba6' }}>
              Standard: {ui?.standard ?? rule.concern}
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
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.4px' }}>
            📚 Code Quality Rule Book ({RULE_CATALOG.length} Guidelines)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            Explore universal common guidelines alongside framework-specific rules for <strong>Next.js</strong>, <strong>React</strong>, <strong>Angular</strong>, and <strong>Vue</strong>.
          </p>
        </div>

        <div style={{ fontSize: '13px', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.6)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          Showing <strong>{totalDisplayed}</strong> of {RULE_CATALOG.length} Rules
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Filter Rules by Category:
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: `🌐 All Guidelines (${RULE_CATALOG.length})`, color: '#f8fafc' },
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

        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
          Filter by Target Framework:
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedFramework('ALL')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedFramework === 'ALL' ? '1px solid #f8fafc' : '1px solid var(--border)',
              background: selectedFramework === 'ALL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(9, 13, 22, 0.6)',
              color: selectedFramework === 'ALL' ? '#f8fafc' : '#94a3b8',
            }}
          >
            🌐 All Frameworks
          </button>
          {FRAMEWORK_FILTER_META.map((item) => {
            const count = RULE_CATALOG.filter((r) => r.frameworks.includes(item.key)).length;
            return (
              <button
                key={item.key}
                onClick={() => setSelectedFramework(item.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: selectedFramework === item.key ? `1px solid ${item.color}` : '1px solid var(--border)',
                  background: selectedFramework === item.key ? 'rgba(56, 189, 248, 0.15)' : 'rgba(9, 13, 22, 0.6)',
                  color: selectedFramework === item.key ? item.color : '#94a3b8',
                }}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>
        {selectedFramework === 'VUE_SFC' && (
          <p style={{ fontSize: '12px', color: '#7c8ba6', margin: 0 }}>
            Vue Single-File Components are covered by FIGM&apos;s framework-independent rules (the 12 Common rules above); there are no Vue-exclusive rules in the current catalog, and Vue detection currently runs on legacy text-heuristic matching rather than a dedicated Vue parser.
          </p>
        )}
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
                Core web quality rules that apply universally across Next.js, React, Angular, and Vue single page applications.
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
