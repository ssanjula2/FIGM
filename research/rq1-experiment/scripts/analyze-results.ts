/**
 * RQ1 analysis pipeline (docs/research/RQ1_EXPERIMENT_PROTOCOL.md, Section 9).
 *
 * Reads every raw-result JSON file from a given directory (default: raw-results/, i.e. real
 * measurement runs only -- never raw-results/smoke-test/ unless --include-smoke is passed
 * explicitly), computes per-condition descriptive statistics from the real numbers found there,
 * and writes processed-results/summary.json + summary.md. Pure computation over already-collected
 * data -- this file never launches a browser and never invents a data point.
 *
 * Usage:
 *   node --import tsx research/rq1-experiment/scripts/analyze-results.ts
 *   node --import tsx research/rq1-experiment/scripts/analyze-results.ts --dir raw-results/smoke-test --include-smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidRawResultRow, type RawResultRow, type ConditionId, CONDITIONS } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const experimentDir = path.resolve(__dirname, '..');

export interface ConditionStats {
  conditionId: ConditionId;
  n_valid: number;
  n_failed: number;
  fcp: MetricStats | null;
  tti: MetricStats | null;
}

export interface MetricStats {
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function metricStats(values: number[]): MetricStats | null {
  if (values.length === 0) return null;
  const m = mean(values);
  return {
    mean: m,
    median: median(values),
    sd: stddev(values, m),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * The no-smoke-contamination / no-warmup-contamination guard, extracted as a pure function so it
 * is directly unit-tested (tests/rq1-experiment-analysis.test.ts) without needing to invoke the
 * CLI. Both smoke-test rows and warm-up rows are excluded by default; only an explicit
 * includeSmoke:true / includeWarmup:true lets either through. These are independent switches --
 * passing one does not imply the other.
 */
export function filterMeasuredRows(
  rows: RawResultRow[],
  opts: { includeSmoke?: boolean; includeWarmup?: boolean } = {}
): RawResultRow[] {
  return rows.filter((r) => (opts.includeSmoke || !r.isSmokeTest) && (opts.includeWarmup || !r.isWarmup));
}

export interface ExecutionBreakdown {
  totalExecutions: number;
  smokeExecutions: number;
  warmupExecutions: number;
  measuredExecutions: number;
  validMeasuredN: number;
  failedMeasuredN: number;
}

/**
 * Full, honest accounting of every row in a raw-results directory -- deliberately computed from
 * ALL rows (including smoke and warm-up), never with failures silently dropped, so the audit
 * trail is always reconstructable from this summary alone (docs/research/RQ1_EXPERIMENT_PROTOCOL.md
 * Section 6/8). `totalExecutions` and `smokeExecutions` always reflect the raw, unfiltered truth
 * regardless of `opts` (a smoke row is always counted as smoke). `opts` only controls whether rows
 * that are smoke-labelled are ALSO eligible to be counted into warmup/measured -- kept consistent
 * with filterMeasuredRows' semantics so the two functions never disagree about what "measured"
 * means for the same `opts`. In the real, intended usage (no --include-smoke, no --include-warmup,
 * which is the only way this pipeline is ever run against raw-results/ for actual RQ1 analysis)
 * this distinction never matters, since isSmokeTest is always false there.
 */
export function computeExecutionBreakdown(
  allRows: RawResultRow[],
  opts: { includeSmoke?: boolean; includeWarmup?: boolean } = {}
): ExecutionBreakdown {
  const smokeExecutions = allRows.filter((r) => r.isSmokeTest).length;
  const eligible = allRows.filter((r) => opts.includeSmoke || !r.isSmokeTest);
  const warmupExecutions = eligible.filter((r) => r.isWarmup).length;
  const measured = eligible.filter((r) => !r.isWarmup);
  return {
    totalExecutions: allRows.length,
    smokeExecutions,
    warmupExecutions,
    measuredExecutions: measured.length,
    validMeasuredN: measured.filter((r) => r.status === 'OK').length,
    failedMeasuredN: measured.filter((r) => r.status === 'FAILED').length,
  };
}

export function loadRawResults(dir: string): RawResultRow[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const rows: RawResultRow[] = [];
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    if (!isValidRawResultRow(content)) {
      throw new Error(`Invalid raw result row in ${file} -- refusing to silently skip a malformed file.`);
    }
    rows.push(content);
  }
  return rows;
}

export function analyzeCondition(conditionId: ConditionId, rows: RawResultRow[]): ConditionStats {
  const conditionRows = rows.filter((r) => r.conditionId === conditionId);
  const ok = conditionRows.filter((r) => r.status === 'OK');
  const failed = conditionRows.filter((r) => r.status === 'FAILED');

  const fcpValues = ok.map((r) => r.fcpMs).filter((v): v is number => v !== null);
  const ttiValues = ok.map((r) => r.ttiMs).filter((v): v is number => v !== null);

  return {
    conditionId,
    n_valid: ok.length,
    n_failed: failed.length,
    fcp: metricStats(fcpValues),
    tti: metricStats(ttiValues),
  };
}

export function analyzeAll(rows: RawResultRow[]): ConditionStats[] {
  return CONDITIONS.map((c) => analyzeCondition(c.conditionId, rows));
}

export interface DimensionComparison {
  dimension: 'renderingStrategy' | 'stateManagementStrategy';
  groups: Array<{ label: string; n_valid: number; n_failed: number; fcp: MetricStats | null; tti: MetricStats | null }>;
}

/**
 * Aggregates measured OK rows across conditions sharing a rendering strategy (CSR vs SSR) or a
 * state-management strategy (LOCAL vs GLOBAL) -- docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section
 * 8's required CSR-vs-SSR and LOCAL-vs-GLOBAL comparisons, in addition to the four individual
 * conditions analyzeAll() already reports. Purely descriptive, same as analyzeCondition -- no
 * inferential test is computed here either.
 */
export function compareByDimension(
  rows: RawResultRow[],
  dimension: 'renderingStrategy' | 'stateManagementStrategy'
): DimensionComparison {
  const labels = dimension === 'renderingStrategy' ? (['CSR', 'SSR'] as const) : (['LOCAL', 'GLOBAL'] as const);
  const groups = labels.map((label) => {
    const groupRows = rows.filter((r) => r[dimension] === label);
    const ok = groupRows.filter((r) => r.status === 'OK');
    const failed = groupRows.filter((r) => r.status === 'FAILED');
    return {
      label,
      n_valid: ok.length,
      n_failed: failed.length,
      fcp: metricStats(ok.map((r) => r.fcpMs).filter((v): v is number => v !== null)),
      tti: metricStats(ok.map((r) => r.ttiMs).filter((v): v is number => v !== null)),
    };
  });
  return { dimension, groups };
}

/**
 * Renders a plain-language note about statistical-significance claims. Deliberately conservative:
 * never asserts significance from N < 2 valid runs, and always states this is descriptive, not
 * inferential, statistics unless a real hypothesis test is separately computed and cited.
 */
export function significanceCaveat(stats: ConditionStats[]): string {
  const minN = Math.min(...stats.map((s) => s.n_valid));
  if (stats.some((s) => s.n_valid === 0)) {
    return 'At least one condition has zero valid runs -- no comparison, statistical or otherwise, can be made yet.';
  }
  if (minN < 10) {
    return `The smallest condition has only ${minN} valid run(s) -- below this protocol's minimum repetition target (Section 4). Any difference reported below is descriptive only and must not be read as statistically significant.`;
  }
  return 'Descriptive statistics only (mean/median/SD/min/max). No inferential hypothesis test (e.g. t-test) has been computed in this pipeline; a reported difference in means is not itself a significance claim.';
}

function fmt(m: MetricStats | null): string {
  return m ? `${m.mean.toFixed(1)} / ${m.median.toFixed(1)} / ${m.sd.toFixed(1)} / ${m.min.toFixed(1)} / ${m.max.toFixed(1)}` : 'N/A';
}

function toMarkdown(
  stats: ConditionStats[],
  comparisons: DimensionComparison[],
  breakdown: ExecutionBreakdown,
  meta: { generatedAt: string; sourceDir: string }
): string {
  const conditionRows = stats
    .map((s) => `| ${s.conditionId} | ${s.n_valid} | ${s.n_failed} | ${fmt(s.fcp)} | ${fmt(s.tti)} |`)
    .join('\n');

  const comparisonSections = comparisons
    .map((c) => {
      const rows = c.groups
        .map((g) => `| ${g.label} | ${g.n_valid} | ${g.n_failed} | ${fmt(g.fcp)} | ${fmt(g.tti)} |`)
        .join('\n');
      return `### ${c.dimension === 'renderingStrategy' ? 'CSR vs SSR' : 'LOCAL vs GLOBAL'}\n\n| Group | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |\n|---|---|---|---|---|\n${rows}`;
    })
    .join('\n\n');

  return `# RQ1 Experiment — Processed Results

Generated: ${meta.generatedAt}
Source directory: \`${meta.sourceDir}\`

## Execution accounting (full audit trail -- nothing silently dropped)

| Total executions | Smoke executions | Warm-up executions | Measured executions | Valid measured N | Failed measured N |
|---|---|---|---|---|---|
| ${breakdown.totalExecutions} | ${breakdown.smokeExecutions} | ${breakdown.warmupExecutions} | ${breakdown.measuredExecutions} | ${breakdown.validMeasuredN} | ${breakdown.failedMeasuredN} |

## Per-condition (measured, valid rows only)

| Condition | N valid | N failed | FCP ms (mean/median/SD/min/max) | TTI ms (mean/median/SD/min/max) |
|---|---|---|---|---|
${conditionRows}

## Cross-condition comparisons

${comparisonSections}

${significanceCaveat(stats)}

This is descriptive statistics over a controlled React/Next.js fixture only (see
docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 2/13) -- no causal generalization beyond this
fixture, and no claim about Angular or any other framework's runtime performance, is made or
implied by these numbers.
`;
}

async function main() {
  const argv = process.argv.slice(2);
  const dirIdx = argv.indexOf('--dir');
  const includeSmoke = argv.includes('--include-smoke');
  const includeWarmup = argv.includes('--include-warmup');
  const sourceDir = dirIdx >= 0 ? path.resolve(argv[dirIdx + 1]) : path.join(experimentDir, 'raw-results');

  if (sourceDir.includes('smoke-test') && !includeSmoke) {
    throw new Error('Refusing to analyze a smoke-test directory without --include-smoke -- smoke-test runs must never be presented as RQ1 results.');
  }

  const allRows = loadRawResults(sourceDir);
  const breakdown = computeExecutionBreakdown(allRows, { includeSmoke, includeWarmup });
  const measuredRows = filterMeasuredRows(allRows, { includeSmoke, includeWarmup });
  if (!includeSmoke && allRows.some((r) => r.isSmokeTest)) {
    console.warn('[RQ1-ANALYZE] Warning: some rows in this directory were marked isSmokeTest and have been excluded.');
  }
  if (!includeWarmup && allRows.some((r) => !r.isSmokeTest && r.isWarmup)) {
    console.warn('[RQ1-ANALYZE] Warning: some rows in this directory were marked isWarmup and have been excluded.');
  }

  const stats = analyzeAll(measuredRows);
  const comparisons = [
    compareByDimension(measuredRows, 'renderingStrategy'),
    compareByDimension(measuredRows, 'stateManagementStrategy'),
  ];
  const outDir = path.join(experimentDir, 'processed-results');
  fs.mkdirSync(outDir, { recursive: true });

  const meta = { generatedAt: new Date().toISOString(), sourceDir };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ meta, breakdown, stats, comparisons }, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'summary.md'), toMarkdown(stats, comparisons, breakdown, meta), 'utf-8');

  console.log(`[RQ1-ANALYZE] Read ${allRows.length} total rows (${breakdown.measuredExecutions} measured, ${breakdown.warmupExecutions} warm-up, ${breakdown.smokeExecutions} smoke) from ${sourceDir}`);
  console.log(`[RQ1-ANALYZE] Wrote ${path.join(outDir, 'summary.json')} and summary.md`);
}

if (process.argv[1] === __filename) {
  main();
}
