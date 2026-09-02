import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { processUserStudyPipeline } from '../scripts/import-user-study.js';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../src/research/research-config.js';

/**
 * Canonical real-study data flow regression guard.
 *
 * Forensic audit (2026-08-14) found the human usability study pipeline had two disconnected
 * "real data" paths: scripts/import-user-study.ts wrote validated/anonymized/analyzed results to
 * research/analysis/usability-results.json, but app/api/research-metrics/route.ts read human-study
 * status from data/user-study-responses.json -- a path nothing in this codebase ever wrote to
 * (the `data/` directory does not exist anywhere in the repo). This was invisible because both
 * paths independently evaluated to zero; it would have silently swallowed real data the moment a
 * real CSV was imported. Fixed the same day. This test asserts the wiring stays fixed, and that
 * the canonical flow (raw responses -> validation -> anonymization -> analysis -> canonical
 * results -> API/UI) behaves correctly at both ends: N=0 when nothing real exists, and a genuine
 * nonzero N once real (here: synthetic-for-testing) data is ingested.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relativePath), 'utf-8');
}

test('the API route and the import script agree on the same canonical results file path', () => {
  const routeSrc = read('app/api/research-metrics/route.ts');
  const importSrc = read('scripts/import-user-study.ts');

  assert.match(routeSrc, /join\(process\.cwd\(\), 'research', 'analysis', 'usability-results\.json'\)/, 'the API route must read research/analysis/usability-results.json');
  assert.match(importSrc, /path\.join\(rootDir, 'research\/analysis\/usability-results\.json'\)/, 'the import script must write to research/analysis/usability-results.json');

  // Regression guard against the specific dead path this bug used.
  assert.equal(/['"]data['"],\s*['"]user-study-responses\.json['"]/.test(routeSrc), false, 'the API route must never revert to reading the nonexistent data/user-study-responses.json path');
  assert.equal(fs.existsSync(path.join(ROOT, 'data')), false, 'sanity check: data/ still does not exist anywhere in the repo -- if this ever changes, re-examine why before assuming it is now a legitimate path');
});

test('processUserStudyPipeline reports honest N=0 when no real CSV exists (current real repository state)', () => {
  const realCsvPath = path.join(ROOT, 'research', 'raw', 'real', 'responses.csv');
  assert.equal(fs.existsSync(realCsvPath), false, 'this test assumes no real participant CSV has been collected yet; if one now exists, this whole test (and the "PLANNED" framing elsewhere) must be revisited deliberately');

  const report = processUserStudyPipeline();
  assert.equal(report.provenance.isRealHumanData, false);
  assert.equal(report.provenance.collectionStatus, 'NOT_COLLECTED');
  assert.equal(report.provenance.validParticipantCount, 0);
  assert.equal(report.provenance.anonymizedParticipantIds.length, 0);
  // Planned sample size stays a distinct, separate field from actual collected count -- never
  // conflated into a nonzero N just because a target exists. Sourced from the single canonical
  // constant (src/research/research-config.ts), not a hardcoded literal here -- see
  // tests/anti-hardcoding-guard.test.ts for the dedicated single-source-of-truth regression guard.
  assert.equal(report.provenance.targetSampleSize, HUMAN_STUDY_TARGET_PARTICIPANTS);
  assert.notEqual(report.provenance.validParticipantCount, report.provenance.targetSampleSize);
});

test('the canonical results file on disk matches what the live pipeline currently computes', () => {
  const canonicalPath = path.join(ROOT, 'research', 'analysis', 'usability-results.json');
  assert.ok(fs.existsSync(canonicalPath), 'run `npm run research:user-study:import` to produce the canonical baseline file');
  const onDisk = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));
  const live = processUserStudyPipeline();

  assert.equal(onDisk.provenance.isRealHumanData, live.provenance.isRealHumanData);
  assert.equal(onDisk.provenance.validParticipantCount, live.provenance.validParticipantCount);
  assert.equal(onDisk.provenance.collectionStatus, live.provenance.collectionStatus);
});

test('processUserStudyPipeline correctly reports real, nonzero N once real-shaped data is ingested (synthetic test CSV, never touching the real data path)', () => {
  // This CSV is built fresh in the OS temp directory for this test only, and passed to
  // processUserStudyPipeline() via its explicit path override -- it never touches
  // research/raw/real/responses.csv or research/analysis/usability-results.json. Its purpose is
  // to prove the "real" branch of the pipeline actually works (correctly counts valid consenting
  // participants, excludes non-consenting ones, flips isRealHumanData to true), the same way
  // tests/user-study-pipeline.test.ts already does for the underlying SUS/alpha formulas -- this
  // test instead exercises the full processUserStudyPipeline() entry point end-to-end.
  const header = 'timestamp,consent,age,role,progExp,webExp,frameworks,scanFreq,toolsUsed,taskRuleId,taskUnderstandable,taskConfidence,taskManualHelp,taskCompletion,taskDifficulty,sus1,sus2,sus3,sus4,sus5,sus6,sus7,sus8,sus9,sus10,usefulness';
  const consentingRow = (i: number) =>
    [
      `2026-08-14T10:0${i}:00Z`, 'Yes, I consent', 'Adult', 'Student Developer', 'Intermediate', 'Some',
      'React;Vue', 'Weekly', 'ESLint', 'FIGM-A11Y-01', 'Yes', 'High', 'No',
      'Yes, completed all tasks successfully', 'Easy',
      '3', '4', '3', '5', '2', '4', '3', '5', '4', '3',
      '5',
    ].join(',');
  const nonConsentingRow = ['2026-08-14T10:09:00Z', 'No', 'Adult', 'Student Developer', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].join(',');

  const csvContent = [header, consentingRow(1), consentingRow(2), consentingRow(3), nonConsentingRow].join('\n') + '\n';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figm-user-study-pipeline-test-'));
  const csvPath = path.join(tmpDir, 'TEST-FIXTURE-DO-NOT-TREAT-AS-REAL-responses.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf-8');

  try {
    const report = processUserStudyPipeline(csvPath);
    assert.equal(report.provenance.isRealHumanData, true);
    assert.equal(report.provenance.collectionStatus, 'COLLECTED');
    assert.equal(report.provenance.validParticipantCount, 3, 'exactly 3 of the 4 rows consent; the 4th must be excluded, not counted');
    assert.equal(report.provenance.totalResponsesIngested, 4);
    assert.equal(report.provenance.excludedResponsesCount, 1);
    assert.deepEqual(report.provenance.anonymizedParticipantIds, ['P001', 'P002', 'P003']);
    assert.equal(report.provenance.targetReached, false, '3 valid participants must not be reported as reaching the target sample size of 85');
    assert.ok(report.metrics.susMean > 0, 'a real SUS mean must be computed from the ingested Likert data, not left at the zero baseline');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('the synthetic formula-verification evaluator can never present itself as real human data', () => {
  const exporterSrc = read('src/eval/thesis-gap-exporter.ts');

  // The gate must exist and must require BOTH isRealHumanData and a nonzero valid count --
  // neither flag alone is sufficient (matches the exact expression the exporter uses).
  assert.match(exporterSrc, /const isReal = realReport\.provenance\.isRealHumanData && realReport\.provenance\.validParticipantCount > 0;/);

  // The synthetic evaluator's output must only ever be labeled as formula/pipeline test data, and
  // must never be assigned to a field claiming it is the real dataset type.
  assert.match(exporterSrc, /SYNTHETIC_PIPELINE_TEST_DATA/);
  assert.equal(/Dataset Type[^\n]*REAL_HUMAN_DATA[^$]*isReal\s*\?\s*false/.test(exporterSrc), false, 'sanity check on gate direction (this pattern should never match either way -- see the positive assertion below for the real check)');
  assert.match(exporterSrc, /Dataset Type\*\*: \$\{isReal \? 'REAL_HUMAN_DATA' : 'SYNTHETIC_PIPELINE_TEST_DATA'\}/, 'Dataset Type must be driven by the isReal gate, never hardcoded to REAL_HUMAN_DATA');

  const evaluatorSrc = read('src/eval/user-study-evaluator.ts');
  assert.match(evaluatorSrc, /GAP 8/, 'the synthetic evaluator module must keep its own identifying header, distinct from the real pipeline');
});
