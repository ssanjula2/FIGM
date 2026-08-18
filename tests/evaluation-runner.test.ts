import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvaluationRunner } from '../src/eval/evaluation-runner.js';
import { PrecisionRecallEngine } from '../src/eval/precision-recall-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

describe('FIGM Phase 4 Empirical Evaluation & Dynamic Metrics Engine', () => {
  test('EvaluationRunner executes benchmark testbed and computes metrics dynamically', () => {
    const results = EvaluationRunner.runEvaluation();

    assert.ok(results.overall.truePositives > 0, 'Expected TP > 0');
    assert.equal(results.ruleMetrics.length, 8, 'Expected 8 rule metrics');
    assert.equal(results.frameworkMetrics.length, 4, 'Expected 4 framework metrics');

    // Exact-value regression guard (audit finding QA-03): the controlled benchmark testbed
    // (benchmarks/testbed/, 4 hand-authored fixtures, 19 hand-labelled violations across 8 rules)
    // is fixed and the detection engine is fully deterministic against it -- two independent full
    // reruns during the 2026-08-18 forensic audit reproduced TP=19/FP=2/FN=0 byte-for-byte. A loose
    // ">= 0.8" floor would not catch a real regression (e.g. precision quietly dropping from 0.90 to
    // 0.81), so this asserts the exact current, verified values. If a LEGITIMATE detector
    // improvement to one of the 8 covered rules (FIGM-PERF-01..04, FIGM-A11Y-01..04) genuinely
    // changes these counts on the fixed testbed, that is real information -- update this assertion
    // deliberately, alongside the canonical artifacts (benchmarks/eval-summary.json,
    // docs/evidence/canonical-evaluation.json) and every document that surfaces this number
    // (docs/dissertation/chapter5_*, README, VIVA_PREPARATION_GUIDE.md), not silently.
    assert.equal(results.overall.truePositives, 19, 'Expected exactly 19 true positives on the fixed controlled testbed');
    assert.equal(results.overall.falsePositives, 2, 'Expected exactly 2 false positives on the fixed controlled testbed');
    assert.equal(results.overall.falseNegatives, 0, 'Expected exactly 0 false negatives on the fixed controlled testbed');
    assert.ok(
      Math.abs(results.overall.precision - 19 / 21) < 1e-9,
      `Expected precision to equal 19/21 (TP/(TP+FP)) exactly, got ${results.overall.precision}`
    );
    assert.ok(
      Math.abs(results.overall.recall - 1) < 1e-9,
      `Expected recall to equal 19/19 = 1.0 exactly, got ${results.overall.recall}`
    );
    assert.ok(
      Math.abs(results.overall.f1Score - (2 * (19 / 21) * 1) / (19 / 21 + 1)) < 1e-9,
      `Expected F1 to equal the harmonic mean of the above precision/recall exactly, got ${results.overall.f1Score}`
    );
  });

  test('EvaluationRunner exports benchmark-results.md, benchmark-results.csv, and canonical-evaluation.json', () => {
    const results = EvaluationRunner.runEvaluation();
    EvaluationRunner.exportReports(results);

    const mdPath = path.join(rootDir, 'benchmarks/benchmark-results.md');
    const csvPath = path.join(rootDir, 'benchmarks/benchmark-results.csv');
    const canonicalPath = path.join(rootDir, 'docs/evidence/canonical-evaluation.json');

    assert.ok(fs.existsSync(mdPath), 'Expected benchmark-results.md to exist');
    assert.ok(fs.existsSync(csvPath), 'Expected benchmark-results.csv to exist');
    assert.ok(fs.existsSync(canonicalPath), 'Expected canonical-evaluation.json to exist');

    const canonicalData = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));
    assert.equal(canonicalData.provenance.dynamic, true, 'Expected canonical artifact to have dynamic provenance');
    assert.equal(canonicalData.provenance.generatedBy, 'src/eval/evaluation-runner.ts');
  });

  test('Anti-Hardcoding Suite: PrecisionRecallEngine dynamically computes metrics across varying inputs', () => {
    // TEST 1: Matrix input TP=10, FP=2, FN=3, TN=25
    const metrics1 = PrecisionRecallEngine.calculateMetrics({ tp: 10, fp: 2, fn: 3, tn: 25 });
    assert.equal(metrics1.precision, 83.33); // 10 / 12 = 83.33%
    assert.equal(metrics1.recall, 76.92); // 10 / 13 = 76.92%
    assert.equal(metrics1.f1Score, 80.0); // 2 * 0.8333 * 0.7692 / 1.6025 = 80.0%

    // TEST 2: Adding 1 FP changes precision dynamically
    const metrics2 = PrecisionRecallEngine.calculateMetrics({ tp: 10, fp: 3, fn: 3, tn: 25 });
    assert.notEqual(metrics2.precision, metrics1.precision);
    assert.equal(metrics2.precision, 76.92); // 10 / 13 = 76.92%

    // TEST 3: Empty detection set calculates TP=0, FP=0, FN=groundTruthCount
    const groundTruth = [
      { filePath: 'test1.jsx', ruleId: 'FIGM-PERF-01' },
      { filePath: 'test2.tsx', ruleId: 'FIGM-A11Y-01' }
    ];
    const metrics3 = PrecisionRecallEngine.calculateFromDetections([], groundTruth);
    assert.equal(metrics3.confusionMatrix.tp, 0);
    assert.equal(metrics3.confusionMatrix.fp, 0);
    assert.equal(metrics3.confusionMatrix.fn, 2);
    assert.equal(metrics3.recall, 0);
  });

  test('Dynamic Mutation Suite: Verify metrics change dynamically across input mutations', () => {
    const groundTruth = [
      { filePath: 'ReactBenchmark.jsx', ruleId: 'FIGM-PERF-01' },
      { filePath: 'ReactBenchmark.jsx', ruleId: 'FIGM-A11Y-01' }
    ];
    const detections = [
      { filePath: 'ReactBenchmark.jsx', ruleId: 'FIGM-PERF-01' }
    ];

    // MUTATION A: Baseline detection matching (1 TP, 1 FN, 0 FP)
    const baseRes = PrecisionRecallEngine.calculateFromDetections(detections, groundTruth);
    assert.equal(baseRes.confusionMatrix.tp, 1);
    assert.equal(baseRes.confusionMatrix.fn, 1);

    // MUTATION B: Add non-existent expected violation to ground truth (increases FN)
    const mutatedGT = [...groundTruth, { filePath: 'ReactBenchmark.jsx', ruleId: 'FIGM-NONEXISTENT-01' }];
    const mutBRes = PrecisionRecallEngine.calculateFromDetections(detections, mutatedGT);
    assert.equal(mutBRes.confusionMatrix.fn, 2);
    assert.notEqual(mutBRes.recall, baseRes.recall);

    // MUTATION C: Add extra unexpected diagnostic detection (increases FP)
    const mutatedDetections = [...detections, { filePath: 'ReactBenchmark.jsx', ruleId: 'FIGM-UNEXPECTED-01' }];
    const mutCRes = PrecisionRecallEngine.calculateFromDetections(mutatedDetections, groundTruth);
    assert.equal(mutCRes.confusionMatrix.fp, 1);
    assert.notEqual(mutCRes.precision, baseRes.precision);
  });
});
