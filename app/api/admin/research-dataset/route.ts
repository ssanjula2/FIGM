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
 * `?format=csv` returns a downloadable CSV for the admin export action; the default (or
 * `?format=json`) returns the raw JSON rows.
 */
export async function GET(request: Request) {
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await ParticipantRepository.getResearchDataset();
  const primaryCount = ParticipantRepository.filterPrimaryResearchAttempts(rows).length;
  const secondaryCount = ParticipantRepository.filterSecondaryResearchAttempts(rows).length;

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
    ];
    const csvEscape = (value: unknown) => {
      const s = String(value ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      columns.join(','),
      ...rows.map((row) => columns.map((c) => csvEscape(row[c])).join(',')),
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
    rows,
  });
}
