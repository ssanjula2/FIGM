import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAgreement, interpretKappa, RatingPair } from '../src/eval/inter-rater-reliability';

/**
 * FORMULA VERIFICATION ONLY -- not a FIGM research result.
 *
 * This suite proves computeAgreement() implements Cohen's kappa correctly by checking it against
 * known, independently-citable worked examples (the standard "grant proposal readers" example
 * used on Wikipedia's Cohen's kappa article, plus mathematical edge cases). None of the data
 * below comes from FIGM's benchmark or from any annotator -- it exists only to verify the
 * formula, exactly as this codebase's Cronbach's-alpha formula-verification tests
 * (src/eval/user-study-evaluator.ts, labeled SYNTHETIC_PIPELINE_TEST_DATA) verify that engine
 * without claiming a real user study occurred. Real independent-annotation results, if and when
 * they exist, are reported separately by scripts/compare-annotations.ts and are never computed
 * from data invented in this file.
 */
test('Inter-Rater Reliability Engine — formula verification (not a research result)', async (t) => {
  await t.test('[Textbook example] reproduces the standard 50-item "grant proposal readers" kappa = 0.4 (Wikipedia, Cohen\'s kappa)', () => {
    // 20 both-yes, 5 A-yes/B-no, 10 A-no/B-yes, 15 both-no => n=50, p_o=0.70, p_e=0.50, kappa=0.40
    const pairs: RatingPair[] = [
      ...Array.from({ length: 20 }, (_, i) => ({ itemId: `yy${i}`, rater1: 'yes', rater2: 'yes' })),
      ...Array.from({ length: 5 }, (_, i) => ({ itemId: `yn${i}`, rater1: 'yes', rater2: 'no' })),
      ...Array.from({ length: 10 }, (_, i) => ({ itemId: `ny${i}`, rater1: 'no', rater2: 'yes' })),
      ...Array.from({ length: 15 }, (_, i) => ({ itemId: `nn${i}`, rater1: 'no', rater2: 'no' })),
    ];

    const result = computeAgreement(pairs);
    assert.equal(result.n, 50);
    assert.equal(result.observedAgreement, 0.70);
    assert.equal(result.expectedAgreement, 0.50);
    assert.ok(Math.abs(result.cohensKappa - 0.40) < 1e-9, `expected kappa=0.40, got ${result.cohensKappa}`);
    assert.equal(interpretKappa(result.cohensKappa), 'fair');
  });

  await t.test('[Edge case] perfect agreement yields kappa = 1', () => {
    const pairs: RatingPair[] = [
      { itemId: '1', rater1: 'PRESENT', rater2: 'PRESENT' },
      { itemId: '2', rater1: 'ABSENT', rater2: 'ABSENT' },
      { itemId: '3', rater1: 'PRESENT', rater2: 'PRESENT' },
      { itemId: '4', rater1: 'ABSENT', rater2: 'ABSENT' },
    ];
    const result = computeAgreement(pairs);
    assert.equal(result.observedAgreement, 1);
    assert.equal(result.cohensKappa, 1);
  });

  await t.test('[Edge case] systematic total disagreement yields kappa < 0 (worse than chance)', () => {
    const pairs: RatingPair[] = [
      { itemId: '1', rater1: 'PRESENT', rater2: 'ABSENT' },
      { itemId: '2', rater1: 'ABSENT', rater2: 'PRESENT' },
      { itemId: '3', rater1: 'PRESENT', rater2: 'ABSENT' },
      { itemId: '4', rater1: 'ABSENT', rater2: 'PRESENT' },
    ];
    const result = computeAgreement(pairs);
    assert.equal(result.observedAgreement, 0);
    assert.ok(result.cohensKappa < 0, `expected negative kappa, got ${result.cohensKappa}`);
  });

  await t.test('[Edge case] degenerate zero-variance perfect agreement (every item the same single category) does not produce NaN', () => {
    const pairs: RatingPair[] = [
      { itemId: '1', rater1: 'PRESENT', rater2: 'PRESENT' },
      { itemId: '2', rater1: 'PRESENT', rater2: 'PRESENT' },
    ];
    const result = computeAgreement(pairs);
    assert.equal(result.expectedAgreement, 1);
    assert.equal(result.cohensKappa, 1);
    assert.ok(!Number.isNaN(result.cohensKappa));
  });

  await t.test('[Shape] confusion matrix cells sum to n and only include non-zero cells', () => {
    const pairs: RatingPair[] = [
      { itemId: '1', rater1: 'FIGM-A11Y-01', rater2: 'FIGM-A11Y-01' },
      { itemId: '2', rater1: 'FIGM-A11Y-01', rater2: 'FIGM-PERF-01' },
      { itemId: '3', rater1: 'FIGM-PERF-01', rater2: 'FIGM-PERF-01' },
    ];
    const result = computeAgreement(pairs);
    const total = result.confusionMatrix.reduce((sum, cell) => sum + cell.count, 0);
    assert.equal(total, 3);
    assert.equal(result.confusionMatrix.length, 3, 'exactly 3 distinct (rater1,rater2) pairs occurred, no zero-count padding');
  });

  await t.test('[Empty input] does not throw and reports n=0 rather than fabricating a kappa', () => {
    const result = computeAgreement([]);
    assert.equal(result.n, 0);
    assert.equal(result.observedAgreement, 0);
    assert.equal(result.cohensKappa, 0);
  });
});
