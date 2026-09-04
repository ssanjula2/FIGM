# Pre-Study Data Integrity — Final Verification

Date: 2026-09-04
Scope: Phases 2–7 of the P0 data-integrity request that followed
`docs/audit/PRE_STUDY_SYNTHETIC_DB_RESIDUE_AUDIT.md` (Phase 1). Real code changes were made in
this pass, on top of that read-only audit's clean result.

## What changed, and why

### Phase 2 — Research dataset range guard

`ParticipantRepository.getResearchDataset()` previously accepted any user matching the broad
`PARTICIPANT_ID_PATTERN` (`/^P\d{3,6}$/`) plus `CONSENT_VERIFIED` + a real consent timestamp. That
pattern also matches this repo's own operational/QA-fixture codes (e.g. `P900000`-`P989999`, used
throughout the test suite). Added `isRealStudyParticipantCode()`
(`src/engine/participant-repository.ts`), derived from `HUMAN_STUDY_TARGET_PARTICIPANTS` (no
second hardcoded "20"), which accepts only the canonically-zero-padded `P001`..`P020`.
`getResearchDataset()` now requires this stricter check instead of the broad pattern.
`getMatrix()`/`getDetail()` (the admin operational dashboard, which intentionally shows every
real row including pre-consent/QA activity so a human can decide ASSIGNED vs REVOKED) are
unchanged.

### Phase 3 — Test/production database isolation

Two independent contamination paths were found and closed:

1. **Prisma/`DATABASE_URL` path.** `.github/workflows/figm-scan.yml`'s test step injected
   `DATABASE_URL`/`DIRECT_URL` (a real secret if configured, or a harmless localhost fallback) into
   `npm test`'s environment for no reason the tests actually need — `RepositoryFactory` already
   defaults to the local JSON-file provider whenever Supabase credentials are absent. Removed that
   injection entirely (the `prisma generate` step still gets a placeholder URL, since generating
   the client never opens a connection).
2. **A separate, more serious path, found while investigating a test failure.** `UserDB`
   (`src/auth/user-db.ts`) — meant to be a fully local, JSON-file-only store — had three
   fire-and-forget syncs directly to a real `@supabase/supabase-js` client (`users` upsert,
   `users` update, `scan_reports` insert) whenever `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` plus a
   key happened to be present in the process environment, **entirely independent of
   `RepositoryFactory`'s provider selection**. This is a real, previously-undiscovered
   contamination vector: if those env vars were ever present during a test run (a misconfigured CI
   step, a developer's shell exporting them broadly), every user/scan a test created would also be
   written into the real, live `users`/`scan_reports` tables. Added `isSupabaseSyncAllowed()`
   guarding all three call sites — disabled unconditionally whenever `NODE_ENV === 'test'`.

**Defense in depth, in order:**
- `tests/test-env-setup.mjs` calls `assertSafeTestDatabaseEnvironment()`
  (`src/db/db-safety-guard.ts`) before any test file loads — aborts the entire run if
  `DATABASE_URL`/`DIRECT_URL`/`SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` looks like a hosted Supabase
  project under `NODE_ENV=test`. Verified end-to-end: running with the real `.env`/`.env.local`
  credentials and `NODE_ENV=test` aborts immediately with a clear error naming only the offending
  variable, never the URL/credential value, before touching the database.
- `src/db/prisma-client.ts`'s `getPrismaClient()` calls the same guard before constructing a real
  `pg.Pool`/`PrismaClient`.
- `src/auth/user-db.ts`'s three Supabase-sync sites are unconditionally disabled under
  `NODE_ENV=test`.

An explicit opt-out (`FIGM_ALLOW_TEST_AGAINST_HOSTED_DB=1`) exists only for a deliberately
provisioned, disposable test Supabase project — never set, and never intended to point at
production.

**Documented storage matrix:**

| Context | Backend | Selected by |
|---|---|---|
| Normal local development | `SupabaseStorageProvider` (real Postgres) if `.env`/`.env.local` Supabase credentials are present; otherwise `JsonStorageProvider` (local file) | `RepositoryFactory.getStorageProvider()` |
| Production (deployed) | `SupabaseStorageProvider` only — `RepositoryFactory` throws fatal if credentials are missing outside dev/test | same |
| Automated tests (`npm test`) | `JsonStorageProvider` / `UserDB`'s local JSON file (`figm-user-db.json`) always — no DB env vars are set, and even if they were, `db-safety-guard.ts` aborts the run first | `tests/test-env-setup.mjs` + `db-safety-guard.ts` |

### Phase 4 — Regression tests

Two new files:
- `tests/research-dataset-range-guard.test.ts` (13 tests) — items 1–10 from the request (P001/P020
  included, P021/P900000 excluded, ordinary user excluded, ASSIGNED-only excluded, pre-consent
  excluded, post-consent included, REVOKED excluded, PRIMARY/SECONDARY unchanged) plus explicit
  boundary/non-canonical-padding checks on `isRealStudyParticipantCode()` and the target-count
  invariant.
- `tests/db-safety-guard.test.ts` (8 tests) — item 11, exercising `checkTestDatabaseSafety`/
  `assertSafeTestDatabaseEnvironment` with fabricated fixture URLs only (no real secrets), covering
  hosted-vs-local detection, the NODE_ENV=test-only scope, the explicit opt-in, and that a thrown
  error never leaks the credential/URL value.

**A real, pre-existing test-isolation bug was found and fixed along the way:** four existing test
files (`repeated-scan-attempt-policy.test.ts`, `research-dataset-consent-gate.test.ts`,
`qa-baseline-cleanup-regression.test.ts`, and `participant-matrix-n-plus-1.test.ts`) construct
fixtures directly against the shared local JSON test-storage file, which — unlike real Postgres —
does not enforce `participantCode` uniqueness. Once tests needed to draw from the real, narrow
P001–P020 range (Phase 2's fix made the old wide `P900000+` range unusable for tests asserting
*inclusion*), the ~20-slot space collided within a single run: duplicate-coded rows made
`findUserByParticipantCode()` (used by `ParticipantRepository.setResearchStatus()`) and the
`getMatrix`/`getDetail` code paths resolve ambiguously to the wrong physical row. Fixed by (a)
decoupling each fixture's email from its code with a random suffix, (b) purging any stale
same-coded row before creating a fresh one, and (c) setting research status by the fixture's own
known `userId` directly where a test's purpose is `getResearchDataset()`'s logic rather than
`setResearchStatus()`'s own code-resolution (which has independent coverage in
`tests/qa-baseline-cleanup-regression.test.ts`/`tests/participant-provisioning-race.test.ts`).
Verified durable across 3+ consecutive full runs. This is a JSON-test-storage-only artifact — real
Postgres's `@unique` constraint on `participantCode` makes it structurally impossible in
production.

### Phase 5 — Existing synthetic residue

No work required — Phase 1's live-database audit already found zero out-of-range participant rows,
zero synthetic `P900000+` rows, and zero scans matching known test-fixture filenames. Re-verified
after Phase 2's code fix (below): still zero. No deletion was needed or performed.

### Phase 6 — Research dataset export

`ParticipantRepository.getResearchDataset()`'s row shape (`ResearchDatasetScanRow`) gained four
fields, all derived from data already persisted per scan, never fabricated:
`scanTimeMs` (verbatim from the persisted scan record), `totalFindings` (same value as the existing
`ruleCount`, exposed under the name analysis consumers expect), and
`architectureFindings`/`performanceFindings`/`accessibilityFindings`, computed from each scan's own
`diagnostics` array. Note on taxonomy (confirmed by reading
`src/matrix/four-layer-meta-model.ts`): there are exactly two top-level `domain` values,
`PERFORMANCE` and `ACCESSIBILITY` — "architecture" is not a third domain but a `concern` value
*within* `PERFORMANCE` (`domain: 'PERFORMANCE', concern: 'ARCHITECTURE'`), so `architectureFindings`
is correctly a sub-count of `performanceFindings`, not an independently invented category.

New: `app/api/admin/research-dataset/route.ts` — ADMIN-role-gated GET, calls
`ParticipantRepository.getResearchDataset()` directly with no reimplemented eligibility logic;
supports `?format=csv` (download) and JSON (default), and includes `primaryCount`/`secondaryCount`
summaries via the existing filter helpers. Added a matching "Export Research Dataset (CSV)" button
to the admin Research Metrics tab (`app/admin/page.tsx`), which fetches with the page's existing
Bearer-token auth and triggers a browser download via a Blob object URL (a plain `<a href>` can't
carry the Authorization header every other admin fetch on this page relies on).

## Verification

### Live database (read-only, authorized), after the Phase 2 code fix

```
totalUsers:                                  30
totalScans:                                1,077
LIVE_DB_PARTICIPANT_PATTERN_USERS:            0
REAL_STUDY_PARTICIPANT_COUNT (P001-P020):     0
CONSENT_VERIFIED_REAL_PARTICIPANTS:           0
OUT_OF_RANGE_ELIGIBLE_PARTICIPANT_ROWS:       0
SYNTHETIC_P900000_P989999_USERS:              0
KNOWN_TEST_ARTIFACT_FILENAME_SCANS:           0
REAL_RESEARCH_ELIGIBLE_SCAN_COUNT
  (getResearchDataset(), patched code, live data): 0
SYNTHETIC_TEST_ROWS_IN_RESEARCH_DATASET:      0
```

(User/scan counts grew slightly between the Phase 1 and this check — 29→30 users, 1,062→1,077
scans — from ordinary product usage between checks; nothing participant-related changed.)

### Test isolation

Verified live: running the test bootstrap with real `.env`/`.env.local` Supabase credentials and
`NODE_ENV=test` aborts the entire run before any test executes:

```
FATAL: refusing to run automated tests -- DATABASE_URL points at a real, hosted Supabase project. ...
```

```
TESTS_WRITE_TO_PRODUCTION_DB=NO
TEST_DATABASE_ISOLATION=PASS
```

### Test suite, type-check, and build

Two initial full-suite runs surfaced flakiness; both were investigated rather than dismissed:

- One run had a real regression from this pass's own changes
  (`participant-matrix-n-plus-1.test.ts`, a pre-existing test that already drew from the same
  P001-P020 range) — root-caused to the same JSON-test-storage duplicate-code class described in
  Phase 4, and fixed the same way.
- The same run (and a separate, earlier one deliberately run concurrently with `npm run build` to
  save time) showed native-crash exit codes (SIGABRT / access-violation codes) in three files
  (`ai-provider-fallback.test.ts`, `ai-remediation.test.ts`, `angular-template-ast.test.ts`)
  untouched by this work. Re-ran all three in isolation: 52/52 pass, 0 failures — confirming
  transient resource pressure from a long combined run/concurrent build, not a real regression.

Final, clean, isolated runs:

```
$ npm test
# tests 1526
# pass 1526
# fail 0

$ npx tsc --noEmit
(no output -- exit 0)

$ npm run build
✓ Compiled successfully
(includes ƒ /api/admin/research-dataset)
```

## Final status

```
REAL_PARTICIPANT_RANGE=P001..P020
RESEARCH_DATASET_RANGE_GUARD=PASS
CONSENT_GATE=PASS
PRIMARY_SECONDARY_POLICY=PASS
TEST_PRODUCTION_DB_ISOLATION=PASS
SYNTHETIC_DB_RESIDUE_CLEANED=YES (none existed to clean -- verified zero before and after)
RESEARCH_EXPORT_AVAILABLE=YES
REAL_HUMAN_PARTICIPANT_COUNT=0
RESEARCH_ELIGIBLE_SCAN_COUNT=0
SAFE_TO_BEGIN_REAL_COLLECTION=YES
```

Collection can begin by directing the first real participant to `/user-study`
(auto-assigns `P001`), then an admin clicking "Mark Consent Verified" on
`/admin/participants/P001` once that participant's real, external consent-form response is
reconciled, exactly as `docs/audit/CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md` already
described. No further code changes are required to start.
