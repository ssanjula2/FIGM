# CHAPTER 3 — REFERENCE TRACEABILITY

Companion document to `research/thesis/CHAPTER_03_METHODOLOGY.md`. No new references were added at this stage — all five citations used were already verified and present in `docs/dissertation/references.md` before this chapter was drafted.

## A. Literature-derived claims

| Section | Claim | Verified Source | IEEE Citation | What the Source Supports | Limitation / Caveat |
|---|---|---|---|---|---|
| 3.2 | DSR frames artifact construction as a legitimate research contribution | Hevner et al., 2004 | [3] | Directly supports | Relocated from Chapter 2 (per `CHAPTER_02_REFERENCE_TRACEABILITY.md` §D) to its correct home in Chapter 3; this is the first chapter to actually cite it |
| 3.2 | DSR operationalises into a six-activity process (problem identification, objectives, design/development, demonstration, evaluation, communication) | Peffers et al., 2007 | [10] | Directly supports | Relocated from Chapter 2, same reasoning |
| 3.3.1 | Performance Efficiency is a technology-independent quality characteristic grounding FIGM's Domain Layer | ISO/IEC 25010:2011 | [1] | Directly supports | Already cited identically in Chapters 1 and 2 |
| 3.3.1, 3.3.4 | Accessibility, grounded in WCAG 2.2, is FIGM's second Domain-Layer characteristic; statically-detectable-subset boundary | W3C WCAG 2.2, 2023 | [2] | Directly supports | Already cited identically in Chapters 1 and 2 |
| 3.4 | Lighthouse is the instrument used to obtain FCP/TTI | Google, Lighthouse Overview | [23] | Directly supports | Already cited in Chapter 2; first used for its RQ1-instrument role specifically in this chapter |

## B. Project-evidence claims (not literature; kept separate per `THESIS_EVIDENCE_AUDIT.md` §AB)

| Section | Claim | Repository / research-document evidence | Notes |
|---|---|---|---|
| 3.3.1 | `ruleSetVersion 2.1.0`, 50 canonical rules, framework-gated real-AST coverage | `src/matrix/four-layer-meta-model.ts`, `src/research/research-config.ts` (verified `THESIS_EVIDENCE_AUDIT.md` §6–7) | — |
| 3.3.2 | Retirement of the obsolete "18→8" extraction pipeline | `docs/research/KNOWN_LIMITATIONS_REGISTER.md` §9; `CHAPTER_03_METHODOLOGY_AUDIT.md` §2 | The replacement seven-step methodology is this dissertation's own honest reconstruction of the actual, current derivation process — it is presented as methodology, not as a literature-derived claim, and is not attributed to any external source |
| 3.4 | 4 conditions, 1 warm-up + 10 measured runs, 44 total executions, Batch 1 PRIMARY / Batch 2 REPLICATION, no pooling | `research/rq1-experiment/protocol.json`; `THESIS_BLOCKER_RESOLUTION.md` Decision 1 | No numeric FCP/TTI result stated in this chapter, per instruction |
| 3.5 | 21-repository corpus (15 primary + 6 additional) | `benchmarks/real-world/raw-results/repository-manifest.json`; `THESIS_BLOCKER_RESOLUTION.md` Decision 3 | No findings totals stated in this chapter, per instruction |
| 3.6 | 67 cases, 1,717 case×rule rows, VIOLATION/NO_VIOLATION/AMBIGUOUS, blinded design | `research/independent-annotation/package-v1.1/ANNOTATION_INSTRUCTIONS.md`, `MANIFEST.json`, `candidate-judgment-matrix.json`; `docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md` | Collection status deliberately not stated as a result in this chapter — deferred to Chapter 6, per instruction |
| 3.7 | Internal benchmark construction and scoring method, no numeric outcome stated | `benchmarks/ground-truth.json`, `benchmarks/testbed/`, `src/eval/evaluation-runner.ts`; `CANONICAL_CONTROLLED_BENCHMARK_RESOLUTION.md` | The 65/0/0/100% figures are deliberately withheld from this chapter, per instruction ("prefer leaving actual results to Chapter 5/6") |
| 3.8 | Target 20, P001–P020, consent gate, PRIMARY/SECONDARY policy, hybrid questionnaire (one genuine SUS section) | `src/research/research-config.ts`, `src/engine/participant-repository.ts`; `docs/research/PARTICIPANT_TARGET_DECISION.md`; `research/QUESTIONNAIRE.md` (verified `THESIS_EVIDENCE_AUDIT.md` §16–18) | No participant results stated in this chapter |
| 3.9, Table 3.1 | Data-collection/instrument/analysis mapping | Synthesis of all evidence above; no new claims beyond what §§3.3–3.8 already establish | — |
| 3.10 | Reproducibility artefacts (frozen protocol, pinned manifests, `research-freeze-*` tags, frozen RQ4 package) | `THESIS_EVIDENCE_AUDIT.md` §10 (freeze-tag table); `THESIS_BLOCKER_RESOLUTION.md` Decision 1 | — |
| 3.11 | Ethics status: `CONFIRMED_BY_RESEARCHER`, reference `TO_BE_RECORDED` | `research/CONSENT_FORM.md`; `docs/audit/STAGE_11A_HUMAN_STUDY_FINAL_READINESS_AUDIT.md` (verified `THESIS_EVIDENCE_AUDIT.md` §19) | No identifier invented, consistent with instruction |
| 3.12 | Security is supplementary/out of scope | Chapter 1 §1.10 (In Scope/Out of Scope table) | Restated briefly, not expanded into a security methodology |

## C. Citations relocated into this chapter (per Chapter 2's Stage-T2 recommendation)

| Citation | Prior location | This stage |
|---|---|---|
| Hevner et al. [3] | Cited in the old, now-superseded Chapter 2 draft; flagged "relocated, not removed" in `CHAPTER_02_REFERENCE_TRACEABILITY.md` §D | Now cited in its correct home, §3.2 |
| Peffers et al. [10] | Same as above | Now cited in its correct home, §3.2 |

Wohlin et al. [11] (validity methodology) was **not** used in this chapter — the audit (`CHAPTER_03_METHODOLOGY_AUDIT.md` §3, item 14) confirmed Threats to Validity content already exists in `docs/dissertation/chapter6_user_study_and_validity.md` §6.7, which is this dissertation's correct location for it; Chapter 3 does not duplicate it.

## D. Summary lists

**NEW_REFERENCES_ADDED:** none — all 5 citations used were already present in `references.md`.

**REFERENCES_REMOVED:** none.

**REFERENCES_CORRECTED:** none — no factual correction was needed for any of the 5 citations used; only in-text IEEE-numeric style was applied throughout (author-date style fully eliminated, verified below).

**REFERENCES_RELOCATED (completed this stage):** Hevner et al. [3], Peffers et al. [10] — moved from the (now-superseded) old Chapter 2 draft into their correct home in Chapter 3, per the recommendation already recorded at Stage T2.
