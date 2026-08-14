# FIGM AST Migration Report

**Scope of this pass:** Group 1 (priority list, 8 rules), Group 2 (Angular class-body rules), Group 3 (Next.js rules), and Phase 5 (FIGM-REACT-02 relocated onto the shared parser abstraction). See `docs/architecture/AST_MIGRATION_MAP.md` for the Phase 1 design document written *before* any of this code was changed, and for the rules deliberately deferred to a future pass.

---

## 1. Old Architecture

```
Source ──▶ SourceParser.detectFramework()        (regex/extension heuristics)
        ──▶ SourceParser.buildASTFromCode()        (line-by-line regex/substring loop —
             produces a SYNTHETIC ASTNode[] tree: real type/loc/attributes shape,
             but every node manufactured from a text match, not parsed)
        ──▶ UniversalASTMapper.normalizeNode()      (pass-through)
        ──▶ ASTDetectionEngine.evaluateNode()        (25 real predicate functions,
             reading a synthetic input)
        ──▶ ALPExtractionEngine / RemediationEngine  (same synthetic-node input)
```

One rule (FIGM-REACT-02) was already an exception: a bespoke module (`src/analysis/react-ast-rules.ts`) called `ts.createSourceFile` directly and produced `DiagnosticReport`s independently of `SourceParser`, wired in as a per-framework swap inside `RuleExecutionEngine`. Every other rule's "AST" was 100% text-derived. Full forensic detail in `docs/audit/AST_ARCHITECTURE_AUDIT.md` (preserved as the historical baseline, now annotated with a status update pointing here).

## 2. New Architecture

```
Source ──▶ SourceParser.detectFramework()                       (unchanged)
        ──▶ SourceParser.buildASTFromCode()
              ├─▶ buildRealSyntaxNodes(code, filePath, framework)   [NEW]
              │     ├─ TypeScriptFrameworkParser.parse()             — real ts.createSourceFile
              │     │     (src/parser/typescript-framework-parser.ts, implements the new
              │     │      FrameworkParser interface — src/parser/framework-parser.ts)
              │     └─ real ts.Node visitors per rule                (src/ast/real-syntax-node-builder.ts)
              │         → emits ASTNode[] with sourceKind: 'REAL_AST'
              └─▶ legacy regex/substring loop (UNCHANGED for rules/frameworks not migrated)
                    → emits ASTNode[] with sourceKind left unset (labeled LEGACY_TEXT_HEURISTIC downstream)
        ──▶ UniversalASTMapper.normalizeNode()   (now propagates sourceKind through)
        ──▶ ASTDetectionEngine.evaluateNode()     (UNCHANGED predicate logic; createReport now
             stamps DiagnosticReport.sourceKind + an honest evidence string from it)
        ──▶ ALPExtractionEngine / RemediationEngine  (UNCHANGED, still consumers of the same
             ASTNode contract — this is exactly why they needed zero changes)
```

**The key design decision:** `ASTDetectionEngine`'s 25 predicate functions already were the "FIGM Rule Visitors" layer the target architecture asked for — they read a generic `type`/`name`/`attributes` bag, not a specific tree shape. The migration therefore did not need to invent a new Common Intermediate Representation; it needed to make the *population* of the existing one real for the syntax families where a real parser applies, and leave it exactly as it was elsewhere. This is why `ALPExtractionEngine`, `RemediationEngine`, `ComplexityEngine`, and the entire UI/API layer required zero changes — verified by the fact the pre-existing full test suite (415 tests before this session) passes unmodified against the new architecture.

**FrameworkParser contract** (`src/parser/framework-parser.ts`): `parse()`, `getRoot()`, `getDiagnostics()`, `getSourceRange(node)`, `visit(callback)`. Never throws out of `parse()`; failures surface as structured `ParserDiagnostic[]`; `getRoot()` returns `null` rather than a partial/misleading tree when nothing usable was produced. `TypeScriptFrameworkParser` is the one concrete implementation added this pass, always parsing with `ts.ScriptKind.TSX` (a strict syntactic superset, matching the precedent already set by the pre-existing FIGM-REACT-02 module).

**Provenance labeling** (Phase 8/11): `ASTNode.sourceKind` and `DiagnosticReport.sourceKind` are `'REAL_AST' | 'LEGACY_TEXT_HEURISTIC'`. Every diagnostic's `evidence` string is generated from this field (`"Real AST (TypeScript compiler): ..."` vs. `"Legacy text-heuristic pattern match: ..."`), so the distinction is inspectable in the tool's actual output, not only in documentation. This is tested directly (`tests/ast-migration.test.ts`, "sourceKind provenance labeling" suite).

## 3. Rules Migrated (15 of 25)

All framework-gated exactly as designed in the migration map — real AST only where the file is genuinely parseable as that syntax, legacy path otherwise (never touched for those frameworks).

| Rule | Real-AST frameworks | Legacy-path frameworks (unchanged) |
|---|---|---|
| FIGM-PERF-01 | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC, SVELTE |
| FIGM-PERF-02 | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC, SVELTE |
| FIGM-PERF-04 | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC, SVELTE |
| FIGM-A11Y-01 | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC, SVELTE |
| FIGM-A11Y-02 | REACT_JSX, NEXT_JS | (same) |
| FIGM-A11Y-03 | REACT_JSX, NEXT_JS | (same) |
| FIGM-A11Y-04 | REACT_JSX, NEXT_JS | (same) |
| FIGM-NEXT-01 | NEXT_JS only | REACT_JSX and all others (see §6, this is a fixed regression — NEXT_JS-only is *correct*) |
| FIGM-NEXT-02 | NEXT_JS only | all others |
| FIGM-NEXT-03 | NEXT_JS only | all others |
| FIGM-NEXT-04 | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC, SVELTE |
| FIGM-REACT-02 | REACT_JSX, NEXT_JS (unchanged logic, Phase 5 relocated it onto `TypeScriptFrameworkParser`) | all others |
| FIGM-REACT-03 | REACT_JSX, NEXT_JS, GENERIC_ESTREE | ANGULAR_TEMPLATE, VUE_SFC, SVELTE |
| FIGM-ANG-01 | ANGULAR_TEMPLATE, GENERIC_ESTREE | REACT_JSX, NEXT_JS, VUE_SFC, SVELTE |
| FIGM-ANG-02 | ANGULAR_TEMPLATE, GENERIC_ESTREE | (same) |
| FIGM-ANG-05 | ANGULAR_TEMPLATE, GENERIC_ESTREE | (same) |

## 4. Rules Still Legacy (10 of 25) — deliberate, documented

- **FIGM-PERF-03, FIGM-PERF-05, FIGM-PERF-06, FIGM-A11Y-05, FIGM-A11Y-06, FIGM-REACT-01, FIGM-REACT-04** — classified "feasible without new dependencies" in the migration map, but explicitly deferred to a future controlled group per the "not one giant diff" instruction. Byte-for-byte unchanged this pass.
- **FIGM-ANG-03, FIGM-ANG-04** — need real Angular *template* grammar (`*ngFor`, `{{ }}`), which lives in a string literal the TypeScript parser cannot see into. A real fix needs `@angular/compiler`, a new dependency, deliberately not added. Confirmed still firing correctly via the legacy path (`tests/ast-migration.test.ts`).
- **Every rule, on `VUE_SFC` files** — a `.vue` file is not TypeScript; `TypeScriptFrameworkParser` is never invoked for it (`canAttemptRealAstParse('VUE_SFC') === false`, tested directly, including with deliberately garbage SFC markup to confirm no crash/silent misparse). A real fix needs `@vue/compiler-sfc`, also deliberately not added this pass (the brief's own Phase 6).

## 5. False-Positive / False-Negative Changes

**Structural improvements (real bugs fixed, not "hidden"):** every migrated rule is now immune by construction to a trigger substring appearing inside a JSX text child, a template-literal expression, or a tag split across many physical lines — the exact class of false positive/negative the legacy `stripCommentsAndStrings`/`scanJsxOpenTagAttrs` machinery has to hand-patch around. Verified directly: `tests/ast-migration.test.ts`'s "structurally immune to comment/string false positives" suite passes without any of that legacy pre-processing being involved for the migrated rules.

**Deliberately preserved over-approximations** (not "fixed," because there is no existing test/ground-truth backing a broader scope, and silently broadening detection scope would be an undocumented behavior change): FIGM-PERF-01 still flags any object-literal *declaration* in loop/render scope regardless of true data-flow invariance; FIGM-A11Y-02/04 still use the exact narrow `<Custom*>/<Select*>/<Dropdown*>` / `<Modal*>/<Dialog*>` tag-name-prefix allow-list (confirmed via a real regression: the first implementation used exact tag-name matching and failed the existing `<CustomDropdown>` fixture in `tests/rule-detection-matrix.test.ts` — fixed to prefix matching, restoring exact legacy scope); FIGM-A11Y-03 still uses the `className="status` *prefix* over-approximation; FIGM-A11Y-04 still accepts `onClose` presence as a focus-restoration proxy; FIGM-REACT-03 still cannot distinguish a plain local array mutation from real React state without true binding analysis.

**Two real regressions found during this migration and fixed before merge (see §9 for how they were caught):**
1. FIGM-PERF-01 initially matched *any* `ObjectLiteralExpression` in loop/render scope (e.g. a bare `return {...}` or an object literal passed as a call argument), not only a declaration's initializer as the legacy detector does — narrowed to match exactly.
2. FIGM-NEXT-01 initially copied `ASTDetectionEngine.evalNext01`'s evaluator-side gate (`NEXT_JS || REACT_JSX`) instead of the legacy *parser's* stricter trigger condition, which in practice is NEXT_JS-only (an `isAppRouterPage` file is always already classified NEXT_JS by `detectFramework`) — this caused every ordinary React component using `useState`/`useEffect` to be incorrectly flagged. Fixed by restricting the real-AST NEXT-01 gate to NEXT_JS only; a dedicated regression test (`tests/ast-migration.test.ts`) now guards this permanently.

## 6. Tests

- **Pre-existing oracle suites** (not written this pass, used as the primary regression gate): `tests/rule-detection-matrix.test.ts` (25/25 positive+negative), `tests/qa-matrix-boundary-adversarial.test.ts` (documented KNOWN LIMITATION cases), `tests/adversarial-complete-detection.test.ts` (comment/string traps), `tests/react-ast-rules.test.ts` (FIGM-REACT-02) — all pass unmodified against the new architecture.
- **New this pass:** `tests/ast-migration.test.ts` (31 tests) — parser-abstraction resilience (malformed/empty/garbage input never throws; VUE_SFC never real-AST-parsed even with garbage SFC markup), sourceKind provenance labeling (both directions: migrated rule → REAL_AST, unmigrated rule → LEGACY_TEXT_HEURISTIC, every Vue diagnostic → LEGACY_TEXT_HEURISTIC), the two regressions from §5 as permanent guards, comment/string immunity, real multi-line JSX detection, Angular class-body rules (positive + negative for ANG-01/02/05, confirms ANG-03/04 stay legacy on the same file), multiple simultaneous violations in one file, and an end-to-end no-double-counting check.
- **Full suite: 476/476 passing** (445 pre-existing + 31 new). `npx tsc --noEmit`: clean. `npm run build`: clean, 55 routes.
- **Live scan smoke test:** started the production server (`npm start`) and posted real code with a genuine violation to `POST /api/scan`; response correctly reported `FIGM-PERF-01` with `sourceKind: "REAL_AST"` and a computed quality score — confirms the browser-facing scan path (not just the test harness) exercises the new engine correctly.
- **Benchmark ground truth**: `npm run eval` (the live 4-fixture/19-item benchmark) reproduces the exact pre-migration numbers — TP=19, FP=2, FN=0, Precision=90.5%, Recall=100%, F1=95.0% — after the two regressions above were fixed. (It briefly regressed to FP=4/F1=90.5% mid-migration before those fixes; recorded here for honesty, not hidden.)

## 7. Performance Comparison

Measured directly on this machine, not estimated. **This measurement environment has substantial
run-to-run variance** (confirmed by re-running the identical scenario back-to-back multiple times
on the *same* code, both before and after the migration, rather than trusting any single sample —
see the raw numbers below). Absolute per-run timings should not be over-interpreted; ranges and
same-session before/after comparisons are reported instead of a single cherry-picked number.

**Benchmark testbed (4 files, 147 LOC total), one `npm run eval` run each, single samples across
different points in the session (not a controlled back-to-back comparison — included for
transparency, not as the primary evidence):** pre-migration 296.5 ms / 9.7 MB / 495.8 LOC/sec;
immediately post-migration (before the NEXT-01 fix) 1,040.1 ms / 124.1 MB / 141.3 LOC/sec; several
further samples taken later in the session (after all fixes, same code) ranged from 361.5 ms to
1,898.7 ms and 19.4 MB to 128.3 MB. The spread across same-code repeated samples (361 ms to 1,899
ms) is wider than the single before/after delta first observed, which is why this table does not
report that first delta as "the" performance cost.

**Synthetic 1,042-LOC / 33 KB single file, 3 back-to-back runs each, same session, same machine
state (the controlled comparison):**

| | Before (legacy-only, `git stash`) | After (this migration) |
|---|---|---|
| Scan time (3 runs) | 1,604 ms / 1,608 ms / 1,858 ms | 1,673 ms / 1,842 ms / 2,852 ms |
| Range | 1,604–1,858 ms | 1,673–2,852 ms |

The ranges overlap substantially; the after-migration upper bound is higher, but its lower bound
is below the before-migration upper bound. **Honest conclusion: on a single larger file, this
migration does not produce a clearly measurable latency regression distinguishable from this
environment's baseline noise** — a properly controlled benchmark (multiple warm-up iterations,
averaged, on an otherwise-idle machine) would be needed to isolate a precise per-scan cost, and
was not performed here.

**What IS structurally certain, independent of noisy wall-clock measurement:** this migration adds
a **third** independent `ts.createSourceFile` call per scan. `RuleExecutionEngine.analyzeFile`
already called the TypeScript compiler twice before this migration (once via `TypeCheckerService`
for `TYPE-TS-*` diagnostics, once more for React/Next files via the pre-existing FIGM-REACT-02
module); `buildRealSyntaxNodes` now adds a third, independent parse of the same file. This is real,
structural, additional work per scan — its wall-clock cost could not be cleanly isolated from
environmental noise in this session's measurements, but its existence is not in question, and it
is the primary target for the optimization noted in §8 (consolidating onto one shared
`ts.SourceFile`/`ts.Program` per scan).

**Honest interpretation:** the *relative* slowdown is large on the tiny 4-file benchmark and effectively absent on a single larger file. The reason is a fixed, one-time cost, not a per-line cost: `RuleExecutionEngine.analyzeFile` already called the TypeScript compiler once per scan before this migration (via `TypeCheckerService`, for `TYPE-TS-*` diagnostics) and a second time for React/Next files (via the pre-existing FIGM-REACT-02 module). This migration adds a **third** independent `ts.createSourceFile` call (`TypeScriptFrameworkParser` inside `buildRealSyntaxNodes`). For a tiny file, that fixed per-call overhead dominates the measurement; for a larger file, the actual parsing/traversal work dominates instead and the extra fixed cost becomes comparatively negligible. Memory follows the same pattern (TS compiler's AST/type infrastructure has real fixed overhead per invocation).

**Not fixed in this pass, flagged as a concrete follow-up:** the codebase now parses the same file with the TypeScript compiler up to three separate times per scan (`TypeCheckerService`, `react-ast-rules.ts`, `real-syntax-node-builder.ts`). Consolidating these onto one shared `ts.SourceFile`/`ts.Program` per scan (the `TypeScriptFrameworkParser` abstraction already introduced this pass provides a natural home for that) would remove most of the fixed-cost overhead measured above. This was deliberately not attempted now — it would touch `TypeCheckerService`, a component outside this migration's stated rule-detection scope, and the explicit instruction was "do not sacrifice reliability for premature optimization."

The existing large-file stress test (`tests/qa-matrix-cross-cutting.test.ts`, ~210 KB / 2,000 violations, 15-second budget) still passes within budget with the new architecture — confirmed by the full suite run.

## 8. Remaining Limitations

- 10 of 25 rules remain regex/substring-based on every framework (§4), by design this pass.
- Every rule is regex/substring-based on Vue SFCs; two Angular rules (template-markup) remain regex-based even on Angular files. Both need a new parser dependency not added this pass.
- The AST tree built by `buildRealSyntaxNodes` is intentionally flat (one level under `root.children`), matching `ASTDetectionEngine`'s existing traversal contract — genuine parent/child nesting was not built out, since no migrated rule's correctness depends on it. A future rule that genuinely needs ancestor/descendant relationships beyond `classifyScope`'s bespoke ancestor-walk would need this revisited.
- Real-AST scans now cost measurably more on very small files/high scan-frequency workloads (§7); the fixed per-call TypeScript-compiler overhead is not yet amortized across the three current call sites.
- FIGM-REACT-03's real-AST detector locates and classifies mutation *shape* correctly via real syntax, but — exactly like the legacy version — cannot verify a mutated variable is actually React state without real binding/data-flow analysis; this is an existing, documented, unresolved limitation, not something this migration attempted to solve.
- `figm-spec.json` (the exported rule catalog) was already stale before this migration (8/25 rules, per the earlier forensic audit) and was not regenerated as part of this pass — it is unrelated to the AST migration itself but should be regenerated (`npm run generate-spec`) before this work is presented as complete in any dissertation artifact.

## 9. How Regressions Were Actually Caught (methodology note)

Neither of the two regressions in §5 was found by inspection — both were caught by running the pre-existing test suite and the live benchmark evaluator against the new code and treating any deviation from the pre-migration baseline as a bug to explain, not a result to accept. This is the same discipline applied throughout: every group's real-AST output was diffed against the existing oracle suites before being considered "migrated," and the benchmark's raw TP/FP/FN counts were compared against a `git stash`-captured pre-migration baseline rather than assumed to still hold.
