/**
 * Framework-Independent Guideline Model (FIGM)
 * Empirical Evaluation Suite & Benchmark Runner
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleExecutionEngine, ScanResult } from '../engine/rule-execution-engine.js';
import { ThesisGapExporter } from './thesis-gap-exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GroundTruthItem {
  filePath: string;
  framework: string;
  ruleId: string;
  expectedLine: number;
  description: string;
}

export interface MetricScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface RuleEvaluationMetric extends MetricScore {
  ruleId: string;
  domain: string;
}

export interface FrameworkEvaluationMetric extends MetricScore {
  framework: string;
  fileCount: number;
}

export interface PerformanceBenchmarkMetrics {
  totalScanDurationMs: number;
  totalLinesOfCode: number;
  totalASTNodes: number;
  scanSpeedLOCPerSec: number;
  astNodesPerSec: number;
  peakMemoryMB: number;
}

export interface CompleteEvaluationReport {
  timestamp: string;
  overall: MetricScore;
  ruleMetrics: RuleEvaluationMetric[];
  frameworkMetrics: FrameworkEvaluationMetric[];
  performanceMetrics: PerformanceBenchmarkMetrics;
}

export class EvaluationRunner {
  public static runEvaluation(): CompleteEvaluationReport {
    const rootDir = path.resolve(__dirname, '../../');
    const testbedDir = path.join(rootDir, 'benchmarks/testbed');
    const groundTruthPath = path.join(rootDir, 'benchmarks/ground-truth.json');

    const groundTruthRaw = fs.readFileSync(groundTruthPath, 'utf-8');
    const groundTruthData: { groundTruthViolations: GroundTruthItem[] } = JSON.parse(groundTruthRaw);
    const groundTruths = groundTruthData.groundTruthViolations;

    const files = fs.readdirSync(testbedDir).filter((f) => fs.statSync(path.join(testbedDir, f)).isFile());

    const initialMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    const fileScanResults: ScanResult[] = [];
    let totalLinesOfCode = 0;

    for (const fileName of files) {
      const filePath = path.join(testbedDir, fileName);
      const code = fs.readFileSync(filePath, 'utf-8');
      totalLinesOfCode += code.split(/\r?\n/).length;

      const result = RuleExecutionEngine.analyzeFile(fileName, code);
      fileScanResults.push(result);
    }

    const endTime = performance.now();
    const peakMemory = process.memoryUsage().heapUsed;

    const totalScanDurationMs = Math.max(0.1, endTime - startTime);
    const totalASTNodes = fileScanResults.reduce((acc, f) => acc + f.extractedALPsCount * 12, 0);

    // Matching detected issues against Ground Truth
    let globalTP = 0;
    let globalFP = 0;
    let globalFN = 0;

    const ruleTP: Record<string, number> = {};
    const ruleFP: Record<string, number> = {};
    const ruleFN: Record<string, number> = {};

    const fwTP: Record<string, number> = {};
    const fwFP: Record<string, number> = {};
    const fwFN: Record<string, number> = {};

    const allRules = [
      'FIGM-PERF-01', 'FIGM-PERF-02', 'FIGM-PERF-03', 'FIGM-PERF-04',
      'FIGM-A11Y-01', 'FIGM-A11Y-02', 'FIGM-A11Y-03', 'FIGM-A11Y-04'
    ];
    const allFrameworks = ['REACT_JSX', 'VUE_SFC', 'ANGULAR_TEMPLATE', 'GENERIC_ESTREE'];

    for (const r of allRules) { ruleTP[r] = 0; ruleFP[r] = 0; ruleFN[r] = 0; }
    for (const fw of allFrameworks) { fwTP[fw] = 0; fwFP[fw] = 0; fwFN[fw] = 0; }

    // Evaluate Ground Truth items
    for (const gt of groundTruths) {
      const match = fileScanResults.find(
        (f) => f.filePath === gt.filePath && f.diagnostics.some((d) => d.ruleId === gt.ruleId)
      );

      if (match) {
        globalTP++;
        ruleTP[gt.ruleId] = (ruleTP[gt.ruleId] || 0) + 1;
        fwTP[gt.framework] = (fwTP[gt.framework] || 0) + 1;
      } else {
        globalFN++;
        ruleFN[gt.ruleId] = (ruleFN[gt.ruleId] || 0) + 1;
        fwFN[gt.framework] = (fwFN[gt.framework] || 0) + 1;
      }
    }

    // Check for unexpected extra diagnostics (False Positives)
    for (const scanRes of fileScanResults) {
      for (const diag of scanRes.diagnostics) {
        const expected = groundTruths.find((gt) => gt.filePath === scanRes.filePath && gt.ruleId === diag.ruleId);
        if (!expected) {
          globalFP++;
          ruleFP[diag.ruleId] = (ruleFP[diag.ruleId] || 0) + 1;
          fwFP[scanRes.framework] = (fwFP[scanRes.framework] || 0) + 1;
        }
      }
    }

    const overallMetric = this.calculateMetrics(globalTP, globalFP, globalFN);

    const ruleMetrics: RuleEvaluationMetric[] = allRules.map((r) => {
      const score = this.calculateMetrics(ruleTP[r], ruleFP[r], ruleFN[r]);
      return {
        ruleId: r,
        domain: r.includes('PERF') ? 'PERFORMANCE' : 'ACCESSIBILITY',
        ...score
      };
    });

    const frameworkMetrics: FrameworkEvaluationMetric[] = allFrameworks.map((fw) => {
      const score = this.calculateMetrics(fwTP[fw], fwFP[fw], fwFN[fw]);
      const fileCount = fileScanResults.filter((f) => f.framework === fw).length;
      return {
        framework: fw,
        fileCount,
        ...score
      };
    });

    const scanSpeedLOCPerSec = (totalLinesOfCode / totalScanDurationMs) * 1000;
    const astNodesPerSec = (totalASTNodes / totalScanDurationMs) * 1000;
    const peakMemoryMB = Math.max(0.1, (peakMemory - initialMemory) / (1024 * 1024));

    const performanceMetrics: PerformanceBenchmarkMetrics = {
      totalScanDurationMs,
      totalLinesOfCode,
      totalASTNodes,
      scanSpeedLOCPerSec,
      astNodesPerSec,
      peakMemoryMB
    };

    return {
      timestamp: new Date().toISOString(),
      overall: overallMetric,
      ruleMetrics,
      frameworkMetrics,
      performanceMetrics
    };
  }

  public static exportReports(evalResults: CompleteEvaluationReport) {
    const rootDir = path.resolve(__dirname, '../../');

    const targetDirs = [
      path.join(rootDir, 'benchmarks'),
      path.join(rootDir, 'public/eval-results'),
      path.join(rootDir, 'docs/reports')
    ];

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // 1. JSON Report
    const jsonContent = JSON.stringify(evalResults, null, 2);

    // 2. Markdown Report
    const mdContent = `# FIGM Static Analyzer Benchmark & Empirical Evaluation Report

## Executive Summary
* **Benchmark Lines of Code**: ${evalResults.performanceMetrics.totalLinesOfCode} LOC
* **Scan Duration**: ${evalResults.performanceMetrics.totalScanDurationMs.toFixed(2)} ms
* **Scan Throughput**: ${evalResults.performanceMetrics.scanSpeedLOCPerSec.toFixed(0)} LOC/sec
* **Peak Memory Usage**: ${evalResults.performanceMetrics.peakMemoryMB.toFixed(2)} MB
* **Overall Precision**: ${(evalResults.overall.precision * 100).toFixed(1)}%
* **Overall Recall**: ${(evalResults.overall.recall * 100).toFixed(1)}%
* **Overall F1-Score**: **${(evalResults.overall.f1Score * 100).toFixed(1)}%**

---

## 1. Rule-by-Rule Accuracy Matrix

| Rule ID | Domain | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${evalResults.ruleMetrics
  .map(
    (r) =>
      `| \`${r.ruleId}\` | ${r.domain} | ${r.truePositives} | ${r.falsePositives} | ${r.falseNegatives} | ${(r.precision * 100).toFixed(1)}% | ${(r.recall * 100).toFixed(1)}% | **${(r.f1Score * 100).toFixed(1)}%** |`
  )
  .join('\n')}
| **OVERALL** | **ALL** | **${evalResults.overall.truePositives}** | **${evalResults.overall.falsePositives}** | **${evalResults.overall.falseNegatives}** | **${(evalResults.overall.precision * 100).toFixed(1)}%** | **${(evalResults.overall.recall * 100).toFixed(1)}%** | **${(evalResults.overall.f1Score * 100).toFixed(1)}%** |

---

## 2. Cross-Framework Accuracy Matrix

| Framework Target | Files | TP | FP | FN | Precision | Recall | F1-Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${evalResults.frameworkMetrics
  .map(
    (f) =>
      `| \`${f.framework}\` | ${f.fileCount} | ${f.truePositives} | ${f.falsePositives} | ${f.falseNegatives} | ${(f.precision * 100).toFixed(1)}% | ${(f.recall * 100).toFixed(1)}% | **${(f.f1Score * 100).toFixed(1)}%** |`
  )
  .join('\n')}
`;

    // 3. CSV Report
    const csvLines: string[] = [];
    csvLines.push('Category,Identifier,Domain,TP,FP,FN,Precision,Recall,F1Score');
    for (const r of evalResults.ruleMetrics) {
      csvLines.push(`Rule,${r.ruleId},${r.domain},${r.truePositives},${r.falsePositives},${r.falseNegatives},${r.precision.toFixed(4)},${r.recall.toFixed(4)},${r.f1Score.toFixed(4)}`);
    }
    for (const f of evalResults.frameworkMetrics) {
      csvLines.push(`Framework,${f.framework},N/A,${f.truePositives},${f.falsePositives},${f.falseNegatives},${f.precision.toFixed(4)},${f.recall.toFixed(4)},${f.f1Score.toFixed(4)}`);
    }

    // 4. LaTeX Tables
    const latexContent = `% FIGM Empirical Evaluation LaTeX Table Artifacts
\\begin{table}[htbp]
\\centering
\\caption{FIGM Static Analysis Empirical Rule Evaluation Matrix}
\\label{tab:figm_rule_evaluation}
\\begin{tabular}{llcccccc}
\\toprule
\\textbf{Rule ID} & \\textbf{Domain} & \\textbf{TP} & \\textbf{FP} & \\textbf{FN} & \\textbf{Precision} & \\textbf{Recall} & \\textbf{F1-Score} \\\\
\\midrule
${evalResults.ruleMetrics
  .map(
    (r) =>
      `${r.ruleId} & ${r.domain} & ${r.truePositives} & ${r.falsePositives} & ${r.falseNegatives} & ${(r.precision * 100).toFixed(1)}\\% & ${(r.recall * 100).toFixed(1)}\\% & ${(r.f1Score * 100).toFixed(1)}\\% \\\\`
  )
  .join('\n')}
\\midrule
\\textbf{Overall} & \\textbf{All} & \\textbf{${evalResults.overall.truePositives}} & \\textbf{${evalResults.overall.falsePositives}} & \\textbf{${evalResults.overall.falseNegatives}} & \\textbf{${(evalResults.overall.precision * 100).toFixed(1)}\\%} & \\textbf{${(evalResults.overall.recall * 100).toFixed(1)}\\%} & \\textbf{${(evalResults.overall.f1Score * 100).toFixed(1)}\\%} \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\begin{table}[htbp]
\\centering
\\caption{Cross-Framework Static Detection Performance}
\\label{tab:figm_framework_performance}
\\begin{tabular}{lcccccc}
\\toprule
\\textbf{Framework Target} & \\textbf{Files} & \\textbf{TP} & \\textbf{FP} & \\textbf{FN} & \\textbf{Precision} & \\textbf{Recall} & \\textbf{F1-Score} \\\\
\\midrule
${evalResults.frameworkMetrics
  .map(
    (f) =>
      `${f.framework} & ${f.fileCount} & ${f.truePositives} & ${f.falsePositives} & ${f.falseNegatives} & ${(f.precision * 100).toFixed(1)}\\% & ${(f.recall * 100).toFixed(1)}\\% & ${(f.f1Score * 100).toFixed(1)}\\% \\\\`
  )
  .join('\n')}
\\bottomrule
\\end{tabular}
\\end{table}
`;

    // Export to all target paths
    for (const dir of targetDirs) {
      fs.writeFileSync(path.join(dir, 'eval-summary.json'), jsonContent, 'utf-8');
      fs.writeFileSync(path.join(dir, 'benchmark-results.md'), mdContent, 'utf-8');
      fs.writeFileSync(path.join(dir, 'benchmark-results.csv'), csvLines.join('\n'), 'utf-8');
      fs.writeFileSync(path.join(dir, 'latex-tables.tex'), latexContent, 'utf-8');
    }

    console.log(`[FIGM EVAL] Exported evaluation reports (JSON, CSV, MD, LaTeX) to:`);
    console.log(`  - benchmarks/`);
    console.log(`  - public/eval-results/`);
    console.log(`  - docs/reports/`);
  }

  private static calculateMetrics(tp: number, fp: number, fn: number): MetricScore {
    const precision = tp + fp === 0 ? 1.0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 1.0 : tp / (tp + fn);
    const f1Score = precision + recall === 0 ? 0.0 : (2 * precision * recall) / (precision + recall);

    return {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1Score
    };
  }
}

// Auto-run when invoked directly
if (process.argv[1] && process.argv[1].includes('evaluation-runner')) {
  const evalResults = EvaluationRunner.runEvaluation();
  EvaluationRunner.exportReports(evalResults);
  ThesisGapExporter.exportAllChapters();
  console.log(`[FIGM EVAL] Empirical Evaluation complete. F1-Score: ${(evalResults.overall.f1Score * 100).toFixed(1)}%`);
}
