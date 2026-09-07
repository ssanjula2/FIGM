# FINAL WHOLE-THESIS CONSISTENCY AUDIT

Stage T6-Final. Scope: the six canonical dissertation chapters as they now stand after Chapter 6's promotion — `chapter1_introduction.md`, `chapter2_literature_review.md`, `chapter3_methodology.md`, `chapter4_implementation.md`, `chapter5_empirical_validation_and_benchmarks.md`, `chapter6_results_and_conclusion.md` — plus `references.md` and the `.tex` files left untouched throughout this pipeline (`chapter3_architecture.tex`, `chapter4_implementation.tex`, `chapter5_evaluation.tex`). Audit only. No rewrites performed in this pass.

## 1. Executive status

The six canonical chapters are, on this pass, **materially consistent with each other and with the underlying evidence**. Every stale numeric claim, internal contradiction, and overclaim flagged at Stages T1–T6A has been resolved in the chapter it originated in, and this audit found no *new* instance of any of those same defect classes re-appearing in a different chapter. What remains outstanding is smaller in kind: two self-flagged figure/appendix placeholders inherited from earlier stages, one genuinely orphaned bibliography entry, Chapter 6's tables lacking formal numbering (unlike Chapters 2–5), and a documented, deliberately-accepted residual risk from the Stage T6A exporter fix (a stray, non-canonical file `docs/dissertation/chapter6_user_study_and_validity.md` would reappear if `npm run eval`/`research:evaluate` is ever run manually — it would not overwrite the real, promoted `chapter6_results_and_conclusion.md`, since the exporter never writes that filename). None of these are numeric fabrications, RQ overclaims, or scope violations; all are finishing-stage housekeeping items. Full verification (`tsc`, full `npm test`, `npm run build`) was re-run as part of Chapter 6's promotion this session; results are reported in the final-report block at the end of this conversation turn, not restated here as this document's own claim.

## 2. Chapter 1 findings

Read in full (`chapter1_introduction.md`, 11 sections, §1.1–§1.11). RQ1–RQ4 (§1.4) match Chapter 6's restated RQs verbatim except one cosmetic variance (§5 below). The Research Aim (§1.6) and the four Research Objectives (§1.7) map one-to-one onto RQ1–RQ4 explicitly and by name ("Objective 1, addressing RQ1," etc.) — no old 18→8 objective-count language is active. Framework scope (§1.10) states React/Next.js/Angular as primary and Vue.js as additional implementation support, consistent with every other chapter. One self-flagged, unresolved item: §1.8's `FIGURE_ACTIONS_REQUIRED` note states the original Rich Picture graphic (Figure 1.1, inherited from the Research Proposal) shows Vue undifferentiated from the three primary frameworks and should be redrawn before submission — a corrected textual description already exists in its place. This is an honest, already-tracked action item, not a newly-discovered defect.

## 3. Chapter 2 findings

Read in full (`chapter2_literature_review.md`, 6 sections, §2.1–§2.6). Framework treatment consistent with Chapter 1 (React/Next.js/Angular primary, Vue additional, §2.3/§2.4). Table 2.1 (§2.4) is the tool-comparison table (FIGM vs. Lighthouse/ESLint/SonarQube/axe) and correctly states FIGM's static findings as "statically detectable risk patterns; not FCP/TTI itself" and accessibility as "statically detectable WCAG 2.2-aligned subset" — consistent with the canonical WCAG/static-runtime wording used everywhere else. Figure 2.1 (§2.2, conceptual map of the literature) is prose-only and explicitly self-flagged as "a pending output of the thesis figure/table stage... not reproduced as a graphic here" — an honest, already-tracked placeholder, not a newly-discovered defect. No stale rule-count, benchmark, or provider claims found (Chapter 2 predates the implementation detail those claims concern, and correctly does not anticipate it).

## 4. Chapter 3 findings

Read in full (`chapter3_methodology.md`, 13 sections, §3.1–§3.13). This is the chapter most other chapters' cross-references point into, and it holds up: §3.3 (four-layer model, 50 rules, `ruleSetVersion 2.1.0`), §3.4 (RQ1 protocol, exact conditions and analysis method), §3.5 (RQ3 protocol), §3.6 (RQ4 protocol, 67 cases/1,717 rows, explicit separation from the internal benchmark), §3.7 (internal benchmark protocol), §3.8 (human-study protocol, 20-participant target with 80–100 correctly framed as historical baseline), §3.9 (a clean, single evidence/method/analysis/output mapping table, Table 3.1, covering all four RQs plus the internal benchmark), §3.10 (reproducibility — frozen protocol version, versioned rule catalogue, pinned corpus manifest, frozen RQ4 package), §3.12 (Security Scope, explicitly supplementary, no vulnerability-assessment claim). One item worth flagging precisely: §3.3's own text explicitly retires an old "18 guidelines → 8" numeric-filter description as historically inaccurate rather than presenting it as current — this is the correct, honest treatment of that history, not a defect. One placeholder: §3.3's rule-formalization example section ends with an explicit `Appendix [TBD: appendix reference to be finalised at the figures/tables/appendices stage]` marker — an honest, already-tracked placeholder. Figure 3.1 (DSR cycle) exists as a complete Mermaid flowchart, not prose-only.

## 5. Chapter 5 findings

(Chapter 4 is covered in §6 below to match the numbered evidence-gathering order used in this audit; both are reported.) Read in full (`chapter5_empirical_validation_and_benchmarks.md`, 10 sections, §5.1–§5.10). This chapter maintains the technical-verification/results boundary explicitly (§5.1: "This chapter is a technical verification chapter, not the dissertation's results chapter... Where this chapter refers to RQ1 or RQ4 at all, it is only to state what technical infrastructure exists"). The internal benchmark (§5.5, TP=65/FP=0/FN=0/100%/100%/100%/50-of-50) is qualified as an internal controlled fixture benchmark throughout, with the circularity disclosure preserved and the superseded 96.15%/98.04%/25-of-50 figure retained only as an explicitly-labelled obsolete provenance note (§5.5.2). The real-world corpus figures (§5.7: 21 repos, 2,512 files, 117 parse errors, 0 crashes, 2,649 findings) match Chapter 6's restatement of the same figures exactly. The legacy-vs-current remediation distinction (§5.6.B) is explicit and does not let the legacy `applyQuickFix` benchmark's numbers (18 manual-review of the rules it fires on) leak into a description of the current production architecture's own, smaller (3-rule) manual-review-only set. No Gemini-only wording anywhere in Chapter 5.

## 6. Chapter 4 findings

Read in full (`chapter4_implementation.md`, 15 sections, §4.1–§4.15). The AI-provider architecture (§4.8) is stated precisely and matches Chapter 6 exactly: Ollama (default), Claude, Gemini, with `AI_PRIMARY_PROVIDER` override and documented fallback order; a dedicated, explicit "On Qwen, specifically" passage (§4.8, quoted in full in the numeric-consistency table below) states Qwen was a removed standalone provider and is now only an Ollama-served model tag; a dedicated note similarly disposes of the orphaned, unused `openai` package dependency, explicitly stating it is not evidence of an active OpenAI integration. §4.14 (Security Scope) mirrors §3.12 and is equally explicit that security is supplementary, not a research contribution or vulnerability-assessment claim. §4.6 documents the real-AST/text-heuristic framework-gating distinction (which universal rules fall back to text-heuristic on which frameworks) in the same terms Chapter 5 §5.9 and Chapter 6 §6.9 use. Three Mermaid figures (4.1, 4.2, 4.3) exist in full; four tables (4.1–4.4) are present and sequentially numbered with no duplicates.

## 7. Chapter 6 findings

Chapter 6 (`chapter6_results_and_conclusion.md`) is the file promoted this session; its own audit and traceability were performed exhaustively at Stage T6/T6-final (`CHAPTER_06_RESULTS_CONCLUSION_AUDIT.md`, `CHAPTER_06_RESULTS_TRACEABILITY.md`) and are not repeated in full here. One net-new observation from reading it *alongside* the other five chapters rather than in isolation: **its tables carry no formal "Table 6.X" caption/numbering**, unlike every table in Chapters 2–5 (Table 2.1, 3.1, 4.1–4.4, 5.1). This is a genuine, if minor, numbering-consistency gap — flagged in §16 (Table inventory) and §21 (required corrections), not fixed in this pass.

## 8. Cross-chapter RQ consistency

| RQ | Chapter 1 (§1.4) | Chapter 3 | Chapter 6 (§6.2–§6.5) | Verdict |
|---|---|---|---|---|
| RQ1 | "How do different Single Page Application (SPA) render and state-management strategies influence performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?" | §3.4 heading/paraphrase: "RQ1 asks how different SPA rendering and state-management strategies influence FCP and TTI" (contextual paraphrase, appropriate for a methodology section, not presented as the formal RQ statement) | "How do different SPA render and state-management strategies influence performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?" | **Materially identical.** Chapter 1 spells out "Single Page Application (SPA)" on first use where Chapter 6 uses the already-established abbreviation "SPA" directly — a cosmetic difference in whether the abbreviation is expanded, not a paraphrase that changes meaning. Not flagged as a defect. |
| RQ2 | "What framework-agnostic architectural and accessibility patterns can be identified and standardized to improve the performance and accessibility of modern SPAs in compliance with WCAG 2.2 guidelines?" | Not restated verbatim (methodology chapter references §3.3's formalization work under this RQ by implication, not by a quoted RQ statement) | Word-for-word identical to Chapter 1 | **Identical** between Chapter 1 and Chapter 6. |
| RQ3 | "How effectively can an automated static analysis validation tool detect architectural and accessibility violations in SPA source code before application deployment?" | §3.5 heading/paraphrase: "RQ3 asks how effectively FIGM's static validation tool detects architectural and accessibility violations in SPA source code before deployment" (paraphrase omits "application," a stylistic elision, not a scope change) | Word-for-word identical to Chapter 1 | **Materially identical**; Chapter 3's paraphrase is a stylistic elision only. |
| RQ4 | "To what extent does the proposed validation tool achieve acceptable accuracy levels when compared with manual expert architectural reviews using Precision, Recall, and F1-score measurements?" | §3.6 heading/paraphrase: "RQ4 asks to what extent the validation tool achieves acceptable accuracy when compared against manual expert architectural review, using Precision, Recall, and F1-score" (singular "review," minor grammatical elision) | Word-for-word identical to Chapter 1 | **Materially identical**; no scope change. |

No paraphrase found anywhere materially changes the meaning, scope, metrics, or comparison target of any RQ. **WHOLE_THESIS_RQ_ALIGNMENT: PASS.**

## 9. Numeric consistency table

| Figure | Ch1 | Ch2 | Ch3 | Ch4 | Ch5 | Ch6 | Consistent? |
|---|---|---|---|---|---|---|---|
| Total rules | 50 (implied via scope, not restated numerically) | — | 50, `ruleSetVersion 2.1.0` | 50 (implied throughout §4.5–§4.6) | 50 (via 50/50 coverage) | 50, `ruleSetVersion 2.1.0` | Yes |
| Domain split (Architecture/Perf/A11y) | — | — | Implied via §3.3's concern taxonomy, not restated as 19/24/7 | — | — | 19/24/7 (§6.3) | Yes (only Ch6 states the exact split numerically; no other chapter contradicts it) |
| RQ1 corpus/protocol | 44 executions cited generally (§1.9) | — | 1 warm-up + 10 measured × 4 conditions | — | — | 44 executions, exact PRIMARY/REPLICATION tables | Yes |
| RQ3 corpus | 20–30 repository target (§1.10) | — | 21 repos, pinned-commit manifest (§3.5, §3.10) | — | 21 repos, 2,512 files, 117 parse errors, 0 crashes, 2,649 findings (§5.7) | Identical figures (§6.4.1) | Yes |
| Internal benchmark | — | — | Protocol only, no numeric result (§3.7) | — | TP=65/FP=0/FN=0/100/100/100/50-of-50 (§5.5) | Identical (§6.4.2) | Yes |
| RQ4 protocol | — | — | 67 cases, 1,717 rows (§3.6) | — | Identical, PENDING (§5.5.1) | Identical, PENDING (§6.5) | Yes |
| Human study target/actual | 20 (P001–P020); 80–100 historical (§1.10) | — | Identical (§3.8) | — | — (not this chapter's subject) | Identical; 0/20 actual (§6.6) | Yes |

**No contradictory active value found anywhere in the six canonical chapters.**

## 10. Framework/rule-model consistency

Every chapter that mentions framework scope states React/Next.js/Angular as primary and Vue.js as additional implementation support, with no exception found (full occurrence list gathered in this session's grep sweep, §5 above). No chapter describes Svelte or SolidJS as currently supported — both are mentioned only as "detected-but-unsupported" (Ch4, Ch5) or as future-work candidates (Ch6). No active claim of 8/10/12/18/25/23-of-25 rules was found anywhere; the one historical "18→8" mention (Ch3 §3.3) is explicitly retired, and the one "25 rules" mention (Ch5 §5.5.2) is explicitly the superseded legacy validator's fixture-array size, not the current catalogue. **FRAMEWORK_SCOPE_ALIGNMENT: PASS. RULE_MODEL_ALIGNMENT: PASS.**

## 11. RQ4/human-study integrity

RQ4 is stated as PENDING, with the identical 67-case/1,717-row protocol description and identical "0 real independent expert submission" status, in every chapter that mentions it (Ch3, Ch5, Ch6). No chapter states or implies a completed external Precision/Recall/F1/accuracy figure. The human study's actual collection state (0 of 20) is stated identically in every chapter that mentions it (Ch1, Ch3, Ch6), with the 80–100 baseline consistently and only framed as historical. No fabricated SUS score, demographic breakdown, task-performance metric, or qualitative theme was found anywhere. The internal benchmark is explicitly and repeatedly stated as not substituting for RQ4, in Ch3 (§3.6), Ch5 (§5.5.1), and Ch6 (§6.5, three enumerated non-substitute items). **RQ4_STATUS_ALIGNMENT: PASS. HUMAN_STUDY_ALIGNMENT: PASS. INTERNAL_BENCHMARK_ALIGNMENT: PASS.**

## 12. WCAG/static-runtime integrity

Every occurrence of "WCAG 2.2 AA," "full WCAG," "ISO verif[ied]," or "Core Web Vitals" across all six chapters was individually inspected (full list in this session's grep sweep). Every occurrence is either (a) an explicit non-claim/disclaimer ("does not claim WCAG 2.2 AA conformance," "no claim of full WCAG 2.2 conformance is made anywhere in this dissertation"), (b) a correctly-attributed description of *literature* (Ch2's discussion of a cited CSR/SSR study and of Lighthouse, both properly cited to [21]/[23], not presented as FIGM's own claim), or (c) an explicit statement that FIGM's static rules are *not* Core Web Vitals validation. No instance anywhere asserts FIGM achieves a WCAG conformance level, ISO verification, or that a static finding is a runtime measurement. **WCAG_SCOPE_ALIGNMENT: PASS. STATIC_RUNTIME_ALIGNMENT: PASS.**

## 13. AI/remediation consistency

The three-provider architecture (Ollama default, Claude, Gemini, documented override/fallback order) is stated consistently in Chapter 4 (§4.8, the authoritative source) and Chapter 6 (§6.8, a correct summary that does not re-derive or contradict Chapter 4's detail). No chapter describes remediation as Gemini-only, describes Qwen as a current standalone provider, or describes OpenAI as an active provider — Chapter 4 explicitly and precisely disposes of both the Qwen and the orphaned-`openai`-dependency questions. The deterministic-first → AI-only-where-needed → validation → unconditional re-scan → VERIFIED-only-if-violation-gone sequence is stated consistently in Chapter 4 (§4.7) and Chapter 5 (§5.6.A), and Chapter 6 correctly summarizes it as "AST-deterministic fixing attempted before AI assistance... an unconditional re-scan gate" without contradiction. The legacy `applyQuickFix` benchmark is explicitly and consistently distinguished from the current production pipeline everywhere it is mentioned (Ch5 §5.6.B is the fullest treatment; Ch6 does not restate the legacy benchmark's numbers at all, avoiding any risk of conflation). No unsupported aggregate remediation success-rate claim exists anywhere; Ch5 §5.3 and Ch6 §6.10 (Future Work, item 8) both explicitly state this aggregate figure has not yet been computed. **AI_PROVIDER_ALIGNMENT: PASS. REMEDIATION_ALIGNMENT: PASS.**

## 14. Cross-reference inventory

Every `Chapter X, §X.Y` cross-reference this session checked resolves to a section that actually exists in the current canonical chapters (verified via header listing, this session). Two categories of issue found, neither newly introduced by Chapter 6's promotion:

1. **Two self-flagged placeholders**, both pre-existing and already tracked, not newly discovered: Chapter 1's `FIGURE_ACTIONS_REQUIRED` note (§1.8) and Chapter 3's `Appendix [TBD: ...]` marker (§3.3). Neither is a broken reference to something that once existed and was removed — both are honest markers that a piece of final-production work (a redrawn figure; a finalized appendix number) has not yet been done.
2. **No broken Chapter 5/6 references remain.** The Stage T6 audit's two dangling references (old Chapter 5 §5.1.1, §5.2) were corrected during Chapter 6's rewrite (verified in `CHAPTER_06_RESULTS_TRACEABILITY.md`'s cross-reference correction table) and re-confirmed clean in this pass — Chapter 6 cites only §5.3, §5.5, §5.5.1, §5.5.2, §5.7, and §5.9, all of which exist.

No reference to a Figure or Table number that does not exist was found. **BROKEN_CROSS_REFERENCES: 2** (the two self-flagged placeholders above; counted here for completeness even though both are already known and tracked, not newly discovered defects).

## 15. Figure inventory

| Figure | Chapter | Current state | Classification |
|---|---|---|---|
| 1.1 (Rich Picture) | 1 | Corrected textual workflow description exists in place of a graphic; the original Proposal-era graphic is known to be outdated (undifferentiated Vue) and self-flagged for redraw | NEEDS_REDRAW |
| 2.1 (Conceptual map of the literature) | 2 | Prose description only; explicitly self-flagged as a pending figure/table-stage output | NEEDS_RENDER |
| 3.1 (DSR cycle) | 3 | Complete Mermaid flowchart source present | READY (Mermaid source complete; export to a static image only needed if the final submission format cannot embed Mermaid directly) |
| 4.1 (Overall system/request flow) | 4 | Complete Mermaid flowchart source present | READY (same caveat as 3.1) |
| 4.2 | 4 | Complete Mermaid flowchart source present | READY (same caveat as 3.1) |
| 4.3 | 4 | Complete Mermaid flowchart source present | READY (same caveat as 3.1) |
| — | 5 | No figures in this chapter | NOT_NEEDED |
| — | 6 | No figures in this chapter | NOT_NEEDED |

**FIGURES_NEEDING_WORK: 2** (1.1 NEEDS_REDRAW, 2.1 NEEDS_RENDER). The four Mermaid figures are source-complete and are not counted as needing work beyond an optional format-export step.

## 16. Table inventory

| Table | Chapter | Numbered/captioned? | Notes |
|---|---|---|---|
| 2.1 (tool comparison) | 2 | Yes | No stale values found |
| 3.1 (evidence/method/analysis/output mapping) | 3 | Yes | Single table covering all four RQs plus the internal benchmark; no duplication with any other chapter's table |
| 4.1–4.4 | 4 | Yes, sequential, no duplicates | — |
| 5.1 (representative test cases) | 5 | Yes | — |
| RQ1 PRIMARY/REPLICATION tables, real-world corpus composition/metrics tables, internal-benchmark table (4 tables total) | 6 | **No** — none of Chapter 6's tables carry a "Table 6.X" caption | Genuine numbering-consistency gap relative to Chapters 2–5's convention; content itself is not stale or duplicated |

No duplicated table content was found across chapters (Chapter 6's real-world-corpus and benchmark tables restate Chapter 5's numbers, but this is a *deliberate, disclosed synthesis for interpretation*, not an accidental duplication — Chapter 6 states this design choice explicitly in §6.1). **TABLES_NEEDING_WORK: 4** (Chapter 6's four uncaptioned tables; a single final-numbering pass, e.g. Table 6.1–6.4, is all that is required).

## 17. Reference/IEEE audit

Every numeric citation found in the six canonical chapters ([1]–[10], [12]–[26]) has a corresponding bibliography entry. Every bibliography entry from [1]–[26] **except [11]** (Wohlin et al., *Experimentation in Software Engineering*) is cited at least once. **[11] is not cited anywhere in the six canonical chapters** — a genuine orphaned reference, most plausibly intended for Chapter 3 §3.4 (the RQ1 controlled-experiment design), given its exact topical fit, but never actually inserted there. No fabricated metadata was found in any of the 26 bibliography entries (all previously verified against DOI/dblp/official-documentation sources at Stages T1–T2, not re-verified line-by-line again in this pass). No duplicate reference under two different numbers was found. No chapter-level citation-numbering inconsistency was found (all six chapters draw from the same single, shared `references.md` numbering — there is no per-chapter renumbering to check). **REFERENCE_ISSUES: 1** (orphaned reference [11]).

**Proposed final first-appearance order** (not applied in this pass, per instruction to defer whole-thesis renumbering): the current numbering already approximates first-appearance order chapter-by-chapter (Ch1: [12], [13], [17]–[20]; Ch2: [1]?, [5], [6], [12], [13], [17]–[23]; Ch3: [3], [10], [1], [2], [23]; ...). A genuine first-appearance renumbering pass would need to walk Chapter 1 through Chapter 6 in reading order and assign numbers in the order each reference is first encountered — this has not been done in this pass and is correctly deferred to the final consistency stage per the task's own instruction and per `THESIS_EVIDENCE_AUDIT.md` §38.

## 18. Appendix plan

| Candidate appendix | Status |
|---|---|
| Full 50-rule catalogue (referenced by Chapter 3 §3.3's `[TBD: appendix reference...]` placeholder) | REQUIRED — a specific chapter already promises this appendix by name; leaving it unwritten would make Chapter 3 reference a non-existent appendix |
| RQ1 raw/summary evidence (PRIMARY + REPLICATION full data tables) | RECOMMENDED — Chapter 6 currently cites the raw-data file paths directly (`research/rq1-experiment/raw-results/`, `.../processed-results/`) rather than an appendix; an appendix would improve self-containment but is not currently promised by any chapter text |
| Real-world corpus evidence (repository manifest, per-repository findings) | RECOMMENDED — same reasoning as above; currently cited by file path, not promised as an appendix |
| RQ4 annotation protocol (case list structure, judgment-row schema) | RECOMMENDED — Chapter 3 §3.6 describes the protocol in prose; an appendix excerpt of the actual case/row structure would strengthen reproducibility without requiring the full, still-blinded case content |
| Supplementary human-study materials (questionnaire instrument) | OPTIONAL — Chapter 3 §3.8/§3.9 already describes the instrument's structure in enough detail for methodological understanding; a full appendix reproduction is a nice-to-have, not required by any existing cross-reference |
| Reproducibility commands/artifacts (exact `npm run` commands, frozen-baseline tags) | OPTIONAL — already scattered correctly through Chapter 3 §3.10 and Chapter 5; a consolidated appendix would aid a reader but nothing currently promises one |

**APPENDICES_REQUIRED: 1** (the 50-rule catalogue, since Chapter 3 already references it by an unfulfilled placeholder).

## 19. Overclaim/stale-language inventory

| Phrase searched | Occurrences found | Classification |
|---|---|---|
| "Production SaaS" | 0 | — |
| "ISO Verified" / "ISO verification" | 0 as an active claim; appears only inside explicit non-claim disclaimers | VALID |
| "WCAG 2.2 AA" | 0 as an active claim; appears only inside explicit non-claim disclaimers | VALID |
| "full WCAG compliance" | 0 as an active claim; appears only inside explicit non-claim disclaimers | VALID |
| "proven" | 0 | — |
| "guarantee(s)" | 3, all precise technical usages (a specific, named token-isolation guarantee; a rhetorical "no guarantee that a rule... carries the same meaning" in the motivation section) | VALID |
| "statistically significant" | 1, inside an explicit disclaimer that no such test is computed or claimed | VALID |
| "statistically associated" | 0 (removed from Chapter 6 in the pre-promotion cleanup pass) | VALID (historically NEEDS_SOFTENING, now resolved) |
| "universal" | 1 ("universal correctness... is not claimed," Ch6 §6.8) | VALID (explicit non-claim) |
| "complete accuracy" | 0 | — |
| "production-ready" | 1 (Ch4 §4.8, narrowly scoped to "on the project's actual deployment target (Vercel)," contrasting Claude/Gemini's network-reachability with Ollama's) | VALID (precise, scoped technical claim, not a broad marketing claim about the whole system) |
| "fully validated" | 0 | — |
| "expert validated" | 0 | — |

**OVERCLAIM_OR_STALE_PHRASES: 0** active overclaims found. Every matched occurrence is either a correctly-scoped technical statement or an explicit non-claim/disclaimer.

## 20. Duplication inventory

- **Chapter 3 vs. Chapter 4**: Chapter 3 specifies the four-layer model formally (§3.3); Chapter 4 describes its concrete implementation (parsers, engines, file paths). Overlap is limited to necessary restatement of the model's name and rule count when introducing implementation detail — no table, figure, or numeric result is duplicated between them.
- **Chapter 4 vs. Chapter 5**: Chapter 4 describes the remediation architecture and AI-provider set as implemented; Chapter 5 reports what testing that architecture produced (including the legacy-vs-current distinction). No architecture description is repeated verbatim; Chapter 5 references Chapter 4 by section number rather than re-describing the architecture.
- **Chapter 5 vs. Chapter 6**: this is the pairing the Stage T5/T6 pipeline specifically engineered a boundary for, and it holds: Chapter 5 states infrastructure/status only ("this chapter is a technical verification chapter, not the dissertation's results chapter"), and Chapter 6 explicitly defers to Chapter 5 for testing detail (§6.1) rather than re-deriving it. Chapter 6's real-world-corpus and internal-benchmark tables restate Chapter 5's exact numbers once, for interpretive synthesis — a deliberate, disclosed design choice (§6.1), not accidental duplication.

**No repeated technical detail requiring reduction was found.** The one true redundancy in this pipeline's history — the old Chapter 5's "Comparative Analysis Against Existing Tools" section duplicating Chapter 2's Table 2.1 — was already resolved by the Stage T5 rewrite (the section was not carried forward into the new Chapter 5), and this pass confirms it has not resurfaced.

## 21. Required final corrections

1. Cite reference [11] (Wohlin et al.) in Chapter 3 §3.4, or otherwise resolve the orphaned bibliography entry, before final reference renumbering.
2. Add formal "Table 6.X" captions/numbering to Chapter 6's four tables, consistent with Chapters 2–5's convention.
3. Redraw Figure 1.1 to visually separate the primary-framework box from the additional-framework-support box (self-flagged in Chapter 1 §1.8).
4. Render Figure 2.1 (conceptual map of the literature) as an actual graphic (self-flagged in Chapter 2 §2.2).
5. Finalize the appendix reference Chapter 3 §3.3 currently marks as `[TBD]`, and produce the full 50-rule-catalogue appendix it promises (§18 above).
6. Decide how to handle the residual exporter risk: a manual `npm run eval`/`research:evaluate` run will still recreate a stray, non-canonical `docs/dissertation/chapter6_user_study_and_validity.md` file (it will not touch the real, promoted `chapter6_results_and_conclusion.md`) — documented in `CHAPTER_06_RESULTS_CONCLUSION_AUDIT.md` §17.9 and the exporter guard test's own comments; needs a final decision (delete-on-sight convention, or a further code change) before submission, not before this audit.

## 22. Optional polish

- Convert the four Mermaid diagrams (3.1, 4.1–4.3) to static images if the final submission format cannot embed Mermaid source directly.
- Consider adding the three RECOMMENDED/OPTIONAL appendices from §18 to improve self-containment, though none is currently promised by a broken cross-reference.
- Consider a brief note in Chapter 6 §6.2 acknowledging the existence of the REPLICATION dataset even where not the primary citation, for readers who consult Chapter 3's evidence table (§3.9) first — currently Chapter 6 already does this fully (§6.2.2), so this is confirmation, not a gap.
- Perform the whole-thesis first-appearance IEEE renumbering pass (deferred by explicit instruction, tracked in `THESIS_EVIDENCE_AUDIT.md` §38).

## 23. Submission blockers

**None of the items in §21 block a technically sound, internally consistent submission as-is** — they are finishing-stage production tasks (a figure redraw, an appendix write-up, a citation placement, table numbering) rather than evidentiary or integrity defects. The one item closest to a genuine blocker is §21 item 5 (the Chapter 3 appendix placeholder): a reader following that specific cross-reference today would find nothing, which is a real, if minor, submission-readiness gap rather than a stale-content risk. Everything else in this audit — every RQ, every numeric claim, every framework/provider/remediation/WCAG/RQ4/human-study statement across all six canonical chapters — was checked fresh this session and found to be genuinely consistent with the underlying evidence and with every other chapter.

**SUBMISSION_BLOCKERS: 1** (the unfulfilled Chapter 3 appendix cross-reference; everything else in §21 is a recommended finishing task, not a blocker).

## Self-audit

```
CHAPTER_6_PROMOTION=PASS
WHOLE_THESIS_RQ_ALIGNMENT=PASS
AIM_OBJECTIVE_ALIGNMENT=PASS
FRAMEWORK_SCOPE_ALIGNMENT=PASS
RULE_MODEL_ALIGNMENT=PASS
RQ1_NUMERIC_ALIGNMENT=PASS
REAL_WORLD_CORPUS_ALIGNMENT=PASS
INTERNAL_BENCHMARK_ALIGNMENT=PASS
RQ4_STATUS_ALIGNMENT=PASS
HUMAN_STUDY_ALIGNMENT=PASS
WCAG_SCOPE_ALIGNMENT=PASS
STATIC_RUNTIME_ALIGNMENT=PASS
AI_PROVIDER_ALIGNMENT=PASS
REMEDIATION_ALIGNMENT=PASS
BROKEN_CROSS_REFERENCES=2
FIGURES_NEEDING_WORK=2
TABLES_NEEDING_WORK=4
REFERENCE_ISSUES=1
APPENDICES_REQUIRED=1
OVERCLAIM_OR_STALE_PHRASES=0
SUBMISSION_BLOCKERS=1
READY_FOR_FINAL_CORRECTION_PASS=YES
```

Basis: this session freshly re-read all six canonical chapters end-to-end (not from memory of earlier stages) and ran a systematic grep sweep for every stale-term class named in the task (rule counts, benchmark figures, WCAG/Core-Web-Vitals overclaims, provider staleness, participant-count staleness, general overclaim vocabulary) across all six files simultaneously, so a term appearing correctly in one chapter but incorrectly in another would have surfaced in the same grep pass — none did. The 8 non-PASS-adjacent counts above (cross-references, figures, tables, references, appendices, blockers) are all housekeeping/production items with a known, specific fix each, not evidentiary defects; none required treating any PASS field above as anything other than a genuine pass.
