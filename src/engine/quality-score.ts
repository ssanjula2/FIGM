/**
 * Framework-Independent Guideline Model (FIGM)
 * Canonical Quality Score Calculation
 *
 * Single source of truth for the weighted-severity quality score. Before this module existed,
 * the same formula was independently duplicated in rule-execution-engine.ts, report-generator.ts,
 * and figm-analyze.ts (all three coincidentally identical), while app/api/scan/route.ts computed
 * a genuinely different, cruder formula purely for database persistence — causing the live scan
 * response and the persisted scan-history record for the SAME scan to report different quality
 * scores (74 vs 88 for a real example, found via live production testing). Every caller must use
 * this function so the live scan, database persistence, history, reports, dashboard, and export
 * paths can never disagree again.
 */

import { DiagnosticReport } from '../types/ast-spec.js';

export interface SeverityCounts {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/** V(G)-style weighted penalty: CRITICAL=15, HIGH=8, MEDIUM=3, LOW=1, floored at 0. */
export function calculateQualityScoreFromCounts(counts: SeverityCounts): number {
  const weightedPenalty = counts.criticalCount * 15 + counts.highCount * 8 + counts.mediumCount * 3 + counts.lowCount * 1;
  return Math.max(0, 100 - weightedPenalty);
}

export function severityCountsFromDiagnostics(diagnostics: Array<Pick<DiagnosticReport, 'severity'>>): SeverityCounts {
  return {
    criticalCount: diagnostics.filter((d) => d.severity === 'CRITICAL').length,
    highCount: diagnostics.filter((d) => d.severity === 'HIGH').length,
    mediumCount: diagnostics.filter((d) => d.severity === 'MEDIUM').length,
    lowCount: diagnostics.filter((d) => d.severity === 'LOW').length,
  };
}

export function calculateQualityScore(diagnostics: Array<Pick<DiagnosticReport, 'severity'>>): number {
  return calculateQualityScoreFromCounts(severityCountsFromDiagnostics(diagnostics));
}
