# Live Scan as the Single Real Participant-Study Surface

Date: 2026-09-07
Scope: makes `/live-scan` itself the entry point for research-study enrollment, so real collection
never requires visiting `/user-study` — building directly on the identity/consent/research-dataset
architecture already established in `docs/audit/NORMAL_LIVE_SCAN_RESEARCH_INTEGRATION.md`.

## What changed

`app/live-scan/page.tsx` gained a small, self-contained enrollment panel (state + one `useEffect`
+ one handler + one conditionally-rendered block, ~90 lines) that:

- On mount, calls `GET /api/user-study/enroll` (same-origin, cookie-authenticated, no client-side
  auth guess — mirrors this page's own existing `handleSaveToHistory` convention of letting the
  server's response decide, never a `localStorage` check). A `401` hides the panel entirely; any
  other response reveals it.
- Shows exactly the four states requested (see below), reusing the page's existing `insp-notice`
  visual pattern.
- "Join Research Study" reveals a consent checkbox + confirm button; confirming calls
  `POST /api/user-study/enroll { consentConfirmed: true }` — the exact same endpoint added in the
  prior integration pass, now reachable from two pages instead of one.

**No new scanning code path was added.** The panel calls `/api/user-study/enroll` only — never
`RuleExecutionEngine`, never a second `/api/scan`-like endpoint. Detection, fix/remediation, and
re-scanning on `/live-scan` are completely untouched (confirmed by a static source-guard test:
`tests/live-scan-only-research-flow.test.ts`'s "no duplicate scanner" test asserts the enrollment
panel's own source slice contains no reference to the analysis engine or `/api/user-study/log-scan`).

## UI states (implemented verbatim)

| State | Rendered |
|---|---|
| Ordinary, signed-in, not enrolled | `Research study: Not enrolled` + `[Join Research Study]` |
| `ASSIGNED` | `Participant: P001 · Consent verification: Pending · Scans are not yet included in research analysis.` |
| `CONSENT_VERIFIED` | `Participant: P001 · Research status: Verified · New scans are eligible research observations.` |
| `REVOKED` | `Research participation revoked · New scans excluded.` |
| Anonymous / not signed in | Panel renders nothing |

## Consent rules — unchanged, re-verified

Nothing about the identity/consent/eligibility model changed in this pass — it was already fully
correct from the prior integration:

- `ParticipantRepository.enrollAuthenticatedUserAsParticipant()` sets `researchStatus: 'ASSIGNED'`
  only. There is no code path — old or new — by which a participant can set `CONSENT_VERIFIED`
  themselves.
- Admin verification remains exclusively `PATCH /api/admin/participants/[code]` →
  `ParticipantRepository.setResearchStatus()`.
- Pre-verification scans remain ordinary operational history (visible in the admin matrix, excluded
  from `getResearchDataset()` by the unchanged `researchConsentVerifiedAt`/timestamp check).
- PRIMARY/SECONDARY classification is the same unchanged logic in `getResearchDataset()`.

Re-verified end-to-end by a new test (`tests/live-scan-only-research-flow.test.ts`) that performs
the *entire* flow — enroll, admin-verify, real `/api/scan` call — and confirms the resulting row
appears correctly classified in the research dataset, without ever calling
`/api/user-study/log-scan` or `/api/user-study/consent`.

## Why the current logged-in account isn't showing as P001

Structural answer, confirmed from code: before this change, **no UI anywhere on `/live-scan`
called the enrollment endpoint at all** — the only way to reach
`ParticipantRepository.enrollAuthenticatedUserAsParticipant()` was to separately visit `/user-study`
and click "Join the Study" there. If that specific step was never taken for the account in
question, `participantCode` on that row is simply still `null` — not a bug, just a step that
hadn't happened yet, because the only surface that could trigger it wasn't the one being used.

I do not have production database access (a prior narrowly-scoped read-only attempt was blocked by
this session's own permission classifier, and per instruction I did not attempt to work around
that) — I cannot fill in real values for the three requested fields myself. **The now-built panel
is the direct way to check**: log in and open `/live-scan` — the panel itself shows the current
account's exact status. Alternatively, this same-origin, cookie-authenticated DevTools check works
identically:

```js
fetch('/api/user-study/enroll').then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
```

```
CURRENT_USER_PARTICIPANT_CODE=<check via the panel or the snippet above>
CURRENT_USER_RESEARCH_STATUS=<check via the panel or the snippet above>
CURRENT_USER_CONSENT_VERIFIED_AT_PRESENT=<check via the panel or the snippet above>
```

No historical scan data was modified, inspected, or reclassified by this change.

## `/user-study` — kept as informational/backward-compatible onboarding

Per the task's own "either/or," `/user-study` was **not** redirected or deleted. It already (from
the prior pass) serves purely as an alternate, fuller onboarding surface — study description,
consent text, and a "Go to Live Scan" link after joining — and calls the identical
`/api/user-study/enroll` endpoint the new `/live-scan` panel uses. Real collection now has two
equally-valid entry points into the *same* underlying enrollment call; neither is required, and
`/user-study` contains no scanning UI of its own (already removed in the prior pass). Proven by the
new "real end-to-end collection needs no `/user-study/*` route" test, which completes the entire
flow without importing or calling the old page's route at all.

## Tests

New: `tests/live-scan-only-research-flow.test.ts` (3 tests) —
1. The exact GET → POST → GET sequence the panel performs.
2. Full collection (enroll → admin-verify → real `/api/scan`) using zero `/user-study/*` routes
   beyond `/api/user-study/enroll`, confirming the row lands correctly in the research dataset as
   PRIMARY.
3. Static source-guard proving the panel never references the analysis engine or a second scan
   endpoint.

Everything else required by this task's test list (ordinary user Live Scan works and stays out of
the research dataset, same user can't get a second code, P020 cap, ASSIGNED/pre-verification
exclusion, post-verification inclusion, PRIMARY/SECONDARY, fix telemetry, re-scan persistence,
ordinary-user non-interference) was already proven by
`tests/normal-live-scan-research-integration.test.ts`'s 17 tests from the prior pass — re-run and
still passing, not duplicated here.

## Final status

```
LIVE_SCAN_IS_SINGLE_STUDY_SURFACE=YES
SEPARATE_USER_STUDY_PAGE_REQUIRED=NO
NORMAL_USER_CAN_ENROLL_FROM_LIVE_SCAN=YES
P001_ASSIGNED_TO_SAME_USER_ROW=PASS
PRE_CONSENT_SCANS_EXCLUDED=PASS
POST_CONSENT_SCANS_RESEARCH_ELIGIBLE=PASS
PRIMARY_SECONDARY_POLICY=PASS
FIX_TELEMETRY=PASS
DUPLICATE_SCANNER_CREATED=NO
```
