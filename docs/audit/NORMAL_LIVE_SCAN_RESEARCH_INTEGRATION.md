# Normal Live Scan ↔ Research Study Integration

Date: 2026-09-07
Scope: connects the normal, already-existing product Live Scan pipeline (register/login → `/live-scan`
→ `/api/scan` → real `RuleExecutionEngine` + real fix/remediation pipelines) to the real human-study
research dataset (`ParticipantRepository.getResearchDataset()`), without creating a second scanner,
without weakening consent requirements, and without a database migration.

## BEFORE_FLOW

Two fully independent, non-intersecting pipelines (see the inspection report from the prior stage
of this session):

```
Pipeline A (normal product):
  register/login (random "usr_..." id, participantCode always null)
  → /live-scan → /api/scan (detect + fix/remediation + re-scan)
  → ScanRepository, keyed on the real JWT userId
  → ParticipantRepository is never called anywhere on this path

Pipeline B (the only path research data ever reached):
  GET /user-study (unlinked from all app navigation) → anonymous STUDY_COOKIE session
  → ParticipantRepository.assignNewParticipant() (a SEPARATE shadow User row, uncapped)
  → POST /api/user-study/consent (session-level)
  → "Run FIGM Scan" click → POST /api/scan (display only) AND
                              POST /api/user-study/log-scan (the only write getResearchDataset() saw)
  → no fix/remediation UI at all on this page
```

A real participant who registered normally and used `/live-scan` could run any number of real scans
and never produce a single row in `getResearchDataset()`.

## AFTER_FLOW

```
register/login (normal product account, unchanged)
  → GET /user-study while logged in
      → GET /api/user-study/enroll  (resume-state check; participantCode: null for a new user)
      → confirm informed consent + POST /api/user-study/enroll { consentConfirmed: true }
          → ParticipantRepository.enrollAuthenticatedUserAsParticipant(userId)
              -- links participantCode P001-P020 onto the SAME User row, capped at the real
                 cohort size, idempotent, concurrency-safe
          -- researchStatus becomes ASSIGNED; researchConsentVerifiedAt stays null
  → ADMIN verifies consent (UNCHANGED): PATCH /api/admin/participants/[code] { status: CONSENT_VERIFIED }
      -- the ONLY code path that can ever set CONSENT_VERIFIED; participant self-service cannot
  → participant is redirected to /live-scan (the real, unmodified scanner)
  → /api/scan: detect (ScanRepository.createScanRecord, unchanged) → fix/remediation
      (FigmFixPipeline / CodeErrorFixPipeline, unchanged) → re-scan (ordinary new scan record)
  → ANY scan created via /api/scan by this user, at/after researchConsentVerifiedAt, is now
    naturally visible to ParticipantRepository.getResearchDataset() -- ZERO changes to that
    method or to /api/scan's scan-persistence logic were needed for this
  → fix/remediation interactions are now persisted (AiHistory / ai_history table, already existed
    in the schema, previously completely unwired)
```

## Identity model

One human = one `User` row, always. `enrollAuthenticatedUserAsParticipant(userId)`
(`src/engine/participant-repository.ts`) links `participantCode`/`researchStatus`/
`researchAssignedAt` onto the caller's own already-authenticated row via `updateUser` — never
`createUser`. It is:

- **Idempotent** — a user who already has a code gets that same code back (`alreadyEnrolled: true`),
  never a second one.
- **Capped** — strictly bounded at `HUMAN_STUDY_TARGET_PARTICIPANTS` (20). Once P001-P020 are all
  taken, enrollment throws a clear "study has reached its target" error rather than silently minting
  an out-of-range code `isRealStudyParticipantCode()`/`getResearchDataset()` would then just as
  silently exclude.
- **Concurrency-safe** — re-scans `getAllUsers()` and retries on a genuine unique-constraint
  violation (Postgres's real `participantCode @unique` column), the same pattern
  `assignNewParticipant()` already used, extracted into a small shared `usedParticipantNumbers()`
  helper so the number-allocation logic isn't duplicated.

`assignNewParticipant()` itself is **completely unchanged** — it still mints a separate anonymous
shadow account for whatever still relies on the old `/user-study` anonymous flow (`/api/user-study/
log-scan`'s `GET`, still fully functional, still tested, still uncapped by design for
operational/QA use). The two participant-creation paths are independent; nothing about the new one
touches the old one's behavior or tests.

## Consent model

Two genuinely distinct facts, never conflated:

1. **Session-level self-report** — the participant checking "I consent" and calling
   `POST /api/user-study/enroll`. Recorded only as an `AuditLogger` event
   (`RESEARCH_PARTICIPANT_ASSIGNED`) — no new schema column. This gates nothing by itself.
2. **Admin verification** — `researchStatus === 'CONSENT_VERIFIED'` +
   `researchConsentVerifiedAt`, set **exclusively** by `PATCH /api/admin/participants/[code]`
   (unchanged route, unchanged `ParticipantRepository.setResearchStatus`). This is the one and only
   gate `getResearchDataset()` checks. The enrollment endpoint cannot set this field under any
   input — there is no code path from participant self-service to `CONSENT_VERIFIED`.

## Scan persistence / research eligibility

No changes to `/api/scan`'s scan-persistence branch, `ScanRepository`, or
`ParticipantRepository.getResearchDataset()`. This was the key architectural finding driving the
whole design: `ScanRepository.createScanRecord` already writes through the same
`IStorageProvider` → `ScanReport` table that `getResearchDataset()` already reads via
`provider.getScanRecords()`, grouped by `scan.userId`. Once a user's own row has an in-range
`participantCode` + `CONSENT_VERIFIED` + a real `researchConsentVerifiedAt`, their `/api/scan`
scans are picked up automatically — confirmed by test J, which runs the real route handler with no
research-specific code path at all.

## PRIMARY / SECONDARY

Untouched. Confirmed unchanged by tests L/M: the earliest eligible (post-consent) scan per
(userId, fileName) is PRIMARY, every later one SECONDARY — the exact same logic that already
existed, now also reachable from real `/api/scan` traffic instead of only
`/api/user-study/log-scan`.

## Fix/remediation telemetry

New: `DBAiHistory` (`src/auth/user-db.ts`) backs the schema's pre-existing, previously-unwired
`AiHistory`/`ai_history` table (live in production since the initial baseline migration —
confirmed via `prisma/migrations/20260818075914_init_baseline/migration.sql`). New
`IStorageProvider.createAiHistoryRecord`/`getAiHistoryByUserId` methods, implemented in both
`SupabaseStorageProvider` (real Prisma `aiHistory.create`/`findMany`) and `JsonStorageProvider`
(dev/test parity). `app/api/scan/route.ts`'s fix-action branch now additionally authenticates the
caller and (only if authenticated) persists one record per fix attempt:

- `applied` is the pipeline's own real `verified` flag — true only when the patched code was
  actually re-scanned and the violation confirmed gone (the exact condition under which
  `live-scan/page.tsx`'s `applyFix` itself mutates the editor). Never inferred from "a patch was
  generated." Proven both ways: test N (a known deterministic, verified=true fix) records
  `applied: true`; test O (a known AI-only rule with no provider configured, verified=false)
  records `applied: false`.
- The write is **awaited**, not fire-and-forget — an unawaited write is not reliably guaranteed to
  complete before a serverless function's execution context is torn down once the response is
  sent. A telemetry-write failure is logged but never fails the actual fix response.

## Re-scan behavior

A re-scan is just another ordinary `/api/scan` call → another ordinary `ScanReport` row (test P:
two calls produce two rows, never an overwrite). No parent/child link is fabricated between a fix
attempt and a later re-scan.

**Known, documented limitation**: the fix endpoint operates on ad-hoc submitted `(code, defect)`,
not a specific persisted `ScanReport` id, so `AiHistory.scanReportId` is always `null` today. The
only available association is chronological: `userId` + `ruleId`/fixture filename + timestamps.
Wiring a real `scanReportId` through would require the client to pass along which saved scan (if
any) a fix request relates to — out of scope for this pass; noted here rather than fabricated.

## Ordinary-user isolation

Nothing changes for a user who never enrolls: `participantCode` stays `null`, `/live-scan` and
`/api/scan` behave exactly as before, and `isRealStudyParticipantCode(u.participantCode || u.id)`
can never match a random `usr_...` id. Proven by test G (a real, never-enrolled user's real scan is
absent from `getResearchDataset()`) and test Q (`GET /api/user-study/enroll` reports `null` for
them, never an error).

## `/user-study` page

Repurposed (not deleted) into an authenticated study-enrollment/onboarding page:
consent confirmation → `POST /api/user-study/enroll` → shows the assigned P-code and a link to the
real `/live-scan` page. The diagnostics-only benchmark scanner it used to contain is gone entirely
— no duplicate scanner exists anywhere in this codebase. The old anonymous STUDY_COOKIE flow
(`GET`/`POST /api/user-study/log-scan`, `POST /api/user-study/consent`) is untouched at the route
level and remains fully functional/tested for whatever QA/back-compat purposes still need it; the
page simply no longer calls it. `middleware.ts`'s `isPublicPath` and `AppShell.tsx`'s
`isBareRoute()` entries for `/user-study` were also left unchanged (a logged-out visitor still sees
a bare-chrome page, now showing a login/register prompt instead of the old scanner) — a minor,
deliberately-not-fixed cosmetic inconsistency, not a functional gap.

## Migration status

**No Prisma migration required or created.** Everything needed already existed in the schema and
was already applied to production:

- `User.participantCode` / `researchStatus` / `researchAssignedAt` / `researchConsentVerifiedAt` —
  added in `prisma/migrations/20260824150000_add_research_participant_fields` (the same migration
  the original `/user-study` feature already depends on).
- `AiHistory` (`ai_history` table) — present since `prisma/migrations/20260818075914_init_baseline`,
  simply never read or written by any application code until now.

## Known limitations

- `AiHistory.scanReportId` is always `null` (see "Re-scan behavior" above) — an honest gap, not a
  bug.
- No dedicated research-interaction export for fix telemetry yet.
  `ParticipantRepository.getResearchDataset()`'s row shape is intentionally unchanged (scan-row
  semantics only); a future `getResearchFixTelemetry()`-style method would be the natural extension
  if/when the study's analysis needs it, rather than corrupting the existing export.
- Enrollment self-report consent is audit-log-only (no dedicated DB column) — sufficient for this
  pass since the only functionally-gating fact is admin's own `CONSENT_VERIFIED`/
  `researchConsentVerifiedAt`, which is unchanged and unaffected.

## Final status

```
NORMAL_LOGIN_CAN_ENROLL_IN_STUDY=YES
ONE_USER_ONE_PARTICIPANT_CODE=PASS
LIVE_SCAN_RESEARCH_LINKAGE=PASS
ORDINARY_USERS_EXCLUDED=PASS
CONSENT_GATE=PASS
PRIMARY_SECONDARY_POLICY=PASS
FIX_TELEMETRY_PERSISTED=YES
RESCAN_CAPTURED=YES
DUPLICATE_SCANNER_CREATED=NO
DATABASE_MIGRATION_REQUIRED=NO
TEST_DATABASE_ISOLATION=PASS
TSC=PASS
TESTS=PASS
BUILD=PASS
UNRESOLVED_P0_BLOCKERS=0
SAFE_TO_START_P001_WITH_NORMAL_LOGIN=YES
```
