# FIGM Rule Engineering Audit — Complete Rule-by-Rule Pass (Group 4 Migration)

**Role:** Senior Static Analysis Rule Engineer, engineering pass over all 25 FIGM rules using the
real-parser architecture built in the prior AST migration (`docs/architecture/AST_MIGRATION_MAP.md`,
`docs/architecture/AST_MIGRATION_REPORT.md`).

**Method:** Every claim below was verified by reading the current implementation directly
(`src/matrix/four-layer-meta-model.ts`, `src/ast/ast-detection-engine.ts`,
`src/ast/real-syntax-node-builder.ts`, `src/parser/source-parser.ts`, `src/analysis/react-ast-rules.ts`,
`src/engine/remediation-engine.ts`) and by running the actual engine against real fixtures — not
inherited from prior audit prose. Where a limitation is "known," it is because a test case in
`tests/qa-matrix-boundary-adversarial.test.ts` or this pass's own `tests/rule-engineering-migration-v2.test.ts`
pins it down with a passing assertion, not because it is merely asserted here.

**What changed in this pass (Group 4):** seven rules previously classified "Yes, feasible, but not
in this batch" in `AST_MIGRATION_MAP.md` §2/§5 are now real-AST-migrated: **FIGM-PERF-03,
FIGM-PERF-05, FIGM-PERF-06, FIGM-A11Y-05, FIGM-A11Y-06, FIGM-REACT-01, FIGM-REACT-04** — implemented
in `src/ast/real-syntax-node-builder.ts`'s "Group 4" section, gated in `src/parser/source-parser.ts`
behind `useRealAstPerf03/05/06`, `useRealAstA11y05/06`, `useRealAstReact01/04`. Every other rule's
detection mechanism is byte-for-byte unchanged in this pass. **No new dependency was added** (same
`typescript` compiler API already used by Groups 1-3).

**Every semantic change this pass makes is documented in §3 below** — nothing was silently broadened
or narrowed. **Benchmark result after this migration: 19 TP / 2 FP / 0 FN, F1 = 95.0%** — identical,
line-for-line, to the pre-migration `benchmarks/eval-summary.json` committed at `HEAD` (verified via
`git diff HEAD -- benchmarks/eval-summary.json` showing no change in any `truePositives`/
`falsePositives`/`falseNegatives`/`f1Score` field after re-running `npm run eval`). This pass was not
tuned to move that number — none of the 7 migrated rules' semantic refinements happen to be exercised
by the existing 19-item ground-truth benchmark fixtures; the improvements are demonstrated instead by
the new fixtures in `tests/rule-engineering-migration-v2.test.ts`.

---

## 1. Rule inventory (source of truth: `src/matrix/four-layer-meta-model.ts::FOUR_LAYER_MAPPINGS`)

25 rules, 2 domains (PERFORMANCE, ACCESSIBILITY), read directly from the live specification, not
copied from documentation:

| # | Rule ID | Name | Domain | Severity |
|---|---|---|---|---|
| 1 | FIGM-PERF-01 | Invariant Object Allocation in Iteration Scopes | PERFORMANCE | HIGH |
| 2 | FIGM-PERF-02 | Un-dimensioned Dynamic Layout Elements | PERFORMANCE | HIGH |
| 3 | FIGM-PERF-03 | Unbounded Event Listener Disposal | PERFORMANCE | CRITICAL |
| 4 | FIGM-PERF-04 | Static Imports in Deferred Execution Paths | PERFORMANCE | MEDIUM |
| 5 | FIGM-PERF-05 | Inline Anonymous Callbacks in Render Loops | PERFORMANCE | MEDIUM |
| 6 | FIGM-PERF-06 | Synchronous Storage Access in Loop Scope | PERFORMANCE | HIGH |
| 7 | FIGM-A11Y-01 | Keyboard Event Parity on Pointer Handlers | ACCESSIBILITY | CRITICAL |
| 8 | FIGM-A11Y-02 | Accessible Name and Role for Custom UI Controls | ACCESSIBILITY | HIGH |
| 9 | FIGM-A11Y-03 | ARIA Live Announcer for Dynamic Mutations | ACCESSIBILITY | HIGH |
| 10 | FIGM-A11Y-04 | Dynamic Focus Containment and Traversal | ACCESSIBILITY | CRITICAL |
| 11 | FIGM-A11Y-05 | Form Input Label Association | ACCESSIBILITY | CRITICAL |
| 12 | FIGM-A11Y-06 | Avoid Positive TabIndex Values | ACCESSIBILITY | HIGH |
| 13 | FIGM-NEXT-01 | React Hooks Require "use client" Directive | PERFORMANCE | CRITICAL |
| 14 | FIGM-NEXT-02 | Dynamic Imports for Heavy Browser Modules | PERFORMANCE | HIGH |
| 15 | FIGM-NEXT-03 | App Router Route Segment Revalidation | PERFORMANCE | MEDIUM |
| 16 | FIGM-NEXT-04 | Zero-Layout-Shift Web Fonts via next/font | PERFORMANCE | MEDIUM |
| 17 | FIGM-REACT-01 | Memoize Expensive Derived Computations | PERFORMANCE | HIGH |
| 18 | FIGM-REACT-02 | Stable List Key Prop Assignment | PERFORMANCE | HIGH |
| 19 | FIGM-REACT-03 | Avoid Direct React State Mutation | PERFORMANCE | CRITICAL |
| 20 | FIGM-REACT-04 | Wrap Child Callback Props in useCallback | PERFORMANCE | MEDIUM |
| 21 | FIGM-ANG-01 | Unsubscribe RxJS Subscriptions | PERFORMANCE | CRITICAL |
| 22 | FIGM-ANG-02 | Angular OnPush Change Detection Strategy | PERFORMANCE | HIGH |
| 23 | FIGM-ANG-03 | Angular *ngFor trackBy Function Reference | PERFORMANCE | HIGH |
| 24 | FIGM-ANG-04 | Minimize Method Invocations in Angular Templates | PERFORMANCE | HIGH |
| 25 | FIGM-ANG-05 | Renderer2 DOM Manipulation Safety | PERFORMANCE | HIGH |

Note: `FOUR_LAYER_MAPPINGS`'s ISO 25010/WCAG 2.2 domain labels are correct at the domain level; the
per-finding `standardReference` (a specific ISO 25010 sub-characteristic or WCAG 2.2 success
criterion) is computed per-concern by `src/matrix/standard-clause-mapping.ts`, not hardcoded here.

---

## 2. Rule-by-rule engineering analysis

Each rule below answers: (1) exact pattern detected, (2) syntax structure proving the violation,
(3) real-AST feasibility, (4) false positives, (5) false negatives, (6) framework differences,
(7) remediation safety.

### PERFORMANCE domain

**FIGM-PERF-01 — Invariant Object Allocation in Iteration Scopes**
1. A `const`/`let`/`var` object-literal declaration inside a loop or component-render body.
2. Real AST: `ts.ObjectLiteralExpression` that is the `initializer` of a `ts.VariableDeclaration`,
   with a loop or JSX-returning-function ancestor (`classifyScope`).
3. **Yes — migrated (Group 1).**
4. FP: any object literal in loop/render scope is flagged even if it genuinely depends on the loop
   variable and could never be hoisted (no data-flow analysis) — documented, preserved limitation.
5. FN: a bare `return {...}` (not a declaration) is intentionally out of scope (matches the rule's
   own documented trigger shape, not a gap).
6. React/Next/Generic/Angular-class-body: real AST. Vue (`:style="{ ... }"` binding): legacy text.
7. Remediation: **safe** for the declaration shape (hoists + `Object.freeze`s, preserves the
   original local variable name so downstream references still resolve); falls back to a
   `useMemo`-wrap advisory for non-matching shapes.

**FIGM-PERF-02 — Un-dimensioned Dynamic Layout Elements**
1. `<img>`/`<video>`/`<iframe>`/`<embed>` missing both width+height and `aspect-ratio`.
2. Real AST: `ts.JsxOpeningElement`/`JsxSelfClosingElement` attribute list.
3. **Yes — migrated (Group 1).**
4. FP: none significant; width/height/aspect-ratio presence is a direct, unambiguous check.
5. FN: a dimension supplied only via an external CSS class (not inline `style`/attrs) is invisible
   — inherent to static analysis, not a bug.
6. React/Next: real AST. Vue/Angular (template markup): legacy text.
7. Remediation: **safe** (injects `width="300" height="200"` placeholders; developer adjusts values).

**FIGM-PERF-03 — Unbounded Event Listener Disposal** *(migrated this pass)*
1. `.addEventListener(eventType, handler)` with no matching `.removeEventListener(sameEventType, ...)`
   anywhere in the file.
2. Real AST: `ts.CallExpression` whose callee is `x.addEventListener`; pairing found via a real-AST
   walk for a `removeEventListener` call with a matching string-literal first argument.
3. **Yes — migrated (Group 4, this pass).**
4. FP: file-wide pairing (not lexical-scope-aware) means a `removeEventListener('scroll', ...)` in
   an unrelated component would incorrectly suppress a genuine leak elsewhere — preserved from
   legacy, documented, not fixed in this pass (true fix needs component-boundary analysis).
5. FN: a dynamically-computed event-type argument (not a string literal) falls back to "any
   `removeEventListener` call anywhere suppresses it" — same as legacy.
6. Framework-agnostic (plain JS/TS `CallExpression`); real AST for all frameworks except Vue.
7. Remediation: **safe-ish** — wraps the registration in a `useEffect` with a matching
   `removeEventListener` cleanup; assumes a React idiom, which is appropriate for this rule's
   primary target (React/Next component lifecycle) but is a stylistic assumption for plain-JS
   callers.

**FIGM-PERF-04 — Static Imports in Deferred Execution Paths**
1. A top-level `import` whose every real reference in the file falls strictly inside an `if (...)`
   block.
2. Real AST: `ts.ImportDeclaration` + a real identifier-reference walk checking `IfStatement`
   ancestry for every reference to the imported binding(s).
3. **Yes — migrated (Group 1).**
4. FP: none significant beyond the inherent "exclusively conditional" definition itself.
5. FN: a reference reachable only through re-export or dynamic property access is invisible (no
   cross-module analysis) — inherent limitation, not a regression.
6. Real AST for React/Next/Generic/Angular-class-body. Vue: legacy text.
7. Remediation: **safe** for the simple `import Name from 'mod'` shape (converts to
   `React.lazy(() => import(...))`); generic fallback otherwise.

**FIGM-PERF-05 — Inline Anonymous Callbacks in Render Loops** *(migrated this pass)*
1. An inline arrow function that is the direct value of a JSX event-handler prop (`on*`), inside a
   loop or component-render scope.
2. Real AST: `ts.ArrowFunction` whose parent is a `JsxExpression` whose parent is a `JsxAttribute`
   named `/^on[A-Z]/`, with `classifyScope` returning `LOOP`/`RENDER`.
3. **Yes — migrated (Group 4, this pass).**
4. FP: none new; a named handler reference (`onClick={handleClick}`) is structurally not an
   `ArrowFunction` node and is never flagged.
5. FN: none new. **Fixed a real over-approximation**: the legacy line-based check matched the
   substrings `"map("` + `"() =>"` anywhere on one physical line, so `onClick={cb}` referencing an
   already-`useCallback`-memoized local was still (wrongly) flagged because the unrelated
   `useCallback(() => ...)` on the same line also contains `"() =>"`. Real AST only looks at the
   attribute's own initializer, so this is no longer flagged — see §3.
6. **Documented scope refinement**: generalized from `onClick`-only (the literal legacy substring)
   to any `on[A-Z]...` handler prop — see §3.
7. Remediation: **unsafe, correctly flagged `requiresManualReview: true`** — a correct fix needs
   per-item-keyed memoization the snippet alone cannot safely infer.

**FIGM-PERF-06 — Synchronous Storage Access in Loop Scope** *(migrated this pass)*
1. `localStorage.*(...)`/`sessionStorage.*(...)` call whose own AST position is inside a loop or
   render scope (not merely its *result* used inside one).
2. Real AST: `ts.CallExpression` whose callee object identifier is `localStorage`/`sessionStorage`,
   scope via `classifyScope`.
3. **Yes — migrated (Group 4, this pass).**
4. FP: none new; a call outside the loop whose *result* is reused inside one is correctly not
   flagged (matches legacy).
5. FN: a local variable/parameter that happens to be named `localStorage`/`sessionStorage` (shadowing
   the real global) is still flagged — no real-binding resolution, preserved from legacy, documented
   as a known limitation (`tests/rule-engineering-migration-v2.test.ts`'s regression case).
6. Framework-agnostic; real AST for all frameworks except Vue.
7. Remediation: **safe** for the simple `const x = storage.get(...)` declaration shape (hoists
   outside the loop); advisory otherwise.

**FIGM-A11Y-01 — Keyboard Event Parity on Pointer Handlers**
1. A non-interactive host element (`div`/`span`/`section`) with `onClick` and no
   `onKeyDown`/`tabIndex`.
2. Real AST: `JsxOpeningElement`/`JsxSelfClosingElement` attribute list, multi-line-safe (unlike the
   legacy same-line scanner it superseded, which needed a hand-maintained multi-line lookahead
   patch).
3. **Yes — migrated (Group 1).**
4. FP: fixed tag allow-list (`div`/`span`/`section`) means a semantically-equivalent but differently-
   named custom wrapper is out of scope — by design (matches the rule's own non-interactive-element
   targeting).
5. FN: none new.
6. React/Next: real AST. Vue (`@click`/`v-on:click`)/Angular (`(click)`): legacy text (not valid
   TS/JSX syntax).
7. Remediation: **safe** (adds `role="button"`, `tabIndex={0}`, and a keyboard handler that
   correctly invokes the existing handler value whether it's an arrow function or a bare reference).

**FIGM-A11Y-02 — Accessible Name and Role for Custom UI Controls**
1. A `<Custom*>`/`<Select*>`/`<Dropdown*>`-prefixed component missing `role` or
   `aria-label`/`aria-labelledby`.
2. Real AST: `JsxOpeningElement` tag-name prefix check + attribute list.
3. **Yes — migrated (Group 1).**
4. FP: none beyond the deliberately narrow tag allow-list itself.
5. FN: any other capitalized (custom) component name is out of scope — `evalA11y02`'s predicate is
   technically broader, but the node **producer** is deliberately kept narrow to match existing
   ground truth; broadening it is an explicitly out-of-scope, not-yet-approved change (per
   `AST_MIGRATION_MAP.md` §8, preserved unchanged in this pass).
6. React/Next: real AST. Vue/Angular: legacy text.
7. Remediation: **safe** (injects placeholder `role`/`aria-label`; developer must supply a real
   accessible name).

**FIGM-A11Y-03 — ARIA Live Announcer for Dynamic Mutations**
1. An element whose `className`/`class`/`id` literally **starts with** `"status"`, missing
   `aria-live` or `role="status"|"alert"`.
2. Real AST: `JsxOpeningElement` attribute list.
3. **Yes — migrated (Group 1).**
4. FP: **documented, preserved KNOWN LIMITATION** — `className="status-bar-widget"` (an unrelated
   widget whose name merely starts with "status") is flagged; a prefix match, not semantic dynamic-
   content analysis.
5. FN: a genuinely dynamic status container named anything else (`class="alert-msg"`, `id="notice"`)
   is invisible — inherent to the naming-convention heuristic.
6. React/Next: real AST. Vue/Angular: legacy text.
7. Remediation: **safe** (adds `role="status" aria-live="polite"`).

**FIGM-A11Y-04 — Dynamic Focus Containment and Traversal**
1. A `<Modal*>`/`<Dialog*>`-prefixed component with no `restoresFocus`/`onClose` prop.
2. Real AST: `JsxOpeningElement` tag-name prefix check + attribute presence.
3. **Yes — migrated (Group 1).**
4. FP: none beyond the tag allow-list itself.
5. FN: **documented, preserved KNOWN LIMITATION** — presence of `onClose` alone is accepted as a
   proxy for "focus is actually restored," without verifying the handler body does so.
6. React/Next: real AST. Vue/Angular: legacy text.
7. Remediation: **safe** (injects `restoresFocusOnUnmount={true}` and a focus-restoration callback
   template).

**FIGM-A11Y-05 — Form Input Label Association** *(migrated this pass)*
1. `<input>`/`<textarea>`/`<select>` with no `aria-label`/`aria-labelledby`, and either no `id` or
   no `htmlFor=`/`for=` anywhere in the file.
2. Real AST: `JsxOpeningElement`/`JsxSelfClosingElement` tag + attribute list; the file-wide
   `htmlFor`/`for` presence check stays a plain text search (see §4).
3. **Yes — migrated (Group 4, this pass).**
4. FP: **documented, preserved KNOWN LIMITATION** — the file-wide `htmlFor=`/`for=` presence check
   is not value-matched to this specific input's `id`, so an unrelated `<label htmlFor="other-field">`
   anywhere in the file suppresses the finding even when the actual input in question has no real
   label. Deliberately preserved exactly as-is rather than silently upgraded to true id-matching
   (see §4 for the rationale).
5. FN: an input labeled via a wrapping `<label>...<input/></label>` (implicit association, no
   `htmlFor`/`id` pair at all) is invisible — inherent to both the legacy and real-AST versions.
6. React/Next: real AST. Vue/Angular: legacy text.
7. Remediation: **safe** (derives `aria-label` from an existing `placeholder`, or inserts a
   `TODO:` placeholder).

**FIGM-A11Y-06 — Avoid Positive TabIndex Values** *(migrated this pass)*
1. A `tabIndex`/`tabindex` JSX attribute with a literal numeric value `> 0`.
2. Real AST: `ts.JsxAttribute` named `tabIndex`/`tabindex`, initializer resolved for both the
   string-literal (`tabIndex="5"`) and JSX-expression-numeric-literal (`tabIndex={5}`) shapes.
3. **Yes — migrated (Group 4, this pass).**
4. FP: none; a literal value is unambiguous.
5. FN: a variable- or expression-valued `tabIndex` (`tabIndex={order}`) is out of scope — no
   constant-folding/data-flow, unchanged from legacy.
6. React/Next: real AST. Vue/Angular (template `tabindex` attribute): legacy text.
7. Remediation: **safe** (resets to `tabIndex={0}`/`tabIndex="0"`, the natural focus order).

**FIGM-NEXT-01 — React Hooks Require "use client" Directive**
1. `useState`/`useEffect`/`useContext`/`useRef` called in a Next.js App/Pages Router `page.*` file
   with no leading `"use client"` directive.
2. Real AST: directive-prologue check (`ts.SourceFile.statements` leading string-literal
   expression statements) + `ts.CallExpression` on a fixed hook-name allow-list.
3. **Yes — migrated (Group 3).**
4. FP: none significant; the hook-name allow-list is exact.
5. FN: a custom hook that internally calls `useState` (but is itself named e.g. `useMyHook`) is
   invisible — no cross-function call-graph analysis.
6. **NEXT_JS-only**, deliberately not `REACT_JSX` (a plain React file using `useState` would be a
   false positive under the broader gate — confirmed as a real regression during Group 3 and fixed
   by narrowing the real-AST gate specifically).
7. Remediation: **safe** (prepends `'use client';`).

**FIGM-NEXT-02 — Dynamic Imports for Heavy Browser Modules**
1. A static top-level import from a fixed "heavy module" allow-list
   (`monaco-editor`/`chart.js`/`three`/`canvas`/`echarts`/`d3`) with no existing `dynamic(` call in
   the file.
2. Real AST: `ts.ImportDeclaration` module-specifier text match against the allow-list.
3. **Yes — migrated (Group 3).**
4. FP: none beyond the allow-list's own scope (by design — it is not meant to catch every "heavy"
   package, only these known ones).
5. FN: any heavy package not on the hardcoded list is invisible — inherent to an allow-list
   approach; broadening it is a separate, deliberate scope decision not made in this pass.
6. **NEXT_JS-only.**
7. Remediation: **unsafe, correctly flagged `requiresManualReview: true`** — whether the binding
   should become `next/dynamic` (a component) or a plain lazy `import()` (a vanilla library) depends
   on how it's used elsewhere in the file, not inferable from the import line alone.

**FIGM-NEXT-03 — App Router Route Segment Revalidation**
1. An App/Pages Router `page.*` file with no `export const revalidate`.
2. Real AST: whole-file structural check (`ts.VariableStatement` export search) — a "presence"
   rule with no single triggering node, so it emits one synthetic root-level finding per file
   (matching the legacy detector's own synthetic-node shape for this rule).
3. **Yes — migrated (Group 3).**
4. FP: none; either the export exists or it doesn't.
5. FN: none for the export's presence; does not validate the value is sane (e.g. `revalidate = 0`
   with unintended always-dynamic behavior) — out of scope for a presence-only rule.
6. **NEXT_JS-only** (the only framework with App/Pages Router semantics).
7. Remediation: **safe** (inserts `export const revalidate = 60;` with an adjust-this-value comment).

**FIGM-NEXT-04 — Zero-Layout-Shift Web Fonts via next/font**
1. A `<link>` tag pointing at `fonts.googleapis.com`, or a `rel="stylesheet"` link whose `href`
   contains `"font"`.
2. Real AST: `JsxOpeningElement`/`JsxSelfClosingElement` tag `link` + attribute value checks.
3. **Yes — migrated (Group 3).**
4. FP: a non-Google-Fonts stylesheet link whose href happens to contain the substring "font" (e.g.
   `/styles/font-utilities.css`) would be flagged — a narrow, pre-existing heuristic edge case,
   unchanged by this pass.
5. FN: a font loaded via a different CDN with neither "googleapis.com" nor "font" in its URL is
   invisible.
6. NEXT_JS and REACT_JSX (the broader of the two Next-rule gates, matching `evalNext04`'s own
   framework list).
7. Remediation: **unsafe, correctly flagged `requiresManualReview: true`** — converts to a
   `next/font/google` import, but applying `className` to the correct `<html>`/`<body>` element
   cannot be safely automated without knowing the JSX tree shape.

**FIGM-REACT-01 — Memoize Expensive Derived Computations** *(migrated this pass)*
1. `.sort()`/`.filter()`/`.reduce()` called with no ancestor `useMemo(...)` wrapping it.
2. Real AST: `ts.CallExpression` with a `.sort`/`.filter`/`.reduce` property-access callee, checked
   via a real ancestor walk for a `useMemo`/`*.useMemo` call wrapping it anywhere above it in the
   tree (not merely on the same physical line).
3. **Yes — migrated (Group 4, this pass).**
4. FP: **partially fixed (follow-up commit, 2026-08-18), partially preserved KNOWN LIMITATION**.
   Fixed: the receiver is now excluded when it is a bare identifier starting with an uppercase
   letter (`isLikelyNonArrayNamespaceReceiver`) — the near-universal JS/TS naming convention for a
   class/namespace/static-API object, never a plain array variable. This closes a confirmed
   real-world false positive (`benchmarks/real-world/SPOT_CHECK.md` #14: Vue's global
   `Vue.filter(name, fn)` filter-*registration* API, matched purely because the property name
   `filter` matched with no receiver check at all) without a hardcoded per-library list — a receiver
   reached via a property chain or call expression (`Array.from(x).filter(...)`) isn't a bare
   identifier and is unaffected. Still preserved as a KNOWN LIMITATION: no scope restriction at all
   (matches legacy) — a module-level utility function's `.sort()` far from any component render is
   still flagged, even though `useMemo` would be meaningless there; not narrowed in this pass (a
   scope restriction would itself be an undocumented, unapproved semantic change).
5. FN: **fixed** — the legacy same-physical-line text check missed a multi-line `useMemo(() => {
   ...\n items.sort(...) \n}, [deps])` body (false positive: correctly-memoized code was flagged)
   and could be fooled by an unrelated `"useMemo"` substring anywhere on the same line as a
   genuinely unmemoized computation (false negative). Real AST's ancestor walk fixes both — see §3.
6. React/Next/Generic (matches `evalReact01`'s own framework gate; Angular class bodies produce a
   harmless, never-evaluated candidate node, same pattern as the pre-existing FIGM-REACT-03).
7. Remediation: **unsafe, correctly flagged `requiresManualReview: true`** — the real dependency
   array cannot be safely inferred from the snippet alone.

**FIGM-REACT-02 — Stable List Key Prop Assignment**
1. A `key={...}` JSX attribute whose expression is exactly a reference to (or a template literal
   interpolating) the index parameter bound by the enclosing `.map((item, N) => ...)` callback.
2. Real AST (via the dedicated `src/analysis/react-ast-rules.ts` module, relocated in Phase 5 onto
   the same shared `TypeScriptFrameworkParser` every other real-AST rule uses): real parameter-
   binding resolution, not a literal-name allow-list (`index`/`i`/`idx`).
3. **Already real AST** (FIGM's first real-AST-migrated rule, predating this session's migration).
4. FP: none new; this is the most semantically precise rule in the whole set (real scope/binding
   resolution, not text matching).
5. FN: a key derived from the index via an intermediate variable (`const rowKey = index; ...
   key={rowKey}`) is invisible — no data-flow beyond the direct binding reference.
6. **REACT_JSX/NEXT_JS only** — the only rule with a bespoke module instead of
   `real-syntax-node-builder.ts`, by design (predates that shared abstraction, refactored onto the
   shared parser in Phase 5 without changing its detection logic).
7. Remediation: **safe** (replaces with `{itemVar}.id`, inferring the actual `.map()` callback's
   item parameter name rather than hardcoding `item`).

**FIGM-REACT-03 — Avoid Direct React State Mutation**
1. An array in-place mutation method call (`.push`/`.splice`/`.pop`/`.shift`/`.unshift`/`.sort`) or
   a direct property assignment (`obj.prop = value`), on a target the file has positive evidence is
   React state — see #4 below. Excludes `setState`/declaration lines.
2. Real AST: `ts.ExpressionStatement` wrapping either a matching `CallExpression` or a real
   `BinaryExpression` with `=` operator and a `PropertyAccessExpression` LHS (structurally distinct
   from `==`/`===`/object-literal properties by `SyntaxKind` — no text-based exclusion needed, unlike
   the regex version it replaced).
3. **Yes — migrated (Group 1); state-target evidence gate added in a later pass (see below).**
4. FP: **fixed (was a documented KNOWN LIMITATION until commit `31c56c28`)**. The rule used to flag
   ANY `obj.prop = value`/array-mutation-method shape with no check that `obj` is actually bound to
   React state — confirmed as a real, live false-positive class by the real-world benchmark spot
   check (`Button.defaultProps =`, `module.exports =`, a Karma config's `module.exports = function
   (config)`, `ctx.fillStyle =`, none of them React) and by FIGM dogfooding its own
   `app/live-scan/page.tsx` (`computeLineDiff()`'s plain local `rows.push(...)`, flagged 7 times).
   `buildReact03` now requires the mutation target to pass `isProvableStateTarget`, which is true
   only if:
     - `isThisStateAccess` — the target is a `this.state...` chain in a class component (structural,
       reserved-name check, no search needed), **or**
     - the target's root identifier is in `findStateLikeNames(sourceFile)`, a real, file-wide AST
       search (`real-syntax-node-builder.ts`) for names with positive state evidence: the first
       element of a `const [x, setX] = useState(...)` destructuring (including a renamed/aliased
       `useState` import or the `React.useState(...)`/namespace-import form, resolved via the file's
       actual `ImportDeclaration`s, not text matching), **or** a call to `set${Capitalize(x)}(...)`
       found anywhere in the file (React's setter-naming convention, kept as a second signal because
       a hook can come from an untraceable custom wrapper).
   Additionally, `isExcludedMutationTarget` categorically excludes `document`/`window`/`navigator`/
   `location`/`history`/`localStorage`/`sessionStorage`/`router` root identifiers and any
   `*.current.*` ref-access chain, checked BEFORE the state-evidence gate — these are never state
   regardless of what evidence the rest of the file happens to contain (added earlier, commit
   `bb01d1c1`, for `router.push()`/`document.body.style`/`ref.current`, the single most common false
   positives in real Next.js apps).
   **Residual, disclosed limitation**: this is a file-wide *name* search, not lexical-scope/type-
   checker binding resolution. Two unrelated functions in the same file that happen to reuse an
   identifier name (e.g. a real `const [count, setCount] = useState(0)` in one component and an
   unrelated local `const count = { value: 0 }` in a different function in the same file) can still
   cause the unrelated one to over-match — see the dedicated "[Known limitation, documented]" test in
   `tests/qa-matrix-cross-cutting.test.ts`. This is a bounded, accepted tradeoff versus the previous
   "flag everything" behavior, not a claim of full data-flow analysis.
5. FN: a mutation performed through an intermediate alias (`const ref = state; ref.push(x)`) or a
   destructured sub-object (`const { user } = state; user.name = x`) is invisible — both require
   real data-flow tracing this AST-only, name-based pass doesn't do. Documented and regression-tested
   (`tests/qa-matrix-cross-cutting.test.ts`, alias case under the "no evidence" regression test).
6. React/Next/Generic (Angular class bodies produce a harmless unevaluated node, same as
   FIGM-REACT-01/§ above; a `.vue` file's Options API `this.count = ...` is out of `evalReact03`'s
   framework gate entirely and never evaluated, by design — see FIGM-REACT-03's dedicated Vue test).
7. Remediation: **safe**, per-shape (immutable spread-append for `.push`, `.slice(0,-1)` for `.pop`,
   `.filter` for `.splice`, spread-copy for `.sort`/`.reverse`, spread-object update for property
   assignment), with a generic annotate-only fallback for unrecognized shapes.

**FIGM-REACT-04 — Wrap Child Callback Props in useCallback** *(migrated this pass)*
1. An inline arrow function passed as the `onClick` prop to a `<Custom*>`/`<Button*>`/`<Card*>`-
   prefixed child component.
2. Real AST: `ts.JsxAttribute` named `onClick` whose initializer is a `JsxExpression` wrapping an
   `ArrowFunction`, on an owning `JsxOpeningElement`/`JsxSelfClosingElement` matching the tag
   prefix allow-list.
3. **Yes — migrated (Group 4, this pass).**
4. FP: none new; the tag-prefix scope is deliberately preserved unchanged (not generalized to other
   handler props — see §3).
5. FN: two fixed — (a) the legacy same-physical-line text check missed the tag name and `onClick`
   attribute appearing on separate lines (a real formatter-produced JSX shape); (b) the legacy check
   only matched the exact substring `"onClick={() =>"` (a strictly zero-parameter arrow), missing an
   inline arrow with a parameter (`onClick={(e) => ...}`) — both fixed by the real-AST version, see §3.
6. React/Next: real AST. Vue/Angular: legacy text.
7. Remediation: **unsafe, correctly flagged `requiresManualReview: true`** — same dependency-array
   inference constraint as FIGM-PERF-05/FIGM-REACT-01.

### Angular sub-domain

**FIGM-ANG-01 — Unsubscribe RxJS Subscriptions**
1. `.subscribe(...)` inside an Angular component with no file-wide `takeUntilDestroyed`,
   `unsubscribe`, or `DestroyRef` text anywhere in the file.
2. Real AST: `ts.CallExpression` with a `.subscribe` property-access callee.
3. **Yes — migrated (Group 2).**
4. FP: **documented limitation** — the file-wide teardown-keyword search is not verified to be the
   SAME subscription's actual teardown (could be an unrelated subscription elsewhere in the class).
5. FN: none new.
6. Real AST for `ANGULAR_TEMPLATE`/`GENERIC_ESTREE` (class-body TS); legacy for other frameworks
   incidentally containing `@Component` text (rare/inert in practice).
7. Remediation: **safe** (adds a `subscription` field + `ngOnDestroy` disposal lifecycle hook).

**FIGM-ANG-02 — Angular OnPush Change Detection Strategy**
1. `@Component({...})` decorator whose object-literal argument text does not contain
   `ChangeDetectionStrategy.OnPush`.
2. Real AST: `ts.Decorator` → `CallExpression` named `Component` → object-literal argument text
   check.
3. **Yes — migrated (Group 2).**
4. FP: none significant.
5. FN: `OnPush` supplied via a spread/imported constant rather than the literal text
   `ChangeDetectionStrategy.OnPush` is invisible — a text-value check on the decorator argument, not
   a full constant-evaluator.
6. Real AST for `ANGULAR_TEMPLATE`/`GENERIC_ESTREE`.
7. Remediation: **safe** (injects `changeDetection: ChangeDetectionStrategy.OnPush` and the matching
   import).

**FIGM-ANG-03 — Angular *ngFor trackBy Function Reference**
1. `*ngFor="let x of y"` template directive with no `trackBy` in the same directive string.
2. **Template markup inside a string literal** — not real TS/JS syntax the TypeScript compiler
   understands.
3. **No — requires `@angular/compiler`, a new dependency deliberately not added** (per
   `AST_MIGRATION_MAP.md` §5, unchanged in this pass — see §4 below for why this remains the right
   call).
4. FP: none significant; the substring check is precise for this directive shape.
5. FN: a `trackBy` supplied via an unusual formatting/whitespace variant outside the regex's
   expected shape could be missed — inherent to the current regex.
6. Template markup only exists meaningfully for Angular; **permanently `LEGACY_TEXT_HEURISTIC`** on
   every framework.
7. Remediation: **safe** (mechanically appends `; trackBy: trackById` — the developer must supply a
   matching `trackById(index, item)` method).

**FIGM-ANG-04 — Minimize Method Invocations in Angular Templates**
1. `{{ methodCall() }}` interpolation or `[prop]="methodCall()"` property binding inside template
   markup.
2. Same as FIGM-ANG-03 — template markup, not TS syntax.
3. **No — requires `@angular/compiler`**, same rationale as FIGM-ANG-03.
4. FP: any parenthesized call-shaped text inside `{{ }}`/`]="..."` is flagged, including a pure
   function with no re-render cost — no semantic (side-effect/purity) analysis.
5. FN: a method call inside a *ngIf/*ngFor's own binding expression (not `{{ }}`/`]="..."`) may be
   missed depending on exact punctuation — inherent to the regex shape.
6. **Permanently `LEGACY_TEXT_HEURISTIC`** on every framework, same as FIGM-ANG-03.
7. Remediation: **unsafe, correctly flagged `requiresManualReview: true`** — converting to a getter/
   signal/pipe requires understanding what the method computes.

**FIGM-ANG-05 — Renderer2 DOM Manipulation Safety**
1. `.nativeElement` property access with no `renderer.`/`Renderer2` text on the same physical line.
2. Real AST: `ts.PropertyAccessExpression` named `nativeElement`.
3. **Yes — migrated (Group 2).**
4. FP: none significant.
5. FN: a `Renderer2` usage a few lines away (not the SAME physical line as the `.nativeElement`
   access) is not recognized as a guard — a same-line proximity check, not scope-aware, preserved
   unchanged from legacy.
6. Real AST for `ANGULAR_TEMPLATE`/`GENERIC_ESTREE`.
7. Remediation: **safe** for the single-style-property-assignment shape
   (`this.el.nativeElement.style.x = y` → `this.renderer.setStyle(...)`); `requiresManualReview`
   for every other mutation shape (`innerHTML`, `setAttribute`, `classList`, ...), since a generic
   textual rewrite risks getting the Renderer2 method/argument order wrong.

---

## 3. Every semantic change made in this pass, documented explicitly

Per the task's explicit "do not silently broaden or narrow" constraint, every behavioral difference
introduced by the Group 4 migration is listed here, with which direction it goes and why it was
judged an intentional, demonstrable improvement rather than scope creep:

| Rule | Change | Direction | Why it's a documented fix, not scope creep |
|---|---|---|---|
| FIGM-PERF-05 | Generalized from `onClick`-only text match to any `on[A-Z]...` JSX handler prop | **Broaden** | The rule's own formal predicate (`IsInlineCallback(n) AND Scope(n) in {LOOP, RENDER}`) and ALP description are not onClick-specific; an inline `onChange`/`onMouseDown` handler in a loop is the identical anti-pattern the rule targets, invisible only because of an implementation accident in the old regex |
| FIGM-PERF-05 | An arrow bound to a local `const` and referenced by name (e.g. `useCallback`-wrapped) is no longer flagged | **Narrow** | Was a documented KNOWN LIMITATION (`qa-matrix-boundary-adversarial.test.ts`) caused purely by same-line substring matching; real AST correctly sees the JSX attribute's initializer is an `Identifier`, not an inline `ArrowFunction` — this is the rule's own definition of "inline," not a redefinition of it |
| FIGM-REACT-01 | `useMemo` wrapping is now a real ancestor-tree check instead of a same-physical-line substring check | **Both** (fixes a same-line false positive for multi-line `useMemo` bodies, and a false negative from an unrelated same-line `"useMemo"` substring) | Directly implements the rule's own stated intent ("wrapped in useMemo") more faithfully; the old same-line check was never the intended semantics, just an implementation shortcut |
| FIGM-REACT-04 | Detects the tag name and `onClick` attribute across separate physical lines (formatter-produced multi-line JSX) | **Broaden** (closes a false negative) | Identical category of fix already made and documented for FIGM-A11Y-01 in Group 1 — real AST understands JSX structurally, not by line adjacency |
| FIGM-REACT-04 | Inline arrow with a parameter (`onClick={(e) => ...}`), not only the exact zero-parameter `"onClick={() =>"` text | **Broaden** (closes a false negative) | The rule's formal predicate (`IsChildCallbackProp(n) AND NOT WrappedInUseCallback(n)`) has no parameter-count restriction; an arrow taking `(e)` re-instantiates on every render exactly as much as a zero-arg arrow does |

**Deliberately NOT changed in this pass** (preserved exactly, even though a "more correct" version
was considered and rejected as out-of-scope for this pass): FIGM-PERF-03's file-wide (not lexically-
scoped) `addEventListener`/`removeEventListener` pairing; FIGM-PERF-06's name-based (not real-binding)
`localStorage`/`sessionStorage` detection; FIGM-A11Y-05's file-wide (not value-matched) `htmlFor`/`id`
presence check; FIGM-REACT-01's total absence of scope restriction. Each of these would require either
real data-flow/binding analysis (out of scope for a syntax-only migration) or a value-matching upgrade
that is a genuine, separate scope decision — called out here rather than made silently, per
`AST_MIGRATION_MAP.md` §8's own precedent.

---

## 4. Why FIGM-ANG-03/04 and Vue stay `LEGACY_TEXT_HEURISTIC`

Unchanged from the prior migration's decision, re-verified as still correct: Angular template markup
(`*ngFor`, `{{ }}`) and Vue SFC content (`<template>...</template>`) are not TypeScript/JSX syntax —
`ts.createSourceFile` cannot parse them meaningfully. A genuine fix requires `@angular/compiler` /
`@vue/compiler-sfc`, both **new dependencies** this pass deliberately does not add (matching the
"no unnecessary dependencies" constraint and the prior migration's explicit scope boundary). These
three rule/framework combinations remain the only source of `LEGACY_TEXT_HEURISTIC` labeling left in
the codebase after this pass, plus Vue/Svelte's blanket framework-level exclusion for all 25 rules.

---

## 5. Final Rule Matrix

| Rule | Parser | AST node(s) matched | Test occurrences¹ | Known limitation | Remediation |
|---|---|---|---|---|---|
| FIGM-PERF-01 | TS Compiler | `ObjectLiteralExpression` (decl. initializer) | 70 | Any object literal in loop/render scope flagged regardless of true invariance (no data-flow) | Safe |
| FIGM-PERF-02 | TS Compiler | `JsxOpeningElement`/`SelfClosing` (img/video/iframe/embed) | 27 | Dimensions supplied only via external CSS class are invisible | Safe |
| FIGM-PERF-03 | TS Compiler *(Group 4)* | `CallExpression` (addEventListener/removeEventListener) | 31 | File-wide (not lexically-scoped) event-type pairing | Safe-ish (assumes React idiom) |
| FIGM-PERF-04 | TS Compiler | `ImportDeclaration` + identifier refs | 17 | No cross-module re-export analysis | Safe (simple import shape) |
| FIGM-PERF-05 | TS Compiler *(Group 4)* | `ArrowFunction` (JSX handler-prop initializer) | 27 | None major (over-approximation fixed this pass) | Manual review |
| FIGM-PERF-06 | TS Compiler *(Group 4)* | `CallExpression` (localStorage/sessionStorage) | 20 | Name-based, not real-binding (shadowed name still flags) | Safe (simple hoist shape) |
| FIGM-A11Y-01 | TS Compiler | `JsxOpeningElement` (div/span/section + onClick) | 55 | Fixed tag allow-list | Safe |
| FIGM-A11Y-02 | TS Compiler | `JsxOpeningElement` (Custom\*/Select\*/Dropdown\*) | 20 | Narrow tag allow-list (deliberately preserved) | Safe (placeholder text) |
| FIGM-A11Y-03 | TS Compiler | `JsxOpeningElement` (className/id prefix "status") | 14 | Prefix match, not semantic dynamic-content check | Safe |
| FIGM-A11Y-04 | TS Compiler | `JsxOpeningElement` (Modal\*/Dialog\*) | 17 | `onClose` presence used as focus-restoration proxy | Safe (template injection) |
| FIGM-A11Y-05 | TS Compiler *(Group 4)* | `JsxOpeningElement`/`SelfClosing` (input/textarea/select) | 25 | File-wide `htmlFor`/`for` presence, not value-matched | Safe |
| FIGM-A11Y-06 | TS Compiler *(Group 4)* | `JsxAttribute` (tabIndex/tabindex literal) | 19 | Literal values only, no constant-folding | Safe |
| FIGM-NEXT-01 | TS Compiler | Directive prologue + `CallExpression` (hook allow-list) | 14 | Custom hooks wrapping a real hook are invisible | Safe |
| FIGM-NEXT-02 | TS Compiler | `ImportDeclaration` (heavy-module allow-list) | 10 | Fixed allow-list, not general "heavy package" detection | Manual review |
| FIGM-NEXT-03 | TS Compiler | Whole-file structural check (no single node) | 8 | Presence-only; doesn't validate the value | Safe |
| FIGM-NEXT-04 | TS Compiler | `JsxOpeningElement` (`<link>` Google Fonts) | 10 | Narrow href-pattern match | Manual review |
| FIGM-REACT-01 | TS Compiler *(Group 4)* | `CallExpression` (.sort/.filter/.reduce), capitalized-bare-identifier receivers excluded | 23 | No scope restriction (any occurrence in file, matches legacy) | Manual review |
| FIGM-REACT-02 | TS Compiler (bespoke module, Phase 5-relocated) | `JsxAttribute` `key` + map-callback index binding | 28 | Index derived via an intermediate variable is invisible | Safe |
| FIGM-REACT-03 | TS Compiler | `ExpressionStatement` (mutation call / prop assignment), gated by file-wide `useState`/setter/`this.state` evidence | 33 | Name-based (not lexical-scope) state-evidence search; alias/destructure indirection invisible | Safe (per-shape) |
| FIGM-REACT-04 | TS Compiler *(Group 4)* | `JsxAttribute` onClick (Custom\*/Button\*/Card\*) | 18 | Narrow tag allow-list + onClick-only scope (deliberately preserved) | Manual review |
| FIGM-ANG-01 | TS Compiler | `CallExpression` (.subscribe) | 14 | File-wide teardown-keyword search, not verified same-subscription | Safe |
| FIGM-ANG-02 | TS Compiler | `Decorator` (@Component argument) | 10 | Text-value check, not a full constant evaluator | Safe |
| FIGM-ANG-03 | **Legacy (permanent)** | n/a — template markup string | 13 | Regex on directive string; needs `@angular/compiler` for real parse | Safe |
| FIGM-ANG-04 | **Legacy (permanent)** | n/a — template markup string | 13 | Regex on interpolation string; needs `@angular/compiler` for real parse | Manual review |
| FIGM-ANG-05 | TS Compiler | `PropertyAccessExpression` (.nativeElement) | 10 | Same-line-only Renderer2 guard proximity check | Safe (style shape); else manual |

¹ "Test occurrences" = literal mentions of the rule ID across `tests/*.test.ts` (positive + negative
+ boundary + adversarial + malformed + regression cases combined, including this pass's new
`tests/rule-engineering-migration-v2.test.ts` for the seven Group 4 rules), counted via
`grep -ro "<RULE-ID>" tests/ | wc -l` — reported as a real, reproducible count, not an estimate.

**Summary:** 23/25 rules are real-AST for their eligible frameworks (up from 16/25 before this
pass); 2/25 (FIGM-ANG-03/04) remain permanently `LEGACY_TEXT_HEURISTIC` on every framework pending a
future `@angular/compiler` dependency decision; all 25/25 remain `LEGACY_TEXT_HEURISTIC` for Vue/Svelte
specifically (framework-level, not rule-level, exclusion). Remediation safety, tallied directly from
every `requiresManualReview = true` assignment in `src/engine/remediation-engine.ts`: **18/25 rules
have a fully automated, re-scan-verified safe fix path; 6/25 (FIGM-PERF-05, FIGM-NEXT-02, FIGM-NEXT-04,
FIGM-REACT-01, FIGM-REACT-04, FIGM-ANG-04) always require manual review** because the correct fix
depends on information (a real dependency array, which of two lazy-loading strategies applies, what a
template method actually computes) that cannot be safely inferred from the snippet alone; **1/25
(FIGM-ANG-05) auto-fixes only the common single-style-property sub-case and requires manual review
for every other `.nativeElement` mutation shape.**
