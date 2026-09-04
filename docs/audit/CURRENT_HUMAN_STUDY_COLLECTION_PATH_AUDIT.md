# Current Human-Study Collection Path — Forensic Audit

Date: 2026-09-04
Scope: Phase 1–3 of the human-study data-collection audit request. Read-only. No code changed.

## Headline finding: the stated premise is false

The request assumes `/user-study` was "intentionally removed" and that a new collection path
must be built through the current Live Scanner. That is not what the repository shows.

`app/user-study/page.tsx` **exists, is fully implemented (583 lines), and is wired end-to-end**
through a real API/DB pipeline: anonymous session cookie → `P001`–`P020` assignment → consent
checkbox → real-engine scan → admin consent verification → a research-dataset query with
PRIMARY/SECONDARY attempt classification. `git log --oneline -- app/user-study/page.tsx` shows
10 commits building this out, most recently `61686e7a "research: freeze FIGM experiment baseline
v1"`. There is no deletion commit in history. The only uncommitted change to that file is a
7-line removal of inline rule-ID comments inside the fixture source strings shown in its code
viewer — cosmetic, not structural (`git diff HEAD --stat`: `app/user-study/page.tsx | 7 -`).

The observed symptoms in the prompt (Admin Participants 0/20, Research Metrics NOT_COLLECTED,
all research columns NULL) are **not evidence of broken/removed code** — they are the correct,
honest state of a system where **zero people have visited `/user-study` yet**. The pipeline is
built and tested; it has simply never been used by a real participant.

## Answers to the numbered Phase-1 questions

1. **Does a current route create P001–P020 records?** Yes. `GET /api/user-study/log-scan`
   (`app/api/user-study/log-scan/route.ts:51`) calls `assignNewParticipant()` whenever no valid
   session cookie exists. This fires automatically when `/user-study` loads
   (`app/user-study/page.tsx`'s mount effect) or when the participant clicks "New Participant"
   (`?fresh=1`).
2. **Does a current route call `assignNewParticipant()`?** Yes, one live call site, listed above.
   Not dead code — reachable from the page's first load.
3. **Does a current route establish participant-specific session identity?** Yes, via a
   dedicated anonymous JWT (`figm_study_token` cookie, `src/auth/study-session.ts`), fully
   decoupled from the real-user login system (`src/auth/auth-service.ts`'s
   `signResearchParticipantToken`/`verifyResearchParticipantToken`, carrying `kind:
   'research_participant'`). A prior audit found and fixed a confused-deputy bug where a
   participant token could also pass `verifyJWT()` and authenticate as a real logged-in user;
   the fix is the only diff currently uncommitted in `src/auth/auth-service.ts` (12 lines,
   `if (claim.kind) return null;`), and `tests/human-study-readiness.test.ts` covers it.
4. **Does Live Scanner associate scans with a research participant?** Split answer:
   - The **general-purpose** Live Scanner endpoint, `app/api/scan/route.ts`, does **not** —
     it has no concept of `participantCode`/`researchStatus` at all.
   - The **study-specific** endpoint, `POST /api/user-study/log-scan`, **does** — it re-runs the
     same `RuleExecutionEngine` the general scanner uses, then persists the result under the
     participant's real `user.id`. The `/user-study` page's scan button calls both endpoints per
     click: `/api/scan` for the live on-screen result, `/api/user-study/log-scan` to persist the
     research record.
5. **Is consent verification possible from the admin UI/API?** Yes.
   `app/admin/participants/[participantId]/page.tsx` has "Mark Consent Verified" / "Revoke
   Assignment" buttons (lines 262–277) that call `PATCH /api/admin/participants/[participantId]`
   (ADMIN-role-gated), which calls `ParticipantRepository.setResearchStatus()`.
6. **Is `researchConsentVerifiedAt` actually set anywhere?** Yes, and only there —
   `setResearchStatus()` sets it to `new Date().toISOString()` exactly when an admin transitions
   a participant to `CONSENT_VERIFIED` (`src/engine/participant-repository.ts:450`). It is never
   set automatically, by design (the doc comment explains it represents a human researcher
   reconciling an external consent-form submission against the participant code).
7. **Can the questionnaire be linked to a participant ID?** No, and this is deliberate, not a
   gap someone forgot to close. The questionnaire is an external Google Form
   (`app/user-study/page.tsx:96`, a hardcoded URL, not pre-filled with the participant code).
   Responses are later imported by `scripts/import-user-study.ts`, which assigns its **own**
   `P001`-style ids purely by row order in the CSV — explicitly documented
   (`participant-repository.ts:19–30`, `import-user-study.ts:71–77`,
   `research/DATA_COLLECTION_PROTOCOL.md §3.4`) as "two intentionally-uncorrelated ID spaces
   that happen to share the same visual format." A live-session `P002` and a questionnaire-import
   `P002` are not guaranteed to be the same person.
8. **Does `getResearchDataset()` enforce the four required conditions?** Yes, verified by
   reading `src/engine/participant-repository.ts:480–529` directly: filters users on
   `researchStatus === 'CONSENT_VERIFIED'` **and** `!!researchConsentVerifiedAt`, then filters
   each user's scans on `scan.createdAt >= consentVerifiedAt`. REVOKED participants fall out
   automatically since they never satisfy the `CONSENT_VERIFIED` check. Confirmed by running the
   test suite (below) — `tests/research-dataset-consent-gate.test.ts` exercises every branch.
9. **Is PRIMARY/SECONDARY classification intact?** Yes — correct logic
   (`participant-repository.ts:510–525`, groups eligible scans by `(userId, fileName)`, tags the
   earliest per group PRIMARY, later ones SECONDARY), and `tests/repeated-scan-attempt-policy.test.ts`
   passes. **Gap**: as of the current tree, `getResearchDataset()`,
   `filterPrimaryResearchAttempts()`, and `filterSecondaryResearchAttempts()` have **no live
   caller** in any `app/api/*` route or `scripts/*.ts` file — grepped directly, confirmed empty.
   They are exercised only by tests. The logic is correct and ready; nothing currently exports it.
10. **What exactly was changed re: `/user-study`?** Nothing structural. Working-tree diff vs
    HEAD across the three files touched:
    - `app/user-study/page.tsx`: −7 lines, cosmetic (inline rule-ID comment strings removed from
      the in-page code viewer).
    - `src/auth/auth-service.ts`: +12 lines, the `kind` claim confused-deputy fix (item 3).
    - `src/engine/participant-repository.ts`: +66/−14 lines, adds `attemptType` PRIMARY/SECONDARY
      to `getResearchDataset()`'s output and the two filter helpers (item 9). `getMatrix`,
      `getDetail`, `assignNewParticipant`, `setResearchStatus` are unchanged.
    No UI, no API route, and no DB column was removed. Nothing was deleted.

## Schema (already present, already migrated)

`prisma/schema.prisma` + `prisma/migrations/20260824150000_add_research_participant_fields/`:

```
participantCode           String?  @unique @map("participant_code")
researchStatus            ResearchParticipantStatus? @map("research_status")   -- enum: ASSIGNED | CONSENT_VERIFIED | REVOKED
researchAssignedAt        DateTime? @map("research_assigned_at")
researchConsentVerifiedAt DateTime? @map("research_consent_verified_at")
```

All four nullable, additive-only migration already applied. `scan_reports` has no
participant-specific column — attribution is via `users.participant_code` → `users.id` →
`scan_reports.user_id`, which is sufficient for everything `getResearchDataset()` needs.

## Test status

Ran `tests/human-study-readiness.test.ts`, `tests/repeated-scan-attempt-policy.test.ts`,
`tests/research-dataset-consent-gate.test.ts`: **19/19 pass**, covering session-tampering
rejection, the cross-auth-system `kind`-claim bypass, non-admin unable to set
`CONSENT_VERIFIED`, concurrent-assignment race safety, QA-signature exclusion, PRIMARY/SECONDARY
correctness, REVOKED/ASSIGNED-only zero-row enforcement, and the consent-timestamp boundary.

## Structured answers

```
OLD_USER_STUDY_PAGE_PRESENT=YES
CURRENT_PARTICIPANT_CREATION_PATH=app/api/user-study/log-scan/route.ts (GET) -> ParticipantRepository.assignNewParticipant()
CURRENT_CONSENT_VERIFICATION_PATH=app/admin/participants/[participantId]/page.tsx -> PATCH /api/admin/participants/[participantId] -> ParticipantRepository.setResearchStatus()
CURRENT_LIVE_SCANNER_RESEARCH_LINKAGE=PARTIAL — general /api/scan has none; the study-specific /api/user-study/log-scan endpoint (same engine, separate route) does
CURRENT_QUESTIONNAIRE_LINKAGE=External Google Form, not pre-filled with participant code; downstream CSV import (scripts/import-user-study.ts) assigns its own independent P-code sequence by design (research/DATA_COLLECTION_PROTOCOL.md §3.4) — not correlated to live session P-codes
CURRENT_RESEARCH_DATASET_GATE=PASS
CURRENT_PRIMARY_SECONDARY_POLICY=PASS (logic correct and tested, but has no live caller/export path yet)
```

## Recommendation

```
RECOMMENDED_COLLECTION_DESIGN=OTHER — the system already implements a hybrid of Option A/B; no
  new UI is needed. The existing /user-study page already IS the "research participant mode"
  wrapped around the same real scanner engine (Option A's intent), fed by a minimal
  onboarding/consent entry point (Option B's intent). Do not build a second page.

FILES_THAT_WOULD_CHANGE (to close the one real gap — no export/consumer for
  getResearchDataset()/PRIMARY-SECONDARY — e.g. an admin "Export Research Dataset" action):
  - New: app/api/admin/research-dataset/route.ts (ADMIN-gated GET, calls getResearchDataset())
  - Modified: app/admin/page.tsx (add an export button/link on the Participants or Research
    Metrics tab)
  Optional, only if the researcher explicitly wants it: link /user-study into primary nav, or
  add the participant's own P-code as a query param on the outbound Google Form link (this
  would break the documented "two uncorrelated ID spaces" anonymity design and needs explicit
  sign-off before touching, since it's a protocol change, not a bug fix).

DATABASE_MIGRATION_REQUIRED=NO — all four research columns already exist and are already migrated.

SAFE_TO_IMPLEMENT=YES for the export-path addition described above.
```

**Bottom line:** there is nothing to repair to *start* collecting P001–P020 through the current
app. The pipeline already exists, is tested, and is safe. The 0/20 and NOT_COLLECTED readouts
are accurate — no one has gone through `/user-study` yet. The only code gap worth closing before
or during the real study is exporting `getResearchDataset()`'s output somewhere reachable, which
is a small, additive, low-risk change. Everything else the prompt worried about (accidental
pre-consent inclusion, revoked-participant exclusion, PRIMARY/SECONDARY policy,
participant-vs-participant identity isolation) is already correctly implemented and covered by
passing tests.

Stopping here per the task's Phase 9 instruction — no implementation without explicit approval.
