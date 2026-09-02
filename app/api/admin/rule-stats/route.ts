import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { RuleAnalyticsRepository } from '../../../../src/engine/rule-analytics-repository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await RuleAnalyticsRepository.getSummary();
  return NextResponse.json(summary);
}
