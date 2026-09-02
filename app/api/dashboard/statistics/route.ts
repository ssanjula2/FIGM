import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { calculateDomainScore } from '../../../../src/engine/quality-score';

// GET() never reads `request`, so Next.js treats this as static-eligible and executes it once
// at `next build` time, freezing whatever these scores looked like on the build machine into the
// deployed output forever -- confirmed live: this route was actually baked into static JSON
// (marked "○ Static" in `npm run build`'s route summary) rather than served fresh per request,
// and a separate build attempt failed outright when the build-time DB connection dropped
// mid-prerender.
export const dynamic = 'force-dynamic';

/**
 * This endpoint is intentionally public, like its dashboard/summary, dashboard/activity, and
 * dashboard/frameworks siblings: it serves platform-wide aggregate domain scores (not per-user or
 * per-scan records, no PII), so it does not require authentication.
 *
 * Only PERFORMANCE and ACCESSIBILITY exist as top-level scoring rule domains in the canonical 50-rule taxonomy
 * (confirmed in docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md) -- there is no rule domain for
 * "security" or "maintainability", so those cannot be honestly computed and are reported as null
 * rather than a fabricated number.
 */
export async function GET() {
  const summary = await DashboardRepository.getSummary();
  const provider = RepositoryFactory.getStorageProvider();
  const scans = (await provider.getScanRecords()) || [];

  return NextResponse.json({
    metrics: {
      overallHealth: summary.avgQualityScore,
      accessibilityScore: calculateDomainScore(scans, 'ACCESSIBILITY'),
      performanceScore: calculateDomainScore(scans, 'PERFORMANCE'),
      securityScore: null,
      maintainabilityScore: null,
      _scoreNote:
        'accessibilityScore/performanceScore are computed from real persisted scan diagnostics. ' +
        'securityScore/maintainabilityScore are null: no SECURITY or MAINTAINABILITY rule domain ' +
        'exists in the canonical 50-rule taxonomy (see docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md), ' +
        'so there is no real data to compute them from.',
      trends: null,
      _trendsNote: 'Trend deltas require historical time-series scoring, which is not yet implemented; previously this field held fabricated percentages and has been removed rather than left fake.',
    },
  });
}
