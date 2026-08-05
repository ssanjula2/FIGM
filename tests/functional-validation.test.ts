import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionalValidator } from '../src/eval/functional-validator.js';

test('Independent Verification & Research Validation Suite (25 Rules)', async (t) => {
  const summary = await FunctionalValidator.executeFullValidation();
  FunctionalValidator.generateValidationReportDoc(summary);

  await t.test('All Rules pass functional validation across Sample A and Sample B', () => {
    assert.equal(summary.totalRulesTested, 25);
    assert.equal(summary.passedRulesCount, 25);
    assert.equal(summary.failedRulesCount, 0);
  });

  await t.test('Overall Precision, Recall, F1, and Accuracy reach 100% threshold', () => {
    assert.equal(summary.globalMetrics.precision, 100.0);
    assert.equal(summary.globalMetrics.recall, 100.0);
    assert.equal(summary.globalMetrics.f1Score, 100.0);
    assert.equal(summary.globalMetrics.accuracy, 100.0);
    assert.equal(summary.globalMetrics.fp, 0);
    assert.equal(summary.globalMetrics.fn, 0);
  });

  await t.test('AI Fix pipeline executes and produces patch diffs', () => {
    const generatedFixes = summary.results.filter(r => r.aiFixGenerated).length;
    assert.equal(generatedFixes, 25);
  });
});
