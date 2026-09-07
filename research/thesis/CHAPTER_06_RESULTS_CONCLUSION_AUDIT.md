# CHAPTER 6 — RESULTS, CONCLUSION & FUTURE WORK: EVIDENCE AUDIT

Stage T6. Audit only — no chapter rewrite performed in this document. Scope: `docs/dissertation/chapter6_conclusion.md` and `docs/dissertation/chapter6_user_study_and_validity.md`, checked against canonical Chapters 1–5, `THESIS_EVIDENCE_AUDIT.md`, `THESIS_BLOCKER_RESOLUTION.md`, `CANONICAL_CONTROLLED_BENCHMARK_RESOLUTION.md`, live repository state, and the university thesis guide's conclusion-chapter expectations.

---

## 0. Headline findings (read first)

1. **Confirmed internal contradiction (critical-issue A):** `chapter6_conclusion.md` line 18 states a large-scale repository evaluation "was not conducted... It remains future work (Section 6.4)," while the *same file's* §6.2 RQ3 answer (line 32) and §6.4 item 3 (line 64) both correctly report the completed 21-repository evaluation with matching numbers. This is a direct, unresolved self-contradiction — not a Chapter 4/5-vs-Chapter 6 drift, a Chapter-6-internal one.
2. **A second, distinct Chapter-6-internal contradiction (part of critical-issue B):** §6.1 item 2 (line 14) says the "23 of the 25 rules are real-AST" claim "has *not* been re-verified... should be treated as a known, not-yet-corrected stale figure," while §6.3 item 1 (line 51), later in the *same file*, already performs and states that exact correction ("all 50 canonical rules are detected via a genuine compiler-derived AST for at least one supported framework"). §6.1 item 2's own text is now itself the stale artifact.
3. **AI-provider architecture is stale (critical-issue B):** §6.1 item 3 (line 15) describes remediation as "Integrated Gemini... a genuine three-path architecture," with no mention of Ollama or Claude. This predates the Chapter 4 rewrite's confirmed 3-provider (Ollama/Claude/Gemini) architecture with `AI_PRIMARY_PROVIDER` precedence and Claude→Gemini→Ollama fallback.
4. **WCAG/Core Web Vitals overclaim (critical-issue C), still present, unresolved:** `chapter6_user_study_and_validity.md` line 44 states construct validity is "Aligned directly with **WCAG 2.2 AA** accessibility and **Core Web Vitals** performance standards." Neither claim is supported anywhere in the evidence base — no WCAG conformance *level* has been tested, and FIGM's static findings are not Core Web Vitals runtime measurements (that is RQ1's separate, disclosed-scope experiment).
5. **RQ4 and human-study reporting are both currently CORRECT** (critical-issues D and E): RQ4 is honestly reported as pending with 0 real submissions; the human study is honestly reported as 0/20 collected, synthetic pipeline-test data clearly labelled as such. No fabrication found in either area. These sections should be preserved in substance during the rewrite, not rewritten from scratch.
6. **New, urgent, cross-cutting risk found during this audit — not one of the original A–E items, but directly bears on the safety of any future Chapter 5/6 work:** `tests/research-gap-eval.test.ts` (line 102, part of the standard `npm test` run) calls `ThesisGapExporter.exportAllChapters()`, which **unconditionally overwrites both** `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md` **and** `docs/dissertation/chapter6_user_study_and_validity.md` on every full test run (`src/eval/thesis-gap-exporter.ts` lines 9, 109, 185). The freshly-promoted, hand-authored Chapter 5 was verified byte-identical to its `research/thesis/` source just before writing this audit (still safe as of now), but **the next `npm test` run — including one run for an unrelated reason during Chapter 6 work — will silently regenerate and clobber it, and will clobber whatever hand-authored Chapter 6 rewrite is promoted later.** This needs an explicit decision before Chapter 6 is rewritten and promoted; see §15.

> **STAGE T6A RESOLUTION (see §17 below for full detail): FIXED.** `ThesisGapExporter.exportAllChapters()` now takes an explicit output-directory parameter (default unchanged, for the one legitimate human-invoked export path); the test call site now targets a new `docs/generated/` artifacts directory; a dedicated regression-guard test (`tests/thesis-exporter-canonical-guard.test.ts`) proves canonical Chapter 5/6 files stay byte-identical across a test run. A second, deeper root cause was also found and fixed during verification: `src/eval/evaluation-runner.ts`'s own CLI auto-run guard used a substring check (`process.argv[1].includes('evaluation-runner')`) that spuriously matched `tests/evaluation-runner.test.ts`'s own path during `npm test`, firing the exporter's no-argument (canonical-writing) default from inside the test suite even after the first fix. This is now an exact-path check. A full `npm test` run after both fixes confirms 1531/1531 pass, 0 canonical-file mutation.
7. **Two dangling cross-references into Chapter 5**, created as a side effect of the Chapter 5 rewrite's renumbering, not by any Chapter 6 defect: `chapter6_conclusion.md` lines 32 and 52 both cite "Chapter 5, Section 5.1.1's circularity disclosure," and line 41 cites "Chapter 5, Section 5.2" for a tool-comparison table. The new `CHAPTER_05_TESTING_AND_EVALUATION.md` has no section numbered 5.1.1 (the circularity disclosure is now inline under §5.5) and no tool-comparison table at all (that content is not part of the Stage T5 structure and instead now lives in Chapter 2's Table 2.1). See §13.

None of these require code or production-data changes to fix in the chapter text itself (items 1–5, 7 are prose corrections); item 6 requires a decision the user should make before Chapter 6 rewrite/promotion.

---

## 1. Current Chapter 6 file inventory

| File | Format | Role |
|---|---|---|
| `docs/dissertation/chapter6_conclusion.md` | Markdown | Contributions (§6.1), RQ1–RQ4 answers (§6.2), Limitations (§6.3), Future Research (§6.4) |
| `docs/dissertation/chapter6_user_study_and_validity.md` | Markdown | Human usability study results (§6.5–§6.6, partly auto-generated), Threats to Validity (§6.7) |

No `.tex` file exists for Chapter 6 (confirmed via directory listing) — unlike Chapters 3–5, there is no parallel LaTeX artifact to preserve or leave untouched for this chapter.

---

## 2. Existing structure

`chapter6_conclusion.md`:
- 6.1 Summary of Dissertation Contributions (4 numbered items, item 4 has 3 sub-bullets)
- 6.2 Research Questions Revisited (RQ1–RQ4, each with a `Status:` line)
  - 6.2.1 Supplementary Technical Evaluation (preserved old RQ set, explicitly marked non-authoritative)
- 6.3 Limitations (4 numbered items)
- 6.4 Directions for Future Research (7 numbered items)

`chapter6_user_study_and_validity.md`:
- 6.5 [usability study narrative + Likert item table, partially shown — not fully re-read in this pass, unchanged from Stage T5 read]
- 6.6 [auto-generated block: `0/20 Valid Real Participants`, `NOT_COLLECTED`, `SYNTHETIC_PIPELINE_TEST_DATA` labels, "Formula Test Sample Size: 85 Profile Vectors" explicitly caveated as not a participant count]
- 6.7 Threats to Validity: Internal Validity (2 bullets), External Validity (1 bullet), Construct Validity (1 bullet) — **no Conclusion Validity subsection, no explicit reproducibility-limitations discussion**

---

## 3. Required final structure

The existing two-file, section-numbered structure is fundamentally sound and should be preserved rather than replaced wholesale — the numbering (6.1–6.7) and the file split (conclusion/contributions vs. user-study/validity) already match university thesis-guide conventions for a closing chapter. The rewrite should be a **targeted correction pass**, not a restructure:

1. 6.1 Summary of Dissertation Contributions — keep 4-item structure; fix items 2 and 3; remove the item-4-bullet-1 stale auto-regeneration description and item-4-bullet-2 contradiction.
2. 6.2 Research Questions Revisited — keep as-is in substance (already well-evidenced and proportionate); fix only the two dangling Chapter 5 cross-references (lines 32, 41).
3. 6.2.1 Supplementary Technical Evaluation — keep; fix the same line-41 cross-reference.
4. 6.3 Limitations — keep 4-item structure; fix item 1's "46 fixture files" figure (needs re-verification, §15) and item 2's dangling "§5.1.1" cross-reference; **resolve item 2 vs. §6.1-item-4 contradiction** by making Limitations item 2 consistent with the fact that a real-world evaluation *was* conducted (retitle from "No Large-Scale or Real-World Repository Evaluation" to something like "Real-World Evaluation Lacks Independent Ground Truth," keeping its accurate second half).
5. 6.4 Directions for Future Research — keep 7-item structure; already the most internally consistent section (item 3 correctly reports the 21-repo expansion); no fabrication found.
6. 6.5–6.6 Human Usability Study — keep; re-confirm the auto-generated block still matches live `usability-results.json` at rewrite time (it does as of this audit).
7. 6.7 Threats to Validity — fix the WCAG 2.2 AA / Core Web Vitals line; consider adding a brief Conclusion Validity subsection and an explicit reproducibility-limitations note (thesis-guide expectation; currently absent, not currently fabricated).

---

## 4. RQ1 evidence audit

`chapter6_conclusion.md` §6.2's RQ1 answer (line 28) cites: 4 conditions, 1 warm-up + 10 measured runs each, 44 executions, 0 failures, FCP range 444.2–447.5ms, TTI range 475.6–480.7ms, `research-freeze-v1` baseline, no significance test claimed, Angular exclusion explicitly disclosed as a scope decision.

Cross-checked against `THESIS_BLOCKER_RESOLUTION.md`'s canonical Batch 1 (PRIMARY) values, re-verified fresh this session:

| Condition | FCP mean | FCP SD | TTI mean | TTI SD |
|---|---|---|---|---|
| CSR_LOCAL | 447.48 | 2.51 | 480.68 | 7.78 |
| CSR_GLOBAL | 444.19 | 2.47 | 475.59 | 5.08 |
| SSR_LOCAL | 444.19 | 2.03 | 476.69 | 6.34 |
| SSR_GLOBAL | 444.78 | 1.85 | 477.98 | 8.70 |

FCP range across the four means: 444.19–447.48 → chapter's "444.2–447.5" is correct (rounded). TTI range: 475.59–480.68 → chapter's "475.6–480.7" is correct (rounded). **RQ1_RESULT_ALIGNMENT: PASS.** No pooling with Batch 2/replication data occurs; the chapter does not mention Batch 2 at all, which is acceptable under the canonical rule (Batch 1 is the cited dataset; Batch 2 need not be surfaced in Chapter 6) but is a place the rewrite *could* optionally add one sentence noting a replication batch exists, without changing the cited numbers — not required, flagged as optional only.

No static-scan-duration figure is conflated with FCP/TTI (line 28's last sentence explicitly separates the `/performance` page's scan-duration proxy from this experiment). No inferential statistics are claimed. **STATIC_RUNTIME_BOUNDARY for RQ1: PASS.**

---

## 5. RQ2 evidence audit

Line 29–30: 19 architecture + 7 accessibility patterns, sourced from `figm-spec.json` / `primaryResearchDomain()`, matching the canonical domain split (Architecture 19, Accessibility 7 — Performance's 24 is correctly excluded since RQ2's wording only covers "architectural and accessibility patterns"). WCAG mapping described with detectability classifications (`DIRECT_STATIC_CHECK`/`PARTIAL_STATIC_CHECK`/`HEURISTIC`/`MANUAL_REVIEW_REQUIRED`/`NOT_SUPPORTED`), and explicitly disclaims full WCAG 2.2 conformance. This is fully consistent with the canonical "WCAG 2.2-aligned, statically detectable subset" framing established in Chapters 3–5. **RQ2_RESULT_ALIGNMENT: PASS.** No "ISO verified" or full-WCAG claim found anywhere in either file.

---

## 6. RQ3 evidence audit

Line 32 cites the internal benchmark (correctly labelled self-fulfilling/circular, correctly pointed at Chapter 5) and the real-world corpus: 21 repositories (15 primary: React 5/Next.js 5/Angular 5; 6 additional: Vue 3/Generic 3), 2,512 files, 320,367 LOC, 0 engine crashes, 117 parse errors, 2,649 findings (393 Architecture, 1,578 Static Performance, 678 Accessibility). Cross-checked fresh against `benchmarks/real-world/raw-results/_combined-summary.json` and `domain-summary.json` at Stage T5 and again in this session (unchanged) — **all match exactly.** The n=18 spot-check is correctly described as "explicitly too small to generalize," and confirmed genuinely n=18 by direct file read of `benchmarks/real-world/SPOT_CHECK.md` in this session. No real-world P/R/F1/accuracy figure is claimed anywhere. **RQ3_RESULT_ALIGNMENT: PASS.**

The one loose thread is §6.1 item 4 bullet 2 and §6.3 item 2 both still describing this evaluation inconsistently relative to §6.2/§6.4 (see §0 items 1 and headline finding 1) — a *presentation* contradiction, not a *factual* error in the RQ3 answer itself.

---

## 7. RQ4 status audit

Line 33–34: status labelled `HUMAN_DATA_PENDING`, explicitly states the internal benchmark is not a substitute, explicitly states 0 real expert submissions, cites `research/independent-annotation/results/STATUS.md`. Re-read fresh in this session — `STATUS.md` still confirms 0 submissions, `submissions/` still empty. **No fabricated external accuracy figure anywhere. RQ4_STATUS_ALIGNMENT: PASS.**

One minor terminology note (not a correctness issue): Chapter 6 uses the bespoke status token `HUMAN_DATA_PENDING`, while other project documents (`research/independent-annotation/results/STATUS.md`, the Stage T6 task brief itself) use the plainer `PENDING`. Not a defect — flagged only as an optional wording-consistency item for the rewrite, not a required fix.

---

## 8. Human-study status audit

`chapter6_user_study_and_validity.md` §6.6 and `chapter6_conclusion.md` line 19/line 43 both state: target N=20 (P001–P020), historical baseline 80–100 correctly framed as historical/superseded, 0/20 collected, `NOT_COLLECTED`, all reported figures explicitly labelled `SYNTHETIC_PIPELINE_TEST_DATA`, including the "85 Profile Vectors" formula-test figure explicitly caveated as not a participant count. Re-verified fresh this session against `research/analysis/usability-results.json` (`datasetType: SYNTHETIC`, `isRealHumanData: false`, `collectionStatus: NOT_COLLECTED`, `targetSampleSize: 20`, `validParticipantCount: 0`, `targetReached: false`) and against `research/raw/real/`, `research/processed/real/`, `research/anonymized/real/` (all still empty). **HUMAN_STUDY_STATUS_ALIGNMENT: PASS.** No fabricated N=12/Cronbach's-Alpha claim survives anywhere (line 19 explicitly documents that an earlier fabricated version was retracted — this is a correctly-preserved audit trail, not a live claim).

---

## 9. Threats-to-validity audit

`chapter6_user_study_and_validity.md` §6.7, read in full:

- **Internal Validity** (lines 36–38): "Evaluated deterministic AST rules to prevent execution randomness. Controlled synthetic and real-world repository inputs." — thin but not false. No fix required; could be enriched in the rewrite (e.g. naming the specific controls: fixed Lighthouse config, fixed warm-up protocol, deterministic rule execution) but this is an enhancement, not a correction.
- **External Validity** (line 41): "Generalizes across single-page applications built on Next.js, React, and Angular." — correct; Vue is correctly excluded from the primary-framework generalization claim, consistent with Vue's "additional implementation support" status. No fix required.
- **Construct Validity** (line 44): **"Aligned directly with WCAG 2.2 AA accessibility and Core Web Vitals performance standards."** — this is the confirmed critical-issue C overclaim, still present, unresolved across three prior audit stages (T3, T4, T5) because Chapter 6 has not yet been touched. Two distinct problems in one sentence: (a) no evidence anywhere in the project establishes conformance to the specific **AA** level — only a statically-detectable-subset mapping exists; (b) FIGM's static performance rules are not Core Web Vitals runtime measurements — that conflation is exactly what Chapter 5 §5.9 and the RQ1 answer (line 28's last sentence) were written to prevent elsewhere in the dissertation, and Chapter 6 currently undoes that separation in its own Threats section. **THREATS_TO_VALIDITY_ALIGNMENT: FAIL** (this one line).
- **Conclusion Validity**: absent — no subsection exists. This is a structural gap relative to standard threats-to-validity taxonomy (Internal/External/Construct/Conclusion), not a false claim. Flagged as missing content for the rewrite.
- **Reproducibility limitations**: no explicit discussion (e.g. environment-pinning caveats already established elsewhere via `research-freeze-v1`/`v5` baselines, LLM-provider non-determinism for AI-assisted remediation, Lighthouse run-to-run variance already visible in the RQ1 SDs). Flagged as missing content, not a false claim.

Proposed replacement wording for the Construct Validity line (for the rewrite stage, not applied here): *"Accessibility rules are aligned with a statically detectable subset of WCAG 2.2 Success Criteria (Chapter 3 §3.3.4/§3.9; Chapter 5 §5.x), not a certified WCAG 2.2 AA conformance audit. Static performance rules identify source-level risk patterns associated with render and paint cost; they are not Core Web Vitals field or lab measurements. Core Web Vitals-adjacent metrics (FCP, TTI) are measured separately and directly by the RQ1 controlled experiment (§6.2), under its own disclosed narrow scope."*

---

## 10. Contribution-claim audit

§6.1's four contributions, checked against the valid-category list (framework-agnostic guideline model, four-layer abstraction, 50-rule catalogue, static multi-framework validation engine, deterministic+verified remediation, controlled RQ1 experiment, real-world evaluation, reproducibility artifacts):

1. Four-layer meta-model / ALPs — valid, accurate, matches Chapter 3/4. No issue.
2. 50-rule static detection engine — valid; contains the now-superseded self-correction note (finding #2 above) that needs updating, but the underlying 50-rule claim itself is correct.
3. Multi-stage AI remediation pipeline — valid category, but described inaccurately (Gemini-only wording; finding #3 above). The deterministic-first, unconditional-re-scan architecture described is otherwise accurately characterized and should be kept, just re-scoped to the real 3-provider architecture.
4. Empirical evaluation (3 sub-bullets: fixture benchmark, real-world evaluation, usability study) — the fixture-benchmark and usability-study bullets are accurate; the real-world-evaluation bullet is the critical-issue-A contradiction.

No overclaim of universal SPA correctness, full accessibility compliance, or external (RQ4) accuracy was found anywhere in §6.1. **CONTRIBUTION_CLAIMS: PARTIAL** (accurate categories, but items 2–4 need the corrections above; no fabrication, no overclaim beyond what's already flagged).

Missing but valid, not currently listed as a discrete contribution: reproducibility artifacts (frozen research baselines, `docs/audit/` provenance reports, the independent-annotation package). Optional addition for the rewrite, not a correction of an existing false claim.

---

## 11. Conclusion proportionality audit

Per-RQ classification as currently written, checked against the ANSWERED/PARTIALLY_ANSWERED/PENDING framework:

- RQ1 → written as "ANSWERED, narrow disclosed scope" → reasonable as **ANSWERED** (real data, honest scope caveats, no overreach).
- RQ2 → written as "Answered, on existing evidence" → reasonable as **ANSWERED**.
- RQ3 → written as "Answered, on existing evidence, with explicit caveats" → reasonable as **ANSWERED** (with the explicit no-P/R/F1-on-real-world-corpus caveat preserved).
- RQ4 → written as "HUMAN_DATA_PENDING. No final answer is claimed." → correctly **PENDING**, not forced into a false "answered."

No RQ is inflated beyond its evidence, and RQ4 is correctly left open rather than papered over. **CONCLUSION_PROPORTIONALITY: PASS** for the RQ-classification logic itself — the only proportionality problem in the chapter is the unrelated §6.1-item-4/§6.4 contradiction about *whether the real-world evaluation happened at all*, which is a consistency defect, not a proportionality defect.

---

## 12. Stale-claim inventory

| Term / claim | Found? | Location | Status |
|---|---|---|---|
| No-large-scale-evaluation vs. completed-21-repo contradiction | **YES** | `chapter6_conclusion.md` line 18 vs. lines 32, 64 | Unresolved — critical-issue A |
| "23 of the 25 rules" / stale AST-coverage note | **YES** (as a self-referential "not yet corrected" note that is itself now stale) | line 14, contradicted by line 51 in the same file | Unresolved — critical-issue B (Chapter-6-internal) |
| "15 repositories" as a current total | No | — | Clear (chapter correctly says 21 throughout, and correctly narrates the 15→21 expansion as history) |
| "80–100" as a current participant count | No | — | Clear (correctly framed as historical baseline only) |
| "8 rules" / "25 rules" as current catalogue size | No | — | Clear (correctly says 50 throughout; the "25" appearing at line 14 is explicitly the *old, corrected-away* figure) |
| "96.15%" / "98.04%" | No | — | Clear, does not appear in either file |
| Gemini-only remediation/provider wording | **YES** | line 15 | Unresolved — critical-issue B |
| Qwen as standalone provider | No | — | Clear, not mentioned |
| "Vue regex-only" | No | — | Clear |
| "WCAG 2.2 AA" / full WCAG compliance | **YES** | `chapter6_user_study_and_validity.md` line 44 | Unresolved — critical-issue C |
| "Core Web Vitals" as a static-rule validation claim | **YES** | same line 44 | Unresolved — critical-issue C |
| "ISO verified" | No | — | Clear |
| "Production SaaS" | No | — | Clear |
| Completed RQ4 accuracy claim | No | — | Clear — correctly PENDING |
| Fabricated human-study result | No | — | Clear — correctly 0/20, synthetic data clearly labelled |
| Dangling "Chapter 5, Section 5.1.1" cross-reference | **YES** | lines 32, 52 | New finding, not in the original A–E list — needs fixing at rewrite |
| Dangling "Chapter 5, Section 5.2" cross-reference | **YES** | line 41 | New finding, not in the original A–E list — needs fixing at rewrite |
| Stale "auto-regenerated... on every evaluation run" description of Chapter 5 | **YES** | line 17 | New finding — Chapter 5 is now static/hand-authored, not auto-regenerated (and is at live risk of being force-regenerated again — see §0 item 6, §15) |
| "46 fixture files" (testbed size, §6.3 item 1) | Unverified | line 51 | A raw file count in `benchmarks/testbed/` returned 67, not directly comparable without excluding non-fixture files (dirs/configs) — needs a clean re-count before the rewrite treats "46" as confirmed |

**STALE_NUMERIC_CLAIMS = 0** (no wrong number is stated as current fact anywhere — the "23 of 25" and "25 rules" appear only as explicitly-labelled historical/superseded figures). **STALE_IMPLEMENTATION_CLAIMS = 2** (Gemini-only remediation description; the two dangling Chapter 5 section-number cross-references, counted as one class of implementation/structural staleness). **RQ4_OVERCLAIMS = 0. HUMAN_STUDY_OVERCLAIMS = 0.**

---

## 13. Chapter 5/6 duplication check

No content duplication was found — Chapter 6 correctly *points to* Chapter 5 rather than restating its numbers (line 17's "deliberately not repeated as static text" design is sound practice and should be kept). The problem found in this check is **reference staleness, not duplication**:

1. Lines 32 and 52 cite "Chapter 5, Section 5.1.1's circularity disclosure." The new `CHAPTER_05_TESTING_AND_EVALUATION.md` has no §5.1.1 — the circularity disclosure now lives inline in §5.5 (three bullet points: fixtures/labels self-authored, validates internal consistency only, never used as RQ4 evidence) and its own §5.5.1 "RQ4 Boundary" subsection. **Fix:** retarget both citations to "Chapter 5, Section 5.5."
2. Line 41 cites "Chapter 5, Section 5.2" for a qualitative Lighthouse/ESLint/SonarQube comparison table. The new Chapter 5 has no such table at all — its own §5.2 is now "Testing Strategy," an unrelated topic. This content was not part of the Stage T5-approved 5.1–5.10 structure and was intentionally not carried forward into the rewrite; the closest surviving equivalent is Chapter 2's Table 2.1 (added at Stage T1/T2), which independently covers the same tool comparison. **Fix:** retarget the citation to "Chapter 2, Table 2.1," or drop the specific section pointer and leave the sentence's substantive claim (FIGM defines all 50 rules by construction; no competitor was actually run against FIGM's corpus) unchanged.
3. Line 17 describes Chapter 5 as "auto-regenerated from `docs/evidence/canonical-evaluation.json` on every evaluation run" — no longer true; Chapter 5 is now a static, hand-authored, promoted document. **Fix:** reword to describe Chapter 5 as sourced from a live evaluation run *at the time of writing* (citing the exact evidence file/command per `CHAPTER_05_TESTING_TRACEABILITY.md`), not as a document that regenerates itself indefinitely — and see §15 below for the operational side of this same issue.

No item in Chapter 5 duplicates Chapter 6's RQ interpretation, contribution claims, or limitations — the chapter boundary established at Stage T5 (Chapter 5 = infrastructure/status only, Chapter 6 = interpretation) holds up under this check.

---

## 14. Proposed Chapter 6 rewrite structure

Confirmed as a **correction pass on the existing structure**, not a rewrite from scratch (see §3). Section-by-section change list for the eventual rewrite stage:

- **6.1**: Keep items 1 and (substance of) 4. Rewrite item 2's self-correction note to state plainly that all 50 rules are real-AST-covered (matching §6.3 item 1, removing the internal contradiction). Rewrite item 3 to name all three current providers (Ollama/Claude/Gemini) and the real precedence/fallback order, keeping the accurate deterministic-first/unconditional-re-scan description. Rewrite item 4 bullet 1 to drop "auto-regenerated... on every run." Rewrite item 4 bullet 2 to state the real-world evaluation *was* conducted (21 repos), retaining only the true remainder of that bullet (the fabricated 30-repo/755,300 LOC claim stays retracted) and cross-referencing §6.2/RQ3 instead of contradicting it.
- **6.2 / 6.2.1**: Keep almost verbatim (already well-evidenced, proportionate, and correctly boundaried against Chapter 5). Fix only the two dangling cross-references (lines 32, 41 per §13).
- **6.3**: Keep 4-item structure. Retitle/adjust item 2 to remove the contradiction with the corrected §6.1 item 4. Fix item 2's dangling "§5.1.1" reference. Re-verify item 1's "46 fixture files" figure before restating it (§15).
- **6.4**: Keep as-is; no defect found.
- **6.5/6.6**: Keep as-is; re-confirm against live `usability-results.json` at rewrite time.
- **6.7**: Replace the Construct Validity line per the proposed wording in §9. Consider adding a short Conclusion Validity subsection and a brief reproducibility-limitations note.

---

## 15. Final evidence still missing / decisions needed before submission

1. ~~**Decision needed before Chapter 6 rewrite/promotion — the auto-exporter clobbering risk (§0 item 6).**~~ **RESOLVED at Stage T6A — see §17.** Option (a) (redirect test-triggered writes to a non-canonical `docs/generated/` directory, preserve the exporter's own capability via an explicit-directory parameter) was implemented, verified, and is now the live behavior.
2. Re-verify the "46 fixture files" figure in Chapter 6 §6.3 item 1 (and the equivalent figure if restated in Chapter 5) with a clean count that excludes non-fixture files, before the rewrite restates it. **Still open — not addressed at Stage T6A** (out of that stage's scope).
3. Confirm at rewrite time (not now) that `research/analysis/usability-results.json` and the three empty real-data directories are still unchanged, since human-study collection is explicitly ongoing/possible between now and submission. **Still open.**
4. No other missing evidence identified — RQ1/RQ3/RQ4/human-study source data all re-verified fresh in this session and consistent with what Chapter 6 already states.
5. **New, residual risk identified at Stage T6A, deliberately left unresolved (see §17 item 6):** `npm run eval` / `npm run research:evaluate`, run manually by a researcher, still calls `ThesisGapExporter.exportAllChapters()` with its default argument and will still overwrite both canonical chapter files. This is the one call site Stage T6A's task explicitly carved out as legitimate ("an explicit researcher-controlled promotion/export command...outside the normal test suite"), so it was left as-is — but it means Chapter 5's hand-authored promotion (and, later, Chapter 6's) remains one manual `npm run eval` away from being silently regenerated. Re-diff against `research/thesis/` after running that command for any reason before final submission.

---

## 17. STAGE T6A — Exporter Canonical-Write Resolution (added after the Stage T6 audit above)

### 17.1 What was found on inspection

Two call sites for `ThesisGapExporter.exportAllChapters()` existed, both reading `src/eval/thesis-gap-exporter.ts` (190 lines) and its one exported method:

1. `tests/research-gap-eval.test.ts:102`, inside a `node --test`-run test ("GAP 9 & GAP 10"), part of the standard `npm test` run.
2. `src/eval/evaluation-runner.ts:463`, inside a CLI auto-run guard (`if (process.argv[1] && process.argv[1].includes('evaluation-runner'))`), intended to fire only when a researcher runs `npm run eval` / `npm run research:evaluate` directly.

`exportAllChapters()` hardcoded `outputDir = path.resolve(process.cwd(), 'docs/dissertation')` and wrote exactly two files there: `chapter5_empirical_validation_and_benchmarks.md` and `chapter6_user_study_and_validity.md` (plus deleting a long-stale `chapter4_large_scale_evaluation.md` if present — harmless, unrelated to this issue).

### 17.2 Previous behavior

Any invocation of `exportAllChapters()` — test-triggered or CLI-triggered — wrote straight into the canonical `docs/dissertation/` location, unconditionally overwriting whatever was there, hand-authored or not.

### 17.3 New behavior

`exportAllChapters(outputDir: string = path.resolve(process.cwd(), 'docs/dissertation'))` now accepts an explicit output directory (design option A from the task: smallest, safest change, no internal logic touched beyond the signature and the one hardcoded `const`).

- Call site 2 (`evaluation-runner.ts`'s CLI guard) calls it with **no argument**, so it keeps writing to `docs/dissertation/` exactly as before — this is the one call site the task explicitly carved out as a legitimate, researcher-controlled export path outside the normal test suite.
- Call site 1 (`tests/research-gap-eval.test.ts`) now calls it with an explicit `docs/generated` directory and reads its assertions back from that directory instead of the canonical one.
- A cosmetic bug was also fixed in passing: the exporter's own console log line hardcoded the string "docs/dissertation/" regardless of which directory was actually used; it now interpolates the real `outputDir`.

### 17.4 A second, deeper root cause found only by actually running the fixed code (not assumed)

Making fix 17.3 alone and declaring the problem solved would have been premature — this was checked empirically, not assumed. After the first fix, a full `npm test` run was executed and the canonical Chapter 5 checksum was compared before/after: **it changed**, proving the canonical file was still being overwritten by *something* even though both known call sites were now accounted for.

Root cause: `evaluation-runner.ts`'s CLI guard used a **substring** check, `process.argv[1].includes('evaluation-runner')`, not an identity check. `tests/evaluation-runner.test.ts` (a normal test file, part of `npm test`, which imports `EvaluationRunner` from `evaluation-runner.ts`) has a path that itself contains the substring "evaluation-runner". Node's `--test` runner sets `process.argv[1]` per test file it runs; when `tests/evaluation-runner.test.ts` ran, `process.argv[1]` resolved to a path containing that substring, spuriously satisfying the guard and firing the *entire* auto-run block — including the no-argument, canonical-writing `ThesisGapExporter.exportAllChapters()` call — from inside the test suite, silently reverting Chapter 5 back to auto-generated content mid-run. This is the exact same class of bug as the previously-fixed `figm-analyze.ts` entry-guard issue (substring match against an ambient path, not an identity check against the module's own resolved file).

**Fix:** replaced the substring check with an exact-path comparison — `path.resolve(process.argv[1]) === __filename` (this file already computed `__filename` via `fileURLToPath(import.meta.url)`) — which is true only when `evaluation-runner.ts`/`.js` is the actual script Node was told to run, never when it is merely imported by another module.

**Consequence discovered once this was fixed:** with the canonical Chapter 5 no longer being silently reset mid-suite, a genuinely pre-existing but previously-masked test failure surfaced: `tests/research-integrity.test.ts`'s "chapter 5 embedded TP/FP/FN" check asserted the exact literal string `**True Positives (TP)**: 65` (the old auto-exporter's inline-bold format). The hand-authored Chapter 5 promoted at Stage T5 reports the same figures in a Markdown table (`| True Positives (TP) | 65 |`) instead — a real format mismatch that the entry-guard bug had been accidentally hiding by re-clobbering Chapter 5 into the expected format before this check ever ran. Root-caused and fixed by updating the assertion to accept either format (an `embeds()` helper checking the old inline-bold pattern OR a regex against the new table-row pattern, with the label's regex metacharacters — the parentheses in "(TP)" — properly escaped after an initial attempt without escaping produced a false negative, caught by manually verifying the regex against the literal table text before re-running the suite). The semantic strength of the check (Chapter 5's embedded numbers must literally equal `canonical-evaluation.json`'s) is unchanged; only the accepted string format was widened to match the now-intentionally-static chapter.

### 17.5 Files changed

- `src/eval/thesis-gap-exporter.ts` — parameterized `outputDir`, fixed the log-line to reflect the real output directory.
- `src/eval/evaluation-runner.ts` — CLI auto-run guard changed from a substring check to an exact-path check.
- `tests/research-gap-eval.test.ts` — the exporter test now targets `docs/generated/` instead of the canonical location.
- `tests/research-integrity.test.ts` — the Chapter 5 TP/FP/FN check now matches either the legacy inline-bold format or the new table-row format.
- `tests/thesis-exporter-canonical-guard.test.ts` — **new** regression-guard file (4 sub-tests): confirms the canonical files exist, confirms they are byte-identical before/after an exporter run targeting `docs/generated`, confirms the exporter still produces real output there, and asserts (by reading the exporter's own source) that its default argument is still `docs/dissertation` — so a future refactor that quietly drops that default is itself caught.
- `package.json` — registered the new test file in the `test` script, immediately after `research-gap-eval.test.ts`.

### 17.6 Protected canonical paths / generated-output path

- **Protected (must never be written by an automated test):** `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md`, `docs/dissertation/chapter6_user_study_and_validity.md`.
- **Generated-output path (test-only artifacts):** `docs/generated/chapter5_empirical_validation_and_benchmarks.md`, `docs/generated/chapter6_user_study_and_validity.md` — both now exist on disk, produced by the fixed test run; left in place rather than deleted after the test, consistent with this repository's existing convention of committing other evaluation-runner outputs (`benchmarks/eval-summary.json`, `docs/reports/benchmark-results.md`, `public/eval-results/*`).

### 17.7 Chapter 6 file inventory, classified (task step 7)

| File | Classification | Notes |
|---|---|---|
| `docs/dissertation/chapter6_conclusion.md` | CANONICAL | Hand-authored; not touched by the exporter; awaiting its own Stage T6 rewrite |
| `docs/dissertation/chapter6_user_study_and_validity.md` | CANONICAL (content currently machine-generated) | Sits at the canonical path but its content is still exporter-produced pending the Stage T6 rewrite; now protected from test-triggered regeneration by this fix |
| `docs/generated/chapter6_user_study_and_validity.md` | GENERATED | New, test-only artifact from this stage's fix; not part of the dissertation |
| `docs/generated/chapter5_empirical_validation_and_benchmarks.md` | GENERATED | New, test-only artifact; not part of the dissertation (Chapter 5's canonical version is the Stage T5 hand-authored document) |
| `research/thesis/CHAPTER_06_RESULTS_CONCLUSION_AUDIT.md` (this file) | SUPPORTING | Staging/audit workspace document, not a dissertation chapter |
| Any `.tex` variant of Chapter 6 | — | None exists (confirmed via directory listing) |
| Any archived/legacy Chapter 6 file | — | None exists — Chapter 6 has not yet been promoted/rewritten, so no archive copy has been created yet |

No files were merged or rewritten as part of this classification pass, per instruction.

### 17.8 Verification results

- `EXPORTER_TARGETED_TESTS`: `tests/research-gap-eval.test.ts` + `tests/thesis-exporter-canonical-guard.test.ts` run in isolation — 11/11 pass (2 outer suites, 9 sub-tests) after the first fix; canonical Chapter 5 confirmed byte-identical before/after.
- Four full `npm test` runs were executed in this stage, not one, because each of the first three surfaced a real issue that needed root-causing rather than being waved off:
  1. Run 1 (`outputDir` parameterization only): 1531 tests, 1531 pass — but canonical Chapter 5's checksum had changed, caught by an explicit before/after checksum comparison, not by the test count alone. Root cause: the `evaluation-runner.ts` entry-guard bug (§17.4).
  2. Run 2 (entry-guard fixed): 1531 tests, 1529 pass, 2 fail — the previously-masked `research-integrity.test.ts` format mismatch (§17.4).
  3. Run 3 (first attempt at the format fix): still 1529 pass, 2 fail — the regex-escaping bug in the fix itself (unescaped `(TP)` parentheses), caught by re-inspecting the exact failure rather than assuming the fix worked.
  4. Run 4 (regex-escaping corrected, verified against the literal table text first): **1531 tests, 1531 pass, 0 fail.** Exporter log lines confirm both firings targeted `docs/generated/` only, with zero firings against the default `docs/dissertation` path.
- `npx tsc --noEmit`: PASS (0 errors) after every source change in this stage.
- `npm run build`: PASS — full 59-route static/dynamic manifest generated, exit code 0.
- Canonical-file checksums (`sha256sum`) recorded before this stage's first edit, and re-verified after run 1 (mismatch, restored from `research/thesis/CHAPTER_05_TESTING_AND_EVALUATION.md`, re-confirmed identical to source), and again after run 4 and after the build — final state matches the pre-Stage-T6A baseline exactly:
  - `chapter5_empirical_validation_and_benchmarks.md`: `2c62bbd7699009d826d5c9ebfe51d1092f6c2b5c70351e9225594da73c5d9942`
  - `chapter6_conclusion.md`: `35d051ce9c3f7b7430a9d2039cbcf9ae33503da1e89cf97eeeec7982cb88fc1b`
  - `chapter6_user_study_and_validity.md`: `d0814e83dce4a56b0e8d21e3c8175d8c62ffbbfa676401f94fdb504faaae7d60`

### 17.9 Residual, deliberately-unresolved risk

`npm run eval` / `npm run research:evaluate`, run manually, still calls `exportAllChapters()` with its default argument and will still overwrite both canonical chapter files. This is intentional — it is the one call site the task explicitly named as a legitimate export path outside the normal test suite — but it means the hand-authored Chapter 5 (and later, Chapter 6) remains one manual research-evaluation run away from being silently regenerated. Documented in §15 item 5 as a standing pre-submission checklist item, not fixed in this stage.

## 18. Self-audit

```
CHAPTER_6_STRUCTURE_ALIGNMENT=PARTIAL
RQ1_RESULT_ALIGNMENT=PASS
RQ2_RESULT_ALIGNMENT=PASS
RQ3_RESULT_ALIGNMENT=PASS
RQ4_STATUS_ALIGNMENT=PASS
HUMAN_STUDY_STATUS_ALIGNMENT=PASS
INTERNAL_BENCHMARK_RQ4_SEPARATION=PASS
STATIC_RUNTIME_BOUNDARY=PASS
WCAG_SCOPE_BOUNDARY=FAIL
THREATS_TO_VALIDITY_ALIGNMENT=FAIL
CONTRIBUTION_CLAIMS=PARTIAL
CONCLUSION_PROPORTIONALITY=PASS
STALE_NUMERIC_CLAIMS=0
STALE_IMPLEMENTATION_CLAIMS=2
RQ4_OVERCLAIMS=0
HUMAN_STUDY_OVERCLAIMS=0
UNRESOLVED_CHAPTER_6_ISSUES=7
READY_TO_REWRITE_CHAPTER_6=YES
```

`UNRESOLVED_CHAPTER_6_ISSUES=7` = (1) large-scale-evaluation contradiction, (2) stale-AST-coverage self-reference, (3) Gemini-only provider wording, (4) WCAG 2.2 AA / Core Web Vitals overclaim, (5) two dangling Chapter 5 cross-references, (6) stale "auto-regenerated" Chapter 5 description, (7) missing Conclusion Validity/reproducibility content. All seven are text-only corrections addressable in a rewrite pass; none require new data collection, and none block `READY_TO_REWRITE_CHAPTER_6=YES`. The auto-exporter clobbering risk (§0 item 6, §15 item 1) is deliberately **not** counted among the 7, since it is a decision about test/export code behavior, not a defect in Chapter 6's text — it must still be resolved (in whichever direction the user chooses) before the eventual Chapter 6 *promotion* is safe, separate from the rewrite itself.
