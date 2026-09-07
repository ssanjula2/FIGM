import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { ResearchDatasetScanRow, ResearchRemediationEventRow, ResearchDiagnosticRow } from '../src/engine/participant-repository.js';
import {
  computeDescriptiveStats,
  staticPerformanceFindingsOf,
  frameworkRoleOf,
  buildScanExportRows,
  buildDomainAnalysisRows,
  buildFrameworkDomainMatrix,
  buildDomainTotals,
  buildRuleFrequency,
  buildSeverityAnalysis,
  buildParticipantSummary,
  buildBeforeAfterPairs,
  computeExclusions,
  toCsv,
  NOT_AVAILABLE,
  HistoricalParticipantActivity,
} from '../src/eval/research-analysis-exporter.js';

/**
 * All fixtures below are synthetic, hand-authored test data -- never claimed as real
 * participant/study data anywhere. These tests exercise the exporter's pure transform logic in
 * isolation (no DB/storage), matching this repo's convention of unit-testing analysis code
 * against fixtures rather than a live database.
 */

function row(overrides: Partial<ResearchDatasetScanRow>): ResearchDatasetScanRow {
  return {
    participantId: 'P001',
    userId: 'usr_1',
    scanId: 'scan_1',
    fileName: 'Fixture.tsx',
    framework: 'React',
    qualityScore: 80,
    ruleCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    attemptType: 'PRIMARY',
    scanTimeMs: 10,
    totalFindings: 2,
    architectureFindings: 1,
    performanceFindings: 2,
    accessibilityFindings: 1,
    criticalCount: 0,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    engineMemoryUsageMb: 5,
    figmRuleViolations: 2,
    generalCodeErrors: 0,
    ...overrides,
  };
}

describe('research-analysis-exporter: descriptive statistics', () => {
  test('returns null (never NaN/fabricated) for an empty sample', () => {
    assert.equal(computeDescriptiveStats([]), null);
  });

  test('computes population sd, mean, median for a real sample', () => {
    const stats = computeDescriptiveStats([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.ok(stats);
    assert.equal(stats!.n, 8);
    assert.equal(stats!.mean, 5);
    assert.equal(stats!.sd, 2);
  });
});

describe('research-analysis-exporter: domain classification', () => {
  test('staticPerformanceFindingsOf never double-counts architecture', () => {
    const r = row({ architectureFindings: 3, performanceFindings: 3 });
    assert.equal(staticPerformanceFindingsOf(r), 0, 'architecture is a subset of performanceFindings, not additive');
  });

  test('frameworkRoleOf: Vue is additional implementation support, never a primary research framework', () => {
    assert.equal(frameworkRoleOf('React'), 'PRIMARY_RESEARCH_FRAMEWORK');
    assert.equal(frameworkRoleOf('Next.js'), 'PRIMARY_RESEARCH_FRAMEWORK');
    assert.equal(frameworkRoleOf('Angular'), 'PRIMARY_RESEARCH_FRAMEWORK');
    assert.equal(frameworkRoleOf('Vue'), 'ADDITIONAL_IMPLEMENTATION_SUPPORT');
    assert.equal(frameworkRoleOf('Generic'), 'OTHER');
  });

  test('buildDomainTotals sums architecture/staticPerformance/accessibility without overlap and computes percentages', () => {
    const rows = [
      row({ architectureFindings: 1, performanceFindings: 2, accessibilityFindings: 1 }), // static=1
      row({ architectureFindings: 0, performanceFindings: 1, accessibilityFindings: 2 }), // static=1
    ];
    const totals = buildDomainTotals(rows);
    const byDomain = Object.fromEntries(totals.map((t) => [t.domain, t]));
    assert.equal(byDomain.ARCHITECTURE.findings, 1);
    assert.equal(byDomain.STATIC_PERFORMANCE.findings, 2);
    assert.equal(byDomain.ACCESSIBILITY.findings, 3);
    // total findings = 1 + 2 + 3 = 6
    assert.equal(byDomain.ARCHITECTURE.percentageOfTotal, Math.round((1 / 6) * 1000) / 10);
  });

  test('buildDomainTotals returns null percentages (never divide-by-zero fabrication) when there are zero findings', () => {
    const totals = buildDomainTotals([]);
    for (const t of totals) {
      assert.equal(t.findings, 0);
      assert.equal(t.percentageOfTotal, null);
    }
  });
});

describe('research-analysis-exporter: scan export + rescan counts', () => {
  test('rescanCount reflects the real number of SECONDARY attempts for the same (user, fixture) pair', () => {
    const rows = [
      row({ scanId: 's1', attemptType: 'PRIMARY', createdAt: '2026-01-01T00:00:00.000Z' }),
      row({ scanId: 's2', attemptType: 'SECONDARY', createdAt: '2026-01-02T00:00:00.000Z' }),
      row({ scanId: 's3', attemptType: 'SECONDARY', createdAt: '2026-01-03T00:00:00.000Z' }),
    ];
    const exported = buildScanExportRows(rows);
    for (const r of exported) assert.equal(r.rescanCount, 2);
  });

  test('totalIssues and totalFindings are the same source figure, never independently computed', () => {
    const [r] = buildScanExportRows([row({ totalFindings: 7 })]);
    assert.equal(r.totalIssues, 7);
    assert.equal(r.totalFindings, 7);
  });
});

describe('research-analysis-exporter: framework x domain matrix', () => {
  test('aggregates per framework and tags frameworkRole, including Vue as additional support', () => {
    const rows = [
      row({ framework: 'React', architectureFindings: 1, performanceFindings: 1, accessibilityFindings: 0 }),
      row({ framework: 'Vue', architectureFindings: 0, performanceFindings: 0, accessibilityFindings: 2 }),
    ];
    const matrix = buildFrameworkDomainMatrix(rows);
    const react = matrix.find((m) => m.framework === 'React')!;
    const vue = matrix.find((m) => m.framework === 'Vue')!;
    assert.equal(react.frameworkRole, 'PRIMARY_RESEARCH_FRAMEWORK');
    assert.equal(vue.frameworkRole, 'ADDITIONAL_IMPLEMENTATION_SUPPORT');
    assert.equal(vue.accessibilityTotal, 2);
  });
});

describe('research-analysis-exporter: rule frequency', () => {
  test('only counts FIGM_RULE diagnostics, ranks per domain, ignores GENERAL_CODE_ERROR', () => {
    const diagnostics: ResearchDiagnosticRow[] = [
      { participantId: 'P001', userId: 'u1', scanId: 's1', fileName: 'f.tsx', framework: 'React', attemptType: 'PRIMARY', createdAt: 'x', ruleId: 'FIGM-A11Y-01', severity: 'HIGH', domain: 'ACCESSIBILITY', concern: 'NAME_ROLE_VALUE', kind: 'FIGM_RULE' },
      { participantId: 'P001', userId: 'u1', scanId: 's1', fileName: 'f.tsx', framework: 'React', attemptType: 'PRIMARY', createdAt: 'x', ruleId: 'FIGM-A11Y-01', severity: 'HIGH', domain: 'ACCESSIBILITY', concern: 'NAME_ROLE_VALUE', kind: 'FIGM_RULE' },
      { participantId: 'P001', userId: 'u1', scanId: 's1', fileName: 'f.tsx', framework: 'React', attemptType: 'PRIMARY', createdAt: 'x', ruleId: 'TYPE-TS-2322', severity: 'MEDIUM', domain: null, concern: null, kind: 'GENERAL_CODE_ERROR' },
    ];
    const freq = buildRuleFrequency(diagnostics);
    assert.equal(freq.length, 1);
    assert.equal(freq[0].ruleId, 'FIGM-A11Y-01');
    assert.equal(freq[0].count, 2);
    assert.equal(freq[0].domain, 'ACCESSIBILITY');
    assert.equal(freq[0].rank, 1);
  });
});

describe('research-analysis-exporter: severity analysis', () => {
  test('produces a per-framework breakdown plus an ALL total that sums correctly', () => {
    const rows = [
      row({ framework: 'React', criticalCount: 1, highCount: 2, mediumCount: 0, lowCount: 0, totalFindings: 3 }),
      row({ framework: 'Angular', criticalCount: 0, highCount: 0, mediumCount: 1, lowCount: 1, totalFindings: 2 }),
    ];
    const severity = buildSeverityAnalysis(rows);
    const all = severity.find((s) => s.scope === 'ALL')!;
    assert.equal(all.criticalTotal, 1);
    assert.equal(all.totalFindings, 5);
  });
});

describe('research-analysis-exporter: participant summary', () => {
  test('a participant with zero eligible data reports NOT_AVAILABLE stats, never NaN or a fabricated 0-mean', () => {
    const summary = buildParticipantSummary(2, [], [], []);
    assert.equal(summary.length, 2);
    assert.equal(summary[0].participantCode, 'P001');
    assert.equal(summary[0].researchStatus, 'NOT_REGISTERED');
    assert.equal(summary[0].meanQualityScore, NOT_AVAILABLE);
    assert.equal(summary[0].latestQualityScore, NOT_AVAILABLE);
    assert.equal(summary[0].totalFindings, 0);
  });

  test('aggregates PRIMARY-only stats for a participant with real rows and fix events', () => {
    const users: any[] = [{ id: 'u1', participantCode: 'P001', researchStatus: 'CONSENT_VERIFIED', researchConsentVerifiedAt: '2026-01-01T00:00:00.000Z' }];
    const rows = [
      row({ userId: 'u1', scanId: 's1', attemptType: 'PRIMARY', qualityScore: 70, totalFindings: 4, createdAt: '2026-01-02T00:00:00.000Z' }),
      row({ userId: 'u1', scanId: 's2', attemptType: 'SECONDARY', qualityScore: 90, totalFindings: 1, createdAt: '2026-01-03T00:00:00.000Z' }),
    ];
    const events: ResearchRemediationEventRow[] = [
      { participantId: 'P001', userId: 'u1', scanReportId: null, ruleId: 'FIGM-REACT-01', applied: true, createdAt: '2026-01-02T12:00:00.000Z' },
    ];
    const summary = buildParticipantSummary(1, users, rows, events);
    assert.equal(summary[0].eligiblePrimaryScans, 1);
    assert.equal(summary[0].secondaryScans, 1);
    assert.equal(summary[0].meanQualityScore, 70, 'mean must be computed over PRIMARY rows only');
    assert.equal(summary[0].fixEvents, 1);
    assert.equal(summary[0].fixesApplied, 1);
    // No historicalActivity argument was passed -- the new lane must stay fully blank/NOT_AVAILABLE,
    // never fabricated, and must never be confused with the real consent-gated columns above.
    assert.equal(summary[0].historicalDataSource, '');
    assert.equal(summary[0].historicalTotalScans, NOT_AVAILABLE);
  });
});

describe('research-analysis-exporter: historical (non-consent-gated) participant activity lane', () => {
  const activity = (overrides: Partial<HistoricalParticipantActivity> = {}): HistoricalParticipantActivity => ({
    totalScans: 3,
    successfulScans: 3,
    failedScans: 0,
    averageQualityScore: 82,
    latestQualityScore: 90,
    averageScanTimeMs: 55.5,
    totalFindings: 7,
    frameworkUsage: [{ framework: 'React', count: 2 }, { framework: 'Vue', count: 1 }],
    latestActivity: '2026-09-07T16:00:00.000Z',
    ...overrides,
  });

  test('surfaces real historical activity for an ASSIGNED (not yet consent-verified) participant, clearly labeled and never touching the consent-gated columns', () => {
    const users: any[] = [{ id: 'u1', participantCode: 'P001', researchStatus: 'ASSIGNED', researchConsentVerifiedAt: null }];
    const historical = new Map([['P001', activity()]]);
    const summary = buildParticipantSummary(1, users, [], [], historical);
    const p = summary[0];

    assert.equal(p.researchStatus, 'ASSIGNED');
    assert.equal(p.consentVerifiedAtPresent, false, 'consent status must be preserved exactly as stored, never marked verified');
    assert.equal(p.eligiblePrimaryScans, 0, 'no fabricated PRIMARY rows -- pre-consent activity is never reclassified as eligible');
    assert.equal(p.secondaryScans, 0);

    assert.equal(p.historicalDataSource, 'PRODUCTION_REAL_HISTORICAL_PARTICIPANT');
    assert.equal(p.historicalEligibility, 'HISTORICAL_REAL_USER_NOT_CONSENT_GATED');
    assert.equal(p.historicalTotalScans, 3);
    assert.equal(p.historicalSuccessfulScans, 3);
    assert.equal(p.historicalFailedScans, 0);
    assert.equal(p.historicalAvgQualityScore, 82);
    assert.equal(p.historicalLatestQualityScore, 90);
    assert.equal(p.historicalAvgScanTimeMs, 55.5);
    assert.equal(p.historicalTotalFindings, 7);
    assert.equal(p.historicalFrameworkUsage, 'React:2;Vue:1');
    assert.equal(p.historicalLatestActivity, '2026-09-07T16:00:00.000Z');
  });

  test('never populates the historical lane for a CONSENT_VERIFIED participant, even if historical activity data is passed for them', () => {
    const users: any[] = [{ id: 'u1', participantCode: 'P001', researchStatus: 'CONSENT_VERIFIED', researchConsentVerifiedAt: '2026-01-01T00:00:00.000Z' }];
    const historical = new Map([['P001', activity()]]);
    const summary = buildParticipantSummary(1, users, [], [], historical);
    const p = summary[0];

    assert.equal(p.historicalDataSource, '', 'a CONSENT_VERIFIED participant\'s real activity is already fully represented by the consent-gated columns -- the historical lane must not duplicate or override it');
    assert.equal(p.historicalTotalScans, NOT_AVAILABLE);
  });

  test('leaves the historical lane at NOT_AVAILABLE for a participant with zero recorded activity, even if present in the map', () => {
    const users: any[] = [{ id: 'u1', participantCode: 'P001', researchStatus: 'ASSIGNED', researchConsentVerifiedAt: null }];
    const historical = new Map([['P001', activity({ totalScans: 0, successfulScans: 0, failedScans: 0, frameworkUsage: [] })]]);
    const summary = buildParticipantSummary(1, users, [], [], historical);
    assert.equal(summary[0].historicalDataSource, '');
    assert.equal(summary[0].historicalTotalScans, NOT_AVAILABLE);
  });

  test('leaves every other participant\'s historical lane untouched when only one participant has an entry', () => {
    const users: any[] = [
      { id: 'u1', participantCode: 'P001', researchStatus: 'ASSIGNED', researchConsentVerifiedAt: null },
      { id: 'u2', participantCode: 'P002', researchStatus: 'ASSIGNED', researchConsentVerifiedAt: null },
    ];
    const historical = new Map([['P001', activity()]]);
    const summary = buildParticipantSummary(2, users, [], [], historical);
    assert.equal(summary[0].historicalDataSource, 'PRODUCTION_REAL_HISTORICAL_PARTICIPANT');
    assert.equal(summary[1].historicalDataSource, '', 'P002 has no entry in the historical map and must not inherit or fabricate one');
    assert.equal(summary[1].historicalTotalScans, NOT_AVAILABLE);
  });
});

describe('research-analysis-exporter: before/after pairing (never fabricated)', () => {
  test('does not pair two same-fixture scans when no applied fix event exists between them', () => {
    const rows = [
      row({ userId: 'u1', scanId: 's1', attemptType: 'PRIMARY', createdAt: '2026-01-01T00:00:00.000Z' }),
      row({ userId: 'u1', scanId: 's2', attemptType: 'SECONDARY', createdAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const result = buildBeforeAfterPairs(rows, []);
    assert.equal(result.pairs.length, 0);
    assert.equal(result.candidateGroupsWithoutQualifyingFixEvent, 1);
  });

  test('pairs a before/after only when a real applied fix event falls strictly between the two scans', () => {
    const rows = [
      row({ userId: 'u1', scanId: 's1', attemptType: 'PRIMARY', qualityScore: 60, totalFindings: 5, architectureFindings: 2, performanceFindings: 3, accessibilityFindings: 1, criticalCount: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
      row({ userId: 'u1', scanId: 's2', attemptType: 'SECONDARY', qualityScore: 85, totalFindings: 2, architectureFindings: 0, performanceFindings: 1, accessibilityFindings: 0, criticalCount: 0, createdAt: '2026-01-03T00:00:00.000Z' }),
    ];
    const events: ResearchRemediationEventRow[] = [
      { participantId: 'P001', userId: 'u1', scanReportId: null, ruleId: 'FIGM-REACT-01', applied: true, createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    const result = buildBeforeAfterPairs(rows, events);
    assert.equal(result.pairs.length, 1);
    const pair = result.pairs[0];
    assert.equal(pair.issueReduction, 3);
    assert.equal(pair.qualityScoreChange, 25);
    assert.equal(pair.architectureReduction, 2);
    assert.equal(pair.qualifyingFixEventRuleIds, 'FIGM-REACT-01');
  });

  test('ignores a fix event that was never verified as applied', () => {
    const rows = [
      row({ userId: 'u1', scanId: 's1', attemptType: 'PRIMARY', createdAt: '2026-01-01T00:00:00.000Z' }),
      row({ userId: 'u1', scanId: 's2', attemptType: 'SECONDARY', createdAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const events: ResearchRemediationEventRow[] = [
      { participantId: 'P001', userId: 'u1', scanReportId: null, ruleId: 'FIGM-REACT-01', applied: false, createdAt: '2026-01-01T12:00:00.000Z' },
    ];
    const result = buildBeforeAfterPairs(rows, events);
    assert.equal(result.pairs.length, 0, 'an unverified (applied:false) fix event must never justify a before/after pair');
  });
});

describe('research-analysis-exporter: exclusions', () => {
  test('counts pre-consent scans, REVOKED, ASSIGNED, and out-of-range QA codes without touching real eligible rows', () => {
    const users: any[] = [
      { id: 'u1', participantCode: 'P001', researchStatus: 'CONSENT_VERIFIED', researchConsentVerifiedAt: '2026-01-05T00:00:00.000Z' },
      { id: 'u2', participantCode: 'P002', researchStatus: 'REVOKED' },
      { id: 'u3', participantCode: 'P003', researchStatus: 'ASSIGNED' },
      { id: 'u4', participantCode: 'P900001', researchStatus: 'CONSENT_VERIFIED', researchConsentVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const allScans = [
      { userId: 'u1', createdAt: '2026-01-01T00:00:00.000Z' }, // pre-consent
      { userId: 'u1', createdAt: '2026-01-06T00:00:00.000Z' }, // post-consent
    ];
    const datasetRows = [row({ userId: 'u1', attemptType: 'PRIMARY' })];
    const exclusions = computeExclusions(users, allScans, datasetRows);
    assert.equal(exclusions.preConsentScansExcluded, 1);
    assert.equal(exclusions.revokedParticipants, 1);
    assert.equal(exclusions.assignedNotYetVerifiedParticipants, 1);
    assert.equal(exclusions.qaOrOutOfRangeFixtureCodesExcludedByConstruction, 1);
  });
});

describe('research-analysis-exporter: CSV serialization', () => {
  test('escapes commas, quotes, and newlines correctly', () => {
    const csv = toCsv([{ a: 'has,comma', b: 'has"quote', c: 'line\nbreak' }], ['a', 'b', 'c']);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'a,b,c');
    assert.ok(lines[1].startsWith('"has,comma","has""quote"'));
  });
});
