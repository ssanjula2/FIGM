import { NextResponse } from 'next/server';
import { RepositoryFactory } from '../../../src/storage/repository-factory';

export async function GET() {
  const provider = RepositoryFactory.getStorageProvider();
  const isConnected = typeof (provider as any).isConnected === 'function' ? (provider as any).isConnected() : true;
  const memory = process.memoryUsage();

  return NextResponse.json({
    status: 'HEALTHY',
    version: '3.0.0-figm-inspector',
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
      aiRemediation: process.env.GEMINI_API_KEY ? 'ACTIVE' : 'TEMPLATE_FALLBACK_ONLY',
      dynamicProfiler: 'ACTIVE',
      database: provider.name === 'supabase' && isConnected ? 'CONNECTED_POSTGRES' : 'JSON_FILE_FALLBACK',
    },
  });
}
