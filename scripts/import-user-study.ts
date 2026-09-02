/**
 * FIGM Code Inspector — Real Participant Data Ingestion & Invariant Validator CLI
 * 
 * Usage:
 *   npx tsx scripts/import-user-study.ts [csvFilePath] [--dataset real|synthetic]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../src/research/research-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

export interface ParticipantRawRow {
  timestamp?: string;
  consent: string;
  age: string;
  role: string;
  progExp: string;
  webExp: string;
  frameworks: string;
  scanFreq: string;
  toolsUsed: string;
  taskRuleId: string;
  taskUnderstandable: string;
  taskLocatable: string;
  taskConfidence: number;
  taskManualHelp: string;
  taskCompletion: string;
  taskDifficulty: number;
  sus: [number, number, number, number, number, number, number, number, number, number];
  usefulness: number;
  bestAspect: string;
  improvementText?: string;
  additionalComments?: string;
}

export interface ProcessedUsabilityReport {
  provenance: {
    datasetId: string;
    datasetType: 'REAL_HUMAN_DATA' | 'SYNTHETIC';
    isRealHumanData: boolean;
    collectionStatus: 'COLLECTED' | 'NOT_COLLECTED';
    targetSampleSize: number;
    validParticipantCount: number;
    targetReached: boolean;
    anonymizedParticipantIds: string[];
    totalResponsesIngested: number;
    excludedResponsesCount: number;
    processedAt: string;
  };
  metrics: {
    susMean: number;
    susMedian: number;
    susStdDev: number;
    susMin: number;
    susMax: number;
    cronbachAlpha: number;
    taskCompletionRatePercent: number;
    taskConfidenceMean: number;
    taskDifficultyMean: number;
    usefulnessMean: number;
    ruleIdentificationDistribution: Record<string, number>;
  };
  exclusionLog: string[];
}

/**
 * IMPORTANT (forensic-audit P0-C, "two independent numbering systems"): these `P001`-style ids
 * identify a position in this CSV's valid-row order, assigned purely sequentially, "never the
 * original timestamp/free-text fields" (see research/DATA_COLLECTION_PROTOCOL.md §3.4) -- by
 * design, NOT cross-referenced against the live web app's own P001-style session codes (see
 * src/engine/participant-repository.ts's PARTICIPANT_ID_PATTERN/TARGET_PARTICIPANT_COUNT doc
 * comment for the other half of this). A "P002" here and a "P002" in the live admin scan-history
 * dashboard are two different, uncorrelated identifiers that happen to share a visual format --
 * never assume they refer to the same person anywhere downstream of this function's output.
 */
export function generateAnonymousParticipantIDs(validCount: number): string[] {
  if (validCount <= 0) return [];
  const ids: string[] = [];
  for (let i = 1; i <= validCount; i++) {
    const pad = i.toString().padStart(3, '0');
    ids.push(`P${pad}`);
  }
  return ids;
}

export function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    const values: string[] = [];
    let insideQuotes = false;
    let currentValue = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    return values;
  });
}

export function calculateParticipantSUS(responses: [number, number, number, number, number, number, number, number, number, number]): number {
  let adjustedSum = 0;
  responses.forEach((res, idx) => {
    const itemNum = idx + 1;
    if (itemNum % 2 !== 0) {
      // Odd items: response - 1
      adjustedSum += (res - 1);
    } else {
      // Even items: 5 - response
      adjustedSum += (5 - res);
    }
  });
  return parseFloat((adjustedSum * 2.5).toFixed(2));
}

export function calculateCronbachAlpha(responseMatrix: number[][]): number {
  const nParticipants = responseMatrix.length;
  if (nParticipants < 2) return 0;

  // Align raw SUS items (reverse code even items: 5 - R, shift odd items: R - 1)
  const alignedMatrix = responseMatrix.map(row =>
    row.map((val, idx) => ((idx + 1) % 2 !== 0 ? val - 1 : 5 - val))
  );

  const nItems = alignedMatrix[0].length;
  const itemVariances: number[] = [];

  // Calculate variance per aligned item
  for (let j = 0; j < nItems; j++) {
    const colValues = alignedMatrix.map(row => row[j]);
    const mean = colValues.reduce((a, b) => a + b, 0) / nParticipants;
    const variance = colValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nParticipants - 1);
    itemVariances.push(variance);
  }

  // Calculate total aligned score variance per participant
  const totalScores = alignedMatrix.map(row => row.reduce((a, b) => a + b, 0));
  const totalMean = totalScores.reduce((a, b) => a + b, 0) / nParticipants;
  const totalVariance = totalScores.reduce((a, b) => a + Math.pow(b - totalMean, 2), 0) / (nParticipants - 1);

  if (totalVariance === 0) return 1.0;

  const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0);
  const alpha = (nItems / (nItems - 1)) * (1 - (sumItemVariances / totalVariance));
  return parseFloat(alpha.toFixed(3));
}

export function processUserStudyPipeline(rawCSVPath?: string): ProcessedUsabilityReport {
  const targetPath = rawCSVPath || path.join(rootDir, 'research/raw/real/responses.csv');
  const exclusionLog: string[] = [];

  if (!fs.existsSync(targetPath)) {
    exclusionLog.push(`Raw responses file not found at ${targetPath}. Reporting NOT_COLLECTED baseline state.`);
    return {
      provenance: {
        datasetId: 'FIGM-REAL-HUMAN-USER-STUDY-V1',
        datasetType: 'SYNTHETIC',
        isRealHumanData: false,
        collectionStatus: 'NOT_COLLECTED',
        targetSampleSize: HUMAN_STUDY_TARGET_PARTICIPANTS,
        validParticipantCount: 0,
        targetReached: false,
        anonymizedParticipantIds: [],
        totalResponsesIngested: 0,
        excludedResponsesCount: 0,
        processedAt: new Date().toISOString()
      },
      metrics: {
        susMean: 0,
        susMedian: 0,
        susStdDev: 0,
        susMin: 0,
        susMax: 0,
        cronbachAlpha: 0,
        taskCompletionRatePercent: 0,
        taskConfidenceMean: 0,
        taskDifficultyMean: 0,
        usefulnessMean: 0,
        ruleIdentificationDistribution: {}
      },
      exclusionLog
    };
  }

  const csvContent = fs.readFileSync(targetPath, 'utf-8');
  const rows = parseCSV(csvContent);
  if (rows.length <= 1) {
    exclusionLog.push('CSV file is empty or contains header only.');
    return {
      provenance: {
        datasetId: 'FIGM-REAL-HUMAN-USER-STUDY-V1',
        datasetType: 'SYNTHETIC',
        isRealHumanData: false,
        collectionStatus: 'NOT_COLLECTED',
        targetSampleSize: HUMAN_STUDY_TARGET_PARTICIPANTS,
        validParticipantCount: 0,
        targetReached: false,
        anonymizedParticipantIds: [],
        totalResponsesIngested: 0,
        excludedResponsesCount: 0,
        processedAt: new Date().toISOString()
      },
      metrics: {
        susMean: 0,
        susMedian: 0,
        susStdDev: 0,
        susMin: 0,
        susMax: 0,
        cronbachAlpha: 0,
        taskCompletionRatePercent: 0,
        taskConfidenceMean: 0,
        taskDifficultyMean: 0,
        usefulnessMean: 0,
        ruleIdentificationDistribution: {}
      },
      exclusionLog
    };
  }

  const dataRows = rows.slice(1);
  const validSUSList: number[] = [];
  const validResponseMatrix: number[][] = [];
  let validTaskCompletions = 0;
  const taskConfidences: number[] = [];
  const taskDifficulties: number[] = [];
  const usefulnessList: number[] = [];
  const ruleCounts: Record<string, number> = {};
  let excludedCount = 0;

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    // Expected minimal format: Timestamp, Consent, Age, Role, ..., SUS1..10
    const consent = row[1] || '';
    if (!consent.toLowerCase().includes('yes') && !consent.toLowerCase().includes('consent')) {
      exclusionLog.push(`Row ${rowNum}: Excluded due to missing or negative consent ("${consent}")`);
      excludedCount++;
      return;
    }

    // Extract SUS items: find 10 contiguous integer values in range [1, 5]
    let susValues: number[] = [];
    for (let s = 0; s <= row.length - 10; s++) {
      const candidate: number[] = [];
      for (let k = 0; k < 10; k++) {
        const val = parseInt(row[s + k] || '0', 10);
        if (!isNaN(val) && val >= 1 && val <= 5) {
          candidate.push(val);
        } else {
          break;
        }
      }
      if (candidate.length === 10) {
        susValues = candidate;
        break;
      }
    }

    if (susValues.length !== 10) {
      exclusionLog.push(`Row ${rowNum}: Excluded due to invalid SUS values`);
      excludedCount++;
      return;
    }

    const susScore = calculateParticipantSUS(susValues as [number, number, number, number, number, number, number, number, number, number]);
    validSUSList.push(susScore);
    validResponseMatrix.push(susValues);

    // Q9 Rule Identification Extraction (assuming column index 9)
    const ruleSelected = row[9] || 'Unspecified';
    ruleCounts[ruleSelected] = (ruleCounts[ruleSelected] || 0) + 1;

    const taskCompStr = (row[13] || '').toLowerCase();
    if (taskCompStr.includes('all') || taskCompStr.includes('most') || taskCompStr.includes('successfully')) {
      validTaskCompletions++;
    }

    const conf = parseInt(row[11] || '4', 10);
    if (!isNaN(conf)) taskConfidences.push(conf);

    const diff = parseInt(row[14] || '2', 10);
    if (!isNaN(diff)) taskDifficulties.push(diff);

    const use = parseInt(row[row.length - 1] || '4', 10);
    if (!isNaN(use)) usefulnessList.push(use);
  });

  const validCount = validSUSList.length;
  if (validCount === 0) {
    return {
      provenance: {
        datasetId: 'FIGM-REAL-HUMAN-USER-STUDY-V1',
        datasetType: 'SYNTHETIC',
        isRealHumanData: false,
        collectionStatus: 'NOT_COLLECTED',
        targetSampleSize: HUMAN_STUDY_TARGET_PARTICIPANTS,
        validParticipantCount: 0,
        targetReached: false,
        anonymizedParticipantIds: [],
        totalResponsesIngested: dataRows.length,
        excludedResponsesCount: excludedCount,
        processedAt: new Date().toISOString()
      },
      metrics: {
        susMean: 0,
        susMedian: 0,
        susStdDev: 0,
        susMin: 0,
        susMax: 0,
        cronbachAlpha: 0,
        taskCompletionRatePercent: 0,
        taskConfidenceMean: 0,
        taskDifficultyMean: 0,
        usefulnessMean: 0,
        ruleIdentificationDistribution: {}
      },
      exclusionLog
    };
  }

  const susSum = validSUSList.reduce((a, b) => a + b, 0);
  const susMean = parseFloat((susSum / validCount).toFixed(2));

  const sortedSUS = [...validSUSList].sort((a, b) => a - b);
  const susMedian = sortedSUS.length % 2 === 0
    ? (sortedSUS[sortedSUS.length / 2 - 1] + sortedSUS[sortedSUS.length / 2]) / 2
    : sortedSUS[Math.floor(sortedSUS.length / 2)];

  const susVariance = validSUSList.reduce((a, b) => a + Math.pow(b - susMean, 2), 0) / validCount;
  const susStdDev = parseFloat(Math.sqrt(susVariance).toFixed(2));

  const cronbachAlpha = calculateCronbachAlpha(validResponseMatrix);

  return {
    provenance: {
      datasetId: 'FIGM-REAL-HUMAN-USER-STUDY-V1',
      datasetType: 'REAL_HUMAN_DATA',
      isRealHumanData: true,
      collectionStatus: 'COLLECTED',
      targetSampleSize: HUMAN_STUDY_TARGET_PARTICIPANTS,
      validParticipantCount: validCount,
      targetReached: validCount >= HUMAN_STUDY_TARGET_PARTICIPANTS,
      anonymizedParticipantIds: generateAnonymousParticipantIDs(validCount),
      totalResponsesIngested: dataRows.length,
      excludedResponsesCount: excludedCount,
      processedAt: new Date().toISOString()
    },
    metrics: {
      susMean,
      susMedian,
      susStdDev,
      susMin: Math.min(...validSUSList),
      susMax: Math.max(...validSUSList),
      cronbachAlpha,
      taskCompletionRatePercent: parseFloat(((validTaskCompletions / validCount) * 100).toFixed(1)),
      taskConfidenceMean: parseFloat((taskConfidences.reduce((a, b) => a + b, 0) / (taskConfidences.length || 1)).toFixed(2)),
      taskDifficultyMean: parseFloat((taskDifficulties.reduce((a, b) => a + b, 0) / (taskDifficulties.length || 1)).toFixed(2)),
      usefulnessMean: parseFloat((usefulnessList.reduce((a, b) => a + b, 0) / (usefulnessList.length || 1)).toFixed(2)),
      ruleIdentificationDistribution: ruleCounts
    },
    exclusionLog
  };
}

if (process.argv[1] && process.argv[1].endsWith('import-user-study.ts')) {
  console.log('====================================================');
  console.log('FIGM Real User Study CSV Ingestion Engine');
  console.log('====================================================');
  const customPath = process.argv[2];
  const report = processUserStudyPipeline(customPath);
  console.log(JSON.stringify(report, null, 2));

  const outPath = path.join(rootDir, 'research/analysis/usability-results.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`[USER STUDY PIPELINE] Saved analysis report to: ${outPath}`);
}
