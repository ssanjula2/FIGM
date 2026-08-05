import { UserDB, DBAuditLog } from './user-db';

export class AuditLogger {
  public static logEvent(
    action: DBAuditLog['action'],
    options: {
      userId?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
      status?: 'SUCCESS' | 'FAILURE';
      details?: string;
    }
  ): DBAuditLog {
    return UserDB.addAuditLog({
      action,
      userId: options.userId,
      email: options.email,
      ipAddress: options.ipAddress || '127.0.0.1',
      userAgent: options.userAgent || 'system',
      status: options.status || 'SUCCESS',
      details: options.details,
    });
  }

  public static getRecentLogs(limit = 100): DBAuditLog[] {
    return UserDB.getAuditLogs(limit);
  }
}
