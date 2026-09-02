# FIGM Known Limitations Register (Frozen at Pre-Freeze Review, Stage 6)

**Status: FROZEN for the pre-freeze review baseline, 2026-09-03.** This is the single, consolidated
list of every limitation this project has found and disclosed about itself. Nothing here is hidden
or softened. Each entry names the source document with the full detail; this register exists so a
reader does not have to hunt across a dozen audit reports to know what NOT to claim.

Update this register whenever a new limitation is found, or an existing one is resolved (move it to
the "Resolved" section at the bottom with the resolving stage cited — never delete a limitation's
history).

## 1. Detection engine / parser

- **Next.js App Router destructured-parameter parser limitation**: FIGM's lightweight scope parser
  fails (`SYNTAX-PARSE-ERROR`, "Unexpected token '{' in function parameter list") on the common
  TypeScript pattern `function Layout({ children }: { children: React.ReactNode })`. Confirmed at
  scale in the Stage 5 real-world corpus (up to 30.5% of files in one repo). Root cause: the parser
  is not a full Babel/SWC AST driver. Fix is out of scope for a corpus-expansion or freeze-review
  pass — recorded as dissertation Chapter 6 future work ("Compiler AST Driver Integration").
  Source: `benchmarks/real-world/METHODOLOGY.md` §8c (7a), `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` §7a.

- **FIGM-ANG-01 wrong-framework false-positive class**: fires on any `this.<name>(...)` call shape
  resembling an RxJS `.subscribe()` pattern, with no requirement that the file actually be Angular
  or that the identifier actually be an RxJS `Subscription`. Confirmed reproducible in a pure-React
  codebase (`excalidraw/excalidraw`, `AppStateObserver.ts`, a plain class with a method coincidentally
  named `subscribe`). Same class of limitation as the already-documented FIGM-REACT-03 false-positive
  (any property assignment flagged as "React state mutation," confirmed in the original 5-repo
  benchmark). Not fixed — would require binding-aware analysis (real type/import tracking), a larger
  engine change than either the corpus-expansion or freeze-review scope permits.
  Source: `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` §7b;
  `benchmarks/real-world/SPOT_CHECK.md` (FIGM-REACT-03 precedent).

- **One known duplicate finding (FIGM-REACT-01)**: `excalidraw/App.tsx:11606:10` produced two
  identical diagnostics for the same AST location — 1 of 2,649 findings (0.04%) in the Stage 5
  corpus. Isolated, not systemic (a corrected duplicate-detection check found no other instance
  across all 21 repositories). Not fixed this stage; flagged for a future engine-hardening pass.
  Source: `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` §7c.

## 2. RQ1 runtime experiment scope

- **RQ1 runtime results are React/Next.js only.** The frozen protocol's 4 conditions (CSR_LOCAL,
  CSR_GLOBAL, SSR_LOCAL, SSR_GLOBAL) are all Next.js/React fixtures. No Angular RQ1 runtime fixture
  exists or is planned — a deliberate, researcher-confirmed scope decision (Stage 3A, 2026-09-03),
  not an oversight. Angular remains a PRIMARY framework for FIGM's static-analysis rule set and
  real-repository evaluation; this limitation concerns only the RQ1 *runtime performance* experiment.
  RQ1 results must never be presented as a cross-framework comparison or generalized to Angular.
  Source: `docs/research/RQ1_EXPERIMENT_PROTOCOL.md` §1/§13; `research/rq1-experiment/protocol.json`.

- **No real RQ1 data has been collected.** `REAL_RQ1_RUNS_COLLECTED: 0`. All 6 raw-result files
  under `research/rq1-experiment/raw-results/smoke-test/` are `isSmokeTest: true` engineering
  validation runs, structurally excluded from analysis by default and verified (Stage 6) to
  contain zero rows that could be mistaken for measured data.

## 3. Vue framework scope

- **Vue is additional support, not a primary framework.** It is not counted toward the 20-30
  primary-framework repository-sample target, is not part of FIGM's guideline-development or RQ1
  scope, and its inclusion in the real-world corpus (3 of 21 repositories) is supplementary evidence
  only. 6/6 Vue-specific rules have real-AST detection; the 15 universal (non-Vue-specific) rules
  fall back to legacy text-heuristic detection on Vue files.
  Source: `docs/research/FINAL_RESEARCH_CONTRACT.md` §4; `docs/research/FINAL_TRACEABILITY_MATRIX.md`
  (Vue extension row).

## 4. Accessibility scope

- **Static WCAG 2.2 checks are not a conformance audit.** FIGM's 7 accessibility rules cover a
  statically-detectable subset of WCAG 2.2 concerns. No real assistive-technology testing (NVDA,
  JAWS, VoiceOver, or any screen reader) is performed at any point in this pipeline. A prior version
  of `app/accessibility/page.tsx` fabricated specific NVDA/JAWS compliance percentages; this was
  found and fixed in Stage 4 (the page now sources every figure live from `RULE_CATALOG`/
  `WCAG_22_MAPPINGS` and states "WCAG 2.2-Aligned Static Checks — Not a Conformance Audit" directly
  in its header). No WCAG conformance rate is ever claimed anywhere in this project.
  Source: `docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md` §5;
  `docs/research/FINAL_RESEARCH_CONTRACT.md` §7.

## 5. Accuracy evidence (controlled vs. real-world vs. RQ4)

- **The controlled-benchmark P/R/F1 (100%/100%/100%) is not RQ4 expert-validation accuracy.** It is
  computed against `benchmarks/ground-truth.json` (50/50 rules, 65 violations), which is currently
  100% researcher-authored ground truth — the same person/process that built the detection rules
  also wrote the fixtures that "prove" the rules work. It is self-fulfilling by construction and
  must never be presented as if it satisfies RQ4's requirement for accuracy measured against
  *independent* manual expert review.
  Source: `docs/research/FINAL_RESEARCH_CONTRACT.md` §10-11; `docs/research/FINAL_RQ_ANSWERS.md`.

- **Real-world corpus findings (2,649 raw findings across 21 repositories) have no independent
  ground truth and no Precision/Recall/F1 is computed from them.** Only a small, non-random,
  18-item hand-verified sample exists (`benchmarks/real-world/SPOT_CHECK.md`, from the original
  5-repo pass — not re-run against the expanded 21-repo corpus), showing a mix of true and false
  positives, including a confirmed FIGM-REACT-03 false-positive class. This sample is not sized or
  sampled for a citable accuracy percentage.
  Source: `benchmarks/real-world/METHODOLOGY.md` §1; `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md`.

- **0 real independent-expert annotation submissions exist.** The RQ4 blind-annotation package
  (`research/independent-annotation/`) was found stale at Stage 6 (fixtures/RULE_REFERENCE.md were
  from an earlier ~25-rule/40-violation project revision, silently un-regenerated through two later
  rule-set expansions) and has been regenerated to match the current 50-rule/65-violation benchmark
  as part of this review. It is protocol-ready; no real annotator has used it yet.
  Source: `docs/audit/STAGE_6_PRE_FREEZE_REVIEW_REPORT.md` §8.

## 6. Human participant study

- **0 real participant responses collected**, against a confirmed target of 20 (a later, deliberate,
  researcher-approved reduction from the Proposal/Interim 02's documented 80-100 historical
  baseline — not a rejection of that baseline). SUS and Cronbach's alpha formulas are verified only
  against explicitly-labelled synthetic test vectors, never real response data.
  Source: `docs/research/PARTICIPANT_TARGET_DECISION.md`; `research/analysis/usability-results.json`.

## 7. Telemetry / analytics

- **GA4 live property not verified.** `src/lib/analytics.ts`'s event schema and payload-safety are
  implementation-verified (no PII/source-code/secret ever included, enforced by
  `tests/analytics-payload-safety.test.ts`), but no live GA4 property is configured in this
  environment (`NEXT_PUBLIC_GA_MEASUREMENT_ID` unset), so no live-traffic verification has occurred.
  Status: `IMPLEMENTATION_VERIFIED / LIVE_NOT_TESTED`.
  Source: `docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md` §11.

## 8. AI-assisted remediation

- **AI-assisted (Gemini/Claude) fix-verification fallback path not production-browser tested.**
  Stage 4's live browser walkthrough verified the deterministic AST-fix → validate → re-scan path
  end-to-end (a real finding disappeared after a real fix was applied and re-verified), but did not
  exercise the AI-authored-patch path live, even though real API keys are configured. Recorded
  honestly as `NOT_TESTED`, not assumed working.
  Source: `docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md` §6.

## 9. Dissertation / research-contract text alignment

- `docs/dissertation/chapter3_methodology.md` §3.3 still describes an earlier "$N_3=8$" rule-set
  extraction protocol, predating two later expansion passes that grew the registry to 50 rules.
  Neither the Proposal nor Interim 02 specifies an exact rule count, so this is a presentation
  decision, not a defect — flagged so it is not mistaken for a live inconsistency.
  Source: `docs/research/FINAL_RESEARCH_CONTRACT.md` §3.

## Resolved (kept for history — do not delete)

- ~~Repository corpus below the 20-30 target (was 15)~~ — RESOLVED Stage 5 (2026-09-03): 21
  repositories, 15 primary-framework.
- ~~`app/accessibility/page.tsx` fabricated WCAG/NVDA/JAWS metrics~~ — RESOLVED Stage 4 (2026-09-03).
- ~~`app/diagnostics/page.tsx` domain filter missing the Architecture category~~ — RESOLVED Stage 4.
- ~~RQ1 protocol/infrastructure did not exist~~ — RESOLVED Stage 3/3A (2026-09-03): protocol built,
  gaps closed, infrastructure ready; real data collection remains a separate, post-freeze step
  (Section 2 above).
- ~~Participant target and ethics-approval status were open governance questions~~ — RESOLVED Stage
  1 (2026-09-03): researcher-confirmed.
- ~~Independent-annotation package stale (25/50 rules, 40/65 violations, wrong file-count in
  instructions)~~ — RESOLVED Stage 6 (2026-09-03): regenerated from current registry/testbed.
