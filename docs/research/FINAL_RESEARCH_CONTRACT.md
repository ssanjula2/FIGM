# FIGM Final Research Contract

Status: **RESEARCH_CONTRACT_READY: YES (as of 2026-09-03).** RQ-wording is resolved to Set B
(sourced from the actual Proposal and Interim Submission 02). The human-participant target (Section
9) and formal ethics approval (Section 12) — the two items previously flagged
`HUMAN_CONFIRMATION_REQUIRED` — are now resolved by explicit researcher confirmation. Remaining
work is dissertation-text alignment (Chapter 1/6, still using the superseded Set A wording) and
experiment-readiness gaps (RQ1 protocol, repository-corpus expansion) — neither blocks the contract
itself; see `docs/audit/STAGE_1_RESEARCH_CONTRACT_CLOSE_REPORT.md`.

This document was rebuilt on 2026-09-03 after directly reading, in full, the two authoritative
source documents supplied by the researcher:
- **Proposal**: `Research Proposal new.docx` (original authoritative baseline; IS303.2 Research
  Methodology, Student ID 28256, A P H D S Sanjula).
- **Interim 02**: `28256_Interim 02.docx` (later project-progress document; same student, same
  project — verified by identical RQ1-4 wording, identical topic, and cross-referenced against
  `research/CONSENT_FORM.md`'s investigator field).

Both documents were absent from this repository in every prior pass (`find`/`Glob` returned zero
hits) and were supplied externally by the researcher this session at explicit file paths. Full
reconciliation detail, including a 16-item source-comparison table, is in
`docs/audit/FINAL_RESEARCH_CONTRACT_RECONCILIATION_REPORT.md` — this document summarizes the
resulting contract; that report is the evidence trail.

---

## 1. RESOLVED: Research Question set

**Set B is authoritative.** It is verbatim, word-for-word identical across both the Proposal
(§2.3) and Interim 02 (§1.4) — Interim 02, given the opportunity to revise this wording during the
project's later progress stage, reproduced it unchanged (RQ2 substitutes "framework-agnostic" for
"framework-independent," a synonym with no substantive difference).

- **Main Research Question** (Interim 02 §1.4 only; Proposal does not state one separately, and
  does not contradict it): *How can a framework-agnostic guideline model and an automated
  validation tool be designed and implemented to improve the performance and accessibility of
  modern Single Page Applications?*
- **RQ1:** *How do different SPA render and state-management strategies influence performance
  metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?*
- **RQ2:** *What framework-agnostic architectural and accessibility patterns can be identified and
  standardized to improve the performance and accessibility of modern SPAs in compliance with WCAG
  2.2 guidelines?*
- **RQ3:** *How effectively can an automated static analysis validation tool detect architectural
  and accessibility violations in SPA source code before application deployment?*
- **RQ4:** *To what extent does the proposed validation tool achieve acceptable accuracy levels
  when compared with manual expert architectural reviews using Precision, Recall, and F1-score
  measurements?*
- **OBJ1-4** (Proposal §2.3 / Interim 02 §1.7.1-1.7.4, consistent): identify framework-agnostic
  patterns / analyze rendering-strategy influence on FCP-TTI / design-and-develop the validation
  tool / evaluate accuracy vs. expert review.

### What this supersedes

The dissertation's current `chapter1_introduction.md` §1.4 wording ("Set A": framework-independent
*formalization* / comparative tool coverage vs. ESLint-SonarQube-Lighthouse / AI-remediation
validity / developer usability-productivity) is **not** the authoritative RQ wording. It diverges
materially from the Proposal and Interim 02 with no documented, approved reason for the change.
Per this reconciliation's rules, a newer dissertation draft does not override an original approved
Proposal merely by being newer, and no source anywhere records a supervisor-approved revision from
Set B to Set A.

**This resolution does NOT itself rewrite the dissertation text.** `chapter1_introduction.md` and
the Chapter 6 RQ answers keyed to Set A still need a follow-up editorial pass — see the
reconciliation report's `NEXT_ACTION`. Flagging this explicitly so it is not lost: the *contract*
is resolved; the *document* is not yet aligned to it.

---

## 2. Research Aim

Proposal §2.2: *"To design, develop, and validate a comprehensive, framework-independent guideline
model alongside an integrated automated validation tool to systematically optimize the performance
and accessibility of Single Page Applications."*

Interim 02 §1.6 reproduces this in substance ("framework-agnostic," "ensure continuous
improvement" — no material change).

The current dissertation's Aim (`chapter1_introduction.md` §1.3) is a compatible technical
elaboration — it describes the four-layer meta-model, real-AST detection, and verified remediation
pipeline as the *means* of achieving the above aim, and does not contradict it. No conflict; no
forced rewrite required, though an explicit traceability link back to the Proposal wording is
recommended as follow-up.

## 3. Research Methodology / Paradigm / Strategy

Source: `chapter3_methodology.md` §3.1 for DSR/4-cycle detail (unchanged, not disputed by
Proposal/Interim 02). Interim 02 §3.1-3.3 additionally confirms: **Pragmatism** research paradigm,
**Deductive** research approach, **Design Science Research (DSR)** strategy, **Agile Scrum**
project-management methodology — all four now sourced to an authoritative document (previously
flagged `HUMAN_RESEARCH_CONFIRMATION_REQUIRED` in this document's prior revision; **now
resolved**).

**Discrepancy note (unchanged from prior revision):** `chapter3_methodology.md` §3.3 describes a
"Three-Stage Guideline Extraction Protocol" filtering down to a final core set of $N_3 = 8$ rules —
predating the two later expansion passes that grew the registry to 50 rules. Neither Proposal nor
Interim 02 states a specific rule count, so this remains a presentation decision for the
dissertation text itself, not something this reconciliation can resolve.

## 4. Primary Frameworks / Additional Framework Support

**Confirmed by Proposal §4.5 and Interim 02 §1.10, consistent with every in-repo source:** React,
Next.js, Angular are primary. Interim 02 §1.10/§2.5.2 additionally states explicitly that Vue.js is
"additionally supported by the automated validation tool" for framework detection/analysis, but is
NOT one of the "primary frameworks for guideline development and evaluation." This matches current
implementation behavior already (Vue has real-AST support for its own 6 rules; universal rules fall
back to legacy detection on Vue). No conflict.

## 5. Rule Taxonomy

Unchanged from the prior technical-completion pass — not addressed by Proposal or Interim 02
(neither document specifies an exact rule count):

- **Total canonical rules:** 50 (`src/matrix/four-layer-meta-model.ts`).
- **Research-facing primary domain split:** ARCHITECTURE = 19, STATIC_PERFORMANCE = 24,
  ACCESSIBILITY = 7 (`primaryResearchDomain()`).
- **WCAG version:** WCAG 2.2, per-rule Success Criterion mappings corrected in the prior technical
  pass (`WCAG_22_MAPPINGS`, `tests/wcag-mapping-integrity.test.ts`).

## 6. Performance Metrics — RESOLVED as a requirement, unresolved as an implementation

**RQ1 authoritatively requires FCP and TTI measurement** — explicit and identical in both Proposal
(§2.3) and Interim 02 (§1.4/§1.7.2). This resolves the prior ambiguity ("Set A does not require
FCP/TTI... Set B's RQ1 explicitly requires them") in favor of: **yes, required.**

**No real FCP/TTI measurement infrastructure exists in this repository** (confirmed again this
session; `app/performance/page.tsx`'s numbers remain an explicitly-disclosed scan-duration proxy,
not real Web Vitals). This is now a confirmed, authoritative, currently-unmet research requirement.
Building it requires `docs/research/RQ1_EXPERIMENT_PROTOCOL.md` and real experimental-factor
decisions from the researcher (rendering/state-management condition set, browser/hardware/network
profile, repetition count, TTI measurement tooling) — not attempted in this pass, consistent with
the standing instruction not to make human-only research-design decisions.

## 7. Accessibility Scope

Unchanged: 7 canonical rules, WCAG 2.2-aligned static analysis of a **statically detectable
subset** of accessibility concerns — not full conformance. Consistent with Proposal §2.3/§4.5 and
Interim 02 §1.4/§1.6, and with every prior audit of this project.

## 8. Repository Sample Requirement — RESOLVED

**Repository target = 20-30 real open-source SPA repositories (React, Next.js, Angular).** Sourced
consistently from both Proposal §4.3 ("A dataset comprising 20–30 public open-source SPA
repositories... will be mined from GitHub") and Interim 02 §3.4 ("Approximately 20–30 publicly
available open-source SPA repositories developed using React, Next.js, and Angular"). This resolves
the prior `HUMAN_RESEARCH_CONFIRMATION_REQUIRED` item — no document ever stated the range
differently, and it is unchanged between the two documents.

**Current actual count: 21** real repositories with pinned commits
(`benchmarks/real-world/run-real-world-benchmark.ts`'s `REPOS` array) — **RESOLVED 2026-09-03
(Stage 5)**: within the confirmed 20-30 target, with 15 of the 21 being primary-framework
(React/Next.js/Angular) repositories per the Proposal's own framework scope; Vue (3) and generic
JS/TS (3) are additional-support entries not counted toward the primary-framework characterization.
See `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` for the full expansion record. Corpus
size meeting the target is not the same as accuracy being established — RQ4's expert-validation
requirement (Section 10 below) remains separately outstanding.

## 9. Human Participant Requirement — RESOLVED

**Proposal §4.3/§5.2 and Interim 02 §1.9.2/§3.4/§3.6.1/§3.6.2 document a historical baseline of
approximately 80-100 student developers at NSBM Green University.** This figure is preserved as the
documented original baseline and was never rewritten in either source document.

**The researcher has confirmed, explicitly, that the final approved study target is 20
participants** — a later, deliberate research-scope decision, not a rejection of the Proposal/
Interim 02 baseline. `src/research/research-config.ts`'s `HUMAN_STUDY_TARGET_PARTICIPANTS = 20`
is therefore the correct, current, active value. See `docs/research/PARTICIPANT_TARGET_DECISION.md`
for the full decision record, including the historical baseline and the resolution sequence.

**PARTICIPANT_TARGET_STATUS: RESOLVED.**

## 10. Expert-Validation Requirement — RESOLVED

**Required, per RQ4 in both Proposal (§2.3) and Interim 02 (§1.4/§1.7.4)**, explicit and identical:
tool accuracy must be assessed against manual expert architectural review using Precision, Recall,
and F1-score. Infrastructure exists (`research/independent-annotation/`); 0 real expert submissions
collected to date. The internal controlled-benchmark P/R/F1 (1.0/1.0/1.0) does not satisfy this
requirement and must never be presented as if it does — this is already correctly disclosed in
`docs/research/FINAL_RQ_ANSWERS.md`.

## 11. Evaluation Metrics

Unchanged: Precision/Recall/F1 (controlled + real-world), SUS + Cronbach's alpha (human study),
qualitative tool-comparison table (Chapter 5 §5.2). The Precision/Recall/F1 methodology described
in Proposal §4.3 ("cross-referenced with manual expert architectural reviews... statistically
calculated") matches the mechanism already implemented (`evaluation-runner.ts`,
`precision-recall-engine.ts`); only the expert-review input data is missing (Section 10).

## 12. Ethical Requirements — RESOLVED (approval confirmed; reference number pending)

**Interim 02 §3.6.2 provides an explicit ethics protocol**: voluntary participation, participants
informed of the research objective before any data is collected, no sensitive personal information
requested, results presented only in aggregated/anonymized form, secure storage, research-only use.
This is confirmed consistent with — and already correctly implemented in —
`research/CONSENT_FORM.md`.

**The researcher has explicitly confirmed that formal ethics approval exists.**
`research/CONSENT_FORM.md`'s ethics-status field is updated accordingly:
`ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER`. No approval number, date, or committee name has
been supplied to this repository, and none has been fabricated —
`ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED` pending the researcher supplying that specific detail.
This does not block proceeding; it is a record-keeping item, not an open governance question.

**ETHICS_STATUS: CONFIRMED.**

## 13. Scope and Limitations

`chapter1_introduction.md` §1.6 is consistent with Proposal §4.5 and Interim 02 §1.10: static +
lightweight dynamic analysis of React/Next.js/Angular/Vue component source (Vue as additional
support per Section 4 above), excludes whole-project build-level analysis, full cross-file
data-flow analysis, and general-purpose security vulnerability scanning. No conflict.

---

## Required human action before this contract can be closed

**Research-governance items are now closed** as of 2026-09-03: participant target (Section 9) and
ethics approval (Section 12) are both resolved by explicit researcher confirmation.

Remaining, non-blocking-for-the-contract-itself items:

1. Correct `docs/dissertation/chapter1_introduction.md` §1.4 (RQ1-4), add the Main Research
   Question and Objectives 1-4, and propagate the corrected wording into Chapter 6's RQ answers
   (currently keyed to the now-superseded Set A wording). Not performed in this pass — this is the
   `NEXT_ACTION` for the following stage.
2. Supply the formal ethics-approval reference (number/date/committee) when available, to replace
   `ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED`.
3. Decide whether `chapter3_methodology.md` §3.3's "$N_3=8$" extraction-protocol description should
   be rewritten to describe the two later expansion passes, or left as historical description with
   an explicit note that expansion followed — neither Proposal nor Interim 02 addresses this.
4. ~~Expand the real-repository corpus from 15 toward the confirmed 20-30 target~~ — **DONE
   2026-09-03 (Stage 5)**: corpus now 21 repositories (15 primary-framework). Still required: run
   the real RQ1 FCP/TTI 44-execution experiment (protocol/infrastructure are ready per Stage 3A, but
   `REAL_RQ1_RUNS_COLLECTED` remains 0) before `docs/research/EXPERIMENT_FREEZE.md` can move to
   FROZEN.
