import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GET as researchMetricsGET } from '../app/api/research-metrics/route.js';

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

  // --- Single-source-of-truth consistency guards (req: "a test that fails if the displayed
  // metrics diverge from the canonical evaluation output") ---------------------------------------

  await t.test('GET /api/research-metrics benchmarkMetrics match docs/evidence/canonical-evaluation.json exactly', async () => {
    const canonicalPath = path.resolve(process.cwd(), 'docs/evidence/canonical-evaluation.json');
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

    const res = await researchMetricsGET();
    assert.equal(res.status, 200);
    const body = await res.json();
    const bm = body.benchmarkMetrics;

    assert.ok(bm, 'expected /api/research-metrics to return benchmarkMetrics (eval-summary.json must exist)');
    assert.equal(bm.truePositives, canonical.overall.truePositives);
    assert.equal(bm.falsePositives, canonical.overall.falsePositives);
    assert.equal(bm.falseNegatives, canonical.overall.falseNegatives);
    // canonical-evaluation.json intentionally rounds precision/recall/f1Score to 4 decimal places
    // (see EvaluationRunner.exportReports's canonicalArtifact.overall), while eval-summary.json
    // (what the API reads) keeps full float precision -- a tolerance of 1e-3 safely absorbs that
    // known, intentional rounding difference while still catching a genuine divergence bug (e.g.
    // the API reading a stale file, or a real precision/recall calculation mismatch).
    assert.ok(Math.abs(bm.precision - canonical.overall.precision) < 1e-3);
    assert.ok(Math.abs(bm.recall - canonical.overall.recall) < 1e-3);
    assert.ok(Math.abs(bm.f1Score - canonical.overall.f1Score) < 1e-3);
  });

  await t.test('docs/dissertation/chapter5_empirical_validation_and_benchmarks.md embedded TP/FP/FN match docs/evidence/canonical-evaluation.json exactly', () => {
    const canonicalPath = path.resolve(process.cwd(), 'docs/evidence/canonical-evaluation.json');
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

    const ch5Path = path.resolve(process.cwd(), 'docs/dissertation/chapter5_empirical_validation_and_benchmarks.md');
    assert.ok(fs.existsSync(ch5Path), 'chapter5_empirical_validation_and_benchmarks.md must exist (run npm run research:evaluate)');
    const ch5 = fs.readFileSync(ch5Path, 'utf-8');

    assert.ok(
      ch5.includes(`**True Positives (TP)**: ${canonical.overall.truePositives}`),
      `chapter 5's embedded TP must equal canonical-evaluation.json's ${canonical.overall.truePositives} -- run npm run research:evaluate to regenerate if this drifted`
    );
    assert.ok(ch5.includes(`**False Positives (FP)**: ${canonical.overall.falsePositives}`));
    assert.ok(ch5.includes(`**False Negatives (FN)**: ${canonical.overall.falseNegatives}`));
  });

  await t.test('benchmarks/eval-summary.json ruleCoverage is present and internally consistent with FOUR_LAYER_MAPPINGS', () => {
    const summaryPath = path.resolve(process.cwd(), 'benchmarks/eval-summary.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

    assert.ok(summary.ruleCoverage, 'eval-summary.json must expose ruleCoverage provenance');
    assert.equal(summary.ruleCoverage.rulesWithGroundTruth, summary.ruleCoverage.coveredRuleIds.length);
    assert.equal(summary.ruleCoverage.totalFigmRules, summary.ruleCoverage.rulesWithGroundTruth + summary.ruleCoverage.uncoveredRuleIds.length);
    // Must never silently claim full rule coverage from the ground-truth benchmark alone.
    assert.ok(summary.ruleCoverage.rulesWithGroundTruth < summary.ruleCoverage.totalFigmRules);
  });

  await t.test('regression guard: fabricated/duplicate metric sources must never be reintroduced', () => {
    const rootDir = process.cwd();

    // Deleted dead-parallel-pipeline module (hardcoded {tp:18,fp:3,fn:1,tn:25} matrix).
    const precisionRecallSrc = fs.readFileSync(path.join(rootDir, 'src/eval/precision-recall-engine.ts'), 'utf-8');
    assert.equal(/EMPIRICAL_EXPERT_GROUND_TRUTH/.test(precisionRecallSrc), false, 'the retired hardcoded confusion-matrix constant must not be reintroduced');
    assert.equal(/tn:\s*25/.test(precisionRecallSrc), false, 'the fabricated tn=25 "controlled baseline negative class universe" must not be reintroduced');

    // Deleted fabricated AI-patch module.
    assert.equal(fs.existsSync(path.join(rootDir, 'src/eval/ai-patch-evaluator.ts')), false);

    // Deleted stale/conflicting duplicate dissertation chapters.
    assert.equal(fs.existsSync(path.join(rootDir, 'docs/dissertation/chapter5_evaluation.md')), false);
    assert.equal(fs.existsSync(path.join(rootDir, 'docs/dissertation/chapter5_results_discussion.md')), false);

    // Fabricated competitor execution-latency field must not be reintroduced into tool-benchmark.ts.
    const toolBenchmarkSrc = fs.readFileSync(path.join(rootDir, 'src/eval/tool-benchmark.ts'), 'utf-8');
    assert.equal(/executionSpeedMs/.test(toolBenchmarkSrc), false);
    assert.equal(/detectionSuccessRate/.test(toolBenchmarkSrc), false);
  });
});
