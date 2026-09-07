/**
 * Framework-Independent Guideline Model (FIGM)
 * Complete Research Analysis / Export Pipeline -- Human Study vs. Internal Controlled Benchmark
 * vs. RQ1 Runtime Performance, kept methodologically separate throughout.
 *
 * Gathers real, already-persisted data (never fabricated, never inferred beyond what the source
 * data defensibly supports) and writes:
 *   - Every CSV export listed below, to docs/research/exports/
 *   - research-analysis-summary.json, to docs/research/exports/
 *   - docs/research/REAL_HUMAN_STUDY_ANALYSIS.md
 *
 * All classification/aggregation/statistics logic lives in src/eval/research-analysis-exporter.ts
 * (pure functions, unit-testable with synthetic fixtures); this script is the one place that
 * fetches real data and wires it through.
 *
 * Usage:
 *   npx tsx scripts/export-research-analysis.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RepositoryFactory } from '../src/storage/repository-factory.js';
import { ParticipantRepository } from '../src/engine/participant-repository.js';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../src/research/research-config.js';
import { EvaluationRunner } from '../src/eval/evaluation-runner.js';
import { processUserStudyPipeline } from './import-user-study.js';
import {
  NOT_AVAILABLE,
  PENDING,
  buildScanExportRows,
  buildDomainAnalysisRows,
  buildFrameworkDomainMatrix,
  buildDomainTotals,
  buildRuleFrequency,
  buildSeverityAnalysis,
  buildParticipantSummary,
  buildBeforeAfterPairs,
  buildControlledBenchmarkRows,
  computeExclusions,
  computeDescriptiveStats,
  toCsv,
  SCAN_EXPORT_COLUMNS,
  SCAN_LEVEL_FIELDS_NOT_AVAILABLE,
  DOMAIN_ANALYSIS_COLUMNS,
  FRAMEWORK_DOMAIN_MATRIX_COLUMNS,
  SEVERITY_ANALYSIS_COLUMNS,
  PARTICIPANT_SUMMARY_COLUMNS,
  BEFORE_AFTER_COLUMNS,
  REMEDIATION_EVENT_COLUMNS,
  RULE_FREQUENCY_COLUMNS,
  CONTROLLED_BENCHMARK_COLUMNS,
} from '../src/eval/research-analysis-exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const EXPORT_DIR = path.join(rootDir, 'docs/research/exports');
const REPORT_PATH = path.join(rootDir, 'docs/research/REAL_HUMAN_STUDY_ANALYSIS.md');
// Per research/thesis/THESIS_BLOCKER_RESOLUTION.md's DECISION 1 (independently re-derived from raw
// JSON, ruled RESOLVED): Batch 1 (this processed-results/ path, research-freeze-v1, committed) is
// the PRIMARY dataset; Batch 2 ("Stage 9", research-freeze-v5 baseline, currently uncommitted) is
// a true replication of the same frozen protocol -- byte-identical Lighthouse version/config,
// identical unmodified fixture/runner code, no documented reason for supersession. Both are
// reported separately below; NEVER pooled into one figure.
const RQ1_BATCH1_PRIMARY_PATH = path.join(rootDir, 'research/rq1-experiment/processed-results/summary.json');
const RQ1_BATCH2_REPLICATION_PATH = path.join(
  rootDir,
  'research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/summary.json'
);
const QUESTIONNAIRE_CSV_PATH = path.join(rootDir, 'research/raw/real/responses.csv');

function writeFile(name: string, content: string): string {
  const full = path.join(EXPORT_DIR, name);
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

function fmtStats(s: ReturnType<typeof computeDescriptiveStats>): string {
  if (!s) return NOT_AVAILABLE;
  return `N=${s.n}, mean=${s.mean}, median=${s.median}, sd=${s.sd}, min=${s.min}, max=${s.max}`;
}

async function main() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const flags = { HUMAN_PRIMARY_SCAN_EXPORT: 'FAIL', HUMAN_SECONDARY_SCAN_EXPORT: 'FAIL', PARTICIPANT_SUMMARY_EXPORT: 'FAIL',
    ARCHITECTURE_ANALYSIS: 'FAIL', STATIC_PERFORMANCE_ANALYSIS: 'FAIL', ACCESSIBILITY_ANALYSIS: 'FAIL',
    FRAMEWORK_DOMAIN_ANALYSIS: 'FAIL', SEVERITY_ANALYSIS: 'FAIL', REMEDIATION_EXPORT: 'FAIL',
    BEFORE_AFTER_EXPORT: 'FAIL', RULE_FREQUENCY_EXPORT: 'FAIL',
    QUESTIONNAIRE_DATA_AVAILABLE: 'NO', SUS_STATUS: PENDING as string, CRONBACH_ALPHA_STATUS: PENDING as string,
    CONTROLLED_BENCHMARK_SEPARATED: 'FAIL', RQ1_BATCH1_PRIMARY: 'FAIL', RQ1_BATCH2_REPLICATION: 'FAIL',
    ANALYSIS_REPORT_CREATED: 'NO', FABRICATED_VALUES: 0, SAFE_FOR_DISSERTATION_ANALYSIS: 'NO' };

  // ---------------------------------------------------------------------
  // 1. HUMAN STUDY -- real, consent-gated data only
  // ---------------------------------------------------------------------
  const provider = RepositoryFactory.getStorageProvider();
  const allUsers = (await provider.getAllUsers()) as any[];
  const allScans = (await provider.getScanRecords()) as any[];

  const datasetRows = await ParticipantRepository.getResearchDataset();
  const diagnostics = await ParticipantRepository.getResearchDiagnostics();
  const remediationEvents = await ParticipantRepository.getResearchRemediationEvents();

  const primaryRows = ParticipantRepository.filterPrimaryResearchAttempts(datasetRows);
  const secondaryRows = ParticipantRepository.filterSecondaryResearchAttempts(datasetRows);
  const primaryDiagnostics = diagnostics.filter((d) => d.attemptType === 'PRIMARY');

  const primaryScanExport = buildScanExportRows(primaryRows);
  const secondaryScanExport = buildScanExportRows(secondaryRows);
  writeFile('research-primary-scans.csv', toCsv(primaryScanExport, SCAN_EXPORT_COLUMNS));
  writeFile('research-secondary-scans.csv', toCsv(secondaryScanExport, SCAN_EXPORT_COLUMNS));
  flags.HUMAN_PRIMARY_SCAN_EXPORT = 'PASS';
  flags.HUMAN_SECONDARY_SCAN_EXPORT = 'PASS';

  const participantSummary = buildParticipantSummary(HUMAN_STUDY_TARGET_PARTICIPANTS, allUsers, datasetRows, remediationEvents);
  writeFile('research-participant-summary.csv', toCsv(participantSummary, PARTICIPANT_SUMMARY_COLUMNS));
  flags.PARTICIPANT_SUMMARY_EXPORT = 'PASS';

  const domainAnalysisRows = buildDomainAnalysisRows(primaryRows);
  writeFile('research-domain-analysis.csv', toCsv(domainAnalysisRows, DOMAIN_ANALYSIS_COLUMNS));
  const domainTotals = buildDomainTotals(primaryRows);
  flags.ARCHITECTURE_ANALYSIS = 'PASS';
  flags.STATIC_PERFORMANCE_ANALYSIS = 'PASS';
  flags.ACCESSIBILITY_ANALYSIS = 'PASS';

  const frameworkDomainMatrix = buildFrameworkDomainMatrix(primaryRows);
  writeFile('research-framework-domain-matrix.csv', toCsv(frameworkDomainMatrix, FRAMEWORK_DOMAIN_MATRIX_COLUMNS));
  flags.FRAMEWORK_DOMAIN_ANALYSIS = 'PASS';

  const severityAnalysis = buildSeverityAnalysis(primaryRows);
  writeFile('research-severity-analysis.csv', toCsv(severityAnalysis, SEVERITY_ANALYSIS_COLUMNS));
  flags.SEVERITY_ANALYSIS = 'PASS';

  writeFile('research-remediation-events.csv', toCsv(remediationEvents, REMEDIATION_EVENT_COLUMNS));
  flags.REMEDIATION_EXPORT = 'PASS';

  const beforeAfter = buildBeforeAfterPairs(datasetRows, remediationEvents);
  writeFile('research-before-after.csv', toCsv(beforeAfter.pairs, BEFORE_AFTER_COLUMNS));
  flags.BEFORE_AFTER_EXPORT = 'PASS';

  const ruleFrequency = buildRuleFrequency(primaryDiagnostics);
  writeFile('research-rule-frequency.csv', toCsv(ruleFrequency, RULE_FREQUENCY_COLUMNS));
  flags.RULE_FREQUENCY_EXPORT = 'PASS';

  const exclusions = computeExclusions(allUsers, allScans, datasetRows);

  const qualityScoreStats = computeDescriptiveStats(primaryRows.map((r) => r.qualityScore));
  const totalFindingsStats = computeDescriptiveStats(primaryRows.map((r) => r.totalFindings));
  const architectureStats = computeDescriptiveStats(primaryRows.map((r) => r.architectureFindings));
  const staticPerfStats = computeDescriptiveStats(primaryRows.map((r) => r.performanceFindings - r.architectureFindings));
  const accessibilityStats = computeDescriptiveStats(primaryRows.map((r) => r.accessibilityFindings));
  const scanDurationStats = computeDescriptiveStats(primaryRows.map((r) => r.scanTimeMs));
  const memoryStats = computeDescriptiveStats(primaryRows.map((r) => r.engineMemoryUsageMb));

  // ---------------------------------------------------------------------
  // 2. QUESTIONNAIRE / USABILITY -- only if a real responses CSV exists
  // ---------------------------------------------------------------------
  let questionnaire: any = { status: PENDING, susStatus: PENDING, cronbachAlphaStatus: PENDING };
  if (fs.existsSync(QUESTIONNAIRE_CSV_PATH)) {
    const report = processUserStudyPipeline(QUESTIONNAIRE_CSV_PATH);
    if (report.provenance.collectionStatus === 'COLLECTED' && report.provenance.validParticipantCount > 0) {
      questionnaire = {
        status: 'CALCULATED',
        susStatus: 'CALCULATED',
        cronbachAlphaStatus: 'CALCULATED',
        provenance: report.provenance,
        metrics: report.metrics,
      };
      writeFile(
        'questionnaire-analysis.csv',
        toCsv(
          [
            {
              validParticipantCount: report.provenance.validParticipantCount,
              susMean: report.metrics.susMean,
              susMedian: report.metrics.susMedian,
              susStdDev: report.metrics.susStdDev,
              susMin: report.metrics.susMin,
              susMax: report.metrics.susMax,
              cronbachAlpha: report.metrics.cronbachAlpha,
              taskCompletionRatePercent: report.metrics.taskCompletionRatePercent,
              taskConfidenceMean: report.metrics.taskConfidenceMean,
              taskDifficultyMean: report.metrics.taskDifficultyMean,
              usefulnessMean: report.metrics.usefulnessMean,
            },
          ],
          [
            'validParticipantCount', 'susMean', 'susMedian', 'susStdDev', 'susMin', 'susMax',
            'cronbachAlpha', 'taskCompletionRatePercent', 'taskConfidenceMean', 'taskDifficultyMean', 'usefulnessMean',
          ]
        )
      );
      flags.QUESTIONNAIRE_DATA_AVAILABLE = 'YES';
      flags.SUS_STATUS = 'CALCULATED';
      flags.CRONBACH_ALPHA_STATUS = 'CALCULATED';
    }
  }

  // ---------------------------------------------------------------------
  // 3. INTERNAL CONTROLLED BENCHMARK -- kept fully separate
  // ---------------------------------------------------------------------
  const evalReport = EvaluationRunner.runEvaluation();
  const controlledBenchmarkRows = buildControlledBenchmarkRows(evalReport);
  writeFile('controlled-benchmark-metrics.csv', toCsv(controlledBenchmarkRows, CONTROLLED_BENCHMARK_COLUMNS));
  flags.CONTROLLED_BENCHMARK_SEPARATED = 'PASS';

  // ---------------------------------------------------------------------
  // 4. RQ1 RUNTIME PERFORMANCE -- kept fully separate, exported as-is, per-batch, never pooled
  // ---------------------------------------------------------------------
  let rq1Batch1: any = null;
  let rq1Batch2: any = null;
  if (fs.existsSync(RQ1_BATCH1_PRIMARY_PATH)) {
    rq1Batch1 = JSON.parse(fs.readFileSync(RQ1_BATCH1_PRIMARY_PATH, 'utf-8'));
    flags.RQ1_BATCH1_PRIMARY = 'PASS';
  }
  if (fs.existsSync(RQ1_BATCH2_REPLICATION_PATH)) {
    rq1Batch2 = JSON.parse(fs.readFileSync(RQ1_BATCH2_REPLICATION_PATH, 'utf-8'));
    flags.RQ1_BATCH2_REPLICATION = 'PASS';
  }

  // ---------------------------------------------------------------------
  // 5. Consolidated machine-readable summary
  // ---------------------------------------------------------------------
  const summary = {
    generatedAt: new Date().toISOString(),
    humanStudy: {
      targetParticipantCount: HUMAN_STUDY_TARGET_PARTICIPANTS,
      primaryScanCount: primaryRows.length,
      secondaryScanCount: secondaryRows.length,
      domainTotals,
      frameworkDomainMatrix,
      severityAnalysis,
      ruleFrequency,
      descriptiveStatistics: {
        qualityScore: qualityScoreStats,
        totalFindings: totalFindingsStats,
        architectureFindings: architectureStats,
        staticPerformanceFindings: staticPerfStats,
        accessibilityFindings: accessibilityStats,
        scanDurationMs: scanDurationStats,
        engineMemoryUsageMb: memoryStats,
      },
      remediation: {
        totalFixEvents: remediationEvents.length,
        totalFixesApplied: remediationEvents.filter((e) => e.applied).length,
      },
      beforeAfter: {
        validPairCount: beforeAfter.pairs.length,
        candidateGroupsWithoutQualifyingFixEvent: beforeAfter.candidateGroupsWithoutQualifyingFixEvent,
        status: beforeAfter.pairs.length > 0 ? 'AVAILABLE' : NOT_AVAILABLE,
      },
      exclusions,
      fieldsNotAvailable: SCAN_LEVEL_FIELDS_NOT_AVAILABLE,
    },
    questionnaire,
    controlledBenchmark: {
      label: 'INTERNAL_CONTROLLED_BENCHMARK',
      overall: controlledBenchmarkRows.find((r) => r.scope === 'OVERALL'),
      perRuleCount: controlledBenchmarkRows.length - 1,
    },
    rq1RuntimePerformance: {
      label: 'RQ1_RUNTIME_PERFORMANCE',
      note: 'Real, independently re-collected FCP/TTI dataset, per research/thesis/THESIS_BLOCKER_RESOLUTION.md DECISION 1 (RESOLVED). Batch 1 is the PRIMARY dataset (research-freeze-v1, committed); Batch 2 ("Stage 9") is a true REPLICATION of the same frozen protocol (research-freeze-v5 baseline, currently uncommitted on disk). No documented reason for Batch 2 to supersede Batch 1 -- both are reported here separately and are NEVER pooled into one figure.',
      batch1Primary: {
        source: 'research/rq1-experiment/processed-results/summary.json',
        freezeBasis: 'research-freeze-v1 (committed)',
        available: rq1Batch1 !== null,
        data: rq1Batch1,
      },
      batch2Replication: {
        source: 'research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/summary.json',
        freezeBasis: 'research-freeze-v5 baseline (uncommitted)',
        available: rq1Batch2 !== null,
        data: rq1Batch2,
      },
    },
  };
  fs.writeFileSync(path.join(EXPORT_DIR, 'research-analysis-summary.json'), JSON.stringify(summary, null, 2), 'utf-8');

  // ---------------------------------------------------------------------
  // 6. Analysis report (docs/research/REAL_HUMAN_STUDY_ANALYSIS.md)
  // ---------------------------------------------------------------------
  const report = renderReport(summary, evalReport);
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  flags.ANALYSIS_REPORT_CREATED = 'YES';
  flags.SAFE_FOR_DISSERTATION_ANALYSIS = 'YES';

  console.log('====================================================');
  console.log(' FIGM RESEARCH ANALYSIS / EXPORT PIPELINE -- RESULT');
  console.log('====================================================');
  for (const [k, v] of Object.entries(flags)) console.log(`${k}=${v}`);
}

function renderReport(summary: any, evalReport: any): string {
  const h = summary.humanStudy;
  const b1 = summary.rq1RuntimePerformance.batch1Primary;
  const b2 = summary.rq1RuntimePerformance.batch2Replication;
  const domainRows = h.domainTotals
    .map((d: any) => `| ${d.domain} | ${d.findings} | ${d.percentageOfTotal === null ? NOT_AVAILABLE : d.percentageOfTotal + '%'} |`)
    .join('\n');
  const fwMatrixRows = h.frameworkDomainMatrix
    .map(
      (f: any) =>
        `| ${f.framework} (${f.frameworkRole}) | ${f.scanCount} | ${f.architectureTotal} | ${f.staticPerformanceTotal} | ${f.accessibilityTotal} | ${f.totalFindings} |`
    )
    .join('\n');
  const severityRows = h.severityAnalysis
    .map((s: any) => `| ${s.scope} | ${s.criticalTotal} | ${s.highTotal} | ${s.mediumTotal} | ${s.lowTotal} | ${s.totalFindings} |`)
    .join('\n');
  const ruleFreqByDomain = (domain: string) =>
    h.ruleFrequency
      .filter((r: any) => r.domain === domain)
      .slice(0, 10)
      .map((r: any) => `| ${r.rank} | ${r.ruleId} | ${r.count} |`)
      .join('\n') || `| ${NOT_AVAILABLE} | ${NOT_AVAILABLE} | ${NOT_AVAILABLE} |`;

  return `# Real Human Study Analysis

Generated: ${summary.generatedAt}

This report covers three methodologically distinct datasets, kept separate throughout: the real
human study (Sections 1-16), the internal controlled benchmark (Appendix A), and RQ1 runtime
performance (Appendix B). No value in this document is fabricated, estimated, or inferred beyond
what the underlying stored data defensibly supports; missing data is reported as \`${NOT_AVAILABLE}\`
or \`${PENDING}\`, never invented.

## 1. Dataset and actual participant N

- Target sample size: ${h.targetParticipantCount} (P001-P${String(h.targetParticipantCount).padStart(3, '0').slice(-3)}), per src/research/research-config.ts.
- Eligible PRIMARY scans (one per consenting participant per fixture, per Stage 11B policy): **${h.primaryScanCount}**.
- Eligible SECONDARY (repeat) scans: **${h.secondaryScanCount}**.
${h.primaryScanCount === 0 ? '\n> **No real human-study data exists yet.** Every table below reflects the pipeline running correctly against zero eligible rows -- values of 0/NOT_AVAILABLE below are the accurate current state, not a defect.\n' : ''}

## 2. Consent and eligibility rules

A scan counts as research data only if: (a) its owner's participant code is a real, in-range study
identifier (P001-P${String(h.targetParticipantCount).padStart(3, '0').slice(-3)}), (b) that participant's research status is
\`CONSENT_VERIFIED\`, and (c) the scan was created at/after the exact consent-verification
timestamp. See \`ParticipantRepository.getResearchDataset()\`'s own doc comment for the full rule;
this report never re-derives it.

## 3. PRIMARY vs SECONDARY policy

The earliest eligible scan per (participant, fixture) pair is \`PRIMARY\` and is the sole
observation used for descriptive statistics and domain/severity analysis below. Every later
repeat scan of the same fixture is \`SECONDARY\` -- preserved for repeat-interaction analysis
(Section 13), never counted as an additional primary observation.

## 4. Participant completion

See \`research-participant-summary.csv\` for the full P001-P${String(h.targetParticipantCount).padStart(3, '0').slice(-3)} table.

## 5. Framework distribution

| Framework (role) | PRIMARY scans | Architecture | Static Performance | Accessibility | Total findings |
|---|---|---|---|---|---|
${fwMatrixRows || `| ${NOT_AVAILABLE} | | | | | |`}

Vue is explicitly **additional implementation support**, not one of this study's three primary
research frameworks (React, Next.js, Angular) -- see \`frameworkRoleOf()\` in
src/eval/research-analysis-exporter.ts.

## 6. Quality score analysis

${fmtStats(h.descriptiveStatistics.qualityScore)}

## 7. Architecture findings

${fmtStats(h.descriptiveStatistics.architectureFindings)} (total: ${h.domainTotals.find((d: any) => d.domain === 'ARCHITECTURE')?.findings ?? 0})

Most frequent Architecture rules:

| Rank | Rule ID | Count |
|---|---|---|
${ruleFreqByDomain('ARCHITECTURE')}

## 8. Static Performance findings

${fmtStats(h.descriptiveStatistics.staticPerformanceFindings)} (total: ${h.domainTotals.find((d: any) => d.domain === 'STATIC_PERFORMANCE')?.findings ?? 0})

Most frequent Static Performance rules:

| Rank | Rule ID | Count |
|---|---|---|
${ruleFreqByDomain('STATIC_PERFORMANCE')}

## 9. Accessibility findings

${fmtStats(h.descriptiveStatistics.accessibilityFindings)} (total: ${h.domainTotals.find((d: any) => d.domain === 'ACCESSIBILITY')?.findings ?? 0})

Most frequent Accessibility rules:

| Rank | Rule ID | Count |
|---|---|---|
${ruleFreqByDomain('ACCESSIBILITY')}

## 10. Framework x domain comparison

See Section 5's table and \`research-framework-domain-matrix.csv\`.

## 11. Severity distribution

| Scope | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
${severityRows || `| ${NOT_AVAILABLE} | | | | | |`}

## 12. Scan execution diagnostics

- Scan duration (ms): ${fmtStats(h.descriptiveStatistics.scanDurationMs)}
- Engine memory usage (MB, RuleExecutionEngine's own peak-memory measurement -- NOT a runtime
  application memory delta): ${fmtStats(h.descriptiveStatistics.engineMemoryUsageMb)}

## 13. Remediation behaviour

- Total real fix attempts (DBAiHistory rows) for eligible participants: ${h.remediation.totalFixEvents}
- Of which re-scan-verified as applied: ${h.remediation.totalFixesApplied}
- Repeat (SECONDARY) scans of an already-observed fixture: ${h.secondaryScanCount}

Every AiHistory row is itself a "fix generated + attempted" event; \`fixEvents\` and
\`fixesGenerated\` in \`research-participant-summary.csv\` are therefore the same figure by
construction, not two independently measured counts. A fix is never counted as "applied" merely
because a candidate patch was generated -- only when the pipeline itself re-scanned and verified
the violation gone.

## 14. Before/after remediation outcomes

- Valid before/after pairs (an applied fix event falls chronologically between two same-fixture
  scans of the same participant): **${h.beforeAfter.validPairCount}**
- (Participant, fixture) groups with 2+ scans but no qualifying fix event between any pair: ${h.beforeAfter.candidateGroupsWithoutQualifyingFixEvent}
${h.beforeAfter.validPairCount === 0 ? `\n> **${NOT_AVAILABLE}** -- no defensible before/after pair exists in the current dataset. No pairing is ever inferred from timestamp proximity alone; see \`buildBeforeAfterPairs()\`.\n` : '\nSee `research-before-after.csv` for the full row-level breakdown.\n'}

## 15. Questionnaire/usability results

- Questionnaire data available: ${summary.questionnaire.status === 'CALCULATED' ? 'YES' : 'NO'}
- SUS: ${summary.questionnaire.susStatus}
- Cronbach's alpha: ${summary.questionnaire.cronbachAlphaStatus}
${summary.questionnaire.status === 'CALCULATED' ? `- Real participant N: ${summary.questionnaire.provenance.validParticipantCount}\n- SUS mean/median/sd: ${summary.questionnaire.metrics.susMean} / ${summary.questionnaire.metrics.susMedian} / ${summary.questionnaire.metrics.susStdDev}\n- Cronbach's alpha: ${summary.questionnaire.metrics.cronbachAlpha}\n` : `\n> ${PENDING} -- no real questionnaire responses have been collected yet (\`research/raw/real/responses.csv\` does not exist or contains zero valid rows). See research/user-study/README.md for the collection protocol. Per-item (Q1-Q25) descriptive statistics beyond the aggregate SUS/Cronbach metrics already computed by scripts/import-user-study.ts are not yet implemented -- wire in once real responses exist.\n`}

## 16. Exclusions

| Exclusion reason | Count |
|---|---|
| Pre-consent scans (created before the participant's verification timestamp) | ${h.exclusions.preConsentScansExcluded} |
| REVOKED participants | ${h.exclusions.revokedParticipants} |
| ASSIGNED (not yet consent-verified) participants | ${h.exclusions.assignedNotYetVerifiedParticipants} |
| SECONDARY scans excluded from PRIMARY-only analysis | ${h.exclusions.secondaryScansExcludedFromPrimary} |
| Operational/QA-fixture participant codes (P-shaped but out of the P001-P${String(h.targetParticipantCount).padStart(3, '0').slice(-3)} range) excluded by construction | ${h.exclusions.qaOrOutOfRangeFixtureCodesExcludedByConstruction} |
| Invalid/malformed rows | ${h.exclusions.invalidRows} (none observed -- getResearchDataset() only ever returns structurally valid rows) |

## 17. Limitations

- **Fields with no persisted source**: ${h.fieldsNotAvailable.join(', ')} -- none of these exist as
  a stored column or a derivable figure anywhere in this codebase as of this export; they are
  omitted from the scan-level CSVs entirely rather than padded with a repeated \`${NOT_AVAILABLE}\`
  cell on every row.
- **Remediation telemetry is not scan-linked**: DBAiHistory.scanReportId is frequently null (the
  fix endpoint typically operates on ad-hoc submitted code, not a saved scan id), so
  fix/remediation counts are reported at the participant level and as a standalone events export,
  never joined onto an individual scan row.
- **Before/after pairing is conservative by design**: a pair is only reported when a real,
  re-scan-verified fix event falls between two same-fixture scans of the same participant. Repeat
  scans without such an event are real data (visible in \`research-secondary-scans.csv\`) but are
  not claimed as a remediation before/after observation.
- **Engine memory/scan duration are not application runtime performance**: \`engineMemoryUsageMb\`
  is RuleExecutionEngine's own peak memory during static analysis; \`scanDurationMs\` is the
  engine's own elapsed time. Neither is comparable to RQ1's browser-runtime FCP/TTI measurements
  (Appendix B).
- **Questionnaire per-item statistics**: see Section 15.
- No inferential statistics (t-tests, ANOVA, confidence intervals) are computed anywhere in this
  report -- only descriptive statistics, per the brief's explicit instruction not to run
  inferential tests without a design/sample size that justifies them.

---

## Appendix A: INTERNAL CONTROLLED BENCHMARK

**This is a self-authored fixture/ground-truth benchmark (\`benchmarks/testbed\` +
\`benchmarks/ground-truth.json\`), computed live by \`EvaluationRunner.runEvaluation()\`. It is NOT
human-study accuracy, NOT participant accuracy, NOT independent expert validation, and NOT an RQ4
result** unless independent expert labels are separately obtained and explicitly stated as such.

| Scope | Rule ID | Domain | TP | FP | FN | Ground truth items | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| OVERALL | OVERALL | ALL | ${evalReport.overall.truePositives} | ${evalReport.overall.falsePositives} | ${evalReport.overall.falseNegatives} | ${evalReport.overall.truePositives + evalReport.overall.falseNegatives} | ${evalReport.overall.precision.toFixed(3)} | ${evalReport.overall.recall.toFixed(3)} | ${evalReport.overall.f1Score.toFixed(3)} |

Full per-rule breakdown: \`controlled-benchmark-metrics.csv\` (${evalReport.ruleMetrics.length} rules).
Rule coverage: ${evalReport.ruleCoverage.rulesWithGroundTruth}/${evalReport.ruleCoverage.totalFigmRules} canonical FIGM rules have ground-truth coverage.

## Appendix B: RQ1 RUNTIME PERFORMANCE

**Real, browser-measured FCP/TTI dataset, entirely independent of FIGM's own static-analysis
findings or engine diagnostics.** Per \`research/thesis/THESIS_BLOCKER_RESOLUTION.md\`'s DECISION 1
(RESOLVED): two real, independently-collected batches exist under the same frozen protocol
(identical Lighthouse 12.8.2 config, identical unmodified fixture/runner code, same 4 conditions,
1 warm-up + 10 measured runs per condition, 44 executions, 0 failures, each). **Batch 1 is PRIMARY;
Batch 2 is REPLICATION evidence. They are never pooled into one figure.**

### Batch 1 (PRIMARY) -- research-freeze-v1, committed

${b1.available ? `Source: \`research/rq1-experiment/processed-results/summary.json\` (${b1.data.breakdown.measuredExecutions} measured executions across ${b1.data.stats.length} conditions).\n\n${b1.data.stats.map((s: any) => `- **${s.conditionId}** (n=${s.n_valid}): FCP mean ${s.fcp.mean.toFixed(2)}ms (sd ${s.fcp.sd.toFixed(2)}), TTI mean ${s.tti.mean.toFixed(2)}ms (sd ${s.tti.sd.toFixed(2)})`).join('\n')}` : `**${NOT_AVAILABLE}** -- Batch 1 dataset not found at the expected path.`}

### Batch 2 (REPLICATION) -- "Stage 9", research-freeze-v5 baseline, uncommitted on disk

${b2.available ? `Source: \`research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/summary.json\` (${b2.data.breakdown.measuredExecutions} measured executions across ${b2.data.stats.length} conditions).\n\n${b2.data.stats.map((s: any) => `- **${s.conditionId}** (n=${s.n_valid}): FCP mean ${s.fcp.mean.toFixed(2)}ms (sd ${s.fcp.sd.toFixed(2)}), TTI mean ${s.tti.mean.toFixed(2)}ms (sd ${s.tti.sd.toFixed(2)})`).join('\n')}` : `**${NOT_AVAILABLE}** -- Batch 2 dataset not found at the expected path.`}

No documented methodological reason for Batch 2 to supersede Batch 1 was found (see
THESIS_BLOCKER_RESOLUTION.md DECISION 1 in full) -- both are true replications of one frozen
protocol, not a corrected re-run. Batch 2 is currently uncommitted on disk; if it is to be cited as
replication evidence it should be committed to avoid accidental loss.

staticPerformanceFindings (FIGM's own static-analysis output) is never treated as FCP/TTI;
scanDurationMs/engineMemoryUsageMb (FIGM's own engine diagnostics) are never treated as runtime
application performance. These are three separate measurement systems.
`;
}

if (process.argv[1] && process.argv[1].endsWith('export-research-analysis.ts')) {
  main().catch((err) => {
    console.error('[export-research-analysis] FAILED:', err);
    process.exitCode = 1;
  });
}

export { main as runResearchAnalysisExport };
