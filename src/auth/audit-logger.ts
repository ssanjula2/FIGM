import { DBAuditLog } from './user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export class AuditLogger {
  public static async logEvent(
    action: DBAuditLog['action'],
    options: {
      userId?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
      status?: 'SUCCESS' | 'FAILURE';
      details?: string;
    }
  ): Promise<DBAuditLog> {
    return RepositoryFactory.getStorageProvider().addAuditLog({
      action,
      userId: options.userId,
      email: options.email,
      ipAddress: options.ipAddress || '127.0.0.1',
      userAgent: options.userAgent || 'system',
      status: options.status || 'SUCCESS',
      details: options.details,
    }) as Promise<DBAuditLog>;
  }

  public static async getRecentLogs(limit = 100): Promise<DBAuditLog[]> {
    return RepositoryFactory.getStorageProvider().getAuditLogs(limit) as Promise<DBAuditLog[]>;
  }
}
