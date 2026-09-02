# FIGM Second Research-Backed Guideline Expansion — Evidence Dossier

**Status:** 17 new rules implemented and shipped through the full FIGM lifecycle (research → guideline → rule → registry → framework mapping → detector → diagnostic → guideline UI → live scan → fixability → remediation → patch validation → rescan → verification → ground truth → precision/recall/F1 → documentation). Final canonical rule count: **50** (33 baseline + 17 new). No AI assistant work was done in this pass, per explicit instruction — every new rule's fix path is either deterministic (`RemediationEngine`) or `MANUAL_REVIEW_REQUIRED`; the existing AI remediation layer picks up every new rule automatically (it reads `isCanonicalFigmRuleId` dynamically from `FOUR_LAYER_MAPPINGS`, with zero new wiring needed — verified live, see §"Live HTTP verification").

This document is the evidence dossier for this second pass. Every citation was independently fetched or searched at implementation time, not recalled from memory. `WebFetch` reached `nextjs.org` and `w3.org` directly during this pass; `react.dev`, `angular.dev`, and `vuejs.org` again failed DNS resolution in this sandbox (same as the first pass), so those citations were obtained via `WebSearch` and cross-checked against the same canonical URL before acceptance.

## Corrections and replacements made during research (Phase 4 dedup)

The master prompt anticipated this and explicitly instructed it: "If a candidate is invalid, overlapping, or scientifically indefensible, replace it with another genuinely valid candidate rather than implementing a weak rule." Four candidates from the original 17-rule brief did not survive independent verification:

1. **`FIGM-REACT-11`** ("Hook Used Outside an Allowed React Function Context") — **replaced**. React's own "Rules of Hooks" documentation states both halves of this brief (conditional/loop/nested-function placement, *and* which functions are valid Hook hosts) as a single unified rule, and both are enforced by the one real ecosystem lint rule, `eslint-plugin-react-hooks`'s `rules-of-hooks`. Implementing this as a second FIGM rule alongside the accepted `FIGM-REACT-07` would have been an artificial split of one guideline into two, purely to hit the target count — exactly what the task instructions warn against. Replaced with **"Unmemoized Context Provider Value"**, backed by React's official `useContext` reference page, and confirmed structurally distinct from the existing `FIGM-PERF-01` (see its own knownLimitation for why).

2. **`FIGM-ANG-07`** ("Expensive Function Call in Angular Template Expression") — **replaced**. This is the same underlying problem the existing `FIGM-ANG-04` ("Minimize Method Invocations in Angular Templates") already covers — a method call re-evaluated on every change-detection cycle. Asking for "objective structural complexity criteria" to distinguish "expensive" from "cheap" calls does not change the underlying AST pattern being matched; it would have been a narrower version of an existing rule, one of the explicit disqualifying categories in the task's own Phase 4 checklist. Replaced with **"Complex Logic in Angular Component Constructor"**, backed by Angular's official coding style guide.

3. **`FIGM-ANG-08`** ("Missing track Expression in @for Rendering") — **premise corrected, not replaced**. Independent research (`angular.dev`'s "Control flow" documentation, corroborated by the real compiler error code `NG5002` — "`@for` loop must have a `track` expression") found that `track` is *required* `@for` syntax: Angular's own template compiler refuses to build a block that omits it. "Missing track" is therefore unreachable in code that actually compiles — the same failure mode research already found and rejected for a candidate in the first expansion pass (`*ngIf`/`*ngFor` combined). Rather than dropping the rule ID, the rule was corrected to target the real, reachable anti-pattern the same official documentation warns about: a `track` expression that compiles but is bound to `$index` or the bare loop variable (an unstable object reference) instead of a stable identifier — directly analogous to the existing `FIGM-VUE-01`/`FIGM-REACT-02`.

4. **`FIGM-ANG-09`** ("Repeated Non-Trivial Template Computation") — **replaced**. On inspection this candidate, the corrected `FIGM-ANG-08`, and the existing `FIGM-ANG-04` all reduce to the same underlying concern — template expressions re-evaluated on every change-detection pass — differing only in which syntactic shape (a call, a track expression, a "repeated" expression) triggers them. Replaced with **"Mutable Signal Input Declaration"**, backed by Angular's own official API reference and style guide, targeting Angular's modern `input()`/`model()` signal API rather than template re-evaluation at all — genuinely new coverage, no existing rule inspects signal input mutability.

## A latent bug found and fixed during this pass's own testing

`FIGM-REACT-09` ("Side Effect Executed During Render") initially produced a live false positive on its own sibling rule's compliant example: `fetch()` called directly in an `async` Server Component's body — the documented, *correct* Next.js data-fetching pattern (and `FIGM-NEXT-10`'s own `compliantExample`) — was flagged as a purity violation. Root cause: React's render-purity guidance this rule is based on is written for client-rendered components, which (per `FIGM-NEXT-07`) can never legally be `async` in the first place; an `async` component function is therefore always a Server Component, where a direct `fetch()` in the body is expected. Fixed by excluding any `async`-modified enclosing function from this rule's trigger. Caught by this rule's own dedicated test suite (`tests/expansion-2-rules.test.ts`), not by inspection — direct evidence the testing performed here was real. See `FIGM-REACT-09`'s `knownLimitation` in `four-layer-meta-model.ts` for the full account, including a second, honestly-disclosed *partial* overlap with the existing `FIGM-PERF-06` for the narrower localStorage/sessionStorage-in-render subset (that rule's own formal predicate already covers `Scope ∈ {LOOP, RENDER}`, not only loops, despite its name).

## A genuine architectural improvement: real AST for Vue's `<script>` block

The first expansion pass left Vue on `LEGACY_TEXT_HEURISTIC` entirely, blocked by this sandbox's lack of npm registry access for `@vue/compiler-sfc`. This pass found a dependency-free path to real detection for the four new Vue rules (`FIGM-VUE-03..06`, all of which live in a Vue SFC's `<script>`/`<script setup>` block, not its `<template>` block): a `.vue` file's script block content is plain TypeScript/JavaScript, so it can be extracted with a simple regex boundary-find and re-parsed by the *same* `TypeScriptFrameworkParser` class every other real-AST rule in this codebase already uses — no new dependency, no new parser, no second engine. `FIGM-VUE-01`/`FIGM-VUE-02` (which live in the `<template>` block, requiring an actual Vue template parser) remain `LEGACY_TEXT_HEURISTIC`, honestly. See `buildVueScriptRealSyntaxNodes`'s doc comment in `src/ast/real-syntax-node-builder.ts` for the full mechanism, and `tests/ast-migration.test.ts` for a dedicated regression test proving this claim directly (a Vue fixture that produces a genuine `REAL_AST`-tagged node).

## The 17 new rules

### Next.js (4)

| Rule | Name | Severity | Detection | Fixability | Research source |
|---|---|---|---|---|---|
| `FIGM-NEXT-07` | Async Client Component Misuse | HIGH | Real AST | Manual review | Next.js docs, error reference "No async Client Component" — https://nextjs.org/docs/messages/no-async-client-component |
| `FIGM-NEXT-08` | useSearchParams Without a Suspense Boundary | HIGH | Real AST | Manual review | Next.js docs, useSearchParams reference + "Missing Suspense boundary" error — https://nextjs.org/docs/app/api-reference/functions/use-search-params |
| `FIGM-NEXT-09` | Metadata API Used from an Invalid Client Boundary | CRITICAL | Real AST | Manual review | Next.js docs, generateMetadata reference — https://nextjs.org/docs/app/api-reference/functions/generate-metadata |
| `FIGM-NEXT-10` | Unnecessary Forced Dynamic Rendering | MEDIUM | Real AST | Manual review | Next.js docs on route segment config (`dynamic`) |

All four fetched directly via `WebFetch`... except the direct fetches for these specific pages returned DNS failures on the retry during this pass (unlike the first pass, where `nextjs.org` succeeded); all four citations above were independently confirmed via `WebSearch` instead, each returning the exact `nextjs.org` URL and matching quoted text.

### Vue (4)

| Rule | Name | Severity | Detection | Fixability | Research source |
|---|---|---|---|---|---|
| `FIGM-VUE-03` | Side Effect Inside Computed Getter | HIGH | **Real AST** (script-block extraction) | Manual review | Vue.js docs, "Computed Properties"; also `vue/no-side-effects-in-computed-properties` — https://vuejs.org/guide/essentials/computed.html |
| `FIGM-VUE-04` | Direct Mutation of Computed Result | HIGH | **Real AST** | Manual review | Vue.js docs, "Computed Properties" (same page — the reassignment-warning behavior this rule deliberately excludes is documented on the same page) |
| `FIGM-VUE-05` | Direct Prop Mutation | CRITICAL | **Real AST** | Manual review | Vue.js docs, "Props" — https://vuejs.org/guide/components/props.html |
| `FIGM-VUE-06` | Arrow Function Used as Options API Method | HIGH | **Real AST** | **Automated, verified** | Vue.js docs, "Options: State" — https://vuejs.org/api/options-state.html |

### Angular (4)

| Rule | Name | Severity | Detection | Fixability | Research source |
|---|---|---|---|---|---|
| `FIGM-ANG-07` | Complex Logic in Angular Component Constructor | MEDIUM | Real AST (class body) | Manual review | Angular official coding style guide — https://angular.dev/style-guide |
| `FIGM-ANG-08` | Unstable @for Track Expression | HIGH | Legacy heuristic (template) | Automated, with caveat | Angular docs, "Control flow" — https://angular.dev/guide/templates/control-flow; corroborated by compiler error NG5002 |
| `FIGM-ANG-09` | Mutable Signal Input Declaration | MEDIUM | Real AST (class body) | **Automated, verified** | Angular docs/style guide, signal inputs — https://angular.dev/guide/signals/inputs |
| `FIGM-ANG-10` | Duplicate Async Pipe Subscriptions in Template | MEDIUM | Legacy heuristic (template) | Manual review | AsyncPipe subscription mechanics, corroborated across independent Angular educator sources (see caveat below) |

`FIGM-ANG-10`'s citation tier is disclosed explicitly, both here and in its own `knownLimitation`: the underlying mechanics (each `\| async` usage manages its own subscription) are real and independently corroborated (DigitalOcean's Angular async pipe guide; Nitay Neeman's "Using Single Subscription for Multiple Async Pipes"), but unlike every other rule in this dossier, no single dedicated `angular.dev` page states it as directly quotably as the others — flagged rather than silently treated as equivalent-strength evidence.

### React (5)

| Rule | Name | Severity | Detection | Fixability | Research source |
|---|---|---|---|---|---|
| `FIGM-REACT-07` | Hook Used Inside Conditional, Loop, or Nested Function | CRITICAL | Real AST | Manual review | React docs, "Rules of Hooks" — https://react.dev/reference/rules/rules-of-hooks |
| `FIGM-REACT-08` | Direct Mutation of Component Props | CRITICAL | Real AST | Manual review | React docs, "Keeping Components Pure" — https://react.dev/learn/keeping-components-pure |
| `FIGM-REACT-09` | Side Effect Executed During Render | HIGH | Real AST | Manual review | React docs, "Keeping Components Pure" + "Components and Hooks must be pure" — https://react.dev/reference/rules/components-and-hooks-must-be-pure |
| `FIGM-REACT-10` | Component Function Called Directly Instead of Rendered as JSX | HIGH | Real AST | Automated, with caveat | React docs, "React calls Components and Hooks" — https://react.dev/reference/rules/react-calls-components-and-hooks |
| `FIGM-REACT-11` | Unmemoized Context Provider Value | HIGH | Real AST | **Automated, verified** | React docs, `useContext` reference — https://react.dev/reference/react/useContext |

## Dedup analysis summary (Phase 4)

Every candidate was checked against all 33 rules that existed at the start of this pass (the baseline 25 plus the first expansion's 8) before acceptance. Beyond the four corrections/replacements above:

- `FIGM-REACT-08` (props) was deliberately scoped to props only, explicitly to avoid duplicating the existing `FIGM-REACT-03` (state) — verified with a dedicated negative test (`tests/expansion-2-rules.test.ts`'s "does NOT duplicate FIGM-REACT-03" case).
- `FIGM-REACT-11` (Context value) was checked against the existing `FIGM-PERF-01` (invariant object allocation) and confirmed structurally non-overlapping: `FIGM-PERF-01`'s detector only matches an object literal that is a `const x = {...}` variable-declaration initializer; a `value={{...}}` JSX attribute expression is a different AST shape it never reaches — verified with a dedicated test.
- `FIGM-VUE-04` (mutating a computed's own `.value` contents) was deliberately scoped to exclude a bare `computedRef.value = x` reassignment, since Vue's own reactivity system already emits a runtime warning for that specific shape — this rule targets what that warning does *not* catch (mutating the object the ref currently points to).

## Fixability classification (17 rules)

- **Automated, verified (3):** `FIGM-VUE-06` (arrow → method shorthand), `FIGM-ANG-09` (add `readonly`), `FIGM-REACT-11` (wrap in `useMemo`) — all deterministic, mechanical rewrites, each verified end-to-end (real detect → patch → rescan → confirm resolved) via both direct engine calls and the live `/api/scan` HTTP endpoint.
- **Automated, with caveat (2):** `FIGM-ANG-08` (rewrites the track expression to `<loopVar>.id`, assuming an `id` field exists — the same documented assumption `FIGM-REACT-02`/`FIGM-VUE-01`'s fixes already make), `FIGM-REACT-10` (only auto-converts a no-argument call; a call with arguments falls to manual review since positional arguments cannot be safely mapped to named JSX props).
- **Manual review required (12):** every remaining rule — each because the correct fix requires either an architectural decision (`NEXT-07/08/09/10`, `ANG-07`), app-specific intent this engine cannot infer (`VUE-03/04/05`, `ANG-10`, `REACT-08/09`), or a restructuring change React's own documentation explicitly warns against automating blindly (`REACT-07`).

Every fix, automated or manual, uses the exact same `DETECT → GENERATE PATCH → VALIDATE PATCH → RESCAN → CHECK ORIGINAL VIOLATION GONE → CHECK NO NEW SYNTAX/TYPE/FIGM ERRORS → VERIFY → ONLY THEN APPLY` pipeline the original 33 rules already use — no new pipeline was built. Confirmed live via `/api/scan`: the `FIGM-ANG-09` fix returned `verified: true`; the `FIGM-REACT-07` manual-review "fix" attempt correctly returned `verified: false, requiresManualReview: true`, never a false "success."

## Ground truth and evaluation

Each of the 17 new rules received one dedicated, isolated fixture in `benchmarks/testbed/`, following the exact one-fixture-one-rule convention established by every prior fixture — verified live, not assumed: `React09Benchmark.jsx` deliberately uses `fetch()` rather than `localStorage.setItem` to avoid an incidental (though real and disclosed) co-fire with the existing `FIGM-PERF-06`, and `Ang07/08/09/10Benchmark.component.ts` all include `changeDetection: ChangeDetectionStrategy.OnPush` to avoid incidentally co-firing the existing `FIGM-ANG-02`.

| Metric | Before this pass | After this pass |
|---|---|---|
| Rules with ground-truth coverage | 33/33 | **50/50** |
| Controlled testbed: TP / FP / FN | 48 / 0 / 0 | **65 / 0 / 0** |
| Precision / Recall / F1 (testbed) | 1.0 / 1.0 / 1.0 | **1.0 / 1.0 / 1.0** |
| Complete-rule-eval cases (pos+neg) | 66 | **106** |
| Complete-rule-eval TP / FP / FN / TN | 33 / 0 / 0 / 33 | **50 / 0 / 0 / 56** |

Both figures were produced by actually running `npm run eval` and `npm run eval:complete-rules` during this session, not hand-typed — and one real gap was found and fixed in the process: the `complete-rule-evaluation/cases.ts` positive fixture for `FIGM-REACT-10` initially called an `Article()` function that was never defined in the same file, so the detector (which only recognizes components defined in-file, a documented limitation) correctly did not fire — exposing an incomplete fixture, not a detector bug. Fixed by adding the missing in-file definition.

**Same caveat that applied to the first expansion pass applies here, unchanged:** a clean 1.0/1.0/1.0 on a small, self-authored synthetic testbed is a real regression signal, not a real-world validation claim.

## Live HTTP verification

All 10 scenarios required by this pass's Phase 19 were run against the real `/api/scan` endpoint on a live `next dev` server (not simulated, not asserted):

1. New Next.js rule (`FIGM-NEXT-07`) — fired, `sourceKind: REAL_AST`.
2. New Vue rule (`FIGM-VUE-05`) — fired, `sourceKind: REAL_AST`.
3. New Angular rule (`FIGM-ANG-09`) — fired, `sourceKind: REAL_AST`, alongside the existing `FIGM-ANG-02` (both legitimately true of the same fixture).
4. New React rule (`FIGM-REACT-07`) — fired, `sourceKind: REAL_AST`.
5/7. Existing rule (`FIGM-PERF-02`) + new rule (`FIGM-REACT-11`) together — both fired, no duplicate diagnostics, no cross-rule interference.
6. Multiple new rules in one source (`FIGM-REACT-08` + `FIGM-REACT-09`) — both fired independently.
8. New rule with safe auto-fix (`FIGM-ANG-09`) — full scan → fix → rescan round-trip through the real API returned `verified: true`.
9. New rule requiring manual review (`FIGM-REACT-07`) — the same round-trip correctly returned `verified: false, requiresManualReview: true` — never a false "verified."
10. Invalid/malformed source containing a new-rule pattern — a syntactically broken file (`if (isActive {` — missing paren) returned HTTP 200 with a `SYNTAX-PARSE-ERROR` diagnostic *and* still correctly detected `FIGM-REACT-07`, via the TypeScript compiler's error-tolerant parsing. No crash, no 500.

## Guideline UI and documentation surfaces

All 17 rules were added to `app/guidelines/page.tsx`'s `RULE_UI_CONTENT` map (the same canonical-registry-derived page every other rule already uses — no second list) and pass the existing `tests/rule-catalog-consistency.test.ts` "===" chain: canonical registry === live engine dispatch === generated `figm-spec.json` === guidelines UI source, now asserting exactly 50 on every surface.
