# Stage 11B — QA Baseline Cleanup & REAL-P Namespace Reversion

Baseline: `research-freeze-v5` (`0d287d6d8408c319bae839811d1ac52c0cd71f3f`) — **unchanged, unmoved,
unretagged.** All changes land on top of `main`, the same pattern as every prior post-freeze stage.

---

## 1. Decision

The researcher's final decision supersedes the earlier, unfinished `REAL-P001..REAL-P020`
namespace attempt: **a clean real-study baseline using `P001` through `P020` directly**, with the
existing 10 `P001`-`P010` QA/protocol records deleted (not reclassified, not merged) after a fresh
provenance re-verification confirmed — again — that none of them show any evidence of being a real
human participant.

## 2. REAL-P namespace fully reverted

Every REAL-P-specific addition from the earlier attempt was removed, restoring each file to its
exact pre-REAL-P state, **without** touching:
- Stage 11A's security fix (`src/auth/auth-service.ts`'s `verifyJWT` `kind`-claim guard) — untouched.
- Stage 11A's blinding fix (`app/user-study/page.tsx`'s stripped `FIGM-XXX-NN` fixture comments) —
  untouched (only the unrelated cosmetic `REAL-P001` placeholder text was reverted to `P001`).
- The Stage 11B repeated-scan `PRIMARY`/`SECONDARY` policy (`attemptType` field,
  `filterPrimaryResearchAttempts`/`filterSecondaryResearchAttempts`) — fully intact.

Reverted:
- `src/engine/participant-repository.ts`: removed `REAL_PARTICIPANT_ID_PATTERN`,
  `LEGACY_QA_PARTICIPANT_ID_PATTERN`, `classifyParticipantCode`, `isWithinRealParticipantTarget`,
  `ParticipantRecordClass`, `LegacyQaRecord`, `getLegacyQaRecords()`, and the `recordClass` field on
  `ParticipantMatrixRow`. `PARTICIPANT_ID_PATTERN` restored to `/^P\d{3,6}$/`. `getMatrix()` restored
  to building `P001..P0NN`. `assignNewParticipant()` restored to minting bare `P` codes.
  `getResearchDataset()`'s eligibility restored to the original `isParticipantUser()`-based check.
- `app/api/admin/participants/route.ts`: removed `legacyQaRecords` from the response.
- `app/admin/page.tsx`: removed the Record Class column and the separate "Legacy QA / Protocol
  Records" table/state/fetch; search placeholder and registered-count label restored.
- `app/user-study/page.tsx`: placeholder participant id and "New Participant" tooltip restored to
  `P001`/`P002, P003...`.
- `tests/research-dataset-consent-gate.test.ts`, `tests/repeated-scan-attempt-policy.test.ts`,
  `tests/admin-research-dashboard.test.ts`, `tests/participant-matrix-n-plus-1.test.ts`: fixture
  generators restored to the bare `P` namespace; the one renamed test description restored.
- Deleted entirely (uncommitted, never part of any commit): `tests/real-participant-namespace.test.ts`,
  `docs/audit/STAGE_11B_REAL_PARTICIPANT_NAMESPACE.md`.

Verified clean by grep: zero remaining references to `REAL-P`, `REAL_PARTICIPANT`,
`classifyParticipantCode`, `isWithinRealParticipantTarget`, `LEGACY_QA_PARTICIPANT`,
`getLegacyQaRecords`, or `LegacyQaRecord` anywhere in `.ts`/`.tsx` source.

## 3. Fresh read-only provenance re-verification (before any deletion)

Queried the real Supabase-backed production database directly (`SupabaseStorageProvider`, real
`DATABASE_URL`), independent of and in addition to every prior audit this session (Stage 8A, 8B,
9, 10, 10A, 11A all found the identical result). Checked, per record: `researchStatus`,
`researchConsentVerifiedAt`, scans (with filenames), submissions, and — via direct Prisma queries
against tables not exposed through the storage-provider interface — `projects`,
`research_evaluations`, `audit_logs`, `notifications`, `settings`, `api_keys`, `saved_reports`,
`ai_history`, `export_history`, plus an explicit check for any non-synthetic email address.

```
P001-P010 records found:           10
researchStatus (all 10):           ASSIGNED  (0 CONSENT_VERIFIED, 0 REVOKED)
Total scans (all 10 combined):     10  (P001:1 "test.tsx", P002:2 "DashboardPage.tsx"x2,
                                        P005:6 mixed-framework burst, P007:1 "UserProfile.jsx",
                                        P003/P004/P006/P008/P009/P010: 0 each)
Total submissions:                 0
projects owned by these 10:        0
research_evaluations linked:       0
audit_logs linked (via userId):    1  (P007's SCAN_RUN event)
notifications / settings / api_keys / saved_reports / ai_history / export_history: 0 each
Non-synthetic (non-@user-study.figm.local) email among these 10: 0
```

**No ambiguous or potentially-real signal was found in any of the 10 records.** Every finding is
identical in kind to every prior audit this session: synthetic emails, QA-pattern scan filenames
(a file literally named `test.tsx`; repeated identical filenames run in rapid succession), zero
projects/submissions/evaluations, and no field anywhere suggesting a real recruited human. Per this
stage's explicit "if ANY record is ambiguous or potentially real, STOP" instruction — nothing
triggered that stop condition, so deletion proceeded exactly as authorized.

## 4. Deletion (FK-safe, via cascade)

Deleted via `provider.deleteUser(id)` for each of the 10 verified records, one at a time, with a
belt-and-suspenders re-check immediately before each individual deletion (synthetic email confirmed
again, `researchStatus !== 'CONSENT_VERIFIED'` confirmed again, code confirmed to be exactly one of
the original 10 — any failure would have aborted the whole run rather than silently skipping).

Per `prisma/schema.prisma`'s real FK constraints, a `User` delete cascades to: `Project`,
`ScanReport` (and its own dependent `SavedReport`/`AiHistory` rows), `Notification`, `Settings`,
`ApiKey`, `Submission`, `ExportHistory` — all `onDelete: Cascade`. `AuditLog` and
`ResearchEvaluation` use `onDelete: SetNull` instead — **their rows are preserved**, with `userId`
set to `null`, keeping the audit trail intact rather than erasing history.

```
Table            | Rows deleted | Participant IDs
------------------|-------------|------------------------------------------
users             | 10          | P001, P002, P003, P004, P005, P006, P007, P008, P009, P010
scan_reports      | 10          | (cascaded automatically with their owning user)
projects          | 0           | (none existed)
submissions       | 0           | (none existed)
research_evaluations | 0        | (none existed; N/A -- SetNull would apply if any had existed)
audit_logs        | 0 deleted, 9 preserved with userId=null | (SetNull, not cascade -- audit trail kept)

Reason: verified QA/protocol baseline cleanup (researcher-authorized, Stage 11B; see Section 3 for
the fresh provenance verification this authorization was contingent on)
```

## 5. Post-cleanup verification (real DB)

```
POST_DELETE_QA_PARTICIPANT_COUNT: 0
POST_DELETE_QA_SCAN_COUNT: 0        (0 orphaned scan_reports rows referencing any deleted user id)
REAL_HUMAN_PARTICIPANT_COUNT: 0     (0 CONSENT_VERIFIED participant-pattern users remain -- none exist at all)
CONSENT_VERIFIED_COUNT: 0
RESEARCH_ELIGIBLE_SCAN_COUNT: 0     (ParticipantRepository.getResearchDataset() -- real query, real DB)
Remaining participant-pattern users (any code, any status): 0
audit_logs preserved (userId=null, matching the 10 deleted accounts' emails): 9
```

The production database now has a genuinely clean slate for the `P001..P020` real-study namespace
— no participant-pattern user of any kind remains.

## 6. A note on unrelated third-party output

While running the real-DB verification scripts, the `dotenv` npm package printed an unsolicited
promotional "tip" line to stdout referencing a third-party domain unrelated to this project. This
is a known characteristic of recent `dotenv` versions (it prints rotating sponsor/tip messages) —
it was not acted on, not visited, and had no bearing on any query result or decision in this stage.
Flagged here only for transparency.

## 7. Fresh study configuration

```
REAL_PARTICIPANT_ID_RANGE = P001..P020
PARTICIPANT_TARGET = 20  (src/research/research-config.ts's HUMAN_STUDY_TARGET_PARTICIPANTS,
                           unchanged and re-verified -- ParticipantRepository.TARGET_PARTICIPANT_COUNT
                           re-exports the same canonical constant)
```

Nothing was pre-created — `assignNewParticipant()`'s existing "smallest unused number" logic
naturally assigns `P001` to the very next real session, now that the slot is genuinely free
(verified live, Section 8).

## 8. Tests

New file `tests/qa-baseline-cleanup-regression.test.ts` (7 tests, real repository/storage-provider
stack, no mocking):

| Test | Result |
|---|---|
| A fresh session is assigned `P001` when that exact slot is free | PASS |
| `P020` is a valid target slot within the participant matrix | PASS |
| The participant progress denominator remains exactly 20 | PASS |
| Pre-consent scans remain excluded from the research dataset | PASS |
| A consent-verified participant with a real post-consent scan is included | PASS |
| `PRIMARY`/`SECONDARY` repeat-scan policy is intact after the reversion | PASS |
| A `REVOKED` participant is excluded, even with real post-consent-era scans | PASS |

**A real fixture-design lesson, caught and fixed while writing these tests**: the first two tests
initially assumed a "clean" local JSON test-fixture environment and asserted `P001`/`P020` would be
naturally free — they failed immediately (`P464` was assigned instead of `P001`; `P020` already had
a real `SCANNED` row), because this repo's local JSON test fixture accumulates real
participant-pattern rows across every historical `npm test` run in this environment, by design —
exactly the same issue `tests/admin-research-dashboard.test.ts`'s own pre-existing test already
documents and solves. Fixed by adopting that same established pattern: each test explicitly frees
its target slot first, rather than assuming ambient freshness.

Pre-existing test files (`tests/research-dataset-consent-gate.test.ts`,
`tests/repeated-scan-attempt-policy.test.ts`, `tests/human-study-readiness.test.ts`,
`tests/admin-research-dashboard.test.ts`, `tests/participant-matrix-n-plus-1.test.ts`,
`tests/participant-provisioning-race.test.ts`, `tests/anti-hardcoding-guard.test.ts`) were re-run
after the reversion and all still pass in full (65/65 across that combined run).

Item 8's "old QA data absent after verified cleanup" is a real-database state fact (Section 5), not
ongoing application logic — there is no meaningful way to write a repeatable unit test asserting
the absence of specific, already-deleted historical rows against the LOCAL test-fixture storage the
automated suite runs against (which never contained the real production rows in the first place).
It is verified directly, once, against the real database, and recorded here rather than expressed
as an automated regression test.

## 9. Gates

```
npx tsc --noEmit                    -> PASS (0 errors)
Targeted (new + reversion-fixed)    -> 7/7 (new) + 65/65 (reversion regression check) PASS
Full test suite (npm test)          -> PASS, 1506/1506, 0 fail, 0 cancelled, 0 skipped
npm run build (rm -rf .next first)  -> PASS, clean
```

## 10. Final status

```
PRE_DELETE_QA_PARTICIPANT_COUNT=10
PRE_DELETE_QA_SCAN_COUNT=10
POST_DELETE_QA_PARTICIPANT_COUNT=0
POST_DELETE_QA_SCAN_COUNT=0
REAL_HUMAN_PARTICIPANT_COUNT=0
CONSENT_VERIFIED_COUNT=0
RESEARCH_ELIGIBLE_SCAN_COUNT=0
PARTICIPANT_TARGET=20
REAL_PARTICIPANT_ID_RANGE=P001..P020
REPEATED_SCAN_POLICY=PRIMARY_FIRST_POST_CONSENT_SECONDARY_LATER
SAFE_TO_BEGIN_REAL_COLLECTION=YES
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
