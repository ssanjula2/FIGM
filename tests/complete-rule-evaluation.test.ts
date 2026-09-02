import test from 'node:test';
import assert from 'node:assert/strict';
import { CompleteRuleEvaluationRunner } from '../src/eval/complete-rule-evaluation-runner';
import { RULE_EVAL_CASES } from '../benchmarks/complete-rule-evaluation/cases';
import { FOUR_LAYER_MAPPINGS } from '../src/matrix/four-layer-meta-model';

/**
 * Guards for the complete 50-rule structural evaluation (see complete-rule-evaluation-runner.ts
 * and cases.ts's own header for what this is and, just as importantly, what it is NOT -- a
 * generalization/real-world-accuracy benchmark). These tests exist so a future edit can never
 * silently regress coverage back below 50/50, or let an actually-wrong case's expected label slip
 * through unnoticed. (Baseline was 25/25; grew to 33/33 in the first research-backed expansion
 * pass -- see docs/research/EXPANSION_RESEARCH_TRACEABILITY.md -- then to 50/50 in the second --
 * see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md.)
 */

test('every canonical FIGM rule has at least one evaluation case (50/50 coverage)', () => {
  const canonicalRuleIds = new Set(FOUR_LAYER_MAPPINGS.map((m) => m.rule.ruleId));
  const coveredRuleIds = new Set(RULE_EVAL_CASES.map((c) => c.ruleId));

  assert.equal(canonicalRuleIds.size, 50, 'sanity check: registry should still have exactly 50 canonical rules');

  const missing = [...canonicalRuleIds].filter((r) => !coveredRuleIds.has(r));
  assert.deepEqual(missing, [], `every canonical rule must have at least one case; missing: ${missing.join(', ')}`);
});

test('every case references a real, currently-registered ruleId (no orphaned/renamed references)', () => {
  const canonicalRuleIds = new Set(FOUR_LAYER_MAPPINGS.map((m) => m.rule.ruleId));
  for (const c of RULE_EVAL_CASES) {
    assert.ok(canonicalRuleIds.has(c.ruleId), `case "${c.id}" references ruleId "${c.ruleId}", which is not in FOUR_LAYER_MAPPINGS`);
  }
});

test('every case has at least one positive (EXPECTED_VIOLATION) and one negative (EXPECTED_NO_VIOLATION) example', () => {
  const byRule = new Map<string, Set<string>>();
  for (const c of RULE_EVAL_CASES) {
    if (!byRule.has(c.ruleId)) byRule.set(c.ruleId, new Set());
    byRule.get(c.ruleId)!.add(c.label);
  }
  for (const [ruleId, labels] of byRule) {
    assert.ok(labels.has('EXPECTED_VIOLATION'), `${ruleId} has no EXPECTED_VIOLATION case`);
    assert.ok(labels.has('EXPECTED_NO_VIOLATION'), `${ruleId} has no EXPECTED_NO_VIOLATION case`);
  }
});

test('the live engine classifies every case exactly as its ground-truth label expects (zero failed cases)', () => {
  const artifact = CompleteRuleEvaluationRunner.run();
  assert.deepEqual(
    artifact.failedCases,
    [],
    `expected zero failed cases, got ${artifact.failedCases.length}: ${JSON.stringify(artifact.failedCases, null, 2)}`
  );
  assert.equal(artifact.reproducible, true);
});

test('aggregate TP/FP/FN/TN are computed dynamically and sum to the total case count', () => {
  const artifact = CompleteRuleEvaluationRunner.run();
  const { truePositive, falsePositive, falseNegative, trueNegative } = artifact.aggregate;
  const sum = truePositive + falsePositive + falseNegative + trueNegative;
  assert.equal(sum, RULE_EVAL_CASES.length, 'confusion-matrix cells must partition every case exactly once');
  // Given the dataset is designed so every case classifies correctly (see the previous test),
  // FP and FN must both be zero and every case lands as either TP or TN.
  assert.equal(falsePositive, 0);
  assert.equal(falseNegative, 0);
  assert.equal(truePositive + trueNegative, RULE_EVAL_CASES.length);
});

test('groundTruthCoverage honestly reports 50/50 and uncoveredRules is empty', () => {
  const artifact = CompleteRuleEvaluationRunner.run();
  assert.equal(artifact.totalCanonicalRules, 50);
  assert.equal(artifact.evaluatedRules, 50);
  assert.equal(artifact.groundTruthCoverage, '50/50');
  assert.deepEqual(artifact.uncoveredRules, []);
});

test('per-rule metrics array has exactly one entry per canonical rule, each with a real precision/recall/f1', () => {
  const artifact = CompleteRuleEvaluationRunner.run();
  assert.equal(artifact.perRuleMetrics.length, 50);
  for (const m of artifact.perRuleMetrics) {
    assert.ok(m.totalCases >= 2, `${m.ruleId} should have at least 2 cases (positive + negative), got ${m.totalCases}`);
    assert.ok(m.precision >= 0 && m.precision <= 1);
    assert.ok(m.recall >= 0 && m.recall <= 1);
    assert.ok(m.f1 >= 0 && m.f1 <= 1);
  }
});

test('running the evaluation twice in the same process produces identical structural results (reproducibility)', () => {
  const first = CompleteRuleEvaluationRunner.run();
  const second = CompleteRuleEvaluationRunner.run();
  // Exclude the two fields that are expected to differ run-to-run (wall-clock timing/timestamp);
  // everything else -- every count, every metric, coverage, hash -- must match exactly.
  const strip = (a: ReturnType<typeof CompleteRuleEvaluationRunner.run>) => {
    const { timestamp, executionDurationMs, ...rest } = a;
    return rest;
  };
  assert.deepEqual(strip(first), strip(second));
});

test('scopeDisclaimer explicitly distinguishes this from a real-world-accuracy claim', () => {
  const artifact = CompleteRuleEvaluationRunner.run();
  assert.match(artifact.scopeDisclaimer, /not a generalization\/real-world-accuracy benchmark/i);
  assert.match(artifact.scopeDisclaimer, /ground-truth\.json/);
});
