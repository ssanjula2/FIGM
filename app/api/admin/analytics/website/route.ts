import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../../src/auth/auth-middleware';
import { getGA4AdminReportingStatus } from '../../../../../src/lib/ga4-admin-reporting';

/**
 * Backs the Admin "Website Analytics (GA4)" panel -- deliberately separate from
 * /api/dashboard/summary and the other Product Analytics endpoints (Supabase/Postgres is the
 * canonical source for those; this endpoint is GA4-only and must never be merged with them). See
 * src/lib/ga4-admin-reporting.ts for why a configured client Measurement ID alone does not mean
 * admin reporting is available.
 */
export async function GET(request: Request) {
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = getGA4AdminReportingStatus();
  return NextResponse.json(status);
}
