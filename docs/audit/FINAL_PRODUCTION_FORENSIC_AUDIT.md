# FIGM Code Inspector — Final Production Forensic Audit

**Date**: 2026-08-13
**Method**: Zero-trust, live evidence only. Every claim below is backed by a real HTTP request against the live production deployment (`https://figm-code-inspector.vercel.app`), a real local command execution, or a real re-read of source code performed in this session — not by any pre-existing narrative. This file itself was found silently emptied to 2 blank lines partway through this session (a real, unexplained anomaly — see §16) and is being rewritten from scratch with fresh evidence rather than reconstructed from memory.

**Note on scope**: this report documents the *production-verification* pass (deploy → live E2E → DB → metrics → remediation → research-integrity) requested in this session. Deep single-topic detail for work already done in prior sessions (framework detection fixtures, the 25-rule matrix, the adversarial comment/string/multi-line fixes, guideline traceability, human-study provenance, API-endpoint-by-endpoint audit) lives in the sibling documents referenced throughout rather than being re-derived here: `ADVERSARIAL_DETECTION_AUDIT.md`, `RULE_DETECTION_MATRIX.md`, `HUMAN_STUDY_PROVENANCE_AUDIT.md`, `API_ENDPOINT_TRACEABILITY.md`, `GUIDELINE_FORENSIC_TRACEABILITY.md`, `INITIAL_REPOSITORY_FORENSIC_AUDIT.md`.

---

## 1. Executive Summary

| Claim | STATUS | Evidence |
|---|---|---|
| Local fixes reached production | 🟢 VERIFIED | Two commits pushed (`e1275c24`, `325f1d22`); the second was proven live by directly re-testing the exact bug it fixed against the live API and observing the fixed behavior (§2) |
| A brand-new user can register → scan → get real results in all 4 target frameworks | 🟢 VERIFIED | Real HTTP register + 4 real scans (React/Next.js/Angular/Vue) against production, real diagnostics returned (§3) |
| Scans genuinely persist to a real database, owned by the real user | 🟢 VERIFIED | `GET /api/scans` round-trip, real UUIDs/timestamps, ownership match, cleaned up after (§4) |
| Complexity is dynamically computed, not hardcoded | 🟢 VERIFIED | 4/4 controlled McCabe fixtures (CC=1,2,3,4) match exactly; live scan complexity varies with real input (§5) |
| Guideline traceability is clause-level in the live API | 🔴 NOT VERIFIED (confirmed absent) | Every live diagnostic's `standardReference` is a blanket `"ISO 25010"` string, no clause/success-criterion detail (§6) |
| AI-powered remediation is active in production | 🔴 NOT VERIFIED (confirmed absent) | Live response: `engineType: "TEMPLATE_FALLBACK"`, `fallbackReason: "GEMINI_API_KEY environment variable is not configured."` (§7) |
| Remediation actually fixes the violation it's asked to fix | 🟡 PARTIALLY VERIFIED | Found a real bug live (wrong rule's template applied, silently broken keyboard-handler codegen), root-caused, fixed, deployed, and re-verified live — but ~7 of 25 real rule IDs still have no dedicated remediation case and are exposed to the same class of bug (§7) |
| Research metrics (precision/recall/F1) are real and reproducible | 🟢 VERIFIED | TP=18/FP=3/FN=1 independently recomputed to 85.7%/94.7%/90.0% via the raw formulas; `research:evaluate` and `research:validate` agree | 
| Research metrics artifact is free of fabricated data | 🟡 FIXED THIS SESSION | Found and removed two hardcoded, uncomputed dataset claims ("30 open-source benchmark items", "85 simulated developer profiles") from the file also carrying the real automated metrics — the exact "combine automated + human-study-shaped claims" pattern that must never happen (§8) |
| Human study has real participants | 🔴 CONFIRMED 0/85, HONESTLY REPORTED | `research/analysis/usability-results.json`: `validParticipantCount: 0`, `collectionStatus: NOT_COLLECTED` — see `HUMAN_STUDY_PROVENANCE_AUDIT.md` for full detail (unchanged this session) |

---

## 2. Deployment Verification (Phase A)

**Claim**: commit `325f1d22` is live in production.

**Method used, and why**: `/api/health` is statically pre-rendered by Next.js (confirmed: `○ /api/health` in the build output, and no `export const dynamic = 'force-dynamic'` in `app/api/health/route.ts`) and served with `X-Vercel-Cache: HIT`/`Age: N` headers — it is a build-time snapshot, not a live per-request read, so polling it is not a reliable per-deploy freshness signal (this is itself a real finding, see §16). The trustworthy signal used instead: **directly re-executing the exact API call that reproduced a real bug**, before and after the fix was deployed, against the real dynamic (`ƒ`, server-rendered) `/api/scan` endpoint.

**Evidence**:
1. Push 1 (`a3352d25..e1275c24`): confirmed live by polling `/api/health` every 20s and observing the response *schema itself* change (a new `database: "CONNECTED_POSTGRES"` field and `aiRemediation: "TEMPLATE_FALLBACK_ONLY"` value appeared, replacing the old schema's `realtime: "CONNECTED"` field) between two consecutive polls ~24 seconds apart — a structural code change, not a data value change, so it cannot be a caching artifact.
2. Push 2 (`e1275c24..325f1d22`): confirmed live by calling `POST /api/scan` with `action: "ai-fix"` for the exact `FIGM-REACT-02` defect that, before this push, returned `remediatedCode` with the violation untouched and `verificationStatus: "UNRESOLVED"`. After the push, the **same request** returned `remediatedCode` with `key={item.id}` (the violation actually fixed) and `verificationStatus: "FIXED"`. This is only possible if the new `src/engine/remediation-engine.ts` code is running live.

**DEPLOYMENT**
- Commit deployed: `325f1d22` (confirmed via live functional re-test, not inferred)
- Production status: LIVE
- Health status: `HEALTHY` per `/api/health` (see §16 for the static-caching caveat on that endpoint specifically)

---

## 3. Real Production End-to-End Scan — 4 Frameworks (Phase B)

A disposable test account was registered against the live API (`POST /api/auth/register`, real user created, real JWT issued, real Postgres row — `userId` redacted from this report but was captured during the session). All 4 scans below were real `POST /api/scan` calls with `Authorization: Bearer <real JWT>`, deliberately defective code, against the live production endpoint — not pre-generated JSON.

| Framework | Fixture (deliberately defective) | Framework detected | Diagnostics returned | Status |
|---|---|---|---|---|
| React | `items.map((item, index) => <li key={index} onClick={() => handleClick(item)}>...)` | `REACT_JSX` | `FIGM-PERF-05`, `FIGM-REACT-02`, `FIGM-REACT-03` | 🟢 PASS |
| Next.js | `export default async function Page() { return <div>Data</div>; }` at `app/feed/page.tsx` | `NEXT_JS` | `FIGM-NEXT-03` (missing `export const revalidate`) | 🟢 PASS |
| Angular | `@Component({...}) class TestComponent { ngOnInit() { this.service.getStream().subscribe(); } }` | `ANGULAR_TEMPLATE` | `FIGM-ANG-01` (unsubscribed observable), `FIGM-ANG-02` (missing OnPush) | 🟢 PASS |
| Vue | `<template><div v-on:click="handleClick">Click me</div></template>...` | `VUE_SFC` | `FIGM-A11Y-01` | 🟢 PASS |

All 4 responses included real `location.start/end.line/column`, `offendingCodeSnippet` matching the actual submitted source, `remediation` text, and `confidenceScore` — not placeholder values.

**REAL E2E SCAN**
- React: 🟢 PASS — real diagnostics, real framework detection
- Next.js: 🟢 PASS — real diagnostics, real framework detection
- Angular: 🟢 PASS — real diagnostics, real framework detection
- Vue: 🟢 PASS — real diagnostics, real framework detection (using the `v-on:click` explicit form — see §16 for a documented, not-yet-verified gap in the `@click` shorthand form)

---

## 4. Database Integrity (Phase C)

After the 4 scans above, `GET /api/scans` (same Bearer token) returned exactly 4 records:

| fileName | framework | userId matches test user | ruleCount matches live diagnostics count | createdAt |
|---|---|:---:|:---:|---|
| List.jsx | REACT_JSX | ✅ | ✅ (3) | real timestamp |
| app/feed/page.tsx | NEXT_JS | ✅ | ✅ (1) | real timestamp |
| test.component.ts | ANGULAR_TEMPLATE | ✅ | ✅ (2) | real timestamp |
| Widget.vue | VUE_SFC | ✅ | ✅ (1) | real timestamp |

All 4 IDs are real Postgres-generated UUIDs (not sequential, not pre-set). All 4 were deleted via `DELETE /api/scans/[id]` after verification (all returned `HTTP 200`); a final `GET /api/scans` confirmed `total: 0` remaining for the test user. The disposable test **user account** itself was not deleted (no self-service account-deletion endpoint was exercised/confirmed to exist) — a single harmless leftover row, no scan data attached.

**DATABASE**
- Persistence: 🟢 VERIFIED — all 4 scans genuinely wrote to Postgres
- Ownership: 🟢 VERIFIED — every record's `userId` matches the authenticated caller
- Retrieval: 🟢 VERIFIED — `ruleCount` on each persisted record exactly matches the live diagnostics count for that scan

**Genuine finding, not fixed this session**: the React scan's *live* response reported `qualityScore: 74`, but the *persisted* history record for the same scan reported `qualityScore: 88`. Root cause: `app/api/scan/route.ts` computes its own quality score for persistence (`100 - (totalErrors*5 + totalWarnings*2)`) using a different, cruder formula than `RuleExecutionEngine`'s own weighted-severity score shown in the live response. Two disagreeing "quality score" numbers for the same scan is a real, user-visible inconsistency. Documented in §16, not fixed (out of this session's time budget).

---

## 5. Complexity Verification (Phase D)

**Independent verification against controlled fixtures with mathematically known cyclomatic complexity** (McCabe: V(G) = 1 + decision points), run through the live-deployed engine's code locally:

| Fixture | Expected CC | Actual CC | Result |
|---|:---:|:---:|:---:|
| No branches | 1 | 1 | ✅ MATCH |
| Single `if` | 2 | 2 | ✅ MATCH |
| Nested `if` | 3 | 3 | ✅ MATCH |
| `if` + `for` + `while` | 4 | 4 | ✅ MATCH |

**Live production trace**: the React fixture in §3 (a single line of code) returned `complexity: { linesOfCode: 1, cyclomaticComplexity: 1, functionCount: 1, ... }` — consistent with its actual 1-line input, not a fixed/hardcoded number. The full pipeline trace (uploaded source → `SourceParser` → `ComplexityEngine` → `RuleExecutionEngine.analyzeFile` → API JSON response → would be persisted/displayed) was confirmed structurally in prior sessions (`CODE_COMPLEXITY_FORENSIC_AUDIT.md`) and re-confirmed live here via the real API response shape.

**COMPLEXITY**
- Dynamic: 🟢 VERIFIED
- Independently verified: 🟢 VERIFIED (4/4 controlled fixtures)

---

## 6. Guideline Traceability (Phase E)

Every diagnostic returned by the live `/api/scan` endpoint includes `ruleId`, `ruleName`, `domain`, `concern`, `severity`, `location`, `offendingCodeSnippet`, `remediation`, `standardReference`, `confidenceScore`, and `evidence`. Real example from the live React scan (§3):

```json
{
  "ruleId": "FIGM-REACT-02",
  "domain": "PERFORMANCE",
  "concern": "LAYOUT_INSTABILITY",
  "severity": "HIGH",
  "standardReference": "ISO 25010",
  "confidenceScore": 96
}
```

Every diagnostic across all 4 live scans returned `standardReference: "ISO 25010"` — a blanket, domain-level reference. No clause-level or success-criterion-level detail (e.g. no WCAG SC number for the Vue `FIGM-A11Y-01` accessibility violation) was present in the live response. This confirms, against the live currently-deployed API rather than by inference, the finding already documented in `GUIDELINE_FORENSIC_TRACEABILITY.md`: richer clause-level mappings may exist as disconnected source-level metadata, but the live API does not expose them.

**GUIDELINES**
- Rule mapping: 🟢 VERIFIED (ruleId/domain/severity/remediation present and correct on every diagnostic)
- Clause-level live traceability: 🔴 NOT PRESENT (confirmed absent in the live response, not merely undocumented)

---

## 7. AI Remediation (Phase F)

**Live production response** to `POST /api/scan` with `action: "ai-fix"`:

```json
{
  "engineType": "TEMPLATE_FALLBACK",
  "fallbackReason": "GEMINI_API_KEY environment variable is not configured.",
  "confidenceScore": 40
}
```

Production has **no active AI provider**. All remediation in production is deterministic template-based fallback. This must not be described as "AI-powered remediation" while `GEMINI_API_KEY` is unset in the production environment.

**A real bug was found and fixed via this live test**, not by unit tests:

- **Before**: requesting a fix for a real, live `FIGM-REACT-02` violation (`key={index}`) returned `remediatedCode` with the array-index key **untouched**, and instead added unrelated ARIA attributes (`role="button"`, `tabIndex={0}`, a broken `onKeyDown`) — because `FIGM-REACT-02` had no dedicated case in `RemediationEngine.applyQuickFix`'s switch statement and silently fell through to a generic "universal pattern" fallback that pattern-matches the snippet's superficial shape (it saw `<li` + `onClick=` and assumed an accessibility violation). The system's own re-scan check correctly caught this and reported `verified: false, verificationStatus: "UNRESOLVED"` — an honest signal, not a false success claim, but the underlying remediation was still wrong.
- **Also found**: the generated `onKeyDown` handler called the captured `onClick` value as `$1()` with no wrapping parens. Since the real-world `onClick` value is routinely an arrow function (`() => handleClick(item)`), operator precedence turns `() => handleClick(item)()` into an arrow function whose *body* is `handleClick(item)()` — defining a function and never calling it, a silent no-op. This existed in the dedicated `FIGM-A11Y-01` case too, not just the misfired fallback.
- **Root-caused, fixed, deployed, and re-verified live** (§2): the same request that returned `UNRESOLVED` before now returns `remediatedCode` with `key={item.id}` and `verified: true, verificationStatus: "FIXED"`. Two new regression tests (`tests/ai-remediation.test.ts`) actually *execute* the generated handler code (not just assert on the string) to prove both syntactic validity and that it calls the right function with the right argument.

**Not fixed this session (documented, found via source review, not independently live-tested)**: `remediation-engine.ts` still contains dead cases referencing rule IDs that do not exist in the live 25-rule engine (`FIGM-REACT-05`, `FIGM-ANGULAR-01`, `FIGM-ANGULAR-02` — the real IDs are `FIGM-ANG-01..05`), and several real rule IDs still have **no dedicated remediation case at all** (`FIGM-A11Y-05`, `FIGM-A11Y-06`, `FIGM-NEXT-03`, `FIGM-REACT-04`, `FIGM-ANG-03`, `FIGM-ANG-04`, `FIGM-ANG-05`) — every one of these is exposed to the same class of "wrong template silently misfires" bug that `FIGM-REACT-02` just proved live. Separately, `FIGM-REACT-01`'s remediation case fixes `key={Math.random()}`, but the *live* `FIGM-REACT-01` rule actually means "expensive derived computation without useMemo" (`.sort()`/`.filter()`/`.reduce()` in render without memoization) — a mismatched rule-taxonomy remnant, also not fixed this session.

**REMEDIATION**
- Actual code change: 🟢 VERIFIED for the case tested and fixed (`FIGM-REACT-02`)
- Re-scan: 🟢 VERIFIED — the engine's own `verified`/`verificationStatus` fields correctly distinguish fixed vs. unresolved, live-observed both states
- AI provider: 🔴 NOT ACTIVE (`GEMINI_API_KEY` not configured in production)
- Fallback: 🟡 TEMPLATE/DETERMINISTIC — correctly self-reported as such by the API (`engineType: "TEMPLATE_FALLBACK"`), not silently mislabeled as AI

---

## 8. Research Metrics (Phase G)

`npm run research:evaluate` and `npm run research:validate` were run fresh in this session.

```
True Positives (TP): 18
False Positives (FP): 3
False Negatives (FN): 1
Precision: 85.7%
Recall: 94.7%
F1-Score: 90.0%
```

**Independently recomputed from the raw TP/FP/FN** (not accepted as given):
- Precision = 18 / (18+3) = 18/21 = 0.85714... = **85.7%** ✅ matches
- Recall = 18 / (18+1) = 18/19 = 0.94737... = **94.7%** ✅ matches
- F1 = 2×P×R / (P+R) = 2×0.85714×0.94737 / (0.85714+0.94737) = **0.9000** = **90.0%** ✅ matches

`research:validate` independently reconciles the same numbers via its own separate script.

**Provenance**: `docs/evidence/canonical-evaluation.json`, `provenance.groundTruth = benchmarks/ground-truth.json`, `provenance.testbed = benchmarks/testbed`, `provenance.dynamic = true`, `provenance.executionMode = AUTOMATED_DYNAMIC_EVALUATION`. This is a 4-fixture-file, 147-LOC hand-labeled ground truth — an automated benchmark, not a repository-scale or human-participant evaluation.

**Research-integrity bug found and fixed this session**: the same `canonical-evaluation.json` — marked `evidenceStatus: "CANONICAL_GROUND_TRUTH_VERIFIED"` and feeding the LaTeX dissertation exporter — previously carried a `datasetClassification` block with two hardcoded string literals **not derived from any actual computation**: `"repositoryDataset": "30 representative open-source framework architecture benchmark items"` and `"userStudy": "Representative evaluation survey scoring vector model (85 simulated developer profiles)"`. Neither dataset was used to compute the real 18/3/1 numbers in the same file — this is precisely the "combine automated benchmark metrics with human-study-shaped claims" pattern this audit was explicitly told never to allow. **Fixed**: removed both fields; the artifact now states `metricType: "AUTOMATED_BENCHMARK_METRICS_ONLY"`, `humanStudyIncluded: false`, and points to `research/analysis/usability-results.json` as the sole source of truth for real human-participant status. Verified nothing else in the codebase reads the removed fields (`grep` confirmed zero consumers) before removing them.

**RESEARCH METRICS**
- TP: 18
- FP: 3
- FN: 1
- Precision: 85.7% (independently recomputed)
- Recall: 94.7% (independently recomputed)
- F1: 90.0% (independently recomputed)
- Human participants: **0 / 85 real** — `collectionStatus: NOT_COLLECTED` (see `HUMAN_STUDY_PROVENANCE_AUDIT.md`). These are AUTOMATED BENCHMARK METRICS only; they must never be read as human-study results, and the artifact that reports them no longer contains language that could be misread that way.

---

## 9. Production Build & Test Verification

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm test` | **235/235 passing** (61 suites; includes 2 new regression tests added this session that execute generated remediation code, not just assert on strings) |
| `npm run build` | ✅ PASSED (55 pages, 31 API routes) — one transient `ENOENT`/"Failed to collect page data" failure was observed on a first attempt and did **not** reproduce on an immediate retry with identical code, consistent with a local Windows file-lock flake rather than a code defect; noted honestly rather than silently ignored |
| `npm run research:evaluate` | F1 90.0%, reproduced |
| `npm run research:validate` | Independently reconciles the same TP/FP/FN/P/R/F1 |
| `npm run ci:scan` | ✅ PASSED, 76% quality, 378 violations (self-scan of this app's own `app/`+`src/`, unchanged by this session's remediation/research-integrity fixes) |

---

## 10. Remaining Issues (real, found this session)

**Fixed and deployed live**:
1. `FIGM-REACT-02` had no remediation case and silently misfired the A11Y "clickable element" template — fixed, deployed (`325f1d22`), re-verified live.
2. The `onKeyDown` keyboard-handler codegen (`FIGM-A11Y-01` case and the generic fallback's JSX branch) was a silent no-op whenever the captured `onClick` value was an arrow function — fixed, deployed, verified both syntactically and semantically via a real regression test that executes the generated code.
3. The Angular-template branch of the generic remediation fallback referenced a nonexistent regex capture group (injecting an empty `(keydown.enter)=""`) and double-invoked the click handler (`doSomething()()`) — fixed alongside #2 (found via source review while fixing #2, not independently live-tested against a real Angular `(click)=` violation).
4. `docs/evidence/canonical-evaluation.json` embedded two fabricated, uncomputed dataset claims ("30 open-source benchmark items", "85 simulated developer profiles") inside a file also carrying real automated metrics — removed.

**Found, documented, NOT fixed this session** (time/scope):
5. Two disagreeing quality-score formulas for the same scan: the live `/api/scan` response (weighted-severity formula) vs. the persisted scan-history record (`totalErrors*5 + totalWarnings*2` formula in `app/api/scan/route.ts`) — a real, user-visible inconsistency (§4).
6. `app/api/health/route.ts` has no `export const dynamic = 'force-dynamic'`, so Next.js statically pre-renders it — its reported memory/uptime/service-status figures are a build-time snapshot, not truly live per-request data, despite being genuinely-measured (not fabricated) values at the time they were baked in. Misleading for anyone using this endpoint as a live health monitor.
7. `remediation-engine.ts` has dead cases for rule IDs that don't exist in the live engine (`FIGM-REACT-05`, `FIGM-ANGULAR-01/02`) and no case at all for 7 real rule IDs (`FIGM-A11Y-05/06`, `FIGM-NEXT-03`, `FIGM-REACT-04`, `FIGM-ANG-03/04/05`) — all exposed to the same "wrong-template misfire" bug class just proven live for `FIGM-REACT-02`.
8. `FIGM-REACT-01`'s remediation case targets `key={Math.random()}`, but the live `FIGM-REACT-01` rule actually flags missing `useMemo` on expensive derived computations — a mismatched rule-taxonomy remnant.
9. Vue's `@click` shorthand directive was not tested live (only the explicit `v-on:click` form, which is confirmed recognized); a source read of the `FIGM-A11Y-01` trigger condition suggests `@click` shorthand may not be recognized — flagged as an unverified likely gap, not confirmed.
10. This file (`FINAL_PRODUCTION_FORENSIC_AUDIT.md`) was found silently truncated to 2 blank lines partway through this session, for reasons not determined (possibly an IDE/extension interaction) — no other file in `docs/audit/` was affected. Worth being aware of if working in this environment.

**Not performed this session** (unchanged from prior sessions' documented scope limits): the full 100+-fixture exhaustive per-rule matrix, browser-driven visual UI verification (no browser automation tool used this session), formal CSRF/file-upload-limit re-sweep, a real parser-architecture migration decision.

---

## 11. Final Status

🟡 **PARTIALLY VERIFIED**

The core system is proven to genuinely work end-to-end in live production, with real evidence, not narrative: a brand-new user can register, submit real defective code in all 4 target frameworks (React, Next.js, Angular, Vue), receive real framework-specific diagnostics with correct line/column/severity/guideline metadata, have the scan genuinely persist to Postgres under correct ownership, and — for at least the one rule live-tested end-to-end — have a real violation actually fixed by remediation with honest re-scan verification. Two real, previously-unknown bugs were found by this live testing (not by unit tests), root-caused, fixed, deployed, and re-verified live, along with a real research-integrity violation (fabricated dataset claims inside a "canonical" evidence artifact) found and corrected.

It is not 🟢 VERIFIED because real, confirmed gaps remain: no clause-level guideline traceability in the live API, no active AI provider in production, ~7 of 25 real rules with no dedicated remediation case (each exposed to the same bug class just proven live for one of them), a live quality-score inconsistency between the scan response and its own persisted record, and a statically-cached health endpoint that cannot serve as a real live-monitoring signal.

---

## Appendix: Commands Executed This Session

```
npx tsc --noEmit
npm test
npm run build
npm run research:evaluate
npm run research:validate
npm run ci:scan
git commit / git push (×2, e1275c24 and 325f1d22)
curl -X POST .../api/auth/register (real production account)
curl -X POST .../api/scan (×4 frameworks + 2 ai-fix calls, real production)
curl .../api/scans (persistence verification, real production)
curl -X DELETE .../api/scans/[id] (×4, cleanup, real production)
curl .../api/health (×N, deployment polling, real production)
```
