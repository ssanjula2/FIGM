# Real-World Benchmark — Manual Spot-Check

**This is the ONLY source of independent ground truth in the real-world benchmark.** Everything in
`raw-results/*.json` is unverified raw tool output. The 18 findings below were individually
verified by reading the actual source line (and surrounding context) at the reported location in
the pinned commit, and judged by hand. Nothing here was generated or guessed by FIGM itself.

**Sampling method, stated honestly:** this is a small (n=18), *purposively diverse* sample — at
least one finding per repository and at least one per distinct rule ID that fired, plus several
findings deliberately picked because the raw `message` text looked inconsistent with the
`offendingCodeSnippet` (a cheap way to surface likely false positives without reading everything).
**It is not a random sample and the resulting ratio below must not be read as "FIGM's real-world
precision."** It is a bounded statement about exactly these 18 findings, nothing more. See
METHODOLOGY.md for why a larger/randomized sample was out of scope for this pass.

## Verdict legend

- **TP** — genuinely correct: the reported location has the exact defect the rule describes.
- **TP (narrow)** — the underlying formal predicate is satisfied and the finding is not wrong per
  se, but the rule's plain-English name/remediation implies a scenario (a loop, a React render
  cycle, a "heavy" module) that does not actually apply at this location — flagged separately from
  a clean TP because treating it as equally actionable would overstate the tool's precision.
- **FP** — genuinely incorrect: the code does not exhibit the defect the rule claims to detect.

## Findings

| # | Repo | Rule | Location | Verdict | Reasoning |
|---|---|---|---|---|---|
| 1 | react-crash-2021 | FIGM-A11Y-05 | `src/components/AddTask.js:27` | **TP** | `<input type='text' ... value={text} onChange={...} />` has a sibling `<label>Task</label>` with no `htmlFor`, and the input has no `id`/`aria-label`. The label and input are visually adjacent but never programmatically associated — a real WCAG 1.3.1 violation. |
| 2 | react-crash-2021 | FIGM-REACT-02 | `src/components/Tasks.js:7` | **TP** | `tasks.map((task, index) => <Task key={index} ...>)` — `index` is used directly as the key. Textbook case. |
| 3 | react-crash-2021 | FIGM-REACT-03 | `src/components/Button.js:15` | **FP** | Flagged line is `Button.defaultProps = { color: 'steelblue' }` — the standard, idiomatic React `defaultProps` static-property pattern, not a state mutation. There is no `useState` anywhere in this file. The detector appears to match *any* `Identifier.property = value` assignment shape without verifying the target is actually component state. |
| 4 | react-crash-2021 | FIGM-PERF-05 | `src/App.js:94` | **TP (narrow)** | `onAdd={() => setShowAddTask(!showAddTask)}` is a real inline arrow prop, but it sits in `App`'s single top-level JSX return, not inside a `.map()`/list loop. The rule's formal predicate allows `Scope(n) in {LOOP, RENDER}` (not loop-only), so this is a legitimate match against "RENDER" scope — but the rule's own name ("...in Render Loops") and remediation text read as if this always implies a repeated-iteration cost, which is not true here: this handler is created once per component render, the same as effectively every inline JSX handler in React. |
| 5 | nextjs-portfolio-starter | FIGM-REACT-03 | `next.config.js:2` | **FP** | Flagged line is `module.exports = withNextra()` — a Node CommonJS export in a build config file with zero React in it. Same systemic pattern as #3. |
| 6 | nextjs-portfolio-starter | FIGM-REACT-01 | `scripts/gen-rss.js:35` | **TP (narrow)** | `allPosts.sort((a,b) => ...)` is a real unwrapped `.sort()` call, but `scripts/gen-rss.js` is a standalone Node build script (`async function generate() {...}; generate()`), not a React component — there is no render cycle and no React import in this file at all. The predicate is satisfied per its own documented "no scope restriction" limitation, but the remediation text ("wrap in `React.useMemo`") is nonsensical advice for a file with no React runtime. |
| 7 | nextjs-portfolio-starter | FIGM-PERF-01 | `pages/_document.js:4` | **TP (narrow)** | `const meta = {...}` is declared inside the `Document()` component function and never mutated — hoisting it to module scope would be a correct, if minor, optimization. Real, but low practical impact: `_document.js` renders once per SSR request, not in a tight loop. |
| 8 | angular-tour-of-heroes | FIGM-REACT-03 | `karma.conf.js:4` | **FP** | Flagged line is `module.exports = function(config) { config.set({...}) }` — a Karma test-runner config file. Nothing resembling React state. Same systemic pattern as #3 and #5. |
| 9 | angular-tour-of-heroes | FIGM-ANG-02 | `src/app/app.component.ts:3` | **TP** | `@Component({ selector: 'my-root', template: ..., styleUrls: [...] })` genuinely has no `changeDetection: ChangeDetectionStrategy.OnPush`. Accurate (this is 2018-era Angular tutorial code, predating OnPush becoming a common default recommendation — a realistic finding, not a contrived one). |
| 10 | angular-tour-of-heroes | FIGM-ANG-01 | `src/app/dashboard.component.ts:21` | **TP** | `this.heroService.getHeroes().subscribe(heroes => this.heroes = heroes.slice(1,5))` inside `ngOnInit()`, with no `ngOnDestroy()`, no stored `Subscription`, and no `takeUntilDestroyed()` anywhere in the file. A genuine, classic Angular subscription leak. |
| 11 | angular-tour-of-heroes | FIGM-PERF-04 | `src/main.ts:1` | **TP (narrow)** | `import { enableProdMode } from '@angular/core'` — reading the full file, `enableProdMode()` is indeed called only inside `if (environment.production) {...}`, so the predicate is technically satisfied. But `@angular/core` is already a hard synchronous dependency of the entire app at bootstrap; dynamically importing part of it is not a meaningful optimization. |
| 12 | vue-hackernews-2.0 | FIGM-PERF-04 | `src/api/create-api-server.js:1` | **TP** | `import Firebase from 'firebase'`, referenced only inside `else { Firebase.initializeApp(...) }`. `firebase` is a genuinely large third-party SDK, so a conditional/dynamic import is a legitimate, actionable suggestion here — a meaningfully different case from #11. |
| 13 | vue-hackernews-2.0 | FIGM-PERF-02 | `src/App.vue:6` | **TP** | `<img class="logo" src="~public/logo-48.png" alt="logo">` has no width/height/aspect-ratio anywhere. Real CLS risk. |
| 14 | vue-hackernews-2.0 | FIGM-REACT-01 | `src/app.js:14` | **FP** | Flagged line is `Vue.filter(key, filters[key])` inside `Object.keys(filters).forEach(...)` — this is Vue's *global filter registration* API (`Vue.filter(name, fn)`), not `Array.prototype.filter`. The detector appears to match on the method name `filter` alone, without checking that the call is actually an array operation. This is the clearest, most concrete false-positive class found in this sample. |
| 15 | vanillawebprojects | FIGM-REACT-03 | `breakout-game/script.js:60` | **FP** | Flagged line is `ctx.fillStyle = ball.visible ? '#0095dd' : 'transparent'` — a Canvas 2D rendering-context property assignment. Nothing to do with React state (this project has no React at all). Same systemic pattern as #3/#5/#8. |
| 16 | vanillawebprojects | FIGM-PERF-03 | `breakout-game/script.js:235` | **TP (narrow)** | `document.addEventListener('keydown', keyDown)` — grepped the whole file: no matching `removeEventListener` exists for any of its 4 listeners. Technically a correct finding, but this is a single static game page with no unmount lifecycle at all, so "leak" framing is a stretch — the listener lives exactly as long as the page does, which is normal for this kind of script. |
| 17 | vanillawebprojects | FIGM-PERF-02 | `meal-finder/script.js:33` | **TP** | `<img src="${meal.strMealThumb}" alt="${meal.strMeal}" />` built inside a template-literal string (not JSX) — correctly detected via FIGM's legacy text-heuristic path (`sourceKind: LEGACY_TEXT_HEURISTIC`), and genuinely missing width/height. |
| 18 | vanillawebprojects | FIGM-REACT-01 | `dom-array-methods/script.js:41` | **TP (narrow)** | `data.sort((a,b) => b.money - a.money)` inside a plain function, in a vanilla-JS file with no React anywhere. Same pattern as #6: the underlying `.sort()`-without-`useMemo` predicate is satisfied by its own broad definition, but the remediation ("wrap in `React.useMemo`") is inapplicable advice outside a React codebase. |

## Summary of this sample (n=18, not a random sample — see caveat above)

- **Clean TP:** 7 (#1, #2, #9, #10, #12, #13, #17)
- **TP (narrow — predicate technically satisfied, but low practical value or a rule-name/remediation mismatch):** 6 (#4, #6, #7, #11, #16, #18)
- **FP:** 5 (#3, #5, #8, #14, #15)

If "TP (narrow)" is counted as correct (the predicate is, after all, satisfied exactly as documented), this sample's precision is **13/18 (72%)**. If only clean TPs count, it is **7/18 (39%)**. Both numbers are reported because the honest answer depends on what "correct" means for a narrowly-scoped rule, and this sample is too small either way to generalize.

## Two concrete, reproducible false-positive classes identified

1. **FIGM-REACT-03 flags any property/member assignment, not just React state mutation.** All 4 FP
   instances in this sample (#3, #5, #8, #15) are non-React property assignments (`X.defaultProps =`,
   `module.exports =`, `ctx.fillStyle =`) misclassified as "Direct mutation of React state
   variable." This matches the rule's own documented `knownLimitation` in
   `src/matrix/four-layer-meta-model.ts` ("No true React-state-binding analysis -- any local
   variable whose mutation shape matches is flagged") — this spot-check is the first empirical
   real-world confirmation of that documented limitation actually manifesting, and shows it can
   fire on files with *zero* React content at all (build configs, Canvas API code).
2. **FIGM-REACT-01 appears to match on the method name `sort`/`filter`/`reduce` alone, without
   checking the receiver is an array or the context is a React render.** #14 (`Vue.filter(...)`) is
   unambiguous: this is not an array method call at all. #6 and #18 are real `Array.prototype.sort`
   calls but in non-React files where the `useMemo` remediation is inapplicable.

Neither of these was fixed as part of this benchmarking task (out of scope — see METHODOLOGY.md),
but both are concrete, reproducible, file/line-cited findings a maintainer could act on directly.

**Correction (Phase: pre-data-collection remediation):** both classes have since been fixed in
`src/ast/real-syntax-node-builder.ts`:

1. FIGM-REACT-03 (`buildReact03`, line ~733) now requires `isProvableStateTarget(ctx, ...)` (line
   727) before flagging Shape A (`arr.push(...)`) or Shape B (`obj.prop = value`) as a state
   mutation — the target must be a `this.state`/`this.setState`-style access, or its root
   identifier must be in `ctx.stateLikeNames` (file-wide, positive `useState`/state-hook evidence
   computed once per file). A bare `X.defaultProps = {...}`, `module.exports = ...`, or
   `ctx.fillStyle = ...` — none of which touch a name with real state evidence — no longer fires.
2. FIGM-REACT-01 (`buildReact01`, line ~983) now calls `isLikelyNonArrayNamespaceReceiver` (line
   959, an uppercase-leading-identifier heuristic that correctly excludes namespace/class-style
   receivers such as `Vue.filter(...)`) and, for `GENERIC_ESTREE` files specifically, requires
   `ctx.hasReactContext` (real JSX syntax, a `.jsx`/`.tsx` extension, or an actual `import ... from
   'react'`) before firing at all — closing exactly the `Vue.filter(...)` misfire (#14) and the
   non-React build-script false-positives (#6, #18) documented above.

Both fixes are unit-tested (`tests/react-ast-rules.test.ts`, `tests/framework-detection-react-hint-hardening.test.ts`)
and the full suite passes with them in place (see `research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md`
Section 18). **This spot-check's 13/18 (72%) / 7/18 (39%) accuracy figures are now stale** — they
were measured against the pre-fix detector. A fresh real-world re-scan (and ideally a larger,
re-sampled spot-check) against the corrected detector is required before citing an updated accuracy
figure; none is fabricated here in its place.

**Real-world re-run confirmation (final implementation pass, `_combined-summary.json` regenerated
2026-09-02T17:21:57.872Z, prior run archived at
`benchmarks/real-world/raw-results-archive/2026-08-25-pre-final-pass/`):** the `javascript-algorithms`
repo (`trekhleb/javascript-algorithms`, a plain-JS/TS algorithms repository with zero React
content — exactly the shape #6/#18 above describe) reported **`FIGM-REACT-01: 55`** findings in the
pre-fix run and **zero** `FIGM-REACT-01` findings in this session's fresh re-run against the same
pinned commit — direct, real-world (not merely unit-test) confirmation that the `hasReactContext`
gate closes this false-positive class. Total findings across all 15 repos dropped from 497 to 392
(-21%) on an unchanged 843-file/59-parse-error-adjusted corpus, consistent with a genuine
false-positive reduction rather than a coverage regression (0 engine crashes in both runs; total
files scanned identical at 843). A new observation from this same re-run, **not yet investigated or
fixed**: `FIGM-ANG-07` ("Complex Logic in Angular Component Constructor") fired 11 times in this
same non-Angular `javascript-algorithms` repo — `ANG-07` is intentionally gated to include
`GENERIC_ESTREE` alongside `ANGULAR_TEMPLATE` (`ANGULAR_CLASS_FRAMEWORKS` in
`real-syntax-node-builder.ts`), so this may be a deliberate framework-agnostic-by-design
application of a general "complex constructor logic" pattern rather than a defect — but it was not
verified either way this session and should be treated as an open question, not assumed correct.
Angular template parse-error counts also increased in this re-run (`angular-realworld-example-app`:
0→13, `reactive-angular-course`: 0→5, `angular-tour-of-heroes`: 0→2) — consistent with the real
`angular-html-parser`-based template parser (landed in a prior session within this same multi-turn
engagement) now genuinely detecting malformed/complex templates that the previous text-heuristic
path silently never flagged as a parse failure at all. This is a rigor improvement (honest
`PARTIAL`/parse-error reporting) rather than a regression, consistent with this project's
false-clean-scan protection design — but it was not manually spot-checked this session to confirm
each new parse error is genuine rather than a new false positive of the parser itself.
