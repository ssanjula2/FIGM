import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { ParticipantRepository } from '../../../../src/engine/participant-repository';

export const dynamic = 'force-dynamic';

/**
 * ADMIN-only. The one HTTP-reachable export of ParticipantRepository.getResearchDataset() --
 * previously that method existed, was fully correct and tested, but had no live caller anywhere
 * (see docs/audit/CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md's item 9 finding). This route is a
 * thin pass-through: it never re-derives or duplicates the eligibility rule
 * (isRealStudyParticipantCode + CONSENT_VERIFIED + post-consent-timestamp + REVOKED exclusion)
 * that method already enforces -- see its own doc comment in
 * src/engine/participant-repository.ts for the full rule.
 *
 * Also includes ParticipantRepository.getHistoricalRealParticipantScans() -- real, already-
 * persisted scans belonging to real study participants (P001-P020) who are not yet (or not
 * currently) consent-gate-eligible. These are a SEPARATE provenance lane (`dataSource` column),
 * never assigned PRIMARY/SECONDARY (`attemptType: 'HISTORICAL_REAL'` only), and never affect the
 * consent-gated rows' own eligibility, ordering, or PRIMARY/SECONDARY classification in any way --
 * see that method's own doc comment for the exact (complementary, REVOKED-excluded) inclusion
 * rule. Historical rows are listed first, consent-gated rows after, matching the order real
 * historical activity was recorded relative to when consent-gated collection began.
 *
 * `?format=csv` returns a downloadable CSV for the admin export action; the default (or
 * `?format=json`) returns the raw JSON rows.
 */
export async function GET(request: Request) {
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consentGatedRows = await ParticipantRepository.getResearchDataset();
  const historicalRows = await ParticipantRepository.getHistoricalRealParticipantScans();
  const primaryCount = ParticipantRepository.filterPrimaryResearchAttempts(consentGatedRows).length;
  const secondaryCount = ParticipantRepository.filterSecondaryResearchAttempts(consentGatedRows).length;

  // Unified row shape for export: every consent-gated row also gets a `dataSource` column (never
  // blank) so a downloaded CSV/JSON consumer can always tell the two provenances apart, without
  // ever touching consent-gated rows' own attemptType (PRIMARY/SECONDARY untouched, unrelabeled).
  const rows = [
    ...historicalRows,
    ...consentGatedRows.map((r) => ({ ...r, dataSource: 'CONSENT_GATED_RESEARCH_DATASET' as const })),
  ];

  const { searchParams } = new URL(request.url);
  if (searchParams.get('format') === 'csv') {
    const columns: Array<keyof (typeof rows)[number]> = [
      'participantId',
      'fileName',
      'framework',
      'attemptType',
      'createdAt',
      'qualityScore',
      'totalFindings',
      'architectureFindings',
      'performanceFindings',
      'accessibilityFindings',
      'scanTimeMs',
      'dataSource',
    ];
    const csvEscape = (value: unknown) => {
      const s = String(value ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      columns.join(','),
      ...rows.map((row) => columns.map((c) => csvEscape((row as any)[c])).join(',')),
    ];
    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="figm-research-dataset-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    primaryCount,
    secondaryCount,
    historicalRealCount: historicalRows.length,
    rows,
  });
}
