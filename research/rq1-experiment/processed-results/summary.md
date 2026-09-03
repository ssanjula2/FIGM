# RQ1 Experiment — Processed Results

Generated: 2026-09-03T04:28:15.683Z
Source directory: `C:\Users\MSI\.gemini\antigravity-ide\scratch\figm-model\research\rq1-experiment\raw-results`

## Execution accounting (full audit trail -- nothing silently dropped)

| Total executions | Smoke executions | Warm-up executions | Measured executions | Valid measured N | Failed measured N |
|---|---|---|---|---|---|
| 44 | 0 | 4 | 40 | 40 | 0 |

## Per-condition (measured, valid rows only)

| Condition | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
| CSR_LOCAL | 10 | 0 | 447.5 / 446.6 / 2.5 / 443.7 / 450.7 | 480.7 / 479.2 / 7.8 / 471.2 / 490.6 |
| CSR_GLOBAL | 10 | 0 | 444.2 / 443.9 / 2.5 / 441.4 / 448.7 | 475.6 / 475.1 / 5.1 / 468.0 / 483.4 |
| SSR_LOCAL | 10 | 0 | 444.2 / 444.0 / 2.0 / 441.8 / 448.8 | 476.7 / 474.0 / 6.3 / 470.5 / 486.8 |
| SSR_GLOBAL | 10 | 0 | 444.8 / 444.8 / 1.9 / 441.7 / 447.8 | 478.0 / 475.7 / 8.7 / 465.7 / 490.8 |

## Cross-condition comparisons

### CSR vs SSR

| Group | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
| CSR | 20 | 0 | 445.8 / 445.8 / 3.0 / 441.4 / 450.7 | 478.1 / 476.5 / 6.9 / 468.0 / 490.6 |
| SSR | 20 | 0 | 444.5 / 444.4 / 1.9 / 441.7 / 448.8 | 477.3 / 474.9 / 7.4 / 465.7 / 490.8 |

### LOCAL vs GLOBAL

| Group | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
| LOCAL | 20 | 0 | 445.8 / 445.5 / 2.8 / 441.8 / 450.7 | 478.7 / 477.4 / 7.2 / 470.5 / 490.6 |
| GLOBAL | 20 | 0 | 444.5 / 444.5 / 2.1 / 441.4 / 448.7 | 476.8 / 475.1 / 7.0 / 465.7 / 490.8 |

Descriptive statistics only (mean/median/SD/min/max). No inferential hypothesis test (e.g. t-test) has been computed in this pipeline; a reported difference in means is not itself a significance claim.

This is descriptive statistics over a controlled React/Next.js fixture only (see
docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 2/13) -- no causal generalization beyond this
fixture, and no claim about Angular or any other framework's runtime performance, is made or
implied by these numbers.
