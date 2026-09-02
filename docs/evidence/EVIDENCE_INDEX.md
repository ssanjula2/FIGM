# 📜 FIGM Research Evidence & Evaluation Vault
**Module**: IS303.2 Research Methodology Repeat Coursework 2025
**Candidate**: A P H D S Sanjula (ID: 28256)
**Institution**: NSBM Green University

This directory is the centralized empirical evidence vault for the **Framework-Independent
Guideline Model (FIGM)** research. Every artifact listed below is either regenerated live by a
real command, or explicitly labeled as not-yet-collected — nothing here is a static hand-typed
number.

---

## 📁 Evidence Vault Directory Structure

```text
docs/evidence/
├── EVIDENCE_INDEX.md                  <-- Master evidence directory & index (this file)
├── canonical-evaluation.json          <-- THE canonical empirical benchmark result (see below)
├── reproducibility-manifest.json      <-- Exact commands to reproduce every figure below
├── research-claim-traceability.md     <-- Claim-by-claim VERIFIED/SUPPORTED/PLANNED/... ledger
├── user-study/
│   └── user-study-results.json        <-- Human usability study status (currently NOT_COLLECTED)
└── ci-cd-reports/
    ├── figm-ci-report.json            <-- Self-scan (FIGM scanning its own codebase) raw JSON
    └── figm-ci-report.md              <-- Self-scan quality-gate markdown report
```

A prior version of this vault also contained `benchmarks/` and `latex-tables/` subdirectories —
frozen, hand-committed snapshots from 2026-08-05 that were never regenerated after that date and
had silently drifted from the real benchmark (they still reported the retired 18 TP / 3 FP / 1 FN
/ 85.7%/94.7%/90.0% figures long after the live pipeline had moved on). They have been deleted;
`benchmarks/eval-summary.json` (repository root) and `canonical-evaluation.json` (this directory)
are the only benchmark artifacts now, and both are regenerated together by the same command.

---

## 📊 Summary of Empirical Evidence Artifacts

| Evidence Artifact | Description | Current Status | Regenerate with |
| :--- | :--- | :--- | :--- |
| **Ground-Truth Benchmark** | Precision/Recall/F1 computed by re-running the real scanner against `benchmarks/testbed`, scored against `benchmarks/ground-truth.json`. Covers **50 of FIGM's 50 rules** (those with hand-labelled ground truth — as of the 2026-08-25 Scientific Hardening pass, this is now all of them; see `ruleCoverage` in `canonical-evaluation.json` for the live list). | Live, dynamic | `npm run research:evaluate` |
| **Large-Scale / Multi-Repository Evaluation** | A claim of "30 repositories" / "755k LOC" evaluated previously existed in this project's history. No repository was ever cloned or scanned to produce it — the dataset and its generator (`src/eval/repo-evaluator.ts`) were fabricated and have been deleted. That fabricated claim remains retracted. A genuinely separate, real 21-repository corpus (pinned commit hashes, real GitHub URLs; 15 of the 21 are primary-framework React/Next.js/Angular repos, meeting the Proposal's 20-30 repository-sample target — Stage 5, 2026-09-03) now exists at `benchmarks/real-world/` — 2,512 files, 320,367 LOC, 0 engine crashes — but it has **no independent ground truth**, so it supports detection-runs-without-crashing claims only, never a precision/recall number; see `benchmarks/real-world/SUMMARY.md` for the explicit scope and its bounded, non-random 18-item spot-check (not re-run against the expanded corpus), and `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` for the expansion pass itself. | **Real-world corpus exists at target size (unannotated); large-scale *accuracy* evaluation still does not — that requires the RQ4 expert ground-truth stage.** | `node --import tsx benchmarks/real-world/run-real-world-benchmark.ts` (no `package.json` script alias exists for this yet) |
| **Primary User Study** | Developer usability survey, target N=85. | **0/85 collected.** No SUS score or Cronbach's α can currently be reported; the scoring formulas are verified against explicitly-labelled synthetic test data only. | `npm run research:user-study:import` once real responses exist |
| **DevSecOps Self-Scan** | FIGM scanning its own codebase (not a benchmark accuracy measure — a dogfooding quality-gate report). | See `ci-cd-reports/figm-ci-report.md` for its own date/figures. | `npm run ci:scan` |

---

## 🎓 Evidence Verification Status

- **No hardcoded metric literals in the live pipeline**: `src/eval/evaluation-runner.ts` computes
  every figure by re-running `RuleExecutionEngine.analyzeFile` against real fixtures and diffing
  against real ground truth — never a cached/hand-typed matrix. This is enforced by
  `tests/anti-hardcoding-guard.test.ts` and `tests/research-integrity.test.ts`.
- **Reproducibility**: run `npm run research:evaluate` (regenerates `canonical-evaluation.json` and
  `benchmarks/eval-summary.json` together, always in sync) or `npm test` (also exercises the full
  pipeline). See `reproducibility-manifest.json` for the exact command list.
- **Claim-by-claim traceability**: see `research-claim-traceability.md` in this directory for every
  research claim's classification (VERIFIED / SUPPORTED / PLANNED / NOT VERIFIED / UNSUPPORTED /
  CONTRADICTED) and its evidence source.
