import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const role = auth.user?.role || 'ADMIN';

  // Retrieve global dashboard summary metrics across all users & projects
  const summary = DashboardRepository.getSummary(undefined, role);
  return NextResponse.json(summary);
}
