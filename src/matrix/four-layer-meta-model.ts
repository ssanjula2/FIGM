/**
 * Framework-Independent Guideline Model (FIGM)
 * Four-Layer Architecture Meta-Model Implementation (Complete 50 Rules)
 *
 * Hierarchy:
 * Domain -> Concern -> Abstract Language Primitive (ALP) -> Rule
 */

import {
  AbstractLanguagePrimitive,
  FourLayerMapping,
  FIGMMasterSpecification,
  StandardTraceability
} from '../types/taxonomy.js';
import { QUERY_TEMPLATES, FRAMEWORK_TRANSLATIONS } from '../ast/universal-ast-mapper.js';
import { deriveRuleCategory } from './rule-category.js';

/** All five FrameworkType values this engine can classify a file as (see src/types/ast-spec.ts).
 *  The 12 universal PERF/A11Y rules below are evaluated against all five unconditionally. */
const ALL_FRAMEWORKS = ['REACT_JSX', 'NEXT_JS', 'VUE_SFC', 'ANGULAR_TEMPLATE', 'GENERIC_ESTREE'] as const;

/**
 * Core Abstract Language Primitives (ALPs) Definition for all 50 Rules
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
    description: 'Abstract syntax representation of anonymous arrow functions created inside render (loop or non-loop) scope.',
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
  },
  // -----------------------------------------------------------------------------------------
  // Research-backed expansion set (8 rules). Each ALP below traces to a real, independently
  // verifiable evidence source cited in its rule's `remediation`/`knownLimitation` text -- see
  // docs/research/EXPANSION_RESEARCH_TRACEABILITY.md for the full evidence dossier (source,
  // organization, URL, access date, and relevance justification per rule).
  // -----------------------------------------------------------------------------------------
  {
    id: 'ALP-A11Y-LABEL-MISMATCH',
    name: 'Accessible Name Visible-Label Divergence Primitive',
    description: 'Abstract syntax representation of interactive elements carrying both visible text content and an explicit accessible-name override.',
    astNodeType: ['JSXElement[aria-label]'],
    semanticConstraint: 'Element has a literal visible text child AND an aria-label attribute whose value does not contain that visible text.'
  },
  {
    id: 'ALP-REACT-EFFECT-DERIVE',
    name: 'Effect-Sourced State Derivation Primitive',
    description: 'Abstract syntax representation of a React useEffect callback whose entire body is a single state-setter invocation.',
    astNodeType: ['CallExpression[callee.name="useEffect"]'],
    semanticConstraint: 'useEffect callback body consists of exactly one ExpressionStatement calling a set-prefixed state setter, with no other side effect.'
  },
  {
    id: 'ALP-REACT-EFFECT-DEPS',
    name: 'Effect Reactive Dependency Omission Primitive',
    description: 'Abstract syntax representation of a React useEffect callback referencing a component prop absent from its own dependency array.',
    astNodeType: ['CallExpression[callee.name="useEffect"]'],
    semanticConstraint: 'useEffect callback references an identifier destructured from the enclosing component\'s props parameter that is not present in the effect\'s static dependency array literal.'
  },
  {
    id: 'ALP-NEXT-SERVER-BOUNDARY',
    name: 'Server-Only Module Client-Boundary Crossing Primitive',
    description: 'Abstract syntax representation of a Node.js server-only module import reached from a Client Component module graph.',
    astNodeType: ['ImportDeclaration'],
    semanticConstraint: 'File carries a "use client" directive AND imports a Node.js built-in / server-only module.'
  },
  {
    id: 'ALP-NEXT-NATIVE-IMG',
    name: 'Unoptimized Native Image Element Primitive',
    description: 'Abstract syntax representation of a native lowercase <img> element inside a Next.js file.',
    astNodeType: ['JSXElement[name="img"]'],
    semanticConstraint: 'Native <img> tag used in a Next.js file instead of the next/image Image component.'
  },
  {
    id: 'ALP-ANG-IMPURE-PIPE',
    name: 'Impure Angular Pipe Declaration Primitive',
    description: 'Abstract syntax representation of an @Pipe decorator configuration object.',
    astNodeType: ['ClassDeclaration'],
    semanticConstraint: '@Pipe decorator argument object literal sets pure: false.'
  },
  {
    id: 'ALP-VUE-FOR-KEY',
    name: 'Vue Unstable v-for Key Primitive',
    description: 'Abstract syntax representation of a Vue template element carrying a v-for directive.',
    astNodeType: ['VElement[v-for]'],
    semanticConstraint: 'v-for directive present on an element without a paired :key/v-bind:key binding, or with a key bound to the loop index variable.'
  },
  {
    id: 'ALP-VUE-IF-FOR',
    name: 'Vue Combined v-if/v-for Primitive',
    description: 'Abstract syntax representation of a Vue template element carrying both v-for and v-if directives.',
    astNodeType: ['VElement[v-for][v-if]'],
    semanticConstraint: 'v-for and v-if directives present together on the same template element.'
  },
  // -----------------------------------------------------------------------------------------
  // Second research-backed expansion set (17 rules, 33 -> 50). Evidence sources cited in each
  // rule's remediation/knownLimitation text -- see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md
  // for the full per-rule evidence dossier, including 3 candidates that were replaced after
  // research contradicted or duplicated the original brief (FIGM-REACT-11, FIGM-ANG-07,
  // FIGM-ANG-09) and one whose premise was corrected (FIGM-ANG-08).
  // -----------------------------------------------------------------------------------------
  {
    id: 'ALP-NEXT-ASYNC-CLIENT',
    name: 'Async Client Component Declaration Primitive',
    description: 'Abstract syntax representation of an async function component in a file marked "use client".',
    astNodeType: ['FunctionDeclaration[async]'],
    semanticConstraint: 'A component-shaped function (returns JSX) declared async inside a "use client" file.'
  },
  {
    id: 'ALP-NEXT-SEARCHPARAMS-SUSPENSE',
    name: 'Unsuspended useSearchParams Primitive',
    description: 'Abstract syntax representation of a useSearchParams() call with no Suspense boundary visible in the same file.',
    astNodeType: ['CallExpression[callee.name="useSearchParams"]'],
    semanticConstraint: 'useSearchParams() called in a file containing no <Suspense> JSX element.'
  },
  {
    id: 'ALP-NEXT-METADATA-CLIENT',
    name: 'Metadata API Client-Boundary Violation Primitive',
    description: 'Abstract syntax representation of a metadata export or generateMetadata function inside a "use client" file.',
    astNodeType: ['ExportDeclaration', 'FunctionDeclaration'],
    semanticConstraint: 'File carries a "use client" directive AND exports "metadata"/"generateMetadata"/"generateViewport".'
  },
  {
    id: 'ALP-NEXT-FORCE-DYNAMIC',
    name: 'Unjustified Forced Dynamic Rendering Primitive',
    description: 'Abstract syntax representation of an App Router route segment forcing dynamic rendering with no visible request-time dependency.',
    astNodeType: ['ExportDeclaration'],
    semanticConstraint: 'export const dynamic = "force-dynamic" present, with no cookies()/headers()/draftMode() call or no-store fetch anywhere in the file.'
  },
  {
    id: 'ALP-VUE-COMPUTED-SIDE-EFFECT',
    name: 'Vue Computed Getter Side Effect Primitive',
    description: 'Abstract syntax representation of a Vue computed() getter body containing a mutation of another ref or an I/O call.',
    astNodeType: ['CallExpression[callee.name="computed"]'],
    semanticConstraint: 'computed(() => { ... }) block body contains an assignment to another identifier\'s .value, or a call to fetch/localStorage.setItem/sessionStorage.setItem.'
  },
  {
    id: 'ALP-VUE-COMPUTED-MUTATION',
    name: 'Vue Computed Result Mutation Primitive',
    description: 'Abstract syntax representation of code mutating the contents of a computed ref\'s .value from outside its own definition.',
    astNodeType: ['CallExpression', 'BinaryExpression'],
    semanticConstraint: 'A property assignment or array-mutation-method call rooted at <name>.value, where <name> is bound via const <name> = computed(...).'
  },
  {
    id: 'ALP-VUE-PROP-MUTATION',
    name: 'Vue Direct Prop Mutation Primitive',
    description: 'Abstract syntax representation of code mutating a defineProps()-bound props object.',
    astNodeType: ['BinaryExpression', 'CallExpression'],
    semanticConstraint: 'A property assignment or array-mutation-method call rooted at <props>.<field>, where <props> is bound via const <props> = defineProps(...).'
  },
  {
    id: 'ALP-VUE-ARROW-METHOD',
    name: 'Vue Options API Arrow Method Primitive',
    description: 'Abstract syntax representation of an arrow function used as a value inside an Options API methods: {} object.',
    astNodeType: ['ArrowFunction'],
    semanticConstraint: 'A property of the default-exported Options API object\'s "methods" block whose value is an ArrowFunction rather than a regular function.'
  },
  {
    id: 'ALP-ANG-CONSTRUCTOR-LOGIC',
    name: 'Angular Complex Constructor Logic Primitive',
    description: 'Abstract syntax representation of a component/injectable constructor body containing more than trivial field-assignment statements.',
    astNodeType: ['Constructor'],
    semanticConstraint: 'Constructor body contains a call expression other than a bare field assignment (a service method call, subscription, or HTTP-shaped call).'
  },
  {
    id: 'ALP-ANG-UNSTABLE-TRACK',
    name: 'Angular @for Unstable Track Expression Primitive',
    description: 'Abstract syntax representation of a modern Angular @for block whose track expression is the loop index or the whole loop variable.',
    astNodeType: ['Interpolation'],
    semanticConstraint: '@for (x of items; track $index) or @for (x of items; track x) -- track bound to the index or the bare loop variable instead of a stable property.'
  },
  {
    id: 'ALP-ANG-MUTABLE-SIGNAL-INPUT',
    name: 'Angular Mutable Signal Input Declaration Primitive',
    description: 'Abstract syntax representation of a class property initialized via input()/model() without a readonly modifier.',
    astNodeType: ['PropertyDeclaration'],
    semanticConstraint: 'Class property initialized by input(...) lacking the readonly TypeScript modifier.'
  },
  {
    id: 'ALP-ANG-DUPLICATE-ASYNC-PIPE',
    name: 'Angular Duplicate Async Pipe Primitive',
    description: 'Abstract syntax representation of the same observable expression piped through | async more than once in one template.',
    astNodeType: ['Interpolation'],
    semanticConstraint: 'The identical "<expr> | async" text appears 2+ times in the same component template.'
  },
  {
    id: 'ALP-REACT-HOOK-PLACEMENT',
    name: 'Conditional/Loop/Nested Hook Call Primitive',
    description: 'Abstract syntax representation of a Hook call whose nearest control-flow/function ancestor is a conditional, loop, or nested function.',
    astNodeType: ['CallExpression[callee.name=/^use[A-Z]/]'],
    semanticConstraint: 'A call to an identifier matching the Hook naming convention has an IfStatement/loop/nested-function ancestor before reaching the enclosing component or custom Hook.'
  },
  {
    id: 'ALP-REACT-PROP-MUTATION',
    name: 'React Direct Prop Mutation Primitive',
    description: 'Abstract syntax representation of a direct mutation of a destructured component prop.',
    astNodeType: ['ExpressionStatement'],
    semanticConstraint: 'Direct mutation of a props-parameter-destructured identifier, structurally the same shape FIGM-REACT-03 already proves for state, applied to props instead.'
  },
  {
    id: 'ALP-REACT-RENDER-SIDE-EFFECT',
    name: 'React Render-Phase Side Effect Primitive',
    description: 'Abstract syntax representation of an I/O or storage call made directly in a component\'s render body.',
    astNodeType: ['CallExpression'],
    semanticConstraint: 'A call to fetch/localStorage.setItem/sessionStorage.setItem/document.title assignment etc. reached directly in RENDER scope, not inside an event handler or useEffect callback.'
  },
  {
    id: 'ALP-REACT-COMPONENT-AS-FUNCTION',
    name: 'React Component Called as Function Primitive',
    description: 'Abstract syntax representation of a PascalCase component-shaped function invoked directly rather than rendered as JSX.',
    astNodeType: ['CallExpression'],
    semanticConstraint: 'CallExpression whose callee is a PascalCase identifier that is also defined in-file as a JSX-returning function, appearing inside a JSX expression container.'
  },
  {
    id: 'ALP-REACT-CONTEXT-VALUE',
    name: 'React Context Provider Inline Value Primitive',
    description: 'Abstract syntax representation of a Context.Provider value prop set to an inline, unmemoized object/array literal.',
    astNodeType: ['JSXAttribute[name="value"]'],
    semanticConstraint: 'A *.Provider element\'s value={...} attribute is a fresh ObjectExpression/ArrayExpression literal, not wrapped in useMemo.'
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
  'FIGM-ANG-05': 'P_ANG_05(n) <=> IsNativeElementAccess(n) AND NOT UsesRenderer2(n)',
  'FIGM-A11Y-07': 'P_A11Y_07(n) <=> HasVisibleTextChild(n) AND HasAriaLabel(n) AND NOT Contains(AriaLabelText(n), VisibleText(n))',
  'FIGM-REACT-05': 'P_REACT_05(n) <=> IsUseEffectCall(n) AND SoleBodyStatementIsStateSetterCall(n)',
  'FIGM-REACT-06': 'P_REACT_06(n) <=> IsUseEffectCall(n) AND exists p in ReferencedIdentifiers(n): (IsDestructuredProp(p) AND NOT InDependencyArray(p, n))',
  'FIGM-NEXT-05': 'P_NEXT_05(n) <=> HasUseClientDirective(File(n)) AND IsServerOnlyModuleImport(n)',
  'FIGM-NEXT-06': 'P_NEXT_06(n) <=> IsNativeImgElement(n) AND File(n).framework == NEXT_JS',
  'FIGM-ANG-06': 'P_ANG_06(n) <=> IsPipeDecorator(n) AND PureOptionEqualsFalse(n)',
  'FIGM-VUE-01': 'P_VUE_01(n) <=> HasVFor(n) AND (NOT HasKeyBinding(n) OR KeyBindingEqualsLoopIndex(n))',
  'FIGM-VUE-02': 'P_VUE_02(n) <=> HasVFor(n) AND HasVIf(n)',
  'FIGM-NEXT-07': 'P_NEXT_07(n) <=> IsComponentFunction(n) AND IsAsync(n) AND HasUseClientDirective(File(n))',
  'FIGM-NEXT-08': 'P_NEXT_08(n) <=> IsUseSearchParamsCall(n) AND NOT ExistsSuspenseElement(File(n))',
  'FIGM-NEXT-09': 'P_NEXT_09(n) <=> IsMetadataApiExport(n) AND HasUseClientDirective(File(n))',
  'FIGM-NEXT-10': 'P_NEXT_10(n) <=> IsForceDynamicExport(n) AND NOT ExistsRequestTimeApiCall(File(n))',
  'FIGM-VUE-03': 'P_VUE_03(n) <=> IsComputedCall(n) AND ContainsSideEffect(GetterBody(n))',
  'FIGM-VUE-04': 'P_VUE_04(n) <=> IsMutationOf(n) AND RootBindingIsComputed(n)',
  'FIGM-VUE-05': 'P_VUE_05(n) <=> IsMutationOf(n) AND RootBindingIsDefinePropsResult(n)',
  'FIGM-VUE-06': 'P_VUE_06(n) <=> IsArrowFunction(n) AND IsOptionsApiMethodsProperty(Parent(n))',
  'FIGM-ANG-07': 'P_ANG_07(n) <=> IsConstructor(n) AND ContainsNonTrivialStatement(Body(n))',
  'FIGM-ANG-08': 'P_ANG_08(n) <=> IsForBlockTrackExpression(n) AND (TrackEqualsIndex(n) OR TrackEqualsLoopVar(n))',
  'FIGM-ANG-09': 'P_ANG_09(n) <=> IsSignalInputProperty(n) AND NOT HasReadonlyModifier(n)',
  'FIGM-ANG-10': 'P_ANG_10(n) <=> IsAsyncPipeExpression(n) AND ExistsDuplicateAsyncPipeExpression(File(n), n)',
  'FIGM-REACT-07': 'P_REACT_07(n) <=> IsHookCall(n) AND HasConditionalOrLoopOrNestedFunctionAncestor(n)',
  'FIGM-REACT-08': 'P_REACT_08(n) <=> IsDirectMutation(n) AND RootIsDestructuredProp(n)',
  'FIGM-REACT-09': 'P_REACT_09(n) <=> IsIoOrStorageCall(n) AND Scope(n) == RENDER AND NOT InsideEffectOrHandler(n)',
  'FIGM-REACT-10': 'P_REACT_10(n) <=> IsPascalCaseIdentifierCall(n) AND IsInFileDefinedComponent(n) AND InsideJsxExpressionContainer(n)',
  'FIGM-REACT-11': 'P_REACT_11(n) <=> IsProviderValueAttribute(n) AND IsUnmemoizedObjectOrArrayLiteral(n)'
};

/**
 * 4-Layer Meta-Model Mappings for ALL 50 FIGM Rules
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
      ruleName: 'Inline Anonymous Callbacks in Render Scope',
      severity: 'MEDIUM',
      description: 'Inline arrow functions created directly in render scope -- including but not limited to render/map loops -- cause unnecessary re-instantiation on every render.',
      nonCompliantExample: `items.map(item => <Card onClick={() => handleClick(item.id)} />)`,
      compliantExample: `items.map(item => <Card onClick={handleCardClick} id={item.id} />)`,
      remediation: 'Extract callback function or pass item ID to memoized event handler.',
      frameworks: [...ALL_FRAMEWORKS],
      isFrameworkIndependent: true,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches any inline JSX handler prop, not only onClick, and fires on plain render scope as well as loops (formal predicate: Scope(n) in {LOOP, RENDER}); the correct fix (which item identifier to bind instead) is app-specific, so the suggested fix always requires manual review.'
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
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Name-based detection of localStorage/sessionStorage, not a real variable-binding check -- a shadowed identifier with the same name still triggers it. The deterministic fix only auto-hoists the shape `const/let/var x = storage.getX(...)`; a call whose result is discarded, used inline, or passed directly into another expression (this rule\'s OWN documented nonCompliantExample above is exactly this shape) is honestly flagged for manual review rather than silently left unchanged -- found and corrected via a fresh detect->apply->verify measurement across all 50 rules\' canonical examples (benchmarks/fix-success-rate.ts) during the Scientific Hardening Pass; previously this shape silently claimed AUTOMATED_FIX_VERIFIED while producing byte-identical output.'
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
      knownLimitation: 'Upgraded to REAL_AST (Scientific Hardening Pass): detected via angular-html-parser (https://www.npmjs.com/package/angular-html-parser), a real HTML+Angular-template parser extracted from Angular\'s own compiler and independently maintained by the Prettier project, parsing a genuine *ngFor structural-directive attribute node rather than a regex match. Scope limit, honestly disclosed: only an INLINE `template: \\`...\\`` backtick block in the same file is parsed -- a template supplied via a separate `templateUrl` file is invisible to this single-file scan. The automatic fix only rewrites the template to reference `trackBy: trackById` -- it does not generate the matching `trackById(index, item)` method on the component class, so the patch will not compile/run until that method is added by hand (found via live black-box fix-and-rescan testing: the isolated single-file TS checker does not type-check Angular template strings, so this dangling reference is invisible to automated re-scan verification).'
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
      knownLimitation: 'Upgraded to REAL_AST (Scientific Hardening Pass): detected via angular-html-parser, parsing genuine interpolation tokens and `[property]` binding attribute nodes rather than regex over template text. Scope limited to a call-with-parens shape (`foo()`), matching the original heuristic\'s own scope, and deliberately excludes `(event)="handler()"` event bindings, whose purpose is to run on interaction, not on every change-detection cycle. Only an INLINE `template: \\`...\\`` backtick block in the same file is parsed. The correct fix (precompute vs. pure Pipe) is app-specific and always needs manual review.'
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
  },
  // -----------------------------------------------------------------------------------------
  // Research-backed expansion set (8 rules, added after the original 25-rule baseline audit).
  // Evidence sources cited below were independently fetched/searched, not invented -- see
  // docs/research/EXPANSION_RESEARCH_TRACEABILITY.md for the full per-rule evidence dossier.
  // -----------------------------------------------------------------------------------------
  {
    domain: 'ACCESSIBILITY',
    concern: 'INPUT_MODALITIES',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-A11Y-LABEL-MISMATCH')!,
    rule: {
      ruleId: 'FIGM-A11Y-07',
      ruleName: 'Accessible Name Must Contain Visible Label Text',
      severity: 'HIGH',
      description: 'When an interactive element has visible text content, its programmatic accessible name (aria-label) must contain that visible text, per WCAG 2.2 SC 2.5.3 Label in Name -- otherwise speech-input users who speak the visible label cannot activate the control.',
      nonCompliantExample: `<button aria-label="Submit the form">Send</button>`,
      compliantExample: `<button aria-label="Send message">Send</button>`,
      remediation: 'Include the element\'s visible text as a substring of its aria-label, or remove the redundant aria-label if the visible text alone is already an adequate accessible name. Evidence: W3C WCAG 2.2 Success Criterion 2.5.3 "Label in Name" (Level A) -- https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html.',
      frameworks: ['REACT_JSX', 'NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Only detects a literal JSXText visible-text child (not text delivered via a dynamic expression child or via a nested component), and only on REACT_JSX/NEXT_JS -- not yet real-AST migrated for Angular/Vue templates. The automated fix overwrites aria-label with the visible text verbatim, which can discard a legitimately more descriptive accessible name (e.g. an icon-only affordance hint) -- always caveat-flagged for review.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-EFFECT-DERIVE')!,
    rule: {
      ruleId: 'FIGM-REACT-05',
      ruleName: 'Effect Used Solely to Derive State',
      severity: 'MEDIUM',
      description: 'A useEffect whose entire body is a single call to a state setter is computing derived state reactively instead of during render, which React\'s own documentation identifies as unnecessary: it forces an extra render pass and makes data flow harder to follow.',
      nonCompliantExample: `function Cart({ items }) {\n  const [total, setTotal] = useState(0);\n  useEffect(() => {\n    setTotal(items.reduce((s, i) => s + i.price, 0));\n  }, [items]);\n}`,
      compliantExample: `function Cart({ items }) {\n  const total = items.reduce((s, i) => s + i.price, 0);\n}`,
      remediation: 'Delete the Effect and the corresponding state variable; compute the value directly in the component body during render (wrap in useMemo only if the computation is measurably expensive). Evidence: React official documentation, "You Might Not Need an Effect" -- https://react.dev/learn/you-might-not-need-an-effect ("If there is no external system involved... you shouldn\'t need an Effect").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Deliberately narrow trigger (exactly one statement, a bare set-prefixed call) to avoid flagging effects that also perform a real side effect alongside the setState call; an effect with two statements where one is an unrelated side effect and the other is a derivable setState is not detected. No automated fix: safely inlining the computation requires renaming every read of the now-removed state variable throughout the component, which this engine cannot verify is behavior-preserving.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-EFFECT-DEPS')!,
    rule: {
      ruleId: 'FIGM-REACT-06',
      ruleName: 'Missing Reactive Dependency in Effect Hook',
      severity: 'HIGH',
      description: 'A useEffect callback that reads a component prop must list that prop in its dependency array, or the Effect will run against a stale value from an earlier render -- React\'s documentation is explicit that dependencies cannot be chosen manually, only computed from what the Effect actually reads.',
      nonCompliantExample: `function Profile({ userId }) {\n  useEffect(() => {\n    fetchUser(userId);\n  }, []);\n}`,
      compliantExample: `function Profile({ userId }) {\n  useEffect(() => {\n    fetchUser(userId);\n  }, [userId]);\n}`,
      remediation: 'Add the missing prop to the Effect\'s dependency array. Evidence: React official documentation, useEffect reference, "Specifying reactive dependencies" -- https://react.dev/reference/react/useEffect#specifying-reactive-dependencies ("Your Effect\'s dependencies... must include every reactive value you read in the Effect").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Scoped deliberately narrow: only flags a destructured prop of the immediately enclosing component function that is referenced by identifier inside the Effect body and literally absent from a present, static array-literal dependency list; state variables, props accessed via a `props.x` member expression, and effects with no dependency array at all (the "run every render" idiom, which has no missing-dependency bug by construction) are not evaluated. No automated fix, matching React\'s own documented guidance that blindly adding a missing dependency can introduce an infinite loop or an unwanted extra fetch -- the correct fix (add the dependency vs. restructure the Effect vs. use an Effect Event) is a human decision.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-SERVER-BOUNDARY')!,
    rule: {
      ruleId: 'FIGM-NEXT-05',
      ruleName: 'Server-Only Module Imported Across the Client Boundary',
      severity: 'CRITICAL',
      description: 'A file marked "use client" that imports a Node.js server-only built-in module (fs, path, crypto, net, child_process, dns, tls) pulls that module into the client module graph, which Next.js\'s own documentation identifies as a real risk of environment poisoning -- secrets or server-only logic reachable from client code.',
      nonCompliantExample: `'use client';\nimport fs from 'fs';\nexport default function Panel() { /* ... */ }`,
      compliantExample: `'use client';\nexport default function Panel({ initialData }) { /* data passed as a prop from a Server Component */ }`,
      remediation: 'Move the server-only import and the logic that depends on it into a Server Component or a Server Action, and pass only the resulting serializable data down as props; consider guarding the source module with the official `server-only` package. Evidence: Next.js official documentation, "Server and Client Components" -- https://nextjs.org/docs/app/getting-started/server-and-client-components (section "Preventing environment poisoning", which names the `server-only` package as the recommended guard).',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches a fixed allow-list of Node.js built-in module specifiers (with or without a "node:" prefix), not a transitive analysis of third-party packages that themselves import a server-only built-in -- an indirect leak through a library is invisible to this rule. No automated fix: whether the import should move to a Server Component, become a Server Action, or be replaced entirely is an architectural decision this engine cannot make safely.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-NATIVE-IMG')!,
    rule: {
      ruleId: 'FIGM-NEXT-06',
      ruleName: 'Native <img> Instead of next/image',
      severity: 'MEDIUM',
      description: 'A native lowercase <img> element inside a Next.js file forgoes the framework\'s built-in automatic image optimization (responsive sizing, lazy loading, modern format negotiation) that the next/image Image component provides out of the box.',
      nonCompliantExample: `<img src="/hero.png" alt="Hero banner" width={1200} height={600} />`,
      compliantExample: `import Image from 'next/image';\n<Image src="/hero.png" alt="Hero banner" width={1200} height={600} />`,
      remediation: 'Replace the native <img> element with next/image\'s Image component and import it at the top of the file. Evidence: Next.js official documentation, Image component reference -- https://nextjs.org/docs/app/api-reference/components/image ("The Next.js Image component extends the HTML <img> element for automatic image optimization").',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Deliberately distinct from and complementary to FIGM-PERF-02 (which checks whether width/height/aspect-ratio is present at all, on any framework): this rule instead flags the choice of element itself on Next.js specifically, so a dimensioned native <img> in a Next.js file can legitimately trigger this rule while passing FIGM-PERF-02. The automated fix only fires when width and height attributes are already present (required by next/image outside `fill` mode); an <img> with no explicit dimensions is left to manual review rather than guessing a `fill` layout.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'RESOURCE_UTILIZATION',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-IMPURE-PIPE')!,
    rule: {
      ruleId: 'FIGM-ANG-06',
      ruleName: 'Impure Angular Pipe Declaration',
      severity: 'HIGH',
      description: 'An Angular @Pipe declared with pure: false has its transform() method invoked on every change-detection cycle regardless of whether its arguments changed, which Angular\'s own API reference documents as the defining behavior of an impure pipe.',
      nonCompliantExample: `@Pipe({ name: 'filterActive', pure: false })\nexport class FilterActivePipe implements PipeTransform { /* ... */ }`,
      compliantExample: `@Pipe({ name: 'filterActive' })\nexport class FilterActivePipe implements PipeTransform { /* pure by default */ }`,
      remediation: 'Remove pure: false (pipes are pure by default) and instead recompute the derived value only when its real inputs change -- e.g. via a component-level memoized getter or by moving the filtering into a reactive selector -- rather than relying on the pipe re-running every cycle. Evidence: Angular official API reference, Pipe decorator -- https://angular.dev/api/core/Pipe ("If the pipe has internal state..., set pure to false. In this case, the pipe is invoked on each change-detection cycle, even if the arguments have not changed").',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Textual check for the literal `pure: false` property in the @Pipe decorator argument, not a full constant evaluator (a value computed via an imported constant is not recognized). No automated fix: some pipes are genuinely and correctly impure by design (e.g. a pipe whose output depends on mutable external state), so removing pure: false without redesigning the pipe\'s data source could silently break it -- this is a design decision, not a mechanical rewrite.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-VUE-FOR-KEY')!,
    rule: {
      ruleId: 'FIGM-VUE-01',
      ruleName: 'Unstable or Missing v-for Key Binding',
      severity: 'HIGH',
      description: 'A v-for directive without a :key binding (or with :key bound to the loop index) prevents Vue from tracking each node\'s identity across re-renders, causing incorrect state reuse and unnecessary DOM patching -- the Vue.js team\'s own style guide lists this as an Essential (Priority A) rule.',
      nonCompliantExample: `<li v-for="(todo, index) in todos" :key="index">{{ todo.text }}</li>`,
      compliantExample: `<li v-for="todo in todos" :key="todo.id">{{ todo.text }}</li>`,
      remediation: 'Add a :key binding using a stable, unique identifier from each item (e.g. todo.id) instead of omitting :key or binding it to the array index. Evidence: Vue.js official Style Guide, "Priority A Rules: Essential" -- https://vuejs.org/style-guide/rules-essential.html ("Always use key with v-for").',
      frameworks: ['VUE_SFC'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Correction (Phase: Vue template real-AST upgrade): this rule was previously LEGACY_TEXT_HEURISTIC only, blocked on package-registry network access for a real Vue template parser (see docs/research/EXPANSION_RESEARCH_TRACEABILITY.md for that original constraint). Detection now uses a real `@vue/compiler-dom` template AST (src/ast/vue-template-ast-builder.ts, buildVueTemplateRealSyntaxNodes -- the same real AST src/engine/vue-fix-engine.ts already used to locate and fix this violation, so detection and remediation now agree on one real AST rather than two independently-maintained notions of "where the violation is"). Remaining limitation: the automated fix inserts `:key="<loopVar>.id"`, assuming an `id` field exists on each item -- the same documented assumption FIGM-REACT-02\'s automated fix already makes for its React/JSX equivalent -- and is caveated for review when no such field is verifiable.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'RESOURCE_UTILIZATION',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-VUE-IF-FOR')!,
    rule: {
      ruleId: 'FIGM-VUE-02',
      ruleName: 'Combined v-if and v-for on the Same Element',
      severity: 'HIGH',
      description: 'Vue evaluates v-if on every iteration when it is combined with v-for on the same element, re-running the condition once per item every re-render instead of filtering the list once -- the Vue.js team\'s own style guide lists avoiding this combination as an Essential (Priority A) rule.',
      nonCompliantExample: `<li v-for="user in users" v-if="user.isActive">{{ user.name }}</li>`,
      compliantExample: `<li v-for="user in activeUsers">{{ user.name }}</li>`,
      remediation: 'Filter the source list into a computed property (e.g. activeUsers) and iterate that instead, or move v-if to a wrapping <template> element if the goal is conditionally hiding the whole list. Evidence: Vue.js official Style Guide, "Priority A Rules: Essential" -- https://vuejs.org/style-guide/rules-essential.html ("Never use v-if on the same element as v-for... v-for has a higher priority than v-if").',
      frameworks: ['VUE_SFC'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Correction (Phase: Vue template real-AST upgrade): this rule was previously LEGACY_TEXT_HEURISTIC only, for the same environment-blocked reason as FIGM-VUE-01. Detection now uses the same real `@vue/compiler-dom` template AST as FIGM-VUE-01 (src/ast/vue-template-ast-builder.ts). No automated fix remains: the correct rewrite depends on which of the two documented cases applies (filtering vs. conditionally hiding the whole list), which this engine cannot distinguish automatically -- this is a genuine design-decision limitation, not a parsing limitation, so it is unaffected by the AST upgrade.'
    }
  },
  // -----------------------------------------------------------------------------------------
  // Second research-backed expansion set (17 rules). See
  // docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md for the full evidence dossier, including
  // the 3 candidates replaced and 1 corrected after research contradicted the original brief.
  // -----------------------------------------------------------------------------------------
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-ASYNC-CLIENT')!,
    rule: {
      ruleId: 'FIGM-NEXT-07',
      ruleName: 'Async Client Component Misuse',
      severity: 'HIGH',
      description: 'A component function in a file marked "use client" must not be declared async -- React Client Components do not support async component functions.',
      nonCompliantExample: `'use client';\nexport default async function Panel() {\n  const data = await fetchClientData();\n  return <div>{data}</div>;\n}`,
      compliantExample: `'use client';\nimport { useEffect, useState } from 'react';\nexport default function Panel() {\n  const [data, setData] = useState(null);\n  useEffect(() => { fetchClientData().then(setData); }, []);\n  return <div>{data}</div>;\n}`,
      remediation: 'Remove the async keyword and fetch data with useEffect/a data-fetching hook, or convert the component to a Server Component if it does not need client interactivity. Evidence: Next.js official documentation, error reference "No async Client Component" -- https://nextjs.org/docs/messages/no-async-client-component ("React Client Components do not support async functions").',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Only detects a function-declaration-shaped component (async function Name() {...} or export default async function). An async component defined as an arrow function assigned to a variable is not matched by this pass. No automated fix: whether to convert to a Server Component or restructure around useEffect is an architectural decision.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-SEARCHPARAMS-SUSPENSE')!,
    rule: {
      ruleId: 'FIGM-NEXT-08',
      ruleName: 'useSearchParams Without a Suspense Boundary',
      severity: 'HIGH',
      description: 'Reading useSearchParams() in a prerendered route without a wrapping <Suspense> boundary opts the entire Client Component tree up to that boundary into client-side rendering.',
      nonCompliantExample: `'use client';\nimport { useSearchParams } from 'next/navigation';\nexport default function Filters() {\n  const params = useSearchParams();\n  return <div>{params.get('q')}</div>;\n}`,
      compliantExample: `import { Suspense } from 'react';\nimport Filters from './filters';\nexport default function Page() {\n  return <Suspense fallback={null}><Filters /></Suspense>;\n}`,
      remediation: 'Wrap the component that calls useSearchParams() in a <Suspense> boundary (ideally around the smallest subtree that needs it) so the rest of the route can still be prerendered. Evidence: Next.js official documentation, useSearchParams reference and "Missing Suspense boundary with useSearchParams" -- https://nextjs.org/docs/app/api-reference/functions/use-search-params, https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout.',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Single-file over-approximation: this engine cannot see whether a PARENT file (a layout or page importing this component) already wraps it in <Suspense> -- it only checks whether ANY <Suspense> element appears anywhere in the SAME file as the useSearchParams() call. A component that is always used pre-wrapped by its caller will still be flagged. No automated fix: choosing where to place the boundary is a layout decision.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-METADATA-CLIENT')!,
    rule: {
      ruleId: 'FIGM-NEXT-09',
      ruleName: 'Metadata API Used from an Invalid Client Boundary',
      severity: 'CRITICAL',
      description: 'The metadata export and generateMetadata/generateViewport functions are only supported in Server Components, because metadata must be resolved on the server before the page renders.',
      nonCompliantExample: `'use client';\nexport const metadata = { title: 'Dashboard' };\nexport default function Page() { return <div />; }`,
      compliantExample: `export const metadata = { title: 'Dashboard' };\nimport DashboardClient from './dashboard-client';\nexport default function Page() { return <DashboardClient />; }`,
      remediation: 'Move the metadata export (or generateMetadata/generateViewport function) to a Server Component page/layout, and move client-only interactivity into a separate imported Client Component. Evidence: Next.js official documentation, generateMetadata reference -- https://nextjs.org/docs/app/api-reference/functions/generate-metadata ("generateMetadata and the metadata export are only supported in Server Components").',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches the literal export names "metadata"/"generateMetadata"/"generateViewport"; a metadata object re-exported under a different local name via `export { x as metadata }` is not recognized. No automated fix: splitting a file into a Server Component page and a separate Client Component is a structural change.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-NEXT-FORCE-DYNAMIC')!,
    rule: {
      ruleId: 'FIGM-NEXT-10',
      ruleName: 'Unnecessary Forced Dynamic Rendering',
      severity: 'MEDIUM',
      description: 'export const dynamic = "force-dynamic" disables static rendering and caching for a route; when nothing in the file actually reads request-time data, this forfeits performance for no visible benefit.',
      nonCompliantExample: `export const dynamic = 'force-dynamic';\nexport default async function Page() {\n  const posts = await fetch('https://api.example.com/posts').then(r => r.json());\n  return <PostList posts={posts} />;\n}`,
      compliantExample: `export default async function Page() {\n  const posts = await fetch('https://api.example.com/posts').then(r => r.json());\n  return <PostList posts={posts} />;\n}`,
      remediation: 'Remove the force-dynamic export and let Next.js statically render/cache the route, unless the route genuinely needs per-request data (cookies, headers, draftMode, or an explicitly uncached fetch) -- in which case keep it and document why. Evidence: Next.js official documentation on route segment config ("If you prefer your page to always be dynamic... your page won\'t attempt to be statically generated" -- legitimate uses include dashboards/authenticated content that read per-request context, per Next.js community and official guidance on the dynamic route segment option).',
      frameworks: ['NEXT_JS'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Deliberately conservative, single-file over-approximation: only fires when the SAME file has no visible call to cookies()/headers()/draftMode() and no fetch() call with cache:"no-store" or next:{revalidate:0} -- a legitimate request-time dependency reached indirectly through an imported helper function is invisible to this check and will cause a false positive. No automated fix: removing force-dynamic without verifying real request-time independence could break the route.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-VUE-COMPUTED-SIDE-EFFECT')!,
    rule: {
      ruleId: 'FIGM-VUE-03',
      ruleName: 'Side Effect Inside Computed Getter',
      severity: 'HIGH',
      description: 'A Vue computed() getter must be a pure derivation; mutating other state, making async/IO calls, or mutating the DOM inside it breaks Vue\'s dependency-tracking model.',
      nonCompliantExample: `const fullName = computed(() => {\n  logCount.value = logCount.value + 1;\n  return \`\${first.value} \${last.value}\`;\n});`,
      compliantExample: `const fullName = computed(() => \`\${first.value} \${last.value}\`);\nwatch(fullName, () => { logCount.value++; });`,
      remediation: 'Move the side effect (state mutation, async call, DOM mutation) out of the computed getter into a watcher or event handler; the getter should only compute and return a value. Evidence: Vue.js official documentation, "Computed Properties" -- https://vuejs.org/guide/essentials/computed.html ("computed getter functions should only perform pure computation and be free of side effects... don\'t mutate other state, make async requests, or mutate the DOM inside a computed getter"). Also codified as the official ESLint rule vue/no-side-effects-in-computed-properties.',
      frameworks: ['VUE_SFC'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Detects two structurally confident shapes only: an assignment to another identifier\'s .value property, or a call to fetch/localStorage.setItem/sessionStorage.setItem, inside a block-bodied computed(() => {...}) callback. A side effect reached indirectly through a called helper function is not detected. This is the first FIGM Vue rule with REAL_AST detection -- achieved by extracting the .vue file\'s <script> block text and parsing it with the same TypeScript compiler the other real-AST rules already use (no Vue-specific parser dependency required, since <script> content is plain TS/JS); the <template> block remains LEGACY_TEXT_HEURISTIC (FIGM-VUE-01/02) since that still requires a real Vue template parser this environment could not install.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-VUE-COMPUTED-MUTATION')!,
    rule: {
      ruleId: 'FIGM-VUE-04',
      ruleName: 'Direct Mutation of Computed Result',
      severity: 'HIGH',
      description: 'Mutating the object/array a computed ref currently holds (via its .value) from outside the computed\'s own definition silently breaks the "computed is a pure derivation" contract without triggering Vue\'s own reassignment warning, since Vue only warns on reassigning .value itself, not on mutating what it points to.',
      nonCompliantExample: `const sortedItems = computed(() => [...items.value].sort());\nfunction addItem(x) {\n  sortedItems.value.push(x);\n}`,
      compliantExample: `const sortedItems = computed(() => [...items.value].sort());\nfunction addItem(x) {\n  items.value.push(x);\n}`,
      remediation: 'Mutate the underlying source ref (the reactive data the computed derives from), never the computed\'s own .value output. Evidence: Vue.js official documentation, "Computed Properties" -- https://vuejs.org/guide/essentials/computed.html (computed getters "should only perform pure computation"; the returned value is a derived, not a source of truth, so downstream mutation of it is never the correct write target).',
      frameworks: ['VUE_SFC'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'REAL_AST via the same <script>-block extraction as FIGM-VUE-03. Requires the mutated identifier to be a same-file, non-aliased binding of `const X = computed(...)` -- a computed ref re-exported from another module, or aliased through an intermediate variable, is not traced. No automated fix: the correct source-of-truth ref to mutate instead is app-specific.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-VUE-PROP-MUTATION')!,
    rule: {
      ruleId: 'FIGM-VUE-05',
      ruleName: 'Direct Prop Mutation',
      severity: 'CRITICAL',
      description: 'Props form a one-way-down binding from parent to child; mutating a prop directly inside the child is silently overwritten whenever the parent re-renders and makes the app\'s data flow harder to reason about.',
      nonCompliantExample: `const props = defineProps(['todo']);\nfunction complete() {\n  props.todo.done = true;\n}`,
      compliantExample: `const props = defineProps(['todo']);\nconst emit = defineEmits(['update:todo']);\nfunction complete() {\n  emit('update:todo', { ...props.todo, done: true });\n}`,
      remediation: 'Never assign to or mutate a props field directly; derive a local computed/data copy, or emit an event so the parent owns the update. Evidence: Vue.js official documentation, "Props" -- https://vuejs.org/guide/components/props.html ("Avoid mutating a prop directly since the value will be overwritten whenever the parent component re-renders. Instead, use a data or computed property based on the prop\'s value").',
      frameworks: ['VUE_SFC'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'REAL_AST via the same <script>-block extraction as FIGM-VUE-03/04. Only recognizes the non-destructured `const props = defineProps(...)` binding shape; props consumed via destructuring (which loses reactivity in Vue and is a different, already-discouraged pattern) are not traced. No automated fix: whether to use a local computed copy or emit an event is app-specific.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-VUE-ARROW-METHOD')!,
    rule: {
      ruleId: 'FIGM-VUE-06',
      ruleName: 'Arrow Function Used as Options API Method',
      severity: 'HIGH',
      description: 'Vue binds `this` to the component instance for every Options API method, EXCEPT when the method is declared as an arrow function -- arrow functions capture the enclosing (module-level) `this`, so `this.someOtherMethod` inside them is undefined.',
      nonCompliantExample: `export default {\n  methods: {\n    increment: () => {\n      this.count++;\n    }\n  }\n};`,
      compliantExample: `export default {\n  methods: {\n    increment() {\n      this.count++;\n    }\n  }\n};`,
      remediation: 'Use a regular method shorthand (or a plain function expression) for every entry in the Options API methods block, never an arrow function. Evidence: Vue.js official documentation, "Options: State" -- https://vuejs.org/api/options-state.html ("avoid using arrow functions when declaring methods, as they will not have access to the component instance via this... this.myMethod will be undefined").',
      frameworks: ['VUE_SFC'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'REAL_AST via the same <script>-block extraction as FIGM-VUE-03/04/05. Only checks the default-exported object literal\'s own top-level "methods" property; a methods object built by spreading a mixin/composable in is not traced.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-CONSTRUCTOR-LOGIC')!,
    rule: {
      ruleId: 'FIGM-ANG-07',
      ruleName: 'Complex Logic in Angular Component Constructor',
      severity: 'MEDIUM',
      description: 'Non-trivial initialization logic (service calls, subscriptions, computation) placed directly in a component\'s constructor runs before Angular has set up @Input()/@Output() bindings, and is harder to test than an equivalent ngOnInit or well-named method.',
      nonCompliantExample: `constructor(private dataService: DataService) {\n  this.items = this.dataService.getInitialItems();\n  this.dataService.refresh();\n}`,
      compliantExample: `constructor(private dataService: DataService) {}\nngOnInit(): void {\n  this.items = this.dataService.getInitialItems();\n}`,
      remediation: 'Move non-trivial initialization out of the constructor and into ngOnInit or a dedicated, well-named method called from ngOnInit; reserve the constructor for dependency injection and simple field assignment. Evidence: Angular official coding style guide -- https://angular.dev/style-guide (recommends avoiding long or complex logic directly in constructors/lifecycle hooks, preferring well-named methods called from them; corroborated independently across the style guide\'s constructor and lifecycle-hook guidance).',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Replaces an earlier candidate ("expensive function call in Angular template expression"), which research found duplicated the existing FIGM-ANG-04 (both target the same underlying "method call re-evaluated every change-detection cycle" problem) -- see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md. Flags any constructor body containing a CallExpression beyond a bare `this.x = y` assignment; a single trivial validation call is not distinguished from a real service call. No automated fix: choosing which lifecycle hook/method the logic belongs in is a design decision.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-UNSTABLE-TRACK')!,
    rule: {
      ruleId: 'FIGM-ANG-08',
      ruleName: 'Unstable @for Track Expression',
      severity: 'HIGH',
      description: 'Modern Angular @for blocks require a track expression, but tracking by the loop index or the whole loop variable (an object reference that changes whenever the source array is recreated) defeats the purpose just as surely as omitting trackBy did for the legacy *ngFor -- it should reference a stable, unique property such as an id.',
      nonCompliantExample: `@for (item of items; track $index) {\n  <li>{{ item.name }}</li>\n}`,
      compliantExample: `@for (item of items; track item.id) {\n  <li>{{ item.name }}</li>\n}`,
      remediation: 'Track by a stable unique property (e.g. item.id) instead of $index or the bare loop variable. Evidence: Angular official documentation, "Control flow" -- https://angular.dev/guide/templates/control-flow ("Select a property that uniquely identifies each item... If you don\'t have a unique identifier, you can use track $index, though that is not recommended for dynamic lists").',
      frameworks: ['ANGULAR_TEMPLATE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Corrected from the original brief ("missing track expression"): research found `track` is REQUIRED @for block syntax -- Angular\'s own compiler rejects an @for block with no track expression at all (error NG5002), making "missing track" unreachable in code that compiles. This rule instead targets the real, reachable anti-pattern: a track expression that compiles but is not a stable identifier. Upgraded to REAL_AST (Scientific Hardening Pass): detected via angular-html-parser\'s `tokenizeAngularBlocks: true` mode, which parses the modern @for/@if/@switch control-flow block syntax (Angular\'s own template-compiler syntax, not real JS/TS, and therefore still unreachable through the TypeScript-compiler real-AST path this engine uses for Angular class bodies) into genuine Block/BlockParameter nodes with real source spans, rather than regex over the template string. Only an INLINE `template: \\`...\\`` backtick block in the same file is parsed. The automated fix rewrites `track $index`/`track <var>` to `track <var>.id`, assuming an id field exists -- the same documented assumption FIGM-REACT-02/FIGM-VUE-01\'s fixes already make.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-MUTABLE-SIGNAL-INPUT')!,
    rule: {
      ruleId: 'FIGM-ANG-09',
      ruleName: 'Mutable Signal Input Declaration',
      severity: 'MEDIUM',
      description: 'A class property initialized via the modern input() signal function is a read-only signal at runtime; omitting the readonly TypeScript modifier lets other code in the same class accidentally reassign the property, hiding a bug the type system could otherwise catch.',
      nonCompliantExample: `@Component({ selector: 'app-user' })\nexport class UserCard {\n  userId = input<string>();\n}`,
      compliantExample: `@Component({ selector: 'app-user' })\nexport class UserCard {\n  readonly userId = input<string>();\n}`,
      remediation: 'Add the readonly modifier to every class property initialized by input()/model(). Evidence: Angular official documentation and API reference -- https://angular.dev/guide/signals/inputs, https://angular.dev/style-guide ("Signal inputs are read-only signals"; the style guide\'s own example marks such properties readonly: "readonly userId = input();").',
      frameworks: ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Replaces an earlier candidate ("repeated non-trivial template computation"), which research found substantially overlapped both the existing FIGM-ANG-04 and the corrected FIGM-ANG-08 (all three ultimately targeting "template re-evaluation cost") -- see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md. Only recognizes the direct `x = input(...)`/`x = model(...)` initializer shape; a signal input re-wrapped through an intermediate factory function is not traced.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'RESOURCE_UTILIZATION',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-ANG-DUPLICATE-ASYNC-PIPE')!,
    rule: {
      ruleId: 'FIGM-ANG-10',
      ruleName: 'Duplicate Async Pipe Subscriptions in Template',
      severity: 'MEDIUM',
      description: 'Each use of the async pipe on an observable creates its own independent subscription; piping the same observable expression through | async more than once in one template silently doubles (or triples) the underlying work -- including duplicate HTTP requests for a fetch-backed stream.',
      nonCompliantExample: `<div>{{ (user$ | async)?.name }}</div>\n<div>{{ (user$ | async)?.email }}</div>`,
      compliantExample: `<ng-container *ngIf="user$ | async as user">\n  <div>{{ user?.name }}</div>\n  <div>{{ user?.email }}</div>\n</ng-container>`,
      remediation: 'Subscribe once with `*ngIf="obs$ | async as value"` (or the new @if block\'s "as" binding) and reuse the local template variable, instead of repeating "| async" on the same expression. Evidence: this is documented AsyncPipe subscription behavior (each pipe usage manages its own subscription) corroborated across independent Angular educator sources (DigitalOcean\'s Angular async pipe guide, Nitay Neeman\'s "Using Single Subscription for Multiple Async Pipes"); the "as" alias pattern as the fix is Angular\'s own long-standing idiom for this exact problem. Flagged in the evidence dossier as secondary-source-corroborated rather than a single official angular.dev quote, since the general pipe-subscription mechanics are not restated on one dedicated official page the way the other rules\' citations are.',
      frameworks: ['ANGULAR_TEMPLATE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Upgraded to REAL_AST (Scientific Hardening Pass): detected via angular-html-parser, walking genuine interpolation tokens rather than regex over template text, and flags when the SAME "<expr> | async" expression text repeats across those real nodes -- two differently-formatted references to the same observable (extra whitespace, a renamed local alias) are still not recognized as duplicates, since expression-level equivalence (not just token-text equality) would require evaluating the expressions themselves. Only an INLINE `template: \\`...\\`` backtick block in the same file is parsed. No automated fix: introducing the "as" alias requires restructuring the surrounding template markup, which is not a safe mechanical rewrite.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-HOOK-PLACEMENT')!,
    rule: {
      ruleId: 'FIGM-REACT-07',
      ruleName: 'Hook Used Inside Conditional, Loop, or Nested Function',
      severity: 'CRITICAL',
      description: 'React relies on Hooks being called in the exact same order on every render to correctly associate state between renders; calling a Hook inside a condition, loop, or nested function makes that order unstable.',
      nonCompliantExample: `function Profile({ isActive }) {\n  if (isActive) {\n    const [count, setCount] = useState(0);\n  }\n}`,
      compliantExample: `function Profile({ isActive }) {\n  const [count, setCount] = useState(0);\n  if (isActive) {\n    // use count here\n  }\n}`,
      remediation: 'Move the Hook call to the top level of the component or custom Hook, unconditionally, and move the condition inside the Hook (or around its result) instead. Evidence: React official documentation, "Rules of Hooks" -- https://react.dev/reference/rules/rules-of-hooks ("Don\'t call Hooks inside loops, conditions, nested functions, or try/catch/finally blocks... Instead, always use Hooks at the top level").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Detects a call to a use-prefixed identifier whose nearest IfStatement/loop-statement/nested-function ancestor is reached before the enclosing component or custom Hook function itself; does not attempt full control-flow-graph reachability (e.g. a Hook called after an early `return` is not distinguished from one after a conditional branch merge). No automated fix: restructuring which Hooks run unconditionally is a logic change only a human can make correctly.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-PROP-MUTATION')!,
    rule: {
      ruleId: 'FIGM-REACT-08',
      ruleName: 'Direct Mutation of Component Props',
      severity: 'CRITICAL',
      description: 'React components must treat their props as read-only, like a pure function treats its arguments; mutating a prop directly breaks the parent\'s ability to reason about its own data and can produce inconsistent renders.',
      nonCompliantExample: `function TodoItem({ todo }) {\n  todo.done = true;\n  return <li>{todo.text}</li>;\n}`,
      compliantExample: `function TodoItem({ todo, onComplete }) {\n  return <li onClick={() => onComplete({ ...todo, done: true })}>{todo.text}</li>;\n}`,
      remediation: 'Never assign to or mutate a destructured prop; derive a new object/array and pass it up via a callback prop, or copy it into local state if the component owns a working copy. Evidence: React official documentation, "Keeping Components Pure" -- https://react.dev/learn/keeping-components-pure (components "must never mutate their inputs... Props... are all considered read only").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Deliberately scoped to props only (not state, which the existing FIGM-REACT-03 already covers) to avoid duplicating that rule -- root-identifier evidence is a destructured props-parameter binding on the enclosing component function, the same file-wide-name-search approach FIGM-REACT-03 already uses and documents the same limitations for (an unrelated same-named identifier elsewhere in the file can be over-matched). No automated fix: the correct way to communicate the change back to the parent (callback prop vs. local copy) is app-specific.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-RENDER-SIDE-EFFECT')!,
    rule: {
      ruleId: 'FIGM-REACT-09',
      ruleName: 'Side Effect Executed During Render',
      severity: 'HIGH',
      description: 'A component function body must be pure with respect to previously-created variables during rendering; I/O and storage calls reached directly during render (not inside an event handler or an Effect) run on every render pass, including React\'s deliberate double-invocation in Strict Mode.',
      nonCompliantExample: `function Logger({ message }) {\n  localStorage.setItem('lastMessage', message);\n  return <p>{message}</p>;\n}`,
      compliantExample: `function Logger({ message }) {\n  useEffect(() => { localStorage.setItem('lastMessage', message); }, [message]);\n  return <p>{message}</p>;\n}`,
      remediation: 'Move the I/O/storage call into an event handler (if triggered by user interaction) or a useEffect callback (if it must run after render), never directly in the component body. Evidence: React official documentation, "Keeping Components Pure" and "Components and Hooks must be pure" -- https://react.dev/learn/keeping-components-pure, https://react.dev/reference/rules/components-and-hooks-must-be-pure ("Side effects should not run in render... In React, side effects usually belong inside event handlers").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'MANUAL_REVIEW_REQUIRED',
      knownLimitation: 'Matches a fixed allow-list of unambiguous I/O-shaped calls (fetch, localStorage.setItem, sessionStorage.setItem) reached directly in a function classified RENDER scope, outside any nested function (so a call already inside a useEffect/event-handler callback in the same component is correctly excluded); a side effect reached indirectly through a called helper function is not detected. Also excludes any ASYNC component function -- a plain React/Client Component cannot be async at all (see FIGM-NEXT-07), so an async component is necessarily a Next.js Server Component, where fetching data directly in the body is the documented, correct pattern, not a purity violation (a real false positive found and fixed during this rule\'s own implementation: fetch() in an async Server Component\'s body was originally flagged here). Disclosed partial overlap: for the specific localStorage/sessionStorage-in-render-scope subset, this rule can co-fire with the existing FIGM-PERF-06 (whose own formal predicate already covers `Scope(n) in {LOOP, RENDER}`, not only loops, despite its rule name) -- the two are not true duplicates (this rule additionally covers fetch(), which FIGM-PERF-06 never checks, and is motivated by React\'s render-purity/Strict-Mode-safety guidance rather than FIGM-PERF-06\'s main-thread-blocking performance framing), but a storage call in a component\'s render body will genuinely trigger both. No automated fix: whether the correct home is an event handler or an Effect depends on what triggers the call.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'ARCHITECTURE',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-COMPONENT-AS-FUNCTION')!,
    rule: {
      ruleId: 'FIGM-REACT-10',
      ruleName: 'Component Function Called Directly Instead of Rendered as JSX',
      severity: 'HIGH',
      description: 'Calling a component function directly (Article()) instead of rendering it as JSX (<Article />) bypasses React\'s own orchestration of when and how the function runs, silently breaking the Rules of Hooks for any Hook the called component uses and losing its component identity in the tree.',
      nonCompliantExample: `function Layout({ children }) {\n  return <div>{Article()}</div>;\n}`,
      compliantExample: `function Layout({ children }) {\n  return <div><Article /></div>;\n}`,
      remediation: 'Render the component as a JSX element (<Article />), never call it as a plain function. Evidence: React official documentation, "React calls Components and Hooks" -- https://react.dev/reference/rules/react-calls-components-and-hooks ("Components should only be used in JSX. Don\'t call them as regular functions... React must decide when your component function is called during rendering").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_WITH_CAVEAT',
      knownLimitation: 'Only recognizes a call to a PascalCase identifier that is also defined in the SAME file as a JSX-returning function, appearing inside a JSX expression container ({...}) -- a component imported from another file and called directly is not traced, and an ordinary PascalCase factory/class-constructor helper that happens to return JSX-shaped data (not an actual component) could be over-matched. The automated fix rewrites Name() to <Name /> only when the call has no arguments; a call passing props positionally (a non-idiomatic but possible shape) is left to manual review since positional arguments cannot be safely mapped to named JSX props.'
    }
  },
  {
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    abstractLanguagePrimitive: CORE_ALPS.find((a) => a.id === 'ALP-REACT-CONTEXT-VALUE')!,
    rule: {
      ruleId: 'FIGM-REACT-11',
      ruleName: 'Unmemoized Context Provider Value',
      severity: 'HIGH',
      description: 'A Context.Provider value prop set to a fresh inline object/array literal is a new reference on every render, so React re-renders every consuming component on every render of the provider, regardless of whether the actual data changed.',
      nonCompliantExample: `function AuthProvider({ children }) {\n  const [user, setUser] = useState(null);\n  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;\n}`,
      compliantExample: `function AuthProvider({ children }) {\n  const [user, setUser] = useState(null);\n  const value = useMemo(() => ({ user, setUser }), [user]);\n  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;\n}`,
      remediation: 'Wrap the Provider\'s value in useMemo, keyed on the actual data it depends on, instead of constructing the object/array inline in JSX. Evidence: React official documentation, useContext reference -- https://react.dev/reference/react/useContext ("Changes are determined by comparing the new and old value using the same algorithm as Object.is... wrap the state in useMemo to prevent unnecessary re-renders").',
      frameworks: ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE'],
      isFrameworkIndependent: false,
      remediationStatus: 'AUTOMATED_FIX_VERIFIED',
      knownLimitation: 'Replaces an earlier candidate ("Hook used outside an allowed React function context"), which research found was the same underlying React documentation and effectively the same ESLint rule (react-hooks/rules-of-hooks) as the accepted FIGM-REACT-07, making the two an artificial split of one guideline rather than genuinely separate coverage -- see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md. Deliberately distinct from the existing FIGM-PERF-01 (which only matches an object literal that is a `const x = {...}` variable-declaration initializer): a `value={{...}}` JSX attribute expression is a different AST shape PERF-01\'s builder does not cover, so the two rules are complementary, not overlapping. Only matches a *.Provider element (or the React 19 `<Context value={...}>` shorthand is not yet covered) whose value attribute is a literal object/array expression, not a call wrapped in useMemo.'
    }
  }
];

/**
 * Per-rule WCAG 2.2 Success Criterion mapping for the 7 FIGM-A11Y-* rules.
 *
 * Correction (final implementation pass, Section 8 defect): the code this replaces generated a
 * single shared `{ clause: 'SC 2.1.1', title: m.concern, level: 'A' }` object for every
 * ACCESSIBILITY-domain rule regardless of which concern it actually addressed
 * (`generateMasterSpecification`'s `isPerf` ternary, previously at this location) -- so 6 of the 7
 * accessibility rules carried a WCAG citation that did not match their actual concern (only
 * FIGM-A11Y-01, whose concern genuinely is KEYBOARD_ACCESSIBILITY, was correct, and only by
 * coincidence). Each entry below was independently derived from the rule's own `concern` and
 * `description`/`remediation` text against the WCAG 2.2 specification
 * (https://www.w3.org/TR/WCAG22/), not copied from any prior audit's proposed mapping, and each
 * carries its own `mappingRationale` so the choice can be checked on its own merits.
 *
 * `automatedDetectability` follows the master audit's classification vocabulary
 * (DIRECT_STATIC_CHECK / PARTIAL_STATIC_CHECK / HEURISTIC / MANUAL_REVIEW_REQUIRED /
 * NOT_SUPPORTED) -- distinct from whether a mapping exists at all: a rule can correctly cite the
 * right Success Criterion while still only approximating compliance with it.
 *
 * tests/wcag-mapping-integrity.test.ts asserts every FIGM-A11Y-* rule ID is present here, that no
 * two rules whose `concern` differs share the same `clause`, and that no rule is missing a
 * `mappingRationale` -- specifically to prevent this collapse-onto-one-SC defect from recurring.
 */
export const WCAG_22_MAPPINGS: Record<string, StandardTraceability> = {
  'FIGM-A11Y-01': {
    standard: 'WCAG_2_2',
    clause: 'SC 2.1.1',
    title: 'Keyboard',
    level: 'A',
    mappingRationale: 'The rule concern is literally KEYBOARD_ACCESSIBILITY -- a pointer-only handler with no keyboard equivalent is the canonical violation of "all functionality is operable through a keyboard interface" (SC 2.1.1).',
    automatedDetectability: 'HEURISTIC'
  },
  'FIGM-A11Y-02': {
    standard: 'WCAG_2_2',
    clause: 'SC 4.1.2',
    title: 'Name, Role, Value',
    level: 'A',
    mappingRationale: 'A custom interactive control with no role/aria-label/aria-labelledby fails to expose a programmatically-determinable name and role to assistive technology -- the defining condition of SC 4.1.2, not SC 2.1.1 (Keyboard), which this rule does not check.',
    automatedDetectability: 'HEURISTIC'
  },
  'FIGM-A11Y-03': {
    standard: 'WCAG_2_2',
    clause: 'SC 4.1.3',
    title: 'Status Messages',
    level: 'AA',
    mappingRationale: 'A dynamic status/feedback container updated without aria-live or role="status"/"alert" is precisely what SC 4.1.3 (added in WCAG 2.1, carried into 2.2) requires assistive technology be notified of without receiving focus.',
    automatedDetectability: 'HEURISTIC'
  },
  'FIGM-A11Y-04': {
    standard: 'WCAG_2_2',
    clause: 'SC 2.4.3',
    title: 'Focus Order',
    level: 'A',
    mappingRationale: 'Failing to restore/redirect focus when a modal/overlay closes breaks the logical, meaning-preserving focus sequence SC 2.4.3 requires. WCAG 2.2 has no single SC named exactly "focus containment"; 2.4.3 is the established general criterion cited by WCAG technique documentation (e.g. G59) for this class of focus-management defect.',
    automatedDetectability: 'HEURISTIC'
  },
  'FIGM-A11Y-05': {
    standard: 'WCAG_2_2',
    clause: 'SC 4.1.2',
    title: 'Name, Role, Value',
    level: 'A',
    mappingRationale: 'An unlabelled form input has no programmatically-determinable accessible name (SC 4.1.2); it typically also fails SC 1.3.1 (Info and Relationships) since the label-input relationship is not conveyed structurally, but 4.1.2 is the more direct, singular fit for "missing an accessible name" specifically.',
    automatedDetectability: 'PARTIAL_STATIC_CHECK'
  },
  'FIGM-A11Y-06': {
    standard: 'WCAG_2_2',
    clause: 'SC 2.4.3',
    title: 'Focus Order',
    level: 'A',
    mappingRationale: 'A positive tabindex forces an element out of the document\'s natural tab sequence into an explicit numeric position, which is exactly the "focus order preserves meaning and operability" violation SC 2.4.3 addresses -- this is the standard mapping used by WCAG technique F44 and mainstream accessibility linters for this pattern.',
    automatedDetectability: 'DIRECT_STATIC_CHECK'
  },
  'FIGM-A11Y-07': {
    standard: 'WCAG_2_2',
    clause: 'SC 2.5.3',
    title: 'Label in Name',
    level: 'A',
    mappingRationale: 'The rule\'s own concern is literally INPUT_MODALITIES -- WCAG guideline 2.5 is titled "Input Modalities," and SC 2.5.3 ("Label in Name") is the exact success criterion requiring a control\'s accessible name to contain the text of its visible label, which is precisely what this rule checks.',
    automatedDetectability: 'PARTIAL_STATIC_CHECK'
  }
};

/**
 * Research-facing primary domain: distinguishes ARCHITECTURE/CODE_QUALITY from STATIC_PERFORMANCE
 * within what the registry's own `domain` field flatly calls "PERFORMANCE" -- the latest audit
 * found `domain` only ever takes two values (PERFORMANCE, ACCESSIBILITY), with architecture rules
 * hidden inside a `concern: 'ARCHITECTURE'` sub-bucket of PERFORMANCE. Rather than renaming
 * `domain` itself (a breaking change to every existing consumer keyed on `domain === 'PERFORMANCE'`
 * -- the rule-execution pipeline, dashboards, and generated reports), this derives the
 * research-facing three-way split as an additive field so dissertation tables/admin UI/API
 * consumers can group rules correctly without re-deriving the `concern === 'ARCHITECTURE'` special
 * case themselves in multiple places. No rule is duplicated across domains -- every rule maps to
 * exactly one of the three values. */
export function primaryResearchDomain(domain: string, concern: string): 'ARCHITECTURE' | 'STATIC_PERFORMANCE' | 'ACCESSIBILITY' {
  if (domain === 'ACCESSIBILITY') return 'ACCESSIBILITY';
  if (concern === 'ARCHITECTURE') return 'ARCHITECTURE';
  return 'STATIC_PERFORMANCE';
}

export function generateMasterSpecification(): FIGMMasterSpecification & {
  universalASTQueryTemplates: typeof QUERY_TEMPLATES;
  frameworkASTTranslations: typeof FRAMEWORK_TRANSLATIONS;
} {
  return {
    meta: {
      title: 'Framework-Independent Guideline Model (FIGM) Master Specification',
      // Bumped 2.0.0 -> 2.1.0 (Pre-Freeze Technical Completion Pass) -- MINOR, not MAJOR: the
      // rule set is still the same 50 canonical rules with the same taxonomy shape (domain/
      // concern/severity/framework scope unchanged for every rule), so this is not a breaking
      // change to the specification's structure. What changed and warrants a real version bump,
      // not a silent one: (1) all 7 accessibility rules' WCAG Success Criterion mapping was
      // corrected (6 of 7 previously cited the wrong SC); (2) FIGM-ANG-07's detection eligibility
      // was narrowed to require real Angular evidence on GENERIC_ESTREE files, closing a confirmed
      // real-world false-positive class; (3) the Angular inline-template extraction fallback was
      // narrowed to require a template-shaped filename, closing a confirmed real-world false
      // parse-error class. All three are corrections to existing rules' citable behavior/metadata,
      // not new rules or a taxonomy redesign -- see docs/research/EXPERIMENT_FREEZE.md for the
      // full decision record.
      version: '2.1.0',
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
        primaryResearchDomain: primaryResearchDomain(m.domain, m.concern),
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
          : (() => {
              // Per-rule lookup, never a shared default -- see WCAG_22_MAPPINGS's doc comment for
              // why (this replaces a defect where every accessibility rule collapsed onto the same
              // hardcoded SC 2.1.1). Throwing on a miss is deliberate: a newly-added accessibility
              // rule with no entry here must fail spec generation loudly, not silently inherit an
              // unrelated rule's WCAG citation.
              const mapping = WCAG_22_MAPPINGS[m.rule.ruleId];
              if (!mapping) {
                throw new Error(`No WCAG_22_MAPPINGS entry for accessibility rule ${m.rule.ruleId} -- add one to src/matrix/four-layer-meta-model.ts before this rule can be exported.`);
              }
              return mapping;
            })(),
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
