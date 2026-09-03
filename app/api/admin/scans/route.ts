import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { ScanRepository } from '../../../../src/engine/scan-repository';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { DBUser } from '../../../../src/auth/user-db';

export const dynamic = 'force-dynamic';

const VALID_SORT_FIELDS = new Set(['createdAt', 'qualityScore', 'scanTimeMs', 'memoryUsageMb', 'ruleCount']);

/**
 * Global, ADMIN-only scan history -- distinct from GET /api/scans (user-scoped by default, and
 * only implicitly global for an ADMIN caller). This route exists so the admin UI can filter by a
 * specific participant/owner explicitly, and always enriches each record with the owner's real
 * identity (fullName/email), which the self-service history view has no reason to include.
 *
 * Authorization: ADMIN only, enforced by authorizeRole -- never falls back to "no filter means
 * every user's data" for a non-admin caller, because a non-admin caller never reaches this far.
 *
 * Stage 7D (Section 6): deliberately NOT filtered by engineering-test-account status, unlike the
 * public dashboard endpoints -- this route's entire purpose is admin visibility into every scan
 * including engineering-QA ones (it's how an admin identifies which accounts to clean up in the
 * first place), so excluding them here would be counterproductive.
 */
export async function GET(request: Request) {
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 25;
  const participantId = searchParams.get('participantId') || undefined;
  const framework = searchParams.get('framework') || undefined;
  const search = searchParams.get('search') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const sortByRaw = searchParams.get('sortBy');
  const sortBy = sortByRaw && VALID_SORT_FIELDS.has(sortByRaw) ? (sortByRaw as any) : 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // Explicit, ADMIN-gated global query: `userId` is left undefined (every user's records) unless
  // a specific participantId/owner filter was requested -- this is the pattern the brief asks
  // for (an explicit role-gated global mode), never an implicit `userId ? {userId} : {}` fallback
  // that could accidentally go global for a non-admin caller.
  const result = await ScanRepository.getScanRecords({
    userId: participantId,
    framework,
    search,
    from,
    to,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });

  // Enrich each record with the owner's real display identity. Small, bounded lookup set (one
  // getAllUsers() call, same pattern already used by /api/admin/users and /api/admin/system) --
  // not a per-record query.
  const allUsers = ((await RepositoryFactory.getStorageProvider().getAllUsers()) as DBUser[]) || [];
  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const records = result.records.map((r) => {
    const owner = usersById.get(r.userId);
    return {
      ...r,
      owner: owner
        ? { id: owner.id, fullName: owner.fullName, email: owner.email, role: owner.role }
        : { id: r.userId, fullName: r.userId, email: null, role: null },
    };
  });

  // Severity filter is applied post-fetch (the counts are stored as first-class columns, not part
  // of the WHERE-pushdown query builder yet) -- kept here rather than left unimplemented, but
  // documented: for a very large dataset this would need pushing into buildScanWhere instead.
  const severity = searchParams.get('severity');
  const filtered = severity
    ? records.filter((r) => {
        if (severity === 'CRITICAL') return r.criticalCount > 0;
        if (severity === 'HIGH') return r.highCount > 0;
        if (severity === 'MEDIUM') return r.mediumCount > 0;
        if (severity === 'LOW') return r.lowCount > 0;
        return true;
      })
    : records;

  return NextResponse.json({ ...result, records: filtered });
}
