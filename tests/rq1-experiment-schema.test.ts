import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidRawResultRow, classifyRun, CONDITIONS, EXPERIMENT_VERSION, type RawResultRow } from '../research/rq1-experiment/scripts/schema.js';

function validOkRow(overrides: Partial<RawResultRow> = {}): RawResultRow {
  return {
    experimentVersion: EXPERIMENT_VERSION,
    conditionId: 'CSR_LOCAL',
    framework: 'NEXTJS_REACT',
    renderingStrategy: 'CSR',
    stateManagementStrategy: 'LOCAL',
    runNumber: 1,
    fcpMs: 1200.5,
    ttiMs: 1800.2,
    status: 'OK',
    error: null,
    browserVersion: 'HeadlessChrome/152.0.0.0',
    nodeVersion: process.version,
    lighthouseVersion: '12.8.2',
    timestamp: new Date().toISOString(),
    isSmokeTest: false,
    isWarmup: false,
    ...overrides,
  };
}

function validFailedRow(overrides: Partial<RawResultRow> = {}): RawResultRow {
  return {
    experimentVersion: EXPERIMENT_VERSION,
    conditionId: 'SSR_GLOBAL',
    framework: 'NEXTJS_REACT',
    renderingStrategy: 'SSR',
    stateManagementStrategy: 'GLOBAL',
    runNumber: 3,
    fcpMs: null,
    ttiMs: null,
    status: 'FAILED',
    error: 'Chrome crashed during navigation',
    browserVersion: null,
    nodeVersion: process.version,
    lighthouseVersion: null,
    timestamp: new Date().toISOString(),
    isSmokeTest: false,
    isWarmup: false,
    ...overrides,
  };
}

describe('RQ1 experiment: raw-result schema (docs/research/RQ1_EXPERIMENT_PROTOCOL.md)', () => {
  describe('condition metadata', () => {
    test('CONDITIONS defines exactly the four Next.js/React conditions this stage implements', () => {
      assert.equal(CONDITIONS.length, 4);
      const ids = CONDITIONS.map((c) => c.conditionId).sort();
      assert.deepEqual(ids, ['CSR_GLOBAL', 'CSR_LOCAL', 'SSR_GLOBAL', 'SSR_LOCAL']);
    });

    test('every condition is framework NEXTJS_REACT and has a distinct, real-looking route', () => {
      const routes = new Set<string>();
      for (const c of CONDITIONS) {
        assert.equal(c.framework, 'NEXTJS_REACT');
        assert.ok(c.route.startsWith('/rq1-experiment/'), `route ${c.route} should be under /rq1-experiment/`);
        assert.ok(!routes.has(c.route), `duplicate route ${c.route}`);
        routes.add(c.route);
      }
    });

    test('rendering/state combinations cover the full 2x2 matrix exactly once each', () => {
      const combos = CONDITIONS.map((c) => `${c.renderingStrategy}_${c.stateManagementStrategy}`).sort();
      assert.deepEqual(combos, ['CSR_GLOBAL', 'CSR_LOCAL', 'SSR_GLOBAL', 'SSR_LOCAL']);
    });
  });

  describe('valid rows accepted', () => {
    test('a well-formed OK row passes validation', () => {
      assert.equal(isValidRawResultRow(validOkRow()), true);
    });

    test('a well-formed FAILED row passes validation', () => {
      assert.equal(isValidRawResultRow(validFailedRow()), true);
    });
  });

  describe('no-fabrication guard: OK rows must carry real numeric metrics, never a placeholder', () => {
    test('rejects an OK row with fcpMs: 0 (0 is not a legitimate FCP/TTI value, and must not be usable as a disguised placeholder)', () => {
      assert.equal(isValidRawResultRow(validOkRow({ fcpMs: 0 })), false);
    });

    test('rejects an OK row with ttiMs: 0', () => {
      assert.equal(isValidRawResultRow(validOkRow({ ttiMs: 0 })), false);
    });

    test('rejects an OK row with fcpMs: null', () => {
      assert.equal(isValidRawResultRow(validOkRow({ fcpMs: null })), false);
    });

    test('rejects an OK row with ttiMs: null', () => {
      assert.equal(isValidRawResultRow(validOkRow({ ttiMs: null })), false);
    });

    test('rejects an OK row with a non-finite fcpMs (NaN)', () => {
      assert.equal(isValidRawResultRow(validOkRow({ fcpMs: NaN })), false);
    });

    test('rejects an OK row with a negative ttiMs', () => {
      assert.equal(isValidRawResultRow(validOkRow({ ttiMs: -5 })), false);
    });

    test('rejects an OK row that still carries a non-null error', () => {
      assert.equal(isValidRawResultRow(validOkRow({ error: 'should not be here' })), false);
    });
  });

  describe('failure-recording guard: FAILED rows must never carry fabricated metrics', () => {
    test('rejects a FAILED row with a non-null fcpMs (a failure must never carry a real-looking metric)', () => {
      assert.equal(isValidRawResultRow(validFailedRow({ fcpMs: 1500 })), false);
    });

    test('rejects a FAILED row with fcpMs: 0 (0 must never stand in for "measurement unavailable")', () => {
      assert.equal(isValidRawResultRow(validFailedRow({ fcpMs: 0, ttiMs: 0 })), false);
    });

    test('rejects a FAILED row with an empty error string (a failure must carry a real message)', () => {
      assert.equal(isValidRawResultRow(validFailedRow({ error: '' })), false);
    });

    test('rejects a FAILED row with error: null', () => {
      assert.equal(isValidRawResultRow(validFailedRow({ error: null })), false);
    });
  });

  describe('structural rejection', () => {
    test('rejects null/undefined/non-object input', () => {
      assert.equal(isValidRawResultRow(null), false);
      assert.equal(isValidRawResultRow(undefined), false);
      assert.equal(isValidRawResultRow('not an object'), false);
      assert.equal(isValidRawResultRow(42), false);
    });

    test('rejects an unknown conditionId', () => {
      assert.equal(isValidRawResultRow(validOkRow({ conditionId: 'ANGULAR_CSR_LOCAL' as any })), false);
    });

    test('rejects an unknown framework', () => {
      assert.equal(isValidRawResultRow(validOkRow({ framework: 'ANGULAR' as any })), false);
    });

    test('rejects an unknown renderingStrategy (e.g. a silently-substituted SSG)', () => {
      assert.equal(isValidRawResultRow(validOkRow({ renderingStrategy: 'SSG' as any })), false);
    });

    test('rejects runNumber < 1', () => {
      assert.equal(isValidRawResultRow(validOkRow({ runNumber: 0 })), false);
    });

    test('rejects an unknown status value', () => {
      assert.equal(isValidRawResultRow(validOkRow({ status: 'PENDING' as any })), false);
    });

    test('rejects a row missing isSmokeTest', () => {
      const row = validOkRow() as any;
      delete row.isSmokeTest;
      assert.equal(isValidRawResultRow(row), false);
    });

    test('rejects a row missing isWarmup', () => {
      const row = validOkRow() as any;
      delete row.isWarmup;
      assert.equal(isValidRawResultRow(row), false);
    });
  });

  describe('classifyRun: isSmokeTest and isWarmup are independent, never overloaded into one flag', () => {
    test('a plain measured row (both false) classifies as FINAL_MEASURED_RUN', () => {
      assert.equal(classifyRun({ isSmokeTest: false, isWarmup: false }), 'FINAL_MEASURED_RUN');
    });

    test('a warm-up row (isWarmup true, isSmokeTest false) classifies as WARMUP', () => {
      assert.equal(classifyRun({ isSmokeTest: false, isWarmup: true }), 'WARMUP');
    });

    test('a smoke-test row (isSmokeTest true, isWarmup false) classifies as SMOKE_TEST', () => {
      assert.equal(classifyRun({ isSmokeTest: true, isWarmup: false }), 'SMOKE_TEST');
    });

    test('a row that is both smoke AND warmup classifies as SMOKE_TEST (precedence rule, not an invalid/ambiguous state)', () => {
      assert.equal(classifyRun({ isSmokeTest: true, isWarmup: true }), 'SMOKE_TEST');
    });
  });
});
