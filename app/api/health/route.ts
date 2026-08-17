import { NextResponse } from 'next/server';
import { RepositoryFactory } from '../../../src/storage/repository-factory';

// Reports live DB connectivity/uptime -- none of that exists yet at `next build` time. Without
// this, a route whose GET() never reads `request` is static-eligible by Next.js's own heuristic
// and gets executed once during the build and frozen into the output, silently reporting
// whatever the build machine's DB reachability/uptime happened to be forever after (found via
// live black-box `npm run build` testing: /api/dashboard/frameworks and /api/dashboard/statistics,
// which have the same no-request-param shape, were actually baked into static JSON this way).
export const dynamic = 'force-dynamic';

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
