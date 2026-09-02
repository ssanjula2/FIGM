# FIGM — Synthetic Fix Verification Report

Generated: 2026-08-26T17:23:36.445Z

Companion to `audit/SYNTHETIC-GUIDELINE-COVERAGE-REPORT.md` (detection) and `audit/SYNTHETIC-GUIDELINE-COVERAGE-MATRIX.json` (full machine-readable data). This report covers remediation only: for every rule where the canonical fixture was detected, what `AIRemediationPipeline.remediateDefect` — the exact pipeline `app/api/scan/route.ts`'s `ai-fix`/`fix-figm-rule`/`fix-code-error` action calls — actually did, and whether the fix was re-scanned and confirmed to resolve the original violation.

**A patch is never counted as successful merely because Claude/the deterministic engine returned a response, or because the patch applied syntactically.** Success requires: original violation detected → fix generated → patch applied → re-scan → original violation confirmed gone (`verified: true`, `verificationStatus: "FIXED"`).

---

## Summary

```text
Rules where the canonical fixture was detected: 39
  -> Fix generated, applied, re-scanned, violation CONFIRMED GONE (FIX_VERIFIED): 17
  -> Manual-review-only, never auto-attempted by design: 2
  -> AI remediation BLOCKED by external dependency (Claude account credit balance): 20
  -> Remediation not attempted: violation not detected on the canonical fixture: 11

FIX_FAILED (patch generated and applied, but re-scan still detects the original violation, or an unsafe/unrelated change): 0
```

There were **zero** genuine `FIX_FAILED` outcomes in this run — every deterministic-fix attempt that actually ran either verified correctly, or (when the deterministic fixer declined/failed to verify for this specific bare-canonical-fixture instance) correctly fell through to the AI layer (`src/ai/ai-remediation-pipeline.ts`, Path 3), which was then blocked by the same external Claude billing issue documented in the coverage report — never a fabricated or silently-templated "fix".

---

## Fix Verification Matrix

Values for **Re-scan Result**: the pipeline's own `verificationStatus` (`FIXED` / `PATCH_REJECTED` / `UNRESOLVED` / `MANUAL_REVIEW_REQUIRED`). Values for **Final Classification**: `FIX_VERIFIED` (re-scanned, violation confirmed gone), `AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY`, `MANUAL_REVIEW_REQUIRED`, `SKIPPED_NOT_DETECTED`.

| Rule | Framework Used | Router Decision | Patch Generated | Re-scan Result | Final Classification |
|---|---|---|---|---|---|
| FIGM-PERF-01 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-PERF-02 | React | AST_DETERMINISTIC | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-PERF-03 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-PERF-04 | — | AI_ASSISTED | No | — | SKIPPED_NOT_DETECTED |
| FIGM-PERF-05 | React | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-PERF-06 | React | AST_DETERMINISTIC | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-A11Y-01 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-A11Y-02 | — | AST_DETERMINISTIC | No | — | SKIPPED_NOT_DETECTED |
| FIGM-A11Y-03 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-A11Y-04 | — | AST_DETERMINISTIC | No | — | SKIPPED_NOT_DETECTED |
| FIGM-A11Y-05 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-A11Y-06 | React | AST_DETERMINISTIC | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-NEXT-01 | Next.js | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-NEXT-02 | Next.js | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-NEXT-03 | Next.js | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-NEXT-04 | Next.js | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-01 | React | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-02 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-REACT-03 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-REACT-04 | — | AI_ASSISTED | No | — | SKIPPED_NOT_DETECTED |
| FIGM-ANG-01 | Angular | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-ANG-02 | Angular | AST_DETERMINISTIC | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-ANG-03 | Angular | ANGULAR_TEMPLATE_AST | Yes | FIXED | FIX_VERIFIED |
| FIGM-ANG-04 | Angular | ANGULAR_TEMPLATE_AST | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-ANG-05 | Angular | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-A11Y-07 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-REACT-05 | React | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-06 | — | MANUAL_REVIEW_ONLY | No | — | SKIPPED_NOT_DETECTED |
| FIGM-NEXT-05 | Next.js | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-NEXT-06 | Next.js | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-ANG-06 | Angular | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-VUE-01 | Vue | VUE_AST | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-VUE-02 | Vue | VUE_AST | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-NEXT-07 | Next.js | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-NEXT-08 | Next.js | MANUAL_REVIEW_ONLY | N/A (manual-only) | MANUAL_REVIEW_REQUIRED | MANUAL_REVIEW_REQUIRED |
| FIGM-NEXT-09 | Next.js | MANUAL_REVIEW_ONLY | N/A (manual-only) | MANUAL_REVIEW_REQUIRED | MANUAL_REVIEW_REQUIRED |
| FIGM-NEXT-10 | Next.js | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-VUE-03 | — | VUE_AST | No | — | SKIPPED_NOT_DETECTED |
| FIGM-VUE-04 | — | VUE_AST | No | — | SKIPPED_NOT_DETECTED |
| FIGM-VUE-05 | — | AI_ASSISTED | No | — | SKIPPED_NOT_DETECTED |
| FIGM-VUE-06 | — | AI_ASSISTED | No | — | SKIPPED_NOT_DETECTED |
| FIGM-ANG-07 | — | AI_ASSISTED | No | — | SKIPPED_NOT_DETECTED |
| FIGM-ANG-08 | Angular | ANGULAR_TEMPLATE_AST | Yes | FIXED | FIX_VERIFIED |
| FIGM-ANG-09 | Angular | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |
| FIGM-ANG-10 | Angular | ANGULAR_TEMPLATE_AST | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-07 | React | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-08 | React | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-09 | React | AI_ASSISTED | No (blocked) | UNRESOLVED | AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY |
| FIGM-REACT-10 | — | AST_DETERMINISTIC | No | — | SKIPPED_NOT_DETECTED |
| FIGM-REACT-11 | React | AST_DETERMINISTIC | Yes | FIXED | FIX_VERIFIED |


---

## Rules With No Automatic Fix (MANUAL_REVIEW_ONLY at the rule level)

These are never auto-attempted by any layer, by design — `AIRemediationRouter`'s `MANUAL_REVIEW_ONLY_RULE_IDS` hard guard (`src/ai/ai-remediation-router.ts`), not a per-instance failure:

| Rule | Reason (from AIRemediationRouter) | Detection Result |
|---|---|---|
| FIGM-REACT-06 (Missing Reactive Dependency in Effect Hook) | FIGM-REACT-06 requires cross-file context or carries a runtime-only failure mode this pipeline cannot safely validate even with AI assistance — see MANUAL_REVIEW_ONLY_RULE_IDS. | Not detected on canonical fixture (see Detection Failures) |
| FIGM-NEXT-08 (useSearchParams Without a Suspense Boundary) | FIGM-NEXT-08 requires cross-file context or carries a runtime-only failure mode this pipeline cannot safely validate even with AI assistance — see MANUAL_REVIEW_ONLY_RULE_IDS. | DETECTED |
| FIGM-NEXT-09 (Metadata API Used from an Invalid Client Boundary) | FIGM-NEXT-09 requires cross-file context or carries a runtime-only failure mode this pipeline cannot safely validate even with AI assistance — see MANUAL_REVIEW_ONLY_RULE_IDS. | DETECTED |


Recommended manual action for all three: a human developer makes the change with full context the automated pipeline structurally cannot have (parent-file context for `FIGM-NEXT-08`/`09`, or verified confidence that a new `useEffect` dependency will not introduce an infinite render loop for `FIGM-REACT-06`).

---

## AI-Blocked Remediation — Detection vs. Remediation Separation

Every rule in this section has **VERIFIED detection** — the failure is exclusively in the external Claude API call, confirmed via raw `curl` independent of this codebase (see the coverage report). Per Section 12 of the audit brief, none of these are counted as detection failures:

- **FIGM-PERF-02**
  - Detection: PASS
  - Router decision: `AST_DETERMINISTIC`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-PERF-05**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-PERF-06**
  - Detection: PASS
  - Router decision: `AST_DETERMINISTIC`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-A11Y-06**
  - Detection: PASS
  - Router decision: `AST_DETERMINISTIC`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-NEXT-02**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-NEXT-04**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-REACT-01**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-ANG-01**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-ANG-02**
  - Detection: PASS
  - Router decision: `AST_DETERMINISTIC`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-ANG-04**
  - Detection: PASS
  - Router decision: `ANGULAR_TEMPLATE_AST`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-REACT-05**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-NEXT-05**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-ANG-06**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-VUE-01**
  - Detection: PASS
  - Router decision: `VUE_AST`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-VUE-02**
  - Detection: PASS
  - Router decision: `VUE_AST`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-NEXT-07**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-ANG-10**
  - Detection: PASS
  - Router decision: `ANGULAR_TEMPLATE_AST`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-REACT-07**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-REACT-08**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`
- **FIGM-REACT-09**
  - Detection: PASS
  - Router decision: `AI_ASSISTED`
  - AI Fix: BLOCKED — `Claude API request failed (status 400). Please try again later.`
  - Final: `VERIFIED_DETECTION_ONLY`

---

## Remediation Not Attempted (violation not detected on canonical fixture)

These rules' canonical `nonCompliantExample` did not fire on any tested framework (see the coverage report's Detection Failures section for the full root-cause investigation of each), so `AIRemediationPipeline.remediateDefect` was never invoked — there was no real `DiagnosticReport` to feed it:

- FIGM-PERF-04 (Static Imports in Deferred Execution Paths) — router decision: `AI_ASSISTED`
- FIGM-A11Y-02 (Accessible Name and Role for Custom UI Controls) — router decision: `AST_DETERMINISTIC`
- FIGM-A11Y-04 (Dynamic Focus Containment and Traversal) — router decision: `AST_DETERMINISTIC`
- FIGM-REACT-04 (Wrap Child Callback Props in useCallback) — router decision: `AI_ASSISTED`
- FIGM-REACT-06 (Missing Reactive Dependency in Effect Hook) — router decision: `MANUAL_REVIEW_ONLY`
- FIGM-VUE-03 (Side Effect Inside Computed Getter) — router decision: `VUE_AST`
- FIGM-VUE-04 (Direct Mutation of Computed Result) — router decision: `VUE_AST`
- FIGM-VUE-05 (Direct Prop Mutation) — router decision: `AI_ASSISTED`
- FIGM-VUE-06 (Arrow Function Used as Options API Method) — router decision: `AI_ASSISTED`
- FIGM-ANG-07 (Complex Logic in Angular Component Constructor) — router decision: `AI_ASSISTED`
- FIGM-REACT-10 (Component Function Called Directly Instead of Rendered as JSX) — router decision: `AST_DETERMINISTIC`

---

## Reproducibility

Real, freshly-executed against the current repository:
- `npm test` (1061/1061 pass) before and after the one code change made during this audit (see the coverage report's "Genuine Bug Found and Fixed" section).
- `ANTHROPIC_API_KEY` was live-configured (`.env.local`); every `AI_REMEDIATION_BLOCKED_EXTERNAL_DEPENDENCY` result above is a real HTTP 400 from `api.anthropic.com`, independently reproduced with a raw `curl` request carrying no SDK dependency.
- Nothing in this audit modified real project source files outside the one confirmed-and-reverified bug fix; every fixture scan and remediation attempt operated on in-memory strings only.
