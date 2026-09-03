import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import fs from 'node:fs';
import path from 'node:path';

export async function GET(request: Request) {
  const auth = await authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = RepositoryFactory.getStorageProvider();
  const isConnected = typeof (provider as any).isConnected === 'function' ? (provider as any).isConnected() : provider.name !== 'supabase';

  const queryStart = process.hrtime.bigint();
  const users = (await provider.getAllUsers()) || [];
  const projects = (await provider.getProjects()) || [];
  const scans = (await provider.getScanRecords()) || [];
  const auditLogs = (await provider.getAuditLogs(100)) || [];
  const measuredQueryMs = Number(process.hrtime.bigint() - queryStart) / 1_000_000;

  const dbFile = path.resolve(process.cwd(), 'figm-user-db.json');
  let storageSizeBytes = 0;
  if (fs.existsSync(dbFile)) {
    storageSizeBytes = fs.statSync(dbFile).size;
  }

  const databaseStatistics = {
    providerName: provider.name,
    connected: isConnected,
    totalUsers: users.length,
    totalProjects: projects.length,
    totalScanReports: scans.length,
    totalAuditLogs: auditLogs.length,
    // Measured from the 4 queries executed above (getAllUsers/getProjects/getScanRecords/getAuditLogs), not a canned constant.
    lastQueryBatchMs: Number(measuredQueryMs.toFixed(2)),
  };

  const storageUsage = {
    storageSizeBytes,
    storageSizeFormatted: `${(storageSizeBytes / 1024).toFixed(2)} KB`,
    storageProvider: provider.name === 'supabase' && isConnected ? 'Postgres (Supabase-hosted, via Prisma)' : 'Local JSON file (figm-user-db.json)',
  };

  const migrationStatus = {
    schemaVersion: '3.0.0-supabase',
    status: isConnected ? 'CONNECTED' : 'NOT_CONNECTED_USING_JSON_FALLBACK',
  };

  const systemHealth = {
    status: 'HEALTHY',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
  };

  return NextResponse.json({
    systemHealth,
    databaseStatistics,
    storageUsage,
    migrationStatus,
    usageStats: {
      totalUsers: users.length,
      totalProjects: projects.length,
      totalScans: scans.length,
      storageSizeBytes,
      storageSizeFormatted: `${(storageSizeBytes / 1024).toFixed(2)} KB`,
    },
    auditLogs,
  });
}
