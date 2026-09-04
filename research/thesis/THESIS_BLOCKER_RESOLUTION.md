# THESIS BLOCKER RESOLUTION

**Purpose:** Resolve the four blocking items identified in `THESIS_EVIDENCE_AUDIT.md` (Section 39, items 1–3, and Section 34) before Chapter 1 drafting begins. This document records the evidence gathered and the resulting decisions for each of the four items the researcher assigned. No thesis chapter content is drafted here.

---

## DECISION 1 — RQ1 Datasets

### Raw provenance, both batches (independently re-derived from raw JSON this session, not copied from the prior audit)

| | **Batch 1 (canonical/committed)** | **Batch 2 ("Stage 9", uncommitted)** |
|---|---|---|
| Raw artifact paths | `research/rq1-experiment/raw-results/{COND}_run0XX_1788391*.json` / `..._1788392*.json` (44 files) | `research/rq1-experiment/raw-results/{COND}_run0XX_1788463*.json` (44 files) + duplicate copy under `research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/raw/` |
| Git status | **Committed** (not listed in `git status --porcelain`) | **Untracked** — all 44 files plus the `STAGE9_REAL_RUN_...` directory appear as `??` in `git status --porcelain` |
| Run dates (UTC, from raw JSON) | 2026-09-02 23:32:02 – 23:42:04 | 2026-09-03 19:18:25 – 19:23:28 |
| Freeze basis | `research-freeze-v1` (`61686e7a`, committed 2026-09-03 04:56:53 +0530 = 2026-09-02 23:26:53 UTC — i.e. tagged ~5 minutes before Batch 1 collection began) | `research-freeze-v5` (`0d287d6d`) environment baseline, checked out detached-HEAD for this run; the *resulting data itself* is not committed under any tag |
| Lighthouse version | 12.8.2 | 12.8.2 (identical) |
| Lighthouse config preset | `lighthouse/core/config/desktop-config.js` (real preset, Stage 3A fix) | `lighthouse/core/config/desktop-config.js` (identical) |
| Fixture/code version | `app/rq1-experiment/{csr-local,csr-global,ssr-local,ssr-global}/page.tsx` + `_shared/*` — **zero commits touched these files between `research-freeze-v1` and `research-freeze-v5`** (`git log --oneline research-freeze-v1..research-freeze-v5 -- app/rq1-experiment research/rq1-experiment/scripts` returns no results) | Identical fixture code (same commit range, no changes). `environment-manifest.json`'s own `toolFilesModified: []` confirms the runner tool itself was not modified for this run either |
| Experimental conditions | CSR_LOCAL, CSR_GLOBAL, SSR_LOCAL, SSR_GLOBAL | Identical (same 4, same order) |
| Warm-up count | 1 per condition (4 total) | 1 per condition (4 total) |
| Measured run count | 10 per condition (40 total); 44 total executions, 0 failures | 10 per condition (40 total); 44 total executions, 0 failures |
| Protocol difference found | **None.** Same `protocol.json` (`experimentVersion: 1.0.0`), same throttling values (`rttMs 40`, `throughputKbps 10240`, `cpuSlowdownMultiplier 1`), same screen emulation, same UA, same production build mode (`next build && next start`), same cold-navigation policy | — |

### FCP/TTI raw values, means, and SDs — independently recomputed this session directly from the raw JSON files (not taken from any prior report)

**Batch 1:**

| Condition | FCP raw (ms) | FCP mean / SD | TTI raw (ms) | TTI mean / SD |
|---|---|---|---|---|
| CSR_LOCAL | 450.72, 450.75, 450.59, 446.50, 443.74, 448.50, 445.82, 446.70, 446.30, 445.21 | 447.48 / 2.51 | 474.72, 479.75, 490.59, 489.50, 485.74, 490.50, 472.82, 478.70, 473.30, 471.21 | 480.68 / 7.78 |
| CSR_GLOBAL | 442.46, 441.73, 443.48, 444.56, 448.70, 445.71, 444.41, 441.43, 447.41, 442.02 | 444.19 / 2.47 | 481.46, 480.73, 476.48, 476.56, 473.70, 473.71, 470.41, 471.43, 483.41, 468.02 | 475.59 / 5.08 |
| SSR_LOCAL | 443.34, 446.16, 443.83, 448.77, 444.15, 444.50, 441.80, 442.88, 442.20, 444.30 | 444.19 / 2.03 | 471.34, 471.16, 483.83, 486.77, 471.15, 470.50, 481.80, 471.88, 476.20, 482.30 | 476.69 / 6.34 |
| SSR_GLOBAL | 442.75, 445.96, 445.06, 444.62, 444.41, 445.33, 443.33, 446.85, 447.76, 441.68 | 444.78 / 1.85 | 477.75, 487.96, 472.06, 473.62, 480.41, 471.33, 471.33, 488.85, 490.76, 465.68 | 477.98 / 8.70 |

**Batch 2:**

| Condition | FCP raw (ms) | FCP mean / SD | TTI raw (ms) | TTI mean / SD |
|---|---|---|---|---|
| CSR_LOCAL | 441.32, 440.79, 441.62, 445.44, 439.79, 438.22, 437.94, 437.21, 437.79, 438.41 | 439.85 / 2.52 | 469.32, 462.79, 465.62, 472.44, 468.79, 460.22, 461.94, 459.21, 460.79, 463.41 | 464.45 / 4.43 |
| CSR_GLOBAL | 435.77, 436.67, 436.95, 462.57, 455.35, 438.51, 437.76, 436.55, 438.30, 437.35 | 441.58 / 9.35 | 457.77, 460.67, 458.95, 484.57, 476.35, 463.51, 459.76, 458.55, 460.30, 459.35 | 463.98 / 9.03 |
| SSR_LOCAL | 440.27, 439.63, 439.62, 437.59, 440.36, 437.80, 436.59, 438.92, 439.29, 437.90 | 438.80 / 1.26 | 463.27, 462.63, 465.62, 459.59, 474.36, 463.80, 459.59, 461.92, 462.29, 459.90 | 463.30 / 4.35 |
| SSR_GLOBAL | 437.93, 440.02, 436.97, 438.07, 443.94, 438.39, 438.96, 437.18, 439.16, 437.17 | 438.78 / 2.06 | 463.93, 462.02, 465.97, 476.07, 467.94, 464.39, 462.96, 461.18, 461.16, 459.17 | 464.48 / 4.80 |

**No pooling was performed.** Each batch's values above are that batch's own, computed independently.

### Ruling (per the researcher's stated decision rule)

The instruction was: *"If they used the same frozen protocol and are both valid, recommend presenting Batch 1 as primary, Batch 2 as replication evidence... If there is a documented methodological reason that Batch 2 supersedes Batch 1, show that evidence before changing the canonical dataset."*

**No documented methodological reason for supersession was found.** Both batches used byte-identical protocol parameters, an identical Lighthouse version and config preset, and identical, unmodified fixture and runner code (confirmed via `git log` showing zero commits to the fixture app or the experiment scripts between the two freeze tags spanning both runs). They are true replications of one frozen protocol, not a corrected re-run.

Per the researcher's own decision rule, this case resolves to:

```
RQ1_PRIMARY_DATASET=Batch 1 (research/rq1-experiment/processed-results/, collected under research-freeze-v1, committed)
RQ1_REPLICATION_DATASET=Batch 2 / "Stage 9" (research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/, collected under the research-freeze-v5 environment baseline, currently uncommitted)
RQ1_DATASET_CONFLICT=RESOLVED
```

**Action still required before Chapter 6 is finalized (not performed in this session, flagged for the researcher):** `docs/research/EXPERIMENT_FREEZE.md` currently documents only `research-freeze-v1` and should be updated to note the existence and status of the Batch 2 replication run. If the researcher wants Batch 2 preserved as citable replication evidence, its 44 raw files and the `STAGE9_REAL_RUN_...` directory should be committed to git (currently untracked, at risk of accidental loss via `git clean`).

---

## DECISION 2 — Controlled Benchmark Contradiction

Full investigation and the live authoritative run are recorded in `research/thesis/CANONICAL_CONTROLLED_BENCHMARK_RESOLUTION.md`. Summary:

- **Root cause identified:** two independent scripts exist. `src/eval/evaluation-runner.ts` scores the full, current 50-rule catalog against `benchmarks/ground-truth.json` (65 hand-labelled entries, all 50 rules covered). `src/eval/functional-validator.ts` is a separate, narrower synthetic smoke test whose own hard-coded `VALIDATION_TESTBED` array was never extended past 25 rules when the catalog grew to 50 — this is the exact, sole reason `docs/validation-report.md` reports "25/50 (50.0% Coverage)." Its one false positive (`FIGM-A11Y-04`) is most plausibly a stale-fixture artifact from the same non-maintenance, not evidence of a live detector defect.
- **Authoritative live run performed this session:** `node --import tsx src/eval/evaluation-runner.ts`, timestamped `2026-09-04T07:31:00.014Z`, against `benchmarks/testbed/` and `benchmarks/ground-truth.json` (no AI-generated labels — hand-authored ground truth, per that file's own provenance log).
- **Result:** every accuracy field reproduced byte-identically to the pre-existing canonical figure (only the timestamp and machine-dependent performance-timing fields changed), confirming determinism.

```
CANONICAL_INTERNAL_BENCHMARK_TP=65
CANONICAL_INTERNAL_BENCHMARK_FP=0
CANONICAL_INTERNAL_BENCHMARK_FN=0
CANONICAL_INTERNAL_BENCHMARK_PRECISION=100.0%
CANONICAL_INTERNAL_BENCHMARK_RECALL=100.0%
CANONICAL_INTERNAL_BENCHMARK_F1=100.0%
CANONICAL_INTERNAL_BENCHMARK_RULE_COVERAGE=50/50 (100%)
CONTROLLED_BENCHMARK_CONFLICT=RESOLVED
```

**Reminder carried into the thesis:** this is an INTERNAL CONTROLLED BENCHMARK (fixtures and ground truth both authored by this project) and must never be presented as, or substituted for, RQ4's independent expert validation (still PENDING — 0 real submissions, unchanged by this session's work).

---

## DECISION 3 — Repository Corpus

**Normalized wording:** 15 primary-framework repositories (React 5, Next.js 5, Angular 5) + 6 additional implementation-support repositories (Vue 3, Generic JS/TS 3) = 21 repositories total. Verified directly against `benchmarks/real-world/raw-results/repository-manifest.json` (`repoCount: 21`, per-repo `isPrimaryFramework` flags matching this split exactly) and `_combined-summary.json`.

**Correction applied:** `docs/dissertation/chapter6_conclusion.md`, §6.2 RQ3 answer (previously line 32) was rewritten. It previously cited a stale, pre-expansion snapshot ("a real-world corpus of 15 public repositories, 843 files, 54,097 LOC scanned, 0 engine crashes, 39 files with parse errors... 381 raw findings... not yet at its full target size") that directly contradicted §6.4 of the *same file*, which already correctly stated the corpus had been "expanded from 15 to 21 repositories... reaching the confirmed 20-30 repository target." The corrected §6.2 text now reads (in full):

> "On a real-world corpus of 21 public repositories — 15 primary-framework repositories (React 5, Next.js 5, Angular 5) plus 6 additional implementation-support repositories (Vue 3, Generic JS/TS 3), reaching the confirmed 20–30 repository target (Chapter 1, Section 1.7) — the tool scanned 2,512 files (320,367 LOC), with 0 engine crashes and 117 files with parse errors, and produced 2,649 raw findings (393 Architecture, 1,578 Static Performance, 678 Accessibility — see `benchmarks/real-world/raw-results/_combined-summary.json` and `domain-summary.json`). These findings have not been independently labelled for correctness at scale (an n=18 manual spot-check exists — `benchmarks/real-world/SPOT_CHECK.md` — explicitly too small to generalize), so no real-world precision/recall/accuracy figure is claimed."

**Files checked and found already consistent (no edit needed):** `chapter6_conclusion.md` §6.4 (already said 21), `chapter1_introduction.md` §1.10 (defers to Chapter 5/6 without stating a number), `chapter5_empirical_validation_and_benchmarks.md` (does not restate the real-world repo count). **Files checked and found to contain no ambiguous claim:** `chapter2_literature_review.md`, `chapter3_methodology.md`, `chapter3_architecture.tex`, `chapter4_implementation.{md,tex}`, `chapter5_evaluation.tex`, `chapter6_user_study_and_validity.md`, `references.md` — none mention the real-world repository count. `benchmarks/real-world/SPOT_CHECK.md` contains one historical sentence ("Total findings across all 15 repos dropped from 497 to 392") describing the measured effect of a specific bug fix *at the time it was made*, when the corpus was still 15 repositories — this is a correctly time-scoped historical record, not a current-state claim, and was left unedited.

```
PRIMARY_REPOSITORY_COUNT=15
ADDITIONAL_REPOSITORY_COUNT=6
TOTAL_REPOSITORY_COUNT=21
REPOSITORY_COUNT_CONFLICT=RESOLVED
```

---

## DECISION 4 — References

Every reference flagged as questionable in `THESIS_EVIDENCE_AUDIT.md` §34 was re-verified this session against a bibliographic authority (dblp.org, ACM DL, or Springer/DOI) rather than general web search alone, and corrected, replaced, or removed accordingly. **No replacement reference was invented; every correction below is anchored to a resolved DOI or a dblp record.**

### 4.1 `docs/dissertation/references.md` — editable file, corrections applied directly

| Item | Before | After | Verification |
|---|---|---|---|
| [7] | "M. Bierman, A. Lucco, and E. Meijer, 'Understanding TypeScript,' *ACM SIGPLAN Notices*, vol. 49, no. 10, pp. 257–267, Oct. 2014." — wrong co-authors, wrong venue | "G. Bierman, M. Abadi, and M. Torgersen, 'Understanding TypeScript,' in *Proc. 28th Eur. Conf. Object-Oriented Programming (ECOOP)*, Uppsala, Sweden, 2014, pp. 257–281, doi: 10.1007/978-3-662-44202-9_11." | Confirmed via dblp (`conf/ecoop/BiermanAT14`): authors Gavin M. Bierman, Martín Abadi, Mads Torgersen; ECOOP 2014; pp. 257–281 |
| Numbering gap | [9] → [11] (no [10]) | Renumbered [11]→[10], [12]→[11]; both IEEE and APA blocks corrected | Direct file inspection |
| APA-block entry | "Saurabh, V., & Roy, S. (2022). Empirical evaluation of static code analysis tools for web accessibility compliance. *IEEE Transactions on Software Engineering*, 48(6), 1942–1958." | **Removed entirely.** No paper matching this title, author pair, or DOI (`10.1109/TSE.2020.3045612` — a malformed/inconsistent DOI pattern for a claimed 2022 article) could be found on IEEE Xplore, ACM DL, or general search. Classified as fabricated. | Could not be verified through any bibliographic source; removed per "do not invent replacement references" — no replacement was substituted |

**Newly discovered dependent issue (not fixed in this session — flagged for Chapter 2 drafting):** `docs/dissertation/chapter2_literature_review.md` §2.7 ("Related Empirical Work") is an entire paragraph built around "Saurabh and Roy (2022)," the now-removed fabricated reference. This paragraph must be rewritten when Chapter 2 is finalized. **Recommended replacement anchor** (verified, see 4.2 below): M. Manca, V. Palumbo, F. Paternò, and C. Santoro, "The Transparency of Automatic Web Accessibility Evaluation Tools: Design Criteria, State of the Art, and User Perception," *ACM Transactions on Accessible Computing*, vol. 16, no. 1, Art. 3, pp. 1–36, 2023, doi: 10.1145/3556979 — a genuine, closely on-topic empirical evaluation of automated accessibility tooling by an active research group, suitable to replace the fabricated citation's role in that paragraph without needing to invent new framing.

### 4.2 Proposal / Interim 02 — sourced from non-editable PDFs; corrections recorded here for use when Chapter 1/2 draw on this literature

| Original citation | Re-verification (dblp / DOI where available) | Disposition |
|---|---|---|
| Rossi & Schwabe, "Engineering Web Applications in the 21st Century," IEEE Software 34(2), 2017 | **Confirmed non-existent.** Queried dblp for every Rossi–Schwabe co-authored publication (2002–2010; no later joint work indexed); no title resembling this appears in any venue or year. | **REMOVE.** Verified real substitute if the thesis needs a Rossi/Schwabe web-engineering citation: G. Rossi, O. Pastor, D. Schwabe, and L. Olsina, Eds., *Web Engineering: Modelling and Implementing Web Applications*. London, U.K.: Springer, 2008 (Human–Computer Interaction Series), confirmed via dblp. |
| Baswaraju & Tiwari, "Automated Web Testing over the Last Decade: A Systematic Literature Review," Computer Science Review 47, 2023 | Not found under this author pair in this venue on any queried source; a similarly-titled paper exists in an unrelated, minor journal. | **REMOVE** unless the researcher can supply a verifiable DOI. Not replaced with an invented substitute. |
| Manca, Paternò, Santoro, "Automated Evaluation of Web Usability and Accessibility by Guideline Review," ACM TOCHI 31(1), 2024 | **Confirmed misattributed to the wrong authors entirely.** The real 2004 paper with this exact title (DOI `10.1007/978-3-540-27834-4_4`, Springer) is by **J. Vanderdonckt, A. Beirekdar, and M. Noirhomme-Fraiture** — not Manca/Paternò/Santoro at all. | **REMOVE** as cited. If the thesis wants a genuine Manca/Paternò/Santoro citation, use the verified 2023 paper in §4.1 above instead — do not "correct" this entry to the Vanderdonckt et al. 2004 paper while keeping the wrong author names. |
| Isomöttönen & Tirronen, "Teaching SPA Development: A Case Study," ITiCSE 2016 | Not found under this title in any queried source; the same author pair's real 2016 work is on an unrelated topic (functional-programming pedagogy, ACM TOCE). | **REMOVE.** Not replaced with an invented substitute. |
| Bostic & Stanley, "Automated Evaluation of Web Site Accessibility Using A Dynamic Accessibility Measurement Crawler," 2021 | **Confirmed real** (arXiv:2110.14097), but the citation understates the author list — 6 authors (Bostic, Stanley, Higgins, Chudnov, Brunelle, Tracy), not 2. | **KEEP, correct author list** to "T. Bostic, J. Stanley, J. Higgins, D. Chudnov, J. Brunelle, and B. Tracy" (or "T. Bostic et al." in text). Exact peer-reviewed proceedings venue (vs. arXiv-only status) not independently confirmed this session — mark `[VENUE TO VERIFY]` if cited. |
| Tilkov & Vinoski, "Node.js...," IEEE Internet Computing 14(6), 2010 | **Confirmed real**, DOI 10.1109/MIC.2010.145. | KEEP, unchanged. |
| Mesbah & van Deursen, CSMR 2007; Mikowski & Powell, 2013; W3C WCAG 2.2, 2023; Hevner et al. 2004; Peffers et al. 2007; Schwaber & Sutherland 2020; official tool docs (Lighthouse/ESLint/SonarQube/axe/React/Angular/Next.js) | Re-confirmed consistent with the original audit; no change. | KEEP, unchanged. |

### 4.3 Status

```
REFERENCE_AUDIT_STATUS=PARTIAL
```

Reasoning for PARTIAL rather than PASS: the two corrections available in an editable file (`docs/dissertation/references.md`) were verified and applied directly. However, (a) `chapter2_literature_review.md` §2.7 still contains prose dependent on the now-removed fabricated reference and needs a rewrite (not performed — out of scope for a references-only correction), and (b) the Proposal/Interim's four flagged citations live in source PDFs this session cannot edit; their corrected/removal dispositions are fully documented above and ready to apply the moment Chapter 1/2 draft text is written, but the correction has not yet been *applied* anywhere because those chapters do not yet cite this literature in any editable file (confirmed: `grep` for these authors' names across all of `docs/dissertation/` returns zero matches — the two literature bases, Proposal/Interim's SPA/accessibility literature and `references.md`'s compiler-theory/DSR literature, have not yet been merged into the draft chapters).

---

## FINAL STATUS

```
RQ1_PRIMARY_DATASET=Batch 1 (research-freeze-v1, committed)
RQ1_REPLICATION_DATASET=Batch 2 / Stage 9 (research-freeze-v5 baseline, uncommitted)
RQ1_DATASET_CONFLICT=RESOLVED

CANONICAL_INTERNAL_BENCHMARK_TP=65
CANONICAL_INTERNAL_BENCHMARK_FP=0
CANONICAL_INTERNAL_BENCHMARK_FN=0
CANONICAL_INTERNAL_BENCHMARK_PRECISION=100.0%
CANONICAL_INTERNAL_BENCHMARK_RECALL=100.0%
CANONICAL_INTERNAL_BENCHMARK_F1=100.0%
CANONICAL_INTERNAL_BENCHMARK_RULE_COVERAGE=50/50 (100%)
CONTROLLED_BENCHMARK_CONFLICT=RESOLVED

PRIMARY_REPOSITORY_COUNT=15
ADDITIONAL_REPOSITORY_COUNT=6
TOTAL_REPOSITORY_COUNT=21
REPOSITORY_COUNT_CONFLICT=RESOLVED

REFERENCE_AUDIT_STATUS=PARTIAL

READY_TO_DRAFT_CHAPTER_1=YES
```

**Basis for READY_TO_DRAFT_CHAPTER_1=YES despite REFERENCE_AUDIT_STATUS=PARTIAL:** all three numerically-blocking conflicts (RQ1 dataset choice, controlled-benchmark figure, repository corpus count) are now RESOLVED with committed evidence and, where applicable, corrected chapter text. The reference-audit PARTIAL status reflects work that belongs to Chapter 2 (the §2.7 rewrite) and to the literature-merge step of actual Chapter 1/2 drafting (applying the REMOVE/KEEP/replace dispositions in §4.2 above) — neither is a blocker to *starting* Chapter 1, provided Chapter 1 drafting uses only the verified sources and dispositions recorded in §4.2 of this document (never the four flagged-fabricated citations in their original form) and Chapter 2 drafting is not treated as complete until its §2.7 dependency on the removed citation is resolved.

**Not modified this session:** no research data (ground-truth labels, raw RQ1 JSON, real-world scan results, participant/consent records) was altered. The only functional code executed was the pre-existing, deterministic `evaluation-runner.ts` benchmark script (an explicit instruction of Decision 2); no source code was changed. Edits were limited to: `docs/dissertation/chapter6_conclusion.md` (Decision 3 correction) and `docs/dissertation/references.md` (Decision 4 corrections).
