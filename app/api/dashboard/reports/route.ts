import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Regular users see only their own recent reports; ADMIN can see across all users (undefined
  // userId). Never let an unauthenticated/failed-auth request fall through to undefined here --
  // getRecentReports treats a missing userId as "return every user's records."
  const userId = auth.user.role === 'ADMIN' ? undefined : auth.user.userId;

  const reports = await DashboardRepository.getRecentReports(userId, 10);
  return NextResponse.json({ reports });
}
