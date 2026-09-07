# Real Human Study Analysis

Generated: 2026-09-07T19:12:28.423Z

This report covers three methodologically distinct datasets, kept separate throughout: the real
human study (Sections 1-16), the internal controlled benchmark (Appendix A), and RQ1 runtime
performance (Appendix B). No value in this document is fabricated, estimated, or inferred beyond
what the underlying stored data defensibly supports; missing data is reported as `NOT_AVAILABLE`
or `PENDING`, never invented.

## 1. Dataset and actual participant N

- Target sample size: 20 (P001-P020), per src/research/research-config.ts.
- Eligible PRIMARY scans (one per consenting participant per fixture, per Stage 11B policy): **0**.
- Eligible SECONDARY (repeat) scans: **0**.

> **No real human-study data exists yet.** Every table below reflects the pipeline running correctly against zero eligible rows -- values of 0/NOT_AVAILABLE below are the accurate current state, not a defect.


## 2. Consent and eligibility rules

A scan counts as research data only if: (a) its owner's participant code is a real, in-range study
identifier (P001-P020), (b) that participant's research status is
`CONSENT_VERIFIED`, and (c) the scan was created at/after the exact consent-verification
timestamp. See `ParticipantRepository.getResearchDataset()`'s own doc comment for the full rule;
this report never re-derives it.

## 3. PRIMARY vs SECONDARY policy

The earliest eligible scan per (participant, fixture) pair is `PRIMARY` and is the sole
observation used for descriptive statistics and domain/severity analysis below. Every later
repeat scan of the same fixture is `SECONDARY` -- preserved for repeat-interaction analysis
(Section 13), never counted as an additional primary observation.

## 4. Participant completion

See `research-participant-summary.csv` for the full P001-P020 table.

5 participant(s) not yet CONSENT_VERIFIED have real, already-persisted admin-visible activity from before/without consent verification, preserved in the same CSV's `historical*` columns (`historicalDataSource=PRODUCTION_REAL_HISTORICAL_PARTICIPANT`). This is real data from real users, but it is NOT consent-gated, NOT PRIMARY/SECONDARY research data, and is excluded from every statistic in Sections 5-14 below -- see `ParticipantSummaryRow`'s own doc comment in src/eval/research-analysis-exporter.ts for the exact inclusion rule.


## 5. Framework distribution

| Framework (role) | PRIMARY scans | Architecture | Static Performance | Accessibility | Total findings |
|---|---|---|---|---|---|
| NOT_AVAILABLE | | | | | |

Vue is explicitly **additional implementation support**, not one of this study's three primary
research frameworks (React, Next.js, Angular) -- see `frameworkRoleOf()` in
src/eval/research-analysis-exporter.ts.

## 6. Quality score analysis

NOT_AVAILABLE

## 7. Architecture findings

NOT_AVAILABLE (total: 0)

Most frequent Architecture rules:

| Rank | Rule ID | Count |
|---|---|---|
| NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE |

## 8. Static Performance findings

NOT_AVAILABLE (total: 0)

Most frequent Static Performance rules:

| Rank | Rule ID | Count |
|---|---|---|
| NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE |

## 9. Accessibility findings

NOT_AVAILABLE (total: 0)

Most frequent Accessibility rules:

| Rank | Rule ID | Count |
|---|---|---|
| NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE |

## 10. Framework x domain comparison

See Section 5's table and `research-framework-domain-matrix.csv`.

## 11. Severity distribution

| Scope | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| ALL | 0 | 0 | 0 | 0 | 0 |

## 12. Scan execution diagnostics

- Scan duration (ms): NOT_AVAILABLE
- Engine memory usage (MB, RuleExecutionEngine's own peak-memory measurement -- NOT a runtime
  application memory delta): NOT_AVAILABLE

## 13. Remediation behaviour

- Total real fix attempts (DBAiHistory rows) for eligible participants: 0
- Of which re-scan-verified as applied: 0
- Repeat (SECONDARY) scans of an already-observed fixture: 0

Every AiHistory row is itself a "fix generated + attempted" event; `fixEvents` and
`fixesGenerated` in `research-participant-summary.csv` are therefore the same figure by
construction, not two independently measured counts. A fix is never counted as "applied" merely
because a candidate patch was generated -- only when the pipeline itself re-scanned and verified
the violation gone.

## 14. Before/after remediation outcomes

- Valid before/after pairs (an applied fix event falls chronologically between two same-fixture
  scans of the same participant): **0**
- (Participant, fixture) groups with 2+ scans but no qualifying fix event between any pair: 0

> **NOT_AVAILABLE** -- no defensible before/after pair exists in the current dataset. No pairing is ever inferred from timestamp proximity alone; see `buildBeforeAfterPairs()`.


## 15. Questionnaire/usability results

- Questionnaire data available: NO
- SUS: PENDING
- Cronbach's alpha: PENDING

> PENDING -- no real questionnaire responses have been collected yet (`research/raw/real/responses.csv` does not exist or contains zero valid rows). See research/user-study/README.md for the collection protocol. Per-item (Q1-Q25) descriptive statistics beyond the aggregate SUS/Cronbach metrics already computed by scripts/import-user-study.ts are not yet implemented -- wire in once real responses exist.


## 16. Exclusions

| Exclusion reason | Count |
|---|---|
| Pre-consent scans (created before the participant's verification timestamp) | 60 |
| REVOKED participants | 0 |
| ASSIGNED (not yet consent-verified) participants | 5 |
| SECONDARY scans excluded from PRIMARY-only analysis | 0 |
| Operational/QA-fixture participant codes (P-shaped but out of the P001-P020 range) excluded by construction | 0 |
| Invalid/malformed rows | 0 (none observed -- getResearchDataset() only ever returns structurally valid rows) |

## 17. Limitations

- **Fields with no persisted source**: rulesChecked, rulesEvaluated, complexity, sourceUnits, alpsExtracted -- none of these exist as
  a stored column or a derivable figure anywhere in this codebase as of this export; they are
  omitted from the scan-level CSVs entirely rather than padded with a repeated `NOT_AVAILABLE`
  cell on every row.
- **Remediation telemetry is not scan-linked**: DBAiHistory.scanReportId is frequently null (the
  fix endpoint typically operates on ad-hoc submitted code, not a saved scan id), so
  fix/remediation counts are reported at the participant level and as a standalone events export,
  never joined onto an individual scan row.
- **Before/after pairing is conservative by design**: a pair is only reported when a real,
  re-scan-verified fix event falls between two same-fixture scans of the same participant. Repeat
  scans without such an event are real data (visible in `research-secondary-scans.csv`) but are
  not claimed as a remediation before/after observation.
- **Engine memory/scan duration are not application runtime performance**: `engineMemoryUsageMb`
  is RuleExecutionEngine's own peak memory during static analysis; `scanDurationMs` is the
  engine's own elapsed time. Neither is comparable to RQ1's browser-runtime FCP/TTI measurements
  (Appendix B).
- **Questionnaire per-item statistics**: see Section 15.
- No inferential statistics (t-tests, ANOVA, confidence intervals) are computed anywhere in this
  report -- only descriptive statistics, per the brief's explicit instruction not to run
  inferential tests without a design/sample size that justifies them.

---

## Appendix A: INTERNAL CONTROLLED BENCHMARK

**This is a self-authored fixture/ground-truth benchmark (`benchmarks/testbed` +
`benchmarks/ground-truth.json`), computed live by `EvaluationRunner.runEvaluation()`. It is NOT
human-study accuracy, NOT participant accuracy, NOT independent expert validation, and NOT an RQ4
result** unless independent expert labels are separately obtained and explicitly stated as such.

| Scope | Rule ID | Domain | TP | FP | FN | Ground truth items | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| OVERALL | OVERALL | ALL | 65 | 0 | 0 | 65 | 1.000 | 1.000 | 1.000 |

Full per-rule breakdown: `controlled-benchmark-metrics.csv` (50 rules).
Rule coverage: 50/50 canonical FIGM rules have ground-truth coverage.

## Appendix B: RQ1 RUNTIME PERFORMANCE

**Real, browser-measured FCP/TTI dataset, entirely independent of FIGM's own static-analysis
findings or engine diagnostics.** Per `research/thesis/THESIS_BLOCKER_RESOLUTION.md`'s DECISION 1
(RESOLVED): two real, independently-collected batches exist under the same frozen protocol
(identical Lighthouse 12.8.2 config, identical unmodified fixture/runner code, same 4 conditions,
1 warm-up + 10 measured runs per condition, 44 executions, 0 failures, each). **Batch 1 is PRIMARY;
Batch 2 is REPLICATION evidence. They are never pooled into one figure.**

### Batch 1 (PRIMARY) -- research-freeze-v1, committed

Source: `research/rq1-experiment/processed-results/summary.json` (40 measured executions across 4 conditions).

- **CSR_LOCAL** (n=10): FCP mean 447.48ms (sd 2.51), TTI mean 480.68ms (sd 7.78)
- **CSR_GLOBAL** (n=10): FCP mean 444.19ms (sd 2.47), TTI mean 475.59ms (sd 5.08)
- **SSR_LOCAL** (n=10): FCP mean 444.19ms (sd 2.03), TTI mean 476.69ms (sd 6.34)
- **SSR_GLOBAL** (n=10): FCP mean 444.78ms (sd 1.85), TTI mean 477.98ms (sd 8.70)

### Batch 2 (REPLICATION) -- "Stage 9", research-freeze-v5 baseline, uncommitted on disk

Source: `research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/summary.json` (40 measured executions across 4 conditions).

- **CSR_LOCAL** (n=10): FCP mean 439.85ms (sd 2.52), TTI mean 464.45ms (sd 4.43)
- **CSR_GLOBAL** (n=10): FCP mean 441.58ms (sd 9.35), TTI mean 463.98ms (sd 9.03)
- **SSR_LOCAL** (n=10): FCP mean 438.80ms (sd 1.26), TTI mean 463.30ms (sd 4.35)
- **SSR_GLOBAL** (n=10): FCP mean 438.78ms (sd 2.06), TTI mean 464.48ms (sd 4.80)

No documented methodological reason for Batch 2 to supersede Batch 1 was found (see
THESIS_BLOCKER_RESOLUTION.md DECISION 1 in full) -- both are true replications of one frozen
protocol, not a corrected re-run. Batch 2 is currently uncommitted on disk; if it is to be cited as
replication evidence it should be committed to avoid accidental loss.

staticPerformanceFindings (FIGM's own static-analysis output) is never treated as FCP/TTI;
scanDurationMs/engineMemoryUsageMb (FIGM's own engine diagnostics) are never treated as runtime
application performance. These are three separate measurement systems.
