# Stage 8A — Research Dataset Baseline Safety, Research Freeze v5

Scope: ensure the 10 pre-existing, protocol-issued but never-consent-verified participant slots
(P001–P010, `researchStatus = ASSIGNED`) and their 10 historical scan-log rows can never
contaminate a real research export, by tracing every research-facing reporting path and adding a
server-side/repository-level consent gate where none existed. No real participant, expert (RQ4),
or RQ1 experiment data was collected this stage. No data was deleted.

---

## 1. Baseline

```
research-freeze-v4   -> ef0ead7fac712bd62732f958a125db98e31b4bdf (Stage 7G's frozen,
                          PASS-accepted Production candidate, unchanged/untouched this stage)
HEAD (session start) -> 62d3fea9d94dc66c8c5369dd5af3bbb493d98583 (Stage 7G's own baseline-report
                          commit, one commit ahead of v4)
```

This stage followed a prior read-only provenance audit (same session) of the 10 `ASSIGNED` users,
which established: all 10 trace to the real production code path
(`ParticipantRepository.assignNewParticipant()`, invoked only from `POST
/api/user-study/log-scan`) — never a seed script — but none reached `CONSENT_VERIFIED`, and the
scan activity on 4 of the 10 (P001, P002, P005, P007 — 10 scan rows total) carries QA/smoke-test
signatures (a file literally named `test.tsx`, rapid multi-framework churn, reused generic sample
filenames), not evidence of a real recruited participant completing the study protocol.

## 2. Tracing every research-facing path

Grepped every reference to `participantCode` / `researchStatus` / `CONSENT_VERIFIED` /
`researchConsentVerifiedAt` across `app/`, `src/`, and `scripts/`. Two, and only two, independent
pipelines touch participant-linked data:

1. **The dissertation's real SUS/usability dataset** — `scripts/import-user-study.ts`, reading
   `research/raw/real/responses.csv` (a Google Form export), never the Postgres DB. Already
   consent-gated per-row (`processUserStudyPipeline` excludes any row whose `consent` column isn't
   an explicit yes). Out of scope — unaffected by, and unrelated to, this stage's change.
2. **The DB-backed scan-telemetry reporting path** — `ParticipantRepository.getMatrix()` /
   `.getDetail()` (`src/engine/participant-repository.ts`), consumed only by the ADMIN-only
   `GET /api/admin/participants` and `GET /api/admin/participants/[participantId]` routes. This is
   the *only* place a real participant's scan-level DB data (`totalScans`, `scanHistory`,
   `averageQualityScore`, `ruleFindings`, …) is surfaced anywhere in the codebase. No other export
   script, admin route, or dissertation exporter reads `scan_reports` joined to participant
   identity.

No dedicated "research export" file or endpoint existed prior to this stage.

## 3. Gate check: none existed

`getMatrix`/`getDetail` compute every total from **all** of a user's scans, with no filter on
`researchStatus` or `researchConsentVerifiedAt` at all. This is deliberate, not an oversight: it is
what lets an admin see a slot's real pre-consent activity (e.g. P005's 6-scan QA burst, P001's
`test.tsx`) in order to decide whether to `CONSENT_VERIFIED` or `REVOKE` it — see
`ParticipantRepository.setResearchStatus`'s own doc comment. Zeroing that view would blind admins
to exactly the signal they need to act on, so it was left unchanged (requirement: keep operational
product/admin scan history intact).

## 4. The gate implemented

Added `ParticipantRepository.getResearchDataset()` (`src/engine/participant-repository.ts`) — a
new, separate, minimal repository method that is the only sanctioned source for a real research
scan export. Inclusion rule, applied server-side:

```
scan is research data  <=>  user.researchStatus === 'CONSENT_VERIFIED'
                             AND user.researchConsentVerifiedAt IS NOT NULL
                             AND scan.createdAt >= user.researchConsentVerifiedAt
```

- **ASSIGNED-only** participants contribute zero rows — they fail the `CONSENT_VERIFIED` check.
- **REVOKED** participants contribute zero rows — same reason; not a special-cased exclusion, it
  falls out of the one inclusion rule (matches `setResearchStatus`'s existing "no longer able to
  accept further research-scan writes" contract — no new ethics policy invented).
- **CONSENT_VERIFIED** participants contribute only scans timestamped at/after their own
  `researchConsentVerifiedAt`.
- A non-participant (ordinary product) account can never appear, since `isParticipantUser` is
  checked first.
- `getMatrix`/`getDetail` (the admin operational dashboard) are untouched — still show every real
  scan, exactly as before this stage.

## 5. Regression tests

New file `tests/research-dataset-consent-gate.test.ts` (wired into `package.json`'s `test`
script), against the real storage-provider stack, no mocking:

| Case | Result |
|---|---|
| ASSIGNED user with pre-consent scans | excluded (0 rows) |
| CONSENT_VERIFIED user with pre- and post-consent scans | only the post-consent scan included |
| REVOKED user with real scans | excluded (0 rows) |
| Unrelated normal product user | excluded (0 rows) |

The pre-existing `tests/admin-research-dashboard.test.ts` (the operational-dashboard suite) was
left unmodified and still passes in full — confirming the new gate did not change admin-visible
behavior.

## 6. Verification against the real Supabase-backed DB

The full test suite (`npm test`) runs against this repo's local JSON-file storage fallback by
design (`RepositoryFactory` only selects the Supabase provider when `SUPABASE_URL`/
`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are present in `process.env`, and the `test` npm
script does not load `.env`) — see `src/storage/repository-factory.ts`'s Stage 7B hardening
comment. So the test run itself never touches the real Production/dev Postgres database.

To get an authoritative confirmation against the real database, a one-off script loaded real
credentials (`dotenv/config`) and called `ParticipantRepository.getResearchDataset()` directly
against the live `SupabaseStorageProvider`. Result, matching the original provenance audit
byte-for-byte (same 10 user rows, same ids, same per-user scan counts — confirming nothing about
these 10 rows changed during this stage, including during the full local test-suite run):

```
providerClass: SupabaseStorageProvider
ASSIGNED_COUNT: 10   CONSENT_VERIFIED_COUNT: 0   REVOKED_COUNT: 0
P005 scans=6  P002 scans=2  P001 scans=1  P007 scans=1  (P003/P004/P006/P008/P009/P010 scans=0)
PREEXISTING_QA_SCANS (real DB): 10
RESEARCH_DATASET_TOTAL_ROWS (real DB): 0
ASSIGNED_ROWS_EXPORTED (real DB): 0
PRE_CONSENT_ROWS_EXPORTED (real DB): 0
```

The one-off verification script was deleted after use; it was never committed.

## 7. Gates

```
FINAL_TSC: PASS (npx tsc --noEmit, 0 errors)
FINAL_TESTS: 1467/1467 PASS (0 fail, 0 cancelled, 0 skipped)
FINAL_BUILD: PASS (rm -rf .next && npm run build, clean)
```

## 8. Freeze v5

```
RESEARCH_FREEZE_V4_COMMIT (unchanged, immutable): ef0ead7fac712bd62732f958a125db98e31b4bdf
RESEARCH_FREEZE_V3_COMMIT (unchanged, immutable): 748183fe0fa1bff79c5446a5a394e09917ec8186
RESEARCH_FREEZE_V2_COMMIT (unchanged, immutable): d64515f12e4815573d4c152e3971f3504d016a61
RESEARCH_FREEZE_V1_COMMIT (unchanged, immutable): 61686e7aabad6f8c2c71b09ca0a5b52c36d08946
```

`research-freeze-v5` tags the commit containing exactly three intended file changes:
`src/engine/participant-repository.ts` (the new gate), `tests/research-dataset-consent-gate.test.ts`
(new regression tests), and `package.json` (wiring the new test file into the `test` script) — plus
this report. A set of pre-existing, unrelated, already-uncommitted working-tree changes (benchmark
timestamp residue in `benchmarks/`, `docs/evidence/canonical-evaluation.json`,
`docs/migration-report.json`, `docs/reports/`, `public/eval-results/`,
`research/independent-annotation/results/STATUS.md`, and dissertation chapter text) were present in
the working tree at session start, are unrelated to Stage 8A, and were deliberately left unstaged
and out of this commit.

```
RESEARCH_FREEZE_V5_CREATED: YES
FREEZE_V5_COMMIT: <recorded after commit — see Stage 8B deployment/acceptance record>
FREEZE_V5_TAG_TARGET: <recorded after commit — see Stage 8B deployment/acceptance record>
```

## 9–11. Production deployment and acceptance

See the Stage 8B session record (commit message and PR/deployment history) for the exact
deployment ID, Production URL, and short non-research acceptance-check results for this exact
frozen version.

## 12. Final summary

```
PREEXISTING_QA_SCANS: 10
QA_SCANS_DELETED: 0
RESEARCH_EXPORT_CONSENT_GATED: PASS
ASSIGNED_ROWS_EXPORTED: 0
PRE_CONSENT_ROWS_EXPORTED: 0
REAL_DB_VERIFICATION: PASS
SAFE_TO_START_REAL_PARTICIPANT_COLLECTION: YES
REAL_PARTICIPANT_DATA_COLLECTED_THIS_STAGE: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_STAGE: 0
RQ1_RUNS_CREATED_THIS_STAGE: 0

READY_FOR_REAL_RESEARCH_DATA_COLLECTION: YES

NEXT_ACTION:
Preserve research-freeze-v5 and use its exact, now-verified Production deployment for the next
approved real-data-collection stage. Real data collection was NOT started this stage and requires
a separate, explicit go-ahead.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
