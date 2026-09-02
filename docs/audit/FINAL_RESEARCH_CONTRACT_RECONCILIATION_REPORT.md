# FIGM Research Contract Reconciliation Report

**Date:** 2026-09-03
**Sources read in full:** `C:\Users\MSI\Desktop\My reserch\Research Proposal new.docx` (Proposal, original authoritative baseline) and `C:\Users\MSI\Desktop\My reserch\28256_Interim 02.docx` (Interim 02, later project-progress document).

## Provenance verification (done before any reconciliation)

Both files were confirmed to exist at the supplied paths, extracted as OOXML zip archives, and their full body text read (Proposal: 134 paragraphs; Interim 02: 321 paragraphs). Cross-checked against this FIGM project:

| Check | Proposal | Interim 02 |
|---|---|---|
| Module code | IS303.2 Research Methodology | (module not restated, but filename `28256_Interim 02.docx` carries the same student ID) |
| Student ID | 28256 | 28256 (filename) |
| Student name | A P H D S Sanjula | matches `research/CONSENT_FORM.md`'s investigator field, "A P H D S Sanjula" / Student ID 28256 |
| RQ1-4 wording | verbatim (see table) | verbatim match to Proposal |
| Topic | Framework-independent guideline model + automated validation tool for SPA performance/accessibility | identical topic, same 4-domain structure |

**Conclusion: both documents belong to this project.** One provenance anomaly is noted for transparency: `Research Proposal new.docx`'s OOXML `dc:creator` metadata field reads "PS/2020/022 - LIYANAARACHCHI L.A.T.C." (a different name/ID), while `cp:lastModifiedBy` reads "HDS Sanjula." This is consistent with the document having been created from a shared report template originally authored by another student, then fully rewritten for this project — the title-page body text and all 134 paragraphs of substantive content are unambiguously this project's. This is a metadata-provenance note, not a basis for rejecting the document; the content match is otherwise complete and exact (identical RQ1-4 wording to Interim 02, identical topic, identical module code).

**`C:\Users\MSI\Documents\vimesha .docx` and `C:\Users\MSI\Documents\Research.docx` were NOT used** (per instruction 4) — neither was opened or read.

---

## Source-comparison table

| # | Research Item | Proposal | Interim 02 | Current Dissertation | Current Implementation | Conflict? | Final Authoritative Interpretation | Evidence | Human Confirmation Required? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Research Title | Not stated (cover page: module name/code + student info only) | Not stated (no title page text captured; `dc:title` metadata empty) | No formal title page; "FIGM" used as working name throughout | `research/CONSENT_FORM.md`'s title is study-specific ("Usability Evaluation of the FIGM Code Inspector...") | No (absence, not contradiction) | No official dissertation title confirmed by any authoritative document | Proposal cover page; Interim02 `docProps/core.xml`; `CONSENT_FORM.md:3` | **YES** |
| 2 | Main Research Question | Not stated separately | §1.4: *"How can a framework-agnostic guideline model and an automated validation tool be designed and implemented to improve the performance and accessibility of modern Single Page Applications?"* | Not stated as a single line | N/A | No (addition, not contradiction) | Adopt Interim 02's Main RQ | Interim02 §1.4 | NO — resolved |
| 3 | RQ1–RQ4 | §2.3: RQ1 FCP/TTI; RQ2 framework-independent WCAG patterns; RQ3 pre-deployment violation detection; RQ4 P/R/F1 vs. expert review | §1.4: verbatim identical (RQ2 uses "framework-agnostic" for "framework-independent" — synonym, immaterial) | Materially different ("Set A": formalization fidelity / comparative tool coverage / AI-remediation validity / developer usability) | Infrastructure exists for **both** wordings | **YES** | **Set B (Proposal + Interim02, verbatim) is authoritative.** Interim 02, given every opportunity to revise this wording, reproduced it unchanged. | Proposal §2.3; Interim02 §1.4; `chapter1_introduction.md` §1.4 | Wording resolved; dissertation text correction is follow-up work (see NEXT_ACTION) |
| 4 | Research Aim | §2.2: design/develop/validate a framework-independent guideline model + automated validation tool, to systematically optimize performance/accessibility | §1.6: same in substance ("framework-agnostic," "ensure continuous improvement") | §1.3: technically elaborated (four-layer meta-model, real-AST, verified remediation pipeline) | Matches elaborated technical aim | No — compatible elaboration | Proposal/Interim02 wording is the authoritative top-level aim; dissertation wording may stand as elaboration of *how* it is pursued | Proposal §2.2; Interim02 §1.6; `chapter1_introduction.md` §1.3 | NO |
| 5 | Objectives 1–4 | §2.3: OBJ1-4, mirror RQ1-4 | §1.7.1-1.7.4: same 4 objectives, reworded | **Missing** — Ch1 §1.5 lists 4 retrospective "Contributions" instead | N/A | Gap, not contradiction | Adopt Proposal/Interim02's Objectives 1-4 | Proposal §2.3; Interim02 §1.7.1-1.7.4 | NO — resolved; dissertation edit is follow-up |
| 6 | Primary framework scope | §4.5: React, Next.js, Angular | §1.10: same, explicitly "primary frameworks for guideline development and evaluation" | §1.6: React, Next.js, Angular (+Vue, see #7) | React/Next.js/Angular treated as primary throughout benchmarks | No | React, Next.js, Angular = primary. Confirmed across all sources. | Proposal §4.5; Interim02 §1.10; `run-real-world-benchmark.ts` | NO |
| 7 | Vue status | Not mentioned anywhere | §1.10/§2.5.2: explicitly "additionally supported by the automated validation tool" for framework detection/analysis — **not** a primary guideline-development framework | §1.6 lists Vue alongside the primary three without clear demarcation | 6 Vue-specific real-AST rules; universal rules fall back to legacy detection on Vue (already secondary in practice) | No direct contradiction; dissertation wording looser than Interim02 | Vue = additional, implementation-layer support only, not primary. Matches current implementation behavior already. | Interim02 §1.10, §2.5.2; `FINAL_TRACEABILITY_MATRIX.md` "Vue extension" row | NO |
| 8 | Performance metrics / FCP / TTI | RQ1/Obj1: FCP and TTI explicitly required | RQ1/§1.7.2: same, explicit | Set A RQ1 omits FCP/TTI entirely | **No real FCP/TTI infrastructure exists** (`app/performance/page.tsx` uses a disclosed scan-duration proxy) | **YES** (dissertation Set A vs. authoritative source) | RQ1 authoritatively requires real FCP/TTI measurement. Confirmed, currently unmet. | Proposal §2.3 RQ1; Interim02 §1.4/§1.7.2 | Requirement resolved (YES); experimental design (factors, tooling, browser/network profile) needs a human decision — not designed here |
| 9 | WCAG 2.2 scope | §2.3 RQ2, §4.5: explicit | §1.4/§1.6/§3.4: explicit | Consistent, per-SC mapping corrected in a prior technical pass | `WCAG_22_MAPPINGS`, 7 rules mapped with rationale + detectability class | No | WCAG 2.2 confirmed; static mapping to a detectable subset only, never full conformance | Proposal; Interim02; `four-layer-meta-model.ts` | NO |
| 10 | Static-analysis scope | §4.2: static, rule-based, pre-deployment | §2.5.3: static, pre-deployment, consistent | "Static + lightweight dynamic analysis" (§1.6) | Primarily static AST; limited in-process dynamic execution for specific checks (`DynamicProfiler`) | Minor — scope slightly broadened, not contradicted | Core tool is static-first per Proposal/Interim02; the limited dynamic-execution component is a reasonable elaboration, provided it is never conflated with the separate, still-unbuilt RQ1 runtime FCP/TTI requirement (#8) | Proposal §4.2; Interim02 §2.5.3 | NO |
| 11 | Real repository sample target | §4.3: "20-30 public open-source SPA repositories... mined from GitHub" | §3.4: "Approximately 20–30... developed using React, Next.js, and Angular" | Not stated as a number in Ch1 | **15** repositories currently in `run-real-world-benchmark.ts`'s `REPOS` array | Gap, not contradiction | **Repository target = 20-30**, sourced consistently from both documents. Resolves the previously-open item in `FINAL_RESEARCH_CONTRACT.md` §8. | Proposal §4.3; Interim02 §3.4 | NO — target resolved; expanding 15→20-30 is outstanding data-collection work |
| 12 | Human participant target | §4.3/§5.2: **"80-100 student developers at NSBM Green University"** | §1.9.2/§3.4/§3.6.1/§3.6.2: consistently **"approximately 80-100,"** explicitly not yet conducted at Interim 02 | Cites "target 20" (§1.4, referencing Ch6 §6.1) | `HUMAN_STUDY_TARGET_PARTICIPANTS = 20` (`src/research/research-config.ts`), justified only by an **undocumented, in-session chat claim** | **YES — direct, material conflict** | **CONFLICT, not resolved by this pass.** Two independent, mutually-corroborating authoritative documents state 80-100; the code's 20-target traces to no document. Per instruction, this is not silently changed in either direction. | Proposal §4.3, §5.2; Interim02 §1.9.2, §3.4, §3.6.1, §3.6.2; `research-config.ts:14-19` | **YES — the single most consequential open item in this reconciliation** |
| 13 | Expert-review requirement | RQ4/Obj4: explicit — accuracy assessed vs. "manual expert architectural reviews using Precision, Recall, and F1-score" | RQ4/§1.7.4: identical | Set A RQ4: usability/productivity framing, no explicit expert-comparison requirement | `research/independent-annotation/` infrastructure exists, 0 real submissions | Conflict at RQ-wording level only (same root cause as #3); infrastructure itself unaffected | Expert validation via P/R/F1 IS a required authoritative component (RQ4). Currently unmet — a disclosed gap. | Proposal §2.3 RQ4; Interim02 §1.4 RQ4; `research/independent-annotation/results/STATUS.md` | Requirement resolved (YES); recruiting real experts is outstanding data-collection work |
| 14 | Precision/Recall/F1 methodology | §4.3: "Automated scan data will be cross-referenced with manual expert architectural reviews. The precision, recall, and error distribution will be statistically calculated." | Consistent (no separate elaboration) | P/R/F1 computed dynamically but only against self-authored controlled-benchmark ground truth, not real expert review (already honestly disclosed) | `evaluation-runner.ts` / `precision-recall-engine.ts` — mechanism real and unhardcoded; input (expert ground truth) does not yet exist | No — mechanism matches; gap is entirely missing expert input data, already disclosed | The Proposal/Interim02 methodology is what RQ4 requires; the current 100% P/R/F1 figure is against the internal benchmark only and must never be presented as satisfying this requirement until real expert data exists | Proposal §4.3; `docs/research/FINAL_RQ_ANSWERS.md` | NO — already correctly disclosed |
| 15 | Ethics/consent requirements | No explicit ethics section captured in extracted text | §3.6.2: explicit protocol — voluntary, informed before data collection, no sensitive PII, aggregated/anonymized, secure storage; survey "has not yet been conducted" | Not addressed in Ch1 (methodology-chapter concern) | `research/CONSENT_FORM.md` implements a matching protocol; `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION` — no formal approval reference in any document | No — implementation protocol matches Interim02's description; only the formal approval reference is missing | Ethics PROTOCOL is authoritatively confirmed and already correctly implemented. Formal ethics-committee approval status remains unresolved. | Interim02 §3.6.2; `research/CONSENT_FORM.md` | YES (only for the formal approval reference, not the protocol design) |
| 16 | Scope/limitations | §4.5: bound to React/Next.js/Angular; backend performance, network latency profiling, cloud orchestration, deep security assessment explicitly out of scope | §1.10: consistent, plus explicit Vue clarification (#7) | §1.6: consistent — excludes whole-project build analysis, full cross-file data-flow, general security scanning | Consistent with the above | No | Scope and limitations are consistent across all four sources | Proposal §4.5; Interim02 §1.10; `chapter1_introduction.md` §1.6 | NO |

---

## Resolution rules applied

- Proposal treated as original authoritative baseline; Interim 02 treated as later confirmation, not automatic override.
- Where Interim 02 reproduces the Proposal unchanged (RQ1-4, Aim, Objectives, framework scope, repository target, participant target), that reproduction is treated as **confirmation**, strengthening rather than weakening the Proposal's authority.
- Where Interim 02 adds detail the Proposal is silent on (Main RQ, explicit Vue clarification), that addition is adopted as authoritative since it does not contradict the Proposal.
- Where the current dissertation or current implementation diverges from a Proposal/Interim02 position **without** a documented, explicitly-approved reason, that divergence is flagged as a conflict and NOT silently resolved in the dissertation's or implementation's favor (items #3, #8, #12, #13).
- The one exception considered and rejected: treating the current dissertation's Set A RQ wording as authoritative because it is newer. Rejected per explicit instruction — newness alone is not evidence of approval, and no document anywhere records a supervisor-approved change from Set B to Set A.
- Item #12 (participant target) is the clearest case of this rule: an in-session chat instruction is not documentary evidence sufficient to override two independent, mutually-corroborating official documents, so it is flagged rather than trusted.

---

## Files updated this pass (only where evidence supported a change)

- `docs/research/FINAL_RESEARCH_CONTRACT.md` — RQ set conflict resolved to Set B as authoritative wording; repository target resolved (20-30); participant target reclassified from "resolved at 20" to "CONFLICT, human confirmation required"; expert-validation requirement resolved (YES).
- `docs/research/FINAL_TRACEABILITY_MATRIX.md` — Proposal/Interim 02 columns filled in with real sourced values (previously "UNKNOWN") for every row affected by this reconciliation.
- `docs/research/PARTICIPANT_TARGET_DECISION.md` — Proposal and Interim 02 rows updated from "UNKNOWN — no document" to "80-100, sourced"; conflict against the code's 20-target now explicit; status remains open, code NOT modified.
- `docs/research/EXPERIMENT_FREEZE.md` — participant-target row updated to reflect the now-precise conflict; repository-target row updated to reflect the now-resolved 20-30 target.
- `docs/research/FINAL_RQ_ANSWERS.md` — header updated to state that Set B is now confirmed sourced from the actual Proposal/Interim 02 documents (previously only "this session's task instructions"); both sets' answers preserved unchanged since neither the evidence nor the honesty findings underneath them changed.

**Not modified in this pass** (out of the explicit file list for this instruction, and each requiring a larger, separate editorial pass): `docs/dissertation/chapter1_introduction.md` (RQ1-4, Aim, Objectives), `docs/dissertation/chapter6_*` (RQ answers currently keyed to Set A). See NEXT_ACTION.

No detector logic was modified. No git commit or tag was made.

---

## Final status block

```
FINAL_RQ_SET:
Set B — verbatim from Proposal §2.3 and Interim 02 §1.4 (confirmed identical across both
authoritative documents). Main Research Question per Interim 02 §1.4. Objectives 1-4 per
Proposal §2.3 / Interim 02 §1.7.1-1.7.4. The current dissertation (chapter1_introduction.md
§1.4, "Set A") has NOT yet been corrected to this wording — that is outstanding editorial
work, not a research-governance ambiguity (see NEXT_ACTION).

PARTICIPANT_TARGET:
HUMAN_CONFIRMATION_REQUIRED. Proposal and Interim 02 both independently state 80-100 student
developers at NSBM Green University. The code's current target of 20 is NOT supported by
either document — it traces only to an undocumented in-session claim. Do not begin real
participant collection against either number until this is confirmed by the researcher
against actual written authority (a supervisor email/message, an ethics-approved protocol
document, or a later approved revision document this reconciliation has not seen).

REPOSITORY_TARGET:
20-30 real open-source SPA repositories (React, Next.js, Angular), per Proposal §4.3 and
Interim 02 §3.4 (consistent). Current actual count: 15. Resolved requirement; expanding the
corpus is outstanding data-collection work, not a governance decision.

PRIMARY_FRAMEWORKS:
React, Next.js, Angular — confirmed consistent across Proposal, Interim 02, current
dissertation, and current implementation. No conflict.

VUE_STATUS:
Additional, implementation-level (framework detection/parsing) support only — explicitly not
a primary framework for guideline development or evaluation, per Interim 02 §1.10/§2.5.2.
Matches current implementation behavior already (6 Vue-specific real-AST rules; universal
rules fall back to legacy detection on Vue).

RQ1_FCP_TTI_REQUIRED:
YES. Explicit and identical in both Proposal (§2.3 RQ1) and Interim 02 (§1.4 RQ1). No real
FCP/TTI measurement infrastructure currently exists in this repository. Building it requires
a human decision on experimental factors (rendering/state-management condition set,
browser/hardware/network profile, repetition count, TTI measurement tooling) — not attempted
in this pass.

RQ4_EXPERT_VALIDATION_REQUIRED:
YES. Explicit and identical in both Proposal (§2.3 RQ4) and Interim 02 (§1.4 RQ4) — accuracy
must be assessed against manual expert architectural review using Precision/Recall/F1.
Infrastructure exists (`research/independent-annotation/`); 0 real expert submissions
collected to date. Currently only the internal, self-authored controlled-benchmark P/R/F1
(1.0/1.0/1.0) exists, which does not satisfy this requirement and must not be presented as
if it does.

ETHICS_STATUS:
Protocol design CONFIRMED consistent with Interim 02 §3.6.2 (voluntary participation, no
sensitive PII, informed before data collection, anonymized/aggregated reporting, secure
storage) and already correctly implemented in `research/CONSENT_FORM.md`. Formal
ethics-committee approval reference/number remains UNRESOLVED — not stated in the Proposal,
Interim 02, or any in-repository document. `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION`
unchanged.

RESEARCH_CONTRACT_READY:
HUMAN_CONFIRMATION_REQUIRED — blocked specifically on the participant-target conflict (#12)
and the still-unresolved formal ethics approval reference. The RQ-wording ambiguity that
previously blocked this (Set A vs. Set B) is now resolved to Set B; it no longer blocks
contract readiness on its own, but the dissertation text itself still needs correcting to
match (see NEXT_ACTION) before the contract and the submitted document agree.

EXPERIMENT_FREEZE_READY:
NO. Blocked on: (1) participant-target conflict resolution, (2) formal ethics approval
reference, (3) RQ1 FCP/TTI experiment protocol does not yet exist, (4) real-repository corpus
below its now-confirmed 20-30 target (currently 15), (5) dissertation RQ1-4/Aim/Objectives
text not yet corrected to match the now-resolved authoritative wording.

NEXT_ACTION:
1. Researcher confirms, in writing, which participant-target figure is actually approved —
   the documented 80-100 (Proposal + Interim 02) or a genuinely approved reduction to ~20 —
   and supplies the evidence for whichever it is (email, ethics protocol document, or a later
   approved revision this reconciliation has not seen).
2. Researcher confirms or supplies the formal ethics-committee approval reference.
3. Once (1) and (2) are resolved: correct `docs/dissertation/chapter1_introduction.md` §1.4
   (RQ1-4), add the Main Research Question and Objectives 1-4, and align §1.3's Aim wording
   to explicitly trace to Proposal §2.2/Interim02 §1.6 — then propagate the corrected RQ set
   into Chapter 6's RQ answers (currently keyed to the now-superseded Set A wording).
4. Only after 1-3: expand the real-repository corpus toward the 20-30 target, build the RQ1
   FCP/TTI experiment protocol (human-decided experimental factors required first), and
   proceed toward `docs/research/EXPERIMENT_FREEZE.md`'s FROZEN state.
```
