import { NextResponse } from 'next/server';
import { RepositoryFactory } from '../../../src/storage/repository-factory';

export async function GET() {
  const provider = RepositoryFactory.getStorageProvider();
  const memory = process.memoryUsage();

  return NextResponse.json({
    status: 'HEALTHY',
    version: '3.0.0-saas',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    storageProvider: provider.name,
    environment: process.env.NODE_ENV || 'development',
    systemHealth: {
      memoryRssMb: parseFloat((memory.rss / (1024 * 1024)).toFixed(2)),
      memoryHeapTotalMb: parseFloat((memory.heapTotal / (1024 * 1024)).toFixed(2)),
      memoryHeapUsedMb: parseFloat((memory.heapUsed / (1024 * 1024)).toFixed(2)),
      nodeVersion: process.version,
    },
    services: {
      auth: 'ACTIVE',
      ruleEngine: 'ACTIVE',
      aiRemediation: 'ACTIVE',
      dynamicProfiler: 'ACTIVE',
      realtime: provider.name === 'supabase' ? 'CONNECTED' : 'DISCONNECTED_FALLBACK',
    },
  });
}
