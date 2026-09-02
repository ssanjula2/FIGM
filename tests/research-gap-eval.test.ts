import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EvaluationRunner } from '../src/eval/evaluation-runner.js';
import { CoverageBenchmarkEngine, TOOL_COMPARISON_MATRIX, RULE_COVERAGE_MATRIX } from '../src/eval/tool-benchmark.js';
import { UserStudyEvaluator } from '../src/eval/user-study-evaluator.js';
import { ThesisGapExporter } from '../src/eval/thesis-gap-exporter.js';
import { FOUR_LAYER_MAPPINGS } from '../src/matrix/four-layer-meta-model.js';

// GAP 1 & GAP 7 previously asserted against src/eval/repo-evaluator.ts's REPOSITORY_DATASET,
// a hardcoded set of 30 fabricated repository records (invented GitHub repo names/URLs and
// LOC/violation/score figures that were never produced by cloning or scanning anything). That
// dataset and its generator have been deleted; this suite no longer tests fabricated data.
//
// GAP 2 & GAP 5 previously asserted threshold claims against `EMPIRICAL_EXPERT_GROUND_TRUTH` (a
// hand-typed {tp:18,fp:3,fn:1,tn:25} confusion matrix in precision-recall-engine.ts) and
// `AIPatchEvaluator.calculatePatchEvaluation()` (hardcoded 450/434/426/412 defect/patch counts in
// the now-deleted ai-patch-evaluator.ts) — neither was ever read from real scan or remediation
// output. Both were removed rather than "corrected" to different numbers, since nothing in this
// codebase actually counts real AI-patch outcomes across a reproducible corpus. See
// docs/architecture/RESEARCH_METRICS_PIPELINE.md for the single-canonical-source architecture this
// suite now validates instead.

test('Research Gap Evaluation Suite & Dissertation Artifact Validation', async (t) => {
  await t.test('GAP 2: the ONLY confusion matrix / Precision / Recall / F1 source is a live EvaluationRunner run against real ground truth', () => {
    const results = EvaluationRunner.runEvaluation();

    // TP/FP/FN must be non-negative integers actually produced by diffing real scan diagnostics
    // against benchmarks/ground-truth.json -- not a cached/hand-typed literal.
    assert.ok(Number.isInteger(results.overall.truePositives) && results.overall.truePositives >= 0);
    assert.ok(Number.isInteger(results.overall.falsePositives) && results.overall.falsePositives >= 0);
    assert.ok(Number.isInteger(results.overall.falseNegatives) && results.overall.falseNegatives >= 0);

    // Formulas must be internally self-consistent (proves precision/recall/f1 are DERIVED from
    // tp/fp/fn, not independently hand-typed alongside them).
    const { truePositives: tp, falsePositives: fp, falseNegatives: fn } = results.overall;
    const expectedPrecision = tp + fp === 0 ? 1.0 : tp / (tp + fp);
    const expectedRecall = tp + fn === 0 ? 1.0 : tp / (tp + fn);
    assert.ok(Math.abs(results.overall.precision - expectedPrecision) < 1e-9);
    assert.ok(Math.abs(results.overall.recall - expectedRecall) < 1e-9);

    // Rule-coverage provenance must be present and must be genuinely derived from
    // benchmarks/ground-truth.json's actual contents (never a hand-typed literal that could
    // silently claim more coverage than the fixture set actually provides).
    assert.ok(results.ruleCoverage);
    assert.equal(results.ruleCoverage.totalFigmRules, FOUR_LAYER_MAPPINGS.length);
    // Ground truth now genuinely covers all 25 rules (closed via benchmarks/testbed/next03/ +
    // EvaluationRunner.collectTestbedFiles's recursive walk -- previously FIGM-NEXT-03 was the one
    // rule left uncovered because its detector requires a literal Next.js App Router path a flat
    // testbed directory couldn't host). If this ever regresses (a rule silently loses ground-truth
    // coverage), rulesWithGroundTruth will legitimately drop below totalFigmRules again -- that is
    // real information this assertion must catch, not something to loosen back to "< total".
    assert.equal(results.ruleCoverage.rulesWithGroundTruth, results.ruleCoverage.totalFigmRules, 'ground truth is expected to cover all 25 rules as of this revision -- if this changed, that is real information, update deliberately');
    assert.equal(results.ruleCoverage.uncoveredRuleIds.length, 0);
    assert.equal(results.ruleCoverage.rulesWithGroundTruth, results.ruleCoverage.coveredRuleIds.length);
    assert.equal(results.ruleCoverage.totalFigmRules, results.ruleCoverage.rulesWithGroundTruth + results.ruleCoverage.uncoveredRuleIds.length);
  });

  await t.test('GAP 3 & GAP 6: Tool Benchmarking & Guideline Coverage Analysis are derived from the live rule spec, not a hand-duplicated stale list', () => {
    const coverage = CoverageBenchmarkEngine.calculateCoverageSummary();

    // RULE_COVERAGE_MATRIX must track FOUR_LAYER_MAPPINGS exactly -- this is the regression guard
    // for the prior 23-entry hand-typed list that had silently drifted (missing FIGM-A11Y-05/06).
    assert.equal(coverage.totalRules, FOUR_LAYER_MAPPINGS.length);
    assert.equal(RULE_COVERAGE_MATRIX.length, FOUR_LAYER_MAPPINGS.length);
    const matrixIds = new Set(RULE_COVERAGE_MATRIX.map((r) => r.ruleId));
    for (const m of FOUR_LAYER_MAPPINGS) {
      assert.ok(matrixIds.has(m.rule.ruleId), `RULE_COVERAGE_MATRIX is missing ${m.rule.ruleId}`);
    }

    // No fabricated "detectionSuccessRate" field.
    assert.equal('detectionSuccessRate' in coverage, false);

    assert.ok(TOOL_COMPARISON_MATRIX.length >= 5);
    // No fabricated per-tool execution-latency field (no competitor tool was ever actually run).
    for (const t of TOOL_COMPARISON_MATRIX) {
      assert.equal('executionSpeedMs' in t, false, `${t.tool} must not carry a fabricated executionSpeedMs`);
    }

    const figmTool = TOOL_COMPARISON_MATRIX.find((t) => t.tool.includes('FIGM'));
    assert.ok(figmTool);
    assert.equal(figmTool?.staticAnalysis, true);
    assert.equal(figmTool?.dynamicProfiling, true);
    assert.equal(figmTool?.aiRemediation, true);
  });

  await t.test('GAP 5: no fabricated AI-patch benchmark module exists (regression guard)', () => {
    const fabricatedPath = path.resolve(process.cwd(), 'src/eval/ai-patch-evaluator.ts');
    assert.equal(fs.existsSync(fabricatedPath), false, 'src/eval/ai-patch-evaluator.ts (hardcoded 450/434/426/412 patch counts) must not be reintroduced');
  });

  await t.test('GAP 8: User Usability Study & Cronbach Alpha Reliability (synthetic pipeline-verification data, honestly labeled elsewhere)', () => {
    const study = UserStudyEvaluator.calculateStudySummary();

    assert.equal(study.sampleSize, 85);
    assert.ok(study.overallSatisfactionMean >= 4.5);
    assert.ok(study.cronbachAlpha >= 0.85, 'Cronbach Alpha must exceed 0.85 benchmark threshold');
  });

  await t.test('GAP 9 & GAP 10: Thesis Chapter Exporter produces a chapter 5 that matches the live EvaluationRunner output exactly', () => {
    ThesisGapExporter.exportAllChapters();

    const ch5Path = path.resolve(process.cwd(), 'docs/dissertation/chapter5_empirical_validation_and_benchmarks.md');
    assert.ok(fs.existsSync(ch5Path));
    const ch5 = fs.readFileSync(ch5Path, 'utf-8');

    const results = EvaluationRunner.runEvaluation();
    assert.ok(ch5.includes(`**True Positives (TP)**: ${results.overall.truePositives}`), 'chapter 5 TP must match a live EvaluationRunner run');
    assert.ok(ch5.includes(`**False Positives (FP)**: ${results.overall.falsePositives}`), 'chapter 5 FP must match a live EvaluationRunner run');
    assert.ok(ch5.includes(`**False Negatives (FN)**: ${results.overall.falseNegatives}`), 'chapter 5 FN must match a live EvaluationRunner run');

    // Must never re-embed the retired hardcoded confusion matrix (EMPIRICAL_EXPERT_GROUND_TRUTH's
    // derived 85.71%/94.74%/90.00% figures) or fabricated AI-patch/competitor figures.
    assert.equal(/85\.71%|94\.74%|90\.00%/.test(ch5), false, 'chapter 5 must not contain the retired EMPIRICAL_EXPERT_GROUND_TRUTH-derived figures');
    assert.equal(/96\.44%|98\.16%|94\.93%/.test(ch5), false, 'chapter 5 must not contain the fabricated AI-patch success-rate figures');
    assert.equal(/8400 ms|420 ms|3200 ms/.test(ch5), false, 'chapter 5 must not contain the fabricated competitor execution-latency figures');

    // Must explicitly disclose rule-coverage scope, not imply all 25 rules are empirically measured.
    assert.ok(/rule coverage/i.test(ch5));
    assert.ok(ch5.includes(String(results.ruleCoverage.rulesWithGroundTruth)));
  });
});
