# FIGM Stage 1 — Research Contract Close Report

**Date:** 2026-09-03

## Purpose

This pass closes the two remaining research-governance blockers identified in
`docs/audit/FINAL_RESEARCH_CONTRACT_RECONCILIATION_REPORT.md` (the same-day, prior turn's
reconciliation of the Proposal and Interim Submission 02 against the project's research contract):
the human-participant target and formal ethics approval. Both are now resolved by explicit
researcher confirmation, received directly in this session. No detector or rule logic was
modified. No source `.docx` document was modified.

## A. Repository inspection performed before any edit

Before making any change, every occurrence of the search terms specified in this task
(`80-100`, `80–100`, `approximately 20`, `target 20`, `HUMAN_CONFIRMATION_REQUIRED`,
`NEEDS_VERIFICATION`, `ethics approval`, `HUMAN_STUDY_TARGET_PARTICIPANTS`,
`ETHICS_APPROVAL_STATUS`) was located and classified (36 files matched the raw search). Each was
placed into one of three buckets:

1. **Canonical source of truth** (`src/research/research-config.ts`) — value already correct (20);
   only the doc comment needed updating to record the resolution.
2. **Consumer documents explicitly named in this task's Section D** (`FINAL_RESEARCH_CONTRACT.md`,
   `PARTICIPANT_TARGET_DECISION.md`, `FINAL_TRACEABILITY_MATRIX.md`, `EXPERIMENT_FREEZE.md`,
   `FINAL_RQ_ANSWERS.md`, `CONSENT_FORM.md`, `PARTICIPANT_INSTRUCTIONS.md`, `QUESTIONNAIRE.md`,
   `research/user-study/README.md`) plus `research/DATA_COLLECTION_PROTOCOL.md` (a direct upstream
   source for those consumers, referenced by name inside several of them) — updated.
3. **Everything else** — code/tests that already correctly import
   `HUMAN_STUDY_TARGET_PARTICIPANTS` rather than hardcoding a value (`app/user-study/page.tsx`,
   `app/api/research-metrics/route.ts`, `app/components/landing/ResearchOverview.tsx`,
   `app/analytics/page.tsx`, `app/admin/page.tsx`, `scripts/user-study-status.ts`,
   `scripts/import-user-study.ts`, `src/engine/participant-repository.ts`,
   `src/docs/dissertation-exporter.ts`, `tests/anti-hardcoding-guard.test.ts`,
   `tests/user-study-canonical-path.test.ts`) — **left unmodified, confirmed already correct**, no
   value to change. `docs/dissertation/chapter1_introduction.md`'s single "target 20 participants"
   reference is already accurate and left unmodified — the RQ-wording alignment it is part of is
   explicitly deferred to the next stage (Section F below). Historical, point-in-time audit reports
   (`docs/audit/archive/*`, `audit/*.md`, `research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md`,
   and the prior-pass readiness/completion reports under `docs/audit/`) were **left unmodified** —
   per this project's established convention, point-in-time records are preserved, not rewritten;
   the reconciliation report from the prior turn was likewise left as-is since it accurately
   recorded what was true at the time it was written.

`src/research/research-config.ts`'s canonical constant was confirmed unchanged and correct
(`HUMAN_STUDY_TARGET_PARTICIPANTS = 20`) before any documentation edit began — the code was never
in conflict; only the surrounding documentation and doc comment needed to describe the confirmed
history accurately.

## B. Participant-target update

`HUMAN_STUDY_TARGET_PARTICIPANTS = 20` retained (no code change). The doc comment above it in
`src/research/research-config.ts` was rewritten to record, precisely: the Proposal's 80-100
(§4.3/§5.2), Interim 02's 80-100 (§1.9.2/§3.4/§3.6.1/§3.6.2), and the researcher-confirmed final
target of 20 as a later approved research-scope decision — not a rejection of the documented
baseline.

`docs/research/PARTICIPANT_TARGET_DECISION.md` was rewritten in full: status changed from
"CONFLICT, not resolved" to **RESOLVED**, with the full resolution sequence (Proposal → Interim 02
confirms unchanged → this session's reconciliation flags the conflict → researcher confirms 20)
recorded for the record.

`research/CONSENT_FORM.md`, `research/PARTICIPANT_INSTRUCTIONS.md`, `research/QUESTIONNAIRE.md`,
`research/user-study/README.md`, and `research/DATA_COLLECTION_PROTOCOL.md` each had their
"Target Sample" line rewritten from a reference to an undocumented "earlier 85-participant target"
to an explicit statement of both the documented 80-100 historical baseline (Proposal/Interim 02)
and the 20-participant final approved target, cross-referencing `PARTICIPANT_TARGET_DECISION.md`.

**The Proposal (`Research Proposal new.docx`) and Interim 02 (`28256_Interim 02.docx`) source
documents themselves were NOT opened for writing and were NOT modified in any way.**

## C. Ethics-status update

`research/CONSENT_FORM.md`'s Ethics Status field changed from
`ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION` to:

```
ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER
ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED
```

No approval number, date, or committee name was fabricated — none was supplied by the researcher
or found in the Proposal, Interim 02, or any in-repository document, so the reference field
explicitly records that it is still to be recorded rather than inventing a value. The same pattern
(`CONFIRMED_BY_RESEARCHER` / `TO_BE_RECORDED`) was propagated into `FINAL_RESEARCH_CONTRACT.md`
Section 12, `FINAL_TRACEABILITY_MATRIX.md`'s Ethics row, and `EXPERIMENT_FREEZE.md`'s new Ethics
approval row.

## D. Documents updated (exhaustive list, this pass)

- `docs/research/FINAL_RESEARCH_CONTRACT.md` — top-line status changed to
  `RESEARCH_CONTRACT_READY: YES`; Section 9 (participant target) and Section 12 (ethics) rewritten
  from open/conflicted to RESOLVED/CONFIRMED; "Required human action" list reduced accordingly.
- `docs/research/PARTICIPANT_TARGET_DECISION.md` — full rewrite, status RESOLVED.
- `docs/research/FINAL_TRACEABILITY_MATRIX.md` — Human usability study row and Ethics row updated;
  header note appended recording this pass's resolution.
- `docs/research/EXPERIMENT_FREEZE.md` — Participant target row updated to RESOLVED; new Ethics
  approval row added; "Required human action before FROZEN" rewritten to reflect that governance
  items are closed and only experiment-readiness/dissertation-alignment work remains.
- `docs/research/FINAL_RQ_ANSWERS.md` — header note appended recording the researcher's direct
  confirmation of Set B (in addition to its documentary confirmation), and the participant-count
  context correction (20, not the old 85 figure).
- `research/CONSENT_FORM.md` — Ethics Status and Target Sample fields rewritten.
- `research/PARTICIPANT_INSTRUCTIONS.md` — Target Sample line rewritten.
- `research/QUESTIONNAIRE.md` — Target Sample line rewritten.
- `research/user-study/README.md` — Target Sample Size line rewritten.
- `research/DATA_COLLECTION_PROTOCOL.md` — Correction-history paragraph rewritten with full
  Proposal/Interim 02/researcher-confirmation sequence.
- `src/research/research-config.ts` — doc comment above `HUMAN_STUDY_TARGET_PARTICIPANTS` rewritten
  (value itself unchanged: 20).
- `app/api/user-study/consent/route.ts` — one doc-comment paragraph updated to reflect the now-
  confirmed ethics status (no functional/logic change).

No file outside this list was modified in this pass.

## E. Research contract final state

```
FINAL_RQ_SET = SET_B
PARTICIPANT_TARGET = 20
PARTICIPANT_TARGET_STATUS = RESOLVED
ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER
ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED
REPOSITORY_TARGET = 20-30
PRIMARY_FRAMEWORKS = React, Next.js, Angular
VUE_STATUS = ADDITIONAL_SUPPORT
RQ1_FCP_TTI_REQUIRED = YES
RQ4_EXPERT_VALIDATION_REQUIRED = YES
```

## F. Experiment freeze — deliberately NOT marked FROZEN

`docs/research/EXPERIMENT_FREEZE.md` remains **NOT YET FROZEN**. The research-governance blockers
(participant target, ethics approval) that previously sat in this document's "required human
action" list are now removed — they are resolved. What remains, unchanged by this pass:

- RQ1 FCP/TTI experiment protocol does not yet exist (human-decided experimental factors required
  first — rendering/state-management condition set, browser/hardware/network profile, repetition
  count, measurement tooling).
- Real-repository corpus is still 15 of the confirmed 20-30 target.
- Dissertation Chapter 1 (§1.4 RQ1-4, Aim, missing Objectives 1-4) and Chapter 6's RQ answers are
  still keyed to the superseded "Set A" wording, not yet aligned to the now-doubly-confirmed Set B.
- Production/browser acceptance verification was not re-run this pass.

## G. Verification

**Targeted tests** (`tests/anti-hardcoding-guard.test.ts`, `tests/user-study-canonical-path.test.ts`,
`tests/user-study-pipeline.test.ts`, `tests/admin-research-dashboard.test.ts`,
`tests/participant-provisioning-race.test.ts`, `tests/participant-matrix-n-plus-1.test.ts`,
`tests/research-integrity.test.ts`, `tests/evaluation-runner.test.ts`,
`tests/analytics-payload-safety.test.ts`), run via
`node --import tsx --import ./tests/test-env-setup.mjs --test`:

```
tests 76
pass 76
fail 0
```

**Full suite** (`npm test`):

```
tests 1283
suites 77
pass 1283
fail 0
cancelled 0
skipped 0
todo 0
```

**Build** (`npm run build`): completed cleanly, full route manifest generated, no errors.

No test was weakened, skipped, or modified to force a pass. `tests/anti-hardcoding-guard.test.ts`'s
hard assertion `assert.equal(HUMAN_STUDY_TARGET_PARTICIPANTS, 20, ...)` passed unmodified, since the
code value was never changed.

## Final status block

```
PARTICIPANT_TARGET:
20

PARTICIPANT_TARGET_STATUS:
RESOLVED

PROPOSAL_ORIGINAL_TARGET:
80-100

INTERIM02_ORIGINAL_TARGET:
80-100

ETHICS_STATUS:
CONFIRMED_BY_RESEARCHER

ETHICS_REFERENCE_STATUS:
TO_BE_RECORDED

FINAL_RQ_SET:
SET_B

RESEARCH_CONTRACT_READY:
YES

EXPERIMENT_FREEZE_READY:
NO

TESTS:
1283/1283 pass (0 fail, 0 cancelled, 0 skipped) — full suite via `npm test`. 76/76 pass on the
targeted research-config/study/consent/anti-hardcoding subset run first.

BUILD:
PASS — `npm run build` completed cleanly, full route manifest generated.

WORKING_TREE:
Uncommitted, as required ("Do not commit or tag in this pass"). This pass's changes: 6 files
newly written under docs/research/ + docs/audit/ (untracked, consistent with this entire
multi-turn engagement never having committed), 5 files modified under research/, 1 file modified
under src/research/, 1 file modified under app/api/user-study/consent/. Total working-tree diff
remains large (214 changed paths) because no commit has been made at any point across this
engagement — this pass added to, but did not reduce or otherwise alter, that pre-existing
uncommitted state outside the files listed in Section D above.

NEXT_ACTION:
Dissertation Chapter 1 and Chapter 6 alignment to authoritative Set B — specifically: replace
chapter1_introduction.md §1.4's RQ1-4 with the Proposal/Interim02 wording, add the Main Research
Question (Interim02 §1.4) and Objectives 1-4 (Proposal §2.3 / Interim02 §1.7.1-1.7.4), and
propagate the corrected RQ set into Chapter 6's RQ answers (currently keyed to the now-superseded
Set A wording). Not performed in this pass, per this task's own scope.
```
