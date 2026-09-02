# RQ1 FCP/TTI Experiment — Infrastructure

Full protocol and rationale: `docs/research/RQ1_EXPERIMENT_PROTOCOL.md`. This README covers only
how to run the infrastructure in this directory.

## Directory structure

```
research/rq1-experiment/
  README.md               This file.
  protocol.json            Machine-readable condition list, repetition count, tool versions.
  fixtures/                 (see below -- the actual fixture pages live in app/rq1-experiment/)
  scripts/
    schema.ts               Raw-result row type + validator. Shared by the runner and analysis.
    run-experiment.ts        The automated runner (launches Chrome + Lighthouse per run).
    analyze-results.ts       Computes descriptive statistics from raw-results/ into processed-results/.
    _smoke-chrome-launch.mjs SMOKE_TEST -- verifies chrome-launcher can spawn Chrome in this environment.
    _smoke-lighthouse.mjs    SMOKE_TEST -- verifies Lighthouse returns real FCP/TTI numericValue.
  raw-results/              One JSON file per real measurement run. Never hand-edited.
    smoke-test/              SMOKE_TEST-labelled runs only -- excluded from RQ1 analysis by default.
  processed-results/        summary.json / summary.md written by analyze-results.ts.
  environment/
    baseline.json            Recorded control-variable values (OS/CPU/RAM/browser/tool versions).
```

**Fixture pages** live under `app/rq1-experiment/` (a real Next.js App Router route group), not
inside this `research/` directory, because they must be served by the actual running Next.js
production server to be measured by a real browser. `research/rq1-experiment/fixtures/` exists as
the structural location the task specification asked for and holds only a pointer file — see
`fixtures/WHERE_THE_FIXTURES_ACTUALLY_LIVE.md`.

## Running a smoke test (engineering validation only — NOT research data)

```
node --import tsx research/rq1-experiment/scripts/run-experiment.ts --smoke --repetitions 2
```

Writes labelled (`isSmokeTest: true`) rows to `raw-results/smoke-test/`. These must never be
included in RQ1 analysis — `analyze-results.ts` refuses to read that directory unless
`--include-smoke` is passed explicitly, precisely to prevent this mistake.

## Running a real measurement pass

```
node --import tsx research/rq1-experiment/scripts/run-experiment.ts --repetitions 10
node --import tsx research/rq1-experiment/scripts/analyze-results.ts
```

This has **not been run for real data collection as of this writing** — see
`docs/audit/STAGE_3_RQ1_EXPERIMENT_PROTOCOL_REPORT.md`. `REAL_RQ1_RUNS_COLLECTED: 0`.

## What this infrastructure does NOT yet cover

- Angular fixtures (see `protocol.json`'s `frameworksNotYetImplemented`).
- A finalized network-throttling profile decision (`environment/baseline.json`'s open item).
- Statistical hypothesis testing beyond descriptive statistics (`analyze-results.ts`'s
  `significanceCaveat`).
