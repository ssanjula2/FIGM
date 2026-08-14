# Human Study Provenance — Forensic Audit

Date: 2026-08-13
Method: Direct inspection of `research/`, `scripts/import-user-study.ts`, `scripts/user-study-status.ts`, and live execution of `research:validate`/analysis pipeline outputs.

## 1. Current state of the data (verified this session)

- `research/raw/real/` — contains only `.gitkeep`. **0 files, 0 responses.**
- `research/processed/real/` — contains only `.gitkeep`.
- `research/anonymized/real/` — contains only `.gitkeep`.
- `research/analysis/usability-results.json` (the live, dynamically-produced status file) correctly reports:
  ```json
  { "isRealHumanData": false, "collectionStatus": "NOT_COLLECTED", "validParticipantCount": 0 }
  ```
- **`targetSampleSize: 85` is a target, not a count.** No code path anywhere in `src/eval` or `scripts/` conflates the two — confirmed by direct reading of `import-user-study.ts`'s output-building logic and by the honest `NOT_COLLECTED` state above.
- **REAL HUMAN PARTICIPANTS = 0 / 85.** This is the correct, current, honestly-reported status everywhere it is surfaced in the live application (`research/analysis/usability-results.json` and, since 2026-08-14, `/api/research-metrics`'s `userStudy` block — see §6 below, this line was WRONG as originally written on 2026-08-13: at that time `/api/research-metrics` actually read a different, nonexistent path and only coincidentally displayed the same 0 value) and — after this session's fix — `docs/evidence/user-study/user-study-results.json`, which previously contradicted this with fabricated figures; see `docs/audit/archive/FINAL_PRODUCTION_FORENSIC_AUDIT.md` §6).

## 2. Import pipeline validation rules (`scripts/import-user-study.ts`)

Verified by direct source reading:

| Requirement | Implemented? | Evidence |
|---|---|---|
| Consent required | YES | `scripts/import-user-study.ts:235-237` excludes any row where the consent column doesn't contain "yes" or "consent", logging the exclusion with a row number |
| Likert bounds (1-5) enforced | YES | `scripts/import-user-study.ts:248` — `val >= 1 && val <= 5`, non-numeric/out-of-range values are not counted |
| Required questions present | PARTIAL | Missing individual question values are skipped from that question's aggregate rather than rejecting the whole row — reasonable for partial-completion tolerance, but not an explicit "all N questions required" gate |
| **Duplicate submissions prevented** | **Corrected finding — fixed this session, at the right layer** | Initial pass flagged this as an `import-user-study.ts` dedup gap, but deeper inspection shows the CSV format itself carries no participant identifier at all: the Google Form deliberately calls `setCollectEmail(false)` (`research/user-study/CreateGoogleForm.gs:30`) for genuine anonymity, and `generateAnonymousParticipantIDs()` assigns "P001..." labels sequentially by row count, not from any per-row identity. **A post-hoc dedup check in the import script is therefore not implementable** — there is nothing to dedupe against. The correct fix is at collection time: `research/user-study/CreateGoogleForm.gs` now calls `form.setLimitOneResponsePerUser(true)` + `form.setRequireLogin(true)`, which Google enforces via the responder's signed-in account **without** adding an identity column to the exported response sheet (that only happens if `setCollectEmail(true)` is separately called, which it is not) — closing the duplicate-submission gap without weakening participant anonymity. |
| Anonymization | YES (separate concern) | `research/ANONYMIZATION_PROTOCOL.md` documents the intended process; `anonymizedParticipantIds` field exists in the provenance metadata structure |

**Trade-off now made explicit**: this design requires participants to be signed into a Google account to open the form (a new, minor participant-facing requirement introduced by this fix). If that is unacceptable for the recruitment plan, the alternative is to accept the duplicate-submission risk as an inherent limitation of a fully anonymous, no-login survey and state that limitation explicitly in the methodology chapter rather than silently having no mitigation at all.

## 3. What must NOT happen (verified as not happening)

- No code path generates synthetic participant rows and writes them into `research/raw/real/` or `research/processed/real/` as if real.
- `src/eval/user-study-evaluator.ts`'s synthetic Likert data (used for Chapter 6 "Formula Test") is correctly labeled `SYNTHETIC_PIPELINE_TEST_DATA` and gated behind `isReal = provenance.isRealHumanData && provenance.validParticipantCount > 0` in `thesis-gap-exporter.ts` — confirmed this gate is `false` given the current `0` participant count, so the synthetic figures are not exported as if real.
- `"P001"`–`"P085"`-style ID strings appear in the codebase only in: (a) `scripts/import-user-study.ts`'s ID-generation utility (used to assign anonymized IDs to *real* imported rows, not to fabricate rows), and (b) test assertions in `tests/user-study-pipeline.test.ts` that verify the ID-formatting function's output shape. Neither writes fabricated response data.

## 4. Fixed this session

`docs/evidence/user-study/user-study-results.json` was found presenting fabricated `meanSUSScore: 86.4`, `cronbachAlpha: 0.89`, and a fabricated institution name with no synthetic disclaimer — directly contradicting the honest state described above. It has been corrected to `NOT_COLLECTED` / `validParticipantCount: 0`, consistent with every other provenance surface in the system. See `docs/audit/archive/FINAL_PRODUCTION_FORENSIC_AUDIT.md` §6 for full detail.

## 5. Outstanding items (not fixed this session)

1. No "all required questions answered" all-or-nothing row rejection exists — current behavior silently excludes only the missing fields from aggregates. Decide whether this is the intended tolerance or should be stricter.
2. The `setRequireLogin(true)` trade-off (§2) needs a human decision: is requiring a Google account acceptable for the target cohort, or should full anonymity be kept and the duplicate-submission risk documented as an accepted limitation instead?
3. Real data collection (85 real participants) is entirely outside this session's control.

## 6. Full-checklist re-audit (2026-08-14) — the disconnected-paths bug, found and fixed

A second, independent read-through of every stage of the study pipeline, organized against the
full checklist: ethics approval, consent, recruitment, participant tracking, study tasks, response
storage, analysis, provenance. This correction was triggered by finding that §1's claim above
(that `/api/research-metrics` correctly reported the honest state on 2026-08-13) was **not
actually true on that date** — it reported 0 only because it was watching a nonexistent file, not
because it correctly read the real pipeline's output. Coincidence, not correctness. Root cause and
fix below.

### 6.1 Ethics approval
**Status: unresolved, honestly stated.** `research/CONSENT_FORM.md:8` — `Ethics Status:
ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION`. This is the accurate, current status. Two archived
documents (`docs/audit/archive/FINAL_HOSTILE_EXAMINER_AUDIT.md`,
`docs/audit/archive/FINAL_HOSTILE_EXAMINER_QA.md`) assert *"ethics approval is not required
because no human subject data was collected"* — both carry an explicit `⚠ ARCHIVED — SUPERSEDED`
banner and instruct readers to treat their contents as historical, not current. No live
(non-archived) document repeats that claim as of this audit. Recommendation if the study proceeds:
resolve `NEEDS_VERIFICATION` before recruiting a single real participant, not after.

### 6.2 Consent
**Status: designed correctly, not yet exercised with real participants.**
`research/CONSENT_FORM.md` exists and is participant-facing; `scripts/import-user-study.ts:235-237`
hard-excludes any imported row without an explicit "yes"/"consent" match in the consent column
(verified in §2 above, and by `tests/user-study-canonical-path.test.ts`'s synthetic-CSV test, which
constructs one such non-consenting row and asserts it is excluded and does not consume a
participant ID).

### 6.3 Recruitment
**Status: planned, not executed.** `research/DATA_COLLECTION_PROTOCOL.md` describes inclusion/
exclusion criteria (frontend developers/students, ≥6 months React/Vue/Angular experience) and a
4-step procedure. This is protocol/planning language throughout — no document anywhere claims
recruitment has actually taken place. Fixed this session: `DATA_COLLECTION_PROTOCOL.md:21`
previously named a response path (`/research/raw/responses.csv`) that does not match the real
code's path (`research/raw/real/responses.csv`, per `scripts/import-user-study.ts:151` and
`scripts/user-study-status.ts:17`) — corrected to match the real path and to describe the actual
validate → anonymize → analyze pipeline in one place.

### 6.4 Participant tracking
**Status: correctly designed for anonymity, not yet exercised.** See §2's dedup analysis
(unchanged from 2026-08-13) — the Google Form is configured for anonymous, one-response-per-signed-
in-account submission via `setLimitOneResponsePerUser(true)` + `setRequireLogin(true)`
(`research/user-study/CreateGoogleForm.gs:30`), and imported rows are assigned sequential
`P001, P002, ...` IDs at import time by `generateAnonymousParticipantIDs()`, never derived from any
identifying field in the response itself.

### 6.5 Study tasks
**Status: implemented and live.** `app/user-study/page.tsx` presents a real, working task flow: 4
benchmark fixtures (React/Next.js/Angular/Vue), a live FIGM scan via `/api/scan`, and a real
server-verified telemetry write via `POST /api/user-study/log-scan`
(`app/api/user-study/log-scan/route.ts`) — which re-runs `RuleExecutionEngine.analyzeFile()` on
the submitted code server-side rather than trusting a client-supplied result (a prior version of
this route accepted a client-trusted `qualityScore`/`diagnosticsCount`; that has been fixed, per
the comment at `app/user-study/page.tsx:155-160`). The SUS/demographic questionnaire itself is
external (an embedded Google Form URL), not collected through this app directly.

### 6.6 Response storage — THE BUG FOUND AND FIXED THIS SESSION
**Status: was broken, now fixed.** Two disconnected "real data" pathways existed:
- `scripts/import-user-study.ts:374` writes validated, anonymized, analyzed results to
  **`research/analysis/usability-results.json`**.
- `app/api/research-metrics/route.ts:188` (before this fix) read human-study status from
  **`data/user-study-responses.json`** — a path nothing in this repository has ever written to;
  the `data/` directory does not exist anywhere in the repo (confirmed by direct filesystem check,
  and now asserted by `tests/user-study-canonical-path.test.ts`).

This was invisible in every prior audit (including the 2026-08-13 pass above) because both paths
independently evaluated to `0` — the live API's `humanParticipants = 0` was accidentally correct,
for the wrong reason. Had a real CSV ever been imported, `research/analysis/usability-results.json`
would have correctly shown real participants while `/api/research-metrics` kept reporting 0/PENDING
indefinitely, because it was watching a file nothing populates.

**Fix**: `app/api/research-metrics/route.ts` now reads `research/analysis/usability-results.json`
directly — the exact file the import script writes — and passes its `provenance` object through
to the API response verbatim (see §6.8). One canonical data flow now exists end-to-end: raw
responses (`research/raw/real/responses.csv`) → validation + anonymization + analysis
(`scripts/import-user-study.ts`) → canonical results (`research/analysis/usability-results.json`)
→ API/UI (`app/api/research-metrics/route.ts` → `src/hooks/useResearchMetrics.ts` →
`app/analytics/page.tsx` / landing-page components).

### 6.7 Analysis
**Status: real, correct formulas; currently operating on zero real input.**
`calculateParticipantSUS` (standard odd/even-item SUS scoring) and `calculateCronbachAlpha` (real
variance-ratio formula) are unit-tested against known expected values in
`tests/user-study-pipeline.test.ts`, and now additionally exercised end-to-end (CSV in, full
`ProcessedUsabilityReport` out) by `tests/user-study-canonical-path.test.ts` using a synthetic
test-only CSV that is never written to any real data path. `src/eval/user-study-evaluator.ts`'s
separate synthetic Likert-formula-verification dataset remains correctly gated behind
`isReal = realReport.provenance.isRealHumanData && realReport.provenance.validParticipantCount > 0`
in `src/eval/thesis-gap-exporter.ts:99` and is now additionally guarded by an automated regression
test (`tests/user-study-canonical-path.test.ts`'s final case) asserting that gate expression and
the `SYNTHETIC_PIPELINE_TEST_DATA` labeling cannot be silently removed.

### 6.8 Provenance
**Status: fixed to flow through completely.** Previously the API only surfaced a bare
`collectedParticipants` count with no other provenance information. It now passes through the full
`ProcessedUsabilityReport.provenance` object (`datasetId`, `datasetType`, `isRealHumanData`,
`collectionStatus`, `targetSampleSize`, `validParticipantCount`, `targetReached`,
`anonymizedParticipantIds`, `totalResponsesIngested`, `excludedResponsesCount`, `processedAt`) plus
the real `metrics` object (`null` unless `isRealHumanData` is true), so any UI consumer can display
— and any future reviewer can verify — exactly where a number came from, not just its value.
Planned sample size (`targetSampleSize`, currently `85`) and actual collected count
(`validParticipantCount`, currently `0`) are two distinct fields throughout this entire flow and
are never conflated (`tests/user-study-canonical-path.test.ts` asserts this directly).

**Verified via `npm test`** (see commit for the exact pass count) and a direct read of both sides
of the fix, not assumed from this document's own prose.
