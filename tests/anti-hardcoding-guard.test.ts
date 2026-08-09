import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

    // Ignore documentation exporters (like thesis-gap-exporter) which reference benchmark ground truth for thesis formatting
    const prodFiles = targetFiles.filter(f => !f.includes('thesis-gap-exporter.ts') && !f.includes('benchmark-data-loader.ts'));

    const suspiciousPatterns = [
      { name: 'Hardcoded Precision Return', regex: /precision\s*:\s*85\.71/i },
      { name: 'Hardcoded Recall Return', regex: /recall\s*:\s*94\.74/i },
      { name: 'Hardcoded F1 Return', regex: /f1\s*:\s*90\.00|f1Score\s*:\s*90\.00/i },
      { name: 'Hardcoded Cronbach Alpha Return', regex: /cronbachAlpha\s*:\s*0\.892/i },
      { name: 'Hardcoded SUS Return', regex: /sus\s*:\s*86\.4/i },
      { name: 'Hardcoded Fallback Branch', regex: /if\s*\(\s*!matrix\s*\)\s*\{\s*return\s*\{\s*precision\s*:\s*85/i },
      { name: 'Hardcoded Metric Array', regex: /\[\s*85\.71\s*,\s*94\.74\s*,\s*90\.0\s*\]/i },
      { name: 'Hardcoded JSON String Metric', regex: /JSON\.parse\s*\(\s*['"`].*precision.*85\.71/i },
      { name: 'Hardcoded Confusion Matrix Constant', regex: /\{\s*tp\s*:\s*18\s*,\s*fp\s*:\s*3\s*,\s*fn\s*:\s*1\s*,\s*tn\s*:\s*25\s*\}/i },
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

  test('Mathematical Invariants: Precision, Recall, and F1 satisfy 0 <= metric <= 1', () => {
    const { PrecisionRecallEngine } = require('../src/eval/precision-recall-engine');
    const sampleMatrix = { tp: 18, fp: 3, fn: 1, tn: 25 };
    const metrics = PrecisionRecallEngine.calculateMetrics(sampleMatrix);

    assert.ok(metrics.precision >= 0 && metrics.precision <= 100, 'Precision must be bounded in [0, 100]');
    assert.ok(metrics.recall >= 0 && metrics.recall <= 100, 'Recall must be bounded in [0, 100]');
    assert.ok(metrics.f1Score >= 0 && metrics.f1Score <= 100, 'F1-Score must be bounded in [0, 100]');
  });
});
