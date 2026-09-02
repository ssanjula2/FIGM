# FIGM Guideline Rule Reference

This is the complete list of all 50 rules in the FIGM guideline taxonomy. Use this sheet to
classify any violation you find in the fixture files — pick the `Rule ID` that best matches what
you observed. **This list intentionally does not indicate which rules apply to which fixture
file** — that determination is entirely yours to make as part of the annotation task.

If something looks wrong in the code but doesn't clearly match any rule below, write
`OTHER` as the Rule ID and describe it in your own words in the notes column.

| Rule ID | Name | Severity | What it flags |
|---|---|---|---|
| FIGM-A11Y-01 | Keyboard Event Parity on Pointer Handlers | CRITICAL | Non-interactive elements with pointer click listeners must provide keyboard listeners and focusability. |
| FIGM-A11Y-02 | Accessible Name and Role for Custom UI Controls | HIGH | Custom UI controls must explicitly define an ARIA role and an accessible name. |
| FIGM-A11Y-03 | ARIA Live Announcer for Dynamic Mutations | HIGH | Containers populated with dynamic status messages must possess ARIA live attributes. |
| FIGM-A11Y-04 | Dynamic Focus Containment and Traversal | CRITICAL | Modal overlays must trap keyboard focus and restore focus to trigger element upon exit. |
| FIGM-A11Y-05 | Form Input Label Association | CRITICAL | Form input elements must be explicitly associated with a label element or aria-label. |
| FIGM-A11Y-06 | Avoid Positive TabIndex Values | HIGH | Positive tabindex values (>0) disrupt natural document focus navigation order. |
| FIGM-A11Y-07 | Accessible Name Must Contain Visible Label Text | HIGH | When an interactive element has visible text content, its programmatic accessible name (aria-label) must contain that visible text, per WCAG 2.2 SC 2.5.3 Label in Name -- otherwise speech-input users who speak the visible label cannot activate the control. |
| FIGM-ANG-01 | Unsubscribe RxJS Subscriptions | CRITICAL | RxJS subscriptions created inside Angular services/components must be cleaned up on destroy. |
| FIGM-ANG-02 | Angular OnPush Change Detection Strategy | HIGH | Angular components should specify ChangeDetectionStrategy.OnPush to minimize change detection cycles. |
| FIGM-ANG-03 | Angular *ngFor trackBy Function Reference | HIGH | *ngFor structural directives missing trackBy cause full DOM node destruction and re-creation on update. |
| FIGM-ANG-04 | Minimize Method Invocations in Angular Templates | HIGH | Calling component methods inside Angular HTML templates executes the method on every change detection cycle. |
| FIGM-ANG-05 | Renderer2 DOM Manipulation Safety | HIGH | Direct ElementRef nativeElement DOM manipulation bypasses Angular security and server-side rendering. |
| FIGM-ANG-06 | Impure Angular Pipe Declaration | HIGH | An Angular @Pipe declared with pure: false has its transform() method invoked on every change-detection cycle regardless of whether its arguments changed, which Angular's own API reference documents as the defining behavior of an impure pipe. |
| FIGM-ANG-07 | Complex Logic in Angular Component Constructor | MEDIUM | Non-trivial initialization logic (service calls, subscriptions, computation) placed directly in a component's constructor runs before Angular has set up @Input()/@Output() bindings, and is harder to test than an equivalent ngOnInit or well-named method. |
| FIGM-ANG-08 | Unstable @for Track Expression | HIGH | Modern Angular @for blocks require a track expression, but tracking by the loop index or the whole loop variable (an object reference that changes whenever the source array is recreated) defeats the purpose just as surely as omitting trackBy did for the legacy *ngFor -- it should reference a stable, unique property such as an id. |
| FIGM-ANG-09 | Mutable Signal Input Declaration | MEDIUM | A class property initialized via the modern input() signal function is a read-only signal at runtime; omitting the readonly TypeScript modifier lets other code in the same class accidentally reassign the property, hiding a bug the type system could otherwise catch. |
| FIGM-ANG-10 | Duplicate Async Pipe Subscriptions in Template | MEDIUM | Each use of the async pipe on an observable creates its own independent subscription; piping the same observable expression through \| async more than once in one template silently doubles (or triples) the underlying work -- including duplicate HTTP requests for a fetch-backed stream. |
| FIGM-NEXT-01 | React Hooks Require "use client" Directive | CRITICAL | React state or lifecycle hooks inside Next.js App Router files require "use client" directive. |
| FIGM-NEXT-02 | Dynamic Imports for Heavy Browser Modules | HIGH | Heavy client libraries should be imported dynamically using next/dynamic with ssr: false. |
| FIGM-NEXT-03 | App Router Route Segment Revalidation | MEDIUM | App Router pages serving dynamic data must define route segment cache revalidation behavior. |
| FIGM-NEXT-04 | Zero-Layout-Shift Web Fonts via next/font | MEDIUM | Web fonts loaded via external CSS link tags cause layout shifts; use next/font instead. |
| FIGM-NEXT-05 | Server-Only Module Imported Across the Client Boundary | CRITICAL | A file marked "use client" that imports a Node.js server-only built-in module (fs, path, crypto, net, child_process, dns, tls) pulls that module into the client module graph, which Next.js's own documentation identifies as a real risk of environment poisoning -- secrets or server-only logic reachable from client code. |
| FIGM-NEXT-06 | Native <img> Instead of next/image | MEDIUM | A native lowercase <img> element inside a Next.js file forgoes the framework's built-in automatic image optimization (responsive sizing, lazy loading, modern format negotiation) that the next/image Image component provides out of the box. |
| FIGM-NEXT-07 | Async Client Component Misuse | HIGH | A component function in a file marked "use client" must not be declared async -- React Client Components do not support async component functions. |
| FIGM-NEXT-08 | useSearchParams Without a Suspense Boundary | HIGH | Reading useSearchParams() in a prerendered route without a wrapping <Suspense> boundary opts the entire Client Component tree up to that boundary into client-side rendering. |
| FIGM-NEXT-09 | Metadata API Used from an Invalid Client Boundary | CRITICAL | The metadata export and generateMetadata/generateViewport functions are only supported in Server Components, because metadata must be resolved on the server before the page renders. |
| FIGM-NEXT-10 | Unnecessary Forced Dynamic Rendering | MEDIUM | export const dynamic = "force-dynamic" disables static rendering and caching for a route; when nothing in the file actually reads request-time data, this forfeits performance for no visible benefit. |
| FIGM-PERF-01 | Invariant Object Allocation in Iteration Scopes | HIGH | Objects, arrays, functions, or regex literals must not be instantiated inside loops or render iteration routines. |
| FIGM-PERF-02 | Un-dimensioned Dynamic Layout Elements | HIGH | Dynamic media and layout container elements must include explicit dimensions or aspect-ratio attributes. |
| FIGM-PERF-03 | Unbounded Event Listener Disposal | CRITICAL | Target event listeners registered within component lifecycle scopes must have corresponding disposal handlers. |
| FIGM-PERF-04 | Static Imports in Deferred Execution Paths | MEDIUM | Modules used only in conditional or deferred execution branches must be dynamically imported. |
| FIGM-PERF-05 | Inline Anonymous Callbacks in Render Scope | MEDIUM | Inline arrow functions created directly in render scope -- including but not limited to render/map loops -- cause unnecessary re-instantiation on every render. |
| FIGM-PERF-06 | Synchronous Storage Access in Loop Scope | HIGH | Repeated synchronous Web Storage API calls inside loops block main thread execution. |
| FIGM-REACT-01 | Memoize Expensive Derived Computations | HIGH | Expensive array sorting or filtering operations inside render routines should be wrapped in useMemo. |
| FIGM-REACT-02 | Stable List Key Prop Assignment | HIGH | Array indices assigned as list key props cause invalid component re-ordering and state bugs. |
| FIGM-REACT-03 | Avoid Direct React State Mutation | CRITICAL | Directly mutating React state variables skips component re-renders and breaks component updates. |
| FIGM-REACT-04 | Wrap Child Callback Props in useCallback | MEDIUM | Passing inline arrow functions to memoized child components invalidates child re-rendering. |
| FIGM-REACT-05 | Effect Used Solely to Derive State | MEDIUM | A useEffect whose entire body is a single call to a state setter is computing derived state reactively instead of during render, which React's own documentation identifies as unnecessary: it forces an extra render pass and makes data flow harder to follow. |
| FIGM-REACT-06 | Missing Reactive Dependency in Effect Hook | HIGH | A useEffect callback that reads a component prop must list that prop in its dependency array, or the Effect will run against a stale value from an earlier render -- React's documentation is explicit that dependencies cannot be chosen manually, only computed from what the Effect actually reads. |
| FIGM-REACT-07 | Hook Used Inside Conditional, Loop, or Nested Function | CRITICAL | React relies on Hooks being called in the exact same order on every render to correctly associate state between renders; calling a Hook inside a condition, loop, or nested function makes that order unstable. |
| FIGM-REACT-08 | Direct Mutation of Component Props | CRITICAL | React components must treat their props as read-only, like a pure function treats its arguments; mutating a prop directly breaks the parent's ability to reason about its own data and can produce inconsistent renders. |
| FIGM-REACT-09 | Side Effect Executed During Render | HIGH | A component function body must be pure with respect to previously-created variables during rendering; I/O and storage calls reached directly during render (not inside an event handler or an Effect) run on every render pass, including React's deliberate double-invocation in Strict Mode. |
| FIGM-REACT-10 | Component Function Called Directly Instead of Rendered as JSX | HIGH | Calling a component function directly (Article()) instead of rendering it as JSX (<Article />) bypasses React's own orchestration of when and how the function runs, silently breaking the Rules of Hooks for any Hook the called component uses and losing its component identity in the tree. |
| FIGM-REACT-11 | Unmemoized Context Provider Value | HIGH | A Context.Provider value prop set to a fresh inline object/array literal is a new reference on every render, so React re-renders every consuming component on every render of the provider, regardless of whether the actual data changed. |
| FIGM-VUE-01 | Unstable or Missing v-for Key Binding | HIGH | A v-for directive without a :key binding (or with :key bound to the loop index) prevents Vue from tracking each node's identity across re-renders, causing incorrect state reuse and unnecessary DOM patching -- the Vue.js team's own style guide lists this as an Essential (Priority A) rule. |
| FIGM-VUE-02 | Combined v-if and v-for on the Same Element | HIGH | Vue evaluates v-if on every iteration when it is combined with v-for on the same element, re-running the condition once per item every re-render instead of filtering the list once -- the Vue.js team's own style guide lists avoiding this combination as an Essential (Priority A) rule. |
| FIGM-VUE-03 | Side Effect Inside Computed Getter | HIGH | A Vue computed() getter must be a pure derivation; mutating other state, making async/IO calls, or mutating the DOM inside it breaks Vue's dependency-tracking model. |
| FIGM-VUE-04 | Direct Mutation of Computed Result | HIGH | Mutating the object/array a computed ref currently holds (via its .value) from outside the computed's own definition silently breaks the "computed is a pure derivation" contract without triggering Vue's own reassignment warning, since Vue only warns on reassigning .value itself, not on mutating what it points to. |
| FIGM-VUE-05 | Direct Prop Mutation | CRITICAL | Props form a one-way-down binding from parent to child; mutating a prop directly inside the child is silently overwritten whenever the parent re-renders and makes the app's data flow harder to reason about. |
| FIGM-VUE-06 | Arrow Function Used as Options API Method | HIGH | Vue binds `this` to the component instance for every Options API method, EXCEPT when the method is declared as an arrow function -- arrow functions capture the enclosing (module-level) `this`, so `this.someOtherMethod` inside them is undefined. |

## Severity scale

- **CRITICAL** — Functional/correctness breakage, or a hard accessibility barrier.
- **HIGH** — Meaningful quality or accessibility defect, not a hard blocker.
- **MEDIUM** — Optimization/best-practice gap with a smaller impact.

---
_Generated by `scripts/generate-annotation-package.ts` from `RULE_CATALOG`
(`src/matrix/rule-registry.ts`) -- do not hand-edit; re-run
`npm run research:generate-annotation-package` after any rule-set change._
