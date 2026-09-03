import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

// GET() never reads `request`, so Next.js treats this as static-eligible and executes it once
// at `next build` time, freezing whatever the activity feed looked like on the build machine
// into the deployed output forever (found via live black-box `npm run build` testing -- the
// sibling /api/dashboard/frameworks and /api/dashboard/statistics routes, same shape, were
// actually baked into static JSON this way).
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Same scoping rule as /api/dashboard/reports: a regular developer only ever sees their own
  // activity (own scans, own login/register/logout events) -- never another user's, and never the
  // platform-wide feed. ADMIN gets the undefined/global feed.
  const userId = auth.user.role === 'ADMIN' ? undefined : auth.user.userId;

  const activity = await DashboardRepository.getActivityFeed(10, userId);
  return NextResponse.json({ activity });
}
