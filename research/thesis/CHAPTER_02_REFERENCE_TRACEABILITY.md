# CHAPTER 2 — REFERENCE TRACEABILITY

Companion document to `research/thesis/CHAPTER_02_LITERATURE_REVIEW.md`. All IEEE numbers are the **temporary** numbers currently in `docs/dissertation/references.md`; final first-appearance renumbering across the whole assembled dissertation remains deferred (`THESIS_EVIDENCE_AUDIT.md` §38).

## A. Literature-derived claims

| Section | Claim | Verified Source | IEEE Citation | What the Source Supports | Limitation / Caveat |
|---|---|---|---|---|---|
| 2.3 | SPAs update content asynchronously rather than via full-page reload; this is the defining departure from the MPA model | Mesbah & van Deursen, CSMR 2007; Mikowski & Powell, 2013 | [12], [13] | Both directly support the SPA/MPA architectural distinction | — |
| 2.3 | React, Next.js, Angular (primary), Vue.js (additional) each implement SPA architecture in their own way | Official documentation | [17], [18], [19], [20] | Confirms each framework's own model exists and is documented; does not itself argue for a primary/additional split (that is this dissertation's own scope decision, Chapter 1 §1.10) | — |
| 2.3 | Rendering strategy (CSR vs. SSR) has measurable performance consequences, including on FCP | Clapton et al., 2025/2026 | [21] | Directly supports: a controlled comparison found measurable Core Web Vitals differences between CSR and SSR | Findings are scoped to that study's own experimental conditions; not generalised here beyond "rendering strategy has observable consequences," and no numeric result from it is presented as this dissertation's own | 
| 2.3 | State management (local vs. global/shared) is a first-class architectural concern independent of the specific library | Donvir, Jain & Saraswathi, 2024 | [22] | Directly supports treating state-management approach as an architectural variable | Cited conservatively as an arXiv preprint per the Bostic-rule precedent (a companion IEEE UEMCON 2024 DOI exists but was not independently page-verified — see `references.md`) |
| 2.3 | Performance Efficiency is a technology-independent quality characteristic | ISO/IEC 25010:2011 | [1] | Directly supports | — |
| 2.3 | SPA dynamic content introduces accessibility risks not shared by traditional pages; WCAG 2.2 states success criteria in technology-neutral terms | W3C WCAG 2.2, 2023; Bostic et al., 2021 | [2], [14] | WCAG 2.2 directly supports the technology-neutral framing; Bostic et al. motivates automated accessibility testing of dynamic/interactive page states as a real research problem | Bostic et al. cited as arXiv only, no venue claimed |
| 2.4 | Lighthouse performs runtime performance auditing including FCP | Google, Lighthouse Overview | [23] | Directly supports | Official documentation, not a third-party evaluation of Lighthouse |
| 2.4 | ESLint + framework plugins perform static, per-framework-coupled analysis | ESLint Documentation | [24] | Directly supports ESLint's own architecture; the "per-framework-coupled" critique is this dissertation's own analytical point, consistent with the tool's documented plugin model | — |
| 2.4 | SonarQube performs general-purpose static code-quality analysis, not SPA-specific | SonarQube Server Documentation | [25] | Directly supports | — |
| 2.4 | axe DevTools performs runtime, DOM-based accessibility auditing | axe DevTools Documentation | [26] | Directly supports | — |
| 2.4 | Automated accessibility-evaluation tools can differ substantially in scope and transparency | Manca, Palumbo, Paternò & Santoro, ACM TOACCESS 2023 | [15] | Directly supports — this is the paper's own central finding | This is the verified source that replaces the role the fabricated "Saurabh & Roy 2022" citation previously played in the old §2.7; it is used only for the claim it genuinely supports (tool design/transparency variation), not stretched to cover unrelated claims |
| 2.5.1 | AST-based analysis distinguishes syntactic structure from irrelevant textual variation | Aho, Lam, Sethi & Ullman, *Compilers*, 2006 | [4] | Directly supports | — |
| 2.5.1 | Syntactic pattern matching vs. data-flow/semantic analysis is a meaningful, consequential distinction | Nielson, Nielson & Hankin, *Principles of Program Analysis*, 2005 | [5] | Directly supports | — |
| 2.5.1 | Abstract interpretation defines the formal conditions for sound static analysis | Cousot & Cousot, POPL 1977 | [6] | Directly supports | Cited as the theoretical ceiling being discussed, not as a claim that this dissertation's own tool implements abstract interpretation |
| 2.5.2 | Standards provide semantic vocabulary but not an executable detection methodology | ISO/IEC 25010:2011; WCAG 2.2 | [1], [2] | Directly supports | — |
| 2.5.2 | Strategy/Factory/Adapter patterns are the general vocabulary for separating a stable interface from interchangeable implementations | Gamma, Helm, Johnson & Vlissides, *Design Patterns*, 1994 | [9] | Directly supports the general pattern definitions | Cited for general relevance to the framework-abstraction design problem only; no specific FIGM class is named here (moved to Chapter 4 per the audit's recommendation) |
| 2.5.2 | A structurally-typed, error-tolerant parser is valuable for analysing potentially malformed real-world source | Bierman, Abadi & Torgersen, "Understanding TypeScript," ECOOP 2014 | [7] | Directly supports the description of TypeScript's parser/type-system design | Author list and venue corrected during Stage T1; this stage only needed the in-text IEEE-numeric conversion |
| 2.6 | Rendering-strategy and state-management choices are empirically consequential, motivating RQ1 | Clapton et al.; Donvir et al. | [21], [22] | Directly supports | — |

## B. Workflow / design claims with a general (non-domain-specific) citation

| Section | Claim | Verified Source | IEEE Citation | What the Source Supports | Limitation / Caveat |
|---|---|---|---|---|---|
| 2.5.3 | Long-running analysis should execute asynchronously/non-blocking rather than stalling a pipeline | Cleary, *Concurrency in C# Cookbook*, 2019 | [8] | Supports the general async/non-blocking design principle | Cited for the general principle only, explicitly not for any C#-specific API, consistent with the original draft's own careful scoping of this citation |

## C. Project-evidence claims (not literature; kept separate per `THESIS_EVIDENCE_AUDIT.md` §AB)

| Section | Claim | Repository evidence | Notes |
|---|---|---|---|
| 2.3, throughout | "This dissertation's primary frameworks are React, Next.js, Angular; Vue.js is additional support" | Chapter 1 §1.10; `THESIS_BLOCKER_RESOLUTION.md` Decision 3 | Not a literature claim — this is the research's own scope decision, stated consistently with Chapter 1 |
| 2.4, Table 2.1 last row | "FIGM (this research)" row of the comparison table | Chapter 1 §1.6/§1.8 (design intent only — no measured result cited) | Deliberately contains no numeric outcome (no benchmark %, no repository count, no RQ1 figure), consistent with the T2 instruction not to insert FIGM's own results into Chapter 2 |
| 2.6 | "Chapter 3 now presents the methodology... Chapter 4 details its implementation" | Forward reference only | Not evidence, a structural transition sentence |

## D. Citations considered, and explicitly not used, in this rewrite

| Citation | Disposition | Reason |
|---|---|---|
| Hevner et al., "Design Science in Information Systems Research," 2004 | **Relocated, not removed.** Remains valid in `references.md` [3]; recommended for Chapter 3 only | Confirmed duplicate of `chapter3_methodology.md` §3.1, which already cites this work as the dissertation's methodological stance (verified by direct inspection during the T2 audit) |
| Peffers et al., "A DSR Methodology...," 2007 | **Relocated, not removed.** Remains valid in `references.md` [10]; recommended for Chapter 3 only | Same reasoning — DSR process-model content belongs to methodology, not literature review |
| Wohlin et al., *Experimentation in Software Engineering*, 2012 | **Relocated, not removed.** Remains valid in `references.md` [11]; recommended for Chapter 3 (design) or Chapter 6 (threats to validity) | Validity-framework/evaluation-methodology content, not domain literature |
| Saurabh & Roy, "Empirical evaluation of static code analysis tools for web accessibility compliance," 2022 | **REMOVED** (already removed from `references.md` at Stage T1) | Confirmed fabricated — no such paper, author pair, or DOI exists (verified via dblp/IEEE/ACM search) |
| "Rossi & Schwabe, 'Engineering Web Applications in the 21st Century,' IEEE Software 2017" (original Proposal/Interim form) | Not used in this form. The verified substitute, Rossi, Pastor, Schwabe & Olsina, Eds., *Web Engineering...*, 2008 [16], was available for use in Chapter 2 but was not needed for any claim this chapter makes (it is used in Chapter 1 §1.2 instead) | Confirmed fabricated as originally cited (Stage-1 blocker resolution); not reintroduced |
| "Manca, Paternò, Santoro, ACM TOCHI 31(1), 2024" (original Proposal/Interim form) | Not used in this form. The verified, correctly-attributed 2023 paper by the same author group, [15], is used instead (§2.4, §2.6) | The original citation misattributed a 2004 paper by different authors (Vanderdonckt, Beirekdar, Noirhomme-Fraiture) to Manca/Paternò/Santoro; not reintroduced in that incorrect form |

## E. Summary lists

**NEW_REFERENCES_ADDED** (this stage; appended to `docs/dissertation/references.md` as [21]–[26]):
1. J. Clapton, H. Bastos, J. P. O. Batisteli, D. B. Seufitelli, and C. Tavares, "Client-Side vs Server-Side Rendering: Impacts on Performance and User Experience in Web Applications," 2025/2026, doi: 10.5753/sbqs.2025.15078 — [21]
2. A. Donvir, A. Jain, and P. K. Saraswathi, "Application State Management (ASM)...," arXiv:2407.19318, 2024 — [22]
3. Google, "Lighthouse Overview" — [23]
4. ESLint, "ESLint Documentation" — [24]
5. SonarSource SA, "SonarQube Server Documentation" — [25]
6. Deque Systems Inc., "axe DevTools Documentation" — [26]

**REFERENCES_REMOVED** (this stage): none newly removed — Saurabh & Roy was already removed at Stage T1; this stage confirms it was not reintroduced.

**REFERENCES_CORRECTED** (this stage): none newly corrected — Bierman et al. [7] was already corrected at Stage T1 (author list/venue); this stage only performed the in-text author-date → IEEE-numeric style conversion, which is a style fix, not a further factual correction.

**REFERENCES_RELOCATED** (recommended, not yet moved — Chapter 3 is out of scope for this stage): Hevner et al. [3], Peffers et al. [10], Wohlin et al. [11] — see §D above.

## F. Deferred final-stage items (tracked at Stage T2 approval, not fixed now)

Recorded per the researcher's explicit instruction to track without spending time fixing during Stage T2 promotion. Carry these into the final consistency/proofreading stage:

1. **Lighthouse/Core Web Vitals wording** — Chapter 2 (§2.3, §2.4) currently implies FCP sits alongside Core Web Vitals without distinguishing that FCP is a Lighthouse performance metric but not itself one of the three official Core Web Vitals (LCP, INP, CLS). Needs a precision fix at final proofread.
2. **SonarQube accessibility-capability wording** (Table 2.1) — "effectively none" needs a final live-documentation spot-check against SonarQube's current rule catalog before submission.
3. **"correcting it is cheapest" (§2.5.3)** — should be cited or softened to "earlier in the development lifecycle" at final proofread; currently an unsupported comparative claim.
4. **Figure 2.1** — conceptual map is textual only; still requires final graphic rendering.
5. **Table 2.1** — all tool-capability cells require final live-documentation verification against Lighthouse/ESLint/SonarQube/axe DevTools official docs before submission.
6. **Whole-thesis IEEE numbering** — current numbers ([1]–[26]) are temporary/sequential-by-chapter; normalization to true first-appearance order across the complete assembled dissertation is deferred to the final consistency stage (`THESIS_EVIDENCE_AUDIT.md` §38).
