/**
 * Framework-Independent Guideline Model (FIGM)
 * Empirical Evaluation Suite & Benchmark Runner
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleExecutionEngine, ScanResult } from '../engine/rule-execution-engine.js';
import { ThesisGapExporter } from './thesis-gap-exporter.js';
import { FOUR_LAYER_MAPPINGS } from '../matrix/four-layer-meta-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Recursively lists every file under `dir`, returned as POSIX-style (forward-slash) paths
 *  relative to `baseDir` -- a file directly in `baseDir` yields just its bare filename (identical
 *  to the old flat `readdirSync` behavior), a file in a subdirectory yields e.g.
 *  "next03/app/demo/page.tsx". Deterministic order (readdirSync's own OS-dependent order is not
 *  guaranteed sorted, so this sorts explicitly to keep repeated runs' file-processing order --
 *  and therefore total-duration-per-run variance -- stable). */
function collectTestbedFiles(dir: string, baseDir: string = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestbedFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

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

/** Explicit, honest scope statement: the ground-truth benchmark below only ever covers the rule
 *  IDs actually present in benchmarks/ground-truth.json, never "all 50 FIGM rules" implicitly.
 *  `coveredRuleIds` is derived from the ground-truth data itself (never a separately-maintained
 *  literal list) so this can never silently drift out of sync with what the benchmark actually
 *  measures. */
export interface RuleCoverageProvenance {
  totalFigmRules: number;
  rulesWithGroundTruth: number;
  coveredRuleIds: string[];
  uncoveredRuleIds: string[];
}

export interface CompleteEvaluationReport {
  timestamp: string;
  calculationMethod: string;
  ruleCoverage: RuleCoverageProvenance;
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

    // Recursive walk (not a flat readdirSync): FIGM-NEXT-03's real-AST detector requires a
    // literal app/<segment>/page.<ext> path component (isAppRouterPageFile in
    // real-syntax-node-builder.ts), which only a genuinely nested fixture can provide. Every
    // relative path is normalized to forward slashes so a flat file's relative path is identical
    // to its bare filename (byte-for-byte the same string readdirSync used to return), leaving all
    // pre-existing flat fixtures' matching against ground-truth.json completely unchanged.
    const files = collectTestbedFiles(testbedDir);

    const initialMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    const fileScanResults: ScanResult[] = [];
    let totalLinesOfCode = 0;

    for (const relativePath of files) {
      const filePath = path.join(testbedDir, relativePath);
      const code = fs.readFileSync(filePath, 'utf-8');
      totalLinesOfCode += code.split(/\r?\n/).length;

      const result = RuleExecutionEngine.analyzeFile(relativePath, code);
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

    // Derived from the ground-truth data itself (never a separately-maintained literal list) so
    // the rule set this benchmark measures can never silently drift out of sync with
    // benchmarks/ground-truth.json -- if a ground-truth item is added for a new rule, it is picked
    // up automatically on the next run rather than requiring someone to remember to also update a
    // hardcoded array here.
    const allRules = [...new Set(groundTruths.map((g) => g.ruleId))].sort();
    // Same reasoning as allRules above -- a hardcoded list here silently dropped any framework
    // introduced by a new ground-truth entry (e.g. NEXT_JS) from frameworkMetrics entirely: its
    // TP/FP/FN still counted correctly toward the global/rule-level totals via fwTP/fwFP/fwFN
    // below, but the framework-level breakdown report would never show that row, which is a real
    // under-reporting bug, not neutral.
    const allFrameworks = [...new Set(groundTruths.map((g) => g.framework))].sort();

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
      const figmDiags = scanRes.diagnostics.filter((d) => d.ruleId.startsWith('FIGM-'));
      for (const diag of figmDiags) {
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
      // Domain must come from the canonical rule registry (FOUR_LAYER_MAPPINGS, itself sourced
      // from figm-spec.json), not from a substring guess on the rule ID -- a prior
      // `r.includes('PERF') ? 'PERFORMANCE' : 'ACCESSIBILITY'` heuristic silently mislabeled every
      // PERFORMANCE rule whose ID does not literally contain "PERF" (e.g. FIGM-REACT-01/02/03,
      // several FIGM-ANG-*/FIGM-NEXT-* rules) as ACCESSIBILITY.
      const canonicalDomain = FOUR_LAYER_MAPPINGS.find((m) => m.rule.ruleId === r)?.domain;
      return {
        ruleId: r,
        domain: canonicalDomain ?? 'UNKNOWN',
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

    const totalFigmRules = FOUR_LAYER_MAPPINGS.length;
    const allFigmRuleIds = FOUR_LAYER_MAPPINGS.map((m) => m.rule.ruleId);
    const ruleCoverage: RuleCoverageProvenance = {
      totalFigmRules,
      rulesWithGroundTruth: allRules.length,
      coveredRuleIds: allRules,
      uncoveredRuleIds: allFigmRuleIds.filter((id) => !allRules.includes(id)).sort(),
    };

    return {
      timestamp: new Date().toISOString(),
      calculationMethod:
        'TP/FP/FN computed by dynamically re-running RuleExecutionEngine.analyzeFile against every file in benchmarks/testbed and diffing the resulting diagnostics against benchmarks/ground-truth.json (exact filePath+ruleId match). Precision = TP/(TP+FP), Recall = TP/(TP+FN), F1 = 2*P*R/(P+R). No cached or hand-typed confusion matrix is used at any step.',
      ruleCoverage,
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

> **Rule Coverage Scope**: This benchmark empirically measures **${evalResults.ruleCoverage.rulesWithGroundTruth} of ${evalResults.ruleCoverage.totalFigmRules}** FIGM rules (those with hand-labelled ground-truth violations in \`benchmarks/ground-truth.json\`): ${evalResults.ruleCoverage.coveredRuleIds.map((r) => `\`${r}\``).join(', ')}. The remaining ${evalResults.ruleCoverage.uncoveredRuleIds.length} rules (${evalResults.ruleCoverage.uncoveredRuleIds.map((r) => `\`${r}\``).join(', ')}) are verified only by unit-level positive/negative fixture tests (\`tests/rule-detection-matrix.test.ts\` et al.), **not** by this empirical Precision/Recall/F1 benchmark. The Precision/Recall/F1 figures above must never be read as "FIGM is ${(evalResults.overall.f1Score * 100).toFixed(1)}% accurate across all ${evalResults.ruleCoverage.totalFigmRules} rules."
>
> **Calculation method**: ${evalResults.calculationMethod}

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

    // 5. Generate Canonical Evaluation Evidence Artifact dynamically with provenance
    const canonicalEvidenceDir = path.join(rootDir, 'docs/evidence');
    if (!fs.existsSync(canonicalEvidenceDir)) {
      fs.mkdirSync(canonicalEvidenceDir, { recursive: true });
    }

    const canonicalArtifact = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      provenance: {
        generatedBy: 'src/eval/evaluation-runner.ts',
        groundTruth: 'benchmarks/ground-truth.json',
        testbed: 'benchmarks/testbed',
        dynamic: true,
        executionMode: 'AUTOMATED_DYNAMIC_EVALUATION',
        calculationMethod: evalResults.calculationMethod
      },
      // Explicit, honest rule-coverage scope (never silently implied to be "all rules") --
      // derived from benchmarks/ground-truth.json's actual contents, not a hand-maintained list.
      ruleCoverage: evalResults.ruleCoverage,
      overall: {
        truePositives: evalResults.overall.truePositives,
        falsePositives: evalResults.overall.falsePositives,
        falseNegatives: evalResults.overall.falseNegatives,
        precision: parseFloat(evalResults.overall.precision.toFixed(4)),
        recall: parseFloat(evalResults.overall.recall.toFixed(4)),
        f1Score: parseFloat(evalResults.overall.f1Score.toFixed(4)),
        precisionPct: `${(evalResults.overall.precision * 100).toFixed(1)}%`,
        recallPct: `${(evalResults.overall.recall * 100).toFixed(1)}%`,
        f1ScorePct: `${(evalResults.overall.f1Score * 100).toFixed(1)}%`
      },
      // This artifact covers ONLY the automated ground-truth benchmark evaluation below — it
      // must never reference a repository-scale dataset or a human/user study, because neither
      // was actually used to compute overall.truePositives/falsePositives/falseNegatives above.
      // A prior version of this block hardcoded "30 representative open-source framework
      // architecture benchmark items" and "85 simulated developer profiles" as static string
      // literals with no connection to any real computation — presenting synthetic/nonexistent
      // datasets as if they contributed to this evaluation's real numbers. Per this codebase's
      // own research-integrity requirement (never combine automated benchmark metrics with
      // human-study metrics, never present synthetic data as empirical), those fields were
      // removed rather than "corrected" to a different number, since no repository-scale or
      // human-study evaluation backs this specific artifact at all.
      datasetClassification: {
        metricType: 'AUTOMATED_BENCHMARK_METRICS_ONLY',
        groundTruthTestbed: `${evalResults.performanceMetrics.totalLinesOfCode} LOC across the fixture files in benchmarks/testbed, scored against benchmarks/ground-truth.json`,
        humanStudyIncluded: false,
        humanStudyStatusSource: 'research/analysis/usability-results.json (see that file for real participant count / collection status — never this artifact)'
      },
      performance: {
        totalScanDurationMs: parseFloat(evalResults.performanceMetrics.totalScanDurationMs.toFixed(2)),
        totalLinesOfCode: evalResults.performanceMetrics.totalLinesOfCode,
        scanSpeedLOCPerSec: parseFloat(evalResults.performanceMetrics.scanSpeedLOCPerSec.toFixed(1)),
        peakMemoryMB: parseFloat(evalResults.performanceMetrics.peakMemoryMB.toFixed(2))
      },
      evidenceStatus: 'CANONICAL_GROUND_TRUTH_VERIFIED'
    };

    fs.writeFileSync(
      path.join(canonicalEvidenceDir, 'canonical-evaluation.json'),
      JSON.stringify(canonicalArtifact, null, 2),
      'utf-8'
    );

    console.log(`[FIGM EVAL] Exported evaluation reports (JSON, CSV, MD, LaTeX, Canonical) to:`);
    console.log(`  - benchmarks/`);
    console.log(`  - public/eval-results/`);
    console.log(`  - docs/reports/`);
    console.log(`  - docs/evidence/canonical-evaluation.json`);
  }

  public static calculateMetrics(tp: number, fp: number, fn: number): MetricScore {
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

// Auto-run when invoked directly.
// Stage T6A (Dissertation Integrity): this used to be `process.argv[1].includes('evaluation-runner')`
// -- a substring check, not an identity check. `node --test` runs each test file as its own main
// module and can set process.argv[1] to that file's own path; tests/evaluation-runner.test.ts's
// path contains the substring "evaluation-runner", so importing this module from that test file
// spuriously satisfied the guard and fired this block -- including the unguarded, no-argument
// ThesisGapExporter.exportAllChapters() call -- during a plain `npm test` run, silently overwriting
// the canonical, hand-authored docs/dissertation/chapter5_empirical_validation_and_benchmarks.md
// (confirmed via checksum: this fired mid-suite and reverted Chapter 5 to auto-generated content).
// Exact-path comparison against this module's own resolved file URL is immune to that, the same
// class of fix already applied to src/cli/figm-analyze.ts's entry guard.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const evalResults = EvaluationRunner.runEvaluation();
  EvaluationRunner.exportReports(evalResults);
  ThesisGapExporter.exportAllChapters();
  console.log(`[FIGM EVAL] Empirical Evaluation complete. F1-Score: ${(evalResults.overall.f1Score * 100).toFixed(1)}%`);
}
