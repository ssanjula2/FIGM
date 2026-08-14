# FIGM Research Claim Traceability & Verification Matrix

**Last reconciled**: 2026-08-14, as part of a full repository-wide claim reconciliation pass.
**Canonical Ground Truth**: `docs/evidence/canonical-evaluation.json` (kept in sync with
`benchmarks/eval-summary.json` by construction — both are written by the same
`EvaluationRunner.exportReports()` call).

**Classification taxonomy** (applied to every claim below):
- **VERIFIED** — directly computed by a live, reproducible command right now, and confirmed to match.
- **SUPPORTED** — true and evidenced, but not itself a live numeric benchmark (e.g. an architectural fact confirmed by reading source).
- **PLANNED** — a real intention/roadmap item, explicitly not yet done.
- **NOT VERIFIED** — plausible but no reproducible evidence currently confirms it.
- **UNSUPPORTED** — asserted somewhere in the project's history with no evidence behind it at all.
- **CONTRADICTED** — asserted somewhere, but current evidence actively disproves it.

---

## Metric Traceability Matrix

| # | Claim | Claim Location(s) | Evidence Source | Current Value | Status |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Precision** | `/analytics`, `/api/research-metrics`, `BenchmarkSection.tsx`, dissertation Ch. 5 | `src/eval/evaluation-runner.ts` → `benchmarks/eval-summary.json` / `canonical-evaluation.json`, re-run live | **90.5%** (19 TP / 21 flagged) | **VERIFIED** |
| 2 | **Recall** | same | same | **100.0%** (19/19 ground truth) | **VERIFIED** |
| 3 | **F1-Score** | same | same | **95.0%** | **VERIFIED** |
| 4 | **Scan throughput (LOC/sec)** | `/analytics`, dissertation Ch. 5 | `canonical-evaluation.json::performance.scanSpeedLOCPerSec` | Varies per run (JIT warmup); last observed ≈689 LOC/s — read live, never hardcoded | **VERIFIED** |
| 5 | **"25 rules" (rule set size)** | README, guidelines page, dissertation, landing page | `src/matrix/four-layer-meta-model.ts::FOUR_LAYER_MAPPINGS.length` | **25** | **VERIFIED** |
| 6 | **"23 rules real-AST"** | README, `docs/architecture/RULE_ENGINEERING_AUDIT.md` | Direct count of rules migrated in `src/ast/real-syntax-node-builder.ts` (Groups 1–4) vs. legacy | **23 of 25** (FIGM-ANG-03/04 remain legacy — need `@angular/compiler`; all 25 remain legacy on Vue/Svelte) | **VERIFIED** |
| 7 | **Rule-coverage of the empirical benchmark ("only 8 of 25 rules measured")** | `canonical-evaluation.json::ruleCoverage`, dissertation Ch. 5 §5.1.1, `/analytics` | `benchmarks/ground-truth.json`'s actual distinct rule IDs | **8 of 25**: `FIGM-PERF-01..04`, `FIGM-A11Y-01..04`. The other 17 rules are unit-tested (positive/negative fixtures) but have **no empirical ground-truth benchmark coverage**. | **VERIFIED** — and must accompany every mention of claim #1–3 above |
| 8 | **30-repository / 755k-LOC large-scale evaluation** | *(formerly)* dissertation, various root audit docs | *(formerly)* `src/eval/repo-evaluator.ts` — a 30-record array of invented repo names/URLs (e.g. `exchangerates/dashboard`, which does not exist) and fabricated LOC/violation/score figures | No repository was ever cloned or scanned. Dataset and generator deleted. | **CONTRADICTED** (asserted historically; disproved by direct inspection — no such code path exists) |
| 9 | **85.7% / 94.7% / 90.0% F1 (the old confusion-matrix figures)** | *(formerly)* dissertation Ch. 5, several archived root audit docs | *(formerly)* `EMPIRICAL_EXPERT_GROUND_TRUTH` hardcoded `{tp:18,fp:3,fn:1,tn:25}` constant in `src/eval/precision-recall-engine.ts` — disconnected from the real benchmark pipeline | Constant deleted; superseded by claims #1–3 (90.5%/100%/95.0%). **Any document still showing 85.7%/94.7%/90.0% is stale** — see `docs/audit/archive/README.md`. | **CONTRADICTED** by current canonical figures (was a real but disconnected computation at the time, now superseded) |
| 10 | **100% precision / 100% recall / 100% F1** | Not found asserted as a current live benchmark result anywhere in the current codebase. `audit/new.md` and the two guides mention 100% only in isolated per-rule/per-category contexts (e.g. a single rule scoring 100% recall within the 8-rule subset, or a synthetic-formula-verification pass rate) — never as the overall live benchmark headline. | n/a | The overall live benchmark is 90.5%/100%/95.0% (claim #1–3), not 100%/100%/100%. | **NOT VERIFIED** as an overall claim — flagged for removal if found asserted as such (see viva/demo guide audit) |
| 11 | **N=85 human usability study, SUS=86.4, Cronbach's α** | *(formerly)* `docs/evidence/EVIDENCE_INDEX.md`, `docs/evidence/user-study/user-study-results.json` (both since corrected) | `research/analysis/usability-results.json`, `src/eval/user-study-evaluator.ts`, `GET /api/research-metrics::userStudy` | **0 of 85 real participants collected.** SUS/Cronbach's α reported nowhere as real; only as an explicitly-labelled `SYNTHETIC_PIPELINE_TEST_DATA` formula-verification vector (α≈0.85–0.89 on synthetic data, never presented as a human result). | **PLANNED** (collection not yet run) — any prior presentation of 86.4/0.89 as real results was **CONTRADICTED**/**UNSUPPORTED** and has been corrected |
| 12 | **AI patch success rate** | *(formerly)* dissertation Ch. 5 §5.3, `src/eval/ai-patch-evaluator.ts` (deleted) | *(formerly)* hardcoded `totalDefectsIdentified=450, patchesGenerated=434, compilationPasses=426, violationsResolved=412` — no real remediation run behind them | No aggregate success-rate benchmark has been run. Per-fix verification (re-scan confirms the violation is gone) does exist and is tested — see `src/engine/remediation-engine.ts::validatePatch`, `tests/live-scan-e2e.test.ts`. | **UNSUPPORTED** (aggregate rate) / **SUPPORTED** (per-fix verification mechanism exists and is tested) |
| 13 | **Competitor latency (Lighthouse/ESLint/SonarQube execution-time comparison)** | *(formerly)* `src/eval/tool-benchmark.ts`'s `TOOL_COMPARISON_MATRIX.executionSpeedMs`, dissertation Ch. 5 §5.2 | No benchmark harness anywhere in this repo runs any competitor tool | Field removed. The tool-comparison table is now an explicitly-labelled *qualitative capability comparison* (static analysis? AI remediation? — yes/no), never a timing/percentage claim. | **UNSUPPORTED** (as a quantitative claim) — now removed; qualitative comparison remains and is **SUPPORTED** (verifiable against each tool's public documentation) |
| 14 | **"AST-based" / "unified AST traversal" detection** | README, dissertation, `docs/architecture/AST_MIGRATION_MAP.md` | `src/ast/real-syntax-node-builder.ts`, `src/parser/typescript-framework-parser.ts` (wraps the real TypeScript compiler API) | **True for 23/25 rules** on React/Next.js/plain JS-TS/Angular-class-body files (see claim #6). **Not true** for FIGM-ANG-03/04 (Angular template markup) or any rule on Vue/Svelte files, which remain `LEGACY_TEXT_HEURISTIC` — every diagnostic is labeled with its real `sourceKind` so this is never silently implied. | **VERIFIED** (with the explicit scope above — never claimed unconditionally) |
| 15 | **"MSc" degree level** | Historically appeared in some generated exports; the actual project metadata everywhere else (README, `/api/research-metrics`, dissertation front matter) states **IS303.2 Research Methodology Repeat Coursework 2025, NSBM Green University** (an undergraduate-level module code, not a Master's designation) | `app/api/research-metrics/route.ts::dissertation.module`, dissertation chapters | Project is **not** an MSc thesis. Confirmed no live page currently states "MSc" (see repository-wide search, below). | **CONTRADICTED** where "MSc" was previously asserted; current live surfaces are correct |
| 16 | **"verified" / "certified" badges** | *(formerly)* README badges: "Code Quality 96/100", "Security 94/100", "Dissertation: 100% compliant" | No computation anywhere in the codebase backed these | Already removed by a prior commit; README now explicitly documents their removal and why. The only current badge (test pass count) is read from a real `npm test` run. | **CONTRADICTED** (historically) — already corrected, no live claim remains |
| 17 | **"production SaaS"** | README, `app/page.tsx` marketing copy | Multi-tenant architecture (`src/storage/`, `src/auth/`), real Postgres/Supabase persistence, real JWT auth — but no public production deployment with real paying tenants exists | The *architecture* is SaaS-shaped and multi-tenant (SUPPORTED), but no claim of a live production deployment with real users should be read into this phrase | **SUPPORTED** (architecture) — flagged so it is never read as "deployed and serving real customers" |

---

## Methodological Notes

1. **Ground-Truth Benchmark Suite**: evaluated directly against 4 framework fixture files (147 LOC
   total: React, Vue, Angular, vanilla JS/generic), yielding 19 True Positives, 2 False Positives, 0
   False Negatives against the 8 rules with hand-labelled ground truth. This is the only empirical
   accuracy evaluation in the project — it does not, and must never be described as if it did, cover
   all 25 rules.
2. **30-Repository Dataset — Retracted**: previously described in earlier project history as a
   "benchmark vector." The dataset, its generator code, and every UI/documentation claim depending
   on it have been deleted or rewritten to state plainly that no large-scale evaluation was
   performed.
3. **85-Participant Usability Model**: a synthetic vector used only to verify the Cronbach's Alpha /
   Likert-aggregation formulas compute correctly. It is not, and must never be presented as, real
   human usability data. Real data collection status is 0/85 as of this document's last reconciliation.
4. **Dead-parallel-pipeline bug (root cause of claims #9, #12, #13's original fabrication)**: for a
   period of this project's history, `src/eval/thesis-gap-exporter.ts` built the dissertation's
   empirical chapter from a hand-typed confusion matrix (`EMPIRICAL_EXPERT_GROUND_TRUTH`) and two
   further hardcoded modules (`ai-patch-evaluator.ts`, `tool-benchmark.ts`'s latency field) —
   completely disconnected from the real, live `EvaluationRunner` pipeline that already correctly
   powered the UI. This produced three internally-contradictory "Chapter 5" documents, none matching
   the real benchmark. Fixed by rewiring the exporter onto the live pipeline directly; see commit
   `b31ae713`.
