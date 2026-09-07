/**
 * Framework-Independent Guideline Model (FIGM)
 * Research Analysis / Export Pipeline -- builds every table this module produces from real,
 * already-persisted data only. Three methodologically distinct datasets are kept separate
 * end-to-end and NEVER pooled into one number:
 *
 *  1. HUMAN STUDY data       -- ParticipantRepository.getResearchDataset() and its siblings
 *     (getResearchDiagnostics, getResearchRemediationEvents). Gated by the exact same
 *     real-participant-code + CONSENT_VERIFIED + post-consent-timestamp rule those methods
 *     already enforce; this module never re-derives that rule.
 *  2. INTERNAL CONTROLLED BENCHMARK data -- EvaluationRunner.runEvaluation(), a self-authored
 *     fixture/ground-truth precision-recall-F1 measurement. Never relabeled as human-study
 *     accuracy, participant accuracy, expert validation, or RQ4 (see thesis-gap-exporter.ts's
 *     own established language for this exact distinction).
 *  3. RQ1 RUNTIME PERFORMANCE data -- the real FCP/TTI dataset in
 *     research/rq1-experiment/processed-results/summary.json. Never conflated with FIGM's own
 *     static scanDurationMs/engineMemoryUsageMb engine diagnostics, which measure the scanner
 *     itself, not a rendered application's runtime performance.
 *
 * Every function here is a pure transform over already-fetched data -- no filesystem/DB access,
 * so it can be exercised in tests with synthetic fixtures without touching a real database. The
 * one caller responsible for gathering real data and invoking these functions is
 * scripts/export-research-analysis.ts.
 *
 * No function in this file invents a value. Where the requested figure has no real backing data
 * (a stat over zero rows, a field with no matching persisted column), the appropriate sentinel
 * (`null`/`NOT_AVAILABLE`/`PENDING`) is returned instead -- see each function's own comment.
 */
import {
  ResearchDatasetScanRow,
  ResearchDiagnosticRow,
  ResearchRemediationEventRow,
  isRealStudyParticipantCode,
  PARTICIPANT_ID_PATTERN,
} from '../engine/participant-repository.js';
import { primaryResearchDomain } from '../matrix/four-layer-meta-model.js';
import type { DBUser } from '../auth/user-db.js';
import type { CompleteEvaluationReport } from './evaluation-runner.js';

export const NOT_AVAILABLE = 'NOT_AVAILABLE' as const;
export const PENDING = 'PENDING' as const;

export type ResearchDomain = 'ARCHITECTURE' | 'STATIC_PERFORMANCE' | 'ACCESSIBILITY';

function round(x: number, digits = 3): number {
  return parseFloat(x.toFixed(digits));
}

/** The three domains a rule's (domain, concern) pair maps to, or 'UNCLASSIFIED' when either is
 *  missing (e.g. a GENERAL_CODE_ERROR diagnostic, which has no FIGM domain/concern at all). */
export function classifyResearchDomain(domain: string | null, concern: string | null): ResearchDomain | 'UNCLASSIFIED' {
  if (!domain || !concern) return 'UNCLASSIFIED';
  return primaryResearchDomain(domain, concern);
}

/** ResearchDatasetScanRow.performanceFindings already includes architecture as a sub-count (see
 *  that field's own doc comment) -- this is the non-architecture remainder, i.e. the count the
 *  spec calls "staticPerformanceFindings". Never an independently re-derived figure. */
export function staticPerformanceFindingsOf(
  row: Pick<ResearchDatasetScanRow, 'performanceFindings' | 'architectureFindings'>
): number {
  return row.performanceFindings - row.architectureFindings;
}

export type FrameworkRole = 'PRIMARY_RESEARCH_FRAMEWORK' | 'ADDITIONAL_IMPLEMENTATION_SUPPORT' | 'OTHER';

/** React/Next.js/Angular are this study's three primary research frameworks; Vue is explicitly
 *  additional implementation support (per the RQ1 protocol's own framing -- see
 *  docs/audit/STAGE_9_RQ1_REAL_FCP_TTI_EXPERIMENT_REPORT.md), never silently merged in as a
 *  fourth primary framework. Anything else (Generic/JS/TS) is 'OTHER'. */
export function frameworkRoleOf(framework: string): FrameworkRole {
  const f = (framework || '').trim().toLowerCase();
  if (f === 'react' || f === 'next.js' || f === 'angular') return 'PRIMARY_RESEARCH_FRAMEWORK';
  if (f === 'vue') return 'ADDITIONAL_IMPLEMENTATION_SUPPORT';
  return 'OTHER';
}

export interface DescriptiveStats {
  n: number;
  mean: number;
  median: number;
  /** Population standard deviation (divides by N, not N-1) -- matches the convention
   *  scripts/import-user-study.ts's calculateCronbachAlpha/SUS pipeline already uses, so every
   *  descriptive-statistics figure in this codebase is computed the same way. */
  sd: number;
  min: number;
  max: number;
}

/** Returns null (never a fabricated/NaN figure) when there are zero values to summarize. */
export function computeDescriptiveStats(values: number[]): DescriptiveStats | null {
  if (values.length === 0) return null;
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  return {
    n,
    mean: round(mean),
    median: round(median),
    sd: round(Math.sqrt(variance)),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
  };
}

// ---------------------------------------------------------------------------
// A. Human study scan-level export
// ---------------------------------------------------------------------------

export interface ScanExportRow {
  participantCode: string;
  attemptType: 'PRIMARY' | 'SECONDARY';
  userId: string;
  fileName: string;
  framework: string;
  frameworkRole: FrameworkRole;
  createdAt: string;
  qualityScore: number;
  /** Identical source figure to totalFindings (both are the persisted ruleCount) -- exposed
   *  under both names because the spec's field list asks for both; never two independent
   *  measurements. */
  totalIssues: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  architectureFindings: number;
  staticPerformanceFindings: number;
  accessibilityFindings: number;
  figmRuleViolations: number;
  generalCodeErrors: number;
  scanDurationMs: number;
  engineMemoryUsageMb: number;
  /** Count of later SECONDARY attempts recorded for this exact (participant, fixture) pair --
   *  the real, defensible "rescan" signal (Stage 11B's own repeated-scan policy), not inferred. */
  rescanCount: number;
}

function computeRescanCounts(rows: ResearchDatasetScanRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.attemptType !== 'SECONDARY') continue;
    const key = `${r.userId}::${r.fileName}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

export function buildScanExportRows(rows: ResearchDatasetScanRow[]): ScanExportRow[] {
  const rescans = computeRescanCounts(rows);
  return rows.map((r) => ({
    participantCode: r.participantId,
    attemptType: r.attemptType,
    userId: r.userId,
    fileName: r.fileName,
    framework: r.framework,
    frameworkRole: frameworkRoleOf(r.framework),
    createdAt: r.createdAt,
    qualityScore: r.qualityScore,
    totalIssues: r.totalFindings,
    totalFindings: r.totalFindings,
    criticalCount: r.criticalCount,
    highCount: r.highCount,
    mediumCount: r.mediumCount,
    lowCount: r.lowCount,
    architectureFindings: r.architectureFindings,
    staticPerformanceFindings: staticPerformanceFindingsOf(r),
    accessibilityFindings: r.accessibilityFindings,
    figmRuleViolations: r.figmRuleViolations,
    generalCodeErrors: r.generalCodeErrors,
    scanDurationMs: r.scanTimeMs,
    engineMemoryUsageMb: r.engineMemoryUsageMb,
    rescanCount: rescans.get(`${r.userId}::${r.fileName}`) || 0,
  }));
}

export const SCAN_EXPORT_COLUMNS: Array<keyof ScanExportRow> = [
  'participantCode', 'attemptType', 'userId', 'fileName', 'framework', 'frameworkRole', 'createdAt',
  'qualityScore', 'totalIssues', 'totalFindings',
  'criticalCount', 'highCount', 'mediumCount', 'lowCount',
  'architectureFindings', 'staticPerformanceFindings', 'accessibilityFindings',
  'figmRuleViolations', 'generalCodeErrors',
  'scanDurationMs', 'engineMemoryUsageMb', 'rescanCount',
];

/** Fields the spec asked for that have no matching persisted column anywhere in this codebase
 *  (confirmed by direct source inspection, not assumed) -- deliberately never fabricated. Listed
 *  once here, at top level, instead of repeating a NOT_AVAILABLE cell on every scan row. */
export const SCAN_LEVEL_FIELDS_NOT_AVAILABLE = [
  'rulesChecked',
  'rulesEvaluated',
  'complexity',
  'sourceUnits',
  'alpsExtracted',
] as const;

// ---------------------------------------------------------------------------
// B. Domain analysis
// ---------------------------------------------------------------------------

export interface DomainAnalysisRow {
  participantCode: string;
  framework: string;
  frameworkRole: FrameworkRole;
  architectureFindings: number;
  staticPerformanceFindings: number;
  accessibilityFindings: number;
  totalFindings: number;
  qualityScore: number;
}

export function buildDomainAnalysisRows(primaryRows: ResearchDatasetScanRow[]): DomainAnalysisRow[] {
  return primaryRows.map((r) => ({
    participantCode: r.participantId,
    framework: r.framework,
    frameworkRole: frameworkRoleOf(r.framework),
    architectureFindings: r.architectureFindings,
    staticPerformanceFindings: staticPerformanceFindingsOf(r),
    accessibilityFindings: r.accessibilityFindings,
    totalFindings: r.totalFindings,
    qualityScore: r.qualityScore,
  }));
}

export const DOMAIN_ANALYSIS_COLUMNS: Array<keyof DomainAnalysisRow> = [
  'participantCode', 'framework', 'frameworkRole',
  'architectureFindings', 'staticPerformanceFindings', 'accessibilityFindings',
  'totalFindings', 'qualityScore',
];

export interface FrameworkDomainMatrixRow {
  framework: string;
  frameworkRole: FrameworkRole;
  scanCount: number;
  architectureTotal: number;
  staticPerformanceTotal: number;
  accessibilityTotal: number;
  totalFindings: number;
}

export function buildFrameworkDomainMatrix(primaryRows: ResearchDatasetScanRow[]): FrameworkDomainMatrixRow[] {
  const byFw = new Map<string, FrameworkDomainMatrixRow>();
  for (const r of primaryRows) {
    const existing: FrameworkDomainMatrixRow =
      byFw.get(r.framework) || {
        framework: r.framework,
        frameworkRole: frameworkRoleOf(r.framework),
        scanCount: 0,
        architectureTotal: 0,
        staticPerformanceTotal: 0,
        accessibilityTotal: 0,
        totalFindings: 0,
      };
    existing.scanCount += 1;
    existing.architectureTotal += r.architectureFindings;
    existing.staticPerformanceTotal += staticPerformanceFindingsOf(r);
    existing.accessibilityTotal += r.accessibilityFindings;
    existing.totalFindings += r.totalFindings;
    byFw.set(r.framework, existing);
  }
  return [...byFw.values()].sort((a, b) => b.totalFindings - a.totalFindings);
}

export const FRAMEWORK_DOMAIN_MATRIX_COLUMNS: Array<keyof FrameworkDomainMatrixRow> = [
  'framework', 'frameworkRole', 'scanCount',
  'architectureTotal', 'staticPerformanceTotal', 'accessibilityTotal', 'totalFindings',
];

export interface DomainTotal {
  domain: ResearchDomain;
  findings: number;
  percentageOfTotal: number | null;
}

export function buildDomainTotals(primaryRows: ResearchDatasetScanRow[]): DomainTotal[] {
  let architecture = 0;
  let staticPerformance = 0;
  let accessibility = 0;
  for (const r of primaryRows) {
    architecture += r.architectureFindings;
    staticPerformance += staticPerformanceFindingsOf(r);
    accessibility += r.accessibilityFindings;
  }
  const total = architecture + staticPerformance + accessibility;
  const pct = (n: number): number | null => (total > 0 ? round((n / total) * 100, 1) : null);
  return [
    { domain: 'ARCHITECTURE', findings: architecture, percentageOfTotal: pct(architecture) },
    { domain: 'STATIC_PERFORMANCE', findings: staticPerformance, percentageOfTotal: pct(staticPerformance) },
    { domain: 'ACCESSIBILITY', findings: accessibility, percentageOfTotal: pct(accessibility) },
  ];
}

export interface RuleFrequencyRow {
  domain: ResearchDomain | 'UNCLASSIFIED';
  ruleId: string;
  count: number;
  rank: number;
}

/** Most frequent rule IDs per research domain, restricted to real FIGM_RULE diagnostics (a
 *  GENERAL_CODE_ERROR has no FIGM domain/concern to classify by). Callers should pass only
 *  PRIMARY-attempt diagnostics for the primary human-study analysis view. */
export function buildRuleFrequency(diagnostics: ResearchDiagnosticRow[]): RuleFrequencyRow[] {
  const counts = new Map<string, { domain: ResearchDomain | 'UNCLASSIFIED'; count: number }>();
  for (const d of diagnostics) {
    if (d.kind !== 'FIGM_RULE') continue;
    const domain = classifyResearchDomain(d.domain, d.concern);
    const existing = counts.get(d.ruleId) || { domain, count: 0 };
    existing.count += 1;
    counts.set(d.ruleId, existing);
  }
  const byDomain = new Map<string, RuleFrequencyRow[]>();
  for (const [ruleId, v] of counts.entries()) {
    const list = byDomain.get(v.domain) || [];
    list.push({ domain: v.domain, ruleId, count: v.count, rank: 0 });
    byDomain.set(v.domain, list);
  }
  const out: RuleFrequencyRow[] = [];
  for (const list of byDomain.values()) {
    list.sort((a, b) => b.count - a.count);
    list.forEach((row, i) => {
      row.rank = i + 1;
      out.push(row);
    });
  }
  return out.sort((a, b) => a.domain.localeCompare(b.domain) || a.rank - b.rank);
}

export const RULE_FREQUENCY_COLUMNS: Array<keyof RuleFrequencyRow> = ['domain', 'ruleId', 'count', 'rank'];

// ---------------------------------------------------------------------------
// Severity analysis
// ---------------------------------------------------------------------------

export interface SeverityAnalysisRow {
  scope: string; // a framework name, or 'ALL'
  frameworkRole: FrameworkRole | 'ALL';
  criticalTotal: number;
  highTotal: number;
  mediumTotal: number;
  lowTotal: number;
  totalFindings: number;
}

export function buildSeverityAnalysis(primaryRows: ResearchDatasetScanRow[]): SeverityAnalysisRow[] {
  const byFw = new Map<string, SeverityAnalysisRow>();
  const all: SeverityAnalysisRow = {
    scope: 'ALL', frameworkRole: 'ALL',
    criticalTotal: 0, highTotal: 0, mediumTotal: 0, lowTotal: 0, totalFindings: 0,
  };
  for (const r of primaryRows) {
    const existing: SeverityAnalysisRow =
      byFw.get(r.framework) || {
        scope: r.framework,
        frameworkRole: frameworkRoleOf(r.framework),
        criticalTotal: 0, highTotal: 0, mediumTotal: 0, lowTotal: 0, totalFindings: 0,
      };
    existing.criticalTotal += r.criticalCount;
    existing.highTotal += r.highCount;
    existing.mediumTotal += r.mediumCount;
    existing.lowTotal += r.lowCount;
    existing.totalFindings += r.totalFindings;
    byFw.set(r.framework, existing);

    all.criticalTotal += r.criticalCount;
    all.highTotal += r.highCount;
    all.mediumTotal += r.mediumCount;
    all.lowTotal += r.lowCount;
    all.totalFindings += r.totalFindings;
  }
  return [...byFw.values(), all];
}

export const SEVERITY_ANALYSIS_COLUMNS: Array<keyof SeverityAnalysisRow> = [
  'scope', 'frameworkRole', 'criticalTotal', 'highTotal', 'mediumTotal', 'lowTotal', 'totalFindings',
];

// ---------------------------------------------------------------------------
// C. Participant-level summary
// ---------------------------------------------------------------------------

export interface ParticipantSummaryRow {
  participantCode: string;
  researchStatus: string;
  consentVerifiedAtPresent: boolean;
  eligiblePrimaryScans: number;
  secondaryScans: number;
  frameworksUsed: string;
  latestQualityScore: number | typeof NOT_AVAILABLE;
  meanQualityScore: number | typeof NOT_AVAILABLE;
  totalFindings: number;
  architectureTotal: number;
  staticPerformanceTotal: number;
  accessibilityTotal: number;
  criticalTotal: number;
  highTotal: number;
  mediumTotal: number;
  lowTotal: number;
  meanScanDurationMs: number | typeof NOT_AVAILABLE;
  meanEngineMemoryUsageMb: number | typeof NOT_AVAILABLE;
  fixEvents: number;
  fixesGenerated: number;
  fixesApplied: number;
  rescans: number;
  lastActivity: string | typeof NOT_AVAILABLE;
}

export function buildParticipantSummary(
  targetCount: number,
  allUsers: DBUser[],
  datasetRows: ResearchDatasetScanRow[],
  remediationEvents: ResearchRemediationEventRow[]
): ParticipantSummaryRow[] {
  const userByCode = new Map<string, DBUser>();
  for (const u of allUsers) {
    const code = u.participantCode || u.id;
    if (isRealStudyParticipantCode(code) && !userByCode.has(code)) userByCode.set(code, u);
  }
  const rowsByCode = new Map<string, ResearchDatasetScanRow[]>();
  for (const r of datasetRows) {
    const list = rowsByCode.get(r.participantId) || [];
    list.push(r);
    rowsByCode.set(r.participantId, list);
  }
  const eventsByCode = new Map<string, ResearchRemediationEventRow[]>();
  for (const e of remediationEvents) {
    const list = eventsByCode.get(e.participantId) || [];
    list.push(e);
    eventsByCode.set(e.participantId, list);
  }

  const out: ParticipantSummaryRow[] = [];
  for (let i = 1; i <= targetCount; i++) {
    const code = `P${String(i).padStart(3, '0')}`;
    const user = userByCode.get(code);
    const rows = rowsByCode.get(code) || [];
    const primary = rows.filter((r) => r.attemptType === 'PRIMARY');
    const secondary = rows.filter((r) => r.attemptType === 'SECONDARY');
    const events = eventsByCode.get(code) || [];

    const qualityStats = computeDescriptiveStats(primary.map((r) => r.qualityScore));
    const durationStats = computeDescriptiveStats(primary.map((r) => r.scanTimeMs));
    const memoryStats = computeDescriptiveStats(primary.map((r) => r.engineMemoryUsageMb));
    const latestByActivity = [...rows, ...events.map((e) => ({ createdAt: e.createdAt }))].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const latestScan = [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    out.push({
      participantCode: code,
      researchStatus: user?.researchStatus || 'NOT_REGISTERED',
      consentVerifiedAtPresent: !!user?.researchConsentVerifiedAt,
      eligiblePrimaryScans: primary.length,
      secondaryScans: secondary.length,
      frameworksUsed: [...new Set(rows.map((r) => r.framework))].join(';'),
      latestQualityScore: latestScan ? latestScan.qualityScore : NOT_AVAILABLE,
      meanQualityScore: qualityStats ? qualityStats.mean : NOT_AVAILABLE,
      totalFindings: primary.reduce((a, r) => a + r.totalFindings, 0),
      architectureTotal: primary.reduce((a, r) => a + r.architectureFindings, 0),
      staticPerformanceTotal: primary.reduce((a, r) => a + staticPerformanceFindingsOf(r), 0),
      accessibilityTotal: primary.reduce((a, r) => a + r.accessibilityFindings, 0),
      criticalTotal: primary.reduce((a, r) => a + r.criticalCount, 0),
      highTotal: primary.reduce((a, r) => a + r.highCount, 0),
      mediumTotal: primary.reduce((a, r) => a + r.mediumCount, 0),
      lowTotal: primary.reduce((a, r) => a + r.lowCount, 0),
      meanScanDurationMs: durationStats ? durationStats.mean : NOT_AVAILABLE,
      meanEngineMemoryUsageMb: memoryStats ? memoryStats.mean : NOT_AVAILABLE,
      fixEvents: events.length,
      fixesGenerated: events.length,
      fixesApplied: events.filter((e) => e.applied).length,
      rescans: secondary.length,
      lastActivity: latestByActivity ? latestByActivity.createdAt : NOT_AVAILABLE,
    });
  }
  return out;
}

export const PARTICIPANT_SUMMARY_COLUMNS: Array<keyof ParticipantSummaryRow> = [
  'participantCode', 'researchStatus', 'consentVerifiedAtPresent',
  'eligiblePrimaryScans', 'secondaryScans', 'frameworksUsed',
  'latestQualityScore', 'meanQualityScore', 'totalFindings',
  'architectureTotal', 'staticPerformanceTotal', 'accessibilityTotal',
  'criticalTotal', 'highTotal', 'mediumTotal', 'lowTotal',
  'meanScanDurationMs', 'meanEngineMemoryUsageMb',
  'fixEvents', 'fixesGenerated', 'fixesApplied', 'rescans', 'lastActivity',
];

// ---------------------------------------------------------------------------
// D. Before / after remediation analysis
// ---------------------------------------------------------------------------

export interface BeforeAfterRow {
  participantCode: string;
  fileName: string;
  framework: string;
  beforeScanId: string;
  afterScanId: string;
  beforeCreatedAt: string;
  afterCreatedAt: string;
  beforeQualityScore: number;
  afterQualityScore: number;
  qualityScoreChange: number;
  beforeTotalIssues: number;
  afterTotalIssues: number;
  issueReduction: number;
  issueReductionPercentage: number | null;
  beforeArchitecture: number;
  afterArchitecture: number;
  architectureReduction: number;
  beforeStaticPerformance: number;
  afterStaticPerformance: number;
  staticPerformanceReduction: number;
  beforeAccessibility: number;
  afterAccessibility: number;
  accessibilityReduction: number;
  beforeCritical: number;
  afterCritical: number;
  beforeHigh: number;
  afterHigh: number;
  beforeMedium: number;
  afterMedium: number;
  beforeLow: number;
  afterLow: number;
  /** The real, applied (re-scan-verified) fix event(s) that justify treating this pair as a
   *  genuine before/after remediation observation -- the evidence, not an inference. */
  qualifyingFixEventRuleIds: string;
}

export interface BeforeAfterResult {
  pairs: BeforeAfterRow[];
  /** (participant, fixture) groups with 2+ eligible scans but no applied fix event chronologically
   *  between any consecutive pair -- real repeat interactions that cannot be defensibly called a
   *  "remediation" before/after observation. Counted, never silently dropped or force-paired. */
  candidateGroupsWithoutQualifyingFixEvent: number;
}

/**
 * Only pairs a scan with a later same-fixture scan when a real, re-scan-verified
 * (DBAiHistory.applied === true) fix event for the same user exists strictly between the two
 * scans' timestamps -- the one defensible signal available given `scanReportId` is frequently
 * null (see ResearchRemediationEventRow's doc comment). No pairing is ever inferred from
 * timestamp proximity alone.
 */
export function buildBeforeAfterPairs(
  datasetRows: ResearchDatasetScanRow[],
  remediationEvents: ResearchRemediationEventRow[]
): BeforeAfterResult {
  const byGroup = new Map<string, ResearchDatasetScanRow[]>();
  for (const r of datasetRows) {
    const key = `${r.userId}::${r.fileName}`;
    const list = byGroup.get(key) || [];
    list.push(r);
    byGroup.set(key, list);
  }
  const eventsByUser = new Map<string, ResearchRemediationEventRow[]>();
  for (const e of remediationEvents) {
    if (!e.applied) continue;
    const list = eventsByUser.get(e.userId) || [];
    list.push(e);
    eventsByUser.set(e.userId, list);
  }

  const pairs: BeforeAfterRow[] = [];
  let candidateGroupsWithoutQualifyingFixEvent = 0;

  for (const rows of byGroup.values()) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const userEvents = eventsByUser.get(sorted[0].userId) || [];
    let foundAnyPairForGroup = false;

    for (let i = 0; i < sorted.length - 1; i++) {
      const before = sorted[i];
      const after = sorted[i + 1];
      const beforeMs = new Date(before.createdAt).getTime();
      const afterMs = new Date(after.createdAt).getTime();
      const qualifying = userEvents.filter((e) => {
        const t = new Date(e.createdAt).getTime();
        return t > beforeMs && t <= afterMs;
      });
      if (qualifying.length === 0) continue;

      foundAnyPairForGroup = true;
      const beforeStaticPerf = staticPerformanceFindingsOf(before);
      const afterStaticPerf = staticPerformanceFindingsOf(after);
      pairs.push({
        participantCode: before.participantId,
        fileName: before.fileName,
        framework: before.framework,
        beforeScanId: before.scanId,
        afterScanId: after.scanId,
        beforeCreatedAt: before.createdAt,
        afterCreatedAt: after.createdAt,
        beforeQualityScore: before.qualityScore,
        afterQualityScore: after.qualityScore,
        qualityScoreChange: after.qualityScore - before.qualityScore,
        beforeTotalIssues: before.totalFindings,
        afterTotalIssues: after.totalFindings,
        issueReduction: before.totalFindings - after.totalFindings,
        issueReductionPercentage:
          before.totalFindings > 0
            ? round(((before.totalFindings - after.totalFindings) / before.totalFindings) * 100, 1)
            : null,
        beforeArchitecture: before.architectureFindings,
        afterArchitecture: after.architectureFindings,
        architectureReduction: before.architectureFindings - after.architectureFindings,
        beforeStaticPerformance: beforeStaticPerf,
        afterStaticPerformance: afterStaticPerf,
        staticPerformanceReduction: beforeStaticPerf - afterStaticPerf,
        beforeAccessibility: before.accessibilityFindings,
        afterAccessibility: after.accessibilityFindings,
        accessibilityReduction: before.accessibilityFindings - after.accessibilityFindings,
        beforeCritical: before.criticalCount,
        afterCritical: after.criticalCount,
        beforeHigh: before.highCount,
        afterHigh: after.highCount,
        beforeMedium: before.mediumCount,
        afterMedium: after.mediumCount,
        beforeLow: before.lowCount,
        afterLow: after.lowCount,
        qualifyingFixEventRuleIds: [...new Set(qualifying.map((q) => q.ruleId))].join(';'),
      });
    }
    if (!foundAnyPairForGroup) candidateGroupsWithoutQualifyingFixEvent += 1;
  }

  return { pairs, candidateGroupsWithoutQualifyingFixEvent };
}

export const BEFORE_AFTER_COLUMNS: Array<keyof BeforeAfterRow> = [
  'participantCode', 'fileName', 'framework',
  'beforeScanId', 'afterScanId', 'beforeCreatedAt', 'afterCreatedAt',
  'beforeQualityScore', 'afterQualityScore', 'qualityScoreChange',
  'beforeTotalIssues', 'afterTotalIssues', 'issueReduction', 'issueReductionPercentage',
  'beforeArchitecture', 'afterArchitecture', 'architectureReduction',
  'beforeStaticPerformance', 'afterStaticPerformance', 'staticPerformanceReduction',
  'beforeAccessibility', 'afterAccessibility', 'accessibilityReduction',
  'beforeCritical', 'afterCritical', 'beforeHigh', 'afterHigh',
  'beforeMedium', 'afterMedium', 'beforeLow', 'afterLow',
  'qualifyingFixEventRuleIds',
];

// ---------------------------------------------------------------------------
// Remediation events export (raw, one row per real fix attempt)
// ---------------------------------------------------------------------------

export const REMEDIATION_EVENT_COLUMNS: Array<keyof ResearchRemediationEventRow> = [
  'participantId', 'userId', 'scanReportId', 'ruleId', 'applied', 'createdAt',
];

// ---------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------

export interface ExclusionsSummary {
  preConsentScansExcluded: number;
  revokedParticipants: number;
  assignedNotYetVerifiedParticipants: number;
  secondaryScansExcludedFromPrimary: number;
  qaOrOutOfRangeFixtureCodesExcludedByConstruction: number;
  invalidRows: number;
}

export function computeExclusions(
  allUsers: DBUser[],
  allScans: Array<{ userId: string; createdAt: string }>,
  datasetRows: ResearchDatasetScanRow[]
): ExclusionsSummary {
  let revoked = 0;
  let assignedNotVerified = 0;
  let qaOutOfRange = 0;
  const consentAtByUserId = new Map<string, number>();

  for (const u of allUsers) {
    const code = u.participantCode || u.id;
    const shaped = PARTICIPANT_ID_PATTERN.test(code);
    if (shaped && !isRealStudyParticipantCode(code)) qaOutOfRange += 1;
    if (isRealStudyParticipantCode(code)) {
      if (u.researchStatus === 'REVOKED') revoked += 1;
      else if (u.researchStatus === 'ASSIGNED') assignedNotVerified += 1;
      if (u.researchStatus === 'CONSENT_VERIFIED' && u.researchConsentVerifiedAt) {
        consentAtByUserId.set(u.id, new Date(u.researchConsentVerifiedAt).getTime());
      }
    }
  }

  let preConsentScansExcluded = 0;
  for (const scan of allScans) {
    const consentAtMs = consentAtByUserId.get(scan.userId);
    if (consentAtMs === undefined) continue;
    if (new Date(scan.createdAt).getTime() < consentAtMs) preConsentScansExcluded += 1;
  }

  return {
    preConsentScansExcluded,
    revokedParticipants: revoked,
    assignedNotYetVerifiedParticipants: assignedNotVerified,
    secondaryScansExcludedFromPrimary: datasetRows.filter((r) => r.attemptType === 'SECONDARY').length,
    qaOrOutOfRangeFixtureCodesExcludedByConstruction: qaOutOfRange,
    invalidRows: 0,
  };
}

// ---------------------------------------------------------------------------
// H. Internal controlled benchmark (kept entirely separate from human-study data)
// ---------------------------------------------------------------------------

export interface ControlledBenchmarkRow {
  scope: 'OVERALL' | 'PER_RULE';
  ruleId: string;
  domain: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  groundTruthItems: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export function buildControlledBenchmarkRows(report: CompleteEvaluationReport): ControlledBenchmarkRow[] {
  const overall: ControlledBenchmarkRow = {
    scope: 'OVERALL',
    ruleId: 'OVERALL',
    domain: 'ALL',
    truePositives: report.overall.truePositives,
    falsePositives: report.overall.falsePositives,
    falseNegatives: report.overall.falseNegatives,
    groundTruthItems: report.overall.truePositives + report.overall.falseNegatives,
    precision: report.overall.precision,
    recall: report.overall.recall,
    f1Score: report.overall.f1Score,
  };
  const perRule: ControlledBenchmarkRow[] = report.ruleMetrics.map((m) => ({
    scope: 'PER_RULE',
    ruleId: m.ruleId,
    domain: m.domain,
    truePositives: m.truePositives,
    falsePositives: m.falsePositives,
    falseNegatives: m.falseNegatives,
    groundTruthItems: m.truePositives + m.falseNegatives,
    precision: m.precision,
    recall: m.recall,
    f1Score: m.f1Score,
  }));
  return [overall, ...perRule];
}

export const CONTROLLED_BENCHMARK_COLUMNS: Array<keyof ControlledBenchmarkRow> = [
  'scope', 'ruleId', 'domain', 'truePositives', 'falsePositives', 'falseNegatives',
  'groundTruthItems', 'precision', 'recall', 'f1Score',
];

// ---------------------------------------------------------------------------
// CSV serialization
// ---------------------------------------------------------------------------

export function toCsv<T>(rows: T[], columns: Array<keyof T>): string {
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))];
  return lines.join('\n');
}
