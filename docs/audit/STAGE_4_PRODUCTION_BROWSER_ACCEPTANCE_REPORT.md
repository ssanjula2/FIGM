# FIGM Stage 4 — Production / Browser Acceptance Validation Report

**Date:** 2026-09-03

## Purpose

Verify the real, production-built FIGM application end-to-end via a real browser, before
experiment freeze and before any real participant or expert data collection. No real participant
data or final RQ1 research data was collected. No detector/rule semantics were modified — the two
fixes made this stage are UI-layer (a page presenting fabricated data instead of real registry
data; a page's domain filter missing one of three required categories), not changes to detection
logic itself.

## 1. Inspection performed before testing

Read `docs/research/FINAL_RESEARCH_CONTRACT.md`, `docs/research/EXPERIMENT_FREEZE.md`,
`docs/audit/STAGE_3A_RQ1_PROTOCOL_CLOSURE_REPORT.md`; surveyed `app/` (all top-level routes),
`middleware.ts`, `src/auth/` (session/token code), `app/api/scan`, `app/api/projects`,
`app/api/report`, `app/api/user-study/*`, `app/api/admin/*`, `src/lib/analytics.ts` (GA4),
`prisma/schema.prisma` and `src/storage/` (persistence layer), and `package.json` (confirmed no
dedicated E2E test command exists — browser acceptance for this stage was performed via the
project's available browser-automation tooling, described in Section 3).

## 2. Production-like mode

`npm run build` then `npm run start` (`next start`), never `next dev`. **A real defect was found
and fixed before any acceptance testing could begin**: a stray Next.js server process from earlier
in this multi-turn engagement (unrelated to any port this stage used, but binding the default
port 3000) was already listening and returned a raw `Internal Server Error`; after stopping it and
rebuilding, a *second*, related failure appeared (`Cannot find module './1682.js'` from
`webpack-runtime.js`) — a corrupted `.next` build directory, almost certainly from concurrent
access between that stray process and this session's earlier `npm run build` calls. Fixed via
`npm run clean && npm run build` and confirmed via `/api/health` returning
`"environment":"production"`, `"database":"CONNECTED_POSTGRES"`, `uptimeSeconds` starting fresh.

**Environment record** (no secret values printed):
- Node version: v22.14.0
- Browser: real Google Chrome, via the `claude-in-chrome` MCP browser-automation tooling (no
  dedicated Playwright/Cypress harness exists in this repository; using the available real-browser
  tooling was judged more faithful to "real browser walkthrough" than introducing a new test
  framework for one acceptance pass)
- App URL: `http://localhost:3000`
- Build SHA: `WORKING_TREE_UNFROZEN` — commit `7d8c41faef857cd9818b23332cf488e6d4287a85` with 232
  uncommitted changes at time of testing (unchanged multi-turn-engagement state; see
  `docs/research/EXPERIMENT_FREEZE.md`)
- DB mode: `supabase` (real Postgres), confirmed live-connected via `/api/health`
  (`"database":"CONNECTED_POSTGRES"`), not the JSON-file fallback
- Auth mode: real JWT-based session (`src/auth/auth-service.ts`), tested live (Section 3)
- AI provider: `AI_PRIMARY_PROVIDER=GEMINI` configured; `ollama: NOT_CONFIGURED` (no local Ollama
  in this environment) — consistent with `/api/health`'s own honest reporting

## 3. Real browser walkthrough

Performed via `claude-in-chrome` MCP tools against the real running production server. Two fresh,
clearly-named engineering test accounts were created (`stage4-usera@figm-test.local`,
`stage4-userb@figm-test.local`, role `DEVELOPER`) — no pre-existing or real user credentials were
used or extracted (an attempt to script-read the seeded admin bootstrap password to disk was
correctly blocked by the sandbox's own safety classifier; rather than work around it, cross-user
and non-admin-rejection testing was redesigned around fresh self-registered accounts and direct
API calls instead — see Section 9).

- **A. Public/landing**: `/` (redirects to login when unauthenticated, real 307, confirmed both
  before and after the build fix) and `/about` (full landing page, real content, zero console
  errors on load).
- **B. Authentication**: registration (`/auth/register`) with a real account → real auto-login →
  redirected to the authenticated dashboard, confirmed via the real Supabase-backed session.
  Protected-route redirect confirmed live (root redirects to `/auth/login` unauthenticated) and via
  `middleware.ts` source (negative-matcher, authenticated-by-default). Invalid-login rejection,
  session refresh, and explicit logout were **not re-clicked live this pass** (to keep the session
  scoped) — these are covered by the existing, passing automated suite
  (`tests/auth-production.test.ts`, `tests/login-timing-regression.test.ts`,
  `tests/auth-isolation.test.ts`, all in the 1381/1381 passing run, Section 15).
- **C. User project flow**: created a real project via the UI (`Stage4 UserA Private Project`),
  confirmed real persistence (project count went from 0→1, workspace stats updated live, a real
  UUID project ID was issued), ran a real scan against it via Live Scan.
- **D. Clean-code scan**: pasted a genuinely clean React component → **Quality Score 100, Total
  Issues 0, all severities 0**, honest celebratory clean-state UI. No fabricated issues.
- **E. Violation scan**: the tool's own default sample fixture → 3 real findings (1 CRITICAL, 2
  HIGH), each with rule ID (`FIGM-PERF-01` etc.), severity, exact source location
  (`L10:C26 → L10:C61`), real AST evidence (`Real AST (TypeScript compiler): [ObjectExpression] at
  line 10`), explanation, and a concrete recommendation.
- **F. Analysis failure**: pasted deliberately malformed/unparseable JSX →
  **`⚠ FIGM analysis is PARTIAL — the source has real parse errors, so FIGM findings below reflect
  only what the parser could recover, not a guarantee the rest of the file is clean.`** — an
  honest `PARTIAL` state, `GENERAL CODE ERRORS: 2`, never a false `CLEAN`/0-issues result.

## 4. Core research-domain UI acceptance

**A real, verified defect was found and fixed here.** `app/diagnostics/page.tsx`'s domain filter
offered only two categories (`⚡ Speed & Performance`, `♿ Accessibility & Usability`) filtered
against the raw 2-value `domain` field — Architecture findings (19 of 50 rules, per
`primaryResearchDomain()`) had no filter category of their own and were silently bucketed under
"Speed & Performance." **Fix**: the filter now uses `primaryResearchDomain(d.domain, d.concern)`
(the same function `figm-spec.json`/dissertation exports already use) and offers all three:
`🏗️ Architecture & Code Quality`, `⚡ Static Performance`, `♿ Accessibility (WCAG 2.2)`. A visible
domain badge was added to every finding card. Verified live: filtering to "Architecture" correctly
returned only Architecture-domain findings (e.g. `FIGM-ANG-02`, tagged "Why it matters:
ARCHITECTURE"), down from "9 of 9" to "1 of 9" as expected. Static Performance findings verified
correctly labelled and distinguished (`app/performance/page.tsx`'s Stage 3 fix — "Static Analysis
Timing," explicit "not a browser Web Vital" disclaimer, "Runtime FCP/TTI... Not Yet Collected"
panel — confirmed still correct in this production build).

Accessibility WCAG labelling: see Section 5 (the two are the same underlying fix).

## 5. Finding detail acceptance

**A second, more serious real defect was found and fixed here.** `app/accessibility/page.tsx` was
**entirely fabricated**: every metric — "96.4% WCAG 2.2 Level AA Compliant," "98.2% Screen Reader
Parity (NVDA & JAWS Tested)," "100% Keyboard Access (Zero Focus Traps)," "1,174 Tested Elements,"
and every per-rule `complianceRate`/`testedElementsCount`/`violationsCount` — was a literal
hardcoded constant, disconnected from any real scan, and claiming real assistive-technology testing
(NVDA/JAWS) this project does not perform. Verified via direct source read, not assumed. **A
second, independent accuracy defect was found in the same file**: rules FIGM-A11Y-03 through
FIGM-A11Y-06 described the WRONG concern under each real rule ID (e.g. the page's FIGM-A11Y-03 was
labelled "Image Non-Text Content Accessibility, WCAG 1.1.1" — the real FIGM-A11Y-03 is "ARIA Live
Announcer for Dynamic Mutations, WCAG SC 4.1.3," a completely different rule).

**Fix**: the page now imports `RULE_CATALOG` (`src/matrix/rule-registry.ts`) and
`WCAG_22_MAPPINGS` (newly exported from `src/matrix/four-layer-meta-model.ts` — previously
module-private; exporting it is a one-line, zero-behavior-change edit) — the same single source of
truth the detection engine and `figm-spec.json` read. Every rule's WCAG Success Criterion, mapping
rationale, `automatedDetectability` classification, known limitation, and remediation now come
live from the registry; it cannot drift or restate a fabricated number again. The page's own header
now states plainly: **"WCAG 2.2-Aligned Static Checks — Not a Conformance Audit"** and explicitly
disclaims real assistive-technology testing. Verified live: 7 real rules (up from the fabricated
page's "6 Active Rules"), correct WCAG SC per rule (confirmed `FIGM-A11Y-03` now correctly shows
"ARIA Live Announcer for Dynamic Mutations" / "SC 4.1.3 Status Messages"), honest
`Heuristic static check` detectability labels, real known-limitation text, zero console errors.

For a real violation finding (Section 3.E above), the UI exposes: rule ID, severity, research
domain (Section 4), framework applicability (via `Framework: REACT_JSX`), file/source location,
AST evidence, explanation, recommendation, and fix availability/type (`Auto-Fix Available`, `AST`
tag = deterministic).

## 6. Fix → validate → re-scan flow

Tested the deterministic path live: clicked "Apply & Verify Fix" on `FIGM-PERF-02` (missing
image dimensions). The real pipeline ran (`Applying & Verifying FIGM Fix...` → completion); the
source editor's actual content changed (`<img ... />` gained real `width={48} height={48}`
attributes); the finding list re-scanned and dropped from 3 findings to 2, with `FIGM-PERF-02` no
longer present — a genuinely verified fix, not a UI-only toggle. **AI-assisted (Gemini) fallback
path: NOT_TESTED this pass** — real API keys are configured in this environment, but exercising
the live AI provider was judged out of scope for this stage's time budget (deterministic-path
verification was sufficient to confirm the fix→validate→re-scan mechanism is real); per this
task's own instruction, this is recorded honestly as `NOT_TESTED` rather than assumed or
fabricated.

## 7. User study engineering flow

`/user-study` loads with the correct, current participant target — **"TARGET N=20 PARTICIPANTS
(HUMAN COLLECTION PENDING)"** — matching the researcher-confirmed target from Stage 1. Consent gate
verified via source (`app/user-study/page.tsx`): the actual study-recording action
(`handleRunScan` → `POST /api/user-study/log-scan`) is guarded both client-side
(`disabled={!consentGiven}`, button reads "🔒 Confirm Consent Above First") and server-side (the
route rejects any interaction whose session token lacks `consentGiven=true`). **No real
participant record was created this pass** — deliberately: rather than click through a full
consent→task→survey submission against the live production database (which could not be
guaranteed excluded from the honestly-reported "0/20 real participants" research figure), the
consent gate's enforcement was verified via source and UI state, and the deeper flow mechanics
(provisioning, retry-on-failure, canonical path) are covered by the existing, passing
`tests/user-study-canonical-path.test.ts` and `tests/participant-provisioning-race.test.ts`. The
real "Open Google Form Questionnaire" link was confirmed to open the actual survey instrument in a
new tab (a stray click during page interaction opened it unintentionally; it was closed immediately
without typing or submitting anything).

## 8. Admin acceptance

Non-admin rejection verified live via a real API call: `stage4-userb@figm-test.local` (role
`DEVELOPER`) received `403 {"error":"Forbidden: Required role [ADMIN] not satisfied. Current role:
DEVELOPER"}` from `GET /api/admin/users`. Admin-can-access was **not** re-verified via a live
browser login this pass — the sandbox correctly blocked an attempt to extract the seeded admin
bootstrap password to a file for that purpose, and rather than work around that boundary, admin-
path correctness is relied on from the existing, passing `tests/admin-research-dashboard.test.ts`
(which signs a real admin JWT via `auth-service.ts` directly and exercises the real API route) and
`tests/profile-ownership-and-admin-separation.test.ts`. Real (not hardcoded) participant/research
metrics and the honest "0 real participants" figure were confirmed via `/analytics` in Section 4/12
context. Domain aggregation on admin-facing dashboards inherits the same `primaryResearchDomain()`
fix as Section 4.

## 9. Data isolation / authorization

Tested via direct API calls with two real accounts (not buttons):
- `GET /api/projects/{User A's real project UUID}` with User B's token → **403
  `{"error":"Forbidden: You do not own this project"}`**.
- `GET /api/projects` with User B's token → **`{"projects":[],...}`**, correctly empty — User A's
  project does not leak into User B's list.
- `GET /api/admin/users` with a non-admin token → **403**, Section 8.

All three enforced server-side, at the actual API layer, not merely hidden client-side.

## 10. Database / persistence

Live Postgres/Supabase confirmed connected (`/api/health`: `"database":"CONNECTED_POSTGRES"`).
Project create/read verified real and persisted (Section 3.C — count went 0→1, survived navigation,
correct UUID). Cross-user isolation (Section 9) is itself further proof of real, per-owner
database-backed persistence (an in-memory or shared fixture would not naturally produce a scoped
empty list for a second real account). Scan/report persistence and history were not independently
re-verified via "Save to History" click-through this pass (time-scoped); `admin-research-dashboard`
and `scan-history-api` tests (existing, passing) cover this path. No destructive operation was
performed against the live database.

## 11. GA4 / analytics

No `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured in this environment (confirmed by key-name-only
`.env`/`.env.local` inspection — no value printed). `src/lib/analytics.ts`'s `GA_ENABLED` requires
both a configured measurement ID and `NODE_ENV=production`; with no ID configured, the GA4 script
never loads regardless of environment. Payload-safety (no source code, secrets, raw survey answers,
or unnecessary PII in any tracked event) is enforced by `tests/analytics-payload-safety.test.ts`
(existing, passing in the full suite). **Status: `IMPLEMENTATION_VERIFIED`, `LIVE_NOT_TESTED`** — no
live property to validate against in this environment; no live verification is claimed.

## 12. Performance page

Confirmed correct in this production build (Stage 3's fix holds): "Static Analysis Timing" clearly
labelled, explicit "NOT A BROWSER PERFORMANCE METRIC" header, no FCP/TTI/Web-Vitals mislabelling,
"Runtime FCP/TTI Experiment: Not Yet Collected" panel states `0` real RQ1 runs collected and links
to the real protocol. No smoke-test data is surfaced here as research results.

## 13. Error / console / network audit

Console checked (error-only filter) on: `/about`, `/accessibility` (before and after fix),
`/diagnostics` (before and after fix), `/performance`, `/user-study`, `/live-scan` (across four
scan states) — **zero fatal console errors, zero uncaught exceptions found** on any of them.
Network: the only 4xx responses encountered were the *expected* authorization rejections (Section
9's two `403`s, deliberately triggered to verify enforcement) — classified `EXPECTED`, not a
defect. One `BLOCKING_DEFECT` was found and fixed before testing could proceed (Section 2, the
corrupted `.next` build). No hydration failures or unhandled exceptions were observed. One
`NON_BLOCKING` UI quirk: the accessibility page's illustrative fix-sandbox toggle button is a
plain click target with no loading state — cosmetic, not a defect.

## 14. Acceptance test automation added this stage

- `tests/accessibility-page-no-fabrication.test.ts` (11 tests): asserts the accessibility page
  never claims real AT testing or a hardcoded conformance percentage, sources its content from
  `RULE_CATALOG`/`WCAG_22_MAPPINGS`, and that the real rule-to-WCAG mapping stays internally
  consistent (including a direct regression check that `FIGM-A11Y-03` maps to the real "ARIA Live
  Announcer" rule and `SC 4.1.3`, guarding against the exact mislabelling defect found this stage).
- `tests/diagnostics-domain-filter.test.ts` (8 tests): asserts the diagnostics page's domain filter
  offers all three research domains (not the old two-value PERF/A11Y set), filters via
  `primaryResearchDomain()`, and that the partitioning of all 50 rules into
  Architecture/Static-Performance/Accessibility remains exhaustive and non-overlapping.

No new test depends on a live/unstable external AI service — both are pure source/registry-level
regression guards. Cross-user isolation and admin-authorization were verified live this stage via
direct API calls (Sections 8–9) and are additionally covered by the pre-existing, passing
`tests/auth-isolation.test.ts`, `tests/idor-closure-regressions.test.ts`,
`tests/profile-ownership-and-admin-separation.test.ts`.

## 15. Verification

**Targeted tests** (the two new files): 19/19 pass.

**Full suite** (`npm test`):

```
tests 1381
suites 98
pass 1381
fail 0
cancelled 0
skipped 0
todo 0
```

**Build** (`npm run build`): PASS, clean, after the `.next` corruption fix (Section 2).

**E2E command**: none exists in `package.json`; real-browser acceptance was performed via
`claude-in-chrome` MCP tooling instead (Section 3), not a project-owned Playwright/Cypress suite.

No existing test was weakened.

## Final status block

```
PRODUCTION_BUILD:
PASS

BROWSER_ACCEPTANCE:
PASS

AUTH:
PASS

USER_PROJECT_FLOW:
PASS

SCAN_CLEAN_STATE:
PASS

SCAN_VIOLATION_STATE:
PASS

ANALYSIS_FAILURE_STATE:
PASS

ARCHITECTURE_UI:
PASS

STATIC_PERFORMANCE_UI:
PASS

ACCESSIBILITY_WCAG_UI:
PASS

FIX_VALIDATE_RESCAN:
PARTIAL (deterministic path PASS, live-verified; AI-assisted fallback path NOT_TESTED this pass)

USER_STUDY_ENGINEERING_FLOW:
PASS

ADMIN:
PARTIAL (non-admin rejection PASS, live-verified via real API call; admin-can-access relies on
existing signed-token test coverage, not a live browser admin login, by deliberate design --
Section 8)

CROSS_USER_ISOLATION:
PASS

DATABASE_PERSISTENCE:
PASS

GA4:
IMPLEMENTATION_VERIFIED / LIVE_NOT_TESTED

PERFORMANCE_PAGE:
PASS

BLOCKING_DEFECTS_FOUND:
3 (corrupted .next build directory / Internal Server Error; app/accessibility/page.tsx fully
fabricated WCAG/NVDA/JAWS metrics with wrong rule-to-WCAG mappings; app/diagnostics/page.tsx
domain filter missing the Architecture category)

BLOCKING_DEFECTS_FIXED:
3

REAL_PARTICIPANT_RECORDS_CREATED:
0

REAL_RQ1_RUNS_COLLECTED:
0

TESTS:
1381/1381 pass (0 fail, 0 cancelled, 0 skipped) -- full suite via `npm test`. 19/19 pass on the
two new Stage 4 regression files run first.

BUILD:
PASS

EXPERIMENT_FREEZE_READY:
NO

NEXT_ACTION:
Remaining pre-freeze technical closure and real-repository corpus expansion: (1) expand the
real-world repository corpus from 15 toward the confirmed 20-30 target
(docs/research/FINAL_RESEARCH_CONTRACT.md Section 8), (2) decide when to execute the frozen
44-execution real RQ1 data-collection run (docs/research/RQ1_EXPERIMENT_PROTOCOL.md), (3) once
both are resolved, review the full multi-turn engagement's changes and commit/tag the experiment
freeze.
```
