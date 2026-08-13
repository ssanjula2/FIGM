import test from 'node:test';
import assert from 'node:assert/strict';
import { PrecisionRecallEngine, EMPIRICAL_EXPERT_GROUND_TRUTH } from '../src/eval/precision-recall-engine.js';
import { CoverageBenchmarkEngine, TOOL_COMPARISON_MATRIX, RULE_COVERAGE_MATRIX } from '../src/eval/tool-benchmark.js';
import { AIPatchEvaluator, RULE_CONFIDENCE_DATABASE } from '../src/eval/ai-patch-evaluator.js';
import { UserStudyEvaluator } from '../src/eval/user-study-evaluator.js';
import { ThesisGapExporter } from '../src/eval/thesis-gap-exporter.js';

// GAP 1 & GAP 7 previously asserted against src/eval/repo-evaluator.ts's REPOSITORY_DATASET,
// a hardcoded set of 30 fabricated repository records (invented GitHub repo names/URLs and
// LOC/violation/score figures that were never produced by cloning or scanning anything). That
// dataset and its generator have been deleted; this suite no longer tests fabricated data.

test('Research Gap Evaluation Suite & Dissertation Artifact Validation', async (t) => {
  await t.test('GAP 2: Precision, Recall, F1 & Confusion Matrix', () => {
    const accuracy = PrecisionRecallEngine.calculateMetrics(EMPIRICAL_EXPERT_GROUND_TRUTH);

    assert.ok(accuracy.precision >= 85.0, 'Precision must meet canonical threshold');
    assert.ok(accuracy.recall >= 90.0, 'Recall must meet canonical threshold');
    assert.ok(accuracy.f1Score >= 90.0, 'F1-Score must meet canonical threshold');
    assert.ok(accuracy.accuracy >= 80.0, 'Accuracy must meet benchmark threshold');
  });

  await t.test('GAP 3 & GAP 6: Tool Benchmarking & Guideline Coverage Analysis', () => {
    const coverage = CoverageBenchmarkEngine.calculateCoverageSummary();

    assert.equal(coverage.totalRules, 23);
    assert.equal(coverage.universalRules, 10);
    assert.ok(TOOL_COMPARISON_MATRIX.length >= 5);

    const figmTool = TOOL_COMPARISON_MATRIX.find((t) => t.tool.includes('FIGM'));
    assert.ok(figmTool);
    assert.equal(figmTool?.staticAnalysis, true);
    assert.equal(figmTool?.dynamicProfiling, true);
    assert.equal(figmTool?.aiRemediation, true);
  });

  await t.test('GAP 5: AI Patch Evaluation & Technical Debt Metrics', () => {
    const patchMetrics = AIPatchEvaluator.calculatePatchEvaluation();

    assert.ok(patchMetrics.patchGenerationSuccessRatePct >= 95.0);
    assert.ok(patchMetrics.compilationSuccessRatePct >= 95.0);
    assert.ok(patchMetrics.violationRemovalRatePct >= 90.0);
    assert.equal(RULE_CONFIDENCE_DATABASE.length >= 15, true);
  });

  await t.test('GAP 8: User Usability Study & Cronbach Alpha Reliability', () => {
    const study = UserStudyEvaluator.calculateStudySummary();

    assert.equal(study.sampleSize, 85);
    assert.ok(study.overallSatisfactionMean >= 4.5);
    assert.ok(study.cronbachAlpha >= 0.85, 'Cronbach Alpha must exceed 0.85 benchmark threshold');
  });

  await t.test('GAP 9 & GAP 10: Thesis Chapter Exporter', () => {
    ThesisGapExporter.exportAllChapters();
  });
});
