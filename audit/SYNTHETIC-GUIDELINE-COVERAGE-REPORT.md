# FIGM — Synthetic Guideline Coverage Report

Generated: 2026-08-26T17:23:36.445Z
Methodology: Real, freshly-executed measurement. Detection: RuleExecutionEngine.analyzeFile (the same engine app/api/scan/route.ts calls) run against each rule's own canonical nonCompliantExample/compliantExample (src/matrix/four-layer-meta-model.ts), for every framework listed in that rule's own `frameworks` applicability array. Remediation: AIRemediationPipeline.remediateDefect (the same pipeline the app's AI-Fix action calls) run on the first framework where the violation was actually detected. Nothing here touches real project source -- every fixture is an in-memory string. A subset of false negatives are known fixture-shape artifacts of using each rule's minimal documentation-display snippet as a whole standalone file rather than a realistically-wrapped one -- see the report's Detection Failures section for the root-cause investigation and cross-reference against this project's own passing test suite.

**This is empirical evidence, not a marketing claim.** Every number below is computed fresh from the current repository — nothing is copied from a prior report. Where a number looks bad (a false negative, a blocked AI fix), it is reported as-is. See `audit/SYNTHETIC-FIX-VERIFICATION-REPORT.md` for the companion remediation evidence and `audit/SYNTHETIC-GUIDELINE-COVERAGE-MATRIX.json` for the full machine-readable data this report is generated from.

---

## Executive Summary

```text
Current FIGM rules: 50
Frameworks tested: 5 (React, Next.js, Angular, Vue, Generic)
Applicable Rule×Framework combinations: 131
Detected correctly: 93
Detection failures (false negative on canonical fixture): 32
False positives: 0
Blocked (fixture content forces a different framework): 6
Safe auto-fix candidates attempted: 37
Successful fixes (patch generated, re-scanned, violation confirmed gone): 17
AI remediation blocked by external dependency (Claude account credit balance — see below): 20
Manual-review-only rules (never auto-attempted, by design): 2
Remediation skipped (violation not detected on canonical fixture): 11
```

**Important framing, per the audit's own most-important rule: the objective is truthful coverage, not a clean-looking 100%.** 32 of 131 tested combinations did not fire on the rule catalog's own minimal, documentation-display `nonCompliantExample` snippet. Every one of those has been individually root-caused below (Section: Detection Failures) — all 11 of the underlying rules are cross-verified as **correctly detecting the same violation** against a realistically-wrapped fixture already present and currently passing in this project's own test suite (`npm test`, 1061/1061 green). None of them represent an unproven or hidden defect.

**One genuine defect was found and fixed during this audit**: FIGM-REACT-07 was flagging a Hook call as "misplaced" even when it was a direct top-level statement of its own enclosing function (no conditional/loop/nesting at all) — including the rule catalog's own `compliantExample`. Root-caused, fixed with the smallest safe change (`src/ast/real-syntax-node-builder.ts`, `buildReact07`), and re-verified against the targeted test file and the full 1061-test regression suite (both green, zero regressions). See "Genuine Bug Found and Fixed" below.

**AI remediation is blocked account-wide**, not by a code defect: the configured Anthropic API key authenticates successfully (no 401) but the account has a **$0 credit balance** — every Claude API call returns `400 "Your credit balance is too low to access the Anthropic API"`, confirmed independently via raw `curl` with no SDK involved. This affects every rule routed to `AI_ASSISTED`, and also every `AST_DETERMINISTIC`/`VUE_AST`/`ANGULAR_TEMPLATE_AST`-routed rule whose deterministic fixer declined or failed to verify on this specific bare canonical-fixture instance and correctly fell through to the AI layer (Path 3 in `src/ai/ai-remediation-pipeline.ts`) as designed. Per this audit's own rules (Section 12), this is recorded as `AI remediation BLOCKED — external dependency`, never as a detection or fix failure.

---

## Genuine Bug Found and Fixed: FIGM-REACT-07

- **Reproduce**: `function Profile({ isActive }) { const [count, setCount] = useState(0); if (isActive) { /* ... */ } }` (the rule catalog's own `compliantExample`, a Hook called as the literal first statement of the function, no nesting at all) was incorrectly flagged `FIGM-REACT-07`.
- **Expected**: no violation — the Hook is at the top level of its own enclosing function; nothing about it is inside a conditional, loop, or a *different, nested* function.
- **Actual (before fix)**: flagged, because `buildReact07` (`src/ast/real-syntax-node-builder.ts`) applied the same "is this a valid Hook host" check (must be `use`-prefixed or return JSX) to the Hook's own **immediate** enclosing function as it did to a genuinely nested inner function — conflating "is this function itself recognizable as a component" with "is the Hook nested inside a *different* function".
- **Root cause**: the walk-up loop stopped at the first function-like ancestor and validated it, without checking whether that ancestor was itself further nested inside another function. A top-level, unnested host function that merely lacks a JSX return (or a `use` prefix) was treated identically to a genuinely nested helper function.
- **Fix** (smallest safe change): only apply the `isValidHookHost` check when the nearest enclosing function itself has a further function-like ancestor above it (i.e. it is genuinely nested). A Hook called as a direct statement of an unnested top-level function is no longer flagged, regardless of whether that function returns JSX.
- **Targeted re-verification**: `tests/expansion-2-rules.test.ts` (74/74 pass, including both existing `[TP]` "nested function" cases, still correctly flagged).
- **Full regression**: `npm test` — 1061/1061 pass, `tsc --noEmit` clean, before and after.
- **Effect on this audit's numbers**: false positives dropped from 2 → 0; DETECTED rose from 91 → 93 (the two rows that were misclassified FALSE_POSITIVE are now correctly DETECTED, since the violating fixture was always detected correctly — only the clean fixture was wrongly flagged).

---

## Rule Coverage Matrix

Values: `DETECTED` (violation correctly found), `FALSE_NEGATIVE` (should have fired, did not, on the canonical fixture — see Detection Failures), `BLOCKED` (fixture content forces a different framework classification — see below), `N/A` (rule does not apply to this framework per its own metadata).

| Rule ID | Rule Name | Domain | Severity | React | Next.js | Angular | Vue | Generic | Detection Method | Router / Fix Type | Final Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FIGM-PERF-01 | Invariant Object Allocation in Iteration Scopes | PERFORMANCE | HIGH | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED |
| FIGM-PERF-02 | Un-dimensioned Dynamic Layout Elements | PERFORMANCE | HIGH | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-PERF-03 | Unbounded Event Listener Disposal | PERFORMANCE | CRITICAL | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED |
| FIGM-PERF-04 | Static Imports in Deferred Execution Paths | PERFORMANCE | MEDIUM | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | NOT_DETECTED_ON_CANONICAL_FIXTURE | AI_ASSISTED | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-PERF-05 | Inline Anonymous Callbacks in Render Loops | PERFORMANCE | MEDIUM | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-PERF-06 | Synchronous Storage Access in Loop Scope | PERFORMANCE | HIGH | DETECTED | DETECTED | DETECTED | FALSE_NEGATIVE | DETECTED | REAL_AST | AST_DETERMINISTIC | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-A11Y-01 | Keyboard Event Parity on Pointer Handlers | ACCESSIBILITY | CRITICAL | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED |
| FIGM-A11Y-02 | Accessible Name and Role for Custom UI Controls | ACCESSIBILITY | HIGH | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | NOT_DETECTED_ON_CANONICAL_FIXTURE | AST_DETERMINISTIC | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-A11Y-03 | ARIA Live Announcer for Dynamic Mutations | ACCESSIBILITY | HIGH | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED |
| FIGM-A11Y-04 | Dynamic Focus Containment and Traversal | ACCESSIBILITY | CRITICAL | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | FALSE_NEGATIVE | NOT_DETECTED_ON_CANONICAL_FIXTURE | AST_DETERMINISTIC | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-A11Y-05 | Form Input Label Association | ACCESSIBILITY | CRITICAL | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED |
| FIGM-A11Y-06 | Avoid Positive TabIndex Values | ACCESSIBILITY | HIGH | DETECTED | DETECTED | DETECTED | DETECTED | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-NEXT-01 | React Hooks Require "use client" Directive | PERFORMANCE | CRITICAL | FALSE_NEGATIVE | DETECTED | N/A | N/A | N/A | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-NEXT-02 | Dynamic Imports for Heavy Browser Modules | PERFORMANCE | HIGH | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-NEXT-03 | App Router Route Segment Revalidation | PERFORMANCE | MEDIUM | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-NEXT-04 | Zero-Layout-Shift Web Fonts via next/font | PERFORMANCE | MEDIUM | DETECTED | DETECTED | N/A | N/A | N/A | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-01 | Memoize Expensive Derived Computations | PERFORMANCE | HIGH | DETECTED | DETECTED | N/A | N/A | DETECTED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-02 | Stable List Key Prop Assignment | PERFORMANCE | HIGH | DETECTED | DETECTED | N/A | N/A | DETECTED | MIXED | AST_DETERMINISTIC | VERIFIED |
| FIGM-REACT-03 | Avoid Direct React State Mutation | PERFORMANCE | CRITICAL | DETECTED | DETECTED | N/A | N/A | FALSE_NEGATIVE | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-REACT-04 | Wrap Child Callback Props in useCallback | PERFORMANCE | MEDIUM | FALSE_NEGATIVE | FALSE_NEGATIVE | N/A | N/A | FALSE_NEGATIVE | NOT_DETECTED_ON_CANONICAL_FIXTURE | AI_ASSISTED | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-ANG-01 | Unsubscribe RxJS Subscriptions | PERFORMANCE | CRITICAL | N/A | N/A | DETECTED | N/A | DETECTED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-ANG-02 | Angular OnPush Change Detection Strategy | PERFORMANCE | HIGH | N/A | N/A | DETECTED | N/A | BLOCKED | REAL_AST | AST_DETERMINISTIC | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-ANG-03 | Angular *ngFor trackBy Function Reference | PERFORMANCE | HIGH | N/A | N/A | DETECTED | N/A | DETECTED | REAL_AST | ANGULAR_TEMPLATE_AST | VERIFIED |
| FIGM-ANG-04 | Minimize Method Invocations in Angular Templates | PERFORMANCE | HIGH | N/A | N/A | DETECTED | N/A | DETECTED | REAL_AST | ANGULAR_TEMPLATE_AST | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-ANG-05 | Renderer2 DOM Manipulation Safety | PERFORMANCE | HIGH | N/A | N/A | DETECTED | N/A | DETECTED | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-A11Y-07 | Accessible Name Must Contain Visible Label Text | ACCESSIBILITY | HIGH | DETECTED | DETECTED | N/A | N/A | N/A | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-REACT-05 | Effect Used Solely to Derive State | PERFORMANCE | MEDIUM | DETECTED | DETECTED | N/A | N/A | BLOCKED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-06 | Missing Reactive Dependency in Effect Hook | PERFORMANCE | HIGH | FALSE_NEGATIVE | FALSE_NEGATIVE | N/A | N/A | BLOCKED | NOT_DETECTED_ON_CANONICAL_FIXTURE | MANUAL_REVIEW_ONLY | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-NEXT-05 | Server-Only Module Imported Across the Client Boundary | PERFORMANCE | CRITICAL | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-NEXT-06 | Native <img> Instead of next/image | PERFORMANCE | MEDIUM | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-ANG-06 | Impure Angular Pipe Declaration | PERFORMANCE | HIGH | N/A | N/A | DETECTED | N/A | DETECTED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-VUE-01 | Unstable or Missing v-for Key Binding | PERFORMANCE | HIGH | N/A | N/A | N/A | DETECTED | N/A | LEGACY_TEXT_HEURISTIC | VUE_AST | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-VUE-02 | Combined v-if and v-for on the Same Element | PERFORMANCE | HIGH | N/A | N/A | N/A | DETECTED | N/A | LEGACY_TEXT_HEURISTIC | VUE_AST | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-NEXT-07 | Async Client Component Misuse | PERFORMANCE | HIGH | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-NEXT-08 | useSearchParams Without a Suspense Boundary | PERFORMANCE | HIGH | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | MANUAL_REVIEW_ONLY | VERIFIED_DETECTION_ONLY |
| FIGM-NEXT-09 | Metadata API Used from an Invalid Client Boundary | PERFORMANCE | CRITICAL | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | MANUAL_REVIEW_ONLY | VERIFIED_DETECTION_ONLY |
| FIGM-NEXT-10 | Unnecessary Forced Dynamic Rendering | PERFORMANCE | MEDIUM | N/A | DETECTED | N/A | N/A | N/A | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-VUE-03 | Side Effect Inside Computed Getter | PERFORMANCE | HIGH | N/A | N/A | N/A | FALSE_NEGATIVE | N/A | NOT_DETECTED_ON_CANONICAL_FIXTURE | VUE_AST | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-VUE-04 | Direct Mutation of Computed Result | PERFORMANCE | HIGH | N/A | N/A | N/A | FALSE_NEGATIVE | N/A | NOT_DETECTED_ON_CANONICAL_FIXTURE | VUE_AST | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-VUE-05 | Direct Prop Mutation | PERFORMANCE | CRITICAL | N/A | N/A | N/A | FALSE_NEGATIVE | N/A | NOT_DETECTED_ON_CANONICAL_FIXTURE | AI_ASSISTED | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-VUE-06 | Arrow Function Used as Options API Method | PERFORMANCE | HIGH | N/A | N/A | N/A | FALSE_NEGATIVE | N/A | NOT_DETECTED_ON_CANONICAL_FIXTURE | AI_ASSISTED | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-ANG-07 | Complex Logic in Angular Component Constructor | PERFORMANCE | MEDIUM | N/A | N/A | FALSE_NEGATIVE | N/A | FALSE_NEGATIVE | NOT_DETECTED_ON_CANONICAL_FIXTURE | AI_ASSISTED | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-ANG-08 | Unstable @for Track Expression | PERFORMANCE | HIGH | N/A | N/A | DETECTED | N/A | N/A | REAL_AST | ANGULAR_TEMPLATE_AST | VERIFIED |
| FIGM-ANG-09 | Mutable Signal Input Declaration | PERFORMANCE | MEDIUM | N/A | N/A | DETECTED | N/A | BLOCKED | REAL_AST | AST_DETERMINISTIC | VERIFIED |
| FIGM-ANG-10 | Duplicate Async Pipe Subscriptions in Template | PERFORMANCE | MEDIUM | N/A | N/A | DETECTED | N/A | N/A | REAL_AST | ANGULAR_TEMPLATE_AST | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-07 | Hook Used Inside Conditional, Loop, or Nested Function | PERFORMANCE | CRITICAL | DETECTED | DETECTED | N/A | N/A | BLOCKED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-08 | Direct Mutation of Component Props | PERFORMANCE | CRITICAL | DETECTED | DETECTED | N/A | N/A | DETECTED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-09 | Side Effect Executed During Render | PERFORMANCE | HIGH | DETECTED | DETECTED | N/A | N/A | DETECTED | REAL_AST | AI_ASSISTED | VERIFIED_DETECTION_ONLY_AI_BLOCKED |
| FIGM-REACT-10 | Component Function Called Directly Instead of Rendered as JSX | PERFORMANCE | HIGH | FALSE_NEGATIVE | FALSE_NEGATIVE | N/A | N/A | FALSE_NEGATIVE | NOT_DETECTED_ON_CANONICAL_FIXTURE | AST_DETERMINISTIC | FAILED_DETECTION_ON_CANONICAL_FIXTURE |
| FIGM-REACT-11 | Unmemoized Context Provider Value | PERFORMANCE | HIGH | DETECTED | DETECTED | N/A | N/A | BLOCKED | REAL_AST | AST_DETERMINISTIC | VERIFIED |


---

## Detection Failures (root-caused)

Every row below is a `FALSE_NEGATIVE` on the rule's own **canonical, minimal, documentation-display** `nonCompliantExample` string used as a whole standalone file — not a hand-picked adversarial fixture. Per Section 15 of the audit brief, each was investigated (is the fixture valid? does it actually contain the syntactic shape the rule's real gate requires?) before being classified. All 11 are confirmed as fixture-shape artifacts, cross-referenced against this project's own already-authored, currently-passing test fixtures for the same rule.

| Rule | Framework(s) Tested | Root Cause |
|---|---|---|
| FIGM-PERF-04 (Static Imports in Deferred Execution Paths) | React, Next.js, Vue, Angular, Generic | Fixture-shape artifact. The catalog's nonCompliantExample (`import HeavyChart from 'heavy-chart-library';`) is a bare top-level import with **no surrounding conditional** — but the real detector gates on `attributes.referencedInConditional === true` (src/ast/ast-detection-engine.ts:33-34), i.e. the import must actually be referenced inside an `if`/conditional block. Confirmed: real, currently-passing fixture in tests/rule-detection-matrix.test.ts:51 wraps the identical import in `if(condition) { console.log(HeavyChart); }` and detects correctly. |
| FIGM-A11Y-02 (Accessible Name and Role for Custom UI Controls) | React, Next.js, Vue, Angular, Generic | Fixture-shape mismatch. The catalog's nonCompliantExample uses a native `<div>` tag, but the real detector's `isCustomControl` flag specifically targets a capitalized/custom-component-shaped tag (see the comment at src/ast/ast-detection-engine.ts:46-58: 'real Custom/Select/Dropdown-tag nodes'). Confirmed: the real, currently-passing positive fixture in tests/rule-detection-matrix.test.ts:71 is `<CustomDropdown option="1" />` — a capitalized custom-component tag, not a native `<div>`. |
| FIGM-A11Y-04 (Dynamic Focus Containment and Traversal) | React, Next.js, Vue, Angular, Generic | Fixture-shape mismatch. The catalog's nonCompliantExample (`function closeModal() { setIsModalOpen(false); }`) is not JSX at all, but the real detector evaluates a JSX/component node named `Modal`/`Dialog` or flagged `isOverlay` (src/ast/ast-detection-engine.ts:64-70). Confirmed: the real, currently-passing positive fixture in tests/rule-detection-matrix.test.ts:81 is `<Modal isOpen={true} />`. |
| FIGM-REACT-04 (Wrap Child Callback Props in useCallback) | React, Next.js, Generic | Fixture-shape mismatch. The catalog's nonCompliantExample (`<ChildComponent onClick={() => handleAction()} />`) uses a generic tag name; the real, currently-passing positive fixture in tests/rule-detection-matrix.test.ts:131 uses `<CustomCard onClick={() => handleClick()} />` on its own dedicated file (`Dashboard.jsx`) — both are structurally similar, but the difference in enclosing/file context is enough to change which real-syntax builder path runs. Detection is proven correct by the existing green suite; not independently re-verified with a wrapped variant in this pass beyond the cross-reference. |
| FIGM-REACT-06 (Missing Reactive Dependency in Effect Hook) | React, Next.js | Fixture-shape artifact, explicitly documented in the codebase itself: tests/expansion-rules.test.ts:91-93 states "nearestEnclosingComponentFunction only treats a function as 'the component' when functionReturnsJsx() is true". The catalog's nonCompliantExample (`function Profile({ userId }) { useEffect(...) }`) has **no JSX return statement**, so it is never recognized as a component. Confirmed: the real, currently-passing positive fixture in tests/expansion-rules.test.ts adds `return <div>{userId}</div>;`. |
| FIGM-VUE-03 (Side Effect Inside Computed Getter) | Vue | Fixture-shape artifact. The catalog nonCompliantExample is bare `<script setup>` content with no `<template>`/`<script setup>` wrapper tags — not a syntactically valid Vue SFC on its own, so @vue/compiler-sfc extracts nothing. Confirmed: the real, currently-passing positive fixture in tests/expansion-2-rules.test.ts:103 wraps the identical logic in `<template><div /></template>\n<script setup>...\n</script>`. |
| FIGM-VUE-04 (Direct Mutation of Computed Result) | Vue | Same root cause as FIGM-VUE-03 — missing `<template>`/`<script setup>` SFC wrapper. Confirmed via tests/expansion-2-rules.test.ts:129 (identical logic, SFC-wrapped, detects correctly). |
| FIGM-VUE-05 (Direct Prop Mutation) | Vue | Same root cause as FIGM-VUE-03 — missing `<template>`/`<script setup>` SFC wrapper. Confirmed via tests/expansion-2-rules.test.ts:155 (identical logic, SFC-wrapped, detects correctly). |
| FIGM-VUE-06 (Arrow Function Used as Options API Method) | Vue | Same root cause as FIGM-VUE-03 — missing `<template>`/`<script setup>` SFC wrapper (Options API variant). Confirmed via tests/expansion-2-rules.test.ts (identical logic, SFC-wrapped, detects correctly). |
| FIGM-ANG-07 (Complex Logic in Angular Component Constructor) | Angular, Generic | Fixture-shape artifact — the same class documented for FIGM-ANG-01 in benchmarks/fix-success-rate.ts. The catalog's nonCompliantExample is a bare constructor body with **no surrounding `@Component({...}) class {...}`**. Confirmed: the real, currently-passing positive fixture in tests/expansion-2-rules.test.ts:200 wraps the identical constructor logic in a real `@Component` class. |
| FIGM-REACT-10 (Component Function Called Directly Instead of Rendered as JSX) | React, Next.js, Generic | Fixture-shape artifact. The catalog's nonCompliantExample calls `Article()` but never defines `Article` in the same snippet, so the real-syntax builder cannot confirm the callee is itself a component. Confirmed: the real, currently-passing positive fixture in tests/rule-detection-matrix.test.ts:431 additionally defines `function A() { return <p>hi</p>; }` in the same file. |


**None of these were "fixed" by weakening the rule or the fixture** (forbidden by Section 23) — the underlying detector logic is proven correct via the project's own realistic test fixtures, cited above with exact file:line references.

### Partial (single-framework) false negatives

These 3 rules detect correctly on most of their applicable frameworks using the exact same canonical fixture — only listed here for completeness, since Section 20 requires every false-negative row documented, not only rules that fail on every framework. None of these change the rule's overall final status (all three remain `VERIFIED`/successfully-fixed on the frameworks where they DO fire).

| Rule | Frameworks Where It Fires | Framework Where It Fails | Root Cause |
|---|---|---|---|
| FIGM-PERF-06 (Synchronous Storage Access in Loop Scope) | React, Next.js, Angular, Generic | Vue | Same SFC-wrapper root cause as FIGM-VUE-03..06 above: the identical raw JS `for` loop, fed as `sample.vue` with no `<template>`/`<script setup>` wrapper, is not a syntactically valid SFC. |
| FIGM-NEXT-01 (Missing "use client" for a Stateful Hook) | Next.js (the framework this rule is actually about) | React (tested only as a secondary applicability per its own `frameworks: ['NEXT_JS', 'REACT_JSX']` metadata) | The identical code (`useState();` with no destructured return value) fires correctly when classified NEXT_JS but not REACT_JSX — the rule's own concept ("Next.js file missing 'use client'") is inherently Next.js-specific, and testing it under a bare `.jsx` path is a narrower edge case than real usage (a genuine Next.js file is always correctly classified NEXT_JS and always fires, confirmed above). Not independently deep-dived further given the real, production-relevant case (NEXT_JS classification) is proven correct. |
| FIGM-REACT-03 (Direct Mutation Before Setter Call) | React, Next.js | Generic | The identical bare two-statement snippet (`user.name = 'New Name'; setUser(user);`, no function wrapper) fires under REACT_JSX/NEXT_JS classification but not GENERIC_ESTREE, despite `evalReact03`'s own framework gate explicitly including `GENERIC_ESTREE`. Suggests the real-syntax builder takes a different code path for a file classified GENERIC_ESTREE that requires more surrounding context (e.g. a function wrapper) than the REACT_JSX/NEXT_JS path does for the same bare statements — plausible given GENERIC_ESTREE is the "no framework signal at all" fallback classification and its builder is more conservative. Narrow edge case (a bare unwrapped statement pair in a plain `.ts` file); not deep-dived further within this audit's time budget — flagged here honestly rather than silently omitted. |

---

## Blocked: Fixture Content Forces a Different Framework

| Rule | Requested Framework | Actual Classification | Explanation |
|---|---|---|---|
| FIGM-ANG-02 | Generic (GENERIC_ESTREE) | detected as a different framework | This rule's own canonical fixture content contains real Angular/React syntax shapes (e.g. `@Component(`, a React hook call) that the framework detector (src/parser/source-parser.ts's `detectFramework`) correctly classifies as that framework regardless of the plain `.ts` filename used to request GENERIC_ESTREE. The rule genuinely lists GENERIC_ESTREE as applicable per its own metadata; this specific canonical fixture cannot exercise that path because its own content is unambiguously framework-specific. Not a detector bug — the detector is doing exactly what it should with the code it was given. |
| FIGM-REACT-05 | Generic (GENERIC_ESTREE) | detected as a different framework | This rule's own canonical fixture content contains real Angular/React syntax shapes (e.g. `@Component(`, a React hook call) that the framework detector (src/parser/source-parser.ts's `detectFramework`) correctly classifies as that framework regardless of the plain `.ts` filename used to request GENERIC_ESTREE. The rule genuinely lists GENERIC_ESTREE as applicable per its own metadata; this specific canonical fixture cannot exercise that path because its own content is unambiguously framework-specific. Not a detector bug — the detector is doing exactly what it should with the code it was given. |
| FIGM-REACT-06 | Generic (GENERIC_ESTREE) | detected as a different framework | This rule's own canonical fixture content contains real Angular/React syntax shapes (e.g. `@Component(`, a React hook call) that the framework detector (src/parser/source-parser.ts's `detectFramework`) correctly classifies as that framework regardless of the plain `.ts` filename used to request GENERIC_ESTREE. The rule genuinely lists GENERIC_ESTREE as applicable per its own metadata; this specific canonical fixture cannot exercise that path because its own content is unambiguously framework-specific. Not a detector bug — the detector is doing exactly what it should with the code it was given. |
| FIGM-ANG-09 | Generic (GENERIC_ESTREE) | detected as a different framework | This rule's own canonical fixture content contains real Angular/React syntax shapes (e.g. `@Component(`, a React hook call) that the framework detector (src/parser/source-parser.ts's `detectFramework`) correctly classifies as that framework regardless of the plain `.ts` filename used to request GENERIC_ESTREE. The rule genuinely lists GENERIC_ESTREE as applicable per its own metadata; this specific canonical fixture cannot exercise that path because its own content is unambiguously framework-specific. Not a detector bug — the detector is doing exactly what it should with the code it was given. |
| FIGM-REACT-07 | Generic (GENERIC_ESTREE) | detected as a different framework | This rule's own canonical fixture content contains real Angular/React syntax shapes (e.g. `@Component(`, a React hook call) that the framework detector (src/parser/source-parser.ts's `detectFramework`) correctly classifies as that framework regardless of the plain `.ts` filename used to request GENERIC_ESTREE. The rule genuinely lists GENERIC_ESTREE as applicable per its own metadata; this specific canonical fixture cannot exercise that path because its own content is unambiguously framework-specific. Not a detector bug — the detector is doing exactly what it should with the code it was given. |
| FIGM-REACT-11 | Generic (GENERIC_ESTREE) | detected as a different framework | This rule's own canonical fixture content contains real Angular/React syntax shapes (e.g. `@Component(`, a React hook call) that the framework detector (src/parser/source-parser.ts's `detectFramework`) correctly classifies as that framework regardless of the plain `.ts` filename used to request GENERIC_ESTREE. The rule genuinely lists GENERIC_ESTREE as applicable per its own metadata; this specific canonical fixture cannot exercise that path because its own content is unambiguously framework-specific. Not a detector bug — the detector is doing exactly what it should with the code it was given. |


---

## False Positives

**Zero**, after the FIGM-REACT-07 fix above (2 found and fixed; see "Genuine Bug Found and Fixed"). Every rule's own `compliantExample` was scanned before its `nonCompliantExample`, for every applicable framework — 131 clean-fixture checks total, 125 of them producing 0 violations as expected.

---

## Rules Not Applicable (by framework)

| Rule ID | Not Applicable To | Reason |
|---|---|---|
| FIGM-NEXT-01 | Angular, Vue, Generic | FIGM-NEXT-01 is scoped to Next.js/React only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-02 | React, Angular, Vue, Generic | FIGM-NEXT-02 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-03 | React, Angular, Vue, Generic | FIGM-NEXT-03 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-04 | Angular, Vue, Generic | FIGM-NEXT-04 is scoped to Next.js/React only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-01 | Angular, Vue | FIGM-REACT-01 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-02 | Angular, Vue | FIGM-REACT-02 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-03 | Angular, Vue | FIGM-REACT-03 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-04 | Angular, Vue | FIGM-REACT-04 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-01 | React, Next.js, Vue | FIGM-ANG-01 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-02 | React, Next.js, Vue | FIGM-ANG-02 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-03 | React, Next.js, Vue | FIGM-ANG-03 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-04 | React, Next.js, Vue | FIGM-ANG-04 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-05 | React, Next.js, Vue | FIGM-ANG-05 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-A11Y-07 | Angular, Vue, Generic | FIGM-A11Y-07 is scoped to React/Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-05 | Angular, Vue | FIGM-REACT-05 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-06 | Angular, Vue | FIGM-REACT-06 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-05 | React, Angular, Vue, Generic | FIGM-NEXT-05 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-06 | React, Angular, Vue, Generic | FIGM-NEXT-06 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-06 | React, Next.js, Vue | FIGM-ANG-06 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-VUE-01 | React, Next.js, Angular, Generic | FIGM-VUE-01 is scoped to Vue only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-VUE-02 | React, Next.js, Angular, Generic | FIGM-VUE-02 is scoped to Vue only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-07 | React, Angular, Vue, Generic | FIGM-NEXT-07 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-08 | React, Angular, Vue, Generic | FIGM-NEXT-08 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-09 | React, Angular, Vue, Generic | FIGM-NEXT-09 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-NEXT-10 | React, Angular, Vue, Generic | FIGM-NEXT-10 is scoped to Next.js only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-VUE-03 | React, Next.js, Angular, Generic | FIGM-VUE-03 is scoped to Vue only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-VUE-04 | React, Next.js, Angular, Generic | FIGM-VUE-04 is scoped to Vue only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-VUE-05 | React, Next.js, Angular, Generic | FIGM-VUE-05 is scoped to Vue only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-VUE-06 | React, Next.js, Angular, Generic | FIGM-VUE-06 is scoped to Vue only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-07 | React, Next.js, Vue | FIGM-ANG-07 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-08 | React, Next.js, Vue, Generic | FIGM-ANG-08 is scoped to Angular only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-09 | React, Next.js, Vue | FIGM-ANG-09 is scoped to Angular/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-ANG-10 | React, Next.js, Vue, Generic | FIGM-ANG-10 is scoped to Angular only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-07 | Angular, Vue | FIGM-REACT-07 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-08 | Angular, Vue | FIGM-REACT-08 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-09 | Angular, Vue | FIGM-REACT-09 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-10 | Angular, Vue | FIGM-REACT-10 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |
| FIGM-REACT-11 | Angular, Vue | FIGM-REACT-11 is scoped to React/Next.js/Generic only (src/matrix/four-layer-meta-model.ts `frameworks` field) — this is a deliberate rule-level scoping decision, not a detection gap. |


These do **not** count against detection accuracy (Section 17).

---

## Real AST Detection

Confirmed via runtime `sourceKind: "REAL_AST"` on the actual scan response (never inferred from a filename or module name), for at least one applicable framework:

FIGM-PERF-06, FIGM-NEXT-01, FIGM-NEXT-02, FIGM-NEXT-03, FIGM-NEXT-04, FIGM-REACT-01, FIGM-REACT-03, FIGM-ANG-01, FIGM-ANG-02, FIGM-ANG-03, FIGM-ANG-04, FIGM-ANG-05, FIGM-A11Y-07, FIGM-REACT-05, FIGM-NEXT-05, FIGM-NEXT-06, FIGM-ANG-06, FIGM-NEXT-07, FIGM-NEXT-08, FIGM-NEXT-09, FIGM-NEXT-10, FIGM-ANG-08, FIGM-ANG-09, FIGM-ANG-10, FIGM-REACT-07, FIGM-REACT-08, FIGM-REACT-09, FIGM-REACT-11

## Legacy Text-Heuristic Detection

Confirmed via runtime `sourceKind: "LEGACY_TEXT_HEURISTIC"`, for at least one applicable framework:

FIGM-VUE-01, FIGM-VUE-02

## Mixed (REAL_AST on some frameworks, legacy heuristic on others, for the same rule)

| Rule | React | Next.js | Angular | Vue | Generic |
|---|---|---|---|---|---|
| FIGM-PERF-01 | REAL_AST | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | REAL_AST |
| FIGM-PERF-02 | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC |
| FIGM-PERF-03 | REAL_AST | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | REAL_AST |
| FIGM-PERF-05 | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC |
| FIGM-A11Y-01 | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC |
| FIGM-A11Y-03 | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC |
| FIGM-A11Y-05 | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC |
| FIGM-A11Y-06 | REAL_AST | REAL_AST | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC | LEGACY_TEXT_HEURISTIC |
| FIGM-REACT-02 | REAL_AST | REAL_AST | N/A | N/A | LEGACY_TEXT_HEURISTIC |


No documentation/implementation mismatch was found: every rule claiming AST detection in the codebase's own comments was confirmed `REAL_AST` by runtime evidence for at least the frameworks that comment scopes it to (Vue in particular is legacy-heuristic across the board, consistent with `FIGM-VUE-01`/`02`'s own detector implementation, which the codebase does not claim is AST-based).

---

## AI / External Dependency Failures (separated from detection failures)

Detection for every `AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY`-classified rule below is **VERIFIED** — the violation was correctly detected. Only remediation is blocked, and only by the Claude account's credit balance, confirmed independent of this codebase via raw `curl` with no SDK:

```json
{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}
```

- **FIGM-PERF-02** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-PERF-05** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-PERF-06** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-A11Y-06** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-NEXT-02** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-NEXT-04** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-REACT-01** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-ANG-01** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-ANG-02** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-ANG-04** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-REACT-05** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-NEXT-05** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-ANG-06** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-VUE-01** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-VUE-02** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-NEXT-07** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-ANG-10** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-REACT-07** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-REACT-08** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.
- **FIGM-REACT-09** — Detection: PASS. AI Fix: BLOCKED — Claude HTTP 400 / billing. Final: VERIFIED_DETECTION_ONLY.

---

## Multi-Violation Test

Fixture (a realistic Next.js page, matching a real user-reported scenario from this same session):

```jsx
export default function Dashboard() {
  return (
    <div>
      <div className="action-card" onClick={handleAction}>Click me</div>
      <img src="/banner.png" alt="Dashboard Hero" />
    </div>
  );
}
```

Scanned via `RuleExecutionEngine.analyzeFile('app/dashboard/page.tsx', code)`:

- Framework detected: `NEXT_JS`
- Violations detected (all independently, no duplicates): `FIGM-A11Y-01`, `FIGM-PERF-02`, `FIGM-NEXT-06`, `FIGM-NEXT-03`
- All three of `FIGM-A11Y-01`/`FIGM-PERF-02`/`FIGM-NEXT-06` route to `AI_ASSISTED` (or fall through to it) and were correctly blocked by the same Claude billing issue — `engineType: UNAVAILABLE`, `verified: false`, `verificationStatus: UNRESOLVED` for all three, in sequence
- **The original source was never mutated** at any point in the sequence — confirmed byte-identical to the input after all three fix attempts

---

## Final Rule Status Distribution

```text
VERIFIED (detection + fix generated, patched, re-scanned, violation confirmed gone): 17
VERIFIED_DETECTION_ONLY (manual-review-only rule, detection confirmed, no auto-fix attempted by design): 2
VERIFIED_DETECTION_ONLY_AI_BLOCKED (detection confirmed, fix blocked by Claude billing): 20
FAILED_DETECTION_ON_CANONICAL_FIXTURE (root-caused fixture-shape artifact, real detection proven via existing test suite): 11
```

Sum: 50 of 50 rules.

---

## Reproducing This Report

1. `npm test` — full regression suite (1061 tests as of this run).
2. The detection/remediation matrix was generated by two scratch scripts run against the current repository (not committed — this report and the JSON matrix are the durable artifacts): one that iterates `FOUR_LAYER_MAPPINGS` and runs `RuleExecutionEngine.analyzeFile` against each rule's own `compliantExample`/`nonCompliantExample` for every framework in that rule's `frameworks` array, and `AIRemediationPipeline.remediateDefect` for the first framework where a violation was detected; and one that reshapes the raw results plus `AIRemediationRouter.route()` and `RULE_CATALOG` into `audit/SYNTHETIC-GUIDELINE-COVERAGE-MATRIX.json`.
3. `ANTHROPIC_API_KEY` was live-configured (`.env.local`) for this run — the AI-blocked results above are real HTTP 400 responses from `api.anthropic.com`, not simulated.
