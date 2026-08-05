import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_GUIDELINES,
  GuidelineFilteringEngine
} from '../src/pipeline/guideline-filtering.js';

describe('FIGM 3-Stage Guideline Extraction Protocol', () => {
  test('Initial Candidate Pool contains N = 18 guidelines', () => {
    assert.equal(CANDIDATE_GUIDELINES.length, 18);
  });

  test('Filter 1 (Framework Independence) filters down N = 18 -> N = 12', () => {
    const { retained, stageResult } = GuidelineFilteringEngine.runFilter1(CANDIDATE_GUIDELINES);
    assert.equal(retained.length, 12);
    assert.equal(stageResult.inputCount, 18);
    assert.equal(stageResult.outputCount, 12);
    assert.equal(stageResult.eliminatedIds.length, 6);

    // Verify framework-dependent guidelines were eliminated
    const frameworkIds = [
      'FIGM-CAND-FW-01',
      'FIGM-CAND-FW-02',
      'FIGM-CAND-FW-03',
      'FIGM-CAND-FW-04',
      'FIGM-CAND-FW-05',
      'FIGM-CAND-FW-06'
    ];
    for (const id of frameworkIds) {
      assert.ok(stageResult.eliminatedIds.includes(id), `Expected ${id} to be eliminated by Filter 1`);
    }
  });

  test('Filter 2 (Static Detectability) filters down N = 12 -> N = 10', () => {
    const stage1 = GuidelineFilteringEngine.runFilter1(CANDIDATE_GUIDELINES);
    const { retained, stageResult } = GuidelineFilteringEngine.runFilter2(stage1.retained);

    assert.equal(retained.length, 10);
    assert.equal(stageResult.inputCount, 12);
    assert.equal(stageResult.outputCount, 10);
    assert.equal(stageResult.eliminatedIds.length, 2);

    // Verify runtime-only guidelines were eliminated
    const dynamicIds = ['FIGM-CAND-DYN-01', 'FIGM-CAND-DYN-02'];
    for (const id of dynamicIds) {
      assert.ok(stageResult.eliminatedIds.includes(id), `Expected ${id} to be eliminated by Filter 2`);
    }
  });

  test('Filter 3 (Standard Traceability) filters down N = 10 -> N = 8 core guidelines', () => {
    const stage1 = GuidelineFilteringEngine.runFilter1(CANDIDATE_GUIDELINES);
    const stage2 = GuidelineFilteringEngine.runFilter2(stage1.retained);
    const { retained, stageResult } = GuidelineFilteringEngine.runFilter3(stage2.retained);

    assert.equal(retained.length, 8);
    assert.equal(stageResult.inputCount, 10);
    assert.equal(stageResult.outputCount, 8);
    assert.equal(stageResult.eliminatedIds.length, 2);

    // Verify style/non-standard guidelines were eliminated
    const styleIds = ['FIGM-CAND-STYLE-01', 'FIGM-CAND-STYLE-02'];
    for (const id of styleIds) {
      assert.ok(stageResult.eliminatedIds.includes(id), `Expected ${id} to be eliminated by Filter 3`);
    }
  });

  test('Full Pipeline Execution outputs exactly 8 Core Guidelines matching FIGM-PERF-01..04 and FIGM-A11Y-01..04', () => {
    const report = GuidelineFilteringEngine.executePipeline();

    assert.equal(report.initialCount, 18);
    assert.equal(report.finalCount, 8);
    assert.equal(report.stages.length, 3);

    const expectedIds = [
      'FIGM-PERF-01',
      'FIGM-PERF-02',
      'FIGM-PERF-03',
      'FIGM-PERF-04',
      'FIGM-A11Y-01',
      'FIGM-A11Y-02',
      'FIGM-A11Y-03',
      'FIGM-A11Y-04'
    ];

    const actualIds = report.coreGuidelines.map((g) => g.id);
    assert.deepEqual(actualIds, expectedIds);

    // Verify every core guideline has valid standard traceability
    for (const guideline of report.coreGuidelines) {
      assert.ok(guideline.traceability !== undefined, `${guideline.id} missing traceability`);
      assert.ok(
        guideline.traceability.standard === 'ISO_25010' ||
          guideline.traceability.standard === 'WCAG_2_2',
        `${guideline.id} invalid standard`
      );
    }
  });
});
