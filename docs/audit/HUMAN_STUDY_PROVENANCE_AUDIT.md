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
- **REAL HUMAN PARTICIPANTS = 0 / 85.** This is the correct, current, honestly-reported status everywhere it is surfaced in the live application (`research/analysis/usability-results.json`, `/api/research-metrics`'s `userStudy` block, and — after this session's fix — `docs/evidence/user-study/user-study-results.json`, which previously contradicted this with fabricated figures; see `docs/audit/archive/FINAL_PRODUCTION_FORENSIC_AUDIT.md` §6).

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
