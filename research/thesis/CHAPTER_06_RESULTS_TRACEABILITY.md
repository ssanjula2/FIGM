# CHAPTER 6 — RESULTS TRACEABILITY

Companion document to `research/thesis/CHAPTER_06_RESULTS_AND_CONCLUSION.md`. Every numeric or status claim is traced to its exact evidence source, re-verified fresh in this session (not taken from a remembered or prior-session figure), with scope and caveat stated explicitly.

## Core evidence table

| Section | Claim | Evidence Source | Exact Value / Status | Scope | Caveat |
|---|---|---|---|---|---|
| 6.2.1 | RQ1 PRIMARY (Batch 1) FCP/TTI, all 4 conditions | `research/thesis/THESIS_BLOCKER_RESOLUTION.md` lines 27–34, re-grepped fresh this session | CSR_LOCAL: FCP 447.48/2.51, TTI 480.68/7.78; CSR_GLOBAL: FCP 444.19/2.47, TTI 475.59/5.08; SSR_LOCAL: FCP 444.19/2.03, TTI 476.69/6.34; SSR_GLOBAL: FCP 444.78/1.85, TTI 477.98/8.70 | `research-freeze-v1`, committed, 44 executions, 0 failures | Descriptive only; no significance test; not generalized beyond this fixture/environment |
| 6.2.2 | RQ1 REPLICATION (Batch 2 / Stage 9) FCP/TTI, all 4 conditions | `research/thesis/THESIS_BLOCKER_RESOLUTION.md` lines 36–43, re-grepped fresh this session | CSR_LOCAL: FCP 439.85/2.52, TTI 464.45/4.43; CSR_GLOBAL: FCP 441.58/9.35, TTI 463.98/9.03; SSR_LOCAL: FCP 438.80/1.26, TTI 463.30/4.35; SSR_GLOBAL: FCP 438.78/2.06, TTI 464.48/4.80 | `research-freeze-v5` environment baseline, currently uncommitted | Replication evidence only; never pooled with PRIMARY; not independently cited elsewhere in this dissertation as the canonical figure |
| 6.2.1 | Canonical dataset decision: Batch 1 = PRIMARY, Batch 2 = REPLICATION, no pooling | `research/thesis/THESIS_BLOCKER_RESOLUTION.md` lines 56–57, 146–147 | `RQ1_PRIMARY_DATASET=Batch 1`, `RQ1_REPLICATION_DATASET=Batch 2 / Stage 9` | Whole-dissertation rule | Batch 2 remains uncommitted in git at time of writing — a standing action item for the researcher, not addressed in this stage |
| 6.3 | 50-rule catalogue, `ruleSetVersion 2.1.0`, four-layer meta-model | `src/matrix/four-layer-meta-model.ts`, `src/research/research-config.ts` (verified at Stage T4) | 50 rules, version string `2.1.0` | Whole catalogue | Not re-verified again in this stage (no code changed since Stage T4); consistent with Chapter 4 |
| 6.3 | 19 architecture + 7 accessibility patterns (of 50) | `primaryResearchDomain()` domain split, verified at Stage T1–T5 and re-confirmed via `domain-summary.json`'s `byPrimaryResearchDomain` categories existing | Architecture 19, Static Performance 24, Accessibility 7 (sums to 50) | Whole catalogue composition | RQ2's wording only names architecture+accessibility (26 of 50), consistent with RQ2's own question wording, which does not ask about performance patterns |
| 6.4.1 | 21-repository corpus composition | `benchmarks/real-world/raw-results/repository-manifest.json`, re-counted fresh this session via `primaryFrameworkLabel` | React 5, Next.js 5, Angular 5 (15 primary); Vue 3, Generic JavaScript/TypeScript 3 (6 additional); 21 total | Real-world evaluation corpus | Pinned commits per repository (`pinnedCommit` field), not re-verified individually this session |
| 6.4.1 | Files scanned, LOC, parse errors, crashes, findings | `benchmarks/real-world/raw-results/_combined-summary.json`, re-read fresh this session via `node -e` | 2,512 files; 320,367 LOC; 117 files with parse errors; 0 engine crashes; 2,649 total findings | Real-world evaluation corpus | No independent ground truth exists for this corpus |
| 6.4.1 | Domain split of the 2,649 findings | `benchmarks/real-world/raw-results/domain-summary.json`, re-read fresh this session | Architecture 393, Static Performance 1,578, Accessibility 678 | Real-world evaluation corpus | Computed via `primaryResearchDomain()`, not the older raw 2-value `domain` field (per the file's own embedded note) |
| 6.4.1 | Distinct rules triggered | `benchmarks/real-world/raw-results/rule-frequency-summary.json`, re-read fresh this session | 36 of 50 | Real-world evaluation corpus | The other 14 rules are demonstrated functional in Chapter 5's fixture benchmark; their absence here is not evidence of malfunction |
| 6.4.2 | Internal controlled benchmark confusion matrix and metrics | `docs/evidence/canonical-evaluation.json`, re-read fresh this session via `node -e` | TP=65, FP=0, FN=0, Precision=1.0, Recall=1.0, F1=1.0, rule coverage 50/50 | Internal, self-authored fixture benchmark only | Never used as RQ4 evidence; fixtures and ground truth are researcher-authored (Chapter 5, §5.5) |
| 6.5 | RQ4 status | `research/independent-annotation/results/STATUS.md`, re-read fresh this session (`_Last checked: 2026-09-06T05:32:59.035Z_`) | `PENDING`; 0 submission files in `submissions/`; 67 cases, 1,717 case×rule rows in the frozen protocol | RQ4 only | No external Precision/Recall/F1 figure exists or is claimed |
| 6.6 | Human usability study actual current N | `research/analysis/usability-results.json`, re-read fresh this session | `datasetType: SYNTHETIC`, `isRealHumanData: false`, `collectionStatus: NOT_COLLECTED`, `targetSampleSize: 20`, `validParticipantCount: 0`, `targetReached: false` | Human usability study only | Target (20) is not actual (0); no fabricated SUS/demographics/task-performance/themes reported |
| 6.3, 6.10 | WCAG scope: "statically detectable subset," never full/AA conformance or ISO verification | Chapter 3 §3.3.4 (detectability classifications), `tests/wcag-mapping-integrity.test.ts` (re-run as part of the full suite this session, passing) | 7 accessibility rules, each with an explicit per-rule Success Criterion + detectability classification | Accessibility rule subset only | No conformance-level claim of any kind is made in Chapter 6 |
| 6.2.4 | Static/runtime boundary: static performance rules ≠ Core Web Vitals runtime measurement | Chapter 5 §5.9 (technical-evaluation limitations); this chapter's own §6.2.4 | N/A (a stated boundary, not a number) | Whole dissertation | "Core Web Vitals" is used only to describe the RQ1 FCP/TTI experiment's adjacent metric family, never as a static-rule validation label |
| 6.9 | AI-remediation provider architecture | Chapter 4, §4.6–4.8 (verified at Stage T4 via direct source read of `src/ai/ai-provider-selector.ts`, provider files, and git history) | 3 current providers: Ollama (default), Claude, Gemini, with `AI_PRIMARY_PROVIDER` override and Claude→Gemini→Ollama fallback | Remediation architecture | Not re-verified again in this stage (no code changed since Stage T4); Gemini-only wording removed from Chapter 6 (see stale-claim sweep below) |
| 6.7 | Accomplishment of Research Objectives (university-guide-required section, added at Stage T6-University-Alignment) | Chapter 1 §1.7 (four objectives, 1:1 with RQ1–RQ4); triangulated against Chapter 5 testing evidence, §6.2 (RQ1), §6.4.1 (real-world corpus), §6.4.2 (internal benchmark), Chapters 3–4 (model/rule implementation) | Objectives 1–3 (RQ1–RQ3): ACCOMPLISHED within disclosed scope; Objective 4 (RQ4): NOT YET ACCOMPLISHED, pending | Whole-dissertation objective-accomplishment claim | Internal benchmark and real-world scan explicitly excluded as triangulating evidence for Objective 4, since RQ4 requires evidence independent of the tool's own authors |
| 6.11–6.13 | Problems Encountered, Self-Reflection, Business Insight and Real-World Application (university-guide-required sections, added at Stage T6-University-Alignment) | Drawn directly from evidence already established elsewhere in this dissertation (Chapter 3 §3.3, Chapter 4 §4.5–§4.7, Chapter 5 test/benchmark history, this chapter's own §6.4–§6.10) and from this project's own documented audit trail (`docs/audit/`) for the process-reflection content in §6.12 | No new numeric claim introduced; §6.13's business applications are explicitly framed as potential, not proven | Whole-dissertation, non-numeric qualitative content | §6.13 explicitly disclaims proven market demand, revenue, or production adoption; §6.11/§6.12 introduce no evidentiary claim beyond what Chapters 1–5 and this chapter's own RQ/benchmark sections already establish |

## Chapter 5 cross-reference correction (task item 17)

The Stage T6 audit found two dangling references into Chapter 5's pre-rewrite section numbers (old §5.1.1, old §5.2). This rewrite uses only section numbers that exist in the current, promoted `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md` (confirmed via `grep -n "^## \|^### "` this session):

| Chapter 6 reference | Points to | Confirmed to exist in current Chapter 5? |
|---|---|---|
| "Chapter 5, §5.5" (internal benchmark) | `## 5.5 Internal Controlled Benchmark` | Yes |
| "Chapter 5, §5.5.1" (RQ4 boundary) | `### 5.5.1 RQ4 Boundary` | Yes |
| "Chapter 5, §5.5.2" (superseded benchmark) | `### 5.5.2 A Superseded, Disqualified Benchmark` | Yes |
| "Chapter 5, §5.7" (real-world technical validation) | `## 5.7 Real-World Repository Technical Validation` | Yes |
| "Chapter 5, §5.3" / "§5.3.5" (test suite / research-data integrity tests) | `## 5.3 Automated Test Suite`, `### 5.3.5 Research-Data Integrity Tests` | Yes |
| "Chapter 5, §5.9" (limitations of technical evaluation) | `## 5.9 Limitations of Technical Evaluation` | Yes |

No reference to a "§5.1.1 circularity disclosure" or a "§5.2 tool comparison table" appears anywhere in the new Chapter 6 — the old Chapter 2/6.2.1-era tool-comparison discussion is not part of the required 6.1–6.11 structure and was not recreated; the circularity disclosure is covered directly in §6.4.2 with a pointer to the current §5.5.

## Stale-claim sweep (final check)

| Term / claim | Found in `CHAPTER_06_RESULTS_AND_CONCLUSION.md`? |
|---|---|
| "No large-scale repository evaluation was conducted" | No — §6.4.1 states plainly the 21-repository evaluation **was** conducted, with matching numbers throughout; the internal contradiction identified at Stage T6 does not recur |
| "23 of the 25 rules... not yet re-verified / stale" | No — §6.3 and §6.10 both state the current 50-rule catalogue directly; no reference to the old 25-rule figure appears anywhere except this traceability document's own historical note |
| "15 repositories" as a current total | No — always "21 (15 primary + 6 additional)" |
| "80–100" as a current participant count | No — appears once in §6.6, explicitly as the superseded historical baseline, not the current target |
| "8 rules" / "25 rules" as current catalogue size | No |
| "96.15%" / "98.04%" | No |
| Gemini-only remediation/provider wording | No — §6.9 explicitly names Ollama, Claude, and Gemini with the real precedence/fallback order |
| Qwen as a standalone current provider | No — not mentioned anywhere in Chapter 6 (correctly; it is an Ollama model tag, not a provider, and Chapter 6 does not need this level of implementation detail) |
| "Vue regex-only" | No |
| "WCAG 2.2 AA" / full WCAG compliance | No — §6.3 and §6.8 (Construct Validity) both explicitly disclaim AA-level and full conformance, replacing the old wording's meaning with a properly scoped "statically detectable subset" statement rather than deleting the accessibility discussion |
| "Core Web Vitals" as a static-rule validation claim | No — §6.2.4 and §6.8 (Construct Validity) explicitly separate the two |
| "ISO verified" | No |
| "Production SaaS" | No |
| Completed RQ4 accuracy claim | No — §6.5 states `PENDING` plainly, with the exact protocol status (67 cases, 1,717 rows, 0 submissions) |
| Fabricated human-study result (SUS score, demographics, task performance, qualitative themes) | No — §6.6 states 0/20 collected and names only the verified-formula/synthetic-pipeline-test status |
| Dangling "Chapter 5, §5.1.1" / "§5.2" cross-reference | No — see cross-reference correction table above |
| Unverified/new IEEE reference | No — this chapter reuses existing verified references [2] (WCAG 2.2) and [23] (Lighthouse) only; no new citation was introduced |

All clear.

## Self-audit

```
CHAPTER_6_STRUCTURE_ALIGNMENT=PASS
RQ1_RESULT_ALIGNMENT=PASS
RQ1_PRIMARY_REPLICATION_SEPARATION=PASS
RQ2_RESULT_ALIGNMENT=PASS
RQ3_RESULT_ALIGNMENT=PASS
RQ4_STATUS_ALIGNMENT=PASS
HUMAN_STUDY_STATUS_ALIGNMENT=PASS
INTERNAL_BENCHMARK_RQ4_SEPARATION=PASS
STATIC_RUNTIME_BOUNDARY=PASS
WCAG_SCOPE_BOUNDARY=PASS
GEMINI_ONLY_STALE_WORDING_REMAINING=0
CHAPTER5_DANGLING_REFERENCES=0
THREATS_TO_VALIDITY_ALIGNMENT=PASS
CONTRIBUTION_CLAIMS=PASS
CONCLUSION_PROPORTIONALITY=PASS
STALE_NUMERIC_CLAIMS=0
RQ4_OVERCLAIMS=0
HUMAN_STUDY_OVERCLAIMS=0
UNVERIFIED_REFERENCES_USED=0
UNRESOLVED_CHAPTER_6_ISSUES=0
CHAPTER_6_READY_FOR_REVIEW=YES
```

Basis for each field: structure matched the required 6.1–6.11 layout exactly as approved at Stage T6 (verified via header grep at that time; the chapter was subsequently extended to 6.1–6.15 at the Stage T6-University-Alignment pass below, without altering any of the content this paragraph describes); RQ1 reports exact PRIMARY/REPLICATION values with explicit no-pooling language; RQ2/RQ3 match canonical evidence exactly (re-verified fresh this session); RQ4 states PENDING with the real protocol status, no external figure; human-study section states the real 0/20 status, no fabricated result; the internal benchmark is explicitly separated from RQ4 in three enumerated non-substitute statements; the static/runtime and WCAG-scope boundaries are stated as explicit non-claims in both the RQ sections and Threats to Validity; a grep pass confirmed zero occurrences of Gemini-only wording, zero dangling old-Chapter-5 section references, zero unqualified WCAG-AA/ISO/full-conformance claims, and zero new/unverified references (only [2] and [23], both pre-existing and verified, are cited). No known issue from the Stage T6 audit's stale-claim inventory or headline findings 1–5 remains unaddressed in this rewrite; headline finding 6 (the exporter clobbering risk) was resolved separately at Stage T6A and is unaffected by this content rewrite.

## University Guide Structural Alignment (Stage T6 — University Alignment)

The university dissertation guide requires the concluding chapter to explicitly contain sections not present in the original 6.1–6.11 structure above: Accomplishment of the Research Objectives (with triangulation and use of the testing chapter's outcomes), Problems Encountered, Self-Reflection (with Research Ideology, Benefits Gained, and Learning Curves subsections), Business Insight (with a Real-World Application Possibilities subsection), and Future Recommendations. `CHAPTER_06_RESULTS_AND_CONCLUSION.md` was restructured to 6.1–6.15 to satisfy this without discarding any previously-validated evidence:

| New/renamed section | Requirement satisfied | Content origin |
|---|---|---|
| 6.7 Accomplishment of the Research Objectives | §2.1 of the guide | New synthesis section; triangulates Chapter 1 §1.7's four objectives against Chapter 5 testing evidence, §6.2 (RQ1), §6.4.1 (real-world corpus), §6.4.2 (internal benchmark), and Chapters 3–4 (model/rule implementation). No new numeric claim; Objective 4 (RQ4) is explicitly stated as not yet accomplished. |
| 6.8 Threats to Validity | (renumbered only, from old §6.7; content unchanged) | — |
| 6.9 Research Contributions | (renumbered only, from old §6.8; content unchanged) | — |
| 6.10 Limitations | (renumbered only, from old §6.9; content unchanged) | — |
| 6.11 Problems Encountered | §2.2 of the guide | New section; eight items, each traced to evidence already established elsewhere in this dissertation (heterogeneous parsing, framework-gated rule applicability, real-world parse errors, the framework-agnostic-abstraction-vs-implementation tension, RQ1 environment limitations, RQ4/human-study collection status). No invented or dramatized problem. |
| 6.12 Self-Reflection (6.12.1 Research Ideology, 6.12.2 Benefits Gained, 6.12.3 Learning Curves) | §2.3, §2.3.1, §2.3.2, §2.3.3 of the guide | New section; reflective/qualitative content only, grounded in this dissertation's own documented design decisions (deterministic-first remediation, reproducibility practices, the static/runtime and internal/external validation distinctions) and this project's own audit-trail history (stale-figure corrections, the Stage T6A entry-guard bug). No fabricated personal achievement. |
| 6.13 Business Insight and Real-World Application (6.13.1 Real-World Application Possibilities) | §2.4, §2.4.1 of the guide | New section; lists potential applications (pre-commit tool, IDE integration, CI/CD gate, code-review support, accessibility/performance screening, educational use, enterprise standards enforcement) explicitly framed as potential, with an explicit disclaimer against claiming proven market demand, revenue, or production adoption. |
| 6.14 Future Recommendations | §2.5 of the guide (renamed only, from old §6.10 Future Work; all 9 items retained verbatim) | — |
| 6.15 Concluding Remarks | (renumbered only, from old §6.11; two internal cross-references updated from "§6.9"/"§6.10" to "§6.10"/"§6.14" to match the new numbering, plus one added clause acknowledging §6.13; no other content change) | — |

All numeric/status values enumerated in the task's preservation list (RQ1 PRIMARY/REPLICATION exact values, Batch 1/Batch 2 separation, 21 repositories, 2,512 files, 117 parse errors, 0 crashes, 2,649 findings, 393/1,578/678, 36/50, the 50-rule model, TP=65/FP=0/FN=0, 100/100/100, RQ4=PENDING, 67 cases/1,717 rows, human-study actual 0/20, the WCAG 2.2-aligned statically detectable subset wording, React/Next.js/Angular primary with Vue additional, and the Ollama/Claude/Gemini provider architecture) were re-grepped against the restructured file after editing and confirmed present with unchanged occurrence counts (9 RQ1-value matches, 17 corpus/benchmark-value matches, 13 status/architecture-wording matches — see the verification command run this session).

### Self-audit (university-alignment pass)

```
UNIVERSITY_CONCLUDING_STRUCTURE_ALIGNMENT=PASS
OBJECTIVE_ACCOMPLISHMENT_SECTION=PASS
TRIANGULATION_WITH_TESTING_CHAPTER=PASS
PROBLEMS_ENCOUNTERED_SECTION=PASS
SELF_REFLECTION_SECTION=PASS
RESEARCH_IDEOLOGY_SECTION=PASS
BENEFITS_GAINED_SECTION=PASS
LEARNING_CURVE_SECTION=PASS
BUSINESS_INSIGHT_SECTION=PASS
REAL_WORLD_APPLICATION_SECTION=PASS
FUTURE_RECOMMENDATIONS_SECTION=PASS
RQ4_PENDING_PRESERVED=YES
NUMERIC_INTEGRITY=PASS
READY_FOR_REVIEW=YES
```

Basis: all six required top-level headings (§2.1–§2.5, per the guide's own numbering) now have a directly corresponding, explicitly-titled section in `CHAPTER_06_RESULTS_AND_CONCLUSION.md` (§6.7, §6.11, §6.12 with its three required subsections, §6.13 with its required subsection, §6.14); §6.7 draws on five named evidence sources (Chapter 5 testing evidence, the RQ1 experiment, the real-world evaluation, the internal benchmark, and model/rule implementation evidence) rather than one, satisfying the triangulation requirement; §6.7's own text states Objective 4 (RQ4) is not accomplished, and §6.5/§6.10/§6.11 all independently confirm RQ4 remains PENDING elsewhere in the same chapter, so `RQ4_PENDING_PRESERVED=YES`; the full protected-value re-grep (above) confirms no numeric or status value in the preservation list was altered, so `NUMERIC_INTEGRITY=PASS`. This chapter has not been re-promoted to `docs/dissertation/` as part of this pass, per instruction.

## Historical note (not part of Chapter 6 itself)

For context only: the pre-rewrite Chapter 6 (`docs/dissertation/chapter6_conclusion.md`, archived at promotion time) contained a self-referential note claiming the "23 of the 25 rules" figure had "not yet been re-verified" against the 50-rule catalogue, while a later section of that same file had already performed that exact correction — a Chapter-6-internal contradiction identified at Stage T6 (`CHAPTER_06_RESULTS_CONCLUSION_AUDIT.md`, headline finding 2). This rewrite does not carry forward either the stale note or the self-correcting note; it states the current 50-rule reality directly, once, consistent with Chapter 4.
