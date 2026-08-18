/**
 * Framework-Independent Guideline Model (FIGM)
 * Four-Layer Architecture Meta-Model Implementation (Complete 25 Rules)
 *
 * Hierarchy:
 * Domain -> Concern -> Abstract Language Primitive (ALP) -> Rule
 */

import {
  AbstractLanguagePrimitive,
  FourLayerMapping,
  FIGMMasterSpecification
} from '../types/taxonomy.js';
import { QUERY_TEMPLATES, FRAMEWORK_TRANSLATIONS } from '../ast/universal-ast-mapper.js';
import { deriveRuleCategory } from './rule-category.js';

/** All five FrameworkType values this engine can classify a file as (see src/types/ast-spec.ts).
 *  The 12 universal PERF/A11Y rules below are evaluated against all five unconditionally. */
const ALL_FRAMEWORKS = ['REACT_JSX', 'NEXT_JS', 'VUE_SFC', 'ANGULAR_TEMPLATE', 'GENERIC_ESTREE'] as const;

/**
 * Core Abstract Language Primitives (ALPs) Definition for all 25 Rules
 */
export const CORE_ALPS: AbstractLanguagePrimitive[] = [
  {
    id: 'ALP-LOOP-ALLOC',
    name: 'Loop Scope Object Allocation Primitive',
    description: 'Abstract syntax representation of object literal or closure instantiations bounded within repetitive loop or render iteration AST blocks.',
    astNodeType: ['ForStatement', 'WhileStatement', 'DoWhileStatement', 'CallExpression[callee.name="map|forEach|reduce|filter"]', 'JSXElement'],
    semanticConstraint: 'Instantiation of non-primitive values within cyclic control structures or render loops without hoisting outer reference.'
  },
  {
    id: 'ALP-LAYOUT-ELEMENT',
    name: 'Un-dimensioned Layout Element Primitive',
    description: 'Abstract syntax representation of visual media or structural container elements missing explicit aspect-ratio or dimension declarations.',
    astNodeType: ['JSXElement[name="img|video|iframe|embed"]', 'CallExpression[callee.name="createElement"]', 'HTMLImageElement'],
    semanticConstraint: 'AST node definition lacking width, height, aspect-ratio, or structural CSS dimension properties.'
  },
  {
    id: 'ALP-ASYNC-DISPOSAL',
    name: 'Asynchronous Target Listener Registration Primitive',
    description: 'Abstract syntax representation of long-lived event listeners or observable stream subscriptions bound inside scope lifecycle routines.',
    astNodeType: ['CallExpression[callee.property.name="addEventListener|subscribe|setInterval"]'],
    semanticConstraint: 'Event/stream registration missing a paired removeEventListener/unsubscribe invocation in teardown/unmount AST scope.'
  },
  {
    id: 'ALP-STATIC-IMPORT',
    name: 'Top-Level Synchronous Module Import Primitive',
    description: 'Abstract syntax representation of static module import statements bringing heavy dependencies into the main evaluation graph.',
    astNodeType: ['ImportDeclaration', 'CallExpression[callee.name="require"]'],
    semanticConstraint: 'Synchronous import statement referencing non-critical or conditionally executed module targets.'
  },
  {
    id: 'ALP-INLINE-CALLBACK',
    name: 'Inline Callback Declaration Primitive',
    description: 'Abstract syntax representation of anonymous arrow functions created inside render loop expressions.',
    astNodeType: ['ArrowFunctionExpression', 'FunctionExpression'],
    semanticConstraint: 'Inline anonymous callback defined within loop or render iteration scope.'
  },
  {
    id: 'ALP-STORAGE-LOOP',
    name: 'Synchronous Storage Access Loop Primitive',
    description: 'Abstract syntax representation of synchronous Web Storage API calls inside loops.',
    astNodeType: ['CallExpression[callee.object.name="localStorage|sessionStorage"]'],
    semanticConstraint: 'Synchronous storage access invoked repeatedly inside iterative scopes.'
  },
  {
    id: 'ALP-EVENT-KEYBOARD',
    name: 'Pointer Event Binding without Keyboard Event Primitive',
    description: 'Abstract syntax representation of pointer click listeners attached to AST nodes.',
    astNodeType: ['JSXAttribute[name="onClick|onMouseDown|onPointerDown"]', 'CallExpression[callee.property.name="addEventListener"]'],
    semanticConstraint: 'Pointer event listener attached to non-native interactive element AST node without corresponding onKeyDown/onKeyPress or tabindex.'
  },
  {
    id: 'ALP-ARIA-NAMING',
    name: 'Custom Interactive Component Declaration Primitive',
    description: 'Abstract syntax representation of user-defined interactive component or element AST nodes.',
    astNodeType: ['JSXElement', 'CallExpression[callee.name="h|createElement"]'],
    semanticConstraint: 'Custom interactive component node lacking explicit role, aria-label, or aria-labelledby attributes.'
  },
  {
    id: 'ALP-LIVE-REGION',
    name: 'Asynchronous DOM Mutation Announcer Primitive',
    description: 'Abstract syntax representation of dynamically injected or updated DOM container AST nodes.',
    astNodeType: ['JSXElement', 'CallExpression[callee.property.name="appendChild|insertBefore|setAttribute"]'],
    semanticConstraint: 'Dynamic status or feedback container mutation missing aria-live="polite|assertive" or role="status|alert".'
  },
  {
    id: 'ALP-FOCUS-TRAVERSAL',
    name: 'Dynamic Element Focus Traversal Primitive',
    description: 'Abstract syntax representation of dynamic DOM node insertions, removals, or focus target mutations.',
    astNodeType: ['JSXElement[name="Modal|Dialog|Overlay|Drawer"]', 'CallExpression[callee.property.name="focus"]'],
    semanticConstraint: 'Modal or route transition unmounting currently focused element without explicit programmatic focus redirection.'
  },
  {
    id: 'ALP-INPUT-LABEL',
    name: 'Form Input Control Label Association Primitive',
    description: 'Abstract syntax representation of form input fields lacking associated labels.',
    astNodeType: ['JSXElement[name="input|textarea|select"]'],
    semanticConstraint: 'Form input missing aria-label, aria-labelledby, or paired label element.'
  },
  {
    id: 'ALP-POSITIVE-TABINDEX',
    name: 'Positive TabIndex Focus Navigation Order Primitive',
    description: 'Abstract syntax representation of explicit positive tabindex attributes.',
    astNodeType: ['JSXAttribute[name="tabIndex|tabindex"]'],
    semanticConstraint: 'Element explicitly assigning positive tabindex > 0 overriding natural focus sequence.'
  },
  {
    id: 'ALP-NEXT-CLIENT-HOOK',
    name: 'Client Hook Invocation Without Directive Primitive',
    description: 'Abstract syntax representation of client state hooks used in Server Components.',
    astNodeType: ['CallExpression[callee.name="useState|useEffect|useContext|useRef"]'],
    semanticConstraint: 'React client hook called in Next.js file lacking "use client" directive.'
  },
  {
    id: 'ALP-NEXT-DYNAMIC',
    name: 'Heavy Component Load Primitive',
    description: 'Abstract syntax representation of heavy third-party module imports.',
    astNodeType: ['ImportDeclaration'],
    semanticConstraint: 'Heavy library imported statically in Next.js instead of next/dynamic.'
  },
  {
    id: 'ALP-NEXT-REVALIDATE',
    name: 'Route Segment Revalidation Config Primitive',
    description: 'Abstract syntax representation of Next.js App Router page caching export.',
    astNodeType: ['ExportNamedDeclaration'],
    semanticConstraint: 'App Router page missing export const revalidate.'
  },
  {
    id: 'ALP-NEXT-FONT',
    name: 'External Font Loading Primitive',
    description: 'Abstract syntax representation of Google Fonts link tags.',
    astNodeType: ['JSXElement[name="link"]'],
    semanticConstraint: 'Fonts loaded via external CSS link instead of next/font.'
  },
  {
    id: 'ALP-REACT-USEMEMO',
    name: 'Derived Computation In Render Primitive',
    description: 'Abstract syntax representation of inline array sorting or heavy computations.',
    astNodeType: ['CallExpression[callee.property.name="sort|filter|reduce"]'],
    semanticConstraint: 'Expensive calculation computed during render without useMemo.'
  },
  {
    id: 'ALP-REACT-KEY-INDEX',
    name: 'Array Index Key Assignment Primitive',
    description: 'Abstract syntax representation of list item key assignment.',
    astNodeType: ['JSXAttribute[name="key"]'],
    semanticConstraint: 'List item assigning array index as key prop.'
  },
  {
    id: 'ALP-REACT-MUTATION',
    name: 'Direct React State Mutation Primitive',
    description: 'Abstract syntax representation of direct state object mutation.',
    astNodeType: ['ExpressionStatement'],
    semanticConstraint: 'Direct mutation of React state variable without state setter.'
  },
  {
    id: 'ALP-REACT-USECALLBACK',
    name: 'Inline Prop Function Primitive',
    description: 'Abstract syntax representation of inline callback props passed to children.',
    astNodeType: ['JSXAttribute[name="onClick|onChange"]'],
    semanticConstraint: 'Callback prop passed inline to child component without useCallback.'
  },
  {
    id: 'ALP-ANG-UNSUBSCRIBE',
    name: 'Angular Unsubscribed Observable Primitive',
    description: 'Abstract syntax representation of RxJS subscriptions.',
    astNodeType: ['CallExpression[callee.property.name="subscribe"]'],
    semanticConstraint: 'Observable subscription missing unsubscribe or takeUntilDestroyed.'
  },
  {
    id: 'ALP-ANG-ONPUSH',
    name: 'Angular Component Change Detection Primitive',
    description: 'Abstract syntax representation of Angular @Component metadata.',
    astNodeType: ['ClassDeclaration'],
    semanticConstraint: 'Angular component missing ChangeDetectionStrategy.OnPush.'
  },
  {
    id: 'ALP-ANG-TRACKBY',
    name: 'Angular *ngFor Directive Primitive',
    description: 'Abstract syntax representation of *ngFor structural directives.',
    astNodeType: ['JSXAttribute[name="*ngFor"]'],
    semanticConstraint: '*ngFor directive lacking trackBy function reference.'
  },
  {
    id: 'ALP-ANG-TEMPLATE-FN',
    name: 'Angular Template Function Invocation Primitive',
    description: 'Abstract syntax representation of template interpolations.',
    astNodeType: ['Interpolation'],
    semanticConstraint: 'Method invocation inside Angular template evaluated during change detection.'
  },
  {
    id: 'ALP-ANG-RENDERER2',
    name: 'Angular Direct DOM Access Primitive',
    description: 'Abstract syntax representation of ElementRef nativeElement property access.',
    astNodeType: ['MemberExpression'],
    semanticConstraint: 'Direct nativeElement DOM manipulation instead of Renderer2 service.'
  }
];

export const FORMAL_PREDICATES_MAP: Record<string, string> = {
  'FIGM-PERF-01': 'P_PERF_01(n) <=> (type(n) in {ObjectExpression, ArrayExpression, ArrowFunctionExpression}) AND exists a in Ancestors(n): (Scope(a) in {LOOP, RENDER}) AND NOT UsesLoopVar(n, a)',
  'FIGM-PERF-02': 'P_PERF_02(n) <=> IsVisualElement(n) AND NOT (HasAttr(n, "width") AND HasAttr(n, "height")) AND NOT HasStyle(n, "aspectRatio")',
  'FIGM-PERF-03': 'P_PERF_03(n) <=> IsListenerRegistration(n) AND NOT exists d in TeardownScope(Scope(n)): IsPairedRemoval(n, d)',
  'FIGM-PERF-04': 'P_PERF_04(n) <=> (type(n) == ImportDeclaration) AND exists c in N: (IsConditionalScope(c) AND ReferencesModule(c, n))',
  'FIGM-PERF-05': 'P_PERF_05(n) <=> IsInlineCallback(n) AND Scope(n) in {LOOP, RENDER}',
  'FIGM-PERF-06': 'P_PERF_06(n) <=> IsSynchronousStorageAccess(n) AND Scope(n) in {LOOP, RENDER}',
  'FIGM-A11Y-01': 'P_A11Y_01(n) <=> (IsNonInteractiveElement(n) AND HasPointerHandler(n)) AND NOT (HasKeyboardHandler(n) AND HasTabIndex(n))',
  'FIGM-A11Y-02': 'P_A11Y_02(n) <=> IsCustomControl(n) AND NOT (HasAttr(n, "role") AND (HasAttr(n, "aria-label") OR HasAttr(n, "aria-labelledby")))',
  'FIGM-A11Y-03': 'P_A11Y_03(n) <=> IsDynamicStatusContainer(n) AND NOT (HasAttr(n, "aria-live") OR Role(n) in {"status", "alert"})',
  'FIGM-A11Y-04': 'P_A11Y_04(n) <=> IsOverlayOrModal(n) AND NOT (HasFocusTrap(n) AND RestoresFocusOnUnmount(n))',
  'FIGM-A11Y-05': 'P_A11Y_05(n) <=> IsFormInput(n) AND NOT (HasLabelAssociation(n) OR HasAriaLabel(n))',
  'FIGM-A11Y-06': 'P_A11Y_06(n) <=> HasTabIndex(n) AND TabIndexValue(n) > 0',
  'FIGM-NEXT-01': 'P_NEXT_01(n) <=> IsReactClientHook(n) AND NOT HasUseClientDirective(File(n))',
  'FIGM-NEXT-02': 'P_NEXT_02(n) <=> IsHeavyModuleImport(n) AND NOT IsDynamicImport(n)',
  'FIGM-NEXT-03': 'P_NEXT_03(n) <=> IsAppRouterPage(File(n)) AND NOT HasRevalidateExport(File(n))',
  'FIGM-NEXT-04': 'P_NEXT_04(n) <=> IsExternalFontLink(n) AND NOT IsNextFontImport(n)',
  'FIGM-REACT-01': 'P_REACT_01(n) <=> IsDerivedStateComputation(n) AND NOT WrappedInUseMemo(n)',
  'FIGM-REACT-02': 'P_REACT_02(n) <=> IsListItem(n) AND KeyPropValue(n) == ArrayIndex(n)',
  'FIGM-REACT-03': 'P_REACT_03(n) <=> IsDirectStateMutation(n) AND NOT UsesStateSetter(n)',
  'FIGM-REACT-04': 'P_REACT_04(n) <=> IsChildCallbackProp(n) AND NOT WrappedInUseCallback(n)',
  'FIGM-ANG-01': 'P_ANG_01(n) <=> IsRxJSSubscription(n) AND NOT HasUnsubscribeOrTakeUntil(n)',
  'FIGM-ANG-02': 'P_ANG_02(n) <=> IsAngularComponent(n) AND NOT StrategyEqualsOnPush(n)',
  'FIGM-ANG-03': 'P_ANG_03(n) <=> IsNgForDirective(n) AND NOT HasTrackBy(n)',
  'FIGM-ANG-04': 'P_ANG_04(n) <=> IsTemplateInterpolation(n) AND ContainsMethodCall(n)',
  'FIGM-ANG-05': 'P_ANG_05(n) <=> IsNativeElementAccess(n) AND NOT UsesRenderer2(n)'
};

/**
 * 4-Layer Meta-Model Mappings for ALL 25 FIGM Rules
 */
export const FOUR_LAYER_MAPPINGS: FourLayerMapping[] = [
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-LOOP-ALLOC')!,
    rule: {
      ruleId: 'FIGM-PERF-01',
      ruleName: 'Invariant Object Allocation in Iteration Scopes',
      severity: 'HIGH',
      description: 'Objects, arrays, functions, or regex literals must not be instantiated inside loops or render iteration routines.',
      nonCompliantExample: `function renderList(items) {\n  return items.map(item => {\n    const config = { theme: 'dark', padding: 10 };\n    return transform(item, config);\n  });\n}`,
      compliantExample: `const DEFAULT_CONFIG = Object.freeze({ theme: 'dark', padding: 10 });\nfunction renderList(items) {\n  return items.map(item => transform(item, DEFAULT_CONFIG));\n}`,
      remediation: 'Hoist static object/array literals and helper callbacks outside the iteration scope or memoize invariant allocations.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Flags any object/array/function literal in loop or render scope regardless of true invariance -- no data-flow analysis confirms the value is actually invariant.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-LAYOUT-ELEMENT')!,
    rule: {
      ruleId: 'FIGM-PERF-02',
      ruleName: 'Un-dimensioned Dynamic Layout Elements',
      severity: 'HIGH',
      description: 'Dynamic media and layout container elements must include explicit dimensions or aspect-ratio attributes.',
      nonCompliantExample: `<img src={userAvatarUrl} alt="User Avatar" className="avatar" />`,
      compliantExample: `<img src={userAvatarUrl} alt="User Avatar" width={48} height={48} style={{ aspectRatio: '1/1' }} className="avatar" />`,
      remediation: 'Add explicit width and height attributes or CSS aspect-ratio properties to all media elements.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Dimensions supplied only via an external CSS class (not inline width/height/aspect-ratio) are invisible to this rule.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ASYNC_LEAKS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ASYNC-DISPOSAL')!,
    rule: {
      ruleId: 'FIGM-PERF-03',
      ruleName: 'Unbounded Event Listener Disposal',
      severity: 'CRITICAL',
      description: 'Target event listeners registered within component lifecycle scopes must have corresponding disposal handlers.',
      nonCompliantExample: `function setupResize() {\n  window.addEventListener('resize', handleResize);\n}`,
      compliantExample: `function setupResize() {\n  window.addEventListener('resize', handleResize);\n  return () => window.removeEventListener('resize', handleResize);\n}`,
      remediation: 'Return an explicit teardown function or invoke removeEventListener in the lifecycle unmount routine.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Pairs addEventListener/removeEventListener by event-type name across the whole file, not by lexical scope -- assumes a conventional one-listener-per-event-type idiom.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-STATIC-IMPORT')!,
    rule: {
      ruleId: 'FIGM-PERF-04',
      ruleName: 'Static Imports in Deferred Execution Paths',
      severity: 'MEDIUM',
      description: 'Modules used only in conditional or deferred execution branches must be dynamically imported.',
      nonCompliantExample: `import HeavyChart from 'heavy-chart-library';`,
      compliantExample: `async function showReport(shouldDisplay) {\n  if (shouldDisplay) {\n    const { default: HeavyChart } = await import('heavy-chart-library');\n  }\n}`,
      remediation: 'Replace static top-level module imports with dynamic import() expressions inside deferred execution paths.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'No cross-module re-export analysis; only direct identifier references in the same file are checked.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-INLINE-CALLBACK')!,
    rule: {
      ruleId: 'FIGM-PERF-05',
      ruleName: 'Inline Anonymous Callbacks in Render Loops',
      severity: 'MEDIUM',
      description: 'Inline arrow functions created inside render map loops cause unnecessary re-instantiation.',
      nonCompliantExample: `items.map(item => <Card onClick={() => handleClick(item.id)} />)`,
      compliantExample: `items.map(item => <Card onClick={handleCardClick} id={item.id} />)`,
      remediation: 'Extract callback function or pass item ID to memoized event handler.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches any inline JSX handler prop, not only onClick; the correct fix (which item identifier to bind instead) is app-specific, so the suggested fix always requires manual review.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'RESOURCE_UTILIZATION',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-STORAGE-LOOP')!,
    rule: {
      ruleId: 'FIGM-PERF-06',
      ruleName: 'Synchronous Storage Access in Loop Scope',
      severity: 'HIGH',
      description: 'Repeated synchronous Web Storage API calls inside loops block main thread execution.',
      nonCompliantExample: `for(let i=0; i<items.length; i++) { localStorage.getItem('token'); }`,
      compliantExample: `const token = localStorage.getItem('token');\nfor(let i=0; i<items.length; i++) { process(token); }`,
      remediation: 'Read Web Storage values once outside loop or cache values in memory.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Name-based detection of localStorage/sessionStorage, not a real variable-binding check -- a shadowed identifier with the same name still triggers it.'
    }
  },
  {
    domain: 'ACCESSIBILITY',
    concern: 'KEYBOARD_ACCESSIBILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-EVENT-KEYBOARD')!,
    rule: {
      ruleId: 'FIGM-A11Y-01',
      ruleName: 'Keyboard Event Parity on Pointer Handlers',
      severity: 'CRITICAL',
      description: 'Non-interactive elements with pointer click listeners must provide keyboard listeners and focusability.',
      nonCompliantExample: `<div onClick={togglePanel}>Toggle Panel</div>`,
      compliantExample: `<button type="button" onClick={togglePanel}>Toggle Panel</button>`,
      remediation: 'Use a native interactive element (<button>) or add tabindex="0" with an onKeyDown handler.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Limited to a fixed non-interactive tag allow-list (div, span, section, article, p).'
    }
  },
  {
    domain: 'ACCESSIBILITY',
    concern: 'NAME_ROLE_VALUE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ARIA-NAMING')!,
    rule: {
      ruleId: 'FIGM-A11Y-02',
      ruleName: 'Accessible Name and Role for Custom UI Controls',
      severity: 'HIGH',
      description: 'Custom UI controls must explicitly define an ARIA role and an accessible name.',
      nonCompliantExample: `<div tabindex="0" onClick={handleSelect}>Custom Select</div>`,
      compliantExample: `<div role="combobox" aria-label="Choose Option" tabindex="0" onClick={handleSelect}>Custom Select</div>`,
      remediation: 'Add an appropriate ARIA role attribute along with aria-label or aria-labelledby.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Limited to a fixed custom-control tag allow-list (Custom*/Select*/Dropdown*); the suggested fix inserts placeholder role/label text that still needs a real accessible name filled in.'
    }
  },
  {
    domain: 'ACCESSIBILITY',
    concern: 'STATUS_MESSAGES',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-LIVE-REGION')!,
    rule: {
      ruleId: 'FIGM-A11Y-03',
      ruleName: 'ARIA Live Announcer for Dynamic Mutations',
      severity: 'HIGH',
      description: 'Containers populated with dynamic status messages must possess ARIA live attributes.',
      nonCompliantExample: `<div className="status-banner">{statusText}</div>`,
      compliantExample: `<div className="status-banner" role="status" aria-live="polite">{statusText}</div>`,
      remediation: 'Add role="status" or aria-live="polite" to dynamic output containers.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Detects dynamic status containers by a className/id prefix match ("status"), not a semantic dynamic-content analysis.'
    }
  },
  {
    domain: 'ACCESSIBILITY',
    concern: 'FOCUS_ORDER',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-FOCUS-TRAVERSAL')!,
    rule: {
      ruleId: 'FIGM-A11Y-04',
      ruleName: 'Dynamic Focus Containment and Traversal',
      severity: 'CRITICAL',
      description: 'Modal overlays must trap keyboard focus and restore focus to trigger element upon exit.',
      nonCompliantExample: `function closeModal() { setIsModalOpen(false); }`,
      compliantExample: `function closeModal() { setIsModalOpen(false); triggerRef.current?.focus(); }`,
      remediation: 'Implement focus containment traps inside active modal overlays and restore focus programmatically.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Uses the presence of an onClose prop as a proxy signal for focus-restoration handling, not a verified focus-trap implementation.'
    }
  },
  {
    domain: 'ACCESSIBILITY',
    concern: 'NAME_ROLE_VALUE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-INPUT-LABEL')!,
    rule: {
      ruleId: 'FIGM-A11Y-05',
      ruleName: 'Form Input Label Association',
      severity: 'CRITICAL',
      description: 'Form input elements must be explicitly associated with a label element or aria-label.',
      nonCompliantExample: `<input type="text" placeholder="Enter name" />`,
      compliantExample: `<label htmlFor="name">Name</label><input id="name" type="text" />`,
      remediation: 'Add an associated <label> with htmlFor attribute or set aria-label.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Checks for htmlFor/for presence anywhere in the file, not that it actually matches this input’s id.'
    }
  },
  {
    domain: 'ACCESSIBILITY',
    concern: 'FOCUS_ORDER',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-POSITIVE-TABINDEX')!,
    rule: {
      ruleId: 'FIGM-A11Y-06',
      ruleName: 'Avoid Positive TabIndex Values',
      severity: 'HIGH',
      description: 'Positive tabindex values (>0) disrupt natural document focus navigation order.',
      nonCompliantExample: `<button tabindex="5">Submit</button>`,
      compliantExample: `<button tabindex="0">Submit</button>`,
      remediation: 'Set tabindex to 0 for custom interactive controls or -1 to remove from tab sequence.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Only catches literal tabIndex values; a value computed at runtime is not evaluated.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-CLIENT-HOOK')!,
    rule: {
      ruleId: 'FIGM-NEXT-01',
      ruleName: 'React Hooks Require "use client" Directive',
      severity: 'CRITICAL',
      description: 'React state or lifecycle hooks inside Next.js App Router files require "use client" directive.',
      nonCompliantExample: `import { useState } from 'react';\nexport default function Page() { useState(); }`,
      compliantExample: `'use client';\nimport { useState } from 'react';\nexport default function Page() { useState(); }`,
      remediation: 'Add "use client" directive at the top of component files using React hooks.',
      frameworks: ['NEXT_JS', 'REACT_JSX'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'A custom hook that itself wraps a real React hook is invisible to this rule -- only direct useState/useEffect/useContext/useRef calls are matched.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-DYNAMIC')!,
    rule: {
      ruleId: 'FIGM-NEXT-02',
      ruleName: 'Dynamic Imports for Heavy Browser Modules',
      severity: 'HIGH',
      description: 'Heavy client libraries should be imported dynamically using next/dynamic with ssr: false.',
      nonCompliantExample: `import MonacoEditor from 'monaco-editor';`,
      compliantExample: `import dynamic from 'next/dynamic';\nconst MonacoEditor = dynamic(() => import('monaco-editor'), { ssr: false });`,
      remediation: 'Use next/dynamic lazy import with ssr: false for heavy client-only packages.',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches a fixed allow-list of known heavy packages, not a general "is this module heavy" detector; the correct ssr:false decision is project-specific.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-REVALIDATE')!,
    rule: {
      ruleId: 'FIGM-NEXT-03',
      ruleName: 'App Router Route Segment Revalidation',
      severity: 'MEDIUM',
      description: 'App Router pages serving dynamic data must define route segment cache revalidation behavior.',
      nonCompliantExample: `export default async function Page() { return <div>Data</div>; }`,
      compliantExample: `export const revalidate = 3600;\nexport default async function Page() { return <div>Data</div>; }`,
      remediation: 'Define export const revalidate = <seconds> inside App Router page files.',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Checks only for the presence of export const revalidate, not whether its value is actually appropriate for the route’s data.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-FONT')!,
    rule: {
      ruleId: 'FIGM-NEXT-04',
      ruleName: 'Zero-Layout-Shift Web Fonts via next/font',
      severity: 'MEDIUM',
      description: 'Web fonts loaded via external CSS link tags cause layout shifts; use next/font instead.',
      nonCompliantExample: `<link href="https://fonts.googleapis.com/css?family=Inter" rel="stylesheet" />`,
      compliantExample: `import { Inter } from 'next/font/google';\nconst inter = Inter({ subsets: ['latin'] });`,
      remediation: 'Replace external font link tags with next/font/google or next/font/local imports.',
      frameworks: ['NEXT_JS', 'REACT_JSX'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches a narrow Google Fonts href pattern; other external font providers are not recognized, and the correct next/font replacement needs the actual font family filled in manually.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-USEMEMO')!,
    rule: {
      ruleId: 'FIGM-REACT-01',
      ruleName: 'Memoize Expensive Derived Computations',
      severity: 'HIGH',
      description: 'Expensive array sorting or filtering operations inside render routines should be wrapped in useMemo.',
      nonCompliantExample: `const sortedData = items.sort((a,b) => a.val - b.val);`,
      compliantExample: `const sortedData = useMemo(() => items.sort((a,b) => a.val - b.val), [items]);`,
      remediation: 'Wrap heavy derived data computations inside React.useMemo.',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'No scope restriction -- any .sort/.filter/.reduce call anywhere in the file is flagged, not only ones inside the render path; the useMemo dependency array must be chosen manually. The receiver is excluded when it is a bare, capitalized identifier (e.g. Vue, Array, Object -- the near-universal naming convention for a class/namespace/static-API object, never a plain array variable), which rules out method-name-only false positives like Vue\'s Vue.filter(name, fn) global filter registration API; a receiver reached via a property chain or call expression (e.g. Array.from(x).filter(...)) is not covered by this exclusion and is still evaluated normally.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-KEY-INDEX')!,
    rule: {
      ruleId: 'FIGM-REACT-02',
      ruleName: 'Stable List Key Prop Assignment',
      severity: 'HIGH',
      description: 'Array indices assigned as list key props cause invalid component re-ordering and state bugs.',
      nonCompliantExample: `items.map((item, index) => <Item key={index} />)`,
      compliantExample: `items.map(item => <Item key={item.id} />)`,
      remediation: 'Assign a unique stable identifier (item.id) to list key props instead of array index.',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'An index value derived through an intermediate variable (rather than used directly as the key) is not recognized.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-MUTATION')!,
    rule: {
      ruleId: 'FIGM-REACT-03',
      ruleName: 'Avoid Direct React State Mutation',
      severity: 'CRITICAL',
      description: 'Directly mutating React state variables skips component re-renders and breaks component updates.',
      nonCompliantExample: `user.name = 'New Name'; setUser(user);`,
      compliantExample: `setUser(prev => ({ ...prev, name: 'New Name' }));`,
      remediation: 'Use immutable state updates or return new object references inside state setters.',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'State-binding evidence is a file-wide identifier-name search (a useState-destructured binding, a matching setX(...) setter call, or a this.state chain), not full lexical-scope/type-checker binding resolution: an unrelated non-state variable elsewhere in the file that happens to reuse a state variable\'s name can still be over-matched, and a mutation reached through an intermediate alias or a destructured sub-object (const ref = state; ref.push(x)) is invisible. Categorically excluded regardless of evidence: document/window/navigator/location/history/localStorage/sessionStorage/router root identifiers and any *.current ref-access chain.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-USECALLBACK')!,
    rule: {
      ruleId: 'FIGM-REACT-04',
      ruleName: 'Wrap Child Callback Props in useCallback',
      severity: 'MEDIUM',
      description: 'Passing inline arrow functions to memoized child components invalidates child re-rendering.',
      nonCompliantExample: `<ChildComponent onClick={() => handleAction()} />`,
      compliantExample: `const handleClick = useCallback(() => handleAction(), []);\n<ChildComponent onClick={handleClick} />`,
      remediation: 'Wrap event handler functions passed as props to child components in React.useCallback.',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Limited to a narrow tag allow-list (Custom*/Button*/Card*) and only the onClick prop; the correct useCallback dependency array must be chosen manually.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ASYNC_LEAKS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-UNSUBSCRIBE')!,
    rule: {
      ruleId: 'FIGM-ANG-01',
      ruleName: 'Unsubscribe RxJS Subscriptions',
      severity: 'CRITICAL',
      description: 'RxJS subscriptions created inside Angular services/components must be cleaned up on destroy.',
      nonCompliantExample: `ngOnInit() { this.dataService.getStream().subscribe(); }`,
      compliantExample: `ngOnInit() { this.dataService.getStream().pipe(takeUntilDestroyed()).subscribe(); }`,
      remediation: 'Use takeUntilDestroyed() or unsubscribe() in ngOnDestroy routine.',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Searches file-wide for a teardown keyword (takeUntilDestroyed/unsubscribe), not verified against the specific subscription.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-ONPUSH')!,
    rule: {
      ruleId: 'FIGM-ANG-02',
      ruleName: 'Angular OnPush Change Detection Strategy',
      severity: 'HIGH',
      description: 'Angular components should specify ChangeDetectionStrategy.OnPush to minimize change detection cycles.',
      nonCompliantExample: `@Component({ selector: 'app-card', template: '...' })`,
      compliantExample: `@Component({ selector: 'app-card', changeDetection: ChangeDetectionStrategy.OnPush })`,
      remediation: 'Add changeDetection: ChangeDetectionStrategy.OnPush to Angular component decorator.',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Textual check for the ChangeDetectionStrategy.OnPush value, not a full constant evaluator.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-TRACKBY')!,
    rule: {
      ruleId: 'FIGM-ANG-03',
      ruleName: 'Angular *ngFor trackBy Function Reference',
      severity: 'HIGH',
      description: '*ngFor structural directives missing trackBy cause full DOM node destruction and re-creation on update.',
      nonCompliantExample: `<div *ngFor="let item of items">{{ item.name }}</div>`,
      compliantExample: `<div *ngFor="let item of items; trackBy: trackById">{{ item.name }}</div>`,
      remediation: 'Add trackBy function reference to all *ngFor iteration directives.',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Detected via legacy text-heuristic regex matching against Angular template markup on every framework (including Angular itself) -- a dedicated Angular template parser (@angular/compiler) has not yet been integrated, so this rule is not yet real-AST for any framework. The automatic fix only rewrites the template to reference `trackBy: trackById` -- it does not generate the matching `trackById(index, item)` method on the component class, so the patch will not compile/run until that method is added by hand (found via live black-box fix-and-rescan testing: the isolated single-file TS checker does not type-check Angular template strings, so this dangling reference is invisible to automated re-scan verification).'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-TEMPLATE-FN')!,
    rule: {
      ruleId: 'FIGM-ANG-04',
      ruleName: 'Minimize Method Invocations in Angular Templates',
      severity: 'HIGH',
      description: 'Calling component methods inside Angular HTML templates executes the method on every change detection cycle.',
      nonCompliantExample: `<span>{{ calculateTotal() }}</span>`,
      compliantExample: `<span>{{ total }}</span>`,
      remediation: 'Pre-calculate template values or use pure Angular Pipes instead of method calls.',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Detected via legacy text-heuristic regex matching against Angular template markup on every framework (including Angular itself); the correct fix (precompute vs. pure Pipe) is app-specific and always needs manual review.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-RENDERER2')!,
    rule: {
      ruleId: 'FIGM-ANG-05',
      ruleName: 'Renderer2 DOM Manipulation Safety',
      severity: 'HIGH',
      description: 'Direct ElementRef nativeElement DOM manipulation bypasses Angular security and server-side rendering.',
      nonCompliantExample: `this.el.nativeElement.style.color = 'red';`,
      compliantExample: `this.renderer.setStyle(this.el.nativeElement, 'color', 'red');`,
      remediation: 'Use Renderer2 service methods for all DOM manipulations instead of nativeElement.',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Automated fix is verified safe only for the single-style-property-assignment shape (nativeElement.style.x = y); every other mutation shape (innerHTML, setAttribute, classList) requires manual review. Also a same-line-only proximity check for an existing Renderer2 guard (a guard a few lines away is not recognized).'
    }
  }
];

export function generateMasterSpecification(): FIGMMasterSpecification & {
  universalASTQueryTemplates: typeof QUERY_TEMPLATES;
  frameworkASTTranslations: typeof FRAMEWORK_TRANSLATIONS;
} {
  return {
    meta: {
      title: 'Framework-Independent Guideline Model (FIGM) Master Specification',
      version: '2.0.0',
      description: 'Formal 4-Layer Meta-Model & AST Detection Specification Matrix mapping SPA Quality Domains to Formal Mathematical Predicates, Abstract Language Primitives, and Universal AST Query Templates.',
      framework: 'FIGM-Core-v2',
      generatedAt: new Date().toISOString(),
      totalCoreRules: FOUR_LAYER_MAPPINGS.length
    },
    taxonomies: {
      domains: [
        {
          id: 'PERFORMANCE',
          name: 'Performance Efficiency Domain',
          description: 'Optimizing SPA runtime execution speed, memory footprint, bundle delivery, and visual layout stability.',
          concerns: []
        },
        {
          id: 'ACCESSIBILITY',
          name: 'Accessibility Domain',
          description: 'Ensuring SPA interfaces comply with normative WCAG 2.2 Success Criteria for assistive technology users.',
          concerns: []
        }
      ]
    },
    abstractLanguagePrimitives: CORE_ALPS,
    universalASTQueryTemplates: QUERY_TEMPLATES,
    frameworkASTTranslations: FRAMEWORK_TRANSLATIONS,
    rules: FOUR_LAYER_MAPPINGS.map((m) => {
      const isPerf = m.domain === 'PERFORMANCE';
      const queryTpl = QUERY_TEMPLATES.find((q) => q.alpId === m.abstractLanguagePrimitive.id);
      return {
        id: m.rule.ruleId,
        domain: m.domain,
        concern: m.concern,
        category: deriveRuleCategory(m.rule.ruleId),
        alpId: m.abstractLanguagePrimitive.id,
        name: m.rule.ruleName,
        severity: m.rule.severity,
        description: m.rule.description,
        formalMathematicalPredicate: FORMAL_PREDICATES_MAP[m.rule.ruleId] || 'P_RULE(n)',
        standardTraceability: isPerf
          ? {
              standard: 'ISO_25010',
              clause: `ISO 25010 - ${m.concern}`,
              title: `ISO 25010 Quality Model for ${m.concern}`
            }
          : {
              standard: 'WCAG_2_2',
              clause: 'SC 2.1.1',
              title: m.concern,
              level: 'A'
            },
        detectionStrategy: {
          astPatterns: m.abstractLanguagePrimitive.astNodeType,
          universalASTSelector: queryTpl?.selectorString || '',
          scopeRequirements: m.abstractLanguagePrimitive.semanticConstraint,
          evaluatorType: isPerf ? 'AST_STRUCTURE' : 'CFG_REACHABILITY'
        },
        examples: {
          nonCompliant: m.rule.nonCompliantExample,
          compliant: m.rule.compliantExample
        },
        remediation: m.rule.remediation,
        frameworks: m.rule.frameworks,
        isFrameworkIndependent: m.rule.isFrameworkIndependent,
        remediationStatus: m.rule.remediationStatus,
        knownLimitation: m.rule.knownLimitation
      };
    })
  };
}
