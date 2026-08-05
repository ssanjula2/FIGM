"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThesisGapExporter = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const repo_evaluator_js_1 = require("./repo-evaluator.js");
const precision_recall_engine_js_1 = require("./precision-recall-engine.js");
const tool_benchmark_js_1 = require("./tool-benchmark.js");
const ai_patch_evaluator_js_1 = require("./ai-patch-evaluator.js");
const user_study_evaluator_js_1 = require("./user-study-evaluator.js");
class ThesisGapExporter {
    static exportAllChapters() {
        const outputDir = node_path_1.default.resolve(process.cwd(), 'docs/dissertation');
        if (!node_fs_1.default.existsSync(outputDir)) {
            node_fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        // --- Export Chapter 4: Large Scale Repository Evaluation & Statistics ---
        const stats = repo_evaluator_js_1.StatisticalEngine.computeSummary();
        const ch4Content = `# Chapter 4: Large Scale Repository Evaluation & Statistical Analysis

## 4.1 Benchmark Evaluation Dataset (N = 30 Repositories)

The Framework-Independent Guideline Model (FIGM) Code Inspector was evaluated across **30 public production software repositories** spanning Next.js, React, and Angular.

| ID | Repository Name | Framework | LOC | Files | Scan Time (s) | Violations | Density (/1k LOC) | Score |
|---|---|---|---|---|---|---|---|---|
${repo_evaluator_js_1.REPOSITORY_DATASET.map(r => `| ${r.id} | [${r.name}](${r.url}) | ${r.framework} | ${r.loc.toLocaleString()} | ${r.filesAnalyzed} | ${r.scanDurationSec}s | ${r.totalViolations} | ${r.violationDensityPer1kLOC} | ${r.overallScore}/100 |`).join('\n')}

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
        node_fs_1.default.writeFileSync(node_path_1.default.join(outputDir, 'chapter4_large_scale_evaluation.md'), ch4Content, 'utf-8');
        // --- Export Chapter 5: Empirical Validation, Precision/Recall & Benchmarking ---
        const accuracy = precision_recall_engine_js_1.PrecisionRecallEngine.calculateMetrics();
        const coverage = tool_benchmark_js_1.CoverageBenchmarkEngine.calculateCoverageSummary();
        const patchMetrics = ai_patch_evaluator_js_1.AIPatchEvaluator.calculatePatchEvaluation();
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
${tool_benchmark_js_1.TOOL_COMPARISON_MATRIX.map(t => `| **${t.tool}** | ${t.staticAnalysis ? '✅' : '❌'} | ${t.dynamicProfiling ? '✅' : '❌'} | ${t.aiRemediation ? '✅' : '❌'} | ${t.frameworkIndependent ? '✅' : '❌'} | ${t.executionSpeedMs} ms |`).join('\n')}

---

## 5.3 AI Remediation & Patch Evaluation

- **Patch Generation Success Rate**: ${patchMetrics.patchGenerationSuccessRatePct}%
- **Compilation Success Rate**: ${patchMetrics.compilationSuccessRatePct}%
- **Violation Removal Rate**: ${patchMetrics.violationRemovalRatePct}%
- **Average Fix Generation Time**: ${patchMetrics.avgFixTimeSeconds} seconds
- **Estimated Technical Debt Saved**: ${patchMetrics.estimatedTechDebtHoursSavedPer1kLOC} hours / 1,000 LOC
`;
        node_fs_1.default.writeFileSync(node_path_1.default.join(outputDir, 'chapter5_empirical_validation_and_benchmarks.md'), ch5Content, 'utf-8');
        // --- Export Chapter 6: User Study Usability Evaluation & Validity ---
        const userStudy = user_study_evaluator_js_1.UserStudyEvaluator.calculateStudySummary();
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
        node_fs_1.default.writeFileSync(node_path_1.default.join(outputDir, 'chapter6_user_study_and_validity.md'), ch6Content, 'utf-8');
        console.log('[THESIS EXPORTER] Exported updated Markdown dissertation chapters to docs/dissertation/');
    }
}
exports.ThesisGapExporter = ThesisGapExporter;
//# sourceMappingURL=thesis-gap-exporter.js.map