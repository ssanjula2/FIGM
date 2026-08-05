import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET() {
  const summary = DashboardRepository.getSummary();
  return NextResponse.json({
    frameworks: summary.frameworkDistribution,
  });
}
