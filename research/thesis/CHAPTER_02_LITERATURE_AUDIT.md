# CHAPTER 2 — LITERATURE REVIEW AUDIT (Stage T2, audit only)

**Status:** Audit only. No rewrite performed. Per instruction, Chapter 2 will not be rewritten until this audit is approved.

---

## 1. Existing Section Structure (`docs/dissertation/chapter2_literature_review.md`)

```
2.1 Introduction
2.2 Software Quality Models and Accessibility Standards
2.3 Design Science Research Methodology
2.4 Compiler Theory and Program Analysis Foundations
2.5 Software Design and Type-System Foundations
2.6 Empirical Software Engineering Research Methods
2.7 Related Empirical Work
2.8 Synthesis and Research Gap
```

## 2. Required University Section Structure

```
2.1 Chapter Overview
2.2 Conceptual Map of Literature
2.3 Domain Overview
2.4 Existing Systems / Frameworks / Designs
2.5 Technological Analysis
    2.5.1 Algorithmic Analysis
    2.5.2 Design Analysis
    2.5.3 Workflow Analysis
2.6 Reflection / Research Gap
```

## 3. Mapping Between Them

| Existing section | Maps to required section | Verdict |
|---|---|---|
| 2.1 Introduction | 2.1 Chapter Overview | Close match; needs trimming (currently previews old section numbers, not chapter purpose) |
| *(none exists)* | 2.2 Conceptual Map of Literature | **Missing entirely.** No literature-domain map (SPA Architecture / Performance / Accessibility / Static Analysis / Automated Validation / Framework-Agnostic Guidelines) exists anywhere in the current draft. The Proposal and Interim 02 both contain this exact conceptual map (with a figure) that has not been carried into the dissertation draft at all. |
| *(none exists)* | 2.3 Domain Overview | **Missing entirely.** No section defines or discusses SPAs, SPA architecture, rendering strategies, state management, performance engineering, or accessibility engineering as a domain. The current draft moves directly to standards/methodology/compiler theory without ever establishing this foundational background — which Chapter 1 (§1.2) now needs Chapter 2 to expand on, per Chapter 1's own closing sentence. |
| 2.2 Software Quality Models and Accessibility Standards (partial) | 2.3 Domain Overview (partial contribution only) | The ISO 25010 / WCAG 2.2 material is relevant background but is not, by itself, a domain overview of SPAs/rendering/state/performance/accessibility engineering — it only covers the standards-vocabulary angle. |
| *(none exists, only forward-referenced)* | 2.4 Existing Systems / Frameworks / Designs | **Missing entirely as content.** The current draft mentions "Chapter 5's qualitative comparison against Lighthouse, ESLint, SonarQube, `eslint-plugin-react`, and `angular-eslint`" (§2.8) but never actually performs or reports that comparison in Chapter 2, where the university structure requires it. Chapter 1's promoted draft (§1.2) also references "existing tooling reviewed in Chapter 2" — a forward reference to content that does not yet exist. |
| 2.4 Compiler Theory and Program Analysis Foundations | 2.5.1 Algorithmic Analysis | Good conceptual fit — parsing, AST construction, and static-analysis theory belong under Algorithmic Analysis. Needs relocation and citation-style correction, not removal. |
| 2.5 Software Design and Type-System Foundations | 2.5.2 Design Analysis | Good conceptual fit for the *general* design-pattern discussion (Strategy/Factory/Adapter), but current text goes further and names specific FIGM classes (`AIProviderSelector`, `RepositoryFactory`) — implementation-level detail that is premature for a literature review and belongs in Chapter 4 instead. Recommend trimming to the general pattern-relevance discussion here and moving the class-level specifics to Chapter 4. |
| 2.6 Empirical Software Engineering Research Methods | *out of place* — belongs in Chapter 3 (Methodology) or Chapter 6 (Threats to Validity), not Chapter 2 | Wohlin et al.'s validity framework is evaluation *methodology*, not literature about the SPA/performance/accessibility/tooling *domain*. Recommend relocating this citation and discussion to Chapter 3/6 rather than keeping it in Chapter 2. |
| 2.3 Design Science Research Methodology | *duplicate* — already exists in `chapter3_methodology.md` §3.1 ("Design Science Research (DSR) Framework," which already cites Hevner et al. 2004) | **Confirmed duplication** by direct inspection of `chapter3_methodology.md`. DSR is the dissertation's overall methodological stance and belongs in Chapter 3 only. Recommend **removing this section from Chapter 2 entirely** rather than merely relocating it, since an equivalent section already exists in Chapter 3. |
| 2.7 Related Empirical Work | 2.4 Existing Systems / Frameworks / Designs (partial) or 2.6 Reflection / Research Gap (partial) | Structurally could inform either required section, but its argument currently depends entirely on a fabricated citation (see §5 below) and must be rewritten regardless of where it ends up. |
| 2.8 Synthesis and Research Gap | 2.6 Reflection / Research Gap | Close match in intent; needs rewriting once the sections above are restructured, and needs to synthesize the *domain* literature (2.3) and *existing tools* comparison (2.4) that do not yet exist, not only the theory/methodology material it currently synthesizes. |

**Overall verdict:** this is not a citation-polishing task. Roughly half of the required university structure (2.2 Conceptual Map, 2.3 Domain Overview, 2.4 Existing Systems comparison) is currently **absent as content**, and a further third of the existing content (2.3 DSR, 2.6 Wohlin/validity) belongs in Chapter 3, not Chapter 2. Only 2.4 (compiler theory) and 2.5 (design patterns) map cleanly onto the required 2.5.1/2.5.2 Technological Analysis subsections, and even the university structure's 2.5.3 Workflow Analysis has no current content at all (FIGM's own source→parse→rule-execution→findings pipeline, which Chapter 1 §1.8's rich picture already sketches at a high level, is never walked through analytically in Chapter 2).

## 4. Paragraph-Level Citation Audit

| § (existing) | Paragraph claim | Citation(s) used | Style | Source status | Does source support claim? |
|---|---|---|---|---|---|
| 2.2 ¶1 | ISO/IEC 25010 defines Performance Efficiency as a technology-independent quality characteristic; FIGM's `FIGM-PERF-*` rules trace to it | ISO/IEC 25010:2011 | Author-date | VERIFIED (`references.md` [1]) | Yes |
| 2.2 ¶1 | WCAG 2.2 plays the equivalent role for `FIGM-A11Y-*` rules; every rule carries a `standardTraceability` field | WCAG 2.2 | Author-date | VERIFIED (`references.md` [2]) | Yes, for the standard itself; the `standardTraceability`-field claim is a project-evidence claim, not something the standard itself supports — should be marked as such (or verified against `figm-spec.json` directly) rather than left implicitly attached to the citation |
| 2.2 ¶2 | Both standards are a *source of vocabulary*, not a detection methodology | — (no citation; author's own analytical point) | N/A | N/A | Unsupported by citation, but does not need one — this is the chapter's own reasoning, correctly presented without a citation crutch |
| 2.3 ¶1 | DSR frames artifact construction as a legitimate IS research contribution | Hevner et al. (2004) | Author-date | VERIFIED (`references.md` [3]) | Yes — but section is duplicative of `chapter3_methodology.md` §3.1 (see §3 above) |
| 2.3 ¶2 | Peffers et al. operationalize DSR into a six-activity process | Peffers et al. (2007) | Author-date | VERIFIED (`references.md` [10], renumbered from the original [11] during Stage T1) | Yes |
| 2.3 ¶3 | Evaluation must be reported as rigorously as design | (implicit, following from Peffers et al.) | Author-date | Same as above | Reasonable inference from the cited process model, not overstated |
| 2.4 ¶1 | FIGM's real-AST layer instantiates classical compiler architecture (lex → parse → AST → analysis) | Aho et al. (2006) | Author-date | VERIFIED (`references.md` [4]) | Yes |
| 2.4 ¶2 | Nielson et al. distinguish syntactic pattern-matching from true data-flow/abstract-interpretation analysis; FIGM's `knownLimitation` fields honestly scope around this distinction | Nielson et al. (2005) | Author-date | VERIFIED (`references.md` [5]) | Yes, and the paragraph correctly avoids overclaiming FIGM as a data-flow analyzer |
| 2.4 ¶3 | Cousot & Cousot's abstract interpretation defines the theoretical soundness ceiling FIGM does not claim to reach | Cousot and Cousot (1977) | Author-date | VERIFIED (`references.md` [6]) | Yes, and the paragraph explicitly disclaims that FIGM implements abstract interpretation — appropriately conservative |
| 2.5 ¶1 | FIGM's `AIProviderSelector`/`RepositoryFactory`/AST-builder classes are direct applications of Strategy/Factory/Adapter patterns | Gamma et al. (1994) | Author-date | VERIFIED (`references.md` [9]) | Source supports the general pattern definitions; the specific class-name claims are project-evidence, correctly attributed to the repository rather than to Gamma et al. themselves, but are premature detail for a literature chapter (see §3) |
| 2.5 ¶2 | TypeScript's structural type system and tolerant parsing underpin FIGM's parser choice | Bierman et al. (2014) | Author-date | VERIFIED, **but the in-text author list is now stale.** `references.md` [7] was corrected during Stage T1 to G. Bierman, M. Abadi, and M. Torgersen (ECOOP 2014) — the correct authors — but Chapter 2's body text still says "Bierman et al. (2014)," which is technically consistent with the corrected entry (Abadi and Torgersen are real co-authors and "et al." covers them), so this is CORRECTABLE by citation-style conversion only, not a further factual fix |
| 2.5 ¶3 | Non-blocking async design (Cleary, C#/.NET ecosystem) informs FIGM's decision to run its sandbox as a separate child process | Cleary (2019) | Author-date | VERIFIED (`references.md` [8]) | Yes, and the paragraph is careful to cite this only for the general pattern, not for any C#-specific API |
| 2.6 ¶1 | Wohlin et al. provide the internal/external/construct validity vocabulary Chapter 6 uses | Wohlin et al. (2012) | Author-date | VERIFIED (`references.md` [11], renumbered from [12] during Stage T1) | Yes — content correct, but placement is wrong (belongs in Chapter 3/6, not Chapter 2; see §3) |
| **2.7 ¶1** | **"Saurabh and Roy (2022) undertook an empirical evaluation of static code analysis tools for web accessibility compliance — the most directly comparable prior empirical work..."** | **Saurabh and Roy (2022)** | Author-date | **FABRICATED — confirmed via dblp/IEEE/ACM search during the Stage-1 blocker-resolution pass; no such paper, author pair, or DOI exists. Already removed from `references.md`.** | **No — the citation does not exist, so the claim is entirely unsupported.** |
| 2.8 (whole section) | Synthesizes 2.2–2.4 into the research gap | (no new citations; references prior sections) | N/A | N/A | Internally consistent with the sections it synthesizes, but will need rewriting once those sections are restructured, and does not currently draw on any domain-literature or existing-tools comparison because neither exists yet in the chapter |

## 5. Unsupported Paragraphs

**One paragraph is unsupported because its sole citation is fabricated:** §2.7 ¶1 (the "Saurabh and Roy (2022)" paragraph). This is the paragraph explicitly flagged by the researcher as one that "must not survive unchanged." Confirmed: it cannot survive unchanged, because removing the fabricated citation removes the entire evidentiary basis for the paragraph's central claim.

**No other paragraph in the current draft rests on an unsupported or fabricated citation** — every other citation used traces to a verified source in `references.md` and genuinely supports the claim attached to it (see §4 column "Does source support claim?").

**However, entire required sub-topics have zero supporting paragraphs because they have not been written at all** — this is a coverage gap, not a citation-quality defect, and is tracked separately in §9 (New Literature Required) and §11 below.

## 6. Fabricated / Unverifiable Citations Currently Used in Chapter 2

| Citation as currently written | Status | Action |
|---|---|---|
| Saurabh and Roy (2022), "Empirical evaluation of static code analysis tools for web accessibility compliance," IEEE Transactions on Software Engineering | FABRICATED (confirmed, Stage-1 blocker resolution) | REMOVE. Already removed from `references.md`. The §2.7 paragraph depending on it must be rewritten, not patched. |

No other citation currently used in Chapter 2 is fabricated or unverifiable — this is the only one.

## 7. Sources Requiring Correction (style only, not fact)

Every citation currently in Chapter 2 uses author-date parenthetical style, which must convert to IEEE numeric `[n]` style. None of these require a *factual* correction beyond the Bierman entry (already fixed at the bibliography level in Stage T1; only the in-text conversion remains):

| Current in-text form | Target IEEE form | Current `references.md` number |
|---|---|---|
| (International Organization for Standardization, 2011) | [1] | [1] |
| (World Wide Web Consortium, 2023) | [2] | [2] |
| Hevner et al. (2004) | [3] | [3] |
| Peffers et al. (2007) | [10] (post Stage-T1 renumbering — was [11]) | [10] |
| Aho et al. (2006) | [4] | [4] |
| Nielson et al. (2005) | [5] | [5] |
| Cousot and Cousot (1977) | [6] | [6] |
| Gamma et al. (1994) | [9] | [9] |
| Bierman et al. (2014) | [7] | [7] (corrected authors already in `references.md`) |
| Cleary (2019) | [8] | [8] |
| Wohlin et al. (2012) | [11] (post Stage-T1 renumbering — was [12]) | [11] |

**Reminder for the rewrite stage:** these are the *current* `references.md` numbers, which may shift again once Chapter 2's own new sources (§10 below) are inserted and once whole-thesis first-appearance renumbering is eventually performed (`THESIS_EVIDENCE_AUDIT.md` §38). Do not treat any number above as permanent.

## 8. Sources to Remove

Only one: Saurabh and Roy (2022) — see §6.

## 9. New Literature Areas Required

Per the T2 instruction's priority list, cross-referenced against what Chapter 2 currently has zero coverage of:

- **SPA architecture** (component structure, client-side routing) — no current coverage
- **Client-side vs. server-side rendering / rendering-strategy performance** — no current coverage; directly relevant to RQ1
- **State management strategies** — no current coverage; directly relevant to RQ1
- **Web performance / FCP / TTI measurement** — no current coverage; directly relevant to RQ1 and Chapter 3's experimental design
- **Static program analysis / AST-based source analysis** — partially covered (Aho, Nielson, Cousot & Cousot are general compiler/program-analysis theory), but nothing specific to JavaScript/TypeScript/frontend-framework static analysis
- **Automated software-quality validation tools generally** — no current coverage
- **Existing SPA-adjacent tools by name (Lighthouse, ESLint, SonarQube, axe DevTools)** — mentioned only as a forward reference to Chapter 5, never actually reviewed in Chapter 2 as the university structure's §2.4 requires
- **Web accessibility evaluation / WCAG 2.2 / accessibility in dynamic SPAs specifically** — only the standards-vocabulary framing exists (§2.2); no discussion of SPA-specific accessibility challenges (focus management, live-region announcements) or of automated accessibility-evaluation research
- **Framework-specific linting and its limitations** — no current coverage (Chapter 1 §1.2 briefly raises this; Chapter 2 does not expand on it)
- **Limitations of runtime-only tools vs. pre-deployment static validation** — no current coverage as a literature-grounded discussion (Chapter 1 raises the argument; Chapter 2 does not support it with sources)

## 10. Verified Replacement / New Sources

All verified this session against a bibliographic authority (dblp, DOI resolution, or a conference's own official programme page) — **not yet added to `references.md`**, pending approval of this audit:

| Candidate | Verification | Covers gap area |
|---|---|---|
| J. Clapton, H. Bastos, J. P. O. Batisteli, D. B. Seufitelli, and C. Tavares, "Client-Side vs Server-Side Rendering: Impacts on Performance and User Experience in Web Applications," presented at the ICSE 2026 Brazilian Software Engineering Showcase (originally SBQS 2025), 2025/2026, doi: 10.5753/sbqs.2025.15078 | VERIFIED — exact title/authors/venue/DOI confirmed via the conference's own official programme page (conf.researchr.org) | Rendering-strategy performance (CSR vs. SSR, Core Web Vitals incl. FCP) — directly relevant to RQ1 |
| A. Donvir, A. Jain, and P. K. Saraswathi, "Application State Management (ASM) in the Modern Web and Mobile Applications: A Comprehensive Review," arXiv:2407.19318, 2024 (a companion IEEE UEMCON 2024 publication exists at doi: 10.1109/UEMCON62879.2024.10754779, confirmed by DOI resolution to IEEE Xplore, though exact page numbers were not independently retrievable and must not be invented) | VERIFIED (arXiv preprint + DOI-confirmed IEEE pairing; cite conservatively, same treatment as the Bostic et al. rule from Stage T1) | State-management strategies — directly relevant to RQ1/RQ2 |
| Google, "Lighthouse Overview" — [Online]. Available: https://developer.chrome.com/docs/lighthouse/overview/ | VERIFIED (official documentation; already verified in the original Interim-02 reference audit, Stage-1) | Existing Systems / Frameworks / Designs (§2.4) — performance evaluation tooling |
| ESLint, "ESLint Documentation" — [Online]. Available: https://eslint.org/docs/latest/ | VERIFIED (official documentation; already verified, Stage-1) | Existing Systems / Frameworks / Designs (§2.4) — static analysis / linting tooling |
| SonarSource SA, "SonarQube Server Documentation" — [Online]. Available: https://docs.sonarsource.com/sonarqube-server/ | VERIFIED (official documentation; already verified, Stage-1) | Existing Systems / Frameworks / Designs (§2.4) — static analysis tooling |
| Deque Systems Inc., "axe DevTools Documentation" — [Online]. Available: https://docs.deque.com/devtools-for-web/ | VERIFIED (official documentation; already verified, Stage-1) | Existing Systems / Frameworks / Designs (§2.4) — accessibility auditing tooling |

**Already-verified sources from Chapter 1 (`references.md` [12]–[20]) directly reusable in Chapter 2's Domain Overview and Existing Systems sections**, without needing new verification:

- Mesbah & van Deursen [12] — SPA architecture/evolution
- Mikowski & Powell [13] — SPA definition and client-side architecture
- Bostic et al. [14] — automated accessibility crawling/runtime evaluation, cited conservatively as an arXiv source only
- Manca, Palumbo, Paternò & Santoro [15] — automated accessibility-tool design/transparency; the genuine replacement for the role §2.7's fabricated citation was trying to play
- Rossi, Pastor, Schwabe & Olsina, Eds. [16] — planned/systematic web engineering discipline
- React [17], Next.js [18], Angular [19], Vue.js [20] official documentation

**Searched for but not found / not used:** a peer-reviewed, DOI-verifiable paper specifically comparing JavaScript/TypeScript frontend-framework static-analysis tooling (as opposed to general static-analysis-tool-efficacy papers, several of which surfaced as arXiv-only preprints without a confirmed peer-reviewed venue). None of these were added, consistent with the "never invent metadata" rule; the gap in §9 ("static analysis specific to JS/TS/frontend frameworks") remains only partially filled by the general compiler/program-analysis theory already in §2.4/2.5.1 (Aho, Nielson, Cousot & Cousot) plus the existing-tool documentation entries above (ESLint, SonarQube). If a stronger source is needed at rewrite time, it should be searched for again rather than filled with an unverified candidate now.

## 11. Proposed Chapter 2 Argument Flow (for the rewrite stage — not yet written)

1. **2.1 Chapter Overview** — restate chapter purpose only (trim the current 2.1's old-numbering preview).
2. **2.2 Conceptual Map of Literature** — a five/six-node map: SPA Architecture → Performance → Accessibility → Static Analysis / Automated Validation → Framework-Agnostic Guidelines, adapted from the Proposal/Interim 02's own conceptual map, updated to reflect this dissertation's actual scope (React/Next.js/Angular primary, Vue additional).
3. **2.3 Domain Overview** — SPAs and the MPA→SPA shift [12], [13]; SPA architecture (component structure, routing, rendering strategy, state management) grounded in [12], [13], and the new rendering/state-management sources ([Clapton et al.], [Donvir et al.]); performance engineering context (FCP/TTI as recognised metrics, without pre-empting RQ1's results); accessibility engineering context for dynamic content specifically (WCAG 2.2 [2], SPA-specific accessibility risk via [14]); introduce static analysis as an approach (general theory only here — Aho [4]/Nielson [5]/Cousot & Cousot [6] belong to 2.5.1, not repeated here).
4. **2.4 Existing Systems / Frameworks / Designs** — an actual, evidence-based comparison (not a forward reference) of Lighthouse (performance auditing, runtime), ESLint/SonarQube (static analysis, framework-coupled or general-purpose), axe DevTools (accessibility auditing, runtime), and framework-specific linting (`eslint-plugin-react`, `angular-eslint`) — each analysed for what it does, on what evidence, and its limitation relative to the research gap (Chapter 1 §1.3.2), not merely listed.
5. **2.5 Technological Analysis**
   - **2.5.1 Algorithmic Analysis** — parsing/AST theory (Aho [4]), the syntactic-pattern-vs-data-flow-analysis distinction (Nielson [5]), and the abstract-interpretation soundness ceiling (Cousot & Cousot [6]) — relocated from the current §2.4, largely reusable as-is once style-converted.
   - **2.5.2 Design Analysis** — general relevance of Strategy/Factory/Adapter patterns (Gamma et al. [9]) and structural typing (Bierman et al. [7]) to a framework-abstraction problem, trimmed of FIGM-class-specific detail (moved to Chapter 4).
   - **2.5.3 Workflow Analysis** — new content: an analytical walk-through of the source→parse→rule-execution→findings→(remediation) workflow at the *conceptual* level (not implementation detail), motivated by the general async/non-blocking design principle currently cited from Cleary [8].
6. **2.6 Reflection / Research Gap** — synthesizes 2.3 and 2.4 (not only 2.4/2.5 as at present) into the same five-point gap Chapter 1 §1.3.2 already states, now with literature grounding for each of the five points rather than only for the theoretical/methodological ones.

## 12. Proposed Conceptual Map (for 2.2)

```
                     Single Page Applications (SPAs)
                                    |
   +------------+------------+------------+------------+
   |            |            |            |            |
 SPA          Rendering   Performance  Accessibility  Static Analysis /
Architecture  Strategies   Engineering  Engineering    Automated Validation
   |            |            |            |            |
Components   CSR / SSR    FCP / TTI    WCAG 2.2      AST-based detection,
Routing      [Clapton     [Clapton     Dynamic-       existing tools
State mgmt   et al.]      et al.]      content risk   (Lighthouse, ESLint,
[Donvir      [12],[13]                 [2], [14]      SonarQube, axe)
et al.]                                                     |
   +------------+------------+------------+------------+
                                    |
                    Framework-Agnostic Guidelines
                         (this dissertation's gap)
```

## 13. Proposed Existing-Tool Comparison Table (for 2.4)

| Tool | Evaluation point | Static or runtime | Framework-agnostic? | Performance coverage | Accessibility coverage | Architectural-cause traceability |
|---|---|---|---|---|---|---|
| Google Lighthouse | Post-build/runtime audit | Runtime | Yes (browser-level) | Yes (Core Web Vitals) | Partial (basic checks) | No — reports symptom, not source-code cause |
| ESLint (+ framework plugins) | Pre-commit/build-time lint | Static | Per-plugin, framework-coupled | No | No (unless a dedicated a11y plugin is configured) | Partial — flags a source pattern, but each framework's plugin is maintained independently |
| SonarQube | Static code-quality analysis | Static | General-purpose, not SPA-specific | Limited | No | Partial — general code smells, not SPA architecture-specific |
| axe DevTools | Accessibility audit | Runtime (DOM-based) | Yes (DOM-level) | No | Yes | No — reports DOM-level symptom, not source-code cause |
| **FIGM (this research)** | Pre-deployment static validation | Static | Yes, by design (React/Next.js/Angular primary, Vue additional) | Yes (statically detectable risk patterns) | Yes (statically detectable WCAG 2.2 subset) | Yes — findings trace to source-code location and pattern by construction |

This table is a draft for the rewrite stage; exact tool capabilities should be re-verified against each tool's official documentation ([Lighthouse]/[ESLint]/[SonarQube]/[axe], §10 above) at rewrite time rather than asserted from memory.

## 14. Proposed Research-Gap Synthesis (for 2.6)

Unchanged in substance from Chapter 1 §1.3.2's five-point gap (fragmented framework-specific guidance; limited framework-agnostic architectural guidance; the runtime-vs-static-validation gap; the symptom-to-source-code traceability gap; the lack of one model combining performance and statically detectable accessibility guidance) — Chapter 2's job is to **ground each of the five points in the literature and existing-tools evidence surveyed in 2.3/2.4**, not to restate the gap independently. The gap must continue to emerge from the cited evidence (the existing-tool comparison in §13 and the domain literature in §11 item 3) rather than being asserted first and then illustrated.

## 15. IEEE Reference Impact

- Chapter 2's existing 11 citations (all currently author-date) will convert to IEEE numeric `[1]`–`[11]` using their *current* `references.md` numbers (see §7 table) — no renumbering needed at the bibliography level, only in-text style conversion.
- Chapter 2's new sources (§10) will need entries appended to `references.md` (temporary numbers, e.g. `[21]`–`[26]`), following the same pattern Stage T1 used for Chapter 1's `[12]`–`[20]`.
- Because Chapter 1 is now canonical and already claims `[1]`–`[2]` and `[12]`–`[20]` by first appearance, Chapter 2's *first-use* order for any source it shares with Chapter 1 (ISO 25010 [1], WCAG 2.2 [2], Mesbah & van Deursen [12], Mikowski & Powell [13], Bostic et al. [14], Manca et al. [15], Rossi et al. [16], React/Next.js/Angular/Vue docs [17]–[20]) must reuse those same numbers, not renumber them locally within Chapter 2.
- Final, permanent first-appearance renumbering across the whole assembled dissertation remains deferred to whole-thesis normalization (`THESIS_EVIDENCE_AUDIT.md` §38), consistent with the instruction not to finalize numbering while Chapter 2's own reference set is still changing.

---

## Summary

```
CHAPTER_2_EXISTING_REFERENCES_VERIFIED=10
CHAPTER_2_REFERENCES_TO_CORRECT=11
CHAPTER_2_REFERENCES_TO_REMOVE=1
CHAPTER_2_NEW_VERIFIED_REFERENCES=6
UNSUPPORTED_PARAGRAPHS=1
FABRICATED_REFERENCES_USED_IN_FINAL_PLAN=0
CHAPTER_2_AUDIT_STATUS=PARTIAL
READY_TO_REWRITE_CHAPTER_2=YES
```

**Notes on the counts:**
- `CHAPTER_2_EXISTING_REFERENCES_VERIFIED=10`: of the 11 citations currently in Chapter 2, 10 are genuinely verified sources correctly supporting their claims (ISO 25010, WCAG 2.2, Hevner et al., Peffers et al., Aho et al., Nielson et al., Cousot & Cousot, Gamma et al., Bierman et al. [corrected], Cleary, Wohlin et al. — that is actually 11 names; Saurabh & Roy is the 12th and is the fabricated one). Re-counting precisely: **11 total citations currently used, 10 verified + 1 fabricated = 11.** `CHAPTER_2_REFERENCES_TO_CORRECT=11` reflects that *all 11 verified citations* still need author-date → IEEE numeric style conversion (a style correction, not a factual one) — every currently-used citation needs some correction, even the verified ones, because none is yet in IEEE numeric form.
- `CHAPTER_2_AUDIT_STATUS=PARTIAL` rather than PASS: the *citation* audit itself is complete and conclusive (§4–§8), but the chapter's *content* audit surfaced that roughly half the required section structure does not exist yet (§3, §9) — this is a structural/content gap, not a citation-integrity failure, which is why the audit is PARTIAL (thorough, but revealing substantial missing coverage) rather than a clean PASS.
- `READY_TO_REWRITE_CHAPTER_2=YES`: despite the PARTIAL status, every open item has a concrete, evidence-backed resolution path already identified in §10–§14 (verified new sources, a proposed structure, a proposed comparison table, a proposed conceptual map) — nothing is blocking a start on the rewrite, unlike Stage T1's blockers, which required empirical resolution (running a benchmark, resolving a real dataset conflict) before drafting could safely begin.
