import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // This endpoint backs the authenticated "My Workspace" developer dashboard (app/page.tsx) --
  // its only real consumer. A regular developer must only ever see their own projects/scans/
  // findings/quality-score aggregate here, never the platform-wide total (that belongs to the
  // ADMIN-only surface, e.g. /api/dashboard/frameworks and the Admin dashboard). `userId` is
  // always derived from the authenticated session server-side, never trusted from the client.
  const userId = auth.user.role === 'ADMIN' ? undefined : auth.user.userId;

  const summary = await DashboardRepository.getSummary(userId, auth.user.role);
  return NextResponse.json(summary);
}
