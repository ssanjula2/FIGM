# RQ1 Real Data Collection — Provenance Record

This record accompanies `summary.json`/`summary.md` (both produced unmodified by the frozen
`analyze-results.ts` pipeline, which has no provenance-stamping fields of its own and was not
edited to add any this stage, per Stage 8's explicit prohibition on modifying frozen components).
It exists only to answer "under what exact frozen baseline was this data collected," never to
add or imply any statistical claim.

| Field | Value |
|---|---|
| Freeze tag | `research-freeze-v1` |
| Freeze baseline commit | `61686e7aabad6f8c2c71b09ca0a5b52c36d08946` |
| Rule-set version | 2.1.0 (`src/research/research-config.ts`, unchanged this stage — RQ1 does not exercise the detection engine at all) |
| RQ1 experiment protocol version | 1.0.0 (`research/rq1-experiment/protocol.json` `experimentVersion`; matches `experimentVersion` recorded in every raw result row) |
| Browser | HeadlessChrome/152.0.0.0 (Chrome 152.0.7977.65 launched headless; exact UA string recorded per-row in raw results) |
| Lighthouse version | 12.8.2 |
| Node version | v22.14.0 |
| Raw-data source directory | `research/rq1-experiment/raw-results/` (44 files: 4 warm-up + 40 measured; `smoke-test/` subdirectory, 6 pre-existing engineering-validation files, untouched and excluded) |
| Analysis script / version | `research/rq1-experiment/scripts/analyze-results.ts`, unmodified this stage; frozen `filterMeasuredRows`/`computeExecutionBreakdown`/`compareByDimension` logic |
| Processed-output timestamp | 2026-09-02T23:38:23.873Z (`summary.json` `meta.generatedAt`) |
| Collection date | 2026-09-03 (Stage 8) |

Full environment control-variable record (OS, CPU, RAM, throttling profile, screen emulation,
etc.), verified identical to the frozen baseline before this run: see
`docs/audit/STAGE_8_REAL_RQ1_DATA_COLLECTION_REPORT.md` Section 3, and
`research/rq1-experiment/environment/baseline.json` (the frozen record it was compared against).
