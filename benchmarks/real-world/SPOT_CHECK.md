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
