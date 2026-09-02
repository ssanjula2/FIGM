# Final RQ Answers

**Updated 2026-09-03.** `FINAL_RESEARCH_CONTRACT.md` Section 1 previously documented two materially
different RQ1-4 wordings in use (Set A = dissertation Chapter 1; Set B = this session's task
instructions), with no Proposal/Interim 02 document available to arbitrate. That ambiguity is now
**resolved**: both the Proposal (`Research Proposal new.docx` §2.3) and Interim 02
(`28256_Interim 02.docx` §1.4) were read in full this session and independently confirm **Set B,
verbatim**, as the authoritative wording — Interim 02 reproduces it unchanged from the Proposal.
Set A remains the wording currently in `chapter1_introduction.md`, not yet corrected to match (see
`docs/audit/FINAL_RESEARCH_CONTRACT_RECONCILIATION_REPORT.md`'s `NEXT_ACTION`).

**Further confirmed 2026-09-03 (same day, following turn):** the researcher explicitly confirmed
Set B as the authoritative RQ set, in addition to its documentary confirmation from the Proposal
and Interim 02 above. `FINAL_RQ_SET = SET_B` is now doubly sourced (document + researcher). This
does not change any answer or evidence below — RQ4's "HUMAN_DATA_PENDING" findings for both sets
remain accurate and unaffected by this confirmation; only the target participant count referenced
implicitly by Set A's RQ4 discussion is now 20 (researcher-confirmed, a later approved
research-scope decision — see `docs/research/PARTICIPANT_TARGET_DECISION.md`), not the earlier
85 figure.

Every answer below is still given against **both** sets — Set B because it is now confirmed
authoritative, Set A because it is what the dissertation currently states and its answers remain
real, evidence-backed work that should not be discarded merely because the wording it was written
against is being corrected. Nothing about the underlying evidence or honesty findings below changed
as a result of this reconciliation — only the framing of which RQ set is authoritative did.

## RQ1

**Set A — Can SPA quality guidelines across React, Next.js, and Angular be formalized into a framework-independent model without losing precision?**
- Method: static inspection of `src/matrix/four-layer-meta-model.ts`'s Domain→Concern→ALP→Rule hierarchy; controlled-benchmark precision measurement.
- Dataset: `figm-spec.json` (50 rules), `benchmarks/ground-truth.json` (65 labelled violations).
- Sample size: 50 rules, 46 controlled fixtures.
- Measurement: direct source inspection + `docs/evidence/canonical-evaluation.json`'s dynamically-computed P/R/F1.
- Result: the abstraction is real (not decorative — every consumer reads from one registry). Precision on the controlled benchmark = 1.0, but that benchmark is self-fulfilling by construction (Section "Controlled benchmark" below) — it demonstrates the model doesn't lose precision on its *own* fixtures, not on independent code. Detection mechanism is framework-gated for 15/50 rules (this session's precise finding, Section 3.2.1 correction), so "without losing precision" is not yet demonstrated uniformly across all three named frameworks for every rule.
- Interpretation: **Partially answered.** The formalization is real and does not appear to lose precision on its own controlled corpus; whether it holds on independent/real-world code is unmeasured (real-world evaluation reports raw findings, not precision, by design).
- Limitations: self-authored ground truth; framework-gated detection for a third of rules.
- Answer: **Formalization exists and is internally precision-preserving on its own benchmark; independent-corpus precision preservation is not yet measured.**
- Supporting artifact: `figm-spec.json`, `docs/evidence/canonical-evaluation.json`, `docs/dissertation/chapter3_methodology.md` §3.2.1 (corrected this session).

**Set B (now confirmed sourced verbatim from Proposal §2.3 and Interim02 §1.4) — How do different SPA render and state-management strategies influence FCP and TTI?**
- Method: none exists.
- Dataset: none.
- Sample size: 0.
- Measurement: no runtime infrastructure exists (`app/performance/page.tsx`'s numbers are an explicitly-disclosed scan-duration proxy, not FCP/TTI).
- Result: none.
- Answer: **NOT ANSWERED. No evidence exists.** Building the infrastructure requires a human research decision on experimental factors (rendering/state-management strategy set, browser/hardware/network profile, repetition count, TTI measurement tooling) not available in this repository — explicitly not attempted this session per the stop condition this task itself specifies.
- Supporting artifact: none (absence is the finding).

## RQ2

**Set A — How effectively can static AST analysis detect performance and accessibility defects compared to ESLint, SonarQube, and Lighthouse?**
- Method: qualitative capability comparison table (Chapter 5 §5.2, not modified this session) + this project's own detection results.
- Result: a real comparison table exists; it is qualitative/capability-based, not a head-to-head quantitative benchmark run against the same corpus with the same ground truth.
- Answer: **Partially answered** — a real, if qualitative, comparison exists; a quantitative side-by-side run was not performed and is not claimed.
- Supporting artifact: `docs/dissertation/chapter5_evaluation.tex` / `chapter5_empirical_validation_and_benchmarks.md` §5.2.

**Set B — What framework-agnostic architectural and accessibility patterns can be standardized in compliance with WCAG 2.2?**
- Method: rule-registry inspection, corrected WCAG mapping (this session).
- Result: 19 architecture patterns, 7 accessibility patterns (now correctly WCAG-2.2-Success-Criterion-mapped, each with an explicit rationale — `WCAG_22_MAPPINGS`, `tests/wcag-mapping-integrity.test.ts`).
- Answer: **Answered, precisely scoped.** A real, standardized, framework-agnostic pattern set exists for both domains. "In compliance with WCAG 2.2" must be read as "aligned with a statically-detectable subset of WCAG 2.2 Success Criteria" — never full conformance (no claim of full compliance exists anywhere in the repository, confirmed clean this session and the prior one).
- Supporting artifact: `figm-spec.json`, `docs/dissertation/chapter3_methodology.md` §3.2.

## RQ3

**Both sets converge here** (Set A: "Can LLM-assisted remediation produce syntactically valid patches, deterministic-first?" / Set B: "How effectively can the tool detect violations before deployment?") — closely related, both answerable from the same evidence.
- Method: direct source trace of `src/ai/ai-remediation-router.ts`, `remediation-decision.ts`, `sandbox-validation-pipeline.ts`, `remediation-validation.server.ts`.
- Result: deterministic-first routing confirmed real; AI patches pass through isolation→syntax→patch-scope→framework-structural→compile-and-rescan→test before `verified: true`; re-scan rejects on the original violation persisting *or* a new violation appearing. No premature-VERIFIED path found across three independent verification passes (this session and two prior).
- Answer: **Answered affirmatively for the mechanism.** LLM-assisted remediation does produce syntactically-valid, verified patches when it succeeds, with deterministic fixing genuinely prioritized first. Empirical *success rate* (how often AI remediation succeeds vs. is rejected, across a real corpus) is not separately quantified — the mechanism's correctness is verified; its real-world effectiveness rate is not benchmarked.
- Limitations: the 3 live-provider integration tests are excluded from the default `npm test` run (require real API keys/local GPU) — mechanism correctness is verified via mocked/unit tests plus this session's own live sandbox-validation test run, not a large-scale live-provider benchmark.
- Supporting artifact: `tests/sandbox-validation-pipeline.test.ts`, `tests/remediation-engine-regressions.test.ts`, `docs/research/AI_CONFIGURATION_FREEZE.md`.

## RQ4

**Set A — Does FIGM provide measurable productivity and usability improvements for software engineers?**
- Method: SUS + custom task items, pipeline verified against synthetic data only.
- Result: 0 real participants (verified honest, `research/analysis/usability-results.json`).
- Answer: **NOT YET ANSWERED. HUMAN_DATA_PENDING.** No fabricated positive or negative answer given.
- Supporting artifact: `research/analysis/usability-results.json`, `docs/research/PARTICIPANT_TARGET_DECISION.md`.

**Set B (now confirmed sourced verbatim from Proposal §2.3 and Interim02 §1.4) — To what extent does the tool achieve acceptable accuracy vs. manual expert review (P/R/F1)?**
- Method: independent-annotation blind-review package, comparison script.
- Result: 0 expert submissions (verified honest, `research/independent-annotation/results/STATUS.md`).
- Answer: **NOT YET ANSWERED. HUMAN_DATA_PENDING.** The only accuracy evidence against any independent judgment is the n=18 manual spot-check (`benchmarks/real-world/SPOT_CHECK.md`, updated this session): 13/18 (72%) if "TP narrow" counts, 7/18 (39%) if only clean TPs count — explicitly too small to generalize, per that document's own stated position.
- Supporting artifact: `research/independent-annotation/results/STATUS.md`, `benchmarks/real-world/SPOT_CHECK.md`.

## Controlled benchmark (context for both RQ1/RQ4 answers above)

TP=65, FP=0, FN=0, P=R=F1=1.0 — independently re-verified this session after the taxonomy/WCAG
changes (no detection-logic change, so no regression expected or found). **Label: INTERNAL
CONTROLLED BENCHMARK.** 100% researcher-authored, zero true-negative fixtures — this figure
demonstrates the detectors fire on their own designed positive cases; it says nothing about
false-positive rate on independent code and must never be cited as "100% accurate" without that
qualification.

## Overall

No RQ is fully and finally answered by this session's work. RQ3 (and, if Set A is confirmed, RQ2)
have real, defensible, evidence-backed answers for their *mechanism*. RQ1 (Set B) and RQ4 (both
sets) remain open pending human-only work this session correctly did not attempt to fabricate.
