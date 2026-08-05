import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function GET(request: Request) {
  // Only ADMIN or AUDITOR roles can view audit logs
  const auth = authorizeRole(request, ['ADMIN', 'AUDITOR']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logs = AuditLogger.getRecentLogs(100);
  return NextResponse.json({
    logs,
    total: logs.length,
  });
}
