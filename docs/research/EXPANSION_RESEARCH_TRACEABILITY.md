# FIGM Research-Backed Guideline Expansion — Evidence Dossier

**Status:** 8 new rules implemented and shipped through the full FIGM lifecycle (research → guideline → rule → registry → framework mapping → detector → diagnostic → live scan → fixability → patch → rescan → verification → ground truth → evaluation → documentation). Final canonical rule count: **33** (25 baseline + 8 new).

This document is the evidence dossier required by the expansion task's Phase 3 ("Research Evidence") and Phase 20 ("Final Forensic Diff Audit"). Every citation below was independently fetched or searched at implementation time (via `WebFetch`/`WebSearch`), not recalled from memory or invented. Where a direct fetch of the canonical domain failed (see the Environment Constraints section), the citation was corroborated through `WebSearch` against the same canonical URL and cross-checked against at least one independent secondary source before being accepted.

## Environment constraints that shaped this pass

Two hard constraints from the development sandbox materially shaped scope, and are recorded here rather than glossed over:

1. **No npm registry / package-manager network access.** `npm view @vue/compiler-sfc version` and direct registry pings both failed DNS resolution, even with sandbox restrictions lifted. The original plan to add a genuine Vue SFC AST parser (`@vue/compiler-sfc`) for FIGM-VUE-01/02 could not be executed. Per explicit user direction, both Vue rules were implemented on the existing `LEGACY_TEXT_HEURISTIC` tier instead — the same tier the project's other 12 generic rules already use for Vue — honestly labeled as such in both the rule catalog (`knownLimitation`) and every diagnostic's `sourceKind` field. No rule anywhere in this codebase claims `REAL_AST` provenance it does not have.
2. **`WebFetch` could not resolve most documentation domains directly** (`react.dev`, `rxjs.dev`, `vuejs.org`, `angular.dev`, `angular.io` all failed DNS; only `nextjs.org` and `w3.org` resolved). `WebSearch` — which appears to route through a different fetch path — worked for all of them and is the source for citations against those domains. This is disclosed per-rule below.

## Candidates researched but rejected

Per the task's own quality gate ("if a candidate rule is weak, overlapping, not objectively detectable, or poorly supported by evidence, REJECT IT"), the following were investigated and explicitly not implemented:

- **"Missing dynamic status communication" (candidate COMMON-A11Y idea)** — rejected as a duplicate. `FIGM-A11Y-03` (existing, baseline rule) already covers exactly this: a dynamic status container missing `aria-live`/`role="status"`.
- **"Angular *ngIf and *ngFor combined on the same element"** — rejected after research contradicted the premise. Angular's own documentation states the framework does not permit two structural directives (`*ngFor`/`*ngIf`) on one host element at all — it is a compile-time template error, not a silent runtime anti-pattern. A static-analysis rule for this would be unreachable in real, working Angular code, so it fails the "objectively detectable, genuinely new coverage" bar. Replaced with `FIGM-ANG-06` (impure pipe), a rule targeting real, compilable, and genuinely detectable Angular code.
- **RxJS subscribe() missing an error handler** — considered for the Angular set, backed by real RxJS documentation (`rxjs.dev/guide/observer`, confirmed via WebSearch: partial observers silently drop unhandled errors to `onUnhandledError`). Ultimately not implemented this pass: the project's `DomainType` taxonomy is closed to `PERFORMANCE | ACCESSIBILITY`, and forcing an error-handling/reliability concern into either would have required either inventing a spurious ISO 25010 Performance Efficiency mapping (misrepresenting that standard) or adding a third domain — a larger structural change than this pass's scope. Documented here as a legitimate candidate for a future pass that also extends `DomainType`.

## The 8 implemented rules

### FIGM-A11Y-07 — Accessible Name Must Contain Visible Label Text
| Field | Value |
|---|---|
| Category / Framework | COMMON-adjacent, but scoped to `REACT_JSX`/`NEXT_JS` only this pass |
| Severity | HIGH |
| Domain / Concern | ACCESSIBILITY / `INPUT_MODALITIES` (new concern type) |
| Detection | Real AST (TypeScript compiler), JSX-eligible frameworks only |
| Fixability | `AUTOMATED_FIX_WITH_CAVEAT` |
| Research source | W3C Web Accessibility Initiative — WCAG 2.2, Success Criterion 2.5.3 "Label in Name" (Level A) |
| Organization / Year | W3C, WCAG 2.2 (current recommendation) |
| URL | https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html |
| Access method | `WebFetch` (direct fetch succeeded) |
| Evidence summary | "For user interface components with labels that include text or images of text, the name contains the text that is presented visually." Ensures speech-input users who speak the visible label can activate the control. |
| Relevance to SPA architecture | JSX components routinely set `aria-label` to override the accessible name without checking it still contains the visible text — a real, common divergence in hand-authored ARIA. |
| Why FIGM should model it | Objectively, structurally checkable (visible JSXText child vs. attribute string, substring containment) with a low false-positive surface; genuinely new coverage — no baseline rule checks accessible-name *content*, only its presence. |

### FIGM-REACT-05 — Effect Used Solely to Derive State
| Field | Value |
|---|---|
| Category / Framework | REACT — `REACT_JSX`, `NEXT_JS`, `GENERIC_ESTREE` |
| Severity | MEDIUM |
| Domain / Concern | PERFORMANCE / `ARCHITECTURE` |
| Detection | Real AST (TypeScript compiler) |
| Fixability | `MANUAL_REVIEW_REQUIRED` |
| Research source | React core team — official documentation, "You Might Not Need an Effect" |
| Organization / Year | Meta / React core team (react.dev, current) |
| URL | https://react.dev/learn/you-might-not-need-an-effect |
| Access method | `WebSearch` (direct `WebFetch` to react.dev failed DNS in this sandbox) |
| Evidence summary | "If there is no external system involved... you shouldn't need an Effect." Setting state in an Effect forces an extra render pass; the guidance is to compute derived values directly during render. |
| Relevance to SPA architecture | A textbook, extremely common React anti-pattern with first-party framework guidance explicitly against it. |
| Why FIGM should model it | Narrow, objectively checkable AST shape (Effect body = exactly one state-setter call) keeps false positives low while catching a documented, real anti-pattern the original 25 rules never addressed (they cover `useMemo`/`useCallback`/state mutation, not Effect-derived state). |

### FIGM-REACT-06 — Missing Reactive Dependency in Effect Hook
| Field | Value |
|---|---|
| Category / Framework | REACT — `REACT_JSX`, `NEXT_JS`, `GENERIC_ESTREE` |
| Severity | HIGH |
| Domain / Concern | PERFORMANCE / `ARCHITECTURE` |
| Detection | Real AST (TypeScript compiler) |
| Fixability | `MANUAL_REVIEW_REQUIRED` |
| Research source | React core team — official documentation, `useEffect` reference, "Specifying reactive dependencies" |
| Organization / Year | Meta / React core team (react.dev, current) |
| URL | https://react.dev/reference/react/useEffect#specifying-reactive-dependencies |
| Access method | `WebSearch` (direct `WebFetch` to react.dev failed DNS in this sandbox) |
| Evidence summary | "Your Effect's dependencies... must include every reactive value you read in the Effect." Backed by React's own `eslint-plugin-react-hooks`, the canonical enforcement of this exact rule in the ecosystem. |
| Relevance to SPA architecture | Stale-closure bugs from missing dependencies are one of the most common real-world React production bugs. |
| Why FIGM should model it | Deliberately scoped to a narrow, low-false-positive shape (a destructured prop referenced in the Effect body, a present-but-incomplete static dependency array) — genuinely new coverage; no baseline rule inspects `useEffect` dependency correctness at all. |

### FIGM-NEXT-05 — Server-Only Module Imported Across the Client Boundary
| Field | Value |
|---|---|
| Category / Framework | NEXTJS — `NEXT_JS` only |
| Severity | CRITICAL |
| Domain / Concern | PERFORMANCE / `ARCHITECTURE` |
| Detection | Real AST (TypeScript compiler) |
| Fixability | `MANUAL_REVIEW_REQUIRED` |
| Research source | Vercel — official Next.js documentation, "Server and Client Components" |
| Organization / Year | Vercel / Next.js core team (nextjs.org, v16.3.2 docs, fetched 2026-08) |
| URL | https://nextjs.org/docs/app/getting-started/server-and-client-components |
| Access method | `WebFetch` (direct fetch succeeded) |
| Evidence summary | Section "Preventing environment poisoning" explicitly documents the risk of server-only code being imported into client bundles, and names the official `server-only` npm package as the recommended guard. |
| Relevance to SPA architecture | A Node.js built-in import reaching a `'use client'` file is a genuine, first-party-documented risk of secret/logic leakage into the client bundle. |
| Why FIGM should model it | Existing `FIGM-NEXT-01` only checks for the *presence* of `'use client'` alongside React hooks; nothing in the baseline 25 inspects *what* gets imported across that boundary — genuinely new coverage. |

### FIGM-NEXT-06 — Native `<img>` Instead of `next/image`
| Field | Value |
|---|---|
| Category / Framework | NEXTJS — `NEXT_JS` only |
| Severity | MEDIUM |
| Domain / Concern | PERFORMANCE / `LAYOUT_INSTABILITY` |
| Detection | Real AST (TypeScript compiler) |
| Fixability | `AUTOMATED_FIX_WITH_CAVEAT` (only when width/height are already present) |
| Research source | Vercel — official Next.js documentation, Image component API reference |
| Organization / Year | Vercel / Next.js core team (nextjs.org, v16.3.2 docs, fetched 2026-08) |
| URL | https://nextjs.org/docs/app/api-reference/components/image |
| Access method | `WebFetch` (direct fetch succeeded) |
| Evidence summary | "The Next.js Image component extends the HTML `<img>` element for automatic image optimization" — responsive sizing, lazy loading, format negotiation. |
| Relevance to SPA architecture | A very common omission: developers reach for a native `<img>` out of habit, forgoing built-in optimization. |
| Why FIGM should model it | Deliberately distinct from and complementary to the baseline `FIGM-PERF-02` (checks *whether dimensions exist at all*, on any framework) — this rule instead flags the *choice of element* on Next.js specifically, so the two can legitimately co-fire on the same tag without being duplicates of each other. |

### FIGM-ANG-06 — Impure Angular Pipe Declaration
| Field | Value |
|---|---|
| Category / Framework | ANGULAR — `ANGULAR_TEMPLATE`, `GENERIC_ESTREE` |
| Severity | HIGH |
| Domain / Concern | PERFORMANCE / `RESOURCE_UTILIZATION` |
| Detection | Real AST (TypeScript compiler, decorator/class-body path) |
| Fixability | `MANUAL_REVIEW_REQUIRED` |
| Research source | Google — official Angular API reference, `Pipe` decorator |
| Organization / Year | Google / Angular core team (angular.dev, current) |
| URL | https://angular.dev/api/core/Pipe |
| Access method | `WebSearch` (direct `WebFetch` to angular.dev failed DNS in this sandbox) |
| Evidence summary | "If the pipe has internal state..., set pure to false. In this case, the pipe is invoked on each change-detection cycle, even if the arguments have not changed." A real, documented, non-default API behavior. |
| Relevance to SPA architecture | `pure: false` is a real, if uncommon, Angular API surface with a well-documented and significant performance cost when used without a genuine reason. |
| Why FIGM should model it | Objectively AST-checkable (decorator property literal), genuinely new coverage — the baseline 5 Angular rules cover subscriptions, change detection strategy, `*ngFor`, template method calls, and `nativeElement` access, but nothing about Pipes. |

### FIGM-VUE-01 — Unstable or Missing `v-for` Key Binding
| Field | Value |
|---|---|
| Category / Framework | **VUE** (new category — first Vue-exclusive rules in the catalog) — `VUE_SFC` only |
| Severity | HIGH |
| Domain / Concern | PERFORMANCE / `LAYOUT_INSTABILITY` |
| Detection | `LEGACY_TEXT_HEURISTIC` (no Vue template AST — see Environment Constraints) |
| Fixability | `AUTOMATED_FIX_WITH_CAVEAT` |
| Research source | Vue.js core team — official Style Guide, "Priority A Rules: Essential" |
| Organization / Year | Vue.js core team (vuejs.org, current) |
| URL | https://vuejs.org/style-guide/rules-essential.html#use-keyed-v-for |
| Access method | `WebSearch` (direct `WebFetch` to vuejs.org failed DNS in this sandbox) |
| Evidence summary | "Always use key with v-for" — an Essential (highest priority) rule in Vue's own style guide, citing object constancy and correct component-state tracking across re-renders. |
| Relevance to SPA architecture | The direct Vue-directive analog of the baseline `FIGM-REACT-02` (array-index-key) — the same underlying bug class, different framework syntax. |
| Why FIGM should model it | Vue previously had **zero** dedicated rules (confirmed independently in the prior forensic audit) despite being one of FIGM's five supported frameworks; this is the first rule that actually targets Vue-specific syntax rather than relying on the 12 generic rules alone. |

### FIGM-VUE-02 — Combined `v-if` and `v-for` on the Same Element
| Field | Value |
|---|---|
| Category / Framework | **VUE** — `VUE_SFC` only |
| Severity | HIGH |
| Domain / Concern | PERFORMANCE / `RESOURCE_UTILIZATION` |
| Detection | `LEGACY_TEXT_HEURISTIC` (same constraint as FIGM-VUE-01) |
| Fixability | `MANUAL_REVIEW_REQUIRED` |
| Research source | Vue.js core team — official Style Guide, "Priority A Rules: Essential" |
| Organization / Year | Vue.js core team (vuejs.org, current); also enforced by the official `eslint-plugin-vue` rule `no-use-v-if-with-v-for` |
| URL | https://vuejs.org/style-guide/rules-essential |
| Access method | `WebSearch` (direct `WebFetch` to vuejs.org failed DNS in this sandbox) |
| Evidence summary | "Never use v-if on the same element as v-for... v-for has a higher priority than v-if" — re-evaluates the condition on every iteration instead of filtering the list once. |
| Relevance to SPA architecture | A very common Vue authoring mistake, explicitly called out by both the official style guide and its companion lint rule. |
| Why FIGM should model it | Second and final Vue-specific rule this pass; pairs with FIGM-VUE-01 to give Vue its first genuine framework-specific coverage. |

## Duplicate/overlap analysis summary (Phase 4)

Every candidate above was checked against all 25 baseline rules' `description`/`knownLimitation` text before acceptance. One genuine near-duplicate was found and rejected (the "missing dynamic status communication" idea vs. baseline `FIGM-A11Y-03`, above). `FIGM-NEXT-06` was deliberately kept distinct from `FIGM-PERF-02` by design (different concern: element choice vs. dimension presence) rather than merged, since the two can independently be true or false of the same tag and a merge would conflate two separable, individually-actionable findings.

## What changed vs. what didn't

- **25 baseline rules: unchanged.** No `ruleId`, `severity`, `frameworks`, `remediationStatus`, or detector logic for any of the original 25 was modified. Verified by the full regression suite (844/845 tests passing; the one failure is a pre-existing, self-documented, environment-state-dependent test unrelated to rule detection — see `tests/admin-research-dashboard.test.ts`'s own comment on participant-slot pool exhaustion).
- **Two latent cross-rule collision bugs were found and fixed during this pass**, both in code this pass added, not pre-existing: `buildA11y07` and `buildNext06` initially synthesized their new AST node with the element's real (sometimes uppercase, or `img`-named) tag name, which could spuriously satisfy `FIGM-A11Y-02`'s or `FIGM-PERF-02`'s own predicate on the *same* node (a live-reproduced duplicate/false diagnostic, caught by `tests/complete-rule-evaluation.test.ts`). Fixed by following the existing `buildA11y03` precedent of synthesizing a neutral, non-colliding node name — a pattern already established in the codebase for exactly this reason.
- **Final state: 33/33 rules with ground-truth coverage**, 48 true positives / 0 false positives / 0 false negatives on the controlled `benchmarks/testbed/` corpus (up from 40/25), and 33/33 rules with dedicated positive+negative cases in the complementary `benchmarks/complete-rule-evaluation/` dataset (72 cases total, TP=33/FP=0/FN=0/TN=39). Both figures are **controlled/synthetic-benchmark results, not real-world validation** — see the caveats already established for the original 25 rules' evaluation in the prior forensic audit, which apply identically here.
