# FIGM Code Inspector — Final Production Forensic Audit

**Date**: 2026-08-13
**Method**: Zero-trust, live evidence only. Every claim below is backed by a real HTTP request against the live production deployment, a real local command execution, a real detect→remediate→re-scan cycle, or a real re-read of source code — not by any pre-existing narrative.

**A note on this file's history this session**: this document was found silently truncated to blank lines **twice** during this session, for reasons never determined (no other file in `docs/audit/` was affected either time). If you are continuing this audit in a future session and this file is unexpectedly short or empty, that is a known, reproducible environment anomaly in this workspace — not evidence that no work was done. Rewritten fresh both times rather than reconstructed from memory, cross-checked against the actual current source and test suite.


---

## 1. Executive Summary

| Area | Status | Evidence |
|---|---|---|
| Local fixes reach production | 🟢 VERIFIED | 4 commits pushed this session-arc (`e1275c24`, `325f1d22`, `13ae0d1d`, and this round's); each verified live by directly re-testing the exact bug it fixed against the live API |
| React / Next.js / Angular / Vue live scan | 🟢 VERIFIED | Real HTTP register + 4 real scans against production, real diagnostics returned (prior round; see this file's git history for the raw request/response log) |
| Vue `@click` shorthand | 🟢 FIXED THIS ROUND | Was unverified/likely-broken; found not recognized (only `v-on:click` was), fixed in `source-parser.ts`, regression-tested (`tests/rule-detection-matrix.test.ts`) |
| Database persistence, ownership, retrieval | 🟢 VERIFIED | Real round-trip against production Postgres, cleaned up afterward |
| Complexity dynamic + independently verified | 🟢 VERIFIED | 4/4 controlled McCabe fixtures (CC=1,2,3,4) match exactly |
| Quality score consistency (live vs. persisted) | 🟢 FIXED THIS ROUND | Was a confirmed bug (74 live vs. 88 persisted for the same scan); root-caused to 2 independently-duplicated formulas, unified into one canonical `src/engine/quality-score.ts` used by all 4 call sites, regression-tested |
| Guideline traceability — clause-level in the live API | 🟢 FIXED THIS ROUND (partial, honestly scoped) | Was confirmed blanket-only (`"ISO 25010"`/`"WCAG 2.2"`); now returns real WCAG 2.2 SC numbers for accessibility concerns and real ISO/IEC 25010 Performance Efficiency sub-characteristics for performance concerns — see §6 for exactly what is and isn't covered |
| Remediation coverage (all 25 rules) | 🟢 FIXED THIS ROUND | Was materially incomplete: 11 of 25 real rule IDs had no dedicated case at all, 3 more cases were dead code under nonexistent rule IDs, and 4 more fixed the WRONG violation (old-taxonomy remnants). All 25 now have a dedicated, honestly-verified case — see §7 |
| Dashboard hardcoded statistics | 🟢 FIXED THIS ROUND | Found and removed real, significant fabrication in both the backend (`DashboardRepository.getSummary`, hardcoded floors up to `Math.max(x, 823)`) and the frontend (`LiveDashboardContent.tsx`, `|| 30`-style fallbacks that would have silently defeated the backend fix) — see §9 |
| AI-powered remediation active in production | 🔴 NOT ACTIVE | `GEMINI_API_KEY` not configured; confirmed live (`engineType: "TEMPLATE_FALLBACK"`) |
| Research metrics (P/R/F1) real and reproducible | 🟢 VERIFIED | TP=18/FP=3/FN=1 → 85.7%/94.7%/90.0%, independently recomputed from the raw formulas, `research:evaluate` and `research:validate` agree |
| Human study | 🔴 CONFIRMED 0/85, HONESTLY REPORTED | Unchanged this session; see `docs/audit/HUMAN_STUDY_PROVENANCE_AUDIT.md` |
| Full 100+-fixture adversarial matrix, browser UI walkthrough, formal CSRF audit | ⚪ NOT PERFORMED | Out of this session's scope — see §10 |

---

## 2. Deployment Verification

Four commits were pushed to `origin/main` (auto-deploying via Vercel) across this session's two rounds of work:
1. `e1275c24` — storage/auth wiring + comment/string/multi-line detection fixes (verified live via a health-endpoint schema change)
2. `325f1d22` — remediation engine bug fixes (wrong-template misfire, broken keyboard-handler codegen) + removed fabricated research dataset claims (verified live by re-calling the exact API request that reproduced the bug, before/after)
3. `13ae0d1d` — audit documentation
4. **This round**: Vue `@click` support, quality-score unification, full 25-rule remediation coverage, live guideline traceability, dashboard fabrication removal (backend + frontend)

**Method note**: `/api/health` is statically pre-rendered by Next.js (no `export const dynamic = 'force-dynamic'`) and served with `X-Vercel-Cache: HIT`/`Age: N` headers — a build-time snapshot, not reliable live per-deploy evidence. The trustworthy method used throughout: directly re-executing the exact API call that reproduced a real bug, before and after deployment, against the real dynamic (`ƒ`) endpoints.

---

## 3. This Round's Root-Caused Defects (fail → root cause → fix → pass)

### 3a. Vue `@click` shorthand not recognized (FIGM-A11Y-01)
- **Fail**: `<div @click="handleClick">` produced zero diagnostics; only the explicit `v-on:click` form was checked in `source-parser.ts`'s `hasOnClick`/`hasOnKeyDown` conditions.
- **Root cause**: the trigger condition literally listed `'onClick'`, `'v-on:click'`, `'(click)'` but not `'@click'` — the far more common, idiomatic real-world Vue form.
- **Fix**: added `@click`/`@keydown` to the recognized tokens.
- **Pass**: `tests/rule-detection-matrix.test.ts` — new "Vue click-handler syntax variants" describe block, both a positive (`@click` alone → fires) and negative (`@click` + `@keydown.enter` + `tabindex="0"` → correctly suppressed) case.

### 3b. Quality score inconsistency (live vs. persisted)
- **Fail**: the same real scan reported `qualityScore: 74` in the live `/api/scan` response but `qualityScore: 88` in the persisted `scans` history record (confirmed live in the prior round).
- **Root cause**: 4 independent implementations of the "quality score" formula existed (`rule-execution-engine.ts`, `report-generator.ts`, `figm-analyze.ts`, and `app/api/scan/route.ts`'s persistence path) — 3 coincidentally identical, but the persistence path used a genuinely different, cruder formula (`100 - (totalErrors*5 + totalWarnings*2)`) instead of the real weighted-severity one.
- **Fix**: extracted a single canonical `calculateQualityScoreFromCounts`/`calculateQualityScore` (`src/engine/quality-score.ts`); all 4 call sites now use it; the persistence path specifically now reuses `scanResult.qualityScore` directly instead of recomputing anything.
- **Pass**: `tests/quality-score.test.ts` — reproduces the exact original fixture and asserts the old wrong formula would have diverged (proving the fix has real effect, not just trivial self-equality), plus formula-correctness and cross-reproduction tests.

### 3c. Remediation coverage gap and taxonomy mismatches (see §7 for full detail)
- 11 of 25 real rule IDs had no dedicated `applyQuickFix` case at all (silently falling through to a generic pattern-matching fallback that fixes the wrong thing).
- 3 cases existed under rule IDs that don't exist in the live engine (`FIGM-REACT-05`, `FIGM-ANGULAR-01`, `FIGM-ANGULAR-02` — dead code).
- 4 more cases (`FIGM-REACT-01`, `FIGM-NEXT-02`, `FIGM-NEXT-04`, and — live-reproduced specifically — `FIGM-REACT-02`) fixed a **different violation** than what the rule of that ID actually detects.
- All found via a real detect→remediate→re-scan verification run across all 25 rules (`tests/remediation-coverage.test.ts`), not assumed.

### 3d. Guideline traceability was blanket-only in the live API (see §6)

### 3e. Dashboard statistics fabrication, backend and frontend (see §9)

---

## 4. Live Production End-to-End Scan (carried forward from the prior round, unchanged)

A disposable test account was registered against the live API and 4 real scans were run (React, Next.js, Angular, Vue), each returning real framework detection and real diagnostics with correct line/column/evidence, all persisted to Postgres under correct ownership, then cleaned up. Full request/response detail is in this file's git history (commit `13ae0d1d`). Not re-run this round to avoid writing more test data to the production database than necessary — the Vue `@click` fix specifically is covered instead by the real unit-level regression test in §3a, which exercises the identical `SourceParser`/`ASTDetectionEngine` code path the live API uses.

---

## 5. Complexity (unchanged this round)

4/4 controlled McCabe fixtures (CC=1, 2, 3, 4) matched exactly against the live-deployed engine's code. See prior round detail in git history.

---

## 6. Guideline Traceability — Now Partially Clause-Level in the Live API

**Before**: every diagnostic's `standardReference` was a blanket two-way ternary — `'ISO 25010'` for any PERFORMANCE-domain rule, `'WCAG 2.2'` for any ACCESSIBILITY-domain rule. Confirmed both by source inspection and by calling the live production API in the prior round.

**After**: `src/matrix/standard-clause-mapping.ts` maps each diagnostic's `concern` field (already computed, previously unused for this purpose) to a real, independently-verifiable clause:
- **WCAG 2.2**: the 4 accessibility concerns now cite their real Success Criterion — `KEYBOARD_ACCESSIBILITY` → SC 2.1.1 (Keyboard), `NAME_ROLE_VALUE` → SC 4.1.2, `STATUS_MESSAGES` → SC 4.1.3, `FOCUS_ORDER` → SC 2.4.3. These SC numbers are genuine, checkable clauses of the published W3C WCAG 2.2 recommendation — not invented. They were already present as comments on `AccessibilityConcernType` in `src/types/taxonomy.ts`; this only formalizes them into the actual response.
- **ISO/IEC 25010**: the 6 performance concerns now cite the real Performance Efficiency sub-characteristic (Resource Utilization or Time Behaviour — the actual published structure of that standard) they most plausibly belong to.

**What this deliberately does NOT do**: a richer, more granular `standardTraceability` structure already exists in `four-layer-meta-model.ts`/`guideline-filtering.ts`, but the prior round's audit (`GUIDELINE_FORENSIC_TRACEABILITY.md`) explicitly documented it as "this auditor's interpretive mapping, not sourced from an authoritative FIGM-to-standard crosswalk." That structure was deliberately **not** wired in here — doing so would risk presenting speculative clause numbers as verified fact, which this session's explicit instructions forbid. Only mappings independently verifiable against the real published standards were used.

**Verified**: `tests/guideline-traceability-live.test.ts`, 4/4 passing, including an assertion that a full multi-violation scan never falls back to the blanket domain-level string.

**Honest framing going forward**: this is "aligned with" / "mapped to" the cited clauses, per this session's explicit instruction — never "certified," "ISO verified," or "WCAG certified." FIGM is not an accredited conformance-testing tool.

---

## 7. Remediation — Full 25-Rule Coverage Audit

A real detect→remediate→re-scan cycle was run for all 25 real rule IDs (`tests/remediation-coverage.test.ts`, using the same positive fixtures as `tests/rule-detection-matrix.test.ts`). Results:

| Outcome | Count | Rules |
|---|---|---|
| **FIXED** — safe automatic fix, verified by re-scan | 19 | PERF-01/02/03/04/06, A11Y-01/02/03/04/05/06, NEXT-01/02/03, REACT-02/03, ANG-01/02/03/05 |
| **MANUAL_REVIEW_REQUIRED** — honestly flagged, not faked | 5 | PERF-05, NEXT-04 (partial: link replaced, className placement flagged), REACT-01, REACT-04, ANG-04 |
| **PATCH_REJECTED** — defensible rejection | 1 | NEXT-02 (generated code is correct real Next.js syntax; the isolated single-file type checker correctly flags a genuine type mismatch against the actual installed `monaco-editor` package's types for this exact usage — a real signal, not a bug in the remediation logic) |

**Before this session**, the true picture was far worse than "some gaps":
- **11 real rule IDs had no case at all**: `PERF-05/06`, `A11Y-05/06`, `NEXT-03`, `REACT-04`, and **all five** `ANG-01..05`. Every one of these silently fell through to a generic "universal pattern" fallback that pattern-matches the code snippet's superficial shape rather than the rule being fixed — this is exactly what produced the live-reproduced `FIGM-REACT-02` bug from the prior round (misapplied the A11Y "clickable element" template to a key-prop violation).
- **3 cases were dead code**, registered under rule IDs the live engine never emits (`FIGM-REACT-05`, `FIGM-ANGULAR-01`, `FIGM-ANGULAR-02` — real IDs are `FIGM-ANG-01..05`). Two of these (`ANGULAR-01`/`02`) actually had correct, reusable logic for `FIGM-ANG-01` (unsubscribed observable) and `FIGM-ANG-03` (missing trackBy) respectively — renamed to the real IDs rather than rewritten. The third (`REACT-05`, a Context.Provider memoization fix) had no corresponding real rule at all and was removed.
- **4 more cases fixed the wrong violation** (old-taxonomy remnants, found via the same verification run, not assumed): `FIGM-REACT-01`'s case fixed `key={Math.random()}` while the live rule flags a missing `useMemo` on expensive derived computations; `FIGM-NEXT-02`'s case converted `<img>` to `<Image>` while the live rule flags a heavy static import needing `next/dynamic`; `FIGM-NEXT-04`'s case guarded `window.` access while the live rule flags an external Google Fonts `<link>`.

**Where a safe fully-automatic fix is genuinely impossible** (a `useMemo`/`useCallback` dependency array, or template-method semantics, that cannot be reliably inferred from the snippet alone), the rule honestly reports `verified: false, verificationStatus: 'MANUAL_REVIEW_REQUIRED'` — a new status added to `RemediationEngine.validatePatch` specifically so a naive "does the specific rule stop firing" re-scan check can never be coincidentally satisfied by an incomplete stub (e.g. a `// TODO: fill in dependencies` placeholder) and misreported as a complete fix.

**One extra bug found and fixed along the way**: `FIGM-PERF-02`'s fix injected an unnecessary `style={{ aspectRatio: ... }}` prop (the rule's real trigger only requires `width`+`height`, already sufficient on their own) which was spuriously triggering a `TYPE-TS-2875` false positive in the isolated type checker, causing an otherwise-correct patch to be rejected. Simplified to just the necessary `width`/`height` attributes.

---

## 8. Research Metrics (unchanged this round, re-verified)

```
TP=18, FP=3, FN=1 -> Precision 85.7%, Recall 94.7%, F1 90.0%
```
Independently recomputed from the raw formulas (matches). `npm run research:evaluate` and `npm run research:validate` agree. These are AUTOMATED BENCHMARK METRICS (4 fixture files, 147 LOC hand-labeled ground truth) — not human-study metrics; the prior round found and removed a fabricated "85 simulated developer profiles" claim from the canonical evidence artifact (`docs/evidence/canonical-evaluation.json`).

---

## 9. Dashboard Hardcoded-Value Fabrication — Found and Fixed This Round

**Backend** (`src/engine/dashboard-repository.ts`, `DashboardRepository.getSummary`): every aggregate statistic was padded with a hardcoded minimum floor —
```
totalScans: Math.max(totalScans, 30)
totalReports: Math.max(totalReports, 30)
totalRulesTriggered: Math.max(totalRulesTriggered, 823)
totalAiSuggestions: Math.max(totalAiSuggestions, 175)
totalActiveUsers: Math.max(activeUserSet.size, users.length, 85)
avgMemoryUsageMb: 1.42   // never computed from real data AT ALL
```
Plus: when a user genuinely had zero real scans, the framework distribution was entirely fabricated (`react:10, nextjs:10, angular:10, vue:2, generic:2`) rather than showing real zeros, and `avgQualityScore`/`avgScanDurationMs` fell back to hardcoded `87`/`0.34`. A brand-new or low-traffic deployment would never show its real (small or zero) numbers — the dashboard always displayed at least the fabricated floor.

**Frontend** (`app/components/dashboard/LiveDashboardContent.tsx`): **critically, fixing only the backend would not have been enough.** The component independently applied its own `summary?.field || N` fallbacks using the identical fabricated numbers (30, 823, 175, 85, 0.34, 1.42, plus 2 more — `totalProjects || 5`, `avgQualityScore || 87`) — and because `0` is falsy in JavaScript, `0 || 30` evaluates to `30`. Even after the backend was fixed to report real zeros honestly, this frontend code would have silently swapped every real zero back out for the fabricated placeholder before it ever reached the screen. Also found: a permanently-displayed `"N=85 Cohort"` badge next to the active-users count, unconditional regardless of the real number shown beside it — the same fabricated-participant-count shape this codebase's human-study provenance work explicitly guards against elsewhere.

**Fixed**: all backend floors removed (real counts, real zeros); all frontend `|| N` fallbacks changed to `?? 0` (nullish coalescing — only applies to genuinely missing/loading data, never silently overrides a real 0); the "N=85 Cohort" badge replaced with an honest "Active Users" label.

**Verified**: `tests/dashboard-analytics.test.ts` rewritten — the old test asserted `>= 1`/`> 0` on every field for a user (`usr_demo`) confirmed to have **zero real scan records** in the database, meaning it was only ever passing because of the fabrication it should have been catching. Replaced with two honest tests: one confirming real zeros for a genuinely-empty user, one seeding a real scan record and asserting the aggregation reflects it **exactly** (not just "≥ 1") — a strictly stronger test than before.

**Not fully addressed**: the same component has several other static/vague trend badges (`"+100%"`, `"100% Valid"`, `"Active"`) that are not derived from any real historical time-series data (no such data model exists in this codebase). These don't cite a specific fabricated number/count the way the fields above did, and fixing them would require either building real historical tracking or removing the claims entirely — flagged as a remaining limitation (§10), not fixed this session.

---

## 10. Remaining Limitations (honestly listed, not hidden)

1. **AI remediation is not active in production** — `GEMINI_API_KEY` unset; all remediation is the deterministic template engine, correctly self-labeled as such.
2. **The core parser is a comment/string-aware line-and-region scanner, not a real AST** — the single largest fidelity risk to every detection claim in this project. Extensively documented and partially mitigated (see `ADVERSARIAL_DETECTION_AUDIT.md`), not rewritten.
3. **The full 100+-fixture exhaustive per-rule adversarial matrix** (positive/negative/boundary/adversarial × 25 rules) was not built — `tests/rule-detection-matrix.test.ts` (1 TP + 1 TN per rule) and `ADVERSARIAL_DETECTION_AUDIT.md` (a representative adversarial sample) exist instead.
4. **No browser-driven visual UI verification** was performed this session — no browser automation tool was used. Loading states, mobile responsiveness, and visual rendering correctness remain unverified.
5. **No formal CSRF audit** was performed this session (mitigated in practice by `sameSite: 'lax'` cookies, not independently stress-tested).
6. **Dashboard trend badges** (§9) still show static, non-data-backed percentage/status text.
7. **`FIGM-NEXT-02` remediation is PATCH_REJECTED** for its own real positive fixture (`monaco-editor`) — the generated code is correct, real Next.js syntax, but the isolated type checker's real type-mismatch finding against the actual installed package means this specific rule cannot currently report a live `FIXED` outcome for that exact module. Works correctly for other heavy-import modules that don't have this specific type conflict.
8. **This document was silently truncated twice this session** for undetermined reasons (see top of file) — worth investigating if it recurs.

---

## 11. Commands Executed and Results (this round)

```
npx tsc --noEmit          -> 0 errors
npm test                  -> 272/272 passing (+5 new test files this round: quality-score.test.ts,
                              remediation-coverage.test.ts, guideline-traceability-live.test.ts,
                              plus extensions to rule-detection-matrix.test.ts and
                              dashboard-analytics.test.ts)
npm run build              -> PASSED (55 pages, 31 API routes)
npm run research:evaluate  -> F1 90.0%, reproduced
npm run research:validate  -> independently reconciles TP=18/FP=3/FN=1 -> 85.7%/94.7%/90.0%
npm run ci:scan             -> PASSED, 77% quality, 378 violations (self-scan of this app's own
                              source; improved from 383 after the dashboard-repository.ts fixes
                              removed some of its own flagged patterns)
```

---

## 13. Round 3 — This Session: NEXT-02 Root Cause, Dashboard Trend Badges, Live IDOR Testing

Commit this round: `c3235830` (on top of `5cc65f7f`, `13ae0d1d`, `325f1d22`, `e1275c24`).

| ISSUE | ROOT CAUSE | FIX | TEST | PRODUCTION VERIFICATION | STATUS |
|---|---|---|---|---|---|
| `FIGM-NEXT-02` remediation reported `PATCH_REJECTED` for its own positive fixture (`monaco-editor`) | Not a fixture quirk: the fix unconditionally wrapped the heavy import in `next/dynamic`, whose type signature specifically expects a React component. Every one of the rule's real target modules (`monaco-editor`, `chart.js`, `three`, `canvas`, `echarts`, `d3`) is a vanilla JS library, not a component — the strategy was wrong in general. Confirmed the other 4 candidate module names aren't even installed in this repo, which is why only `monaco-editor` (installed transitively via `@monaco-editor/react`, which the app's real live-scan editor UI depends on) exposed the real type conflict | Changed to honestly report `MANUAL_REVIEW_REQUIRED`, with an explanation covering both real strategies (next/dynamic for a component vs. a lazy `import()` inside an effect for a vanilla library) and why the choice can't be inferred from the import line alone | `tests/remediation-coverage.test.ts` updated: `FIGM-NEXT-02` moved into the expected-manual-review set, 26/26 passing | Re-tested the exact live API call before and after deploy: `PATCH_REJECTED` → `MANUAL_REVIEW_REQUIRED`, confirmed live via polling (`check 2 at 07:26:19`) | 🟢 VERIFIED |
| Dashboard showed static, non-data-backed trend badges: `"+100%"` (Total Scans), `"100% Valid"` (AI Fix Suggestions), `"Active"` (Total Projects) | No historical time-series or per-suggestion validity tracking exists anywhere in this codebase's data model — these were purely decorative strings with no real computation behind them | Removed all three (per the "calculate from real data or remove the claim" rule — no replacement number was fabricated) | Visual-only change; no new automated test (see limitation below) | Deployed as part of `c3235830`; **not independently visually confirmed** — no browser automation tool was used this session | ⚪ NOT VISUALLY TESTED (code change confirmed via source diff + build success only) |
| Cross-user data isolation on `/api/scans/[id]` and `/api/export` — previously documented as fixed, but never re-verified with a real two-user test this session | N/A — this was a verification gap, not a defect | N/A — no code change was needed; this was confirmatory testing | N/A | Real two-account live test: User A creates a scan; User B attempts `GET`/`DELETE` on it → both `403 Forbidden`; unauthenticated `GET` → `401`; User B's own `/api/scans` list does not contain User A's scan (list-isolation confirmed); `/api/export` POST as User B → `403`, unauthenticated → `401`, as User A (real owner) → `200` with a real report. All test scans deleted afterward | 🟢 VERIFIED (ownership and isolation genuinely enforced, not merely documented) |

**Note on the visual-only dashboard fix**: per this session's explicit instruction not to claim visual verification without browser tooling, the removal of the three fabricated badges is confirmed at the source/build level (the strings no longer exist in the compiled output) but not confirmed by actually looking at the rendered page. Marked accordingly rather than folded into a blanket "VERIFIED."

---

## 14. Final Status

🟡 **PARTIALLY VERIFIED**

The core system is proven to genuinely work end-to-end in live production with real evidence, now including a real two-account cross-user ownership/IDOR test (not merely documented — actually performed against `/api/scans/[id]` and `/api/export` with real HTTP requests, correctly returning 403/401 in every case, with no data leakage). This session additionally found that `FIGM-NEXT-02`'s remediation was not just failing on an unlucky fixture but was strategically wrong for every one of its real target modules, and removed three dashboard trend badges that had no real data behind them.

It is not 🟢 VERIFIED because real, confirmed gaps remain: no active AI provider, no full exhaustive adversarial fixture matrix, no browser-driven visual verification (including of this round's own dashboard badge removal), no formal CSRF audit, and the underlying parser architecture is still a line/region scanner rather than a real AST (the single largest remaining fidelity risk to every detection claim in this project).
