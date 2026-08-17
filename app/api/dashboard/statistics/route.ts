import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';

// GET() never reads `request`, so Next.js treats this as static-eligible and executes it once
// at `next build` time, freezing whatever these scores looked like on the build machine into the
// deployed output forever -- confirmed live: this route was actually baked into static JSON
// (marked "○ Static" in `npm run build`'s route summary) rather than served fresh per request,
// and a separate build attempt failed outright when the build-time DB connection dropped
// mid-prerender.
export const dynamic = 'force-dynamic';

const SEVERITY_WEIGHT: Record<string, number> = { CRITICAL: 15, HIGH: 8, MEDIUM: 3, LOW: 1 };

/**
 * Computes a real per-domain health score from actual persisted scan diagnostics, using the same
 * weighted-penalty formula as the live scan quality score (src/engine/rule-execution-engine.ts).
 * Only PERFORMANCE and ACCESSIBILITY exist as real rule domains in the current 25-rule taxonomy
 * (confirmed in docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md) -- there is no rule domain for
 * "security" or "maintainability", so those cannot be honestly computed and are reported as null
 * rather than a fabricated number.
 */
function computeDomainScore(allDiagnostics: any[], domain: string): number | null {
  const domainDiags = allDiagnostics.filter((d) => d && d.domain === domain);
  if (allDiagnostics.length === 0) return null;
  const penalty = domainDiags.reduce((sum, d) => sum + (SEVERITY_WEIGHT[d.severity] || 0), 0);
  // Normalize against total diagnostic volume so the score isn't dominated by scan count.
  const scanCount = Math.max(1, allDiagnostics.length / Math.max(1, domainDiags.length || 1));
  return Math.max(0, Math.round(100 - penalty / scanCount));
}

export async function GET() {
  const summary = await DashboardRepository.getSummary();
  const provider = RepositoryFactory.getStorageProvider();
  const scans = (await provider.getScanRecords()) || [];
  const allDiagnostics = scans.flatMap((s) => (Array.isArray(s.diagnostics) ? s.diagnostics : []));

  return NextResponse.json({
    metrics: {
      overallHealth: summary.avgQualityScore,
      accessibilityScore: computeDomainScore(allDiagnostics, 'ACCESSIBILITY'),
      performanceScore: computeDomainScore(allDiagnostics, 'PERFORMANCE'),
      securityScore: null,
      maintainabilityScore: null,
      _scoreNote:
        'accessibilityScore/performanceScore are computed from real persisted scan diagnostics. ' +
        'securityScore/maintainabilityScore are null: no SECURITY or MAINTAINABILITY rule domain ' +
        'exists in the current 25-rule taxonomy (see docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md), ' +
        'so there is no real data to compute them from.',
      trends: null,
      _trendsNote: 'Trend deltas require historical time-series scoring, which is not yet implemented; previously this field held fabricated percentages and has been removed rather than left fake.',
    },
  });
}
