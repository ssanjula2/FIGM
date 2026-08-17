import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

// GET() never reads `request`, so Next.js treats this as static-eligible and executes it once
// at `next build` time, freezing whatever the activity feed looked like on the build machine
// into the deployed output forever (found via live black-box `npm run build` testing -- the
// sibling /api/dashboard/frameworks and /api/dashboard/statistics routes, same shape, were
// actually baked into static JSON this way).
export const dynamic = 'force-dynamic';

export async function GET() {
  const activity = await DashboardRepository.getActivityFeed(10);
  return NextResponse.json({ activity });
}
