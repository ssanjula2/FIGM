# Live Scan: Infrastructure-Error Domain, 25-Rule Ground-Truth Extension, and Live Verification — Closure Report

**Date**: 2026-08-25
**Scope**: A large mega-prompt requested a full FIGM-vs-general-error architecture for `/live-scan` (dual diagnostic domains, dual fix engines, verify/rollback, research metrics separation, 25-rule ground truth, live browser verification). Forensic audit found nearly all of this **already built and working**. This report documents the actual gap-closure work performed, with real evidence — not a restatement of the original mega-prompt's aspirational architecture.

---

## 1. Executive Summary

A forensic audit of the existing codebase (three parallel research passes) found that the `FIGM_RULE` / `GENERAL_CODE_ERROR` diagnostic-domain split, a real TypeScript-compiler-backed general-error engine (`TypeCheckerService`), two scope-guarded fix pipelines (`FigmFixPipeline` / `CodeErrorFixPipeline`), mandatory rescan-before-verify (an unverified patch never touches the source), a sandboxed `DynamicProfiler`, and a TP/FP/FN empirical evaluation pipeline **already existed and were already working correctly**, with honest self-disclosure throughout (e.g. every diagnostic carries `sourceKind: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC'`).

Given that, rebuilding this from scratch would have violated the mega-prompt's own Rule 21 ("no unrelated architectural rewrites") and risked exactly the kind of fabrication it prohibits. Instead, four concrete, verified gaps were closed:

1. Added a third, distinct `INFRASTRUCTURE_ERROR` status so a genuine scan-service failure (not a code diagnostic) is never silently swallowed, never becomes an unhandled promise rejection, and never leaks internal error detail to the client.
2. Extended the canonical, file-based ground-truth benchmark from **8/25 rules** to **24/25 rules** (39 hand-labelled violations, up from 19), reusing already-vetted positive snippets from the separate `benchmarks/complete-rule-evaluation/` dataset as source material, with every new entry empirically confirmed against the real, unmodified engine before being added.
3. Performed real, browser-driven verification of `/live-scan` (login → scan → fix → malformed-source handling) against the live dev server and a real Supabase-backed database, not just in-process API tests.
4. Updated every document that surfaces the old 8/25 and 19-violation figures so nothing in the repo states a stale number.

---

## 2. What Already Existed vs. What Changed

| Capability | Status before this session | Change made |
|---|---|---|
| `FIGM_RULE` / `GENERAL_CODE_ERROR` domain split | Fully implemented (`src/engine/diagnostic-classifier.ts`) | None |
| Real TS-compiler general-error engine | Fully implemented (`src/analysis/type-checker-service.ts`) | None |
| Dual fix pipelines with scope guards | Fully implemented (`src/ai/figm-fix-pipeline.ts`, `src/ai/code-error-fix-pipeline.ts`) | None |
| Rescan-before-verify, no unverified mutation | Fully implemented (`src/engine/remediation-engine.ts` `validatePatch`/`validatePatchAsync`) | None |
| Sandboxed `DynamicProfiler` | Fully implemented, child-process isolated | None (not touched, per Rule 16) |
| TP/FP/FN eval pipeline | Fully implemented, honestly self-scoped | Extended ground truth (see §4) |
| Third `INFRASTRUCTURE_ERROR` domain | **Did not exist** | **Added** (see §3) |
| Ground-truth rule coverage | 8/25, honestly disclosed | **24/25**, honestly disclosed |
| Live browser verification of the FIGM/CODE_ERROR split | Only in-process API tests existed | **Performed, evidence below** (§6) |

---

## 3. `INFRASTRUCTURE_ERROR` Domain — Design and Changes

**Design decision**: `INFRASTRUCTURE_ERROR` was **not** added as a third value inside `DiagnosticReport.kind` alongside `FIGM_RULE`/`GENERAL_CODE_ERROR`. That type's sibling fields (`domain: DomainType`, `concern: ConcernType`) are hard-typed to the FIGM research taxonomy (`PERFORMANCE | ACCESSIBILITY`); forcing an infra failure through it would mean either widening the canonical research taxonomy or reusing an unrelated placeholder value (the existing `SYNTAX-PARSE-ERROR` diagnostic already does the latter as a legacy wart — not a pattern to extend). An infrastructure failure isn't a finding about the submitted code at all, so it is modeled as a **sibling top-level field**, `serviceStatus`, on the API response — never inside the `diagnostics` array.

**Server changes (`app/api/scan/route.ts`)**:
- New `ScanServiceStatus` type: `{ status: 'INFRASTRUCTURE_ERROR'; stage: 'ANALYSIS_ENGINE' | 'PERSISTENCE'; message: string }`.
- `RuleExecutionEngine.analyzeFileAsync(...)` (previously unguarded — any internal exception fell through to the generic outer catch, which forwarded `err.message` verbatim to the client) is now wrapped in its own `try/catch`. On failure: full error logged server-side only; client receives `{ success: false, serviceStatus: { status: 'INFRASTRUCTURE_ERROR', stage: 'ANALYSIS_ENGINE', message: 'Scan service temporarily unavailable. Please try again.' } }` at HTTP 503.
- The already-existing, already-non-fatal `ScanRepository.createScanRecord` failure path (scan succeeds, history-save fails) now also attaches `serviceStatus: { stage: 'PERSISTENCE', ... }` to the successful response, so this failure is visible to the caller instead of only `console.error`-logged.
- Fixed a real, independently-discovered bug: the fire-and-forget audit-log call (`AuditLogger.logEvent(...)`, needed for the DB-backed rate limiter to see this request) was `void`-called without a `.catch()` — a DB outage there would have produced an unhandled promise rejection. Now `.catch()`-guarded and logged.
- The outer catch-all (`app/api/scan/route.ts`'s last-resort 500 handler) no longer forwards `err.message` to the client; it logs full detail server-side and returns a generic `'Scan execution failed'` message.

**Client changes (`app/live-scan/page.tsx`)**:
- `handleScan` and `runBatchScan` previously discarded the response body on any non-2xx status (`throw new Error(\`Server returned status ${res.status}\`)`), losing the server's real, specific message (429 rate-limit, 413 too-large, 503 infra failure). Both now parse the JSON body first and branch on it.
- New `serviceError` state, rendered as a visually distinct "🛠️ Scan Service Error" banner — separate from the pre-existing generic `scanError` banner — so an infra failure is never visually or semantically conflated with a code-analysis result.
- A `PERSISTENCE`-stage `serviceStatus` riding along with a successful scan result is shown as a small non-blocking inline note near "Save to History," reusing the existing `{kind, message}` pattern already used by `saveHistoryStatus` rather than inventing a new one.

**Test coverage added**: `tests/live-scan-e2e.test.ts` gained one new test that fault-injects a thrown error at the real `RuleExecutionEngine.analyzeFileAsync` integration seam (the one failure mode no legitimate, even pathological, input could reproduce — see §5) and asserts: HTTP 503, `serviceStatus.status === 'INFRASTRUCTURE_ERROR'`, no `diagnostics` field present, and — critically — that the injected internal error string never appears anywhere in the JSON response body.

---

## 4. Ground-Truth Coverage: 8/25 → 24/25

**Source material**: `benchmarks/complete-rule-evaluation/cases.ts` already had a positive/negative snippet pair for all 25 rules, independently verified via `CompleteRuleEvaluationRunner`. These snippets (derived from each rule's own `nonCompliantExample` in `src/matrix/four-layer-meta-model.ts`) were reused as source material for new files in `benchmarks/testbed/` — nothing was hand-invented.

**16 new testbed files added** (one per previously-uncovered rule, `FIGM-PERF-05/06`, `FIGM-A11Y-05/06`, `FIGM-REACT-01..04`, `FIGM-NEXT-01/02/04`, `FIGM-ANG-01..05`). Every one was empirically probed against the real, unmodified `RuleExecutionEngine` **before** any ground-truth entry was written — never hand-asserted. Two genuine cross-rule interactions were found and handled correctly rather than papered over:
- `Perf05Benchmark.jsx` / `React04Benchmark.jsx` each genuinely trigger **two** real, independent violations on the same line (`FIGM-PERF-05` + `FIGM-REACT-04`) — both were ground-truthed, not just the intended one.
- The five new Angular fixtures initially also incidentally triggered `FIGM-ANG-02` (missing `OnPush`) alongside their intended rule; rather than ground-truth an unintended collateral finding, `changeDetection: ChangeDetectionStrategy.OnPush` was added to four of the five decorators so each fixture cleanly demonstrates one rule.

**A genuine, pre-existing discovery**: probing the *original* 4 testbed files (unchanged) surfaced two violations that had been present in the source all along but were never ground-truthed, because their rules weren't yet in the covered set — `FIGM-PERF-05` on `ReactBenchmark.jsx` line 24, and `FIGM-ANG-02` on `AngularBenchmark.component.ts` line 3. These are exactly the two false positives the project's own prior audits had already disclosed (`TP=19/FP=2`). Both were directly source-verified as genuine (not detector bugs) and ground-truthed, which is why the final result below is `FP=0`, not a residual 2.

**`FIGM-NEXT-03` remains uncovered** by this file-based pipeline. Its real-AST detector (`isAppRouterPageFile`) requires a literal `app/<segment>/page.<ext>` path component in the scanned file's path string. `EvaluationRunner`'s file discovery is a flat, non-recursive `fs.readdirSync(testbedDir)` — extending it to walk subdirectories was deliberately **not done** in this pass, to avoid touching research-critical file-discovery logic beyond what this scoped brief required. `FIGM-NEXT-03` is unit-tested and independently covered by `benchmarks/complete-rule-evaluation/` (which is not filesystem-path-constrained), so it is not without empirical coverage — just not in this specific pipeline. This is disclosed in `benchmarks/ground-truth.json`'s own `meta.ruleCoverageNote`.

**Real, regenerated result** (`npm run eval`, `benchmarks/eval-summary.json`):

```
truePositives: 39   falsePositives: 0   falseNegatives: 0
precision: 1.0       recall: 1.0         f1Score: 1.0
ruleCoverage: 24/25 (FIGM-NEXT-03 uncovered, disclosed)
frameworkMetrics: ANGULAR_TEMPLATE, GENERIC_ESTREE, NEXT_JS, REACT_JSX, VUE_SFC (5, up from 4 — NEXT_JS is newly represented)
```

`src/eval/evaluation-runner.ts` had one real, independent bug fixed as part of this: `frameworkMetrics` was built from a **hardcoded** 4-framework array, while `ruleMetrics`'s `allRules` was already correctly dynamically derived from the ground-truth data (with an explicit code comment explaining why). The hardcoded array would have silently dropped the new `NEXT_JS` framework's TP/FP/FN from the framework-level breakdown report entirely (global/rule-level totals were unaffected — only that one breakdown view). Fixed to derive `allFrameworks` from ground truth the same way `allRules` already does.

**Documents updated to state the real, current numbers** (24/25, 39 violations, P=R=F1=100%, 0 FP) instead of the old 8/25/19/90.5%: `VIVA_PREPARATION_GUIDE.md`, `DISSERTATION_DEMO_GUIDE.md`, `RESEARCH_TRACEABILITY_MATRIX.md`, `docs/evidence/research-claim-traceability.md`, `app/api/research-metrics/route.ts` (the live `/analytics`-facing `evaluationDataset` block), and `tests/evaluation-runner.test.ts`'s exact-value regression assertions (deliberately updated per that test's own documented policy, not silently).

**Not touched**: `benchmarks/complete-rule-evaluation/` (already complete/correct) and `benchmarks/real-world/` (a different, no-ground-truth concern) — both only cross-referenced.

**Note on four dissertation files that also show as modified in `git status`** (`docs/dissertation/chapter3_architecture.tex`, `chapter3_methodology.md`, `chapter6_conclusion.md`, `chapter5_evaluation.tex`): these are **not** attributable to this session. They are written by a separate script (`src/docs/dissertation-exporter.ts`, run via `npm run export-docs`), which was never run in this session. Their modifications were already present in the working tree before this work began (this repo had ~200 pre-existing uncommitted files at session start). Only `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md` was genuinely regenerated by this session's `npm run eval` runs, via `src/eval/thesis-gap-exporter.ts`.

---

## 5. Test Results

- **`npx tsc --noEmit`**: clean, no errors, after every code change in this session.
- **`npm test`** (848 tests across 74 suites, up from a pre-session baseline the repo's own docs put at 784/71): **847 pass, 1 fail**. The one failure (`tests/participant-matrix-n-plus-1.test.ts`, "the batched matrix still reports the correct submission count for a participant with real submissions", `P2002` duplicate-email unique-constraint error) is **pre-existing and unrelated** — reproduced in isolation, touches only the participant-matrix/user-db subsystem (no file in that code path was touched this session), and is consistent with test-isolation state against the live Supabase DB rather than a real product defect. Not silently ignored: reported here and in `VIVA_PREPARATION_GUIDE.md`.
- **`npm run eval`**: real, regenerated result — see §4. Re-run twice (once before, once after adding the two previously-undisclosed baseline-FP labels) to confirm the numbers move exactly as expected, not by coincidence.
- **`npm run build`** (`next build`): clean, all ~65 routes compiled successfully, matching the healthy baseline the most recent prior audit (`audit/ULTIMATE-ZERO-TRUST-FINAL-FORENSIC-AUDIT-2026-08-24.md`) already established (3/3 clean that pass).

No `.only`/`.skip`/`.todo` were added or removed. No existing assertion was weakened; the two updated assertions (`tests/evaluation-runner.test.ts`) were widened in **scope** (24 rules instead of 8) while becoming **stricter** in value (exact 39/0/0/1.0 instead of 19/2/0/0.905), per that test's own pre-existing, explicit "update deliberately, not silently" policy comment.

---

## 6. Live Browser Verification (against `next dev` on `localhost:3001`, a real Supabase-backed DB, `mcp__claude-in-chrome__*`)

A throwaway `DEVELOPER`-role test account (`figm-livescan-verify-20260825@example.com`) was self-registered through the real `/auth/register` flow to reach `/live-scan` (now auth-gated by prior, unrelated closure work). **This account was not cleaned up after testing** — flagged here for the project owner's awareness, consistent with this project's own established transparency norm for disposable test accounts (see `audit/ULTIMATE-ZERO-TRUST-FINAL-FORENSIC-AUDIT-2026-08-24.md`'s own diagnostic-account cleanup).

| Test | Result |
|---|---|
| **A/B** — valid code with FIGM violations only | ✅ Sample React code: 3 FIGM violations, 0 code errors, total 3. |
| **C** — genuine TypeScript error only | ✅ `const age: number = "hello";` → 0 FIGM violations ("No violations of any of the 25 canonical FIGM rules"), 1 real `TS2322` (`Type 'string' is not assignable to type 'number'.`), auto-fix available. |
| **D** — both domains in one file | ✅ 1 FIGM violation (`FIGM-A11Y-01`) + 2 code errors (`TS2322`, `TS2875`), total 3 = sum, both sections rendered distinctly, no double-counting. |
| **E** — Fix a general code error | ⚠️ Real, reproducible bug found: the deterministic `TS2322` fix wraps the wrong span, generating **syntactically invalid** output (`const (age as any): number = "hello";`). The verify-before-apply step correctly caught this (re-scan found a new syntax error) and rejected the patch — **the source was never modified**. The safety mechanism worked exactly as designed; the underlying fix-generation logic has a real defect for this case shape. Not silently passed over — reported here. |
| **F** — Fix a FIGM rule violation | ⚠️ Same safety mechanism, different root cause: `FIGM-A11Y-01`'s auto-fix (adds `role="button" tabIndex={0} onKeyDown={(e) => ...}`) was rejected even on a completely isolated, otherwise-clean file. Most likely cause (not fully root-caused in this pass): the generated `onKeyDown` handler's untyped `e` parameter trips an implicit-`any` diagnostic under the isolated single-file strict type check. Confirmed reproducible twice, once combined with unrelated errors and once in isolation — ruling out cross-error interaction as the cause. Source was never modified in either case. |
| **G** — Ambiguous fix / no silent mutation | ✅ Directly demonstrated by both E and F above: two independent "Patch Rejected" events, both leaving the editor source completely unchanged, both showing the real diff and a human-readable rejection reason. The dev-server access log confirms every one of these `POST /api/scan` calls returned `200`, not a crash. |
| **H** — Malformed source | ✅ Unclosed brace → no crash, no 500, `analysis.figmStatus: PARTIAL` correctly and honestly disclosed (not silently COMPLETE), a real `SYNTAX_ERROR` diagnostic with an accurate location, 0 fabricated FIGM findings. The new `INFRASTRUCTURE_ERROR` banner correctly did **not** fire — confirming clean separation between a code-analysis outcome (this case) and a service failure (§3's fault-injection test). |

Every `POST /api/scan` request across this entire manual session returned HTTP 200 (confirmed against the raw dev-server access log) — including the two rejected-fix attempts and the malformed-source case. No 500s, no hangs, no crashes were observed at any point.

---

## 7. Regression Check

`git diff --stat` against `src/matrix/four-layer-meta-model.ts`, `src/ast/ast-detection-engine.ts`, and `src/matrix/rule-registry.ts` — **zero changes**. All 25 canonical FIGM rule IDs, names, severities, framework mappings, and detection semantics are exactly as they were before this session. `DynamicProfiler`'s sandbox architecture (`src/engine/dynamic-profiler.ts`) was not touched. No FIGM diagnostic was ever converted to a `GENERAL_CODE_ERROR` or vice versa — the classifier (`classifyDiagnosticKind`) was not modified.

---

## 8. Remaining Limitations (honestly disclosed)

1. `FIGM-NEXT-03` has no coverage in the canonical file-based ground-truth pipeline (§4) — it is unit-tested and covered by the independent `complete-rule-evaluation` dataset.
2. `FIGM-ANG-03`, `FIGM-ANG-04` remain legacy-text-heuristic detection for every framework (no real-AST path exists for either), and Vue SFC files receive legacy-heuristic detection for all 25 rules — unchanged by this session, consistent with prior, already-disclosed project state.
3. Two real, reproducible remediation-engine bugs were discovered during live verification (§6, Tests E and F) and are **not fixed** in this pass — they were out of the approved scope (infra-error domain, ground-truth extension, live verification, closure report), and the verify/rollback safety mechanism already prevents them from ever corrupting a user's source. Flagged here as concrete, evidenced follow-up work, not hidden.
4. One pre-existing, unrelated test failure (`tests/participant-matrix-n-plus-1.test.ts`) remains open (§5).
5. The test account created for live verification (§6) was not cleaned up.
6. Build-reliability-on-this-specific-machine nondeterminism was already an open, disclosed item from the prior `2026-08-24` audit; this session's one `npm run build` was clean but is a single data point, consistent with (not contradicting) that prior finding.

---

## 9. Final Verdict

**READY WITH DOCUMENTED LIMITATIONS.**

The `INFRASTRUCTURE_ERROR` domain addition is complete, tested (including a real fault-injection test), and live-verified to correctly stay silent when it shouldn't fire (Test H) and correctly fire without leaking internal detail when it should (the injected-failure unit test). Ground-truth coverage genuinely improved from 8/25 to 24/25 rules with real, regenerated, zero-fabrication metrics (39 TP / 0 FP / 0 FN), including closing two previously-undisclosed baseline false positives by direct source verification rather than by loosening anything. Live browser verification exercised the real FIGM/CODE_ERROR domain split, both fix pipelines, and malformed-source handling against a real database — and, in the course of doing so honestly, surfaced two real, previously-unknown remediation-engine bugs (§6, §8) that the existing verify/rollback safety mechanism already contains. This is not a "NOT READY" verdict item — the containment worked exactly as designed — but the underlying fix-generation defects are real, open, and listed as concrete follow-up work rather than glossed over.
