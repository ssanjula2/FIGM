# FIGM Participant Task Protocol — Frozen for Real Data Collection

Status: FROZEN. This document defines the exact, standardized task set every real participant
(P001–P020) completes. It does not create new fixtures — it freezes and documents the task set
already implemented and live in `app/user-study/page.tsx` as part of the frozen collection build.

Frozen collection-build commit: `b33456dbcb485ada536b66ab5d492e4d5deb178d`
Frozen collection-build tag: `figm-research-collection-v1`

## 1. Purpose

Standardize the participant-facing task set for the FIGM usability study so that all 20 real
participants complete the same 4 framework tasks under the same conditions, producing a
comparable, non-fabricated dataset of real scan interactions.

## 2. Study Scale

```
PARTICIPANT_TARGET            = 20  (P001..P020, HUMAN_STUDY_TARGET_PARTICIPANTS)
TASKS_PER_PARTICIPANT         = 4   (React, Next.js, Angular, Vue)
EXPECTED_PRIMARY_SCANS        = 80  (20 x 4)
```

Repeat scans are permitted and are recorded as SECONDARY; they never replace or block the first
eligible (post-consent) PRIMARY attempt for a given participant × fixture pair (see §6).

## 3. Framework Classification (unchanged research scope)

```
PRIMARY RESEARCH FRAMEWORKS      = React, Next.js, Angular
ADDITIONAL TOOL-SUPPORT FRAMEWORK = Vue
```

This document does NOT redefine Vue as a primary research framework. For the participant
usability study only, all 20 participants complete all 4 tasks (React, Next.js, Angular, Vue) so
the product interaction experience is evaluated across every framework FIGM supports — this is a
usability-coverage decision, not a change to which frameworks are "primary" for the research
questions.

## 4. Existing Infrastructure (reused, not rebuilt)

Inspection of the repository (`app/`, `src/`, `tests/`, `research/`, `docs/`, `public/`) found a
complete, already-live, already-frozen task mechanism — no new task-delivery code or fixture files
were created:

- **Task fixtures**: `app/user-study/page.tsx`, module-level `BENCHMARKS` object — one fixed
  source-code fixture per framework (`react`, `nextjs`, `angular`, `vue`), each with a stable
  `file` name (the identity key used for PRIMARY/SECONDARY tracking, see §6) and embedded `code`.
  These are the ONLY fixtures actually reachable by a real participant through the live product —
  they were reused as-is (no rewriting), per the requirement not to fabricate a new task set when
  an existing one already meets the protocol.
- **Participant session assignment**: `GET /api/user-study/log-scan` — issues a signed, httpOnly,
  cookie-bound session via `ParticipantRepository.assignNewParticipant()` (the same P001–P020
  assignment authority used everywhere else in the product).
- **Session-level consent gate**: `POST /api/user-study/consent` — records `consentGiven=true` in
  the session token. This unlocks the ability to log study interactions at all; it is NOT the same
  as the admin-verified research-eligibility gate (see §7 for why the distinction matters).
- **Scan + research-data logging**: `POST /api/user-study/log-scan` — re-runs the real,
  unmodified `RuleExecutionEngine` server-side on the submitted fixture code and persists a real
  scan record via `RepositoryFactory`'s storage provider, keyed to the participant's real
  `userId` and the fixture's `fileName`.
- **A separate, unused, comment-annotated fixture set** exists at `tests/fixtures/figm/{react,
  nextjs,angular,vue}/*` (added in an earlier, unrelated "test fixtures corpus" commit). It is not
  referenced by any code path and was deliberately NOT reused for this study: each file contains
  inline ground-truth comments (e.g. `// FIGM-REACT-03: Direct state mutation`) that would tell a
  real participant exactly what to find, which the protocol explicitly prohibits (§8). Left
  untouched.

```
EXISTING_PARTICIPANT_TASKS = YES
EXISTING_REACT_FIXTURE     = app/user-study/page.tsx -> BENCHMARKS.react   (file: UserProfile.jsx)
EXISTING_NEXTJS_FIXTURE    = app/user-study/page.tsx -> BENCHMARKS.nextjs  (file: app/dashboard/page.tsx -- corrected, see §12)
EXISTING_ANGULAR_FIXTURE   = app/user-study/page.tsx -> BENCHMARKS.angular (file: SearchPanel.component.ts)
EXISTING_VUE_FIXTURE       = app/user-study/page.tsx -> BENCHMARKS.vue     (file: DataGrid.vue)
```

## 5. Frozen Fixture Identities

| Fixture ID | Framework | Source location | Scan identity (`fileName`) |
|---|---|---|---|
| `FIGM-STUDY-REACT-01` | React | `app/user-study/page.tsx` → `BENCHMARKS.react.code` | `UserProfile.jsx` |
| `FIGM-STUDY-NEXT-01` | Next.js | `app/user-study/page.tsx` → `BENCHMARKS.nextjs.code` | `app/dashboard/page.tsx` (corrected, see §12) |
| `FIGM-STUDY-ANGULAR-01` | Angular | `app/user-study/page.tsx` → `BENCHMARKS.angular.code` | `SearchPanel.component.ts` |
| `FIGM-STUDY-VUE-01` | Vue | `app/user-study/page.tsx` → `BENCHMARKS.vue.code` | `DataGrid.vue` |

Participant × fixture identity is unambiguous: `ParticipantRepository.getResearchDataset()` groups
every eligible scan by the pair `(userId, fileName)` (`src/engine/participant-repository.ts`,
`isFirstForThisFixture` / `seenFixtures`), and `userId` is the real, unique row for the assigned
participant code. Every participant scanning the same 4 fixture files, under their own
participant-scoped session, produces exactly 4 distinct `(userId, fileName)` cells.

```
FIXTURE_ID_TRACKING_GAP = NO
```

Expected PRIMARY matrix (unchanged from the master prompt):

```
P001 x FIGM-STUDY-REACT-01     P001 x FIGM-STUDY-NEXT-01     P001 x FIGM-STUDY-ANGULAR-01     P001 x FIGM-STUDY-VUE-01
...
P020 x FIGM-STUDY-REACT-01     P020 x FIGM-STUDY-NEXT-01     P020 x FIGM-STUDY-ANGULAR-01     P020 x FIGM-STUDY-VUE-01

TOTAL EXPECTED PRIMARY CELLS = 80
```

## 6. PRIMARY / SECONDARY Rule (unchanged, re-verified this pass)

For each participant × fixture pair: the first eligible (post-consent) attempt is `PRIMARY`; every
later eligible attempt is `SECONDARY` — preserved, never dropped or overwritten, never counted as
an additional primary observation. Re-scanning is never blocked. This logic is implemented once,
in `ParticipantRepository.getResearchDataset()` / `filterPrimaryResearchAttempts()` /
`filterSecondaryResearchAttempts()`, and was not modified by this pass.

## 7. Consent Eligibility — two distinct consent steps (read carefully)

The live product has **two separate consent mechanisms**, and both must occur in the correct
order for a scan to count as research-eligible data. Conflating them will silently exclude a
participant's real task scans from the research dataset.

1. **Session consent** (`POST /api/user-study/consent`, participant-facing checkbox on
   `/user-study`): unlocks the ability for that browser session to call
   `POST /api/user-study/log-scan` at all. It does **not** set `researchStatus` or
   `researchConsentVerifiedAt` on the participant's row, and by itself does **not** make any scan
   count in `getResearchDataset()`.
2. **Admin-verified consent** (`PATCH /api/admin/participants/[participantId]` with
   `status: 'CONSENT_VERIFIED'`, `ParticipantRepository.setResearchStatus`): the researcher,
   off-platform, reconciles the participant against the actual signed consent form and only then
   marks the row `CONSENT_VERIFIED`, which records `researchConsentVerifiedAt`. This is the gate
   `getResearchDataset()` actually checks.

A scan is research-eligible only if ALL of the following hold (unchanged, re-verified this pass —
none of these rules were weakened):

```
- participant code is within P001..P020
- participant researchStatus === CONSENT_VERIFIED (admin-set, step 2 above)
- researchConsentVerifiedAt is non-null
- scan.createdAt >= researchConsentVerifiedAt        <-- ORDERING REQUIREMENT, see below
- participant is not REVOKED
- scan is not synthetic/QA/test data
```

**Ordering requirement**: because eligibility requires `scan.createdAt >= researchConsentVerifiedAt`,
the researcher's admin-side `CONSENT_VERIFIED` action (step 2) must happen **before** the
participant runs their 4 framework tasks. If a participant runs tasks first and is admin-verified
afterward, those scans predate `researchConsentVerifiedAt` and are correctly excluded as
ineligible — not a bug, but it means a mis-sequenced session produces zero usable PRIMARY rows for
that participant. Participant instructions (§8) and the researcher checklist (§9) both encode this
ordering explicitly.

```
PRIMARY_SECONDARY_POLICY = PASS  (unchanged, implemented once, re-verified)
CONSENT_POLICY           = PASS  (unchanged, implemented once, re-verified; ordering documented)
```

## 8. Participant Instructions

See the participant-facing copy below. It tells the participant only what to do, not what
violations to expect.

> **FIGM Participant Task Instructions**
>
> 1. Open the FIGM study link (`/user-study`).
> 2. Note your assigned participant code, shown on the page.
> 3. Read the consent text and check the confirmation box, then click "Confirm Consent."
> 4. **Wait here.** Tell the researcher you are ready — do not start the tasks below until the
>    researcher confirms your consent has been verified.
> 5. Once the researcher confirms, select **React** and click "Run FIGM Scan." Review the results.
> 6. Select **Next.js** and click "Run FIGM Scan." Review the results.
> 7. Select **Angular** and click "Run FIGM Scan." Review the results.
> 8. Select **Vue** and click "Run FIGM Scan." Review the results.
> 9. Open the feedback questionnaire (linked on the page) and complete it.
> 10. Tell the researcher when you are finished.
>
> You may re-run a scan on any task if you want to try again — this is allowed and expected.
> There is no "correct" number of issues to find; just review whatever FIGM reports.

## 9. Researcher Session Checklist

For each participant P001..P020, the researcher confirms and records:

```
[ ] Participant code assigned (shown on /user-study for this browser session)
[ ] Participant completed the on-page consent checkbox ("session consent")
[ ] Researcher independently verified consent against the signed consent form
[ ] Researcher set researchStatus = CONSENT_VERIFIED for this participant code
    (PATCH /api/admin/participants/[participantId], BEFORE the participant starts tasks)
[ ] researchConsentVerifiedAt timestamp recorded (system-set, visible in admin dashboard)
[ ] React task (FIGM-STUDY-REACT-01) completed
[ ] Next.js task (FIGM-STUDY-NEXT-01) completed
[ ] Angular task (FIGM-STUDY-ANGULAR-01) completed
[ ] Vue task (FIGM-STUDY-VUE-01) completed
[ ] Feedback questionnaire completed
[ ] Confirmed via admin dashboard: 4 PRIMARY attempts recorded for this participant
[ ] Any repeat scans present are retained as SECONDARY, not overwriting PRIMARY
[ ] No pre-consent scan is present for this participant in the research dataset
[ ] No synthetic/QA/test scan is present for this participant in the research dataset
```

## 10. Study Matrix

See `docs/research/PARTICIPANT_COLLECTION_MATRIX.md` — 20 rows (P001–P020) × React / Next.js /
Angular / Vue / Questionnaire / Status columns, all initialized to `PENDING`. This is a collection
tracker only; no data in it is fabricated or pre-filled as completed.

## 11. Fixture Validation (QA-only, excluded from the research dataset)

Each fixture was run through the exact, frozen, real `RuleExecutionEngine`
(`RuleExecutionEngine.analyzeFileAsync`) exactly as `POST /api/user-study/log-scan` does in
production — this validation call did not persist any record and was never written to
`ScanRepository`/Supabase; it is QA-only evidence that the fixtures parse, scan, and do not crash
the frozen collection build.

| FIXTURE_ID | FRAMEWORK (as detected) | PARSE_STATUS | SCAN_STATUS | FINDING_COUNT | RULE_IDS_TRIGGERED |
|---|---|---|---|---|---|
| `FIGM-STUDY-REACT-01` | `REACT_JSX` | OK | OK | 4 | FIGM-PERF-01, FIGM-A11Y-05, FIGM-PERF-05, FIGM-PERF-05 |
| `FIGM-STUDY-NEXT-01` | `NEXT_JS` (corrected, see §12) | OK | OK | 3 | FIGM-NEXT-03, FIGM-NEXT-01, FIGM-PERF-05 |
| `FIGM-STUDY-ANGULAR-01` | `ANGULAR_TEMPLATE` | OK | OK | 3 | FIGM-A11Y-05, FIGM-A11Y-01, FIGM-ANG-02 |
| `FIGM-STUDY-VUE-01` | `VUE_SFC` | OK | OK | 1 | FIGM-PERF-02 |

No fixture was modified to change its finding count. All four parse and scan successfully against
the frozen collection-build commit that corrected the Next.js classification (see §12/§14).

## 12. Fairness / Comparability Check — Next.js classification gap, CORRECTED

An earlier revision of this document reviewed all four fixtures together and surfaced a real,
evidence-backed classification gap in the Next.js task, distinct from ordinary violation-count
variance. This has since been fixed and re-verified; the record is kept below for traceability.

- **Violation-count spread**: with the fix below, React 4 / Angular 3 / Next.js 3 / Vue 1 — a
  modest, natural spread. Per protocol, exact equal counts are not forced where that would make an
  example unnatural.
- **Next.js framework misclassification (confirmed, then fixed)**: `BENCHMARKS.nextjs`'s fixture
  was originally submitted with `fileName: 'DashboardPage.tsx'`, a flat filename with no
  `app/`/`pages/` route segment and no Next.js-specific import or content hint (`next/link`,
  `next/image`, `getServerSideProps`, etc. — see `src/parser/source-parser.ts`'s
  `detectFramework`). As a result, FIGM classified it as generic `REACT_JSX`, not `NEXT_JS`, and it
  never exercised any `FIGM-NEXT-*` rule.
- **Fix applied**: `BENCHMARKS.nextjs.file` in `app/user-study/page.tsx` changed from
  `'DashboardPage.tsx'` to `'app/dashboard/page.tsx'`. `BENCHMARKS.nextjs.code` was **not**
  changed — the existing code already contained a genuine `FIGM-NEXT-01` pattern (`useState`
  without a `"use client"` directive) that only failed to trigger because of the filename-based
  misclassification. Re-run through the real, unmodified `RuleExecutionEngine`: correctly
  classified `NEXT_JS`, 3 findings (`FIGM-NEXT-03`, `FIGM-NEXT-01`, `FIGM-PERF-05`) — see §11.
- PRIMARY/SECONDARY tracking is unaffected: `ParticipantRepository.getResearchDataset()` groups
  attempts by the literal `(userId, fileName)` string pair with no path-shape assumptions
  (`seenFixtures: Set<string>`, confirmed by reading `src/engine/participant-repository.ts`), so
  the new fileName value works identically to the old one as a grouping key.
- This fix was applied, tested (`tsc`, targeted participant/user-study/accessibility tests, full
  1538-test suite, build), committed, deployed, and production-verified before any real
  participant data collection began — see §14 for the exact commit.

## 13. Do Not Change (re-affirmed, unchanged by this pass)

This pass added/updated study protocol documentation only (plus the one flagged, not-yet-applied
fixture-fileName recommendation in §12). It did not change: the canonical 50 rules,
`ruleSetVersion 2.1.0`, scoring, engine behavior, API behavior, auth behavior, participant
eligibility, consent semantics, the Supabase schema, remediation behavior, or production
deployment code.

## 14. Traceability

```
Frozen collection-build commit = b33456dbcb485ada536b66ab5d492e4d5deb178d
Frozen collection-build tag    = figm-research-collection-v1
Related freeze record          = docs/audit/RESEARCH_COLLECTION_BUILD_FREEZE.md
Related finalization report    = docs/audit/RESEARCH_COLLECTION_BUILD_FINALIZATION.md
Participant target decision    = docs/research/PARTICIPANT_TARGET_DECISION.md
Consent form                   = research/CONSENT_FORM.md
```
