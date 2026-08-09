import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateParticipantSUS,
  calculateCronbachAlpha,
  parseCSV,
  generateAnonymousParticipantIDs,
  processUserStudyPipeline
} from '../scripts/import-user-study.js';

describe('Real Participant User Study Pipeline & Invariant Test Suite', () => {
  test('calculateParticipantSUS accurately computes SUS score using odd/even item formulas', () => {
    const perfectResponses: [number, number, number, number, number, number, number, number, number, number] = [5, 1, 5, 1, 5, 1, 5, 1, 5, 1];
    assert.equal(calculateParticipantSUS(perfectResponses), 100.0);

    const worstResponses: [number, number, number, number, number, number, number, number, number, number] = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
    assert.equal(calculateParticipantSUS(worstResponses), 0.0);

    const sampleResponses: [number, number, number, number, number, number, number, number, number, number] = [4, 2, 4, 1, 5, 1, 5, 2, 4, 1];
    assert.equal(calculateParticipantSUS(sampleResponses), 87.5);
  });

  test('calculateCronbachAlpha dynamically computes alpha reliability from item response matrix', () => {
    const matrix = [
      [5, 1, 5, 1, 5, 1, 5, 1, 5, 1],
      [4, 2, 4, 2, 4, 2, 4, 2, 4, 2],
      [5, 1, 4, 1, 5, 2, 5, 1, 4, 1],
      [4, 1, 5, 2, 4, 1, 4, 2, 5, 2]
    ];
    const alpha = calculateCronbachAlpha(matrix);
    assert.ok(alpha > 0.8, `Cronbach alpha (${alpha}) should indicate high internal consistency (> 0.8)`);
  });

  test('parseCSV handles quoted comma values, Sinhala/English Unicode, and line breaks cleanly', () => {
    const csvData = `Timestamp,Consent,Role,Comments\n"2026-08-09T09:00:00Z","Yes, I consent","Software Engineer","අත්දැකීම ඉතා හොඳයි / Great tool!"`;
    const rows = parseCSV(csvData);
    assert.equal(rows.length, 2);
    assert.equal(rows[1][1], 'Yes, I consent');
    assert.equal(rows[1][2], 'Software Engineer');
    assert.equal(rows[1][3], 'අත්දැකීම ඉතා හොඳයි / Great tool!');
  });

  test('generateAnonymousParticipantIDs returns zero IDs when dataset is empty (0 valid records)', () => {
    const ids = generateAnonymousParticipantIDs(0);
    assert.deepEqual(ids, [], '0 valid records MUST produce an empty ID array');
  });

  test('generateAnonymousParticipantIDs produces exactly P001..P005 for 5 valid records', () => {
    const ids = generateAnonymousParticipantIDs(5);
    const expected = ['P001', 'P002', 'P003', 'P004', 'P005'];
    assert.deepEqual(ids, expected, '5 valid records MUST produce P001 through P005');
  });

  test('generateAnonymousParticipantIDs produces exactly P001..P085 for 85 valid records', () => {
    const ids = generateAnonymousParticipantIDs(85);
    assert.equal(ids.length, 85, '85 valid records MUST produce 85 IDs');
    assert.equal(ids[0], 'P001', 'First ID must be P001');
    assert.equal(ids[84], 'P085', '85th ID must be P085');
  });

  test('Invalid and excluded records do not consume participant IDs during ingestion', () => {
    const tmpCSV = path.join(__dirname, 'temp-test-responses.csv');
    const header = 'Timestamp,Consent,Age,Role,ProgExp,WebExp,Frameworks,ScanFreq,Tools,TaskRule,TaskClear,TaskLoc,TaskConf,TaskComp,TaskDiff,SUS1,SUS2,SUS3,SUS4,SUS5,SUS6,SUS7,SUS8,SUS9,SUS10,Usefulness\n';
    
    // 1 Valid row, 1 Invalid unconsented row, 1 Valid row
    const row1 = '2026-08-09,Yes,25,Engineer,2,2,React,Often,ESLint,FIGM-PERF-01,Yes,Yes,4,Successfully,2,4,2,4,1,5,1,5,2,4,1,4\n';
    const row2 = '2026-08-09,No,25,Engineer,2,2,React,Often,ESLint,FIGM-PERF-01,Yes,Yes,4,Successfully,2,4,2,4,1,5,1,5,2,4,1,4\n'; // Invalid (No consent)
    const row3 = '2026-08-09,Yes,25,Engineer,2,2,React,Often,ESLint,FIGM-A11Y-01,Yes,Yes,4,Successfully,2,4,2,4,1,5,1,5,2,4,1,4\n';

    fs.writeFileSync(tmpCSV, header + row1 + row2 + row3);

    const report = processUserStudyPipeline(tmpCSV);
    fs.unlinkSync(tmpCSV);

    assert.equal(report.provenance.totalResponsesIngested, 3);
    assert.equal(report.provenance.validParticipantCount, 2);
    assert.equal(report.provenance.excludedResponsesCount, 1);
    assert.equal(report.provenance.targetReached, false);
    assert.deepEqual(
      report.provenance.anonymizedParticipantIds,
      ['P001', 'P002'],
      'Excluded records MUST NOT consume participant IDs'
    );
    assert.equal(report.metrics.ruleIdentificationDistribution['FIGM-PERF-01'], 1);
    assert.equal(report.metrics.ruleIdentificationDistribution['FIGM-A11Y-01'], 1);
  });

  test('Target progress tracking sets targetReached to true when valid responses >= 85 and handles N=86 overshoot without truncation', () => {
    const tmpCSV = path.join(__dirname, 'temp-test-86-responses.csv');
    const header = 'Timestamp,Consent,Age,Role,ProgExp,WebExp,Frameworks,ScanFreq,Tools,TaskRule,TaskClear,TaskLoc,TaskConf,TaskComp,TaskDiff,SUS1,SUS2,SUS3,SUS4,SUS5,SUS6,SUS7,SUS8,SUS9,SUS10,Usefulness\n';
    const validRow = '2026-08-09,Yes,25,Engineer,2,2,React,Often,ESLint,FIGM-PERF-01,Yes,Yes,4,Successfully,2,4,2,4,1,5,1,5,2,4,1,4\n';
    
    let rows = header;
    for (let i = 0; i < 86; i++) {
      rows += validRow;
    }

    fs.writeFileSync(tmpCSV, rows);
    const report = processUserStudyPipeline(tmpCSV);
    fs.unlinkSync(tmpCSV);

    assert.equal(report.provenance.validParticipantCount, 86);
    assert.equal(report.provenance.targetReached, true, '86 valid records MUST set targetReached to true');
    assert.equal(report.provenance.anonymizedParticipantIds.length, 86);
    assert.equal(report.provenance.anonymizedParticipantIds[85], 'P086', '86th valid record MUST produce P086 without truncation');
  });
});
