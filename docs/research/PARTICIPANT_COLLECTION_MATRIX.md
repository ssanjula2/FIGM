# FIGM Participant Collection Matrix

Status: TRACKER ONLY — no data below is fabricated or pre-completed. Every cell starts `PENDING`
and is updated by the researcher only after the corresponding real event actually occurs (see
`docs/research/PARTICIPANT_TASK_PROTOCOL.md` for the task set, fixture IDs, and eligibility rules
this tracks against).

**Enrollment policy: one human participant = one participant code.** Enrollment
(`enrollAuthenticatedUserAsParticipant`) is idempotent per authenticated account, but nothing in
the account-registration flow itself prevents one person from registering two separate accounts and
enrolling each independently. Before setting a participant's status to `CONSENT_VERIFIED`, the
admin performing verification MUST check this matrix (and the admin participant panel) for any
other row that plausibly belongs to the same person (matching name, contact detail, or a
participant who mentions a prior code) and reject/decline verification of a duplicate enrollment by
the same human. This is a manual review step — there is no automated technical control for it.

Column meaning:
- **React / Next.js / Angular / Vue**: `PENDING` until that participant's PRIMARY scan for that
  fixture (`FIGM-STUDY-REACT-01` / `FIGM-STUDY-NEXT-01` / `FIGM-STUDY-ANGULAR-01` /
  `FIGM-STUDY-VUE-01`) has actually been recorded and confirmed eligible in
  `getResearchDataset()`.
- **Questionnaire**: `PENDING` until the participant has submitted the feedback questionnaire.
- **Status**: overall session status — `PENDING`, `CONSENT_VERIFIED` (admin-verified, tasks not
  yet started), `IN_PROGRESS`, or `COMPLETE`.

| Participant | React | Next.js | Angular | Vue | Questionnaire | Status |
|---|---|---|---|---|---|---|
| P001 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P002 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P003 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P004 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P005 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P006 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P007 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P008 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P009 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P010 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P011 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P012 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P013 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P014 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P015 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P016 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P017 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P018 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P019 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| P020 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

```
TOTAL PRIMARY CELLS TARGETED = 80  (20 participants x 4 frameworks)
TOTAL PRIMARY CELLS RECORDED = 0   (real collection has not started)
```
