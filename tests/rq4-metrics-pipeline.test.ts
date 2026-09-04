import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRQ4, type ExpertGroundTruthEntry, type FigmPrediction } from '../scripts/compute-rq4-metrics.js';

/**
 * Stage 10 — RQ4 metrics pipeline correctness tests.
 *
 * IMPORTANT: every ground-truth/prediction row in this file is a synthetic, hand-constructed
 * example built ONLY to verify the computation logic (Section 29's required scenario list). None
 * of it is real expert annotation data, and none of it may ever be cited as an RQ4 finding -- see
 * docs/audit/STAGE_10_RQ4_INDEPENDENT_EXPERT_VALIDATION_REPORT.md, which records
 * REAL_EXPERT_DATA_AVAILABLE = NO for this stage.
 */

function gt(entries: Array<Partial<ExpertGroundTruthEntry> & { caseId: string; ruleId: string; expertGroundTruth: 'VIOLATION_PRESENT' | 'VIOLATION_ABSENT' }>): ExpertGroundTruthEntry[] {
  return entries.map((e) => ({ provenance: 'TEST_FIXTURE', annotationVersion: 'test-1', ...e }));
}
function pred(entries: Array<Partial<FigmPrediction> & { caseId: string; ruleId: string }>): FigmPrediction[] {
  return entries.map((e) => ({ engineVersion: 'test', ruleSetVersion: 'test', timestamp: new Date().toISOString(), ...e }));
}

test('perfect match: every FIGM prediction matches an expert-positive, nothing missed', () => {
  const g = gt([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_PRESENT' },
    { caseId: 'C2', ruleId: 'FIGM-PERF-01', expertGroundTruth: 'VIOLATION_PRESENT' },
  ]);
  const p = pred([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01' },
    { caseId: 'C2', ruleId: 'FIGM-PERF-01' },
  ]);
  const result = analyzeRQ4(g, p);
  assert.equal(result.overall.tp, 2);
  assert.equal(result.overall.fp, 0);
  assert.equal(result.overall.fn, 0);
  assert.equal(result.overall.precision.value, 1);
  assert.equal(result.overall.recall.value, 1);
  assert.equal(result.overall.f1.value, 1);
});

test('FP only: FIGM predicts violations the expert record does not confirm', () => {
  const g: ExpertGroundTruthEntry[] = [];
  const p = pred([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01' },
    { caseId: 'C2', ruleId: 'FIGM-PERF-01' },
  ]);
  const result = analyzeRQ4(g, p);
  assert.equal(result.overall.tp, 0);
  assert.equal(result.overall.fp, 2);
  assert.equal(result.overall.fn, 0);
  assert.equal(result.overall.precision.value, 0);
  assert.equal(result.overall.recall.value, null, 'recall undefined: TP+FN=0 (no expert positives at all)');
  assert.equal(result.overall.f1.value, null);
});

test('FN only: expert finds violations FIGM never predicted', () => {
  const g = gt([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_PRESENT' },
    { caseId: 'C2', ruleId: 'FIGM-PERF-01', expertGroundTruth: 'VIOLATION_PRESENT' },
  ]);
  const p: FigmPrediction[] = [];
  const result = analyzeRQ4(g, p);
  assert.equal(result.overall.tp, 0);
  assert.equal(result.overall.fp, 0);
  assert.equal(result.overall.fn, 2);
  assert.equal(result.overall.precision.value, null, 'precision undefined: TP+FP=0 (no FIGM predictions at all)');
  assert.equal(result.overall.recall.value, 0);
  assert.equal(result.overall.f1.value, null);
});

test('mixed confusion matrix: TP + FP + FN together produce correctly rounded precision/recall/F1', () => {
  const g = gt([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_PRESENT' }, // -> TP
    { caseId: 'C2', ruleId: 'FIGM-PERF-01', expertGroundTruth: 'VIOLATION_PRESENT' }, // -> FN (no prediction)
    { caseId: 'C3', ruleId: 'FIGM-PERF-02', expertGroundTruth: 'VIOLATION_ABSENT' },  // explicit reject
  ]);
  const p = pred([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01' }, // TP
    { caseId: 'C3', ruleId: 'FIGM-PERF-02' }, // FP (expert explicitly said absent)
    { caseId: 'C4', ruleId: 'FIGM-PERF-03' }, // FP (no ground-truth entry at all)
  ]);
  const result = analyzeRQ4(g, p);
  assert.equal(result.overall.tp, 1);
  assert.equal(result.overall.fp, 2);
  assert.equal(result.overall.fn, 1);
  // precision = 1/3, recall = 1/2, f1 = 2*(1/3)*(1/2)/((1/3)+(1/2)) = 0.4
  assert.equal(result.overall.precision.value, 1 / 3);
  assert.equal(result.overall.recall.value, 1 / 2);
  assert.ok(Math.abs((result.overall.f1.value as number) - 0.4) < 1e-9);
});

test('zero denominator: no predictions and no expert positives at all', () => {
  const g = gt([{ caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_ABSENT' }]);
  const p: FigmPrediction[] = [];
  const result = analyzeRQ4(g, p);
  assert.equal(result.overall.tp, 0);
  assert.equal(result.overall.fp, 0);
  assert.equal(result.overall.fn, 0);
  assert.equal(result.overall.precision.value, null);
  assert.equal(result.overall.recall.value, null);
  assert.equal(result.overall.f1.value, null);
});

test('duplicate prediction handling: two FIGM rows for the same (caseId, ruleId) count once', () => {
  const g = gt([{ caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_PRESENT' }]);
  const p = pred([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01' },
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01' }, // duplicate -- must not double-count the TP
  ]);
  const result = analyzeRQ4(g, p);
  assert.equal(result.overall.tp, 1);
  assert.equal(result.overall.fp, 0);
  assert.equal(result.duplicatePredictionsCollapsed, 1);
});

test('excluded/ambiguous case behavior: excluded ground-truth entries never enter the confusion matrix', () => {
  const g = gt([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_PRESENT' },
    { caseId: 'C2', ruleId: 'FIGM-PERF-01', expertGroundTruth: 'VIOLATION_PRESENT', excluded: true, exclusionReason: 'annotator marked ambiguous' },
  ]);
  const p = pred([
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01' },
    { caseId: 'C2', ruleId: 'FIGM-PERF-01' }, // would be a TP if C2 weren't excluded
  ]);
  const result = analyzeRQ4(g, p);
  assert.equal(result.excludedUnitCount, 1);
  assert.equal(result.overall.tp, 1, 'the excluded case must not contribute a TP');
  // Per the RQ4 protocol amendment Section F ("ambiguous units do not enter TP/FP/FN
  // denominators"): C2's prediction lands on a unit the expert explicitly excluded, not on a unit
  // with no ground truth at all -- it must contribute to neither TP nor FP, not be silently
  // counted as a false positive just because it was excluded.
  assert.equal(result.overall.fp, 0);
});

test('domain breakdown and rule diagnostics are populated from real rule-registry domains', () => {
  const g = gt([{ caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_PRESENT' }]);
  const p = pred([{ caseId: 'C1', ruleId: 'FIGM-A11Y-01' }]);
  const result = analyzeRQ4(g, p);
  const a11yDomain = result.domainBreakdown.find((d) => d.domain === 'ACCESSIBILITY');
  assert.ok(a11yDomain, 'ACCESSIBILITY domain bucket must exist for FIGM-A11Y-01');
  assert.equal(a11yDomain!.metrics.tp, 1);
  const ruleDiag = result.ruleDiagnostics.find((r) => r.ruleId === 'FIGM-A11Y-01');
  assert.ok(ruleDiag);
  assert.equal(ruleDiag!.tp, 1);
  assert.equal(ruleDiag!.sampleTooSmallForReliablePerRuleMetric, true, 'n=1 must be flagged unreliable');
});

test('TN is never manufactured unless explicit negatives are supported', () => {
  const g = gt([{ caseId: 'C1', ruleId: 'FIGM-A11Y-01', expertGroundTruth: 'VIOLATION_ABSENT' }]);
  const p: FigmPrediction[] = [];
  const withoutTn = analyzeRQ4(g, p);
  assert.equal(withoutTn.overall.tn, null);
  const withTn = analyzeRQ4(g, p, { supportsExplicitNegatives: true });
  assert.equal(withTn.overall.tn, 1);
});
