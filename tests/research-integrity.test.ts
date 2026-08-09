import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Research Integrity & Metric Consistency Test Suite', async (t) => {
  await t.test('Canonical evaluation JSON exists and matches benchmarks/eval-summary.json', () => {
    const canonicalPath = path.resolve(process.cwd(), 'docs/evidence/canonical-evaluation.json');
    const summaryPath = path.resolve(process.cwd(), 'benchmarks/eval-summary.json');

    assert.ok(fs.existsSync(canonicalPath), 'canonical-evaluation.json must exist');
    assert.ok(fs.existsSync(summaryPath), 'eval-summary.json must exist');

    const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    assert.equal(canonical.overall.truePositives, summary.overall.truePositives);
    assert.equal(canonical.overall.falsePositives, summary.overall.falsePositives);
    assert.equal(canonical.overall.falseNegatives, summary.overall.falseNegatives);
  });

  await t.test('Precision, Recall, and F1 calculations are mathematically accurate', () => {
    const canonicalPath = path.resolve(process.cwd(), 'docs/evidence/canonical-evaluation.json');
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

    const { truePositives: tp, falsePositives: fp, falseNegatives: fn } = canonical.overall;
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    const f1 = (2 * precision * recall) / (precision + recall);

    assert.ok(Math.abs(canonical.overall.precision - precision) < 0.01);
    assert.ok(Math.abs(canonical.overall.recall - recall) < 0.01);
    assert.ok(Math.abs(canonical.overall.f1Score - f1) < 0.01);
  });

  await t.test('Reproducibility manifest exists and defines required validation commands', () => {
    const manifestPath = path.resolve(process.cwd(), 'docs/evidence/reproducibility-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'reproducibility-manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(Array.isArray(manifest.reproducibilityCommands));
    assert.ok(manifest.reproducibilityCommands.length >= 3);
  });
});
