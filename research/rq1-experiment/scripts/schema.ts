/**
 * RQ1 experiment raw-result schema and validation (docs/research/RQ1_EXPERIMENT_PROTOCOL.md).
 * Shared by run-experiment.ts (which produces rows matching this shape) and analyze-results.ts
 * (which consumes them) -- and directly unit-tested (tests/rq1-experiment-schema.test.ts) without
 * requiring a live browser.
 */

export const EXPERIMENT_VERSION = '1.0.0';

export type RenderingStrategy = 'CSR' | 'SSR';
export type StateManagementStrategy = 'LOCAL' | 'GLOBAL';
export type Framework = 'NEXTJS_REACT';

export type ConditionId = 'CSR_LOCAL' | 'CSR_GLOBAL' | 'SSR_LOCAL' | 'SSR_GLOBAL';

export const CONDITIONS: Array<{
  conditionId: ConditionId;
  framework: Framework;
  renderingStrategy: RenderingStrategy;
  stateManagementStrategy: StateManagementStrategy;
  route: string;
}> = [
  { conditionId: 'CSR_LOCAL', framework: 'NEXTJS_REACT', renderingStrategy: 'CSR', stateManagementStrategy: 'LOCAL', route: '/rq1-experiment/csr-local' },
  { conditionId: 'CSR_GLOBAL', framework: 'NEXTJS_REACT', renderingStrategy: 'CSR', stateManagementStrategy: 'GLOBAL', route: '/rq1-experiment/csr-global' },
  { conditionId: 'SSR_LOCAL', framework: 'NEXTJS_REACT', renderingStrategy: 'SSR', stateManagementStrategy: 'LOCAL', route: '/rq1-experiment/ssr-local' },
  { conditionId: 'SSR_GLOBAL', framework: 'NEXTJS_REACT', renderingStrategy: 'SSR', stateManagementStrategy: 'GLOBAL', route: '/rq1-experiment/ssr-global' },
];

export type RunStatus = 'OK' | 'FAILED';

/** The three mutually-informative-but-independent execution categories (docs/research/RQ1_EXPERIMENT_PROTOCOL.md
 *  Section 4/5). isSmokeTest and isWarmup are separate booleans, not one overloaded flag --
 *  classifyRun() below gives the single precedence rule for deriving a category label. */
export type RunCategory = 'SMOKE_TEST' | 'WARMUP' | 'FINAL_MEASURED_RUN';

/** One raw measurement row -- exactly one real browser execution, or one honestly-recorded failure. */
export interface RawResultRow {
  experimentVersion: string;
  conditionId: ConditionId;
  framework: Framework;
  renderingStrategy: RenderingStrategy;
  stateManagementStrategy: StateManagementStrategy;
  runNumber: number;
  /** Milliseconds, from Lighthouse's first-contentful-paint audit numericValue. null if the run failed. */
  fcpMs: number | null;
  /** Milliseconds, from Lighthouse's interactive (TTI) audit numericValue. null if the run failed. */
  ttiMs: number | null;
  status: RunStatus;
  /** Non-null only when status === 'FAILED'. */
  error: string | null;
  browserVersion: string | null;
  nodeVersion: string;
  lighthouseVersion: string | null;
  timestamp: string;
  /** true for SMOKE_TEST / ENGINEERING_VALIDATION runs -- these must never be included in RQ1 analysis. */
  isSmokeTest: boolean;
  /** true for a warm-up execution (docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 4) -- run for
   *  real, recorded honestly (including on failure), but excluded from measured statistics by
   *  default. Independent of isSmokeTest: a row can in principle be either, both, or neither. */
  isWarmup: boolean;
}

/**
 * Single precedence rule for turning the two independent flags into one category label:
 * SMOKE_TEST takes precedence over WARMUP (a warm-up executed during engineering validation is
 * still, first and foremost, not research data), then WARMUP, then FINAL_MEASURED_RUN.
 */
export function classifyRun(row: Pick<RawResultRow, 'isSmokeTest' | 'isWarmup'>): RunCategory {
  if (row.isSmokeTest) return 'SMOKE_TEST';
  if (row.isWarmup) return 'WARMUP';
  return 'FINAL_MEASURED_RUN';
}

export function isValidRawResultRow(row: unknown): row is RawResultRow {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;

  if (typeof r.experimentVersion !== 'string') return false;
  if (!CONDITIONS.some((c) => c.conditionId === r.conditionId)) return false;
  if (r.framework !== 'NEXTJS_REACT') return false;
  if (r.renderingStrategy !== 'CSR' && r.renderingStrategy !== 'SSR') return false;
  if (r.stateManagementStrategy !== 'LOCAL' && r.stateManagementStrategy !== 'GLOBAL') return false;
  if (typeof r.runNumber !== 'number' || r.runNumber < 1) return false;
  if (r.status !== 'OK' && r.status !== 'FAILED') return false;

  // The core no-fabrication invariant: a successful run must carry real numeric metrics; a failed
  // run must carry null metrics, never a placeholder like 0. This is the single most important
  // check in this schema -- see docs/research/RQ1_EXPERIMENT_PROTOCOL.md's explicit prohibition on
  // ever substituting 0 for a legitimately unavailable metric.
  if (r.status === 'OK') {
    if (typeof r.fcpMs !== 'number' || !Number.isFinite(r.fcpMs) || r.fcpMs <= 0) return false;
    if (typeof r.ttiMs !== 'number' || !Number.isFinite(r.ttiMs) || r.ttiMs <= 0) return false;
    if (r.error !== null) return false;
  } else {
    if (r.fcpMs !== null) return false;
    if (r.ttiMs !== null) return false;
    if (typeof r.error !== 'string' || r.error.length === 0) return false;
  }

  if (typeof r.nodeVersion !== 'string') return false;
  if (typeof r.timestamp !== 'string') return false;
  if (typeof r.isSmokeTest !== 'boolean') return false;
  if (typeof r.isWarmup !== 'boolean') return false;

  return true;
}
