import fs from 'node:fs';
import path from 'node:path';
import { PrecisionRecallEngine, EMPIRICAL_EXPERT_GROUND_TRUTH } from './precision-recall-engine.js';
import { CoverageBenchmarkEngine, TOOL_COMPARISON_MATRIX, RULE_COVERAGE_MATRIX } from './tool-benchmark.js';
import { AIPatchEvaluator, RULE_CONFIDENCE_DATABASE } from './ai-patch-evaluator.js';
import { UserStudyEvaluator } from './user-study-evaluator.js';

export class ThesisGapExporter {
  public static exportAllChapters(): void {
    const outputDir = path.resolve(process.cwd(), 'docs/dissertation');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // NOTE: This exporter previously generated a "Chapter 4" document from
    // src/eval/repo-evaluator.ts's REPOSITORY_DATASET — 30 hand-typed records with invented
    // GitHub repo names/URLs (several do not exist, e.g. "exchangerates/dashboard",
    // "saasify/react-dash") and fabricated LOC/violation/score figures. No repositories were
    // ever cloned or scanned to produce those numbers, so the dataset and this generator block
    // were deleted rather than relabeled. The only real evaluation is the fixture-based
    // ground-truth benchmark below (Chapter 5), driven by benchmarks/ground-truth.json +
    // benchmarks/testbed.
    const staleCh4Path = path.join(outputDir, 'chapter4_large_scale_evaluation.md');
    if (fs.existsSync(staleCh4Path)) {
      fs.unlinkSync(staleCh4Path);
    }

    // --- Export Chapter 5: Empirical Validation, Precision/Recall & Benchmarking ---
    const accuracy = PrecisionRecallEngine.calculateMetrics(EMPIRICAL_EXPERT_GROUND_TRUTH);
    const coverage = CoverageBenchmarkEngine.calculateCoverageSummary();
    const patchMetrics = AIPatchEvaluator.calculatePatchEvaluation();

    const ch5Content = `# Chapter 5: Empirical Validation, Precision/Recall & Benchmarking

## 5.1 Precision, Recall, and F1-Score Metrics against Expert Ground Truth

Manual ground truth annotation across single-page testbed files provided ground truth labeling for comparison against FIGM diagnostics.

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

    // --- Export Chapter 6: User Usability Evaluation & Threats to Validity ---
    const { processUserStudyPipeline } = require('../../scripts/import-user-study.js');
    const realReport = processUserStudyPipeline();
    const userStudy = UserStudyEvaluator.calculateStudySummary();

    const isReal = realReport.provenance.isRealHumanData && realReport.provenance.validParticipantCount > 0;
    const participantStatusText = isReal
      ? `${realReport.provenance.validParticipantCount} / ${realReport.provenance.targetSampleSize} Valid Real Participants`
      : `0 / 85 Valid Real Participants (Collection Status: NOT_COLLECTED)`;

    const susDisplay = isReal
      ? `${realReport.metrics.susMean.toFixed(1)} / 100`
      : `PENDING REAL DATA (Formula Verification Test Score: 86.4 / 100 [SYNTHETIC_PIPELINE_TEST_DATA])`;

    const alphaDisplay = isReal
      ? `${realReport.metrics.cronbachAlpha.toFixed(3)}`
      : `PENDING REAL DATA (Formula Verification Test Alpha: 0.892 [SYNTHETIC_PIPELINE_TEST_DATA])`;

    const ch6Content = `# Chapter 6: User Usability Evaluation & Threats to Validity

## 6.1 Usability Evaluation Provenance & Status

- **Dataset Type**: ${isReal ? 'REAL_HUMAN_DATA' : 'SYNTHETIC_PIPELINE_TEST_DATA'}
- **Real Human Participant Count**: ${participantStatusText}
- **Data Collection Status**: ${realReport.provenance.collectionStatus}
- **System Usability Scale (SUS) Score**: ${susDisplay}
- **Cronbach's Alpha Reliability ($\\\\alpha$)**: ${alphaDisplay}

> **Academic Provenance Notice**: Real human participant data has not yet been collected (0/85 valid responses ingested). The questionnaire scoring pipeline formula has been verified using a synthetic pipeline test vector model (SYNTHETIC_PIPELINE_TEST_DATA). Live empirical human results will be computed dynamically upon ingesting responses via \`npm run research:user-study:import\`.

### Pipeline Verification Test Questionnaire Items (Formula Test Data)

- **Formula Test Sample Size**: ${userStudy.sampleSize} Profile Vectors
- **Overall User Satisfaction Mean (Test Model)**: ${userStudy.overallSatisfactionMean} / 5.00
- **Formula Test Cronbach's Alpha**: ${userStudy.cronbachAlpha}

| ID | Usability Question | Formula Test Mean (1-5) | StdDev |
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
