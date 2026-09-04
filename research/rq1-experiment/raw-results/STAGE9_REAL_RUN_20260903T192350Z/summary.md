# RQ1 Experiment — Processed Results

Generated: 2026-09-03T19:24:49.059Z
Source directory: `C:\Users\MSI\.gemini\antigravity-ide\scratch\figm-model\research\rq1-experiment\raw-results\STAGE9_REAL_RUN_20260903T192350Z\raw`

## Execution accounting (full audit trail -- nothing silently dropped)

| Total executions | Smoke executions | Warm-up executions | Measured executions | Valid measured N | Failed measured N |
|---|---|---|---|---|---|
| 44 | 0 | 4 | 40 | 40 | 0 |

## Per-condition (measured, valid rows only)

| Condition | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
| CSR_LOCAL | 10 | 0 | 439.9 / 439.1 / 2.5 / 437.2 / 445.4 | 464.5 / 463.1 / 4.4 / 459.2 / 472.4 |
| CSR_GLOBAL | 10 | 0 | 441.6 / 437.6 / 9.4 / 435.8 / 462.6 | 464.0 / 460.0 / 9.0 / 457.8 / 484.6 |
| SSR_LOCAL | 10 | 0 | 438.8 / 439.1 / 1.3 / 436.6 / 440.4 | 463.3 / 462.5 / 4.4 / 459.6 / 474.4 |
| SSR_GLOBAL | 10 | 0 | 438.8 / 438.2 / 2.1 / 437.0 / 443.9 | 464.5 / 463.4 / 4.8 / 459.2 / 476.1 |

## Cross-condition comparisons

### CSR vs SSR

| Group | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
| CSR | 20 | 0 | 440.7 / 438.3 / 6.7 / 435.8 / 462.6 | 464.2 / 461.4 / 6.9 / 457.8 / 484.6 |
| SSR | 20 | 0 | 438.8 / 438.7 / 1.7 / 436.6 / 443.9 | 463.9 / 462.8 / 4.5 / 459.2 / 476.1 |

### LOCAL vs GLOBAL

| Group | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
| LOCAL | 20 | 0 | 439.3 / 439.1 / 2.0 / 436.6 / 445.4 | 463.9 / 462.7 / 4.3 / 459.2 / 474.4 |
| GLOBAL | 20 | 0 | 440.2 / 438.0 / 6.7 / 435.8 / 462.6 | 464.2 / 461.6 / 7.0 / 457.8 / 484.6 |

Descriptive statistics only (mean/median/SD/min/max). No inferential hypothesis test (e.g. t-test) has been computed in this pipeline; a reported difference in means is not itself a significance claim.

This is descriptive statistics over a controlled React/Next.js fixture only (see
docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 2/13) -- no causal generalization beyond this
fixture, and no claim about Angular or any other framework's runtime performance, is made or
implied by these numbers.
