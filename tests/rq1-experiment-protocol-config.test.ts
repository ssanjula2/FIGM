import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, readProtocol } from '../research/rq1-experiment/scripts/run-experiment.js';
import { CONDITIONS, EXPERIMENT_VERSION } from '../research/rq1-experiment/scripts/schema.js';
import { generateItems, ITEM_COUNT } from '../app/rq1-experiment/_shared/generate-items.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const experimentDir = path.join(rootDir, 'research/rq1-experiment');

describe('RQ1 experiment: protocol.json / CLI configuration', () => {
  test('protocol.json exists and measuredRuns meets the frozen minimum of 10', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    assert.ok(protocol.measuredRuns >= 10, `measuredRuns (${protocol.measuredRuns}) must be >= 10 per docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 4/7`);
  });

  test('protocol.json warmupRuns equals the frozen minimum of 1', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    assert.equal(protocol.warmupRuns, 1);
  });

  test('the frozen protocol (1 warmup + 10 measured x 4 conditions) resolves to exactly 44 total executions', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    const total = protocol.conditions.length * (protocol.warmupRuns + protocol.measuredRuns);
    assert.equal(total, 44);
    assert.equal(protocol.conditions.length * protocol.warmupRuns, 4);
    assert.equal(protocol.conditions.length * protocol.measuredRuns, 40);
  });

  test('protocol.json experimentVersion matches schema.ts EXPERIMENT_VERSION (single source of truth)', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    assert.equal(protocol.experimentVersion, EXPERIMENT_VERSION);
  });

  test('protocol.json conditions match schema.ts CONDITIONS exactly (no drift between the two sources)', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    assert.equal(protocol.conditions.length, CONDITIONS.length);
    for (const schemaCondition of CONDITIONS) {
      const protoCondition = protocol.conditions.find((c: any) => c.conditionId === schemaCondition.conditionId);
      assert.ok(protoCondition, `protocol.json is missing condition ${schemaCondition.conditionId}`);
      assert.equal(protoCondition.route, schemaCondition.route);
      assert.equal(protoCondition.renderingStrategy, schemaCondition.renderingStrategy);
      assert.equal(protoCondition.stateManagementStrategy, schemaCondition.stateManagementStrategy);
    }
  });

  test('protocol.json explicitly declares Angular RQ1 runtime fixture as not required (researcher-confirmed scope decision, not a silent omission)', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    assert.equal(protocol.angularRq1RuntimeFixture, 'NOT_REQUIRED_FOR_THIS_EXPERIMENT');
    assert.ok(Array.isArray(protocol.frameworksNotYetImplemented));
    const angularEntry = protocol.frameworksNotYetImplemented.find((f: any) => f.framework === 'Angular');
    assert.ok(angularEntry, 'protocol.json must explicitly record the Angular RQ1-runtime scope decision, not omit it silently');
    assert.equal(angularEntry.status, 'NOT_REQUIRED_FOR_THIS_EXPERIMENT');
  });

  test('protocol.json keeps Angular in FIGM\'s overall primary framework scope (this decision is RQ1-runtime-specific, not a removal of Angular from FIGM)', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    assert.deepEqual(protocol.primaryFigmFrameworkScope, ['React', 'Next.js', 'Angular']);
    assert.equal(protocol.rq1RuntimeFrameworkScope, 'React/Next.js controlled experiment');
  });

  test('protocol.json records a non-empty, fixed network/CPU throttling profile with the exact fields the task requires', () => {
    const protocol = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    const t = protocol.environment.throttling;
    assert.ok(t, 'protocol.json must record an explicit throttling profile, not leave it undocumented');
    for (const field of ['rttMs', 'throughputKbps', 'requestLatencyMs', 'downloadThroughputKbps', 'uploadThroughputKbps', 'cpuSlowdownMultiplier']) {
      assert.ok(field in t, `throttling profile is missing ${field}`);
      assert.equal(typeof t[field], 'number');
    }
    assert.equal(protocol.environment.throttlingMethod, 'simulate');
    assert.ok(protocol.environment.screenEmulation, 'protocol.json must record explicit screenEmulation/viewport settings');
    assert.ok(protocol.environment.emulatedUserAgent, 'protocol.json must record the exact emulated user agent used');
  });

  describe('CLI arg parsing (run-experiment.ts parseArgs)', () => {
    test('defaults: no --smoke, no overrides, port 4173', () => {
      const parsed = parseArgs([]);
      assert.equal(parsed.smoke, false);
      assert.equal(parsed.measuredRunsOverride, undefined);
      assert.equal(parsed.warmupRunsOverride, undefined);
      assert.equal(parsed.conditionsFilter, undefined);
      assert.equal(parsed.port, 4173);
    });

    test('--smoke sets smoke:true', () => {
      assert.equal(parseArgs(['--smoke']).smoke, true);
    });

    test('--measured-runs overrides the protocol default', () => {
      assert.equal(parseArgs(['--measured-runs', '20']).measuredRunsOverride, 20);
    });

    test('--warmup-runs overrides the protocol default', () => {
      assert.equal(parseArgs(['--warmup-runs', '2']).warmupRunsOverride, 2);
    });

    test('--conditions parses a comma-separated subset', () => {
      const parsed = parseArgs(['--conditions', 'CSR_LOCAL,SSR_GLOBAL']);
      assert.deepEqual(parsed.conditionsFilter, ['CSR_LOCAL', 'SSR_GLOBAL']);
    });

    test('--port overrides the default port', () => {
      assert.equal(parseArgs(['--port', '5000']).port, 5000);
    });
  });

  test('readProtocol() reads the real protocol.json measuredRuns/warmupRuns values, not hardcoded literals', () => {
    const real = JSON.parse(fs.readFileSync(path.join(experimentDir, 'protocol.json'), 'utf-8'));
    const read = readProtocol(experimentDir);
    assert.equal(read.measuredRuns, real.measuredRuns);
    assert.equal(read.warmupRuns, real.warmupRuns);
  });
});

describe('RQ1 experiment: fixture content determinism (docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 7)', () => {
  test('generateItems() always produces exactly ITEM_COUNT items', () => {
    assert.equal(generateItems().length, ITEM_COUNT);
  });

  test('generateItems() is deterministic: two independent calls produce byte-identical content', () => {
    const a = generateItems();
    const b = generateItems();
    assert.deepEqual(a, b);
  });

  test('every generated item has non-empty title and body text (real content, not placeholders)', () => {
    for (const item of generateItems()) {
      assert.ok(item.title.length > 0);
      assert.ok(item.body.length > 0);
    }
  });
});
