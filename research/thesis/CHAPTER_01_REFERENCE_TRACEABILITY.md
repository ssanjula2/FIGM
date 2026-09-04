# CHAPTER 1 — REFERENCE TRACEABILITY

Companion document to `research/thesis/CHAPTER_01_INTRODUCTION.md`. Distinguishes academic-literature claims from project-evidence claims, per `THESIS_EVIDENCE_AUDIT.md` §AB. All IEEE numbers below are the **temporary** numbers currently in `docs/dissertation/references.md` ([12]–[20] appended this stage); final numbering is deferred to whole-thesis normalization (`THESIS_EVIDENCE_AUDIT.md` §38).

## A. Academic-literature claims

| Section | Claim | Source | Verification status | Current IEEE citation | Notes |
|---|---|---|---|---|---|
| 1.2 ¶1 | SPAs update content client-side/asynchronously rather than through full-page reloads, evolving from the MPA model | A. Mesbah and A. van Deursen, CSMR 2007 | VERIFIED (dblp/IEEE proceedings) | [12] | Also verified in the earlier blocker-resolution pass (Decision 4) |
| 1.2 ¶1 | Component-based frameworks provide reusable building blocks for interactive interfaces | M. S. Mikowski and J. C. Powell, *Single Page Web Applications*, Manning, 2013 | VERIFIED (established, widely-held book) | [13] | — |
| 1.2 ¶1, 1.10 | React is a primary framework studied | React official documentation | VERIFIED (official docs, stable URL) | [17] | Same URL previously verified in the Interim reference audit |
| 1.2 ¶1, 1.10 | Next.js is a primary framework studied | Next.js official documentation | VERIFIED (official docs, stable URL) | [18] | — |
| 1.2 ¶1, 1.10 | Angular is a primary framework studied | Angular official documentation | VERIFIED (official docs, stable URL) | [19] | — |
| 1.2 ¶1, 1.10 | Vue.js is recognised as an additional framework | Vue.js official documentation | VERIFIED (official docs, stable URL) | [20] | — |
| 1.2 ¶2 | Web engineering benefits from planned, discipline-level design rather than ad hoc convention | G. Rossi, O. Pastor, D. Schwabe, and L. Olsina, Eds., *Web Engineering: Modelling and Implementing Web Applications*, Springer, 2008 | VERIFIED (dblp) | [16] | **Replaces** a fabricated citation ("Rossi & Schwabe, 'Engineering Web Applications in the 21st Century,' IEEE Software 34(2), 2017") flagged in `THESIS_EVIDENCE_AUDIT.md` §34 and confirmed non-existent via a full dblp query of every Rossi–Schwabe co-authored work during the blocker-resolution stage. This 2008 edited volume is the genuine, verifiable Rossi/Schwabe/Pastor/Olsina work closest to the intended point. |
| 1.2 ¶3 | ISO/IEC 25010 defines Performance Efficiency as a technology-independent quality characteristic | ISO/IEC 25010:2011 | VERIFIED (real standard; already in `references.md` before this stage) | [1] | Unchanged from prior verification |
| 1.2 ¶3 | WCAG 2.2 states success criteria as testable, technology-neutral conditions | W3C, WCAG 2.2, 2023 | VERIFIED (real standard; already in `references.md`) | [2] | Unchanged from prior verification |
| 1.2 ¶4 | Automated crawler-based accessibility evaluation is an active research response to SPA dynamic-content accessibility risk | T. Bostic, J. Stanley, J. Higgins, D. Chudnov, J. Brunelle, and B. Tracy, arXiv:2110.14097, 2021 | VERIFIED (arXiv preprint; author list corrected from the Proposal's understated 2-author form) | [14] | Exact peer-reviewed proceedings venue (vs. arXiv-only) not independently confirmed — cite as an arXiv preprint unless a venue is later confirmed; do not state a proceedings name not verified here |
| 1.2 ¶4 | Automated accessibility evaluation tools can behave very differently depending on design/transparency choices | M. Manca, V. Palumbo, F. Paternò, and C. Santoro, ACM TOACCESS 16(1), 2023, doi:10.1145/3556979 | VERIFIED (dblp + DOI) | [15] | **Replaces** the fabricated "Manca, Paternò, Santoro, 'Automated Evaluation of Web Usability and Accessibility by Guideline Review,' ACM TOCHI 31(1), 2024" citation — the real 2004 paper of that exact title is by a *different* author trio entirely (Vanderdonckt, Beirekdar, Noirhomme-Fraiture; confirmed via dblp), so the original citation could not be "corrected," only replaced with a genuine Manca/Paternò/Santoro paper on the same general topic. |

**Citations considered and explicitly not used in Chapter 1** (documented so they are not silently reintroduced): "Baswaraju & Tiwari, 2023" and "Isomöttönen & Tirronen, 2016" — both flagged REMOVE in `THESIS_BLOCKER_RESOLUTION.md` §4.2 (unverifiable / non-existent as cited) and not needed to support any Chapter 1 claim once the alternative sources above were used instead.

## B. Project-evidence claims (repository-derived, not literature)

| Section | Claim | Repository file / evidence | Verification method |
|---|---|---|---|
| 1.4 | Main RQ / RQ1–RQ4 wording | Research Proposal §2.3; Interim Submission 02 §1.4 | Direct re-read of both source PDFs against the task's official contract (Section 2 of the T1 instruction) — verbatim match confirmed |
| 1.6 | Research Aim wording | Research Proposal §2.2; Interim Submission 02 §1.6 | Direct re-read, verbatim match confirmed |
| 1.7 | Objective wording and RQ mapping | Research Proposal §2.3; Interim Submission 02 §1.7.1–1.7.4 | Direct re-read; one-to-one mapping preserved |
| 1.6 | FIGM = "Framework-Agnostic Guideline Model," used interchangeably with "Framework-Independent Guideline Model" in project artefacts | `src/eval/evaluation-runner.ts` and `src/eval/functional-validator.ts` header comments (both read "Framework-Independent Guideline Model (FIGM)"); official thesis title and RQ2 use "framework-agnostic" | Direct source read during the evidence-audit stage (`THESIS_EVIDENCE_AUDIT.md` §3–5) |
| 1.9.2 | Technology stack (TypeScript, Next.js, React, TS Compiler API, `@vue/compiler-sfc`/`@vue/compiler-dom`, `angular-html-parser`, Prisma, Supabase, Node built-in test runner, Lighthouse, Vercel) | `package.json` (exact dependency versions); `research/rq1-experiment/protocol.json` (Lighthouse 12.8.2); `.vercel/`, `vercel.json`, `docs/deployment/` | Verified live during the evidence-audit stage (Agent 1 / Agent 5 findings, `THESIS_EVIDENCE_AUDIT.md` §6–7, §21) |
| 1.10 | 21-repository real-world corpus target framing (20–30 target; 15 primary + 6 additional referenced structurally, though the RQ3 *outcome* itself is deliberately not reported in Chapter 1 per the task's Section 10 instruction) | `benchmarks/real-world/raw-results/repository-manifest.json` | Verified live during blocker-resolution (Decision 3) |
| 1.10 | Human-study target = 20 real participants (P001–P020); original baseline was 80–100 | `src/research/research-config.ts` (`HUMAN_STUDY_TARGET_PARTICIPANTS = 20`); `docs/research/PARTICIPANT_TARGET_DECISION.md`; Research Proposal §4.3/§5.2; Interim §1.9.2/§3.4/§3.6.1/§3.6.2 | Verified during the original evidence-audit stage (`THESIS_EVIDENCE_AUDIT.md` §16–18) |
| 1.10 | RQ4 comparison "had not been completed at the time of this writing" | `research/independent-annotation/submissions/README.md`, `results/STATUS.md` (both confirm 0 real submissions) | Verified during the original evidence-audit stage (`THESIS_EVIDENCE_AUDIT.md` §14) |
| 1.8 | Rich-picture correction (Vue not equal to primary frameworks) | Research Proposal Fig. 1.1 / Interim Submission 02 Fig. 1.1 (both list "React \| Angular \| Next.js \| Vue JS" as a flat, undifferentiated list); Interim §1.10 Table 1.1 (which *does* correctly frame Vue as additional support only, in text) | Direct re-read of both source PDFs; inconsistency between the figure and the text table is the basis for the `FIGURE_ACTIONS_REQUIRED` note in Chapter 1 §1.8 |

## C. Numbers deliberately withheld from Chapter 1

Per the T1 instruction (Section 10), the following verified/resolved figures exist and are available (see `THESIS_BLOCKER_RESOLUTION.md`) but were **deliberately not inserted** into Chapter 1, since Chapter 1 describes evaluation design only:

- RQ1 FCP/TTI numeric results (Batch 1 primary / Batch 2 replication)
- Internal controlled benchmark TP=65/FP=0/FN=0/100%/100%/100%, 50/50 rule coverage
- RQ3 real-world scan totals (2,512 files, 2,649 findings, etc.)
- RQ4 metrics (none exist yet — correctly not claimed)
- Human-study participant outcomes (none exist yet — correctly not claimed)
