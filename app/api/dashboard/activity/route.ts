import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET() {
  const activity = await DashboardRepository.getActivityFeed(10);
  return NextResponse.json({ activity });
}
