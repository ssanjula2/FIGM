# FIGM AST Migration Map (Phase 1)

**Status:** Written *before* any behavior-changing code in this migration. Every claim below was verified by reading the current source directly (`src/parser/source-parser.ts`, `src/ast/ast-detection-engine.ts`, `src/ast/universal-ast-mapper.ts`, `src/parser/alp-extractor.ts`, `src/analysis/react-ast-rules.ts`, `src/engine/rule-execution-engine.ts`, `src/analysis/complexity/complexity-engine.ts`), not inherited from prior audit prose.

## 1. What the current architecture actually is

```
Source ──▶ SourceParser.detectFramework()  (regex/extension heuristics)
        ──▶ SourceParser.buildASTFromCode() (line-by-line regex/substring loop,
             produces a SYNTHETIC ASTNode[] tree: real `type`/`loc`/`attributes`
             shape, but every node is manufactured from a text match, not parsed)
        ──▶ UniversalASTMapper.normalizeNode()  (pass-through: copies fields,
             does not translate between framework grammars)
        ──▶ ASTDetectionEngine.evaluateNode()   (25 real predicate functions —
             this layer IS a legitimate rule-visitor layer; it just reads a
             synthetic input)
        ──▶ ALPExtractionEngine / RemediationEngine (same synthetic-node input)
```

**Key finding that shapes this whole migration:** `ASTDetectionEngine`, `ALPExtractionEngine`, and `RemediationEngine` do **not** care how a node was produced — they only read `node.type`, `node.name`, `node.attributes[...]`, and `node.loc`. This means the migration's real surface area is `SourceParser.buildASTFromCode()` (the node-*producer*), not the three consumer layers. Replacing *how* a node's attributes get populated (real parse vs. regex) while keeping the same attribute-key contract lets every downstream rule ID, severity, evidence format, and remediation template keep working unchanged — which is exactly the "preserve rule IDs and research semantics" requirement. Confirmed by reading `ASTDetectionEngine.evalPerf01`–`evalAng05` (`src/ast/ast-detection-engine.ts:119-261`) and `ALPExtractionEngine.matchesALP` (`src/parser/alp-extractor.ts:58-81`): every one of them is a pure function of `node.type`/`node.name`/`node.attributes`.

`FIGM-REACT-02` already proves this pattern works: `src/analysis/react-ast-rules.ts` produces real `DiagnosticReport`s directly from a genuine `ts.SourceFile`, bypassing `SourceParser` entirely for that one rule, and `RuleExecutionEngine.analyzeFile` (`src/engine/rule-execution-engine.ts:87-93`) swaps it in per-framework. This migration generalizes that exact pattern to 14 more rules, and (Phase 5) folds it into a shared parser abstraction instead of leaving it as a bespoke one-off module.

## 2. Rule-by-rule syntax classification

| Rule | Syntax it actually needs | Minimum parser | Real-AST feasible without new deps? |
|---|---|---|---|
| FIGM-PERF-01 | ObjectExpression/ArrayExpression/ArrowFunctionExpression inside a loop or component-render body | TS compiler (JS/TS/JSX/TSX) | **Yes** |
| FIGM-PERF-02 | JSX element attributes (`<img>`/`video`/`iframe`/`embed`) | TS compiler (JSX/TSX) | **Yes** |
| FIGM-PERF-03 | CallExpression pairing (`addEventListener`/`removeEventListener` by event-type string, file-wide) | TS compiler | Yes, but not in this batch (see §4) |
| FIGM-PERF-04 | Import binding + all its identifier references' ancestor chain | TS compiler | **Yes** |
| FIGM-PERF-05 | ArrowFunctionExpression literal inside a loop/render JSX attribute or `.map()` callback | TS compiler | Yes, but not in this batch |
| FIGM-PERF-06 | CallExpression (`localStorage`/`sessionStorage`) inside loop/render | TS compiler | Yes, but not in this batch |
| FIGM-A11Y-01 | JSX opening element attribute list (React only — Vue `@click`/Angular `(click)` are not valid TS/JSX syntax) | TS compiler for React/Next; **template markup for Vue/Angular is not parseable by the TS compiler at all** | **Yes for REACT_JSX/NEXT_JS**; Vue/Angular stay legacy |
| FIGM-A11Y-02 | JSX element tag name + attribute list | TS compiler | **Yes for REACT_JSX/NEXT_JS** |
| FIGM-A11Y-03 | JSX element `className`/`class`/`id` attribute string value + `aria-live`/`role` attributes | TS compiler | **Yes for REACT_JSX/NEXT_JS** |
| FIGM-A11Y-04 | JSX element tag name + attribute presence | TS compiler | **Yes for REACT_JSX/NEXT_JS** |
| FIGM-A11Y-05 | JSX element tag name + attribute presence, plus a file-wide `htmlFor`/`for` search | TS compiler | Yes, but not in this batch |
| FIGM-A11Y-06 | JSX attribute numeric literal value | TS compiler | Yes, but not in this batch |
| FIGM-NEXT-01 | Directive prologue (`"use client"`) + CallExpression (`useState`/`useEffect`/...) | TS compiler | **Yes** |
| FIGM-NEXT-02 | ImportDeclaration module specifier + file-wide `dynamic(` search | TS compiler | **Yes** |
| FIGM-NEXT-03 | `export const revalidate` VariableStatement + file-path role check | TS compiler (path check stays outside the parser, it's not syntax) | **Yes** |
| FIGM-NEXT-04 | JSX `<link>` element attributes | TS compiler | **Yes** |
| FIGM-REACT-01 | CallExpression (`.sort`/`.filter`/`.reduce`) + same-scope `useMemo` check | TS compiler | Yes, but not in this batch |
| **FIGM-REACT-02** | JsxAttribute `key` initializer + enclosing `.map()` callback's index parameter binding | TS compiler | **Already real AST** (`src/analysis/react-ast-rules.ts`) — Phase 5 refactors its *home*, not its logic |
| FIGM-REACT-03 | ExpressionStatement (mutation-method call or property assignment) on a variable that is a component's local state | TS compiler (true state-binding analysis is out of scope — see §5) | **Yes, same over-approximation as today** |
| FIGM-REACT-04 | JSX element tag name (`<Custom*>`/`<Button>`/`<Card>`) + `onClick` attribute whose initializer is an inline arrow | TS compiler | Yes, but not in this batch |
| FIGM-ANG-01 | CallExpression `.subscribe(` inside an Angular component class + file-wide `takeUntilDestroyed`/`unsubscribe`/`DestroyRef` search | TS compiler (class body is real TS) | **Yes** |
| FIGM-ANG-02 | `@Component({...})` decorator's object-literal argument, checked for a `ChangeDetectionStrategy.OnPush` property value | TS compiler (decorators are real TS syntax) | **Yes** |
| FIGM-ANG-03 | `*ngFor="..."` directive inside **Angular template markup** (a string, not TS) | Angular template parser (`@angular/compiler`) — **new dependency**, out of scope this pass | No — stays legacy |
| FIGM-ANG-04 | `{{ ... }}`/`[prop]="..."` interpolation inside **Angular template markup** | Angular template parser — **new dependency** | No — stays legacy |
| FIGM-ANG-05 | `.nativeElement` PropertyAccessExpression inside an Angular component class + nearby `renderer`/`Renderer2` usage | TS compiler (class body is real TS) | **Yes** |

**Framework note that applies to every "Yes" row above:** "real AST" only applies when the *file itself* is valid TypeScript/JSX source. That is true for `REACT_JSX`, `NEXT_JS`, `GENERIC_ESTREE`, and the **class-body portion** of `ANGULAR_TEMPLATE` files (`.component.ts`). It is **not** true for `VUE_SFC` (`.vue` files start with `<template>`, which is not TypeScript at all — `ts.createSourceFile` on a raw `.vue` file produces garbage, not a usable tree) or for Angular's **inline template string content** (a `template: \`...\`` property is, to the TS parser, just a `StringLiteral`/`TemplateExpression` — it does not understand `*ngFor` or `{{ }}` inside it). Vue and the two Angular-template rules are explicitly **not** migrated in this pass; see §4 and §7.

## 3. Common Intermediate Representation — decision

**Decision: reuse the existing `ASTNode` shape (`src/types/ast-spec.ts`) as the IR, rather than inventing a new one.** Rationale:

- It already satisfies Phase 3's requirements: `type` (node kind), `loc` (source range), `attributes` (properties/expressions/event-handlers/imports/calls — whatever a rule needs, keyed by name), `children` (parent/child relationship, currently kept intentionally flat — see below), `scopeType` (the loop/render/function bucket every performance rule keys on).
- `ASTDetectionEngine`, `ALPExtractionEngine`, and `RemediationEngine` already consume exactly this shape. Introducing a second, "more real" IR type would force rewriting three consumer layers for zero behavioral benefit, and would be exactly the kind of unnecessary abstraction Phase 3 warns against ("do not create fake AST nodes merely to make unrelated frameworks look identical" — the risk cuts both ways: replacing a working, narrow, honest IR with a new "unified" one *for its own sake* is the same mistake in a different direction).
- What changes is **only** the population strategy: every attribute that used to come from `cTrimmed.includes(...)`/regex will now come from a real `ts.Node` inspection (e.g., `attributes.isInvariant` is set because the node genuinely *is* a `ts.ObjectLiteralExpression`/`ts.ArrayLiteralExpression` whose nearest containing statement is a real loop or the component's real JSX-returning function body — not because a line matched `/\b(const|let|var)\s+\w+\s*=\s*\{/`).
- One field is added to the IR for honesty (Phase 8/11): `sourceKind?: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC'`, set per node, threaded into `DiagnosticReport.evidence` so a finding's evidence string never claims "AST" for a text-heuristic result and vice versa.
- **Tree shape stays intentionally flat** (one level: `root.children`), matching current behavior. `ASTDetectionEngine.evaluateNode` recurses into `node.children` already, so a deeper real tree is not *required* for correctness — every rule's predicate is evaluated per-node independent of its position in a hierarchy. Building genuine deep nesting would be a larger, riskier change for no behavioral gain in this pass, so it is deferred; each migrated node's `loc`/`attributes` are still 100% derived from real AST position/shape, which is the part that actually matters for correctness and evidence quality.

## 4. Parser abstraction (Phase 2)

```ts
// src/parser/framework-parser.ts
export interface ParserDiagnostic { severity: 'error' | 'warning'; message: string; line: number; column: number; }
export interface SourceRange { start: { line: number; column: number }; end: { line: number; column: number }; }

export interface FrameworkParser<TNode = unknown> {
  readonly kind: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC';
  parse(code: string, filePath: string): void;
  getRoot(): TNode | null;
  getDiagnostics(): ParserDiagnostic[];
  getSourceRange(node: TNode): SourceRange;
  visit(callback: (node: TNode, range: SourceRange) => void): void;
}
```

`TypeScriptFrameworkParser implements FrameworkParser<ts.Node>` wraps `ts.createSourceFile` (already the only real parser dependency in this project — `typescript` is already in `package.json`, so **no new dependency is introduced** for the JS/TS/JSX/TSX-eligible rule set). Contract:

- **Never crashes the API.** `ts.createSourceFile` is itself error-tolerant by design (TypeScript's parser always returns a best-effort tree; syntax errors become nodes flagged in the tree, not thrown exceptions) — this project's existing `src/analysis/react-ast-rules.ts:143-147` already relies on that guarantee and additionally wraps traversal in `try/catch`. The new `TypeScriptFrameworkParser.parse()` keeps the same double guarantee.
- **Structured diagnostics, not thrown errors.** `getDiagnostics()` surfaces `ts.SourceFile.parseDiagnostics`-derived structured objects (line/column/message), matching the existing `ParseResult.parseErrors` shape `SourceParser` already returns, so `RuleExecutionEngine`'s existing `SYNTAX-PARSE-ERROR` diagnostic-injection path (`src/engine/rule-execution-engine.ts:44-71`) needs no changes.
- **Partial results preserved only when safe.** If parsing fails entirely (should not happen given TS's tolerance, but guarded regardless), `getRoot()` returns `null` and callers fall back to the legacy path for that file — never a half-built tree passed downstream as if it were complete.
- **Testable.** `getRoot()`/`getDiagnostics()`/`visit()` are pure, synchronous, and side-effect-free, so unit tests can construct a parser instance directly without going through the full scan pipeline.

## 5. What is explicitly retained as `LEGACY_TEXT_HEURISTIC` in this pass, and why

Per Phase 8's explicit permission ("If some syntax cannot yet be migrated safely: retain legacy detection temporarily, label it internally"), the following are **not** migrated now, and every node/diagnostic they produce carries `sourceKind: 'LEGACY_TEXT_HEURISTIC'`:

1. **All 25 rules, for `VUE_SFC` files.** A `.vue` SFC is not TypeScript; a real migration needs `@vue/compiler-sfc` (explicitly pre-approved by the brief for "where required," but genuinely a **new** dependency this pass deliberately does not add, to keep this migration's blast radius reviewable). Tracked as a distinct follow-up (the brief's own Phase 6).
2. **FIGM-ANG-03, FIGM-ANG-04** for all frameworks. These need to understand Angular *template* grammar (`*ngFor`, `{{ }}`), which lives either in a separate `.html` file or inside a TS string literal the TS parser treats as opaque text. A real fix needs `@angular/compiler` (the brief's own Phase 7) — also a new dependency, deliberately deferred.
3. **FIGM-PERF-03, FIGM-PERF-05, FIGM-PERF-06, FIGM-A11Y-05, FIGM-A11Y-06, FIGM-REACT-01, FIGM-REACT-04** for all frameworks. All are classified "Yes, feasible" in §2 (no new dependency needed) but are **not** in this migration's controlled group — deferred to a follow-up batch per Phase 4's explicit "do not migrate all 25 in one diff" instruction. They keep their exact current regex/substring behavior unchanged, byte-for-byte, in this pass.
4. **FIGM-REACT-03**'s true state-binding analysis. The rule is migrated to real AST *for locating and classifying the mutation shape* (real `ts.CallExpression`/`ts.BinaryExpression` inspection replaces the current line regex), but — matching the existing, explicitly-documented `KNOWN LIMITATION` in `tests/qa-matrix-boundary-adversarial.test.ts:343` — it still cannot distinguish "this array is React state" from "this array is a plain local variable" without real data-flow/binding analysis, which is out of scope here. This is a real-AST rule with the *same* documented over-approximation as before, not a data-flow rewrite.

## 6. Controlled migration groups (Phase 4)

Implemented as separate, independently-testable groups (separate commits within this change), in this order:

1. **Group 1 (priority list, items 1–8):** FIGM-REACT-03, FIGM-A11Y-01, FIGM-A11Y-02, FIGM-A11Y-03, FIGM-A11Y-04, FIGM-PERF-01, FIGM-PERF-02, FIGM-PERF-04.
2. **Group 2:** FIGM-ANG-01, FIGM-ANG-02, FIGM-ANG-05 (real AST, class-body only). FIGM-ANG-03/04 explicitly left legacy per §5.
3. **Group 3:** FIGM-NEXT-01, FIGM-NEXT-02, FIGM-NEXT-03, FIGM-NEXT-04.
4. **Phase 5 (not a new detector, a refactor):** FIGM-REACT-02 moves from its bespoke `react-ast-rules.ts` module onto the shared `FrameworkParser` abstraction built in Group 1, with byte-identical detection logic — this is explicitly a relocation, not a rewrite.
5. **Deferred (documented, not implemented this pass):** FIGM-PERF-03/05/06, FIGM-A11Y-05/06, FIGM-REACT-01/04, FIGM-ANG-03/04, all Vue-framework detection. Left exactly as-is (regex, `LEGACY_TEXT_HEURISTIC`), ready to be picked up as Groups 4+ using the same `FrameworkParser` infrastructure this pass builds.

## 7. Regression safety net used to validate every migrated rule

Before any rule is considered migrated, its real-AST output must match (or, where a documented bug is being fixed, must improve on) the existing test oracles already in the repo:

- `tests/rule-detection-matrix.test.ts` — positive + negative fixture per rule (25/25).
- `tests/qa-matrix-boundary-adversarial.test.ts` — documents exact `KNOWN LIMITATION` over-approximations that must be *preserved*, not "fixed," in this pass (e.g., PERF-01 flagging any object literal in loop scope regardless of true invariance; A11Y-03's `className="status` prefix match; A11Y-04's `onClose` proxy check; REACT-03's array-mutation-without-state-binding limitation).
- `tests/adversarial-complete-detection.test.ts` — comment/string false-positive traps.
- `benchmarks/ground-truth.json` + `benchmarks/testbed/*` — the live, reproducible 19-item benchmark; re-running `npm run eval` after migration must not silently change TP/FP/FN counts in a way that isn't understood and explained.

## 8. Known, honestly-scoped false-positive/false-negative changes this migration intentionally makes

- **Fixed (real bug, not a behavior change to "hide"):** every rule migrated to real AST stops being fooled by a trigger substring appearing inside a JSX text child, a template-literal expression, or a multi-line-formatted tag — cases the existing `stripCommentsAndStrings`/`scanJsxOpenTagAttrs` line-based machinery already tries to patch around with hand-maintained exceptions, but which real AST gets right structurally, by construction, for the migrated rules.
- **Not changed (deliberately preserved over-approximations):** PERF-01's "any object literal in loop/render scope," A11Y-02's narrow `<Custom>/<Select>/<Dropdown>` allow-list (even though `ASTDetectionEngine.evalA11y02`'s predicate would technically also match any other capitalized component name — the *producer* is deliberately kept narrow to match existing tests/ground truth; broadening it is a separate, not-yet-approved scope change, called out here rather than done silently), A11Y-03's `className="status` prefix match, A11Y-04's `onClose`-as-proxy check, REACT-03's lack of true state-binding analysis.

## 9. Deliberately out of scope for this migration pass

- Adding `@vue/compiler-sfc` or `@angular/compiler` as dependencies.
- Rewriting `ComplexityEngine`/`DynamicProfiler` to consume the real `ts.SourceFile` directly (they currently consume the flat `ASTNode` list and work correctly with it; migrated rules continue to emit the same `IfStatement`/`ForStatement`/`WhileStatement`/`SwitchCase`/`CatchClause` marker nodes `ComplexityEngine` scans for, now derived from real `ts.SyntaxKind` checks instead of a `\bif\s*\(/` regex, but the consumer contract is unchanged).
- Broadening any rule's detection scope beyond what it already covers today (see §8) — this migration changes *how* violations are found, not *which* violations are in scope, except where a change is a demonstrable bug fix already covered by an existing regression test.
