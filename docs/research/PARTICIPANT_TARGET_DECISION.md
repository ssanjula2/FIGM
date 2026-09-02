# Human Study Participant Target — Decision Record

**Status: RESOLVED (2026-09-03).** The participant-target conflict identified in this document's
prior revision (documented Proposal/Interim 02 figure of 80-100 vs. an undocumented code value of
20) has been closed by explicit researcher confirmation: **the final approved study target is 20
participants**, as a later, deliberate research-scope decision — not a rejection or contradiction
of the original Proposal/Interim 02 baseline, which remains the documented historical figure.

| Field | Value | Source |
|---|---|---|
| **Proposal target (historical baseline)** | **80-100 student developers, at NSBM Green University** | Proposal §4.3: *"Primary Data Collection: To gather data on usability, a feedback survey will be distributed to a controlled cohort of 80–100 student developers at NSBM Green University..."*; also §5.2 Resources Required |
| **Interim 02 target (historical baseline, confirms Proposal unchanged)** | **Approximately 80-100 student developers** | Interim02 §1.9.2 Software/Human Resources; §3.4 Fact Collection; §3.6.1 Project Timeline (confirms survey "has not yet been conducted at this interim stage"); §3.6.2 Ethical Considerations |
| Prior in-repository implementation target (superseded, undocumented) | 85 | Never traceable to any research document — an early implementation choice, corrected in an earlier pass this multi-turn engagement |
| **Final approved project target (current, active)** | **20** | Researcher confirmation, 2026-09-03 (this turn) — explicit instruction: *"Final human-study participant target = 20 participants"* |
| Ethics-approved protocol target | 20 (matches the final approved project target; formal approval reference not yet recorded — see `ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED` in `research/CONSENT_FORM.md`) | Researcher confirmation, 2026-09-03: formal ethics approval exists |
| **Value in code** | **20** | `src/research/research-config.ts`'s `HUMAN_STUDY_TARGET_PARTICIPANTS` — unchanged, now consistent with the confirmed decision |

## Reason / Source

This is a **later approved research-scope decision**, not a correction of an error. The sequence,
in full, for the record:

1. **Proposal** (`Research Proposal new.docx` §4.3/§5.2): 80-100 student developers.
2. **Interim 02** (`28256_Interim 02.docx` §1.9.2/§3.4/§3.6.1/§3.6.2): reproduces 80-100 unchanged,
   confirms the survey had not yet been conducted at that later project stage.
3. **This engagement's 2026-09-03 reconciliation pass** read both documents in full, found the code
   value of 20 had no documentary support (only an undocumented in-session chat claim), and flagged
   it `HUMAN_CONFIRMATION_REQUIRED` rather than resolving it unilaterally in either direction.
4. **Researcher confirmation, same day, following turn**: the final approved target is 20 —
   explicitly stated as a later approved research-scope decision, not a rejection of the documented
   80-100 baseline.

**The original documents are preserved as the historical baseline and are not rewritten.** Only the
*active/current study configuration* (the code constant, the consent form, the questionnaire, the
participant instructions, and the user-study README) resolves to 20. Every one of those consumer
documents now states both figures explicitly: the documented Proposal/Interim 02 baseline (80-100)
and the final approved target (20), so the history remains traceable rather than silently erased.

## What was NOT done

- Real participant collection was not started, simulated, or fabricated at 80-100, 85, or 20. Real
  collected count remains 0 (verified unchanged this session).
- No pilot data was collected under any target.
- The Proposal and Interim 02 `.docx` source documents themselves were NOT modified.
- No approval number, date, or committee name was fabricated for the ethics-approval reference (see
  `research/CONSENT_FORM.md`'s `ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED`).

## Required human action (remaining)

- Supply the formal ethics-approval reference (approval number, date, and/or committee name) when
  available, to replace `ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED` in `research/CONSENT_FORM.md`
  and this document. This does not block beginning participant recruitment under the confirmed
  ethics approval, but the specific reference should be recorded once supplied.
