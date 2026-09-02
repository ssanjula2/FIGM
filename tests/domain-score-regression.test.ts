import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDomainScore, calculateQualityScore } from '../src/engine/quality-score';

/**
 * Regression coverage for Phase 8 closure: /api/dashboard/statistics's old computeDomainScore
 * normalized a domain's penalty by `allDiagnostics.length` (the TOTAL diagnostic count across
 * every domain, not just this one), so a domain's reported score changed whenever unrelated
 * domains' finding counts changed -- even with zero change to the domain itself. The canonical
 * calculateDomainScore (src/engine/quality-score.ts) fixes this by computing each scan's domain
 * score independently from ONLY that scan's diagnostics in that domain, then averaging.
 */

function diag(domain: string, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') {
  return { domain, severity };
}

test('calculateDomainScore returns null only when there are no scans at all', () => {
  assert.equal(calculateDomainScore([], 'PERFORMANCE'), null);
});

test('calculateDomainScore returns a perfect 100 for an empty domain (no matching diagnostics)', () => {
  const scans = [{ diagnostics: [diag('ACCESSIBILITY', 'HIGH')] }];
  assert.equal(calculateDomainScore(scans, 'PERFORMANCE'), 100);
});

test('calculateDomainScore applies the canonical severity weights (LOW/MEDIUM/HIGH/CRITICAL)', () => {
  assert.equal(calculateDomainScore([{ diagnostics: [diag('PERFORMANCE', 'LOW')] }], 'PERFORMANCE'), 99);
  assert.equal(calculateDomainScore([{ diagnostics: [diag('PERFORMANCE', 'MEDIUM')] }], 'PERFORMANCE'), 97);
  assert.equal(calculateDomainScore([{ diagnostics: [diag('PERFORMANCE', 'HIGH')] }], 'PERFORMANCE'), 92);
  assert.equal(calculateDomainScore([{ diagnostics: [diag('PERFORMANCE', 'CRITICAL')] }], 'PERFORMANCE'), 85);
});

test('calculateDomainScore on a single scan matches calculateQualityScore restricted to that domain', () => {
  const diagnostics = [
    diag('PERFORMANCE', 'CRITICAL'),
    diag('PERFORMANCE', 'HIGH'),
    diag('ACCESSIBILITY', 'HIGH'),
    diag('ACCESSIBILITY', 'LOW'),
  ];
  const expected = calculateQualityScore(diagnostics.filter((d) => d.domain === 'PERFORMANCE'));
  assert.equal(calculateDomainScore([{ diagnostics }], 'PERFORMANCE'), expected);
});

test('mixed severities within one domain sum penalties correctly', () => {
  // CRITICAL(15) + HIGH(8) + MEDIUM(3) + LOW(1) = 27 penalty -> 73
  const scans = [{ diagnostics: [diag('PERFORMANCE', 'CRITICAL'), diag('PERFORMANCE', 'HIGH'), diag('PERFORMANCE', 'MEDIUM'), diag('PERFORMANCE', 'LOW')] }];
  assert.equal(calculateDomainScore(scans, 'PERFORMANCE'), 73);
});

test('a domain score never changes when unrelated-domain findings change, in the same scan or others', () => {
  const baseline = calculateDomainScore(
    [{ diagnostics: [diag('PERFORMANCE', 'HIGH')] }],
    'PERFORMANCE'
  );

  // Adding a pile of unrelated ACCESSIBILITY findings to the SAME scan must not move PERFORMANCE's score.
  const withUnrelatedSameScan = calculateDomainScore(
    [{ diagnostics: [diag('PERFORMANCE', 'HIGH'), diag('ACCESSIBILITY', 'CRITICAL'), diag('ACCESSIBILITY', 'CRITICAL'), diag('ACCESSIBILITY', 'HIGH')] }],
    'PERFORMANCE'
  );
  assert.equal(withUnrelatedSameScan, baseline, 'unrelated findings in the same scan must not affect this domain\'s score');

  // Adding entirely separate scans with only unrelated-domain findings must not move PERFORMANCE's
  // average either, once weighted against equally-shaped PERFORMANCE-only scans.
  const withUnrelatedOtherScans = calculateDomainScore(
    [
      { diagnostics: [diag('PERFORMANCE', 'HIGH')] },
      { diagnostics: [diag('ACCESSIBILITY', 'CRITICAL')] },
    ],
    'PERFORMANCE'
  );
  // Second scan has zero PERFORMANCE diagnostics -> contributes a perfect 100 to the average.
  assert.equal(withUnrelatedOtherScans, Math.round((92 + 100) / 2));
});

test('calculateDomainScore averages independently-computed per-scan domain scores, floored at 0', () => {
  const scans = [
    { diagnostics: Array(10).fill(diag('PERFORMANCE', 'CRITICAL')) }, // penalty 150 -> floored at 0
    { diagnostics: [diag('PERFORMANCE', 'LOW')] }, // 99
  ];
  assert.equal(calculateDomainScore(scans, 'PERFORMANCE'), Math.round((0 + 99) / 2));
});
