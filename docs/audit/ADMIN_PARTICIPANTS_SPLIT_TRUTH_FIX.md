# Admin Participants "Split Source of Truth" — Root Cause & Fix

Date: 2026-09-07
Scope: `POST /api/user-study/enroll` correctly returned a P-code, but `GET /api/admin/participants`
reported that same participant as `NOT_REGISTERED` / `registeredCount: 0`.

## 1. Both paths traced end to end

```
A. POST /api/user-study/enroll
   app/api/user-study/enroll/route.ts
   → authenticateUser(request)                              (real JWT/cookie)
   → ParticipantRepository.enrollAuthenticatedUserAsParticipant(userId)
   → ParticipantRepository.provider  ==  RepositoryFactory.getStorageProvider()
   → provider.updateUser(userId, { participantCode, researchStatus: 'ASSIGNED', researchAssignedAt })
     (SupabaseStorageProvider.updateUser -> real Prisma `user.update()` in production)
   → [NEW] provider.findUserById(userId) re-read, verified before ever returning success

B. GET /api/admin/participants
   app/api/admin/participants/route.ts
   → authorizeRole(request, ['ADMIN'])
   → ParticipantRepository.getMatrix()
   → ParticipantRepository.provider  ==  RepositoryFactory.getStorageProvider()   <-- SAME call
   → provider.getAllUsers()                                                       <-- SAME provider
   → filters via ParticipantRepository.isParticipantUser(u)  <-- THE BUG
```

**Both paths resolve through the exact same `RepositoryFactory.getStorageProvider()` memoized
singleton** — confirmed directly (new test 6: reference-equality check) and by construction (there
is only ever one `RepositoryFactory.instance` per process; in production that's one
`SupabaseStorageProvider`, one Prisma client, one Postgres connection). **There was never a
JSON-vs-Supabase split, and enrollment never wrote to a different backend than the admin read.**

## 2. The actual mismatch: `isParticipantUser()`

```ts
// BEFORE (src/engine/participant-repository.ts)
private static isParticipantUser(u: DBUser): boolean {
  return PARTICIPANT_ID_PATTERN.test(u.id) || u.email.endsWith('@user-study.figm.local');
}
```

This predates `enrollAuthenticatedUserAsParticipant()` (added in
`docs/audit/NORMAL_LIVE_SCAN_RESEARCH_INTEGRATION.md`'s pass) and only ever recognized the OLD
anonymous-shadow-account signals:
- an `id` that itself happens to be `P001`-shaped (only true for pre-migration rows, or rows from
  `assignNewParticipant()`'s shadow-account model), or
- an email ending in `@user-study.figm.local` (also only `assignNewParticipant()`'s convention).

A user enrolled via `enrollAuthenticatedUserAsParticipant()` keeps their own real `usr_...` id and
their own real email — **neither legacy signal is ever true for them**, even though
`participantCode` (the actual authoritative field, per its own doc comment in
`src/engine/participant-repository.ts`) is correctly set to `'P001'`.

`getMatrix()` (backing the admin endpoint) and `countAssigned()` both gate on
`isParticipantUser()` — so a real, successfully-enrolled participant was silently filtered out of
both, exactly reproducing the reported symptom.

**Why nothing else broke**: `getResearchDataset()` and `usedParticipantNumbers()` (the
next-available-code allocator, used by both enrollment methods) already checked
`u.participantCode` *first*, falling back to the legacy checks only when it's absent. That's why
every prior enrollment/consent/research-dataset test kept passing — none of them exercised
`getMatrix()`/`GET /api/admin/participants` for a same-row-enrolled user specifically, which is
exactly the coverage gap this incident exposed.

## 3. Fix

```ts
// AFTER
private static isParticipantUser(u: DBUser): boolean {
  return (
    (!!u.participantCode && PARTICIPANT_ID_PATTERN.test(u.participantCode)) ||
    PARTICIPANT_ID_PATTERN.test(u.id) ||
    u.email.endsWith('@user-study.figm.local')
  );
}
```

`participantCode` is now checked first, matching the priority every other correct call site
already used. The two legacy checks remain as fallbacks for old shadow-account rows.

## 4. One canonical storage path — already true, now also verified at write time

No call site needed to change providers — `enrollment`, `getOwnParticipantStatus`, the admin
matrix, `setResearchStatus`, and `getResearchDataset` all already resolve through the identical
`RepositoryFactory`-selected provider. What *was* missing was write-time confidence:
`enrollAuthenticatedUserAsParticipant()` now re-reads the user row through that same provider
immediately after the write and verifies `participantCode`/`researchStatus` actually match before
ever returning a P-code to the caller — if verification fails, it throws instead of reporting
success (proven by a dedicated test using a fake provider whose write "succeeds" but whose re-read
returns stale data).

## 5. Regression coverage

`tests/admin-participants-split-truth-fix.test.ts` (8 tests):
1. Enrollment returns a real P-code.
2. Self-check (`GET /api/user-study/enroll`) reflects it.
3. **The exact bug**: `GET /api/admin/participants` shows the same code as registered/`ASSIGNED`
   with the correct `linkedUserId`, and `registeredCount >= 1`.
4. Admin verification flows through correctly, and a subsequent real `/api/scan` call lands in
   `getResearchDataset()`.
5. Re-enrolling the same user is idempotent (same code, `alreadyEnrolled: true`) — no duplicate.
6. Both paths use the identical provider (reference-equality check).
7. A second test proves a write whose re-read can't confirm success throws rather than reporting a
   fake P-code.

No production data was touched — all coverage runs against the isolated JSON test-storage backend
(confirmed by the existing `db-safety-guard`/`test-env-setup.mjs` fail-fast guard, and by this
session's ambient shell having no `DATABASE_URL`).

## Final status

```
ROOT_CAUSE=ParticipantRepository.isParticipantUser() never recognized a user enrolled via the newer enrollAuthenticatedUserAsParticipant() same-row path -- it only checked legacy shadow-account signals (P-shaped id, @user-study.figm.local email), never the authoritative participantCode field. getMatrix()/countAssigned() (backing GET /api/admin/participants) silently filtered these real participants out entirely.
ENROLLMENT_STORAGE_PROVIDER=RepositoryFactory.getStorageProvider() (SupabaseStorageProvider/Prisma in production)
ADMIN_PARTICIPANTS_STORAGE_PROVIDER=RepositoryFactory.getStorageProvider() (identical singleton -- same instance, confirmed by reference equality)
SPLIT_SOURCE_OF_TRUTH_FOUND=NO (same provider both sides; the bug was an application-level recognition-logic gap in isParticipantUser(), not a storage-backend split)
ENROLLMENT_PERSISTS_TO_PRODUCTION_USER_ROW=PASS
POST_WRITE_REREAD_VERIFICATION=PASS (new safety net added and tested)
ADMIN_API_SEES_ENROLLED_P001=PASS
REGISTERED_COUNT_AFTER_ENROLLMENT=1
RESEARCH_DATASET_LINKAGE=PASS (was never actually broken)
```
