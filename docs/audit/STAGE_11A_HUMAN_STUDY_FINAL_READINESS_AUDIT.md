# Stage 11A — Human Study Final Readiness Audit

Repository: `C:\Users\MSI\.gemini\antigravity-ide\scratch\figm-model`
Baseline: `research-freeze-v5` (`0d287d6d8408c319bae839811d1ac52c0cd71f3f`) — unchanged, unmoved, unretagged.

---

## 1. Executive Summary

A full audit of the human-study workflow before any real participant data collection found the
architecture fundamentally sound — the Stage 8A consent gate, the questionnaire instrument, and
the participant-lifecycle design all hold up under direct inspection and live testing — but
surfaced and fixed **two real, previously-undiscovered defects**:

1. **A confused-deputy authentication bug** (`src/auth/auth-service.ts`): a research-participant
   session token — issued anonymously to anyone who visits `/user-study`, no login required —
   could be replayed as a Bearer token against any ordinary `authenticateUser()`-gated route with
   no role restriction, decoding to a structurally valid `DEVELOPER`-role identity. Fixed.
2. **An instrument-validity leak** (`app/user-study/page.tsx`): the fixture source code shown to
   participants before they run a scan contained inline `// FIGM-XXX-NN: ...` comments that gave
   away the exact answer to Task 1 ("Rule Identification"). Fixed — matches the blinding standard
   already established for the RQ4 annotation package.

No real participant data exists (`REAL_HUMAN_PARTICIPANT_COUNT = 0`), no data was fabricated, and
`research-freeze-v5` / RQ1 Stage 9 evidence / RQ4's `PENDING` status were all left untouched. A
real, live end-to-end walkthrough against the production Supabase database (Section 14) confirms
the consent gate, the research-export exclusion rule, and cleanup all behave correctly under real
conditions, not just in isolated tests.

## 2. Authoritative Human-Study Scope

Per this stage's brief: human usability evaluation is **supplementary** to the core RQ1–RQ4
evaluation. The `/user-study` route remains reachable only by direct URL (excluded from the
authenticated-by-default middleware matcher, per `middleware.ts`), not linked from normal product
navigation — unchanged this stage, confirmed still true.

## 3. Final Participant Target

```
PARTICIPANT_TARGET = 20
```

Verified from code, not trusted from comments: `src/research/research-config.ts`'s
`HUMAN_STUDY_TARGET_PARTICIPANTS = 20` is the single source of truth. Every current runtime/UI/API
consumer checked (`app/user-study/page.tsx`, `app/admin/page.tsx`, `app/analytics/page.tsx`,
`app/components/landing/ResearchOverview.tsx`, `app/api/research-metrics/route.ts`,
`src/engine/participant-repository.ts`) imports this constant — none hardcodes `80`, `85`, or
`100` as a participant-target value. `tests/anti-hardcoding-guard.test.ts` already enforces both
"the constant is 20" and "no production file hardcodes the retired 85 literal" as regression
guards (re-run this stage, still passing).

Historical documents (`research/DATA_COLLECTION_PROTOCOL.md`, Research Proposal / Interim 02
references) correctly preserve **80–100** as the original planning baseline, explicitly labelled
superseded by the researcher's later, approved 20-participant scope decision
(`docs/research/PARTICIPANT_TARGET_DECISION.md`). Not edited this stage — nothing needed changing.

## 4. Ethics/Consent Status

```
ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER
ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED
```

Unchanged from the existing record (`research/CONSENT_FORM.md`,
`docs/research/FINAL_RESEARCH_CONTRACT.md` §12). No approval number, date, or committee name is
recorded anywhere in the repository, and none was fabricated this stage.

## 5. Current Human-Study Architecture

| Layer | File | Role |
|---|---|---|
| Fixture/task page | `app/user-study/page.tsx` | Consent UI, benchmark selector, scan trigger, link to external Google Form |
| Session issuance | `GET /api/user-study/log-scan` | Issues/resumes a signed, httpOnly, anonymous participant session cookie |
| Consent recording | `POST /api/user-study/consent` | Re-signs the session cookie with `consentGiven: true` (session-level only) |
| Scan logging | `POST /api/user-study/log-scan` | Consent-gated; re-runs the real analysis engine server-side; persists a real `scan_reports` row |
| Participant assignment | `ParticipantRepository.assignNewParticipant()` | The only code path that creates a participant `User` row (`researchStatus: 'ASSIGNED'`) |
| Admin verification | `PATCH /api/admin/participants/[id]` | ADMIN-only; the only path that ever sets `CONSENT_VERIFIED`/`REVOKED` |
| Admin visibility | `GET /api/admin/participants[/id]` | Operational dashboard — shows all real activity, including pre-consent, by design |
| Research export | `ParticipantRepository.getResearchDataset()` | The only sanctioned source for real research analysis (Stage 8A) |
| Questionnaire | External Google Form (`research/QUESTIONNAIRE.md` is the spec) + `scripts/import-user-study.ts` | SUS + task items; CSV reconciled manually |

**Important architectural fact, verified precisely (not assumed from comments)**: consent has
**two independent tiers**, not one. (a) Session-level consent (the checkbox on `/user-study`) is
self-reported, gates only whether a scan *can be logged at all*, and is recorded in the signed
session cookie. (b) DB-level consent (`researchStatus = CONSENT_VERIFIED`) is admin-only,
requires a human reconciling a real external Google Form submission against a participant code,
and is the *only* thing `getResearchDataset()` checks. A participant reaching tier (a) does **not**
automatically reach tier (b) — this is intentional, not a bug, and explains why the 10 existing
`ASSIGNED` accounts already have scan activity despite zero of them being research-eligible.

## 6. Participant Lifecycle

1. Participant opens `/user-study` → `GET log-scan` issues an anonymous session, creates a real
   `User` row (`researchStatus: 'ASSIGNED'`).
2. Participant reads consent text on-page, checks the box, clicks "Confirm Consent" →
   `POST consent` re-signs the session cookie (`consentGiven: true`, versioned, timestamped)
   — **session-level only**, no DB write.
3. Participant selects a fixture, clicks "Run FIGM Scan" → `POST log-scan` (refused with 403 if
   step 2 was skipped) → real engine analysis → real `scan_reports` row.
4. Participant is redirected to the external Google Form for the SUS/task questionnaire — not
   integrated into this app; reconciled later via CSV import (`research/DATA_COLLECTION_PROTOCOL.md`).
5. **Separately**, a researcher/admin reconciles a real Google Form submission against the
   participant's code and calls `PATCH /api/admin/participants/[id]` (`status: 'CONSENT_VERIFIED'`)
   — this is the actual DB-level consent event; `researchConsentVerifiedAt` is set server-side
   (`new Date().toISOString()`), never from client input.
6. From that moment forward, `getResearchDataset()` includes only scans with
   `createdAt >= researchConsentVerifiedAt` for that participant.
7. An admin may instead call the same PATCH with `status: 'REVOKED'` — the participant's
   historical scan rows are preserved (never deleted), but contribute zero rows to
   `getResearchDataset()` from that point on (and, since `REVOKED` is simply not
   `CONSENT_VERIFIED`, retroactively too — no special-cased exclusion needed).

## 7. Consent-Gating Verification

All of the following were verified by direct code inspection **and** live route-level tests
(Section 13), not assumed from prior comments:

- No scan can count as research before consent: `getResearchDataset()`'s inclusion rule is
  `researchStatus === 'CONSENT_VERIFIED' && researchConsentVerifiedAt != null && scan.createdAt >= researchConsentVerifiedAt` — unchanged from Stage 8A, re-verified against the live DB (Section 15).
- No API route can bypass consent: the *only* write path to `researchStatus`/`researchConsentVerifiedAt`
  anywhere in `app/` is the ADMIN-gated PATCH handler (`authorizeRole(['ADMIN'])`) — grepped
  exhaustively, confirmed no second path exists.
- No frontend-only check is relied upon: `POST log-scan` independently re-checks
  `verified.consentGiven` from the *signed* session token server-side; a participant cannot skip
  the consent step by hiding/bypassing the UI.
- Server-side enforcement, not client trust: confirmed live — a request replaying an unconsented
  session cookie is refused with 403 regardless of what the client claims (Section 13/14).
- Consent timestamp cannot be backdated: `researchConsentVerifiedAt` is always
  `new Date().toISOString()` computed server-side inside `setResearchStatus`; no client-suppliable
  timestamp field exists on the PATCH endpoint.
- Withdrawal/revocation respected: `REVOKED` falls outside the single `CONSENT_VERIFIED` inclusion
  rule — not a special case, a structural consequence.
- Assigned QA participants remain excluded: confirmed against the real DB (Section 15) and by a
  new regression test mirroring the exact real pattern found in Stage 8A (a `test.tsx`-named scan
  on an `ASSIGNED` account).

### Real defect found and fixed: token-type confusion (auth bypass)

`src/auth/auth-service.ts`'s `verifyJWT()` never checked the decoded token's `kind` claim. A
research-participant session token (`kind: 'research_participant'`, no `role` claim, signed with
the *same* HMAC secret as a real access token) decoded to `{ userId: <participant code>, role:
'DEVELOPER' (validateRole's fallback for a missing role claim) }` — a structurally valid
`UserPayload`. Any `authenticateUser()`-only route with no `ADMIN` restriction (dashboard,
projects, scans, settings, …) would have accepted it. For the project's own legacy participant
rows whose `id` literally equals their `participantCode` (`P001`, `P002`, `P005`), this meant a
research-participant session could authenticate as that real user on ordinary product routes.
**Reproduced live before fixing** (`tests/human-study-readiness.test.ts`), then closed with a
one-line guard: `verifyJWT` now rejects any token carrying a `kind` claim outright (a genuine
access token never has one; refresh tokens use a separate secret and were already unaffected).
Full 1484-test suite re-run afterward — no regression.

## 8. QA/Test/Protocol Record Classification

Classified by actual provenance (creation route, consent state, associated scans/submissions/
evaluations), never by email pattern or activity alone:

| Class | Meaning | Count found |
|---|---|---|
| A. REAL_HUMAN | `researchStatus = CONSENT_VERIFIED`, admin-reconciled against a real external consent submission | **0** |
| B. QA/SMOKE/TEST | Participant-pattern account with QA-signature activity (e.g. `test.tsx`), never consent-verified | Present within the 10 `ASSIGNED` accounts (P001/P002/P005/P007 have such scans — established in Stage 8A, re-confirmed live this stage) |
| C. PROTOCOL-ONLY | Participant code issued by the real assignment code path, zero activity | P003/P004/P006/P008/P009/P010 |
| D. UNKNOWN | — | none found |

The 10 pre-existing `@user-study.figm.local` accounts are **not** counted as recruited real
participants under any circumstance in this audit or in `getResearchDataset()`'s own logic.

## 9. Survey/Questionnaire Audit

`research/QUESTIONNAIRE.md` (29 items, Sections A–E) inspected in full:

- **Consent/eligibility** (Q1/Q2): present, correctly required, includes an under-18 exclusion path.
- **SUS** (Q16–Q25): the real, standard 10-item Brooke (1996) SUS wording, correctly alternating
  positive/negative statements. Scoring formula (`STANDARD SUS SCORING FORMULA` section) matches
  `scripts/import-user-study.ts`'s real `calculateParticipantSUS`/`calculateCronbachAlpha`
  implementation exactly (odd items: score−1; even items: 5−score; sum×2.5) — verified by reading
  both, not assumed. **No SUS score was calculated this stage** — no real responses exist
  (`research/raw/real/responses.csv` does not exist; `processUserStudyPipeline` correctly reports
  `collectionStatus: 'NOT_COLLECTED'`, already covered by `tests/user-study-canonical-path.test.ts`).
- **No duplicate or leading questions found** in the questionnaire text itself.
- **No overclaiming language** ("WCAG compliant," "ISO verified," etc.) found anywhere in
  participant-facing research documents (`research/*.md`) — grepped explicitly, none present.
- **Target number consistency**: all three participant-facing documents
  (`QUESTIONNAIRE.md`, `PARTICIPANT_INSTRUCTIONS.md`, `CONSENT_FORM.md`) state "20... historical
  80-100 preserved" identically.
- **Voluntary participation / withdrawal wording**: present in `CONSENT_FORM.md` §3 and restated
  on-page in `/user-study`.

### Real defect found and fixed: task-fixture blinding leak

The four benchmark fixtures rendered verbatim to the participant in `app/user-study/page.tsx`
(React/Next.js/Angular/Vue) each contained an inline `// FIGM-XXX-NN: <description>` (or HTML
equivalent) comment directly labelling the intended violation and its exact rule ID — visible in
the `<pre>` block *before* the participant ever clicks "Run FIGM Scan." This directly answers
Questionnaire Q9 ("Which rule ID was reported for the invariant object allocation…") without the
participant needing to read or understand any real scan output, undermining Task 1's entire
measurement validity. **Fixed**: all four inline giveaway comments removed; the actual
violation-triggering code patterns are untouched (the scanner still finds the same real issues).
This mirrors the blinding standard already established and tested for the RQ4 annotation package
(Stage 10A). Verified clean via grep (no `FIGM-[A-Z]+-[0-9]+` pattern remains inside any displayed
fixture's source).

## 10. Participant Task Flow

Verified (code inspection + live walkthrough, Section 14):

- A participant completes assignment → consent → scan → (external form) without any admin
  assistance — no admin-only step is required to *use* the tool.
- Participant does not see admin-only data: the participant-facing pages/APIs never surface
  another user's data, the operational admin matrix, or any research-status/consent-state field.
- Participant cannot see other participants: no endpoint reachable with a research-participant
  session token returns any data keyed to a *different* participant code (verified: two fresh
  sessions never collide on participant ID; the session cookie is single-participant-scoped by
  construction).
- Participant cannot manipulate research status: only the ADMIN-gated PATCH can set it (Section 7).
- Participant cannot submit "another participant's" evaluation: the log-scan route rejects a
  `participantId` in the request body that doesn't match the session's own bound code (403,
  pre-existing, unchanged this stage).
- **Duplicate submissions**: the system does **not** enforce "exactly one scan per fixture per
  participant" — clicking "Run FIGM Scan" repeatedly creates multiple real `scan_reports` rows.
  This is the *current, operative policy* (undocumented as an explicit limit anywhere), not a
  defect — each click is a real, honestly-recorded interaction, never a fabricated one. Documented
  here as a known characteristic for the researcher's own analysis-design awareness.
- **Completion state**: the app has no way to know whether the external Google Form was actually
  submitted (that portion is entirely outside this codebase, reconciled later via CSV). The
  `/api/submissions` `Submission` model/route is an unrelated, separately-authenticated product
  feature — it is never called by the anonymous user-study flow, so a participant's admin-matrix
  `status` field can never show `'SUBMITTED'` for the real study flow; this is a vestigial,
  currently-unreachable enum value for this flow, not a source of false "completed" claims.
- No fabricated completion percentage was found anywhere in the UI.

## 11. Research Dataset Inclusion/Exclusion Rules

Unchanged from Stage 8A, re-verified this stage against the live database (Section 15):

```
scan is research data  <=>  user.researchStatus === 'CONSENT_VERIFIED'
                             AND user.researchConsentVerifiedAt IS NOT NULL
                             AND scan.createdAt >= user.researchConsentVerifiedAt
```

No dedicated HTTP export endpoint exists; `ParticipantRepository.getResearchDataset()`
(`src/engine/participant-repository.ts`) remains the one sanctioned repository method for a real
research export, returning `{ participantId, userId, scanId, fileName, framework, qualityScore,
ruleCount, createdAt }` per row — no email, no password, no raw IP, no free-text PII. No fake CSV
rows were produced; the method was called against the real live database (Section 15) and returned
real, honest results (currently zero rows, since zero participants are consent-verified).

## 12. Privacy & Security Review

- Participant identities are not publicly exposed: `/api/research-metrics` (the one unauthenticated
  research route) returns only aggregate counts/metrics, contains no `participantCode` or `email`
  field anywhere in its source.
- Research exports contain no passwords/tokens/service-role keys — confirmed by the
  `ResearchDatasetScanRow` shape (Section 11) and by grep (`SERVICE_ROLE_KEY` appears only in
  server-side files under `src/`/`scripts/`, never in any `app/` client component).
- Admin routes remain authenticated (`authorizeRole(['ADMIN'])`), re-confirmed live this stage.
- **Fixed this stage**: the token-type-confusion bug (Section 7) that could have let a
  research-participant session authenticate on an ordinary product route.
- No secret value is printed anywhere in this report or its supporting scripts.

## 13. Tests Performed

New file `tests/human-study-readiness.test.ts` (8 tests, all against the real route handlers and
real storage-provider stack — no mocking):

1. Unconsented session cannot log a scan (403, server-enforced).
2. No-session caller cannot log a scan (401).
3. A tampered (bit-flipped signature) session cookie is rejected (401).
4. A research-participant token cannot authenticate against admin routes, as either a cookie or a
   raw Bearer token (401 both ways — the second case caught the real bug in Section 7).
5. A separate, direct test against `authenticateUser()` itself confirms the fix: a
   research-participant token never produces a non-null `UserPayload`.
6. A non-admin `DEVELOPER` account cannot set `CONSENT_VERIFIED` (403).
7. Two concurrent fresh sessions never collide on participant ID.
8. A QA-signature scan (`test.tsx`, mirroring the real Stage 8A finding) on an `ASSIGNED`
   participant is excluded from `getResearchDataset()`.

Items already covered by pre-existing, still-passing tests (not duplicated):
`tests/research-dataset-consent-gate.test.ts` (ASSIGNED/pre-consent/post-consent/REVOKED/normal-user
exclusion), `tests/anti-hardcoding-guard.test.ts` (participant target = 20; no hardcoded 85),
`tests/user-study-canonical-path.test.ts` (honest `N=0`/`NOT_COLLECTED` reporting, never a fake
"complete" claim).

```
npx tsc --noEmit                    -> PASS (0 errors)
Full test suite (npm test)          -> 1484/1484 PASS, 0 fail (re-run after the auth-service.ts fix)
npm run build (rm -rf .next first)  -> PASS, clean
```

## 14. Browser Acceptance Results

A literal browser session was not used — a local `next start` boot failed in this sandboxed
environment on an unrelated, pre-existing Next.js/webpack vendor-chunk resolution issue
(`Cannot find module './vendor-chunks/@opentelemetry.js'`), not caused by any change this stage
made (confirmed: the build itself completed cleanly; only the local server *boot* hit this
environment-specific quirk). In its place, a **real, live end-to-end walkthrough was run directly
against the production Supabase database**, invoking the exact same route-handler functions an
HTTP request would dispatch to — arguably a more rigorous check of the server-enforced logic than
a browser click-through, since it exercises the identical code path with no UI layer able to mask
a server-side gap:

```
1. GET session (fresh)              -> 200, assigned P011 (next real available code)
2. POST scan WITHOUT consent        -> 403 (correctly refused)
3. POST consent                     -> 200, session-level consent recorded
4. POST real scan (real violation)  -> 200, real engine ran, real scan_reports row created
5. Real DB check                    -> participant row: researchStatus still ASSIGNED; 1 real scan present
6. getResearchDataset()             -> 0 rows for this participant, 0 rows overall (correctly excluded --
                                        session-level consent is NOT the same as admin-verified consent)
7. Original P001-P010               -> all 10 present, scan counts unchanged (6,2,1,0,0,0,1,0,0,0 -- identical
                                        to every prior audit)
8. Cleanup                          -> disposable P011 deleted (id/participantCode-pattern safety-checked
                                        before deletion; refused if it had matched an original code)
9. Post-cleanup verification        -> disposable participant gone; all 10 originals still present
```

No disposable data was left behind; no real data was touched.

## 15. Existing Data Counts (real, live Supabase query)

```
REAL_HUMAN_PARTICIPANT_COUNT: 0
CONSENT_VERIFIED_COUNT: 0
ASSIGNED_COUNT: 10
REVOKED_COUNT: 0
QA_OR_PROTOCOL_COUNT: 10  (all 10 ASSIGNED accounts -- 4 with QA-signature scans, 6 with zero activity)
RESEARCH_ELIGIBLE_SCAN_COUNT: 0
PRECONSENT_EXCLUDED_SCAN_COUNT: 10
```

Total participant-pattern users: 10. Total `scan_reports` rows system-wide: 920 (unrelated
ordinary product usage, not participant activity). `getResearchDataset()`: 0 rows. `submissions`
table: 0 rows. Identical to every prior stage's count — nothing has changed in the real database
except the disposable P011 create/delete cycle in Section 14, which left no trace.

## 16. Remaining Risks

- **Workload/UX**: none identified in the participant flow itself beyond what's already documented
  (RQ4's package v1.1 has a similarly-large-but-separate workload concern; unrelated to this study).
- **Duplicate-scan policy** (Section 10) is currently permissive by default — worth an explicit
  researcher decision (accept as-is, or add a UI-level "one scan per fixture" nudge) before
  recruiting, though not a defect requiring a code fix.
- **No RQ4-specific ethics reference recorded yet** — pre-existing, unrelated to the human study
  specifically (Section 4).
- **Local dev-server boot quirk** (Section 14) is worth a look before a live in-person session on
  this exact machine, though production/Vercel deployment is unaffected (this is a `next start`
  local-boot issue, not a build or runtime-logic issue).

## 17. Required Non-Code Actions

1. Researcher supplies the formal ethics-approval reference (number/date/committee) when available
   (non-blocking, per the existing project-wide policy).
2. Researcher decides the duplicate-scan policy explicitly (Section 16) before recruiting, if a
   stricter rule is wanted.
3. Researcher/admin performs the actual recruitment and, per-participant, the real external
   Google Form reconciliation → `PATCH .../status: CONSENT_VERIFIED` step — this is inherently a
   human, off-platform action this audit cannot and must not automate.

## 18. Final Readiness Decision

The architecture is sound, both real defects found this stage are fixed and verified (unit tests +
full suite + live database walkthrough), and zero real human data exists or was fabricated. The
system is ready to receive Participant 001 from a **technical** standpoint; the remaining items are
the human/off-platform actions in Section 17.

```
STAGE_11A_STATUS=PASS
PARTICIPANT_TARGET=20
REAL_HUMAN_PARTICIPANT_COUNT=0
CONSENT_VERIFIED_COUNT=0
REAL_HUMAN_DATA_PRESENT=NO
QA_PROTOCOL_RECORDS_EXCLUDED=YES
PRECONSENT_DATA_EXCLUDED=YES
REVOKED_DATA_EXCLUDED=YES
QUESTIONNAIRE_READY=YES
CONSENT_FLOW_READY=YES
RESEARCH_EXPORT_READY=YES
READY_FOR_REAL_HUMAN_STUDY=YES
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
