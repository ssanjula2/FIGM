# FIGM Guideline / Standard Traceability — Forensic Audit

Date: 2026-08-12
Method: Direct inspection of `src/matrix/four-layer-meta-model.ts` (`FOUR_LAYER_MAPPINGS`, 25 entries, confirmed by direct enumeration) and the live diagnostic-emission path (`src/ast/ast-detection-engine.ts`). Wording below deliberately uses "aligned with" / "mapped to" rather than "certified" / "verified" — no formal certification process or third-party audit against ISO/IEC 25010 or WCAG 2.2 has been performed for this tool, and none should be implied.

## 1. What actually happens at runtime (the live path)

Every diagnostic emitted by a real scan goes through `ASTDetectionEngine.createReport()`, which assigns `standardReference` with a single two-way ternary:

```ts
// src/ast/ast-detection-engine.ts:281
standardReference: mapping.domain === 'PERFORMANCE' ? 'ISO 25010' : 'WCAG 2.2'
```

This is **coarse and domain-level only** — it does not cite a specific ISO/IEC 25010 sub-characteristic or a specific WCAG 2.2 success criterion number in the diagnostic object returned to users. All 19 `PERFORMANCE`-domain rules are labeled `'ISO 25010'`; all 6 `ACCESSIBILITY`-domain rules are labeled `'WCAG 2.2'`. There is no third live-path branch — every rule in the system is currently one of these two domains.

## 2. A richer traceability model exists in source but is NOT wired into the live scan path

`src/matrix/four-layer-meta-model.ts`'s `generateMasterSpecification()` and `src/pipeline/guideline-filtering.ts`'s 3-stage filtering pipeline build a more detailed traceability object (with elimination reasoning and a `standardTraceability`-style structure) — but grep confirms neither is imported by `rule-execution-engine.ts`, `ast-detection-engine.ts`, or `app/api/scan/route.ts`. It is reachable only via `tests/guideline-filtering.test.ts` and the offline `npm run generate-spec` export. Treat any documentation or dissertation chapter that quotes clause-level detail from this richer model as describing a **design artifact**, not what a live scan actually returns to a user.

## 3. Full rule inventory (25 rules, confirmed by direct enumeration of `FOUR_LAYER_MAPPINGS`)

| Rule ID | Rule Name | Domain | Concern | Severity | Live `standardReference` | Defensible alignment (interpretive, not a formal crosswalk) |
|---|---|---|---|---|---|---|
| FIGM-PERF-01 | Invariant Object Allocation in Iteration Scopes | PERFORMANCE | INVARIANT_ALLOCATIONS | HIGH | ISO 25010 | Performance Efficiency → Resource Utilization |
| FIGM-PERF-02 | Un-dimensioned Dynamic Layout Elements | PERFORMANCE | LAYOUT_INSTABILITY | HIGH | ISO 25010 | Performance Efficiency → Time Behavior (layout thrash / CLS) |
| FIGM-PERF-03 | Unbounded Event Listener Disposal | PERFORMANCE | ASYNC_LEAKS | CRITICAL | ISO 25010 | Performance Efficiency → Resource Utilization (memory leak) |
| FIGM-PERF-04 | Static Imports in Deferred Execution Paths | PERFORMANCE | BUNDLE_SIZE | MEDIUM | ISO 25010 | Performance Efficiency → Resource Utilization (bundle/transfer size) |
| FIGM-PERF-05 | Inline Anonymous Callbacks in Render Loops | PERFORMANCE | INVARIANT_ALLOCATIONS | MEDIUM | ISO 25010 | Performance Efficiency → Resource Utilization |
| FIGM-PERF-06 | Synchronous Storage Access in Loop Scope | PERFORMANCE | RESOURCE_UTILIZATION | HIGH | ISO 25010 | Performance Efficiency → Time Behavior |
| FIGM-A11Y-01 | Keyboard Event Parity on Pointer Handlers | ACCESSIBILITY | KEYBOARD_ACCESSIBILITY | CRITICAL | WCAG 2.2 | Guideline 2.1 Keyboard Accessible (2.1.1) |
| FIGM-A11Y-02 | Accessible Name and Role for Custom UI Controls | ACCESSIBILITY | NAME_ROLE_VALUE | HIGH | WCAG 2.2 | Guideline 4.1 Compatible (4.1.2 Name, Role, Value) |
| FIGM-A11Y-03 | ARIA Live Announcer for Dynamic Mutations | ACCESSIBILITY | STATUS_MESSAGES | HIGH | WCAG 2.2 | Guideline 4.1 Compatible (4.1.3 Status Messages) |
| FIGM-A11Y-04 | Dynamic Focus Containment and Traversal | ACCESSIBILITY | FOCUS_ORDER | CRITICAL | WCAG 2.2 | Guideline 2.4 Navigable (2.4.3 Focus Order) |
| FIGM-A11Y-05 | Form Input Label Association | ACCESSIBILITY | NAME_ROLE_VALUE | CRITICAL | WCAG 2.2 | Guideline 1.3/4.1 (1.3.1 Info & Relationships; 4.1.2) |
| FIGM-A11Y-06 | Avoid Positive TabIndex Values | ACCESSIBILITY | FOCUS_ORDER | HIGH | WCAG 2.2 | Guideline 2.4 Navigable (2.4.3 Focus Order) |
| FIGM-NEXT-01 | React Hooks Require "use client" Directive | PERFORMANCE | ARCHITECTURE | CRITICAL | ISO 25010 | Compatibility / Performance Efficiency (framework contract correctness) |
| FIGM-NEXT-02 | Dynamic Imports for Heavy Browser Modules | PERFORMANCE | BUNDLE_SIZE | HIGH | ISO 25010 | Performance Efficiency → Resource Utilization |
| FIGM-NEXT-03 | App Router Route Segment Revalidation | PERFORMANCE | ARCHITECTURE | MEDIUM | ISO 25010 | Performance Efficiency → Time Behavior (staleness/freshness) |
| FIGM-NEXT-04 | Zero-Layout-Shift Web Fonts via next/font | PERFORMANCE | LAYOUT_INSTABILITY | MEDIUM | ISO 25010 | Performance Efficiency → Time Behavior (CLS) |
| FIGM-REACT-01 | Memoize Expensive Derived Computations | PERFORMANCE | INVARIANT_ALLOCATIONS | HIGH | ISO 25010 | Performance Efficiency → Resource Utilization |
| FIGM-REACT-02 | Stable List Key Prop Assignment | PERFORMANCE | LAYOUT_INSTABILITY | HIGH | ISO 25010 | Functional Suitability / Performance Efficiency (re-render correctness) |
| FIGM-REACT-03 | Avoid Direct React State Mutation | PERFORMANCE | INVARIANT_ALLOCATIONS | CRITICAL | ISO 25010 | Functional Suitability → Functional Correctness |
| FIGM-REACT-04 | Wrap Child Callback Props in useCallback | PERFORMANCE | INVARIANT_ALLOCATIONS | MEDIUM | ISO 25010 | Performance Efficiency → Resource Utilization |
| FIGM-ANG-01 | Unsubscribe RxJS Subscriptions | PERFORMANCE | ASYNC_LEAKS | CRITICAL | ISO 25010 | Performance Efficiency → Resource Utilization (memory leak) |
| FIGM-ANG-02 | Angular OnPush Change Detection Strategy | PERFORMANCE | ARCHITECTURE | HIGH | ISO 25010 | Performance Efficiency → Time Behavior |
| FIGM-ANG-03 | Angular *ngFor trackBy Function Reference | PERFORMANCE | LAYOUT_INSTABILITY | HIGH | ISO 25010 | Performance Efficiency → Time Behavior |
| FIGM-ANG-04 | Minimize Method Invocations in Angular Templates | PERFORMANCE | INVARIANT_ALLOCATIONS | HIGH | ISO 25010 | Performance Efficiency → Time Behavior |
| FIGM-ANG-05 | Renderer2 DOM Manipulation Safety | PERFORMANCE | ARCHITECTURE | HIGH | ISO 25010 | Security / Reliability (safe DOM abstraction) |

## 4. Explicit findings (do not overstate)

- **Not every performance rule is a WCAG rule, and vice versa** — confirmed: the 19 `PERFORMANCE`-domain rules are 100% disjoint from the 6 `ACCESSIBILITY`-domain rules in this codebase; there is no rule that carries both labels.
- **No certification claim is supported.** Nothing in this repository indicates a formal WCAG conformance audit or an ISO/IEC 25010 assessment was performed by a certifying body. Any dissertation wording should read "designed according to" / "aligned with" ISO/IEC 25010 and WCAG 2.2 principles, never "WCAG 2.2 certified" or "ISO 25010 verified."
- **The clause-level column above is this auditor's interpretive mapping**, not sourced from an authoritative FIGM-to-standard crosswalk document maintained in the repo. The only clause-level mapping that actually exists in source is in the unwired `four-layer-meta-model.ts`/`guideline-filtering.ts` path (§2) — if a dissertation cites specific WCAG success-criterion numbers per rule, that citation should point to those files as the design source, explicitly noting they are not connected to the live scan output.
- **The live `standardReference` field returned to end users** is only ever the string `'ISO 25010'` or `'WCAG 2.2'` — no clause number, no success-criterion ID. A user or examiner inspecting actual scan output cannot get more granular traceability than "this is a performance rule" or "this is an accessibility rule" without reading the source code.

## 5. Recommendation

If per-rule clause-level traceability is a dissertation requirement, the `standardTraceability` structure already designed in `four-layer-meta-model.ts` should be wired into `ASTDetectionEngine.createReport()` (replacing the two-way ternary) rather than left as a disconnected design artifact — this was not done in this audit session per the explicitly agreed scope (no core-engine changes beyond the fixed priority list).
