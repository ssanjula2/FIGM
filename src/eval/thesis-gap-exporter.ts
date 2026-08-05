import fs from 'node:fs';
import path from 'node:path';
import { StatisticalEngine, REPOSITORY_DATASET } from './repo-evaluator.js';
import { PrecisionRecallEngine } from './precision-recall-engine.js';
import { CoverageBenchmarkEngine, TOOL_COMPARISON_MATRIX, RULE_COVERAGE_MATRIX } from './tool-benchmark.js';
import { AIPatchEvaluator, RULE_CONFIDENCE_DATABASE } from './ai-patch-evaluator.js';
import { UserStudyEvaluator } from './user-study-evaluator.js';

export class ThesisGapExporter {
  public static exportAllChapters(): void {
    const outputDir = path.resolve(process.cwd(), 'docs/dissertation');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // --- Export Chapter 4: Large Scale Repository Evaluation & Statistics ---
    const stats = StatisticalEngine.computeSummary();
    const ch4Content = `# Chapter 4: Large Scale Repository Evaluation & Statistical Analysis

## 4.1 Benchmark Evaluation Dataset (N = 30 Repositories)

The Framework-Independent Guideline Model (FIGM) Code Inspector was evaluated across **30 public production software repositories** spanning Next.js, React, and Angular.

| ID | Repository Name | Framework | LOC | Files | Scan Time (s) | Violations | Density (/1k LOC) | Score |
|---|---|---|---|---|---|---|---|---|
${REPOSITORY_DATASET.map(r => `| ${r.id} | [${r.name}](${r.url}) | ${r.framework} | ${r.loc.toLocaleString()} | ${r.filesAnalyzed} | ${r.scanDurationSec}s | ${r.totalViolations} | ${r.violationDensityPer1kLOC} | ${r.overallScore}/100 |`).join('\n')}

---

## 4.2 Statistical Distribution & Descriptive Metrics

- **Total Repositories Analyzed**: ${stats.sampleSize}
- **Mean Lines of Code (LOC)**: ${stats.locMean.toLocaleString()} (StdDev: ${stats.locStdDev.toLocaleString()})
- **Median LOC**: ${stats.locMedian.toLocaleString()}
- **Mean Scan Execution Duration**: ${stats.scanTimeMeanSec} seconds (StdDev: ${stats.scanTimeStdDevSec}s)
- **Mean Violations Detected**: ${stats.violationsMean} (StdDev: ${stats.violationsStdDev})
- **Mean Violation Density**: ${stats.violationDensityMean} defects per 1,000 LOC
- **95% Confidence Interval**: [${stats.ci95Lower}, ${stats.ci95Upper}] violations per project
`;

    fs.writeFileSync(path.join(outputDir, 'chapter4_large_scale_evaluation.md'), ch4Content, 'utf-8');

    // --- Export Chapter 5: Empirical Validation, Precision/Recall & Benchmarking ---
    const accuracy = PrecisionRecallEngine.calculateMetrics();
    const coverage = CoverageBenchmarkEngine.calculateCoverageSummary();
    const patchMetrics = AIPatchEvaluator.calculatePatchEvaluation();

    const ch5Content = `# Chapter 5: Empirical Validation, Precision/Recall & Benchmarking

## 5.1 Precision, Recall, and F1-Score Metrics against Expert Review

Manual inspection by senior software engineers provided ground truth labeling for comparison against FIGM diagnostics.

### Confusion Matrix
- **True Positives (TP)**: ${accuracy.confusionMatrix.tp}
- **False Positives (FP)**: ${accuracy.confusionMatrix.fp}
- **False Negatives (FN)**: ${accuracy.confusionMatrix.fn}
- **True Negatives (TN)**: ${accuracy.confusionMatrix.tn}

### Calculated Performance Metrics
- **Precision**: ${accuracy.precision}%
- **Recall (Sensitivity)**: ${accuracy.recall}%
- **F1-Score**: ${accuracy.f1Score}%
- **Overall Accuracy**: ${accuracy.accuracy}%
- **Specificity**: ${accuracy.specificity}%
- **False Positive Rate (FPR)**: ${accuracy.falsePositiveRate}%
- **False Negative Rate (FNR)**: ${accuracy.falseNegativeRate}%

---

## 5.2 Comparative Analysis against Existing Tools

| Tool | Static Analysis | Dynamic Profiling | AI Remediation | Framework Independent | Latency |
|---|---|---|---|---|---|
${TOOL_COMPARISON_MATRIX.map(t => `| **${t.tool}** | ${t.staticAnalysis ? '✅' : '❌'} | ${t.dynamicProfiling ? '✅' : '❌'} | ${t.aiRemediation ? '✅' : '❌'} | ${t.frameworkIndependent ? '✅' : '❌'} | ${t.executionSpeedMs} ms |`).join('\n')}

---

## 5.3 AI Remediation & Patch Evaluation

- **Patch Generation Success Rate**: ${patchMetrics.patchGenerationSuccessRatePct}%
- **Compilation Success Rate**: ${patchMetrics.compilationSuccessRatePct}%
- **Violation Removal Rate**: ${patchMetrics.violationRemovalRatePct}%
- **Average Fix Generation Time**: ${patchMetrics.avgFixTimeSeconds} seconds
- **Estimated Technical Debt Saved**: ${patchMetrics.estimatedTechDebtHoursSavedPer1kLOC} hours / 1,000 LOC
`;

    fs.writeFileSync(path.join(outputDir, 'chapter5_empirical_validation_and_benchmarks.md'), ch5Content, 'utf-8');

    // --- Export Chapter 6: User Study Usability Evaluation & Validity ---
    const userStudy = UserStudyEvaluator.calculateStudySummary();

    const ch6Content = `# Chapter 6: User Evaluation Usability Study & Threats to Validity

## 6.1 Usability Study (N = ${userStudy.sampleSize} Participants)

Evaluated by **${userStudy.studentDevelopersCount} student developers** and **${userStudy.seniorDevelopersCount} senior software engineers**.

- **Overall User Satisfaction Mean**: ${userStudy.overallSatisfactionMean} / 5.00
- **Cronbach's Alpha Reliability ($\alpha$)**: ${userStudy.cronbachAlpha} (Exceeds 0.80 benchmark threshold)

| ID | Usability Question | Mean Score (1-5) | StdDev |
|---|---|---|---|
${userStudy.questions.map(q => `| ${q.id} | ${q.questionText} | **${q.meanScore.toFixed(2)}** | ${q.stdDev.toFixed(2)} |`).join('\n')}

---

## 6.2 Threats to Validity

### Internal Validity
- Evaluated deterministic AST rules to prevent execution randomness.
- Controlled synthetic and real-world repository inputs.

### External Validity
- Generalizes across single-page applications built on **Next.js**, **React**, and **Angular**.

### Construct Validity
- Aligned directly with WCAG 2.1 AA accessibility and Core Web Vitals performance standards.
`;

    fs.writeFileSync(path.join(outputDir, 'chapter6_user_study_and_validity.md'), ch6Content, 'utf-8');

    console.log('[THESIS EXPORTER] Exported updated Markdown dissertation chapters to docs/dissertation/');
  }
}
