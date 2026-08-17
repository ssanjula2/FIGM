import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

// GET() never reads `request`, so Next.js treats this as static-eligible and executes it once
// at `next build` time, freezing whatever framework distribution existed on the build machine
// into the deployed output forever -- confirmed live: this route was actually baked into static
// JSON (marked "○ Static" in `npm run build`'s route summary) rather than served fresh per
// request, and a separate build attempt failed outright when the build-time DB connection
// dropped mid-prerender.
export const dynamic = 'force-dynamic';

export async function GET() {
  const summary = await DashboardRepository.getSummary();
  return NextResponse.json({
    frameworks: summary.frameworkDistribution,
  });
}
