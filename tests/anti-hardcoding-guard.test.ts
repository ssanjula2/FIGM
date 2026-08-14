import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POST as logScanPOST } from '../app/api/user-study/log-scan/route';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsFiles(fullPath));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

describe('Source-Level Anti-Hardcoding Guard Suite', () => {
  test('PrecisionRecallEngine has zero default parameters for matrix in production calculateMetrics', () => {
    const filePath = path.join(rootDir, 'src/eval/precision-recall-engine.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify calculateMetrics signature strictly requires matrix parameter without a default fallback
    const hasDefaultMatrix = /calculateMetrics\s*\(\s*matrix\s*:\s*ConfusionMatrix\s*=/g.test(content);
    assert.equal(hasDefaultMatrix, false, 'Production PrecisionRecallEngine.calculateMetrics MUST NOT have a default matrix parameter');

    // Verify calculateMetrics does not contain hardcoded return values for precision/recall/f1
    const hasHardcodedReturn = /precision\s*:\s*85\.7|recall\s*:\s*94\.7|f1Score\s*:\s*90\.0/g.test(content);
    assert.equal(hasHardcodedReturn, false, 'Production PrecisionRecallEngine MUST NOT return hardcoded metric literals');
  });

  test('UserStudyEvaluator derives Cronbach alpha and SUS dynamically without hardcoded metric defaults', () => {
    const filePath = path.join(rootDir, 'src/eval/user-study-evaluator.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify Cronbach alpha is computed dynamically from variances
    const hasDynamicAlpha = /cronbachAlpha\s*=/g.test(content) || /calculateAlpha/g.test(content) || /variances/g.test(content);
    assert.ok(hasDynamicAlpha, 'UserStudyEvaluator must contain dynamic Cronbach alpha calculation');

    // Verify production calculateStudySummary does not assign hardcoded return literals directly
    const hasHardcodedAlphaReturn = /return\s*\{\s*sampleSize\s*:\s*85\s*,\s*overallSatisfactionMean\s*:\s*4\.6\s*,\s*cronbachAlpha\s*:\s*0\.892\s*\}/g.test(content);
    assert.equal(hasHardcodedAlphaReturn, false, 'UserStudyEvaluator MUST NOT return hardcoded static literals');
  });

  test('EvaluationRunner exports generated artifacts to disk without circular reading of canonical outputs', () => {
    const filePath = path.join(rootDir, 'src/eval/evaluation-runner.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Inspect runEvaluation method to ensure it reads benchmark source and ground-truth, NOT canonical-evaluation.json
    const runEvalMatch = content.match(/public static runEvaluation\(\)[\s\S]*?^  \}/m);
    assert.ok(runEvalMatch, 'Found runEvaluation implementation');

    const runEvalBody = runEvalMatch[0];
    const readsCanonicalInput = runEvalBody.includes('canonical-evaluation.json') || runEvalBody.includes('eval-summary.json');
    assert.equal(readsCanonicalInput, false, 'EvaluationRunner.runEvaluation MUST NOT read canonical output artifacts as inputs');
  });

  test('Comprehensive Source Inspection: No production files in src/eval or src/engine contain static metric return fallbacks', () => {
    const evalDir = path.join(rootDir, 'src/eval');
    const engineDir = path.join(rootDir, 'src/engine');
    const targetFiles = [...getAllTsFiles(evalDir), ...getAllTsFiles(engineDir)];

    // No exemptions: thesis-gap-exporter.ts sources its dissertation chapter content from a live
    // EvaluationRunner.runEvaluation() call, not a hardcoded matrix. benchmark-data-loader.ts (a
    // dead, never-imported module whose FALLBACK_BENCHMARK_METRICS carried the exact retired
    // {tp:18,fp:3,fn:1} / 85.7%/94.7%/90.0% figures as a hardcoded fallback -- previously
    // exempted from this very scan on the mistaken belief it only read the ground-truth file at
    // runtime) has been deleted entirely rather than fixed in place, since nothing in the live
    // app ever imported it.
    const prodFiles = targetFiles;

    const suspiciousPatterns = [
      { name: 'Hardcoded Precision Return', regex: /precision\s*:\s*85\.71/i },
      { name: 'Hardcoded Recall Return', regex: /recall\s*:\s*94\.74/i },
      { name: 'Hardcoded F1 Return', regex: /f1\s*:\s*90\.00|f1Score\s*:\s*90\.00/i },
      { name: 'Hardcoded Cronbach Alpha Return', regex: /cronbachAlpha\s*:\s*0\.892/i },
      { name: 'Hardcoded SUS Return', regex: /sus\s*:\s*86\.4/i },
      { name: 'Hardcoded Fallback Branch', regex: /if\s*\(\s*!matrix\s*\)\s*\{\s*return\s*\{\s*precision\s*:\s*85/i },
      { name: 'Hardcoded Metric Array', regex: /\[\s*85\.71\s*,\s*94\.74\s*,\s*90\.0\s*\]/i },
      { name: 'Hardcoded JSON String Metric', regex: /JSON\.parse\s*\(\s*['"`].*precision.*85\.71/i },
      // Trailing-comma-tolerant (a prior version of this regex required the closing "}" to
      // immediately follow "tn: 25" with no comma in between -- the real EMPIRICAL_EXPERT_GROUND_TRUTH
      // constant this guards against was formatted with a trailing comma before "}" and so slipped
      // past the original regex undetected; fixed here as part of retiring that constant for real).
      { name: 'Hardcoded Confusion Matrix Constant', regex: /\{\s*tp\s*:\s*18\s*,\s*fp\s*:\s*3\s*,\s*fn\s*:\s*1\s*,\s*tn\s*:\s*25\s*,?\s*\}/i },
      { name: 'Nullish Fallback to Research Value', regex: /(\?\?|\|\|)\s*(85\.71|94\.74|90\.00|90\.0)/i }
    ];

    prodFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      suspiciousPatterns.forEach((pattern) => {
        const matches = pattern.regex.test(content);
        assert.equal(
          matches,
          false,
          `Production file ${path.relative(rootDir, file)} contains suspicious hardcoded metric pattern: ${pattern.name}`
        );
      });
    });
  });

  test('Mathematical Invariants & Anti-Fabrication: Synthetic data provenance strictly enforces isRealHumanData === false', () => {
    const { ResearchDataPipeline } = require('../src/eval/research-data-pipeline');
    const provenance = ResearchDataPipeline.getSyntheticModelProvenance();

    assert.equal(provenance.isRealHumanData, false, 'Synthetic usability dataset MUST NOT be labeled as real human data');
    assert.equal(provenance.datasetType, 'SYNTHETIC', 'Synthetic usability dataset must be explicitly classified as SYNTHETIC');

    // Verify consent check blocks invalid ingestion
    const invalidRecord = {
      anonymousParticipantId: 'P001',
      consentGiven: false,
      consentTimestamp: new Date().toISOString(),
      sessionId: 'S001',
      studyVersion: '1.0.0',
      susResponses: [4, 2, 4, 1, 5, 1, 5, 2, 4, 1]
    };
    const errors = ResearchDataPipeline.validateParticipantRecord(invalidRecord);
    assert.ok(errors.length > 0, 'Validation MUST reject participant records without consent');
  });

  test('Pipeline Baseline Provenance: Missing or uncollected raw data MUST report isRealHumanData = false and collectionStatus = NOT_COLLECTED', () => {
    const { processUserStudyPipeline } = require('../scripts/import-user-study');
    const nonExistentPath = path.join(__dirname, 'non-existent-responses.csv');
    const report = processUserStudyPipeline(nonExistentPath);

    assert.equal(report.provenance.isRealHumanData, false, 'Missing raw response file MUST report isRealHumanData = false');
    assert.equal(report.provenance.collectionStatus, 'NOT_COLLECTED', 'Missing raw response file MUST report collectionStatus = NOT_COLLECTED');
    assert.equal(report.provenance.validParticipantCount, 0, 'Missing raw response file MUST report validParticipantCount = 0');
    assert.equal(report.provenance.datasetType, 'SYNTHETIC', 'Missing raw response file MUST classify datasetType as SYNTHETIC');
    assert.equal(report.provenance.targetReached, false, 'Missing raw response file MUST report targetReached = false');
  });

  test('scripts/ directory contains no fabricated-participant seed scripts (regression guard)', () => {
    // These 8 scripts previously fabricated up to 85 fake "developer"/"participant" user
    // accounts -- some using the real, identifiable names and emails of actual open-source
    // maintainers and professional athletes -- and wrote them directly into figm-user-db.json
    // and, for several of them, the real Supabase database. They were deleted entirely rather
    // than fixed in place, since a script whose only purpose is fabricating participant records
    // is itself the problem, not a bug within it. This test fails loudly if any of them (or an
    // obvious re-creation under the same name) is ever reintroduced.
    const bannedScriptNames = [
      'seed-85-developers.ts',
      'seed-hybrid-real-cohort.ts',
      'force-wipe-supabase-and-seed-85.ts',
      'wipe-and-seed-clean-85-users.ts',
      'seed-all-database-tables.ts',
      'seed-all-tables-prisma.ts',
      'seed-multi-framework-data.ts',
      'seed-prisma-compiled.js',
    ];
    const scriptsDir = path.join(rootDir, 'scripts');
    const existingFiles = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir) : [];
    for (const banned of bannedScriptNames) {
      assert.equal(existingFiles.includes(banned), false, `scripts/${banned} fabricates participant data and must not exist`);
    }
  });

  test('scripts/ directory contains no script that both defines a large hardcoded name list and writes it to the database', () => {
    // A more general version of the guard above: catches a differently-named script built the
    // same way (many hardcoded human names + a direct figm-user-db.json/Supabase write), not
    // just the specific 8 filenames already known and removed.
    const scriptsDir = path.join(rootDir, 'scripts');
    const files = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.ts') || f.endsWith('.js')) : [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(scriptsDir, file), 'utf-8');
      const nameArrayMatch = content.match(/\[\s*(?:'[^']{3,40}'\s*,\s*){10,}/);
      const writesToDb = /figm-user-db\.json|from\(['"]users['"]\)\.upsert|from\(['"]users['"]\)\.insert/.test(content);
      assert.ok(
        !(nameArrayMatch && writesToDb),
        `scripts/${file} appears to define a hardcoded list of >=10 names AND write directly to the user database -- this is the exact shape of the fabricated-cohort scripts already removed. If this is legitimate, it must operate only on isolated test fixtures, never figm-user-db.json or the real Supabase 'users' table.`
      );
    }
  });

  test('DissertationExporter.generateChapter5LaTeX never claims a completed human study or reports a specific SUS/satisfaction number', () => {
    // A prior version of this generator hardcoded a "NSBM Green University Student Developer
    // Cohort Evaluation" section claiming "primary data was collected" from 85 students, with an
    // invented SUS score (84.6/100, "Grade A") and two invented satisfaction percentages that
    // existed nowhere else in the codebase -- no formula, no synthetic-test-vector basis, just
    // typed-in numbers. This is reachable live via authenticated GET /api/export-dissertation.
    const filePath = path.join(rootDir, 'src/docs/dissertation-exporter.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.equal(/primary data was collected/i.test(content), false, 'Must not claim data collection occurred without a real data source');
    assert.equal(/84\.6|92\.4\\?%|89\.1\\?%/.test(content), false, 'Must not contain the specific fabricated SUS/satisfaction figures');
    assert.equal(/Grade A/i.test(content), false, 'Must not contain a fabricated qualitative usability grade');
  });

  test('POST /api/user-study/log-scan requires real code and never accepts a client-supplied score (regression guard)', async () => {
    const noCodeReq = new Request('http://localhost:3000/api/user-study/log-scan', {
      method: 'POST',
      body: JSON.stringify({ participantId: 'P001', framework: 'React', fileName: 'X.jsx', qualityScore: 99, diagnosticsCount: 0 }),
    });
    const noCodeRes = await logScanPOST(noCodeReq);
    assert.equal(noCodeRes.status, 400, 'A request with no real code (even one supplying a client-side score) must be rejected, not silently logged with a fabricated/trusted score');

    const source = fs.readFileSync(path.join(rootDir, 'app/api/user-study/log-scan/route.ts'), 'utf-8');
    assert.equal(/clientScore|clientCount/.test(source), false, 'log-scan must not read a client-supplied qualityScore/diagnosticsCount at all');
    assert.equal(/FIGM-STANDARD-2026/.test(source), false, 'log-scan must not contain the old canned fallback diagnostic');
  });
});
