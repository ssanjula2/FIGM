# CHAPTER 3 — METHODOLOGY AUDIT (Stage T3, audit only)

**Status:** Audit only. No rewrite performed.

**Files inspected as the current Chapter 3:** `docs/dissertation/chapter3_methodology.md` (131 lines — read in full) and `docs/dissertation/chapter3_architecture.tex` (77 lines — read in full, an alternative/overlapping LaTeX rendering of the same meta-model material, more current on the ALP table but with no methodology content either). Cross-referenced against `docs/research/RQ1_EXPERIMENT_PROTOCOL.md`, `research/rq1-experiment/protocol.json`, `docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md`, `research/independent-annotation/package-v1.1/ANNOTATION_INSTRUCTIONS.md`, `research/CONSENT_FORM.md`, `research/DATA_COLLECTION_PROTOCOL.md`, `src/engine/participant-repository.ts`, `docs/research/PARTICIPANT_TARGET_DECISION.md`, `docs/dissertation/chapter6_conclusion.md`, and `docs/dissertation/chapter6_user_study_and_validity.md` (whose existence changes where some of the 18 audit items are expected to live — see §1).

---

## 0. Headline Finding

**The current Chapter 3 covers only the artifact-design half of the methodology (Design Science Research framing, the 4-layer meta-model, and a guideline-extraction protocol) and contains zero content on the empirical evaluation methodology for RQ1, RQ3, RQ4, the internal benchmark, the human study, or ethics.** Every one of those six methodology strands exists and is well-documented elsewhere in the repository (`docs/research/*`, `research/*`, `src/engine/participant-repository.ts`), but none of it has been distilled into Chapter 3. This is a larger content gap than either Stage T1 (Chapter 1) or Stage T2 (Chapter 2) found — closer in scale to Stage T2's finding that whole required sections did not exist, but here affecting roughly two-thirds of the chapter's expected content rather than half.

**A second, independent finding:** the content that *does* exist in Chapter 3 contains an internal, self-contradicting inconsistency — §3.2 has already been corrected (in a prior editing pass) to say "all 50 canonical rules," while §3.3 and §3.4, immediately following it, still describe an obsolete pipeline that filters 18 candidate guidelines down to a final set of 8, with only 8 rules' formal predicates shown. This is exactly the staleness `docs/research/KNOWN_LIMITATIONS_REGISTER.md` §9 already flagged for this file, not yet fixed.

---

## 1. Structural Comparison

No explicit "required Chapter 3 structure" was supplied in this stage's instruction (unlike Stages T1/T2). In its absence, this audit uses Interim Submission 02's own Chapter 3 — the closest available authoritative university-guide equivalent, already fully reviewed in this project's evidence-audit stage — as the structural baseline:

**Interim 02 Chapter 3 structure (baseline):**
```
3.1 Research Paradigm
3.2 Research Approach
3.3 Research Strategy
3.4 Fact Collection Mechanisms
3.5 Research Methodology Execution Workflow
    3.5.1 Problem Identification
    3.5.2 Relevance Justification
    3.5.3 Comparative Analysis and Gap Justification
    3.5.4 Define and Finalize Objectives
    3.5.5 Design, Development, Data Management and Handling
    3.5.6 Evaluation and Communication
3.6 Project Management Methodology
    3.6.1 Project Timeline
    3.6.2 Ethical Considerations
3.7 Chapter Summary
```

**Current `chapter3_methodology.md` structure:**
```
3.1 Design Science Research (DSR) Framework
3.2 Four-Layer Architecture Meta-Model
3.3 Three-Stage Guideline Extraction Protocol
3.4 Formal Mathematical Detection Predicates
```

| Interim baseline section | Current draft equivalent | Verdict |
|---|---|---|
| 3.1 Research Paradigm | 3.1 DSR Framework (partial — states DSR as the paradigm, correctly) | Present, but conflates "paradigm" (pragmatism, per Interim §3.1) with "strategy" (DSR, per Interim §3.3) into one section. Not wrong, but compressed relative to the baseline. |
| 3.2 Research Approach | *(absent)* | Not stated — the current draft never names a research approach (Interim's own Ch3 used "Deductive Research Approach") independently of the DSR strategy. |
| 3.3 Research Strategy (DSR) | 3.1 DSR Framework | Present, reasonably matches in substance |
| 3.4 Fact Collection Mechanisms | *(absent)* | **Missing.** No description of how RQ1's experimental data, RQ3's repository corpus, RQ4's expert annotations, or the human-study responses are actually collected. |
| 3.5 Research Methodology Execution Workflow (3.5.1–3.5.6) | *(absent)* | **Missing entirely**, including the RQ-mapped design/development/data-management substance the audit's 18-item checklist below expects. |
| 3.6 Project Management Methodology / 3.6.1 Timeline / 3.6.2 Ethical Considerations | *(absent)* | **Missing entirely.** No ethics section anywhere in Chapter 3. |
| 3.7 Chapter Summary | *(absent)* | **Missing.** |
| *(not in Interim baseline)* | 3.2 Four-Layer Architecture Meta-Model | Present; internally correct in its own most-recently-corrected passages, but co-exists with the stale §3.3 below it (see §3 of this audit) |
| *(not in Interim baseline)* | 3.3 Three-Stage Guideline Extraction Protocol | Present but **stale** — describes an obsolete N=18→8 rule-extraction pipeline that predates the 50-rule catalog |
| *(not in Interim baseline)* | 3.4 Formal Mathematical Detection Predicates | Present but **incomplete relative to the current system** — only 8 of 50 rules have a shown predicate, consistent with the same staleness |

**Verdict:** the current draft is not a version of the Interim's Chapter 3 structure with some sections missing — it is a differently-scoped document (an artifact-design specification) that happens to share a chapter number. `CHAPTER_3_STRUCTURE_ALIGNMENT=PARTIAL`, reflecting that the DSR/paradigm framing genuinely is present and broadly sound, while the fact-collection, RQ-mapped execution workflow, and project-management/ethics sections the baseline structure requires are absent outright, not merely thin.

## 2. Internal Consistency Defect: §3.2 vs. §3.3/§3.4

**CLAIM:** Chapter 3 consistently describes the current, 50-rule FIGM catalog.
**STATUS:** CONTRADICTED (internal to the chapter itself).
**EVIDENCE:**
- §3.2.1 (Layer 3, ALP definition) carries two explicit, dated correction notes stating that a prior "23 of 25 rules" claim was wrong, and that the accurate picture — verified directly against `real-syntax-node-builder.ts` and `source-parser.ts` — is that **all 50 canonical rules** now have real-AST detection on at least one framework, with a precise breakdown of which of the 50 are universal-general-JS-gated, universal-JSX-gated, or framework-scoped. This is a well-evidenced, current, and accurate passage.
- §3.3, immediately below it, states: *"candidate guidelines are subjected to a sequential 3-stage extraction pipeline filtering an initial candidate pool of $N_0 = 18$ guidelines down to a final core set of $N_3 = 8$ rules,"* with Stage 1 excluding 6, Stage 2 excluding 2, Stage 3 excluding 2, for a final $N_3=8$.
- §3.4 then presents formal first-order predicates for exactly 8 rules: `FIGM-PERF-01` through `FIGM-PERF-04` and `FIGM-A11Y-01` through `FIGM-A11Y-04` — none of `FIGM-PERF-05/06`, none of `FIGM-REACT-*`, none of `FIGM-NEXT-*`, none of `FIGM-ANG-*`, none of `FIGM-VUE-*`, and none of `FIGM-A11Y-05/06/07`.
- Cross-checked against `src/matrix/four-layer-meta-model.ts` (verified during the original evidence-audit stage): the canonical catalog contains 50 rules at `ruleSetVersion 2.1.0`, not 8.

**NOTES:** This is precisely the item `docs/research/KNOWN_LIMITATIONS_REGISTER.md` §9 already names ("`chapter3_methodology.md` §3.3 still describes an obsolete rule-extraction protocol predating the 50-rule expansion") — confirmed still present, unresolved, at this audit. §3.3 and §3.4 must be rewritten (either updated to the real 50-rule derivation history, if one is documented elsewhere, or replaced with an honest, current description of how the 50-rule catalog was actually arrived at) rather than left as a stale artifact contradicting the paragraph immediately above it.

## 3. Item-by-Item Audit (the 18 required checkpoints)

**1. Research design / Design Science Research**
STATUS: PRESENT, PARTIAL. §3.1 correctly frames DSR as the guiding paradigm/strategy and cites Hevner et al. — in author-date style, needs IEEE-numeric conversion (`[3]` per `references.md`, consistent with Chapter 2's relocation of this citation to Chapter 3). The DSR cycle diagram's four iterations ("Problem Taxonomy," "Guideline Extraction," "Meta-Model Formalization," "Artifact Implementation & Empirical Evaluation") describe internal *implementation* phases, not the four research questions — RQ1–RQ4 are not named anywhere in this diagram or its surrounding text.

**2. Exact RQ1–RQ4 mapping**
STATUS: MISSING. No section states which methodology activity answers which of RQ1–RQ4. Chapter 1 (§1.7) already states the Objective-1..4 ↔ RQ1..4 mapping; Chapter 3 should state the analogous *methodology-activity* ↔ RQ mapping (e.g., "the controlled experiment in §3.X answers RQ1; the four-layer meta-model and guideline-derivation process in §3.Y answers RQ2," etc.) and currently does not.

**3. RQ1 controlled experiment**
STATUS: MISSING ENTIRELY from Chapter 3. Zero mentions of CSR_LOCAL/CSR_GLOBAL/SSR_LOCAL/SSR_GLOBAL, FCP, TTI, Lighthouse, warm-up/measured run counts, or the Batch 1 (PRIMARY) / Batch 2 (REPLICATION) distinction anywhere in either `chapter3_methodology.md` or `chapter3_architecture.tex`. This content exists, fully and rigorously, in `docs/research/RQ1_EXPERIMENT_PROTOCOL.md` and `research/rq1-experiment/protocol.json`, and the Batch 1/Batch 2 resolution exists in `THESIS_BLOCKER_RESOLUTION.md` Decision 1 — none of it has been distilled into the dissertation's own methodology chapter yet.

**4. RQ2 guideline-model derivation and WCAG 2.2-aligned scope**
STATUS: PRESENT, PARTIAL, and internally inconsistent (see §2 above). The 4-layer meta-model (§3.2) is well-specified and current. The guideline-*derivation* history (§3.3) is stale and must be corrected or replaced. WCAG 2.2-aligned scope is stated at the Domain-Layer level (§3.2.1: "Accessibility (WCAG 2.2)") but the chapter does not yet state the "statically detectable subset, not full conformance" boundary that Chapters 1 and 2 both already state carefully — Chapter 3 should restate this boundary at the point it describes how a WCAG success criterion becomes an executable rule, not leave it only to Chapters 1/2/6.

**5. RQ3 repository evaluation**
STATUS: MISSING ENTIRELY. No mention of the 20–30 repository target, the final 21-repository corpus (15 primary + 6 additional), or the repository-selection method, anywhere in Chapter 3. This content exists in `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` and `benchmarks/real-world/raw-results/repository-manifest.json`, and the corrected wording exists in `THESIS_BLOCKER_RESOLUTION.md` Decision 3 and the now-canonical `chapter6_conclusion.md` §6.2 — none of it is previewed as a *methodology* (i.e., before results) in Chapter 3.

**6. RQ4 independent expert protocol**
STATUS: MISSING ENTIRELY. No mention of the blinded case×rule annotation design, the VIOLATION/NO_VIOLATION/AMBIGUOUS label set, the exclusion of AMBIGUOUS rows from TP/FP/FN, the Precision/Recall/F1 formulas, or the current PENDING status. This protocol is fully specified in `research/independent-annotation/package-v1.1/ANNOTATION_INSTRUCTIONS.md` and `docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md` (67 cases, 1,717 case×rule judgment rows) and confirmed PENDING (0 real submissions) in `THESIS_EVIDENCE_AUDIT.md` §14 — none of this appears in Chapter 3.

**7. Internal controlled benchmark**
STATUS: MISSING as a *methodology* description separate from RQ4. Chapter 3 does not describe how the controlled benchmark (`benchmarks/ground-truth.json` + `benchmarks/testbed/`, scored by `src/eval/evaluation-runner.ts`) is constructed or scored, nor does it state — as `CANONICAL_CONTROLLED_BENCHMARK_RESOLUTION.md` and Chapter 5's own circularity disclosure both already do — that this benchmark is self-authored and structurally distinct from, and never a substitute for, RQ4's independent expert validation. Because Chapter 3 says nothing about either the internal benchmark or RQ4 yet, the two cannot currently be confused *in Chapter 3* (there is nothing there to confuse) — but this is a content gap that becomes a real risk the moment the rewrite adds both, since they must be introduced as clearly distinct from the outset.

**8. Supplementary human study**
STATUS: MISSING ENTIRELY from Chapter 3. No mention of the target of 20 real participants, the P001–P020 identifier scheme, the consent-verification gate, the PRIMARY/SECONDARY repeated-scan classification, or the explicit statement that this study is supplementary to, and not a substitute for, RQ4. All of this is implemented and documented (`src/research/research-config.ts`, `src/engine/participant-repository.ts`, `research/DATA_COLLECTION_PROTOCOL.md`, `docs/audit/STAGE_11B_REPEATED_SCAN_ATTEMPT_POLICY.md`) but not previewed as methodology in Chapter 3. (Its *status* — 0/20 collected — is correctly, honestly reported downstream in `chapter6_user_study_and_validity.md` §6.6; that is a results/status report and appropriately lives in Chapter 6, not Chapter 3 — Chapter 3's job is to describe the *design*, which is what is currently missing.)

**9. Ethics wording**
STATUS: MISSING ENTIRELY. No ethics section exists anywhere in Chapter 3. The correct, current wording — "ethics approval status confirmed by the researcher; the specific approval reference/number/date/committee name has not yet been supplied to this repository (`TO_BE_RECORDED`)" — is established and consistent in `research/CONSENT_FORM.md` and `docs/audit/STAGE_11A_HUMAN_STUDY_FINAL_READINESS_AUDIT.md`, and this exact placeholder discipline must carry into Chapter 3's own ethics subsection (mapping to the Interim baseline's §3.6.2) rather than a number being invented at rewrite time.

**10. Sampling**
STATUS: MISSING. No description of how the 21 real-world repositories were selected/sampled, nor of the participant-recruitment sampling approach for the human study, exists in Chapter 3.

**11. Instruments**
STATUS: MISSING. No description of the instruments used across the research (Lighthouse for RQ1; the RQ4 blinded annotation package/template; the human-study questionnaire, which `THESIS_EVIDENCE_AUDIT.md` §16-18 already established is a **hybrid instrument** — only one section of which is genuine SUS — a distinction Chapter 3 must state correctly if it describes the questionnaire as an instrument at all) appears in Chapter 3.

**12. Data collection**
STATUS: MISSING. No description of the actual data-collection mechanics (automated Lighthouse harness for RQ1; automated repository cloning/scanning for RQ3; manual expert annotation submission for RQ4; consent-gated in-app scan logging for the human study) appears in Chapter 3.

**13. Analysis methods**
STATUS: MISSING. No statement that RQ1's analysis is descriptive statistics only (mean/median/SD/min/max), with no inferential significance test computed or claimed — a boundary `research/rq1-experiment/scripts/analyze-results.ts` and the now-canonical `chapter6_conclusion.md` §6.2 both state explicitly — appears anywhere in Chapter 3. No statement of the Precision/Recall/F1 formulas (used identically for both the internal benchmark and, once real data exists, RQ4) appears either.

**14. Threats to validity**
STATUS: Appropriately absent from Chapter 3 as a full section — this content already exists at `docs/dissertation/chapter6_user_study_and_validity.md` §6.7 (Internal/External/Construct Validity), which is the correct location for it under this dissertation's actual chapter allocation (Chapter 6, not Chapter 3). No action needed in Chapter 3 beyond, optionally, a brief forward-reference. **Adjacent finding, out of this stage's scope but worth flagging for a future Chapter 6 pass:** §6.7's Construct Validity bullet currently reads "Aligned directly with WCAG 2.2 AA accessibility and Core Web Vitals performance standards" — this both asserts a specific conformance *level* (AA) not otherwise established anywhere in this audit's evidence trail, and risks exactly the static/runtime conflation this project has otherwise been careful to avoid (FIGM's static rules are not a Core Web Vitals measurement). Not fixed here; recorded for a later Chapter 6 stage.

**15. Reproducibility**
STATUS: MISSING as an explicit statement in Chapter 3, though the underlying artifacts are genuinely reproducible (frozen protocol files, frozen annotation packages, a pinned repository manifest with commit SHAs). Chapter 3 should state this explicitly (e.g., pointing to the frozen `protocol.json`, the `research-freeze-*` git tags, and the frozen RQ4 package) rather than leaving reproducibility as an implicit property a reader has to infer from the repository.

**16. Security is supplementary/out of research scope**
STATUS: MISSING from Chapter 3 specifically, though correctly stated in Chapter 1's scope table ("deep security vulnerability assessment" — out of scope). Chapter 3 does not currently need to restate this at length, but should note it briefly wherever it describes the rule taxonomy, since `figm-spec.json`/`four-layer-meta-model.ts` do carry rules with a "guideline" domain label that could otherwise be mistaken for security scope — a one-sentence clarification is recommended at rewrite time.

**17. Static performance findings are not FCP/TTI measurements**
STATUS: MISSING as an explicit statement in Chapter 3, and this is the item Chapter 3's eventual rewrite most needs to get right, precisely because Chapter 3 will be the first place the static-rule methodology (RQ2/RQ3) and the FCP/TTI experimental methodology (RQ1) are described side by side. Chapters 1 and 2 already state this boundary; Chapter 3 currently cannot violate it only because it does not yet describe either methodology at all — this is flagged as the single highest-priority wording discipline for the rewrite stage.

**18. No fabricated/pending results written as completed outcomes**
STATUS: No violation found in the *current* draft — it contains no RQ1/RQ3/RQ4/benchmark/participant numbers at all, fabricated or otherwise, because none of that content has been written yet. This is listed as a **rewrite-stage watch item**, not a current defect: once §§3–13 of this checklist are addressed, every new sentence describing RQ1/RQ3/RQ4/benchmark/human-study status must be checked against `THESIS_BLOCKER_RESOLUTION.md`'s frozen values and PENDING statuses before being written, exactly as Chapters 1, 2, and the already-canonical parts of Chapter 6 already do correctly.

## 4. Specific Stale/Incorrect Items Requested

- **Stale 80–100 participant wording:** 0 instances in the current `chapter3_methodology.md`/`chapter3_architecture.tex` — the topic is entirely absent, not stated incorrectly. (Contrast: Chapter 1 §1.10 already correctly states 20 as final, 80–100 as historical baseline — Chapter 3's rewrite must match that, not reintroduce 80–100 as if still current.)
- **Stale 15-repository wording:** 0 instances — the topic is entirely absent from the current draft.
- **Old RQ1 dataset conflicts:** Not applicable — RQ1 is not mentioned in the current draft, so the Batch 1/Batch 2 conflict cannot currently appear (correctly or incorrectly) in Chapter 3. Must be introduced using `THESIS_BLOCKER_RESOLUTION.md` Decision 1's resolution (Batch 1 primary, Batch 2 replication, no pooling) from the outset at rewrite time.
- **Incorrect benchmark figures:** 0 — no benchmark figures of any kind currently appear in Chapter 3.
- **Methodology/results mixing:** 0 confirmed instances in the current text — but only because so much of the required methodology content is simply absent rather than present-and-correctly-separated from results. The rewrite must take care to keep Chapter 3 as design-only (per the T1/T2 precedent of not inserting FIGM's own results into earlier chapters), consistent with `docs/audit/STAGE_2_DISSERTATION_ALIGNMENT_REPORT.md`'s own note that an earlier draft pass already had to separate methodology from results once before.
- **Unsupported inferential statistics:** 0 — none present.
- **Ethics overclaims:** 0 — no ethics content exists to overclaim.
- **RQ4 completion overclaims:** 0 — RQ4 is not mentioned.

The absence of stale/incorrect wording in most of these categories is a direct consequence of the absence of the underlying content, not evidence that Chapter 3 currently handles these topics well.

## 5. Terminology and Citation Style Findings (secondary, not separately requested but relevant to consistency)

- Chapter 3 uses "Framework-Independent Guideline Model (FIGM)" exclusively, never "Framework-Agnostic." Chapter 1's canonical draft establishes "Framework-Agnostic Guideline Model (FIGM)" as the primary term (matching the official thesis title and RQ2), with "Framework-Independent" noted once as the term used interchangeably inside the project's own implementation artifacts. Chapter 3 should be brought into line with this convention at rewrite time — it is the chapter most likely to need to explain the term's dual usage, since it is where the formal model itself is defined.
- All citations in Chapter 3 (currently just Hevner et al.) use author-date style; needs IEEE-numeric conversion to `[3]`, consistent with every other chapter.
- The DSR-cycle diagram's "Environment" box lists "Single Page Applications (React, Vue, Angular)" — omitting Next.js entirely and not distinguishing primary (React, Next.js, Angular) from additional (Vue.js) framework scope. This should be corrected at rewrite time to match Chapter 1 §1.10's scope statement exactly.

## 6. Proposed Rewrite Structure (for the T3 rewrite stage — not yet written)

A hybrid of the Interim baseline (§1 of this audit) and the RQ-mapped content this stage's checklist requires, recommended for the rewrite stage's consideration (final structure to be confirmed with the researcher before drafting, following the T1/T2 pattern of stating a structure and getting it approved before writing):

```
3.1 Research Paradigm and Approach
3.2 Research Strategy (Design Science Research)
3.3 The Framework-Agnostic Guideline Model — Formal Specification
    (current §3.2 content, terminology-corrected; §3.3/§3.4's stale
     extraction protocol either corrected with real derivation history
     or replaced/retired, per §2 of this audit)
3.4 RQ1 — Controlled Rendering/State-Management Experiment (Design)
3.5 RQ3 — Real-World Repository Evaluation (Design)
3.6 RQ4 — Independent Expert Validation (Design)
3.7 Internal Controlled Benchmark (Design) — explicitly separated from 3.6
3.8 Supplementary Human Usability Study (Design)
3.9 Data Collection, Instruments, and Analysis Methods
3.10 Reproducibility
3.11 Ethical Considerations
3.12 Chapter Summary
```

---

## Summary

```
CHAPTER_3_STRUCTURE_ALIGNMENT=PARTIAL
RQ1_METHOD_ALIGNMENT=FAIL
RQ2_METHOD_ALIGNMENT=PARTIAL
RQ3_METHOD_ALIGNMENT=FAIL
RQ4_METHOD_ALIGNMENT=FAIL
HUMAN_STUDY_METHOD_ALIGNMENT=FAIL
ETHICS_WORDING=FAIL
STALE_PARTICIPANT_TARGET_REFERENCES=0
STALE_REPOSITORY_COUNTS=0
INTERNAL_BENCHMARK_RQ4_CONFUSIONS=0
RESULTS_MIXED_INTO_METHOD=0
UNSUPPORTED_METHOD_CLAIMS=0
UNRESOLVED_CHAPTER_3_ISSUES=9
READY_TO_REWRITE_CHAPTER_3=YES
```

**Notes on the counts:**
- `RQ2_METHOD_ALIGNMENT=PARTIAL` rather than FAIL because the 4-layer meta-model itself (§3.2) is genuinely well-specified and current; it is marked PARTIAL, not PASS, because of the direct internal contradiction with §3.3/§3.4 documented in §2 of this audit.
- The zero counts in §4 reflect *absence* of stale content, not correctness — see the closing note of §4.
- `UNRESOLVED_CHAPTER_3_ISSUES=9`: (1) the §3.2/§3.3/§3.4 internal contradiction; (2) missing RQ1 methodology; (3) missing RQ3 methodology; (4) missing RQ4 methodology; (5) missing internal-benchmark-vs-RQ4 separation statement; (6) missing human-study methodology; (7) missing ethics section; (8) missing explicit RQ1–RQ4 methodology mapping; (9) terminology/citation-style inconsistencies (Framework-Independent vs. -Agnostic; author-date citations; the Next.js-omitting DSR diagram). The adjacent Chapter 6 §6.7 finding (§3, item 14 above) is tracked but explicitly *not* counted here, since it is out of this stage's scope.
- `READY_TO_REWRITE_CHAPTER_3=YES`: every open item has a concrete, evidence-backed resolution path already available in existing repository documentation (`docs/research/*`, `research/*`, `THESIS_BLOCKER_RESOLUTION.md`, `CANONICAL_CONTROLLED_BENCHMARK_RESOLUTION.md`) — this is a distillation task, not a research task requiring new empirical work, so nothing blocks starting the rewrite once the proposed structure (§6 above) is agreed.
