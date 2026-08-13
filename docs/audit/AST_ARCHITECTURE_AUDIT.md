# FIGM Analysis Engine — Architecture Audit

**Question this document answers**: does FIGM's detection engine use a real AST, or text/regex
scanning dressed in AST-shaped data structures? The dissertation (Chapter 3 §3.x, Chapter 4 §4.2)
describes `SourceParser` as producing "resilient AST node generation" and `ASTDetectionEngine` as
evaluating "25 AST Rule Predicates" against an "AST Node Tree." This document traces the actual
code to determine whether that's accurate, rule by rule.

**Result: the 25 FIGM-\* guideline rules are regex/line/substring-based pattern matching over a
synthetic tree-shaped data structure — not real AST analysis.** Two things in the codebase *are*
genuine AST/compiler-based analysis (see §4), but neither of them backs any of the 25 FIGM rules
the dissertation's methodology chapter is about. §7 gives the specific wording correction.

---

## 1. Pipeline trace: Source → Parser → AST → ALP → Rule Engine → Violation → Evidence → Remediation → UI

| Stage | File | What it actually does |
|---|---|---|
| **Source → "AST"** | `src/parser/source-parser.ts`, `SourceParser.buildASTFromCode()` | Splits the file into lines, runs a hand-written character-level lexer (`stripCommentsAndStrings` — this part *is* real, genuine tokenization: a finite-state machine over CODE/STRING/LINE_COMMENT/BLOCK_COMMENT states) to blank out comments/string literals, then walks each line applying ~22 independent `.includes()`/regex checks. Each match that fires pushes a synthetic `ASTNode` (`{type, name, attributes, loc}`) as a flat child of `root`. There is no real parser: no tokenizer for the full JS/JSX grammar, no operator-precedence parsing, no real nested expression tree, no real scope/binding resolution. The "AST" is a list of independently-detected line matches, shaped to *look* like AST nodes (real `type` strings like `'JSXElement'`, `'CallExpression'`), not derived from parsing. |
| **AST → Normalized AST** | `src/ast/universal-ast-mapper.ts`, `UniversalASTMapper.normalizeNode()` | Copies the synthetic node's fields through unchanged (no real cross-framework AST translation happens here despite the class name). |
| **Normalized AST → ALP** | `src/parser/alp-extractor.ts`, `ALPExtractionEngine` | Traverses the same synthetic tree and re-checks the *same* boolean `attributes` flags source-parser.ts already computed (`attrs.isInvariant`, `attrs.onClick !== undefined`, etc.) against a switch statement (`matchesALP`) to bucket each node into one of 8 named "Abstract Language Primitives." No new analysis — a relabeling pass. |
| **ALP → Rule Engine → Violation** | `src/ast/ast-detection-engine.ts`, `ASTDetectionEngine.evaluateNode()` | For each synthetic node, 25 `evalXXX()` predicate functions check `node.type`/`node.scopeType`/`node.attributes.isXXX === true`. This part is genuinely a **tree-shaped predicate evaluator with real recursion** (`node.children` traversal) — the architecture here is legitimate. The problem is entirely upstream: the tree it evaluates was built by regex, so a syntactically-aware predicate evaluator is being fed semantically-shallow input. |
| **Violation → Evidence** | Same file, `createReport()` | `evidence: `AST Node: [${node.type}] at line ${...}`` — the evidence string shown to users literally says "AST Node," reinforcing the same terminology gap at the user-facing layer. |
| **Remediation** | `src/engine/remediation-engine.ts` | 61 regex/string operations (`.match`/`.includes`/`.test`) generating fix diffs via text template substitution — also not AST-based (this was already out of scope for the "AST" claim specifically, but noted for completeness: the fallback remediation path is template-based, not a real AST transform/codemod). |
| **UI** | `app/reports/[id]/page.tsx` (scan detail timeline), `app/components/landing/ArchitecturePipeline.tsx` (landing page) | Both display literal "AST Parsing" / "Parsed into Abstract Syntax Tree primitives" language. The landing page's AST demo panel (`ArchitecturePipeline.tsx`, `astText` field) shows a **hardcoded illustrative string** (`CallExpression\n...`) — not live output from any real file, purely a canned demo for the marketing pipeline visualization. |

### Decorative/unused "real AST query" infrastructure

`src/ast/universal-ast-mapper.ts` defines `QUERY_TEMPLATES` and `FRAMEWORK_TRANSLATIONS` —
CSS-selector-style strings that look like a genuine AST query language, e.g.:
```
'CallExpression[callee.property.name="map|forEach|reduce|filter"] > ArrowFunctionExpression ObjectExpression'
```
and `elementNameExtractor: 'node.openingElement.name.name'` (a property-path *string*, never
evaluated as code). Grepped repo-wide: these are consumed in exactly one place —
`src/matrix/four-layer-meta-model.ts`'s `export-spec` builder, which copies `selectorString` into
a `universalASTSelector` field purely for **display** in the exported rule-traceability
documentation (consumed by `/guidelines` page and `npm run generate-spec`). **They are never
parsed or executed against anything.** This is real, working display/documentation code — it just
displays a query language that doesn't exist. `src/matrix/four-layer-meta-model.ts`'s
`CORE_ALPS[].astNodeType` fields (e.g. `'JSXElement[name="img|video|iframe"]'`) are the same
pattern: real, useful documentation values, but not executable AST selectors.

---

## 2. Rule-by-rule classification (all 25 rules)

Every rule's detection logic lives in two places that must agree: the trigger in
`source-parser.ts` (which sets an `attributes` flag) and the predicate in
`ast-detection-engine.ts` (which reads that flag). **Every single one of the 25 is Regex/String,
except two that use a hand-rolled brace-depth-aware scanner** (real bracket-nesting tracking, more
resilient than single-line regex, but still not a real parser) — those two are labeled
**"Heuristic (AST-informed)."**

| Rule ID | Trigger mechanism | Classification | Known false-positive/negative gap |
|---|---|---|---|
| FIGM-PERF-01 | `cTrimmed.startsWith('const '\|'let '\|'var ') && .includes('= {')` in LOOP/RENDER scope | **Regex/String** | Any `{`-shaped RHS counts (block-looking text), no real object-literal grammar check |
| FIGM-PERF-02 | `.includes('<img')` + regex for `width=`/`height=` | **Regex/String** | Same-line only; a multi-line `<img\n  width={100}` attribute is missed |
| FIGM-PERF-03 | `.includes('.addEventListener(')` + whole-file `.includes('.removeEventListener(')` | **Regex/String** | Whole-*file* pairing — any `removeEventListener` anywhere in the file, even for a different listener, suppresses the finding |
| FIGM-PERF-04 | Import module-name regex + `isReferencedInsideConditionalBlock()` (brace-depth line tracking) | **Heuristic (AST-informed)** | Real nesting-depth tracking, but line-based, not real scope resolution |
| FIGM-PERF-05 | `.includes('onClick={() =>')` or `.map(` + `() =>` on the same line | **Regex/String** | Same-line only |
| FIGM-PERF-06 | `.includes('localStorage.')` / `sessionStorage.` in LOOP/RENDER scope | **Regex/String** | No real scope resolution, relies on the same scope-transition heuristic as PERF-01 |
| FIGM-A11Y-01 | `scanJsxOpenTagAttrs()` — real multi-line, brace-depth-aware tag-attribute scan | **Heuristic (AST-informed)** | Not a real JSX/element parser (no nested-element tree, no spread-attribute handling) |
| FIGM-A11Y-02 | `.includes('<Custom')\|'<Select'\|'<Dropdown')` | **Regex/String** | Extremely narrow allow-list — any other custom component name is invisible to this rule |
| FIGM-A11Y-03 | `.includes('className="status'\|'class="status'\|'id="status')` | **Regex/String** | Literal substring `"status` required; `className={statusClass}` or any dynamic class name is invisible |
| FIGM-A11Y-04 | `.includes('<Modal')\|'<Dialog')` | **Regex/String** | Same narrow allow-list problem as A11Y-02 |
| FIGM-A11Y-05 | `.includes('<input'\|'<textarea'\|'<select')` + label/id substring checks | **Regex/String** | No real DOM-tree association between a `<label htmlFor>` and its target input |
| FIGM-A11Y-06 | Regex `tab[I|i]ndex=["'{]?([1-9]\d*)` | **Regex/String** | — |
| FIGM-NEXT-01 | `.includes('useState('\|'useEffect('\|...)` gated by file-level `"use client"` substring | **Regex/String** | — |
| FIGM-NEXT-02 | Import module name against a **hardcoded list** `['monaco-editor','chart.js','three','canvas','echarts','d3']` | **Regex/String** | Any other heavy package (e.g. `pdfjs-dist`, `fabric`) is invisible |
| FIGM-NEXT-03 | Path pattern (`app/`/`pages/` + `page.*`) + whole-file `.includes('export const revalidate')` | **Path + String** | — |
| FIGM-NEXT-04 | `.includes('fonts.googleapis.com')` or link+stylesheet+fonts co-occurrence | **Regex/String** | — |
| FIGM-REACT-01 | `.includes('.sort('\|'.filter('\|'.reduce(')` + same-line `!.includes('useMemo')` | **Regex/String** | Same-line proximity only — doesn't verify `useMemo` actually wraps that specific call |
| FIGM-REACT-02 | `.includes('key={index}'\|'key={i}'\|'key={idx}')` | **✅ MIGRATED — Real AST** (React/Next.js only; see §5) | Was: 3 hardcoded names only, no scope verification |
| FIGM-REACT-03 | Mutation-method regex + fragile "is this an assignment vs. comparison" heuristic (excludes `==`, `:`, `const/let/var`, lines starting with `set`) | **Regex/Heuristic** | Flags `.push()` on any plain local array, not just state; many plausible false positives |
| FIGM-REACT-04 | `.includes('<Custom'\|'<Button'\|'<Card')` + `onClick={() =>` | **Regex/String** | Same narrow-allowlist problem as A11Y-02/A11Y-04 |
| FIGM-ANG-01 | `.includes('.subscribe(')` + whole-file absence of `takeUntilDestroyed`/`unsubscribe`/`DestroyRef` | **Regex/String** | Whole-file pairing, same class of issue as PERF-03 |
| FIGM-ANG-02 | `.includes('@Component({')` + whole-file absence of `ChangeDetectionStrategy.OnPush` | **Regex/String** | — |
| FIGM-ANG-03 | `.includes('*ngFor=')` + same-line absence of `trackBy` | **Regex/String** | Same-line only |
| FIGM-ANG-04 | `{{` + `()` (or `]="` + `()`) co-occurring on one line | **Regex/String** | Prone to both false positives (unrelated parens) and false negatives (multi-line interpolation) |
| FIGM-ANG-05 | `.includes('nativeElement.')` + same-line absence of `renderer.`/`Renderer2` | **Regex/String** | — |

**Summary**: 22 of 25 rules are pure regex/substring matching; 2 (PERF-04, A11Y-01) use a
hand-rolled brace-depth-tracking heuristic that is more resilient to formatting but still not real
parsing; 1 (REACT-02) is now genuinely AST-based for React/Next.js as of this audit (§5). **Zero**
of the 25 rules used a real JS/JSX/TS parser before this change.

---

## 3. What genuinely IS real AST/compiler analysis in this codebase

Two things — neither backs any FIGM-\* rule:

1. **`src/analysis/type-checker-service.ts`** (`TypeCheckerService`) — genuinely real: uses the
   actual `typescript` npm package's compiler API (`ts.createSourceFile`, `ts.createProgram`,
   `ts.getPreEmitDiagnostics`) to run real type-checking and surface real compiler diagnostics as
   `TYPE-TS-<code>` reports. This is wired into `RuleExecutionEngine.analyzeFile()` and its output
   is merged into the same `diagnostics` array shown to users — but these are TypeScript compiler
   errors (wrong types, missing properties), a different diagnostic category from the 25
   FIGM guideline rules, not an AST backend for them.
2. **`stripCommentsAndStrings()`** in `source-parser.ts` — a real character-level lexer (genuine
   finite-state tokenization of comment/string boundaries), used only as a preprocessing pass to
   stop comment/string text from being misread as code, not to build a syntax tree.

---

## 4. Phase 2 — Migration architecture

### Parser choice, and why no new dependency

| Framework | Real parser needed | Already available? |
|---|---|---|
| React / JS / TS (Stage A) | A JS/TSX-capable AST parser | **Yes** — `typescript` (the compiler API) is already a project dependency, already used at runtime by `TypeCheckerService`. `ts.createSourceFile(..., ts.ScriptKind.TSX)` parses JS, TS, JSX, and TSX with a single, already-installed package. **No new dependency introduced** (package.json corrected: `typescript` was already used at runtime but miscategorized as a devDependency — moved to `dependencies`, itself a bug worth fixing since a `--production` install would have silently broken `TypeCheckerService`). |
| Next.js (Stage B) | Same JS/TSX parser, plus Next.js-specific conventions (App Router file roles, `"use client"`, route segment config) | Same `typescript` parser; Next.js-specific rules (FIGM-NEXT-01..04) need file-path-role detection (already exists, path-based, not parser-dependent) layered on top of real AST for the *code-shape* half of each rule (e.g. "is `useState` actually called at the top level of the component function," not just "does this line contain the substring `useState(`"). |
| Vue (Stage D) | A Vue SFC template/script compiler | **Not currently available.** Would require adding `@vue/compiler-sfc` (the official Vue SFC parser) — justified because Vue's template syntax (`v-on:click`, `{{ }}` interpolation, `<script setup>`) is not JS/JSX and the TypeScript compiler cannot parse Vue templates at all. This is a genuinely new dependency and should be scoped to exactly Vue-template-syntax rules when implemented. |
| Angular (Stage C) | An Angular template compiler | **Not currently available.** Would require `@angular/compiler` (official) to parse `*ngFor`, `(click)`, `{{ }}` interpolation, and `@Component` decorator metadata correctly. Also a genuinely new dependency, same justification pattern as Vue. |

**Recommended order given available tooling**: **Stage A (React/JS/TS) before Stage B/C/D**, since
Stage A requires zero new dependencies and de-risks the migration pattern (additive swap-in,
preserved rule IDs, side-by-side regression proof) before spending a new third-party parser
dependency on Angular/Vue. This is why this audit implements Stage A now and leaves B–E as a
scoped, justified plan rather than partially starting all of them.

### Migration pattern (used for Stage A, intended to repeat for B–E)

1. New file under `src/analysis/` implementing the real-AST detector for one rule/framework pair,
   returning the *exact same* `DiagnosticReport` shape (same `ruleId`, sourced from the same
   `FOUR_LAYER_MAPPINGS`/`getStandardReference` lookups the regex path uses).
2. `RuleExecutionEngine.analyzeFile()` filters that rule ID out of the regex engine's output *for
   the migrated framework(s) only* and appends the real-AST detector's output in its place —
   never both (no duplicate diagnostics), never for unmigrated frameworks (zero risk to Vue/
   Angular/generic paths).
3. `ASTDetectionEngine`/`SourceParser` are untouched — every existing test that calls them directly
   (`ast-detection-rules.test.ts`, `rule-detection-matrix.test.ts`) keeps exercising the regex path
   unmodified, so migrating a rule can never silently change what those specific tests assert.
4. New rule-specific test file proves the regex path's actual false-positive/false-negative
   behavior against the new real-AST path on concrete inputs (not just "both pass on the same
   easy case") — see `tests/react-ast-rules.test.ts`.

---

## 5. Migration status

| Stage | Scope | Status |
|---|---|---|
| **A** | React / JS / TS | **Partially implemented this pass**: FIGM-REACT-02 (array-index key) migrated to real TypeScript-compiler AST analysis for `REACT_JSX`/`NEXT_JS` files. 12 remaining Stage-A-applicable rules (PERF-01/02/03/04/05/06, A11Y-01..06 when they fire in React files, REACT-01/03/04, NEXT-01/02/04) remain regex-based — see §6. |
| **B** | Next.js | Not implemented. Designed in §4 (reuses the same `typescript` parser; needs App-Router-role-aware traversal layered on top). |
| **C** | Angular | Not implemented. Requires adding `@angular/compiler` (justified, new dependency) — not added in this pass. |
| **D** | Vue | Not implemented. Requires adding `@vue/compiler-sfc` (justified, new dependency) — not added in this pass. |
| **E** | Common IR / abstraction | Not implemented. `UniversalASTMapper`/ALP layer already exists as an *intended* abstraction point (§1) but currently just passes synthetic-node fields through; once B/C/D each have a real per-framework parser, this is where their real ASTs would converge into one shape for the 25 rules to query uniformly. Premature to build before at least two real parsers (Stage A + one of B/C/D) exist to abstract over. |

### Why only one rule, not all of Stage A, in this pass

Migrating a rule to real AST correctly (not just "compiles and returns something") requires
individually re-deriving the right AST shape, scope semantics, and edge cases per rule, plus a
full false-positive/false-negative test pair proving it's actually more correct than the regex
version it replaces — the same rigor applied to FIGM-REACT-02 below. Doing that shallowly for 12
rules in one pass would produce exactly the kind of unverified, overclaimed "migration" this audit
exists to prevent. One rule done rigorously, with concrete proof, is the honest deliverable; the
rest are scoped and ready to repeat the same pattern.

---

## 6. Test results (this pass)

`tests/react-ast-rules.test.ts` — 13 tests, all passing:
- Positive, negative, 2 boundary (template-literal key; mixed template not flagged), 2 malformed-
  syntax (never throws), false-positive regression (proves the *old* regex path really does
  false-positive on an unrelated `index` variable; the new path doesn't), false-negative
  regression (proves the *old* regex path really does miss a non-standard index parameter name;
  the new path doesn't), 4 end-to-end `RuleExecutionEngine` regression tests (`.jsx`, `.tsx`, Vue/
  Angular unaffected, existing fixture agreement).
- Full existing suite: **300/300 passing** (287 pre-existing + 13 new), zero regressions.
- Canonical ground-truth benchmark (`npm run research:evaluate`) re-run: **unchanged**
  (TP=18/FP=3/FN=1, P=85.7%/R=94.7%/F1=90.0%) — the fixture testbed doesn't exercise
  FIGM-REACT-02, so this migration has no effect on the dissertation's headline accuracy numbers.
- Live verification against the actual `next build && next start` production server via
  `POST /api/scan`: confirmed the real-AST path fires on a non-standard index parameter name
  (`position`) that the regex path misses, and correctly does *not* fire on an unrelated local
  variable named `index` that the regex path *does* incorrectly flag.

## 7. Performance impact

`ts.createSourceFile` for a single small-to-medium file is fast (single-digit milliseconds);
`TypeCheckerService` already pays a larger one-time cost per scan (full `ts.createProgram` +
lib `.d.ts` loading, cached via `libFileCache`/`lastProgram` across calls in the same process) for
type-checking, so this migration adds a second, cheaper `createSourceFile` call on top of
infrastructure already present and already paying that cost. Not separately benchmarked in
isolation this pass; the existing test suite's total wall-clock time (~40s for 300 tests) shows no
qualitative regression.

## 8. Remaining limitations

- Only 1 of 25 rules is real-AST-backed; 22 are still regex/string; 2 are brace-depth heuristics.
- Real-AST coverage exists only for `REACT_JSX`/`NEXT_JS` frameworks.
- `QUERY_TEMPLATES`/`FRAMEWORK_TRANSLATIONS` (the "Universal AST Query Selector" strings) remain
  unexecuted decorative documentation — not removed in this pass, but now accurately documented as
  such; a future cleanup should either wire them to something real or stop presenting them as if
  they were.
- Stages B/C/D need new, justified compiler dependencies not added in this pass.
- The regex-based rules' documented gaps (§2 table) remain real limitations of the shipped tool,
  not just historical artifacts — e.g. FIGM-A11Y-02/A11Y-04/REACT-04's narrow component-name
  allow-lists are live gaps today.

## 9. Required dissertation wording changes

Replace, throughout Chapter 3 (§3.x methodology) and Chapter 4 (§4.2 "Resilient Source Code Parser
Adapter"):

| Current wording | Accurate replacement |
|---|---|
| "resilient AST node generation" / "AST Node Tree" (describing `SourceParser`) | "a resilient line/regex-based pattern scanner that produces a synthetic AST-shaped intermediate representation" |
| "Evaluate 25 AST Rule Predicates" | "Evaluate 25 guideline predicates against the synthetic intermediate representation (1 of the 25 — FIGM-REACT-02, for React/Next.js — is evaluated against a genuine TypeScript-compiler-derived AST; the remaining 24 are pattern-based)" |
| Any blanket "FIGM is an AST-based static analysis tool" claim | **"AST-informed pattern-based static analysis, with a genuine AST-based analysis path for TypeScript compiler diagnostics and (as of this migration) one guideline rule on React/Next.js files"** — this is the accurate description the audit brief asked for, and it is what the implementation actually does. |
| "Universal AST Query Selector Engine" (if referenced as functioning infrastructure) | Should be described as a documentation/traceability schema, or removed if not planned for real implementation — it is not executed. |

This wording is chosen deliberately to be defensible under examiner questioning: every clause
above is directly traceable to a specific file and line cited in this document.
