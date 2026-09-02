# FIGM Final Pre-Data-Collection Readiness Report

Date: 2026-09-02
Repository: figm-model (main branch)
Pre-session HEAD: `7d8c41faef857cd9818b23332cf488e6d4287a85`
Working tree at report time: DIRTY — 189 uncommitted changes (165 pre-existing at session start,
plus this session's own edits/additions), none yet committed or tagged. This report describes the
current *working-tree* state, not a frozen commit — freezing is Step 24/Action 1 of the roadmap in
`research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md` and has deliberately not been done yet, since
several open items (real-world repo scaling, expert annotation, ethics confirmation) require human
action first.

Status values used throughout: `VERIFIED`, `IMPLEMENTED`, `PARTIAL`, `MISSING`, `NOT_TESTED`,
`NOT_APPLICABLE`, `HUMAN_CONFIRMATION_REQUIRED`, `BLOCKED`.

---

## 1. Executive Summary

Starting from the audited `FUNCTIONAL_RESEARCH_PROTOTYPE` baseline
(`research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md`), this session closed all five P0
pre-data-collection blockers that code alone could close: the uncommitted Vue AST upgrade was
verified and landed (with corrected registry documentation), the human-study participant target
was synchronized from a stale 85 to the supervisor-directed 20 across one new canonical constant
and every consumer, server-side consent gating was implemented and tested, the silent
study-data-loss risk in the participant UI was fixed with a retry path, and privacy-safe GA4
analytics was implemented with a dedicated payload-safety test suite. `npm test` (1272/1272) and
`npm run build` both pass, independently re-verified after every change, including a genuine build
failure this session found and fixed (a Next.js route-export-shape violation introduced by an
earlier edit). Two previously-documented real-world false-positive classes (FIGM-REACT-01,
FIGM-REACT-03) were found to already be fixed in the working tree and are now correctly documented
as such rather than left as open limitations.

What remains is exactly what code cannot fabricate: institutional ethics/consent approval
confirmation, real participant recruitment, real independent expert annotation, and scaling the
real-world repository corpus from 15 toward the ~20-30 target. None of these were simulated,
generated, or invented this session.

---

## 2. Repository Snapshot

- Branch: `main`
- Pre-session HEAD: `7d8c41faef857cd9818b23332cf488e6d4287a85`
- Working tree: DIRTY, 189 changes (see Section 3/4 for full classification)
- `npm test`: **1272/1272 passing**, 0 failed, 0 cancelled, 0 skipped (re-verified this session,
  Section 23)
- `npm run build`: **PASS**, exit code 0 (re-verified this session after fixing a real build
  failure this session introduced and caught, Section 24)
- `npx tsc --noEmit`: clean, no output

---

## 3. Changes Reviewed

All 165 pre-existing uncommitted changes present at session start were classified in
`research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md` (Section 1: repository forensic snapshot) as
legitimate implementation, generated evidence, or documentation -- zero temporary/debug files,
zero suspicious/unrelated changes, zero secrets found in the full diff (verified by direct grep
against real secret-shaped patterns; the one match found was a documentation placeholder
`sk-ant-api03-...` example string, not a real key).

---

## 4. Changes Implemented This Session

### Landed (previously uncommitted, now verified correct)
- **Vue template-AST upgrade** (`src/ast/vue-template-ast-builder.ts`, wiring in
  `src/ast/real-syntax-node-builder.ts`): re-verified via standalone test run (23/23 in
  `tests/vue-template-ast-detection.test.ts` + `tests/vue-fix-engine.test.ts`) before landing.
  FIGM-VUE-01/02 upgraded from `LEGACY_TEXT_HEURISTIC` to `REAL_AST`; all 6/6 Vue rules are now
  real-AST-backed.
- Two already-fixed real-world false-positive classes (FIGM-REACT-01's non-array-receiver misfire,
  e.g. `Vue.filter(...)`; FIGM-REACT-03's non-React-property-assignment misfire) confirmed present
  and correct in `src/ast/real-syntax-node-builder.ts` (`isLikelyNonArrayNamespaceReceiver`,
  `isProvableStateTarget`) -- documented as fixed rather than left as open limitations.

### New this session
- `src/research/research-config.ts` -- single canonical source for
  `HUMAN_STUDY_TARGET_PARTICIPANTS` (20), `CONSENT_PROTOCOL_VERSION`, and
  `RESEARCH_ARTIFACT_VERSIONS` (Section 22).
- `src/auth/study-session.ts` -- shared `STUDY_COOKIE` constant (extracted after this session's own
  build-failure fix, Section 24).
- `app/api/user-study/consent/route.ts` -- new endpoint; records consent inside the signed,
  anonymous session token (no new PII/database column).
- `src/lib/analytics.ts`, `app/components/GoogleAnalytics.tsx` -- privacy-safe GA4 implementation.
- `docs/research/AI_CONFIGURATION_FREEZE.md` -- frozen AI provider/model configuration record.
- `tests/analytics-payload-safety.test.ts` -- GA4 payload-safety regression guard (5 tests).
- Extended `src/auth/auth-service.ts`'s `signResearchParticipantToken`/`verifyResearchParticipantToken`
  with a `consentGiven`/`consentVersion`/`consentTimestamp` claim.

### Modified
- `src/matrix/four-layer-meta-model.ts` -- corrected FIGM-VUE-01/02 `knownLimitation` text to
  reflect the real-AST upgrade (was still describing the pre-upgrade legacy-heuristic state).
- `app/api/user-study/log-scan/route.ts` -- added server-side consent-gate check (403 if
  `consentGiven !== true`).
- `app/user-study/page.tsx` -- consent UI (checkbox + confirm button gating the scan button),
  awaited (not fire-and-forget) study-data persistence with a visible retry path on failure,
  session-fetch error surfacing, GA4 task-event tracking.
- `app/live-scan/page.tsx`, `app/ai-fix/page.tsx` -- GA4 scan/fix event tracking.
- `app/components/dashboard/LiveDashboardContent.tsx` -- removed a `|| 10` fallback and hardcoded
  `40%` bar width that rendered a plausible-looking fake number/proportion whenever the real
  framework-distribution value was 0/undefined; now shows honest zero and a real proportional
  width.
- `app/layout.tsx` -- mounts `GoogleAnalytics`.
- Participant-target constant wired into 8 consumer files (`app/admin/page.tsx`,
  `app/analytics/page.tsx`, `app/api/research-metrics/route.ts`,
  `app/components/landing/ResearchOverview.tsx`, `app/user-study/page.tsx`,
  `scripts/import-user-study.ts`, `scripts/user-study-status.ts`,
  `src/engine/participant-repository.ts`), plus `src/eval/thesis-gap-exporter.ts` and
  `src/docs/dissertation-exporter.ts` reading the new constant.
- Documentation synchronized to the 20-participant target: `research/CONSENT_FORM.md`,
  `PARTICIPANT_INSTRUCTIONS.md`, `QUESTIONNAIRE.md`, `research/user-study/README.md`,
  `research/user-study/CreateGoogleForm.gs`, `research/DATA_COLLECTION_PROTOCOL.md`,
  `research/README.md` (with an explicit note that the separate synthetic pipeline-test N=85 is
  intentionally unrelated and left unchanged), `VIVA_PREPARATION_GUIDE.md`,
  `RESEARCH_TRACEABILITY_MATRIX.md`, `docs/dissertation/chapter1_introduction.md`,
  `chapter2_literature_review.md`, `chapter6_conclusion.md` (hand-authored files, edited directly);
  `chapter5_evaluation.tex` and `chapter6_user_study_and_validity.md` regenerated via their real
  exporters rather than hand-edited.
- `benchmarks/ground-truth.json` -- corrected the stale `ruleCoverageNote` prose (previously said
  FIGM-VUE-01/02 "remain LEGACY_TEXT_HEURISTIC").
- `benchmarks/real-world/SPOT_CHECK.md` -- added a correction section documenting that both
  identified false-positive classes are now fixed, with file/line evidence, and explicitly marking
  its own 72%/39% accuracy figures as stale pending a fresh re-scan.
- `.env.example`, `ENV_VARIABLES.md` -- documented `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- `figm-spec.json`, `docs/evidence/canonical-evaluation.json`, `docs/reports/*`,
  `public/eval-results/*`, `benchmarks/eval-summary.json`, `benchmarks/benchmark-results.{csv,md}`,
  `benchmarks/latex-tables.tex`, `docs/dissertation/chapter5_evaluation.tex` -- regenerated via
  `node --import tsx src/matrix/export-spec.ts` and `node --import tsx src/eval/evaluation-runner.ts`
  / `node --import tsx src/docs/dissertation-exporter.ts` after the Vue-AST and rule-registry
  corrections, not hand-edited.
- `research/analysis/usability-results.json` -- regenerated via the real
  `processUserStudyPipeline()` (no real CSV exists, so this remains the honest `NOT_COLLECTED`
  baseline, now with `targetSampleSize: 20`).
- Test-file updates required by the above (consent-gate now a prerequisite; stale `85`-based
  assertions corrected to derive from the new constant): `tests/anti-hardcoding-guard.test.ts`,
  `tests/participant-provisioning-race.test.ts`, `tests/admin-research-dashboard.test.ts`,
  `tests/user-study-canonical-path.test.ts`, `tests/participant-matrix-n-plus-1.test.ts`.
- `package.json` -- registered `tests/analytics-payload-safety.test.ts` in the `test` script.

### Explicitly NOT changed
- No test was weakened, skipped, or deleted to make it pass -- every test-file change either added
  a required consent step to an existing flow or corrected a literal that was factually wrong after
  the (legitimate, supervisor-directed) target change.
- No rule detection semantics were changed beyond the two already-present-but-uncommitted
  false-positive fixes reviewed and landed (Section 4, "Landed").
- No `.env`/`.env.local` file was modified. No secret value was read, printed, or committed.
- No real or simulated participant/expert-annotation data was created.

---

## 5. Canonical Rule Status

**STATUS: VERIFIED, 50/50, all real-AST**

Evidence: `src/matrix/four-layer-meta-model.ts` (direct count), `figm-spec.json` regenerated this
session (`Total Core Rules in Matrix: 50`), `docs/evidence/canonical-evaluation.json` regenerated
this session (`ruleCoverage.totalFigmRules: 50`, `rulesWithGroundTruth: 50`, `uncoveredRuleIds: []`).
Detection mechanism: 50/50 real-AST as of this session (FIGM-VUE-01/02 upgraded from
`LEGACY_TEXT_HEURISTIC`, Section 4). No rule count or semantics were changed beyond the two
already-queued corrections.

---

## 6. Framework Coverage

No change from the prior audit's Section 7/13-16 findings: React/Next.js/Angular **FULL**
(primary), Vue **PARTIAL** (additional support -- now with full real-AST detection parity on all 6
rules, still correctly excluded from the primary research sample per scope), Generic JS/TS
**PARTIAL** (fallback baseline). Re-verified via the same full test run (1272/1272).

---

## 7. Vue Upgrade Decision

**LANDED.** Command: `node --import tsx --import ./tests/test-env-setup.mjs --test
tests/vue-template-ast-detection.test.ts tests/vue-fix-engine.test.ts` -- OBSERVED: 23/23 pass,
standalone, before landing. The wiring in `real-syntax-node-builder.ts`'s main entry point
(`framework === 'VUE_SFC'` branch, combining `buildVueScriptRealSyntaxNodes` +
`buildVueTemplateRealSyntaxNodes`) and the rule predicates in `ast-detection-engine.ts`
(`evalVue01`/`evalVue02` checking `node.attributes?.isVForUnstableKey`/`isVForWithVIf`) were traced
end-to-end and confirmed consistent. `four-layer-meta-model.ts`'s `knownLimitation` text and
`benchmarks/ground-truth.json`'s `ruleCoverageNote` were corrected to match. Regenerated
`figm-spec.json`/`docs/evidence/canonical-evaluation.json` confirm TP=65, FP=0, FN=0 unchanged
(no regression on the controlled benchmark from this change).

---

## 8. Participant Target Synchronization

**STATUS: VERIFIED, 20**

Single canonical source: `src/research/research-config.ts`'s `HUMAN_STUDY_TARGET_PARTICIPANTS = 20`.
Regression guard: `tests/anti-hardcoding-guard.test.ts` (2 new tests) asserts the constant equals
20, that `src/engine/participant-repository.ts`'s `TARGET_PARTICIPANT_COUNT` re-exports it (not an
independent literal), and that no listed consumer file still contains a stale `85`-as-target
pattern. Command: `node --import tsx --import ./tests/test-env-setup.mjs --test
tests/anti-hardcoding-guard.test.ts` -- OBSERVED: 12/12 pass. A manual final sweep grep (Section
4's file list, all `85` occurrences repo-wide excluding Cronbach's-alpha/percentage/color-code/
commit-SHA/historical-audit-log false positives) found zero remaining live participant-target
references. The intentionally-unrelated Synthetic Usability Model (`src/eval/research-data-pipeline.ts`,
N=85 pipeline-test vectors) was deliberately left unchanged and is now explicitly documented as
such in `research/README.md` and `src/research/research-config.ts`'s own doc comment.

`research/analysis/usability-results.json` regenerated: `targetSampleSize: 20`,
`validParticipantCount: 0` (unchanged -- see Section 12 for why this must stay 0).

---

## 9. Consent Enforcement

**STATUS: IMPLEMENTED, server-verifiable**

Design: consent state (`given`, `version`, `timestamp`) is signed into the same anonymous,
httpOnly, single-participant-scoped session token GET `/api/user-study/log-scan` already issues --
no new PII or database column. `POST /api/user-study/consent` (new) is the only endpoint that
re-signs a token with `consentGiven: true`; `POST /api/user-study/log-scan` independently checks
`verified.consentGiven` and returns 403 if false, before any study interaction is processed or
persisted.

Test evidence: `tests/anti-hardcoding-guard.test.ts` and `tests/participant-provisioning-race.test.ts`
were both updated to call the consent endpoint before their log-scan assertions (previously
implicitly relying on no consent check existing); both pass. Command:
`node --import tsx --import ./tests/test-env-setup.mjs --test tests/anti-hardcoding-guard.test.ts
tests/participant-provisioning-race.test.ts tests/admin-research-dashboard.test.ts` -- OBSERVED:
44/44 pass.

**Explicit limitation, not fabricated as resolved:** this endpoint enforces that no study
interaction is *logged* without consent. It does NOT and cannot establish that required
institutional ethics/consent approval for the study itself has been obtained -- see Section 27.

---

## 10. Participant Logging Reliability

**STATUS: FIXED**

`app/user-study/page.tsx`'s `handleRunScan` now `await`s the `/api/user-study/log-scan` POST
(previously fire-and-forget with `.catch(() => {})`) and tracks a `logScanStatus` state
(`idle`/`pending`/`recorded`/`failed`). A failed write renders a visible, explicit warning ("this
task result was not saved") with a "Retry Saving Result" button
(`handleRetryLogScan`) rather than silently proceeding as if the task were recorded. The initial
session-assignment `fetch` and the `?fresh=1` re-assignment fetch likewise now surface failures via
a `sessionError` banner instead of a silent `.catch(() => {})`.

Not independently browser-tested this session (no live deployment, Section 24) -- verified by code
inspection and the existing automated test suite's coverage of the underlying API contract, not by
a manual failure-injection click-through. Recommended before real collection: one manual browser
test with the network tab set to fail the log-scan request, confirming the retry UI appears and a
successful retry records exactly once (Action list, Section 28).

---

## 11. GA4 Implementation

**STATUS: IMPLEMENTED**

- Loader: `app/components/GoogleAnalytics.tsx`, mounted in `app/layout.tsx`. Renders nothing (no
  script tags, no page-view call) when `GA_ENABLED` is false.
- `GA_ENABLED = GA_MEASUREMENT_ID.length > 0 && process.env.NODE_ENV === 'production'` -- disabled
  in development/test regardless of whether a measurement ID happens to be configured locally, so
  local runs (including this session's own test/build runs) never send real events.
- Env var: `NEXT_PUBLIC_GA_MEASUREMENT_ID`, documented in `.env.example` and `ENV_VARIABLES.md`,
  OPTIONAL, app functions identically unset.
- Events implemented: `page_view` (automatic on route change via `usePathname`), `scan_started`/
  `scan_completed` (`app/live-scan/page.tsx`), `fix_applied`/`fix_verified`/`fix_rejected`
  (`app/ai-fix/page.tsx`), `user_study_task_started`/`user_study_task_completed`
  (`app/user-study/page.tsx`).
- No measurement ID was hardcoded (`.env.example` ships the placeholder `G-XXXXXXXXXX`).

Verified this session: `npm run build` succeeds with `GoogleAnalytics` compiled into every route
(confirmed in the build's own route table); `NODE_ENV` is not `production` during `npm test`/local
`npm run build`, so no live event was ever sent during this session's own verification runs.
**Not independently verified against a real GA4 property this session** (would require a real
measurement ID and a live deployment) -- see Section 24.

---

## 12. GA4 Privacy Review

**STATUS: VERIFIED by dedicated test suite**

`tests/analytics-payload-safety.test.ts` (5 tests, all passing):
1. `src/lib/analytics.ts` (comments stripped before scanning) contains no reference to
   `sourceCode`/`codeContent`/`patchContent`/`email`/`fullName`/`password`/`jwt`/`cookie`/`apiKey`/
   `accessToken`/`refreshToken` as an actual code identifier.
2. Every exported `track*` function has a closed, explicitly-named parameter type -- none accepts
   an open `Record<string, ...>` or `[key: string]`-indexed object that could pass through an
   arbitrary field.
3. `window.gtag('event', ...)` is called from exactly one place (the internal `send()` helper) --
   no `track*` function bypasses it.
4. `GA_ENABLED` requires both a configured measurement ID and `NODE_ENV === 'production'`.
5. The loader component renders nothing when GA is not configured.

This is a structural guarantee (the type system has no slot for a forbidden field), not merely a
runtime check -- verified by direct source inspection during test authorship, not assumed.

---

## 13. RQ1 Runtime Experiment Readiness

**STATUS: RQ1_EXPERIMENT_INFRASTRUCTURE NOT BUILT — NOT ATTEMPTED THIS SESSION**

Per the master prompt's own instruction, this is flagged rather than attempted: no authoritative
research document in this repository specifies the exact RQ1 experimental factors (which rendering
strategies, which state-management libraries, which browser/hardware/network profile, repetition
count). Building real Web Vitals measurement infrastructure (Lighthouse/Playwright-based) without
those factors defined would mean inventing the research design, not executing it.

**HUMAN_RESEARCH_DECISION_REQUIRED**: the exact RQ1 experimental factors must be specified by the
researcher/supervisor (or located in an authoritative proposal document not present in this
codebase) before this infrastructure can be built. `app/performance/page.tsx`'s existing
scan-duration-based proxy numbers remain explicitly self-labeled as a proxy (not touched this
session, per the instruction not to solve this by relabeling).

---

## 14. RQ2/WCAG Claim Status

**STATUS: NO OVERCLAIM FOUND**

Command: `grep -rn "WCAG 2.2 compliant|WCAG 2.2 compliance|full WCAG|WCAG compliant|fully
compliant with WCAG|WCAG-compliant" app/ src/ docs/dissertation research/*.md README.md` --
OBSERVED: zero matches. The codebase already consistently uses "WCAG-aligned"/"WCAG 2.2-aligned"
framing rather than a compliance claim (confirmed in the prior audit's Section 6/17 and
re-confirmed here). No correction was necessary or made.

---

## 15. RQ3 Static Analyzer Readiness

No change from the prior audit's Section 7 (RQ3: PARTIAL, leaning READY). Re-verified this session:
`npm test` 1272/1272 (up from the prior 1265, reflecting this session's added tests, all passing),
`npm run build` PASS. The core pipeline-identity finding (CLI/live-scan/real-world-benchmark all
call the same `RuleExecutionEngine.analyzeFile[Async]`) is unchanged and was not touched.

---

## 16. RQ4 Expert Validation Readiness

**STATUS: EXPERT_VALIDATION_INFRASTRUCTURE_READY, 0 real submissions**

Verified this session (read-only, no data fabricated): `research/independent-annotation/submissions/`
contains only `README.md`, no `.csv` files.
`research/independent-annotation/results/STATUS.md` (regenerated by this session's test runs, which
invoke the status-check pipeline as a side effect): "Independent annotation: PENDING... No
independent annotator has completed the annotation process for this benchmark yet." Comparison
script (`scripts/compare-annotations.ts`) and package generator (`scripts/generate-annotation-package.ts`)
both present and unmodified.

**HUMAN ACTION REQUIRED**: recruit and run at least one independent annotator through the existing
blind-review package (`research/independent-annotation/package/`). No annotation was performed,
simulated, or fabricated by this session.

---

## 17. Controlled Benchmark Status

Unchanged mechanics, re-verified this session after the Vue-AST/rule-registry corrections: TP=65,
FP=0, FN=0, P=R=F1=1.0, independently recomputed and matching (`docs/evidence/canonical-evaluation.json`,
regenerated this session). Label: **INTERNAL CONTROLLED BENCHMARK**, not real-world accuracy --
unchanged framing, no relabeling attempted or needed (the codebase already uses this term
correctly, e.g. in `datasetClassification.metricType: "AUTOMATED_BENCHMARK_METRICS_ONLY"`).

---

## 18. Negative/Clean Fixture Status

**STATUS: NOT ADDED THIS SESSION**

The controlled benchmark corpus (`benchmarks/testbed/`) still contains zero true-negative/clean
fixtures per rule -- this was identified as a P2 item in the prior audit (F-11) and was not
addressed this session given the P0-blocker-first prioritization for this task. Adding genuinely
representative non-violating fixtures per rule (not merely stripped-defect copies) is nontrivial
enough to warrant its own dedicated pass rather than a rushed addition here; recommended as a
near-term follow-up (Section 29).

---

## 19. Real-World Repository Evaluation Status

**STATUS: UNCHANGED THIS SESSION -- 15 of an approximately 20-30 target**

Network connectivity was confirmed available this session (`git ls-remote` succeeded against a
public GitHub repo), so scaling is technically feasible. It was deliberately NOT attempted this
session: selecting additional appropriately-licensed, framework-representative repositories,
cloning each at a pinned commit, running the real benchmark scanner, and correctly merging the
results into `_combined-summary.json`/`METHODOLOGY.md` is a multi-repository operation whose
correctness is much harder to verify hastily than the P0 fixes this session prioritized. Attempting
it under session time pressure risked producing an under-verified expansion, which would be worse
than clearly flagging it as a scoped follow-up. See Section 28 for the specific next action.

---

## 20. Known False Positives

**STATUS: BOTH PREVIOUSLY-DOCUMENTED CLASSES CONFIRMED FIXED**

See Section 4/7. `benchmarks/real-world/SPOT_CHECK.md` updated with a correction section citing the
exact fix locations (`isProvableStateTarget`, `isLikelyNonArrayNamespaceReceiver` in
`src/ast/real-syntax-node-builder.ts`) and explicitly marking its own prior 72%/39% accuracy
figures as stale pending a fresh re-scan (not replaced with a fabricated new figure).

---

## 21. AI Provider/Model Freeze

**STATUS: FROZEN (recommendation matches shipped default; no code change required)**

Full record: `docs/research/AI_CONFIGURATION_FREEZE.md`. Primary: Claude, `claude-opus-5`.
Fallback: Gemini, `gemini-3.6-flash`. Ollama/local `qwen2.5-coder:7b`: dev-only, explicit opt-in,
never production-default. No API key values recorded anywhere in this report or the freeze
document.

---

## 22. Research Artifact Versioning

**STATUS: IMPLEMENTED**

`src/research/research-config.ts`'s `RESEARCH_ARTIFACT_VERSIONS`: `toolVersion` (1.0.0, from
`package.json`), `ruleSetVersion` (2.0.0), `surveyVersion` (1.0.0), `benchmarkVersion` (1.0.0),
`repositoryProtocolVersion` (1.0.0), `aiConfigVersion` (1.0.0), `analyticsSchemaVersion` (1.0.0),
`consentVersion` (re-exports `CONSENT_PROTOCOL_VERSION`, 1.0.0). These are this session's initial
values, not independently verified against any prior versioning scheme (none existed before this
session).

---

## 23. Test Results

**PASS.** Independently executed multiple times this session (not assumed), final state:

```
# tests 1272
# suites 75
# pass 1272
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 292291.982
```

Up from the prior audit's 1265 (7 net new tests: 2 in `anti-hardcoding-guard.test.ts`'s
participant-target guard, 5 in `analytics-payload-safety.test.ts`; several existing test files
gained subtests for the consent-gate flow without changing their top-level test count). Two real
regressions were found and fixed during this session's own verification passes (a stale `85` slot
assertion in `admin-research-dashboard.test.ts`, and a stale `85`-range assertion in
`participant-matrix-n-plus-1.test.ts`) -- both were legitimate consequences of the supervisor-
directed target change, not weakened to pass.

---

## 24. Build Results

**PASS**, with one real failure found and fixed this session (not hidden):

- First build attempt after adding the consent route: **FAILED**. `export const STUDY_COOKIE` in
  `app/api/user-study/log-scan/route.ts` violated Next.js's App Router route-file export-shape
  validation (only recognized handler/config exports are permitted from a `route.ts` module) --
  `Type error: Property 'STUDY_COOKIE' is incompatible with index signature`.
- Root cause: this session's own earlier edit. Fixed by extracting the constant to
  `src/auth/study-session.ts` (a plain, non-route module) and importing it from both route files.
- Second build attempt: **PASS**, exit code 0. Confirmed both `/api/user-study/consent` and
  `/api/user-study/log-scan` compiled correctly (present in the build's route table).
- Warnings: the same two non-fatal `@vue/compiler-sfc` "Critical dependency" webpack warnings
  present in the known baseline (unrelated to this session's changes, unchanged, not touched).
- `npx tsc --noEmit`: clean -- note this did NOT catch the route-export error above (Next.js's
  route-shape validation is a build-time-only check, not part of plain `tsc`), which is why the
  real `npm run build` was run and re-run rather than relying on `tsc` alone.

---

## 25. Production Browser Acceptance

**STATUS: NOT_TESTED**

No live deployment was performed or available this session. All 30 flows listed in the master
prompt's Phase J were **NOT_TESTED** by browser/live-HTTP round-trip this session -- verified only
by code inspection, the automated test suite (which exercises the real route handlers and real
storage-provider stack directly, not mocked, but not via an actual browser or live HTTP server),
and the successful production build. This status is not upgraded to PASS anywhere in this report.

---

## 26. Synthetic Dry-Run Result

**STATUS: PARTIAL — flow verified via automated tests, not a manual browser walkthrough**

`tests/participant-provisioning-race.test.ts`'s "two concurrent POSTs under one valid session both
succeed" test (updated this session) exercises the real session-issuance -> consent -> log-scan
chain end-to-end against the real route handlers and real storage provider -- this is the same
sequence a real participant's browser would trigger, executed via Node's test runner rather than a
browser. This constitutes a **SYNTHETIC_PRE_STUDY_DRY_RUN at the API level**, clearly labeled as
such here and not participant data (it uses a test-provisioned participant slot, immediately
identifiable as a test fixture in the storage backend). A full manual browser walkthrough
(consent checkbox click -> scan -> log-scan retry-on-failure UI -> Google Form handoff -> GA4 event
in the browser network tab) was **NOT performed** this session (requires a live deployment,
Section 25).

Real participant count confirmed still 0 after this session's testing (Section 8) -- no synthetic
record entered the real collection path.

---

## 27. Ethics/Consent Approval Status

**STATUS: `ETHICS_APPROVAL_REQUIRES_HUMAN_CONFIRMATION`**

Evidence: `research/CONSENT_FORM.md:8` -- `**Ethics Status**: \`ETHICS_APPROVAL_STATUS =
NEEDS_VERIFICATION\`` -- this field was not modified this session and no approval evidence exists
anywhere else in the repository. This status is not inferred or assumed resolved by any of this
session's technical work (consent-gating implementation closes a *technical* gap -- whether a
session's consent is recorded -- and is unrelated to whether the *study itself* has institutional
ethics approval).

---

## 28. Remaining Human Actions

A. **Confirm institutional ethics/consent approval** -- `research/CONSENT_FORM.md`'s
   `ETHICS_APPROVAL_STATUS` must move from `NEEDS_VERIFICATION` to a confirmed value with real
   evidence before any real participant is approached.
B. **Recruit and obtain 20 real participant responses** per the (now-corrected) protocol -- 0
   collected; code cannot fabricate this.
C. **Obtain real independent expert annotation for RQ4** via the existing blind-review package
   (`research/independent-annotation/package/`) -- 0 submissions; code cannot fabricate this.
D. **Specify the exact RQ1 experimental factors** (rendering/state-management strategies, browser/
   hardware/network profile, repetition count) -- required before any RQ1 runtime-measurement
   infrastructure can be built without inventing the research design.
E. **Perform a manual browser walkthrough** of the full study flow against a live/staging
   deployment, including a deliberately-failed log-scan request to confirm the new retry UI works
   as designed (Section 25/26 gap).
F. **Scale the real-world repository corpus** from 15 toward the ~20-30 target (Section 19) --
   network access is confirmed available; this was deliberately deferred rather than rushed.
G. **Review this report and the underlying diffs** before committing/tagging the experiment
   freeze baseline.

---

## 29. Remaining P0/P1/P2 Issues

Carried forward from `research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md` Section 19, updated:

| ID | Priority | Status after this session |
|---|---|---|
| F-01 (freeze scope) | P0 | Still OPEN -- 189 uncommitted changes remain; freezing was deliberately deferred pending human review of this report |
| F-02 (Vue AST decision) | P0 | **CLOSED** -- landed and verified this session |
| F-03 (participant target sync) | P0 | **CLOSED** -- synchronized to 20 this session |
| F-04 (GA4 unimplemented) | P0 | **CLOSED** -- implemented with privacy tests this session |
| F-05 (consent not server-gated) | P0 | **CLOSED** -- implemented this session |
| F-06 (silent scan-logging failure) | P1 | **CLOSED** -- fixed this session |
| F-07 (stale 25-rule docs) | P1 | Not addressed this session (out of scope for this pass; still OPEN) |
| F-08 (real-world repo count) | P1 | Still OPEN -- deliberately deferred (Section 19) |
| F-09 (0 expert annotations) | P1 | Still OPEN -- requires human action (Section 28C) |
| F-10 (AI model not pinned/recorded) | P1 | **CLOSED** -- `docs/research/AI_CONFIGURATION_FREEZE.md` created this session |
| F-11 (no negative benchmark fixtures) | P2 | Not addressed this session (Section 18) |
| F-12 (real-world FP classes) | P2 | **CLOSED** -- both confirmed fixed this session |
| F-13 (rate-limiter fallback scaling) | P2 | Not addressed this session |
| F-14 (adversarial coverage 20%) | P2 | Not addressed this session |

New findings this session:
- **F-15 (P0, closed same-session):** the route-export build failure (Section 24) -- caught and
  fixed before it could reach a freeze/deploy.
- **F-16 (P2, open):** `app/live-scan/page.tsx`'s `trackScanStarted` call fires with
  `framework: 'unknown'` (the real framework isn't known client-side until the server responds) --
  cosmetically imprecise GA4 data, not a privacy or correctness issue; consider deferring the event
  until the response is known if more precise framework-level GA4 breakdowns are wanted later.

---

## 30. Experiment Freeze Baseline

**NOT YET FROZEN.** Populating `research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md` Section 21's
template with this session's values, for when a human approves the freeze commit:

- Tool version: 1.0.0
- Rule count: 50 (all real-AST)
- Rule-set version: 2.0.0
- Framework support: React/Next.js/Angular FULL; Vue PARTIAL (now full real-AST parity)
- Participant target: 20 (`HUMAN_STUDY_TARGET_PARTICIPANTS`)
- Consent version: 1.0.0
- AI provider/model: Claude `claude-opus-5` primary, Gemini `gemini-3.6-flash` fallback (`aiConfigVersion` 1.0.0)
- Analytics schema version: 1.0.0
- GA4 measurement configuration status: infrastructure ready, no real measurement ID configured in
  this environment (expected -- production-only)
- Benchmark version: 1.0.0
- Repository protocol version: 1.0.0 (still describes only 15 repos; not updated to 20-30, Section 19)
- Test results: 1272/1272 passing
- Build result: PASS
- Browser acceptance result: NOT_TESTED

## 31. Data Collection GO/NO-GO

**TECHNICALLY_READY_BUT_HUMAN_APPROVAL_REQUIRED**

All applicable technical pre-study requirements from the prior audit's P0 list are now satisfied:
tree changes are fully classified (though not yet committed/tagged -- a deliberate final human
checkpoint, not a technical gap), participant target is 20 from one source of truth, consent is
server-enforced, logging-failure handling is fixed and tested, GA4 is implemented and privacy-
verified, the survey/protocol documents are synchronized, the test suite passes, and the production
build passes. RQ1/RQ4 evidence-collection *infrastructure* is ready or explicitly flagged as
requiring a prior human decision (RQ1 factors) -- neither was fabricated to satisfy this gate.

This does not become `GO` because institutional ethics/consent approval status is
`NEEDS_VERIFICATION` (Section 27) and real production/browser acceptance has not been performed
(Section 25) -- both require human action or a live deployment this session did not have.

## 32. Exact Next Action

Confirm institutional ethics/consent approval status for the study (Section 27/28A) and perform a
manual live/staging browser walkthrough of the full consent -> scan -> retry-on-failure flow
(Section 28E) -- both are prerequisites this session's code changes cannot satisfy on their own.
Once both are confirmed, review and commit/tag the experiment freeze baseline (Section 30) before
beginning real participant recruitment.
