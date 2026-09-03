import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  // This endpoint is intentionally public: it serves platform-wide aggregate counts (total
  // scans/projects, average quality score, framework distribution), not per-user data, for the
  // public dashboard showcase. `role` must never default to 'ADMIN' for an unauthenticated
  // caller though -- even though DashboardRepository.getSummary() doesn't currently branch on
  // it, defaulting an anonymous request to the highest-privilege role is an unsafe pattern that
  // would silently grant admin-level output the moment that parameter is ever wired up to
  // actually gate something.
  const role = auth.user?.role || 'DEVELOPER';

  // Retrieve global dashboard summary metrics across all users & projects
  const summary = await DashboardRepository.getSummary(undefined, role);
  return NextResponse.json(summary);
}
