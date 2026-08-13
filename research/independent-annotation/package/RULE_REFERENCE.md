# FIGM Guideline Rule Reference

This is the complete list of all 25 rules in the FIGM guideline taxonomy. Use this sheet to
classify any violation you find in the fixture files — pick the `Rule ID` that best matches what
you observed. **This list intentionally does not indicate which rules apply to which fixture
file** — that determination is entirely yours to make as part of the annotation task.

If something looks wrong in the code but doesn't clearly match any rule below, write
`OTHER` as the Rule ID and describe it in your own words in the notes column.

| Rule ID | Name | Severity | What it flags |
|---|---|---|---|
| FIGM-PERF-01 | Invariant Object Allocation in Iteration Scopes | HIGH | Objects, arrays, functions, or regex literals instantiated inside loops or render iteration routines. |
| FIGM-PERF-02 | Un-dimensioned Dynamic Layout Elements | HIGH | Dynamic media/layout container elements missing explicit dimensions or aspect-ratio attributes. |
| FIGM-PERF-03 | Unbounded Event Listener Disposal | CRITICAL | Event listeners registered within component lifecycle scopes without a corresponding disposal/removal handler. |
| FIGM-PERF-04 | Static Imports in Deferred Execution Paths | MEDIUM | Modules used only in conditional/deferred execution branches, imported statically instead of dynamically. |
| FIGM-PERF-05 | Inline Anonymous Callbacks in Render Loops | MEDIUM | Inline arrow functions created inside render map loops, causing unnecessary re-instantiation. |
| FIGM-PERF-06 | Synchronous Storage Access in Loop Scope | HIGH | Repeated synchronous Web Storage API (`localStorage`/`sessionStorage`) calls inside loops. |
| FIGM-A11Y-01 | Keyboard Event Parity on Pointer Handlers | CRITICAL | Non-interactive elements with pointer click listeners but no keyboard listener/focusability. |
| FIGM-A11Y-02 | Accessible Name and Role for Custom UI Controls | HIGH | Custom UI controls missing an explicit ARIA role and accessible name. |
| FIGM-A11Y-03 | ARIA Live Announcer for Dynamic Mutations | HIGH | Containers populated with dynamic status messages, missing ARIA live attributes. |
| FIGM-A11Y-04 | Dynamic Focus Containment and Traversal | CRITICAL | Modal overlays that don't trap keyboard focus and restore it to the trigger element on exit. |
| FIGM-A11Y-05 | Form Input Label Association | CRITICAL | Form input elements not explicitly associated with a label element or `aria-label`. |
| FIGM-A11Y-06 | Avoid Positive TabIndex Values | HIGH | Explicit positive `tabindex` (>0) values, which disrupt natural focus navigation order. |
| FIGM-NEXT-01 | React Hooks Require "use client" Directive | CRITICAL | React state/lifecycle hooks used inside a Next.js App Router file lacking `"use client"`. |
| FIGM-NEXT-02 | Dynamic Imports for Heavy Browser Modules | HIGH | Heavy client-only libraries imported statically instead of via `next/dynamic` with `ssr: false`. |
| FIGM-NEXT-03 | App Router Route Segment Revalidation | MEDIUM | App Router pages serving dynamic data without a route segment cache/revalidation config. |
| FIGM-NEXT-04 | Zero-Layout-Shift Web Fonts via next/font | MEDIUM | Web fonts loaded via an external CSS `<link>` tag instead of `next/font`. |
| FIGM-REACT-01 | Memoize Expensive Derived Computations | HIGH | Expensive array sort/filter/reduce operations inside render, not wrapped in `useMemo`. |
| FIGM-REACT-02 | Stable List Key Prop Assignment | HIGH | Array indices assigned as a list `key` prop instead of a stable identifier. |
| FIGM-REACT-03 | Avoid Direct React State Mutation | CRITICAL | Directly mutating a React state variable instead of calling its setter. |
| FIGM-REACT-04 | Wrap Child Callback Props in useCallback | MEDIUM | Inline arrow functions passed as callback props to child components, not wrapped in `useCallback`. |
| FIGM-ANG-01 | Unsubscribe RxJS Subscriptions | CRITICAL | RxJS subscriptions created in an Angular component/service without cleanup on destroy. |
| FIGM-ANG-02 | Angular OnPush Change Detection Strategy | HIGH | Angular components not specifying `ChangeDetectionStrategy.OnPush`. |
| FIGM-ANG-03 | Angular *ngFor trackBy Function Reference | HIGH | `*ngFor` structural directives missing a `trackBy` function reference. |
| FIGM-ANG-04 | Minimize Method Invocations in Angular Templates | HIGH | Component method calls inside Angular HTML templates (re-executed every change-detection cycle). |
| FIGM-ANG-05 | Renderer2 DOM Manipulation Safety | HIGH | Direct `ElementRef.nativeElement` DOM manipulation instead of going through `Renderer2`. |

## Severity scale

- **CRITICAL** — Functional/correctness breakage, or a hard accessibility barrier.
- **HIGH** — Meaningful quality or accessibility defect, not a hard blocker.
- **MEDIUM** — Optimization/best-practice gap with a smaller impact.
