# FIGM Code Inspector — Initial Repository Forensic Audit (Phase 0)

Date: 2026-08-12
Method: Zero-trust — every claim below is backed by direct source inspection, not by any pre-existing `docs/*.md` or `FINAL_*.md` file in this repository. Those existing documents (~30 files at repo root: `FINAL_ZERO_TRUST_*`, `FINAL_ULTIMATE_*`, etc.) are treated as **unverified prior claims**, not evidence.

This document is the Phase 0 baseline. It records architecture as it actually is, and flags integrity issues to be resolved in later phases. It does not yet reflect fixes applied afterward — see `FINAL_PRODUCTION_FORENSIC_AUDIT.md` for post-fix state.

---

## 1. Stack / Config

- Next.js 14 (App Router) + React 18, TypeScript 5.3, `strict: false` in `tsconfig.json`.
- Declared persistence: Prisma 7 + `pg` targeting Postgres, plus `@supabase/supabase-js`. `vercel.json` runs `npx prisma generate && next build` on deploy and force-sets `STORAGE_PROVIDER=supabase` for every Vercel environment.
- Test runner: Node's built-in `node --test` via `tsx`, invoked as one long list of 23 explicit test files in `package.json`'s `test` script (no glob — a new test file is silently excluded from `npm test` unless manually added to that list).
- No `jest`/`vitest`/`playwright`/`eslint` dependency anywhere in `package.json`.

## 2. Architecture summary (as verified, not as documented)

```
Browser (app/live-scan, app/diagnostics, ...)
   → POST /api/scan  (app/api/scan/route.ts)
       → RuleExecutionEngine.analyzeFile(fileName, code)   [src/engine/rule-execution-engine.ts]
            → SourceParser.parseSource()                    [src/parser/source-parser.ts]   ← "AST" builder
            → DynamicProfiler.profileExecution()             [src/engine/dynamic-profiler.ts]
            → ComplexityEngine.analyzeComplexity()           [src/analysis/complexity/complexity-engine.ts] ← LIVE complexity engine
            → TypeCheckerService.checkCode()                 [src/analysis/type-checker-service.ts] ← isolated per-file TS compile
            → ASTDetectionEngine.evaluateNode()               [src/ast/ast-detection-engine.ts] ← 25 rule predicates
            → ALPExtractionEngine.extractPrimitives()         [src/parser/alp-extractor.ts]
       → (optional) AIRemediationPipeline.remediateDefect()  [src/ai/ai-remediation-pipeline.ts]
       → ScanRepository.createScanRecord()                   [src/engine/scan-repository.ts] → RepositoryFactory → JsonStorageProvider (always, see §5)
```

`src/engine/complexity-analyzer.ts` (`ComplexityAnalyzer`) is a **second, unused** complexity implementation — imported into `rule-execution-engine.ts` for its TypeScript *type* only (`ComplexityMetrics`); `.calculateComplexity()` is never called in the live path. Dead code / duplication.

`src/pipeline/guideline-filtering.ts` (a 3-stage N=18→N=8 guideline-filtering pipeline with elimination reasons) and the richer `standardTraceability` object in `src/matrix/four-layer-meta-model.ts` are **not wired into the live scan path** — only `tests/guideline-filtering.test.ts` and the spec-export script (`generate-spec`) touch them. The live scan path assigns standards via a two-way ternary (`ast-detection-engine.ts:281`): `domain === 'PERFORMANCE' ? 'ISO 25010' : 'WCAG 2.2'`.

## 3. Parser / "AST" pipeline — CRITICAL FINDING

There is **no real parser** (no TypeScript Compiler API, no Babel, no `@vue/compiler-sfc`, no Angular template compiler) anywhere in the live analysis path.

`SourceParser.buildASTFromCode` (`src/parser/source-parser.ts:165-646`) splits source into lines and pushes a flat, single-level `root.children` array of pseudo-AST nodes whenever a line matches a substring/regex check, e.g.:

```ts
// source-parser.ts:206-212
if (trimmed.includes('.map(') || trimmed.includes('.forEach(') || trimmed.includes('for (') || trimmed.includes('while (')) {
  currentScope = 'LOOP';
}
```

All 25 rule predicates in `ASTDetectionEngine` (`src/ast/ast-detection-engine.ts`) check boolean flags (`isInlineCallback`, `isUnlabeledInput`, etc.) that were set by this same line-substring scan — not structural relationships in a real tree. Because matching operates on raw trimmed line text, **comments and string literals can trigger rule violations**, and multi-line JSX/nested constructs are not reliably represented (flat node list, no real nesting).

`ALPExtractionEngine` (`src/parser/alp-extractor.ts`) and `UniversalASTMapper` (`src/ast/universal-ast-mapper.ts`) add further labeling/normalization passes on top of this same flat pseudo-tree; `UniversalASTMapper`'s `QUERY_TEMPLATES` (CSS-selector-like strings) are exported for spec/documentation purposes but are **never evaluated as selectors anywhere in the codebase** — decorative metadata.

**Impact**: this affects every later phase — rule detection, complexity, precision/recall, and guideline mapping are all built on top of a regex/string-match engine, not a genuine syntax tree. See Phase 4/5/6 for concrete false-positive evidence (`FIGM-PERF-04` firing on ordinary top-level imports; `TYPE-TS-2583` false positives from a misconfigured isolated type-checker).

Framework detection (`SourceParser.detectFramework`, `source-parser.ts:102-160`) is likewise string/extension-heuristic based (`.vue` extension, `lowerCode.includes('@component')`, etc.), always returns a concrete guess, and has **no `UNKNOWN` fallback** — falls through to `'GENERIC_ESTREE'` when no heuristic matches, rather than admitting insufficient evidence.

## 4. Complexity engine — real tree-walk, fed fake input

`ComplexityEngine.analyzeComplexity` (`src/analysis/complexity/complexity-engine.ts`) does genuinely implement a structural walk over decision-point node types (`IfStatement`, `ForStatement`, `SwitchCase`, `LogicalExpression` with `&&`/`||`/`??`, etc.) to compute V(G) = 1 + D — the walking logic itself is correct. However, because the upstream "AST" (§3) only ever creates flat `IfStatement`/`ForStatement`/etc. nodes for lines matching simple regexes, and never creates real nested `LogicalExpression`/`ConditionalExpression`/function-body structure, the walker's richer branches are effectively dead paths against real input — in practice this degrades to "1 + count of lines matching if/for/while/case/catch regexes." `ComplexityEngine` also separately estimates nesting depth via brace-counting on raw text (`estimateMaxNestingDepthFromCode`), blended into the same "AST-based" metric.

## 5. Storage / Database — CRITICAL FINDING: `STORAGE_PROVIDER=supabase` does nothing

`RepositoryFactory.getStorageProvider()` picks `SupabaseStorageProvider` when `STORAGE_PROVIDER=supabase` (set in both `.env` and `vercel.json`). But `SupabaseStorageProvider` (`src/storage/supabase-storage-provider.ts`) only uses its real Supabase client inside `isConnected()`; **all 26 other interface methods delegate to an internal `JsonStorageProvider` fallback** (`this.fallback`), which reads/writes `figm-user-db.json` at the repo root via `src/auth/user-db.ts`. There is no SQL/Postgres query anywhere in this file.

Prisma (`src/db/prisma-client.ts`) is configured, generated on every deploy (`vercel.json`), and schema-complete (`prisma/schema.prisma`) — but is **imported nowhere else in the codebase**. Fully dead code.

`app/api/health/route.ts` and `app/api/admin/system/route.ts` compound this by reporting fabricated connection state (`connectionPoolState: 'ACTIVE_TRANSACTION_MODE'`, `queryPerformanceAvgMs: 14.2`, `connectionStatus: 'WEBSOCKET_CONNECTED'`) whenever `provider.name === 'supabase'` — a string literal on the class, unrelated to actual connectivity — and `admin/system` also injects `Math.random()`-based CPU load.

One component genuinely does talk to Supabase: `src/storage/supabase-file-service.ts` uploads exported report files to Supabase Storage with a real try/catch fallback to a base64 data URL. This is unrelated to the user/project/scan database.

## 6. Auth — real cryptography, one weak point, two route-level authorization gaps

- Password hashing: PBKDF2-SHA512, 10k iterations, per-user salt, `crypto.timingSafeEqual` (`src/auth/auth-service.ts:38-53`) — real, not stubbed.
- JWT: hand-rolled HMAC-SHA256, signature and `exp` genuinely verified (`auth-service.ts:58-169`).
- Weak point: `getJwtSecret()`/`getRefreshSecret()` only throw if `NODE_ENV==='production'` and the var is fully unset — no check for weak/placeholder secret *values*, and non-production silently falls back to a hardcoded default secret baked into source (`auth-service.ts:22,29`).
- Root `middleware.ts` only checks that a `figm_token` cookie is *present*, never verifies it — real verification happens per-route via `authenticateUser` (`src/auth/auth-middleware.ts`).
- `src/auth/rate-limiter.ts` uses an in-process `Map`, ineffective across multiple serverless instances (Vercel).
- **`app/api/scans/[id]/route.ts` has no auth check at all** — imports `UserDB` directly, bypassing `authenticateUser`. Unauthenticated GET/PATCH/DELETE on any scan record by ID.
- **`app/api/export/route.ts` calls `authenticateUser` but ignores a failed result** (`auth.user?.userId || 'usr_anonymous'`), never returning 401 — unauthenticated report export.

## 7. API surface

31 route files under `app/api/**/route.ts`. Full method/auth/DB table to be produced in Phase 10. Notable issues found already:
- `app/api/report/route.ts` — no auth, not DB-backed at all (reads a static JSON file off disk or re-scans a bundled sample); effectively a demo endpoint.
- `app/api/dashboard/statistics/route.ts` — mixes one real value with hardcoded literals (`accessibilityScore: 92`, `securityScore: 95`, etc.).
- `app/api/user-study/log-scan/route.ts` — falls back to `Math.random()`-based `scanTimeMs`/`memoryUsageMb` when no code payload is sent.

## 8. AI remediation — real Gemini integration, validator gap

`AIRemediationPipeline` (`src/ai/ai-remediation-pipeline.ts`) makes a genuine `fetch` call to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` when `GEMINI_API_KEY` is set, and falls back to deterministic template patches (`RemediationEngine.applyQuickFix`) otherwise or on failure.

**Gap**: the validator actually wired into this pipeline (`AIPatchValidator.validatePatch`) only checks non-emptiness, absence of markdown fences, that the code changed, and that it re-parses — **it never re-scans the patch to confirm the original violation is actually resolved.** A better validator exists (`RemediationEngine.validatePatch`, re-invokes the scanner and checks the specific `ruleId` is gone) but its only caller is a test file, never the production pipeline.

## 9. Evaluation / precision-recall pipeline — genuinely dynamic core, fabricated auxiliary layers

`EvaluationRunner.runEvaluation()` (`src/eval/evaluation-runner.ts`) is real: it reads `benchmarks/ground-truth.json` + `benchmarks/testbed/*`, calls the live scanner, computes TP/FP/FN by matching, and recomputes precision/recall/F1 fresh each run (with correct divide-by-zero guards) into `benchmarks/eval-summary.json` / `docs/evidence/canonical-evaluation.json`. `scripts/validate-research.ts` independently recomputes and checks consistency (0.001 tolerance) — a real check, not theater.

However:
- `src/eval/repo-evaluator.ts` (`REPOSITORY_DATASET`) — the "30 open-source repository" large-scale evaluation — is **entirely hardcoded literal data** (LOC, scan duration, violation counts, scores) for real-named repos (excalidraw, next.js commerce, ngx-admin, etc.). No git clone, no fetch, no scan ever executes for this dataset. The code's own comment (`thesis-gap-exporter.ts:24`) admits this is a "pre-compiled... benchmark vector," not a live evaluation.
- `src/eval/user-study-evaluator.ts` — hand-authored Likert-scale response counts (`N=85` hardcoded) feeding a Cronbach's α calculation with a fudge-factor correlation constant — entirely synthetic survey data. It is at least correctly labeled `SYNTHETIC_PIPELINE_TEST_DATA` and gated behind `isReal` checks downstream in `ThesisGapExporter`.
- `src/eval/benchmark-data-loader.ts` (`FALLBACK_BENCHMARK_METRICS`) and `src/eval/precision-recall-engine.ts` (`EMPIRICAL_EXPERT_GROUND_TRUTH`, including an arbitrary `tn: 25` literal) hardcode the same 85.7/94.7/90.0 numbers as a fallback for UI code when the canonical evaluation file is missing.

## 10. Fabricated evidence found presented as real (no synthetic label) — see Phase 12/13/18 for fixes

- **`docs/evidence/user-study/user-study-results.json`** — presents `sampleSize: 85`, `meanSUSScore: 86.4`, `cronbachAlpha: 0.89`, and a fabricated institution ("NSBM Green University Town"), with **no synthetic/placeholder disclaimer**. This file is not produced by any script in the repo (hand-authored) and directly contradicts the honest `research/analysis/usability-results.json`, which correctly reports `isRealHumanData: false`, `validParticipantCount: 0`, `collectionStatus: NOT_COLLECTED`.
- **`app/analytics/page.tsx`** (`REPO_BENCHMARKS` array) — fabricated per-repo precision/recall/error counts for real, named open-source projects (facebook/react, angular/angular, vuejs/core, etc.), each labeled `status: 'VERIFIED'`, displayed directly in the product UI under the heading "Empirical ground-truth evaluation across 30 open-source SPA repositories." No such scan was ever executed against these repositories.
- **`app/api/scan/route.ts`** — falls back to hardcoded `0.12`ms / `0.45`MB when live profiling data is unavailable, presented as if measured.

Confirmed **not** fabricated: `research/raw/real/`, `research/processed/real/`, `research/anonymized/real/` contain only `.gitkeep` (zero real participant records, as expected pre-collection); `research/analysis/usability-results.json` correctly reports the `NOT_COLLECTED` baseline; `"P001"`–`"P085"` participant-ID strings appear only in ID-formatting test assertions, never as fabricated response rows; `benchmarks/ground-truth.json` + `benchmarks/testbed/*` (the small 18-item/4-file evaluation set actually used to compute the headline 85.7/94.7/90.0 numbers) is a plausible hand-authored fixture set, not auto-generated by the tool itself (non-circular).

## 11. Rule count discrepancy (cosmetic)

`src/matrix/four-layer-meta-model.ts` header comment says "Complete 23 Rules" (lines 3, 17) but `FOUR_LAYER_MAPPINGS` actually defines 25 rule entries (`FIGM-PERF-01..06`, `FIGM-A11Y-01..06`, `FIGM-NEXT-01..04`, `FIGM-REACT-01..04`, `FIGM-ANG-01..05`). Stale comment, not a functional bug.

## 12. Migration script idempotency (minor, non-blocking)

`scripts/migrate-json-to-supabase.ts:187` uses `prisma.auditLog.create()` instead of an upsert; re-running the migration against a DB that already has these rows throws a caught-but-noisy `Unique constraint failed` per row, inflating console/test output without affecting correctness (counted as `auditLogsSkipped`).

## 13. Build/Test baseline (Phase 1 results — see conversation for full logs)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS**, 0 errors |
| `npm test` (23 files, `node --test`) | **PASS**, 136/136 tests, 0 failures, 22 suites |
| `npm run research:evaluate` | **PASS**, F1 90.0% (dynamically computed, see §9) |
| `npm run research:validate` | **PASS**, TP=18/FP=3/FN=1, precision 85.7%, recall 94.7%, consistent with canonical artifact |
| `npm run ci:scan` (self-scan of 132 app source files) | **FAILED** (exit 1) — Quality Score 67% < 70% threshold, 713 violations. Materially inflated by two confirmed tool bugs: (a) isolated `TypeCheckerService` missing ES2015+/DOM lib config → spurious `TYPE-TS-2583 "Cannot find name Promise/Map/Set/URL"` across dozens of files, despite real `tsc --noEmit` passing clean; (b) `FIGM-PERF-04` firing on essentially every plain top-level `import` statement (not actually inside a conditional/deferred scope) across ~30 files. |
| `npm --prefix vscode-extension run compile` | **PASS**, 0 errors |

**Key implication**: the tool's own self-scan quality score (67%, FAILED) is not directly comparable to the headline research precision/recall numbers (85.7%/94.7%, computed against a small curated 18-item fixture set) — running the tool against a large, real, diverse codebase surfaces materially more false positives than the curated benchmark reflects. This gap is itself a finding worth stating plainly in the dissertation rather than obscuring.

## 14. Recommended fix priority for Phase 16/17

**Immediate (unambiguous fabrication/security, no scope tradeoff — safe to fix now):**
1. Remove or correctly synthetic-label `docs/evidence/user-study/user-study-results.json`.
2. Remove or correctly synthetic-label the `REPO_BENCHMARKS` "VERIFIED" data in `app/analytics/page.tsx`.
3. Add auth check to `app/api/scans/[id]/route.ts`.
4. Fix `app/api/export/route.ts` to actually return 401 when auth fails.
5. Fix `TypeCheckerService` compiler `lib` options (add `ES2015`/`DOM`) to eliminate the `TS2583` false-positive flood.
6. Fix `FIGM-PERF-04` detection to require an actual conditional/deferred scope, not just "is a top-level import."
7. Wire `AIPatchValidator`/`AIRemediationPipeline` to re-scan and confirm the specific violation is resolved before reporting AI-fix success.
8. Fix stale "23 Rules" comment.
9. Fix `migrate-json-to-supabase.ts` audit-log import to use upsert.

**Requires explicit user scope decision (large, potentially multi-day rewrites):**
- Replacing the regex/string-match "AST" pipeline with a real parser (TypeScript Compiler API for TS/JS/React/Next; a real Vue SFC / Angular template compiler) — this is close to a rewrite of the core analysis engine, not a bug fix.
- Actually wiring `SupabaseStorageProvider` to real Postgres/Supabase queries (or removing the Prisma/Supabase scaffolding and being honest that the product is JSON-file-backed).
- Running a real 30-repository large-scale evaluation (`repo-evaluator.ts`) instead of the current hardcoded literal dataset.
- Conducting an actual human usability study (85 real participants) — out of this session's control entirely; requires real external participants.
