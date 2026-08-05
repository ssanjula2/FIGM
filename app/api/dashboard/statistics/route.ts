import { NextResponse } from 'next/server';
import { DashboardRepository } from '../../../../src/engine/dashboard-repository';

export async function GET() {
  const summary = DashboardRepository.getSummary();
  return NextResponse.json({
    metrics: {
      overallHealth: summary.avgQualityScore,
      accessibilityScore: 92,
      performanceScore: 79,
      securityScore: 95,
      maintainabilityScore: 74,
      trends: {
        health: '+4.2%',
        accessibility: '+2.8%',
        performance: '-1.6%',
        security: '+1.1%',
        maintainability: '+5.4%',
      },
    },
  });
}
