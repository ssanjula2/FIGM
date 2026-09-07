# CHAPTER 6: Results, Validity, and Conclusion

## 6.1 Chapter Overview

This chapter synthesizes and interprets the empirical evidence gathered in the course of this research, answers the four research questions (Chapter 1, §1.4), reports the current status of the supplementary developer usability study, discusses threats to validity, states this dissertation's contributions and limitations, and closes with directions for future work. It is an interpretation chapter, not a testing chapter: the automated test suite, the internal controlled benchmark's technical verification, representative test cases, and build/type-check evidence are reported once, in Chapter 5, and are referenced here rather than repeated.

## 6.2 RQ1 — Rendering and State-Management Performance Results

**RQ1:** *How do different SPA render and state-management strategies influence performance metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?*

**Method, briefly** (full protocol: Chapter 3, §3.4). A 2×2 factorial design (rendering strategy: CSR/SSR × state-management strategy: LOCAL/GLOBAL) was executed against a controlled Next.js/React fixture (50 simple cards, no external data fetching), 1 warm-up run plus 10 measured runs per condition, using Lighthouse 12.8.2 [23] under its real desktop-throttling preset — 44 real headless-Chrome executions per collection run, 0 failures.

### 6.2.1 PRIMARY dataset (Batch 1, `research-freeze-v1`, collected 2026-09-03, committed)

This is the dataset cited as this dissertation's RQ1 result. Values are exact, taken directly from `research/thesis/THESIS_BLOCKER_RESOLUTION.md`.

| Condition | FCP mean (ms) | FCP SD | TTI mean (ms) | TTI SD |
|---|---|---|---|---|
| CSR_LOCAL | 447.48 | 2.51 | 480.68 | 7.78 |
| CSR_GLOBAL | 444.19 | 2.47 | 475.59 | 5.08 |
| SSR_LOCAL | 444.19 | 2.03 | 476.69 | 6.34 |
| SSR_GLOBAL | 444.78 | 1.85 | 477.98 | 8.70 |

Observed mean FCP ranges 444.19–447.48ms and mean TTI ranges 475.59–480.68ms across the four conditions. The largest FCP gap between any two conditions (CSR_LOCAL vs. CSR_GLOBAL, 3.29ms) is comparable to CSR_LOCAL's own FCP standard deviation (2.51ms); the largest TTI gap (CSR_LOCAL vs. CSR_GLOBAL, 5.09ms) is smaller than CSR_LOCAL's own TTI standard deviation (7.78ms). Read plainly: the four conditions are close to indistinguishable on this fixture, at this scale, in this environment.

### 6.2.2 REPLICATION dataset (Batch 2 / "Stage 9", `research-freeze-v5` environment baseline, currently uncommitted)

A second collection run, under the same frozen protocol and the same four conditions, was performed separately and is reported here as replication evidence only — it is **not pooled** with the PRIMARY dataset above, and no claim in this dissertation is computed by combining the two.

| Condition | FCP mean (ms) | FCP SD | TTI mean (ms) | TTI SD |
|---|---|---|---|---|
| CSR_LOCAL | 439.85 | 2.52 | 464.45 | 4.43 |
| CSR_GLOBAL | 441.58 | 9.35 | 463.98 | 9.03 |
| SSR_LOCAL | 438.80 | 1.26 | 463.30 | 4.35 |
| SSR_GLOBAL | 438.78 | 2.06 | 464.48 | 4.80 |

The replication run shows the same qualitative pattern (all four conditions cluster tightly, differences on the order of each condition's own SD) at slightly lower absolute FCP/TTI values, consistent with a different measurement environment rather than a different underlying effect. It corroborates, rather than contradicts, the PRIMARY dataset's conclusion.

### 6.2.3 Interpretation, stated within its disclosed scope

**Status: ANSWERED, narrow disclosed scope.** Under the specific controlled fixture and environment described above, CSR-vs-SSR and LOCAL-vs-GLOBAL differences in FCP and TTI are small and each within the range of run-to-run variance observed for a single condition. **No statistical significance test is computed or claimed anywhere in this dissertation** — the current protocol does not define one, and this result is descriptive statistics only. No causal claim beyond the controlled design is made, and no inferential superiority of one rendering or state-management strategy over another is claimed. This result must not be generalized to Angular (no Angular RQ1 runtime fixture exists — a disclosed scope decision, Chapter 1 §1.7), to applications materially more complex than the 50-card fixture, or to environments other than the one measured. Full raw and processed data: `research/rq1-experiment/raw-results/`, `research/rq1-experiment/processed-results/`.

### 6.2.4 Static/runtime boundary

The FCP/TTI figures above are the only Core Web Vitals-adjacent runtime measurements reported in this dissertation, and they come exclusively from this RQ1 experiment. FIGM's own static performance rules (RQ3 below, and the internal controlled benchmark) identify **source-level performance-risk patterns** — code shapes the rule specification flags as risk-prone for render or paint cost, by static rule design, not by a statistical association study — not runtime measurements. "Core Web Vitals" is not used anywhere in this dissertation as a validation label for the static rule set, and no static-scan finding is presented as though it were a measured FCP, TTI, or other Core Web Vitals value.

## 6.3 RQ2 — Framework-Agnostic Guideline Model Outcomes

**RQ2:** *What framework-agnostic architectural and accessibility patterns can be identified and standardized to improve the performance and accessibility of modern SPAs in compliance with WCAG 2.2 guidelines?*

**Status: ANSWERED, on existing evidence.** This research identified and formalized 19 architecture patterns and 7 accessibility patterns (26 of the 50 canonical rules; the remaining 24 are static-performance patterns, belonging to the static-analysis/model evaluation strand addressed under RQ3 and the internal controlled benchmark — not under RQ1, which is a separate, runtime FCP/TTI experiment, §6.2) as canonical, executable rules of the **Framework-Agnostic Guideline Model (FIGM)**, `ruleSetVersion 2.1.0`, 50 rules total. The rules are organized through a four-layer abstraction (Domain → Concern → Abstract Language Primitive → Rule; Chapter 3, §3.3) that maps heterogeneous JSX, Angular template, and Vue SFC constructs onto canonical AST primitives, giving the model its framework-agnostic character without requiring a shared syntax across frameworks. Full formalization detail is Chapter 3's and Chapter 4's; it is not repeated here.

**Framework scope**, held consistently throughout this dissertation: **primary research frameworks** are React, Next.js, and Angular; **Vue.js is additional implementation support**, demonstrating the model generalizes beyond the three primary frameworks without being presented as a fourth primary research target.

Each of the 7 accessibility rules carries an explicit, per-rule WCAG 2.2 [2] Success Criterion mapping with a stated detectability classification (`DIRECT_STATIC_CHECK` / `PARTIAL_STATIC_CHECK` / `HEURISTIC` / `MANUAL_REVIEW_REQUIRED` / `NOT_SUPPORTED`; Chapter 3, §3.3.4). This is described precisely as a **WCAG 2.2-aligned, statically detectable subset** — this dissertation does not claim full WCAG 2.2 conformance, does not claim WCAG 2.2 AA conformance, and does not claim any form of ISO verification, for FIGM itself or for any codebase it scans.

## 6.4 RQ3 — Real-World Repository Evaluation

**RQ3:** *How effectively can an automated static analysis validation tool detect architectural and accessibility violations in SPA source code before application deployment?*

**Status: ANSWERED, on existing evidence, with explicit caveats.**

### 6.4.1 Real-world corpus execution

FIGM's real, compiler-derived static AST pipeline (TypeScript Compiler API, `angular-html-parser`, `@vue/compiler-sfc`/`@vue/compiler-dom`, depending on rule and framework — Chapter 4) was executed against a frozen, 21-repository real-world corpus:

| Composition | Count |
|---|---|
| React (primary) | 5 |
| Next.js (primary) | 5 |
| Angular (primary) | 5 |
| Vue (additional) | 3 |
| Generic JavaScript/TypeScript (additional) | 3 |
| **Total** | **21** |

| Metric | Value |
|---|---|
| Files scanned | 2,512 |
| Total LOC | 320,367 |
| Files with parse errors | 117 |
| Engine crashes | 0 |
| Total findings | 2,649 |
| — Architecture | 393 |
| — Static Performance | 1,578 |
| — Accessibility | 678 |
| Distinct rules triggered | 36 of 50 |

(Source: `benchmarks/real-world/raw-results/_combined-summary.json`, `domain-summary.json`, `rule-frequency-summary.json`, `repository-manifest.json`.)

**Interpreted as evidence of:**
- **Execution across real repositories**: the pipeline ran to completion on all 21 repositories without a single engine crash, across 2,512 files and 320,367 lines of code it was not built or tuned against.
- **Parser robustness**: 117 files (4.7% of those scanned) produced parse errors, and the engine degraded gracefully on every one rather than crashing or aborting the run — consistent with Chapter 4's documented error-tolerant parsing design.
- **Rule activity and coverage**: 36 of the 50 canonical rules fired at least once on unmodified, real-world code, across all three research domains (Architecture, Static Performance, Accessibility) and across every framework in the corpus.
- **Cross-framework practical applicability**: findings were produced on React, Next.js, and Angular repositories (the primary frameworks) and on Vue and generic JavaScript/TypeScript repositories (additional implementation support), demonstrating the four-layer model's cross-framework applicability in practice, not only in specification.

**Explicit non-claims**: this corpus has **no independent ground truth**, so **no Precision, Recall, F1-score, or external accuracy figure is computed or implied from it**. A small (n=18), purposively diverse manual spot-check exists (`benchmarks/real-world/SPOT_CHECK.md`) and is explicitly documented there as too small to generalize into any accuracy statistic; it is not used as one here. The 14 rules that did not trigger on this corpus should be read as "not observed in this specific 21-repository sample," not as "non-functional" — Chapter 5's fixture-based benchmark (below) demonstrates all 50 rules detect their own designed violation.

### 6.4.2 Internal controlled benchmark (technical validation only)

Where this dissertation refers to FIGM's own detection accuracy against hand-labelled ground truth, the figure is the internal controlled fixture benchmark reported and technically verified in Chapter 5, §5.5:

| Metric | Value |
|---|---|
| True Positives (TP) | 65 |
| False Positives (FP) | 0 |
| False Negatives (FN) | 0 |
| Precision | 100% |
| Recall | 100% |
| F1-Score | 100% |
| Rule coverage | 50 / 50 |

This is consistently qualified throughout this dissertation as an **internal controlled fixture benchmark**, not an external accuracy result, for the reasons stated plainly in Chapter 5, §5.5 and repeated here because they bound how RQ3 (and, by explicit contrast, RQ4 below) may be read:

- The fixtures in `benchmarks/testbed/` and the hand-labels in `benchmarks/ground-truth.json` were both authored by this project, not by an independent third party.
- The 100% figures are a genuine, reproducible measurement of internal consistency between each detector and its own formal specification (Chapter 3, §3.3.3) — not independent external validation that FIGM correctly handles real-world code it was not built and tuned against.
- **This result is never used as evidence toward RQ4** (§6.5 below; Chapter 5, §5.5.1). Full technical detail, including the superseded 96.15%/98.04%/25-of-50 figure this benchmark replaced and why, is Chapter 5's (§5.5.2) and is not repeated here.

## 6.5 RQ4 — Independent Expert Validation Status

**RQ4:** *To what extent does the proposed validation tool achieve acceptable accuracy levels when compared with manual expert architectural reviews using Precision, Recall, and F1-score measurements?*

**Status: PENDING. No final answer is claimed.**

Independent expert architectural review is a mandatory component of this research question, not an optional validation step. The current state:

- The independent-expert-annotation protocol is **complete and frozen**: a blinded annotation package exists (`research/independent-annotation/`), covering **67 cases** and **1,717 case×rule judgement rows**, with VIOLATION/NO_VIOLATION/AMBIGUOUS labelling (AMBIGUOUS excluded from any future TP/FP/FN computation).
- **No real independent expert submission has been received** (`research/independent-annotation/results/STATUS.md`, re-verified at the time of writing: 0 files in `submissions/`).
- Therefore, **no external Precision, Recall, or F1-score result is available for RQ4**, and none is stated anywhere in this dissertation.

This is not softened into a completed result. Three sources that might appear related are explicitly **not** substitutes for RQ4, and none is presented as answering it:

1. The internal controlled fixture benchmark (§6.4.2) — self-fulfilling by construction, since the tool is compared against its own authors' labels.
2. The real-world repository scan (§6.4.1) — has no independent ground truth at all.
3. The supplementary human usability study (§6.6) — measures perceived usability, not detection accuracy, and answers a different question entirely.

## 6.6 Supplementary Human Usability Study

A developer usability study is a supplementary component of this research, distinct from and not a substitute for RQ4. Its target is **20 real participants (P001–P020)**, reduced from an original historical baseline of 80–100 documented in the Research Proposal and Interim Submission 02, by a later, approved research-scope decision (`docs/research/PARTICIPANT_TARGET_DECISION.md`).

**Current, actual, verified collection state** (`research/analysis/usability-results.json`, re-checked at the time of writing): **0 of the target 20 real participants have been collected** (`collectionStatus: NOT_COLLECTED`). The target sample size is not the actual sample size, and this dissertation does not conflate the two.

No fabricated SUS score, participant demographics, task-performance measurement, or qualitative theme is reported for this study, because none has been collected. What does genuinely exist and has been verified:

- The consent-gated data-collection pipeline, participant-eligibility logic, and questionnaire-scoring formulas are implemented and tested (Chapter 4, §4.10; Chapter 5, §5.3.5).
- The scoring pipeline's formulas have been verified against a synthetic pipeline-test data vector, explicitly and consistently labelled `SYNTHETIC_PIPELINE_TEST_DATA` wherever it appears in this dissertation, and never presented as a real result.

The correct, honest characterization of this component of the research at the time of writing is: **prepared and ready to collect real data, not yet empirically completed.**

## 6.7 Threats to Validity

### Internal Validity
- The RQ1 experiment used a fixed, controlled fixture and a fixed protocol (1 warm-up + 10 measured runs per condition, identical Lighthouse desktop-throttling configuration across all four conditions), reducing confounds from inconsistent measurement setup.
- All 44 executions per collection run ran within a single machine/environment session; environmental effects (background load, thermal throttling, OS scheduling variance) were not independently controlled for or measured, and are a plausible partial explanation for the run-to-run variance (SDs of 1.85–8.70ms) observed within each condition.
- Static-rule detection is deterministic given a fixed rule catalogue version (`ruleSetVersion 2.1.0`) and a fixed input file, removing execution-order or randomness-related confounds from the internal benchmark and the real-world scan.

### External Validity
- The real-world evaluation corpus (21 repositories: React 5, Next.js 5, Angular 5, Vue 3, Generic JS/TS 3) is not a random or statistically representative sample of the SPA ecosystem; generalization beyond these specific, pinned-commit repositories and their particular coding conventions is not established.
- Findings generalize most confidently to the primary research frameworks (React, Next.js, Angular); Vue is additional implementation support, and results on Vue/generic repositories should be read as evidence of cross-framework applicability, not as claims with the same evidentiary weight as the primary-framework results.
- The RQ1 experiment used one specific synthetic fixture (50 simple cards, no external data fetching); generalization to applications with materially different complexity, data-fetching patterns, or third-party dependency load is not established, and no Angular RQ1 runtime fixture exists (a disclosed scope decision, not an oversight).

### Construct Validity
- FIGM's static performance rules identify source-level performance-risk patterns, by static rule design; they are a distinct construct from — and are not presented as measuring — Core Web Vitals or any other runtime performance metric, and no statistical association study underlies them. The only runtime performance construct measured in this dissertation is RQ1's FCP/TTI experiment (§6.2), which is kept structurally separate from the static rule findings throughout.
- FIGM's accessibility rules operationalize a **statically detectable subset** of WCAG 2.2 Success Criteria (Chapter 3, §3.3.4); this is a narrower construct than "WCAG 2.2 conformance" or "WCAG 2.2 AA conformance," and this dissertation does not claim either the broader or the AA-specific construct anywhere.
- The internal controlled benchmark's ground truth is researcher-authored (§6.4.2), so it measures the construct "internal consistency between detector and specification," not the construct "real-world detection accuracy" — the latter is what RQ4 (§6.5) asks for and what remains pending.

### Conclusion Validity
- RQ1's conclusion is descriptive only: reported differences between conditions are of the same order as each condition's own standard deviation, and no inferential significance test exists in the current protocol to determine whether an observed difference reflects a real underlying effect or measurement noise. The conclusion drawn (§6.2.3) is deliberately limited to "differences are small and within measurement variance," not "the conditions perform equivalently" or "one condition is superior," to avoid over-generalizing from four sets of ten means.
- RQ3's real-world findings (§6.4.1) support conclusions about execution robustness, parser tolerance, and rule activity, but do not support any accuracy conclusion, precisely because no ground truth exists to validate a finding as a true or false positive.

### Reproducibility
- The RQ1 protocol and environment are frozen and tagged (`research-freeze-v1` for the PRIMARY dataset; `research-freeze-v5` as the environment baseline for the REPLICATION dataset).
- Every real-world corpus repository is pinned to a specific commit (`repository-manifest.json`'s `pinnedCommit` field per repository), so the corpus itself is reproducible independent of upstream repository changes.
- The rule catalogue is versioned (`ruleSetVersion 2.1.0`), so a future re-run can be checked against the exact specification version this dissertation reports against.
- The RQ4 independent-annotation package is itself frozen (v1.1), so future real annotator submissions will be scored against the same fixed case set this dissertation describes, not a moving target.

## 6.8 Research Contributions

This research makes the following contributions, each stated at the level of evidence actually available:

1. **The Framework-Agnostic Guideline Model (FIGM)**: a four-layer abstraction (Domain → Concern → Abstract Language Primitive → Rule) that expresses architectural, static-performance, and accessibility guidelines independently of any one framework's syntax (Chapter 3).
2. **A 50-rule executable detection catalogue** (`ruleSetVersion 2.1.0`), spanning Universal, Next.js, React, Angular, and Vue rule families, each rule backed by a real, compiler-derived AST detector for at least one supported framework (Chapter 4).
3. **A multi-framework static validation engine** with real-AST parsing per framework (TypeScript Compiler API, `angular-html-parser`, `@vue/compiler-sfc`/`@vue/compiler-dom`), demonstrated to execute without crashing across a 21-repository, 320,367-LOC real-world corpus (§6.4.1).
4. **A verified, deterministic-first remediation workflow**: AST-deterministic fixing attempted before AI assistance, a small, explicitly-scoped manual-review-only rule set, and an unconditional re-scan gate that only reports a fix as verified once the original violation is confirmed gone — currently backed by three configurable AI providers (Ollama, Claude, Gemini, with a documented precedence and fallback order; Chapter 4, §4.6–4.8) rather than a single hardcoded provider.
5. **A controlled RQ1 rendering/state-management experiment**, executed twice under a frozen protocol (PRIMARY and REPLICATION datasets), reporting real, descriptive FCP/TTI evidence (§6.2).
6. **A 21-repository real-world evaluation**, demonstrating execution robustness, parser tolerance, and cross-framework rule activity on unmodified, real, pinned-commit codebases (§6.4.1).
7. **Reproducible research artifacts**: frozen experiment baselines, a versioned rule catalogue, a frozen independent-expert-annotation package, and a documented audit trail (`docs/audit/`) tracing every reported figure to the command or file that produced it.

This dissertation does **not** claim: universal correctness of FIGM's detections on arbitrary SPA code; full WCAG compliance (2.2 or any level) for FIGM or for scanned applications; external detection accuracy while RQ4 remains pending; or comprehensive support for every SPA framework in current use (Svelte and SolidJS are explicitly unsupported at the time of writing — Chapter 4).

## 6.9 Limitations

1. **Static-analysis boundary**: FIGM performs syntactic, AST-level detection; it does not perform full semantic or data-flow analysis (e.g., cross-function value tracing, whole-program alias analysis), so violations requiring that depth of reasoning are out of scope by design, not by omission.
2. **Framework-gated rule applicability**: coverage is not uniform across frameworks — a small number of universal rules (e.g. FIGM-A11Y-01, FIGM-A11Y-03, FIGM-PERF-01, FIGM-PERF-02, FIGM-PERF-03) still fall back to an earlier text-heuristic detector specifically on Vue SFC and/or Angular template files, even though every rule is real-AST-covered on at least one framework (Chapter 4; Chapter 5, §5.9).
3. **Accessibility subset**: the 7 accessibility rules cover a statically detectable subset of WCAG 2.2 Success Criteria; manual-review-required and heuristic-only criteria are explicitly out of scope, and no conformance level is claimed.
4. **Real-world parser tolerance, not perfect parsing**: 117 of 2,512 real-world files (4.7%) produced parse errors; the engine degraded gracefully in every case, but this is a genuine, measured limitation of the current parsing layer against unmodified real-world code, not zero.
5. **Partial rule activity in the real-world corpus**: only 36 of 50 rules were observed triggering across the 21-repository sample; this may reflect genuine absence of the corresponding pattern in this specific corpus, limited corpus diversity, or both — this dissertation does not resolve which, and does not claim the 14 non-triggering rules are non-functional (they are demonstrated functional in Chapter 5's fixture benchmark).
6. **Internal benchmark circularity**: the 100%/100%/100% internal benchmark result is measured against researcher-authored fixtures and researcher-authored ground truth, and is explicitly not independent validation (§6.4.2).
7. **RQ1 is descriptive only**: no inferential statistical test exists in the current protocol; conclusions are limited to observed means and standard deviations, not statistical significance.
8. **RQ4 is pending**: no real independent expert submission has been received at the time of writing (§6.5).
9. **Human usability study**: 0 of the target 20 real participants collected at the time of writing (§6.6).
10. **Vue's role**: Vue.js is additional implementation support demonstrating generalizability, not a primary research framework with the same evidentiary depth (e.g., no RQ1 runtime fixture) as React, Next.js, or Angular.

These are stated as genuine, honestly-scoped boundaries of the current research, not as failures of the work completed within that scope.

## 6.10 Future Work

1. **Complete RQ4**: recruit qualified, independent architectural reviewers to annotate the existing 67-case, 1,717-row frozen package, so RQ4 can be answered from genuine expert-comparison data.
2. **Complete the supplementary human usability study**: collect real responses toward the target of 20 participants (`npm run research:user-study:import`), so genuine SUS results and, where methodologically appropriate, reliability statistics can be reported.
3. **Broaden the real-world corpus** beyond 21 repositories, and beyond the current mix of frameworks and project scales, to reduce the corpus-diversity uncertainty noted in Limitation 5.
4. **Broader framework support**, extending the four-layer model and its AST builders to frameworks currently unsupported (e.g. Svelte, SolidJS).
5. **Deeper static semantic/data-flow analysis**, to close the syntactic-boundary limitation (Limitation 1) for rules that would benefit from cross-function or alias-aware reasoning.
6. **Broader accessibility coverage**, extending the statically detectable WCAG 2.2-aligned subset toward additional Success Criteria as static or hybrid detection techniques allow.
7. **Improved parser coverage**, to reduce the 4.7% real-world parse-error rate observed in this evaluation.
8. **Improved remediation coverage and an independent AI-provider/remediation benchmark**: run the verified remediation pipeline against a full, reproducible defect corpus (not only one canonical example per rule) to report a genuine aggregate success-rate statistic, and evaluate the Ollama/Claude/Gemini providers independently of one another rather than only as a single fallback chain.
9. **Additional RQ1 runtime experiments**: a larger measured-run count, and, if a future cross-framework runtime comparison is desired, an Angular RQ1 fixture.

Work already completed in this dissertation (the 21-repository real-world evaluation, the four-layer model's formalization, the verified re-scan-gated remediation architecture) is not re-listed here as future work.

## 6.11 Concluding Remarks

This research designed, implemented, and empirically evaluated the Framework-Agnostic Guideline Model (FIGM): a four-layer abstraction expressing 50 architectural, static-performance, and accessibility rules independently of a single framework's syntax, backed by real, compiler-derived static analysis and a verified, re-scan-gated remediation pipeline. Of the four research questions this dissertation set out to answer, three (RQ1, RQ2, RQ3) are answered on the evidence gathered, each within an explicitly disclosed scope; the fourth (RQ4, independent expert validation) has a complete, frozen protocol but remains pending genuine external submissions, and is reported honestly as such rather than answered by proxy by the internal benchmark, the real-world scan, or the supplementary usability study — none of which measures what RQ4 asks. The real-world evaluation demonstrates the model executes robustly and generalizes in practice across the intended primary frameworks, with Vue as supporting evidence of broader applicability. What remains open — expert-validated accuracy and real participant usability data — is stated plainly in §6.9 and carried forward as the immediate priorities in §6.10.
