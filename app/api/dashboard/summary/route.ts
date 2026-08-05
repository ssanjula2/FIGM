import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId;
  const role = auth.user?.role || 'DEVELOPER';

  const summary = DashboardRepository.getSummary(userId, role);
  return NextResponse.json(summary);
}
