import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as researchMetricsGET } from '../app/api/research-metrics/route';

/**
 * Regression coverage for Phase 18 closure: ResearchMetricsPayload (src/hooks/useResearchMetrics.ts)
 * previously omitted several fields the real /api/research-metrics response always includes
 * (dissertation.methodology/outOfScope, benchmarkMetrics.calculationMethod/ruleCoverage/
 * ruleMetrics/frameworkMetrics/performanceMetrics, systemCapabilities.evaluationDataset.scope/
 * groundTruthMethod, userStudy.cohort/instrument, references[].location/accessedDate, and
 * _meta.source/note). This test calls the REAL route handler and asserts every key the TS
 * interface now declares is actually present in the real response, so the interface can never
 * silently drift back out of sync with what the API actually returns.
 */

test('the real /api/research-metrics response contains every field the TS interface declares', async () => {
  const res = await researchMetricsGET();
  assert.equal(res.status, 200);
  const body = await res.json();

  // _meta
  for (const key of ['source', 'generatedAt', 'note', 'benchmarkError']) {
    assert.ok(key in body._meta, `_meta.${key} missing from the real response`);
  }

  // dissertation
  for (const key of ['candidate', 'studentId', 'institution', 'module', 'title', 'researchApproach', 'methodology', 'scope', 'outOfScope']) {
    assert.ok(key in body.dissertation, `dissertation.${key} missing from the real response`);
  }
  assert.ok(Array.isArray(body.dissertation.outOfScope));

  // benchmarkMetrics (only present when eval-summary.json exists, which it does in this repo)
  assert.ok(body.benchmarkMetrics, 'expected benchmarkMetrics to be present (benchmarks/eval-summary.json must exist)');
  for (const key of ['timestamp', 'calculationMethod', 'precision', 'recall', 'f1Score', 'truePositives', 'falsePositives', 'falseNegatives', 'ruleCoverage', 'ruleMetrics', 'frameworkMetrics', 'performanceMetrics']) {
    assert.ok(key in body.benchmarkMetrics, `benchmarkMetrics.${key} missing from the real response`);
  }

  // systemCapabilities.evaluationDataset
  for (const key of ['description', 'scope', 'sizeTarget', 'groundTruthMethod']) {
    assert.ok(key in body.systemCapabilities.evaluationDataset, `systemCapabilities.evaluationDataset.${key} missing from the real response`);
  }

  // userStudy
  for (const key of ['targetParticipants', 'collectedParticipants', 'collectionStatus', 'isRealHumanData', 'cohort', 'instrument', 'reliabilityMeasure', 'note', 'metrics', 'provenance']) {
    assert.ok(key in body.userStudy, `userStudy.${key} missing from the real response`);
  }

  // references[] -- at least one real entry has the optional location/accessedDate fields the
  // interface now declares (mesbah2007 has location, w3c2023 has accessedDate).
  assert.ok(Array.isArray(body.references) && body.references.length > 0);
  const hasLocation = body.references.some((r: any) => 'location' in r);
  const hasAccessedDate = body.references.some((r: any) => 'accessedDate' in r);
  assert.ok(hasLocation, 'expected at least one reference with a location field');
  assert.ok(hasAccessedDate, 'expected at least one reference with an accessedDate field');
});
