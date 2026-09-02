# FIGM Code Inspector — Phase 3 Rule Detection Matrix

> **STALE-SCOPE NOTICE (added 2026-09-02, not a rewrite of the matrix below):** this document and
> its backing test (`tests/rule-detection-matrix.test.ts`) cover the **original 25 rules only**. The
> canonical FIGM rule set has since grown to **50 rules** (`figm-spec.json`'s `meta.totalCoreRules`),
> including a later "Group 4" migration (`docs/architecture/RULE_ENGINEERING_AUDIT.md`) and further
> framework-specific rule additions. **There is no equivalent doc-level real-fixture TP/TN proof for
> the 25 rules added after this document was written** — this is a genuine gap, not an oversight to
> paper over: ground-truth/proof coverage for the rule set as a whole should be read as 25/50 (50%)
> at the doc level, separate from (and not to be conflated with) whatever fraction of the 50-rule
> benchmark testbed (`benchmarks/testbed/`, `benchmarks/ground-truth.json`) has fixture coverage.
> Everything below this notice remains accurate for the 25 rules it actually documents; it is not
> a current claim about the full 50-rule set.

**Date**: 2026-08-13 (rewritten — the prior version of this document was not backed by real fixture execution and is superseded; see "What changed" below)
**Method**: `tests/rule-detection-matrix.test.ts` — a real positive (should-fire) AND negative (should-NOT-fire) fixture for every one of the 25 rules, executed against the real `SourceParser` + `ASTDetectionEngine` (the same pipeline `RuleExecutionEngine.analyzeFile` uses in production). 51/51 assertions pass (`npm test`, or standalone: `node --import tsx --test tests/rule-detection-matrix.test.ts`). Positive fixtures are shared with, and kept in sync with, `tests/ast-detection-rules.test.ts`.
**Rule ID source of truth**: directly read from `src/ast/ast-detection-engine.ts`'s `evaluateNode` method and its 25 private `eval*` predicates — not from any prior doc or narrative.

## What changed from the prior version of this document

The version of this file that existed before this rewrite claimed **100% detection, 0 false positives, 0 false negatives** across "25 rules" — but on inspection it did not match the real engine at all:
- It used `FIGM-ANGULAR-01`/`FIGM-ANGULAR-02` — these rule IDs **do not exist** in the live engine (the real IDs are `FIGM-ANG-01` through `FIGM-ANG-05`).
- It listed `FIGM-REACT-05: Context Value Memo` — **this rule does not exist** in the live engine (React rules are only `FIGM-REACT-01` through `FIGM-REACT-04`).
- It **omitted `FIGM-ANG-05`** (direct `nativeElement` mutation) entirely.
- It contained no fixture code and no evidence of real execution — it was a narrative table, not a test result.
- Its "0 false positives / 0 false negatives" claim is directly contradicted by this codebase's own adversarial audit (`docs/audit/ADVERSARIAL_DETECTION_AUDIT.md`), which found and fixed 7 confirmed false positives + 1 confirmed false negative through real execution.

Per the explicit brief instruction not to trust pre-existing audit documents, none of it was carried forward. This rewrite is generated from, and stays traceable to, a real, currently-passing test file.

**A genuine new bug was found while building this matrix's negative fixtures** (not merely a documentation exercise): the `FIGM-NEXT-01` negative fixture (a file with a real `"use client"` directive) initially still fired the rule. Root cause: the comment/string-stripping lexer added earlier this session (`stripCommentsAndStrings`, for the Phase 4/5 fix) was blanking the `"use client"` directive-prologue string because it isn't JSX-attribute-shaped or a module specifier — the two exceptions the lexer already knew about. This silently broke every `"use client"`-gated rule check across the whole app. Fixed by adding a third, narrow exception for directive prologues (`"use client"`/`"use server"`/`"use strict"`). **Real-world impact, confirmed via `npm run ci:scan` on this app's own source**: `FIGM-NEXT-01` false-positive count went from 61 hits to 0; total self-scan violations dropped 439 → 378 (quality 74% → 76%). See `docs/audit/ADVERSARIAL_DETECTION_AUDIT.md` for the full fail→root-cause→fix→pass writeup.

---

## Rule Detection Matrix (real fixtures, real execution)

| Rule ID | Category | Positive (TP) fixture | Negative (TN) fixture | TP | TN | Status |
|---|---|---|---|:---:|:---:|:---:|
| FIGM-PERF-01 | PERFORMANCE | Object literal allocated inside `.map()` | Object hoisted outside the loop, only referenced inside | ✅ | ✅ | PASS |
| FIGM-PERF-02 | PERFORMANCE | `<img>` with no width/height/aspect-ratio | `<img>` with explicit `width`/`height` | ✅ | ✅ | PASS |
| FIGM-PERF-03 | PERFORMANCE | `addEventListener` with no `removeEventListener` | Paired `removeEventListener` present | ✅ | ✅ | PASS |
| FIGM-PERF-04 | PERFORMANCE | Import used only inside an `if` branch | Import used both inside and outside the conditional | ✅ | ✅ | PASS |
| FIGM-PERF-05 | PERFORMANCE | Inline arrow callback inside `.map()`/render | Arrow function declared outside loop/render scope | ✅ | ✅ | PASS |
| FIGM-PERF-06 | PERFORMANCE | `localStorage` access inside a loop | `localStorage` access outside any loop | ✅ | ✅ | PASS |
| FIGM-A11Y-01 | ACCESSIBILITY | Non-interactive `<div onClick>` , no keyboard handler | `<div>` with `onClick` + `onKeyDown` + `tabIndex` | ✅ | ✅ | PASS |
| FIGM-A11Y-02 | ACCESSIBILITY | Custom component missing `role`/`aria-label` | Custom component with both `role` and `aria-label` | ✅ | ✅ | PASS |
| FIGM-A11Y-03 | ACCESSIBILITY | Dynamic status container missing `aria-live` | Status container with `aria-live` | ✅ | ✅ | PASS |
| FIGM-A11Y-04 | ACCESSIBILITY | `<Modal>` with no focus-restoration signal | `<Modal onClose={...}>` | ✅ | ✅ | PASS |
| FIGM-A11Y-05 | ACCESSIBILITY | `<input>` with no `aria-label` | `<input aria-label="...">` | ✅ | ✅ | PASS |
| FIGM-A11Y-06 | ACCESSIBILITY | `tabIndex="5"` (positive override) | `tabIndex={0}` (natural order) | ✅ | ✅ | PASS |
| FIGM-NEXT-01 | NEXT.JS | Client hook (`useState`) with no `"use client"` | Same code, with a real `"use client"` directive | ✅ | ✅ | PASS (negative fixture caught and drove a real bug fix — see above) |
| FIGM-NEXT-02 | NEXT.JS | Static top-level import of a heavy module (`monaco-editor`) | Same module loaded via `next/dynamic` | ✅ | ✅ | PASS |
| FIGM-NEXT-03 | NEXT.JS | App Router page missing `export const revalidate` | Page with `export const revalidate` present | ✅ | ✅ | PASS |
| FIGM-NEXT-04 | NEXT.JS | External Google Fonts `<link>` tag | `next/font/google` import instead | ✅ | ✅ | PASS |
| FIGM-REACT-01 | REACT | `.sort()` in render with no `useMemo` | Same computation wrapped in `useMemo` | ✅ | ✅ | PASS |
| FIGM-REACT-02 | REACT | `key={index}` | `key={item.id}` (stable) | ✅ | ✅ | PASS |
| FIGM-REACT-03 | REACT | Direct property mutation (`user.name = ...`) | Immutable update via `setUser({...})` | ✅ | ✅ | PASS |
| FIGM-REACT-04 | REACT | Inline arrow `onClick` prop to a custom component | Memoized (`useCallback`) handler reference passed instead | ✅ | ✅ | PASS |
| FIGM-ANG-01 | ANGULAR | `.subscribe()` with no teardown | `.subscribe()` + `ngOnDestroy` calling `.unsubscribe()` | ✅ | ✅ | PASS |
| FIGM-ANG-02 | ANGULAR | `@Component` missing `ChangeDetectionStrategy.OnPush` | `@Component` with `ChangeDetectionStrategy.OnPush` | ✅ | ✅ | PASS |
| FIGM-ANG-03 | ANGULAR | `*ngFor` with no `trackBy` | `*ngFor; trackBy: trackById` | ✅ | ✅ | PASS |
| FIGM-ANG-04 | ANGULAR | `{{ computeTotal() }}` (function call in template) | `{{ total }}` (plain property interpolation) | ✅ | ✅ | PASS |
| FIGM-ANG-05 | ANGULAR | Direct `nativeElement.style...` mutation | Same change via `this.renderer.setStyle(...)` | ✅ | ✅ | PASS |

**25/25 rules**: real positive fixture fires the rule, real negative fixture does not. 51/51 test assertions pass (50 TP/TN + 1 structural "exactly 25 real rule IDs, no duplicates" check).

## Addendum: FIGM-ANG-06..10 (Phase 2, AST/Rule Coverage Gaps)

Closes part of the doc-level gap the STALE-SCOPE NOTICE above discloses, for the 5 Angular rules
added after this document's original 25-rule scope. Not a rewrite of the table above (which stays
historically accurate for the 25 rules it documents) — a real, currently-passing, execution-backed
addition for the rules this specific category (`ANGULAR`) grew by. **Method**: real positive +
negative fixtures already present in `tests/expansion-rules.test.ts` (FIGM-ANG-06) and
`tests/expansion-2-rules.test.ts` (FIGM-ANG-07..10), executed against the same real `SourceParser`
+ `ASTDetectionEngine` pipeline as the table above — verified passing directly for this addendum,
not assumed from prior claims.

| Rule ID | Category | Positive (TP) fixture | Negative (TN) fixture | TP | TN | sourceKind | Backing test |
|---|---|---|---|:---:|:---:|:---:|---|
| FIGM-ANG-06 | ANGULAR | `@Pipe({ pure: false })` | `@Pipe({...})` (pure by default) | ✅ | ✅ | LEGACY_TEXT_HEURISTIC | `tests/expansion-rules.test.ts` |
| FIGM-ANG-07 | ANGULAR | Service call directly in the constructor body | Constructor only assigns injected fields | ✅ | ✅ | LEGACY_TEXT_HEURISTIC | `tests/expansion-2-rules.test.ts` |
| FIGM-ANG-08 | ANGULAR | `@for (...; track $index)` / `track <loopVar>` | `@for (...; track item.id)` (stable) | ✅ | ✅ | **REAL_AST** (`angular-html-parser`) | `tests/expansion-2-rules.test.ts` |
| FIGM-ANG-09 | ANGULAR | `input()`/`model()` property missing `readonly` | Same property declared `readonly` | ✅ | ✅ | REAL_AST (TS compiler, class body) | `tests/expansion-2-rules.test.ts` |
| FIGM-ANG-10 | ANGULAR | Same observable piped through `\| async` twice in one template | Piped once, or two different observables each piped once | ✅ | ✅ | **REAL_AST** (`angular-html-parser`) | `tests/expansion-2-rules.test.ts` |

**30/30 (25 original + 5 above) Angular-category-relevant rules now have a doc-level, execution-backed TP/TN proof.** ANG-01..05, ANG-08, ANG-09, ANG-10 all report `REAL_AST`; ANG-06/07 remain `LEGACY_TEXT_HEURISTIC` (framework-agnostic decorator/constructor-body text checks — real-AST migration for these two was not part of this addendum's scope). The remaining 20 non-Angular post-25-rule additions (PERF-05/06 already covered above as originally-25; NEXT-05/06, REACT-05..11, A11Y-07, VUE-01..06, and others) are still the STALE-SCOPE NOTICE's open gap and are not addressed by this addendum.

## What this matrix does NOT claim

- **Not exhaustive.** This is one TP + one TN fixture per rule (the minimum needed to prove the rule discriminates at all), not the full positive/negative/boundary/realistic/adversarial × 25-rules fixture set (~100+ fixtures) the original brief describes. Boundary and adversarial cases for a representative subset of rules are covered separately in `docs/audit/ADVERSARIAL_DETECTION_AUDIT.md` (7 confirmed false positives + 1 confirmed false negative, all fixed) rather than exhaustively here.
- **Not a claim of zero false positives/negatives on arbitrary real-world code.** Both audit documents together are explicit that this is architecturally a comment/string-aware line-and-region scanner, not a real AST — genuinely adversarial input not covered by either fixture set could still defeat it. See `archive/FINAL_PRODUCTION_FORENSIC_AUDIT.md` §12 for the standing architectural risk.
- **Framework gating is real but not independently fixtured here.** Several rules (REACT-*, NEXT-*, ANG-*) also require a matching `framework` value to fire; this matrix's fixtures use file paths/content that produce the correct framework for each rule, but framework-detection edge cases are covered separately in `tests/framework-detection.test.ts`.
