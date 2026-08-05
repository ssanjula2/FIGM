import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvaluationRunner } from '../src/eval/evaluation-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

describe('FIGM Phase 4 Empirical Evaluation & Metrics Engine', () => {
  test('EvaluationRunner executes benchmark testbed and computes metrics', () => {
    const results = EvaluationRunner.runEvaluation();

    assert.ok(results.overall.truePositives > 0, 'Expected TP > 0');
    assert.equal(results.ruleMetrics.length, 8, 'Expected 8 rule metrics');
    assert.equal(results.frameworkMetrics.length, 4, 'Expected 4 framework metrics');

    assert.ok(results.overall.precision >= 0.8, 'Expected Precision >= 80%');
    assert.ok(results.overall.recall >= 0.8, 'Expected Recall >= 80%');
    assert.ok(results.overall.f1Score >= 0.8, 'Expected F1-Score >= 80%');
  });

  test('EvaluationRunner exports benchmark-results.md and benchmark-results.csv', () => {
    const results = EvaluationRunner.runEvaluation();
    EvaluationRunner.exportReports(results);

    const mdPath = path.join(rootDir, 'benchmarks/benchmark-results.md');
    const csvPath = path.join(rootDir, 'benchmarks/benchmark-results.csv');

    assert.ok(fs.existsSync(mdPath), 'Expected benchmark-results.md to exist');
    assert.ok(fs.existsSync(csvPath), 'Expected benchmark-results.csv to exist');

    const mdText = fs.readFileSync(mdPath, 'utf-8');
    const csvText = path.join(rootDir, 'benchmarks/benchmark-results.csv');

    assert.ok(mdText.includes('FIGM Static Analyzer Benchmark'), 'MD missing title');
    assert.ok(mdText.includes('Precision'), 'MD missing Precision');
    assert.ok(mdText.includes('F1-Score'), 'MD missing F1-Score');
  });
});
