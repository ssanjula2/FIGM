import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCondition,
  analyzeAll,
  significanceCaveat,
  filterMeasuredRows,
  computeExecutionBreakdown,
  compareByDimension,
  type ConditionStats,
} from '../research/rq1-experiment/scripts/analyze-results.js';
import { EXPERIMENT_VERSION, CONDITIONS, type RawResultRow, type ConditionId } from '../research/rq1-experiment/scripts/schema.js';

// All rows below are SYNTHETIC_TEST_DATA -- hand-authored fixture rows to verify the analysis
// arithmetic against hand-computed expected values, never presented as real experiment data (see
// docs/research/RQ1_EXPERIMENT_PROTOCOL.md's own SYNTHETIC/real distinction discipline, mirroring
// how tests/user-study-pipeline.test.ts treats its own synthetic CSV fixtures).

function okRow(
  conditionId: ConditionId,
  runNumber: number,
  fcpMs: number,
  ttiMs: number,
  opts: { isWarmup?: boolean; isSmokeTest?: boolean } = {}
): RawResultRow {
  return {
    experimentVersion: EXPERIMENT_VERSION,
    conditionId,
    framework: 'NEXTJS_REACT',
    renderingStrategy: conditionId.startsWith('CSR') ? 'CSR' : 'SSR',
    stateManagementStrategy: conditionId.endsWith('LOCAL') ? 'LOCAL' : 'GLOBAL',
    runNumber,
    fcpMs,
    ttiMs,
    status: 'OK',
    error: null,
    browserVersion: 'HeadlessChrome/152.0.0.0',
    nodeVersion: process.version,
    lighthouseVersion: '12.8.2',
    timestamp: new Date().toISOString(),
    isSmokeTest: opts.isSmokeTest ?? false,
    isWarmup: opts.isWarmup ?? false,
  };
}

function failedRow(
  conditionId: ConditionId,
  runNumber: number,
  opts: { isWarmup?: boolean; isSmokeTest?: boolean } = {}
): RawResultRow {
  return {
    experimentVersion: EXPERIMENT_VERSION,
    conditionId,
    framework: 'NEXTJS_REACT',
    renderingStrategy: conditionId.startsWith('CSR') ? 'CSR' : 'SSR',
    stateManagementStrategy: conditionId.endsWith('LOCAL') ? 'LOCAL' : 'GLOBAL',
    runNumber,
    fcpMs: null,
    ttiMs: null,
    status: 'FAILED',
    error: 'synthetic test failure',
    browserVersion: null,
    nodeVersion: process.version,
    lighthouseVersion: null,
    timestamp: new Date().toISOString(),
    isSmokeTest: opts.isSmokeTest ?? false,
    isWarmup: opts.isWarmup ?? false,
  };
}

describe('RQ1 experiment: analysis pipeline correctness (SYNTHETIC_TEST_DATA)', () => {
  test('computes mean/median/SD/min/max exactly against a hand-computed 3-run condition', () => {
    const rows: RawResultRow[] = [
      okRow('CSR_LOCAL', 1, 1000, 1500),
      okRow('CSR_LOCAL', 2, 1100, 1600),
      okRow('CSR_LOCAL', 3, 1200, 1700),
      failedRow('CSR_LOCAL', 4),
    ];

    const stats = analyzeCondition('CSR_LOCAL', rows);

    assert.equal(stats.n_valid, 3);
    assert.equal(stats.n_failed, 1);

    assert.ok(stats.fcp);
    assert.equal(stats.fcp!.mean, 1100);
    assert.equal(stats.fcp!.median, 1100);
    assert.equal(stats.fcp!.sd, 100); // sample stddev, n-1 denominator
    assert.equal(stats.fcp!.min, 1000);
    assert.equal(stats.fcp!.max, 1200);

    assert.ok(stats.tti);
    assert.equal(stats.tti!.mean, 1600);
    assert.equal(stats.tti!.median, 1600);
    assert.equal(stats.tti!.sd, 100);
    assert.equal(stats.tti!.min, 1500);
    assert.equal(stats.tti!.max, 1700);
  });

  test('a condition with zero valid runs reports fcp/tti as null, not zero or NaN', () => {
    const rows: RawResultRow[] = [failedRow('SSR_GLOBAL', 1), failedRow('SSR_GLOBAL', 2)];
    const stats = analyzeCondition('SSR_GLOBAL', rows);
    assert.equal(stats.n_valid, 0);
    assert.equal(stats.n_failed, 2);
    assert.equal(stats.fcp, null);
    assert.equal(stats.tti, null);
  });

  test('rows from a different condition never leak into this condition\'s statistics', () => {
    const rows: RawResultRow[] = [
      okRow('CSR_LOCAL', 1, 100, 200),
      okRow('SSR_LOCAL', 1, 9999, 9999), // should not affect CSR_LOCAL stats
    ];
    const stats = analyzeCondition('CSR_LOCAL', rows);
    assert.equal(stats.n_valid, 1);
    assert.equal(stats.fcp!.mean, 100);
  });

  test('median handles an even-length sample correctly (average of the two middle values)', () => {
    const rows: RawResultRow[] = [
      okRow('SSR_LOCAL', 1, 100, 100),
      okRow('SSR_LOCAL', 2, 200, 200),
      okRow('SSR_LOCAL', 3, 300, 300),
      okRow('SSR_LOCAL', 4, 400, 400),
    ];
    const stats = analyzeCondition('SSR_LOCAL', rows);
    assert.equal(stats.fcp!.median, 250); // (200 + 300) / 2
  });

  test('analyzeAll produces exactly one stats row per condition in schema.CONDITIONS, in a stable order', () => {
    const rows: RawResultRow[] = [okRow('CSR_LOCAL', 1, 100, 200)];
    const all = analyzeAll(rows);
    assert.equal(all.length, 4);
    assert.deepEqual(
      all.map((s) => s.conditionId),
      ['CSR_LOCAL', 'CSR_GLOBAL', 'SSR_LOCAL', 'SSR_GLOBAL']
    );
  });

  describe('filterMeasuredRows: smoke-test AND warm-up rows never silently mix into measured analysis', () => {
    test('excludes isSmokeTest rows by default', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 200),
        okRow('CSR_LOCAL', 2, 999, 999, { isSmokeTest: true }),
      ];
      const measured = filterMeasuredRows(rows);
      assert.equal(measured.length, 1);
      assert.equal(measured[0].fcpMs, 100);
    });

    test('excludes isWarmup rows by default', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 200, { isWarmup: true }),
        okRow('CSR_LOCAL', 1, 150, 250),
      ];
      const measured = filterMeasuredRows(rows);
      assert.equal(measured.length, 1);
      assert.equal(measured[0].fcpMs, 150);
    });

    test('includes smoke rows only when includeSmoke:true is passed explicitly', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 200),
        okRow('CSR_LOCAL', 2, 999, 999, { isSmokeTest: true }),
      ];
      assert.equal(filterMeasuredRows(rows, { includeSmoke: true }).length, 2);
    });

    test('includes warmup rows only when includeWarmup:true is passed explicitly', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 200, { isWarmup: true }),
        okRow('CSR_LOCAL', 1, 150, 250),
      ];
      assert.equal(filterMeasuredRows(rows, { includeWarmup: true }).length, 2);
    });

    test('includeSmoke and includeWarmup are independent switches -- one does not imply the other', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 200, { isSmokeTest: true }),
        okRow('CSR_LOCAL', 1, 200, 300, { isWarmup: true }),
        okRow('CSR_LOCAL', 1, 300, 400),
      ];
      assert.equal(filterMeasuredRows(rows, { includeSmoke: true }).length, 2); // smoke + plain, warmup still excluded
      assert.equal(filterMeasuredRows(rows, { includeWarmup: true }).length, 2); // warmup + plain, smoke still excluded
    });
  });

  describe('computeExecutionBreakdown: full, honest accounting -- nothing silently dropped', () => {
    test('categorizes a mixed batch of smoke / warmup / measured-OK / measured-FAILED rows correctly', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 200, { isSmokeTest: true }),
        okRow('CSR_LOCAL', 1, 110, 210, { isWarmup: true }),
        okRow('CSR_LOCAL', 1, 120, 220),
        okRow('CSR_LOCAL', 2, 130, 230),
        failedRow('CSR_LOCAL', 3),
      ];
      const breakdown = computeExecutionBreakdown(rows);
      assert.equal(breakdown.totalExecutions, 5);
      assert.equal(breakdown.smokeExecutions, 1);
      assert.equal(breakdown.warmupExecutions, 1);
      assert.equal(breakdown.measuredExecutions, 3); // total - smoke - warmup
      assert.equal(breakdown.validMeasuredN, 2);
      assert.equal(breakdown.failedMeasuredN, 1);
    });

    test('a failed row is never silently dropped from the total or from failedMeasuredN', () => {
      const rows: RawResultRow[] = [failedRow('SSR_LOCAL', 1), failedRow('SSR_LOCAL', 2)];
      const breakdown = computeExecutionBreakdown(rows);
      assert.equal(breakdown.totalExecutions, 2);
      assert.equal(breakdown.failedMeasuredN, 2);
      assert.equal(breakdown.validMeasuredN, 0);
    });

    test('REGRESSION GUARD: 1 warm-up + 10 measured runs x 4 conditions resolves to exactly 44 total executions, 4 warm-up, 40 measured', () => {
      const rows: RawResultRow[] = [];
      for (const condition of CONDITIONS) {
        rows.push(okRow(condition.conditionId, 1, 1000, 1500, { isWarmup: true })); // 1 warm-up
        for (let i = 1; i <= 10; i++) {
          rows.push(okRow(condition.conditionId, i, 1000 + i, 1500 + i)); // 10 measured
        }
      }
      const breakdown = computeExecutionBreakdown(rows);
      assert.equal(breakdown.totalExecutions, 44);
      assert.equal(breakdown.warmupExecutions, 4);
      assert.equal(breakdown.measuredExecutions, 40);
      assert.equal(breakdown.validMeasuredN, 40);
    });
  });

  describe('compareByDimension: CSR vs SSR and LOCAL vs GLOBAL aggregate across the matching conditions', () => {
    test('renderingStrategy comparison pools CSR_LOCAL+CSR_GLOBAL vs SSR_LOCAL+SSR_GLOBAL', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 100),
        okRow('CSR_GLOBAL', 1, 200, 200),
        okRow('SSR_LOCAL', 1, 300, 300),
        okRow('SSR_GLOBAL', 1, 400, 400),
      ];
      const cmp = compareByDimension(rows, 'renderingStrategy');
      const csr = cmp.groups.find((g) => g.label === 'CSR')!;
      const ssr = cmp.groups.find((g) => g.label === 'SSR')!;
      assert.equal(csr.n_valid, 2);
      assert.equal(csr.fcp!.mean, 150); // (100+200)/2
      assert.equal(ssr.n_valid, 2);
      assert.equal(ssr.fcp!.mean, 350); // (300+400)/2
    });

    test('stateManagementStrategy comparison pools CSR_LOCAL+SSR_LOCAL vs CSR_GLOBAL+SSR_GLOBAL', () => {
      const rows: RawResultRow[] = [
        okRow('CSR_LOCAL', 1, 100, 100),
        okRow('SSR_LOCAL', 1, 300, 300),
        okRow('CSR_GLOBAL', 1, 200, 200),
        okRow('SSR_GLOBAL', 1, 400, 400),
      ];
      const cmp = compareByDimension(rows, 'stateManagementStrategy');
      const local = cmp.groups.find((g) => g.label === 'LOCAL')!;
      const global = cmp.groups.find((g) => g.label === 'GLOBAL')!;
      assert.equal(local.fcp!.mean, 200); // (100+300)/2
      assert.equal(global.fcp!.mean, 300); // (200+400)/2
    });
  });

  describe('significanceCaveat: never overclaims from a small or empty sample', () => {
    test('flags an empty condition explicitly, before any comparison language', () => {
      const stats: ConditionStats[] = [
        { conditionId: 'CSR_LOCAL', n_valid: 0, n_failed: 0, fcp: null, tti: null },
        { conditionId: 'CSR_GLOBAL', n_valid: 5, n_failed: 0, fcp: { mean: 1, median: 1, sd: 0, min: 1, max: 1 }, tti: { mean: 1, median: 1, sd: 0, min: 1, max: 1 } },
      ];
      const caveat = significanceCaveat(stats);
      assert.match(caveat, /zero valid runs/i);
    });

    test('flags a below-minimum sample size (N < 10) as descriptive-only, not significant', () => {
      const stats: ConditionStats[] = [
        { conditionId: 'CSR_LOCAL', n_valid: 3, n_failed: 0, fcp: { mean: 1, median: 1, sd: 0, min: 1, max: 1 }, tti: { mean: 1, median: 1, sd: 0, min: 1, max: 1 } },
        { conditionId: 'CSR_GLOBAL', n_valid: 12, n_failed: 0, fcp: { mean: 1, median: 1, sd: 0, min: 1, max: 1 }, tti: { mean: 1, median: 1, sd: 0, min: 1, max: 1 } },
      ];
      const caveat = significanceCaveat(stats);
      assert.match(caveat, /descriptive only/i);
      assert.match(caveat, /3/);
    });

    test('at or above the minimum (N >= 10) still never claims inferential significance', () => {
      const stats: ConditionStats[] = [
        { conditionId: 'CSR_LOCAL', n_valid: 10, n_failed: 0, fcp: { mean: 1, median: 1, sd: 0, min: 1, max: 1 }, tti: { mean: 1, median: 1, sd: 0, min: 1, max: 1 } },
        { conditionId: 'CSR_GLOBAL', n_valid: 20, n_failed: 0, fcp: { mean: 1, median: 1, sd: 0, min: 1, max: 1 }, tti: { mean: 1, median: 1, sd: 0, min: 1, max: 1 } },
      ];
      const caveat = significanceCaveat(stats);
      assert.match(caveat, /[Dd]escriptive statistics only/);
      assert.doesNotMatch(caveat, /statistically significant\b(?!.*not)/);
    });
  });
});
