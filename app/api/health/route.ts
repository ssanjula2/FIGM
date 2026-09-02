import { NextResponse } from 'next/server';
import { RepositoryFactory } from '../../../src/storage/repository-factory';
import { AIProviderSelector } from '../../../src/ai/ai-provider-selector';
import { OllamaClient } from '../../../src/ai/providers/ollama-provider';

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
  // Short-timeout (2s), configured-only probe -- see OllamaClient.checkHealth's doc comment. Never
  // attempted unless OLLAMA_BASE_URL/OLLAMA_MODEL is actually set, so this route stays instant (no
  // network call at all) on every deployment that doesn't use local Ollama.
  const ollamaHealth = await OllamaClient.checkHealth();

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
      // Layer 1 (AST/Angular-template/Vue deterministic fixers) is always ACTIVE regardless of
      // this -- only Layer 2 (the AI-assisted provider: Ollama, Claude, or Gemini, see
      // src/ai/ai-provider-selector.ts) is affected. There is no regex-based fallback layer for
      // this to degrade into; see src/ai/ai-remediation-pipeline.ts's header.
      aiRemediation: AIProviderSelector.isAnyProviderConfigured() ? 'ACTIVE' : 'DETERMINISTIC_ONLY',
      // Reports the LOCAL Ollama backend specifically (see src/ai/providers/ollama-provider.ts) --
      // distinct from the generic aiRemediation flag above, since "a provider is configured" and
      // "the local Ollama server/model is actually reachable right now" are different questions
      // (this deployment has reproduced a real local runtime failure: Ollama configured but the
      // model fails to load due to insufficient GPU/CPU memory -- MODEL_UNAVAILABLE surfaces
      // exactly that instead of a misleading generic ACTIVE).
      ollama: !ollamaHealth.configured
        ? 'NOT_CONFIGURED'
        : !ollamaHealth.reachable
          ? 'UNREACHABLE'
          : ollamaHealth.modelAvailable
            ? 'READY'
            : 'MODEL_UNAVAILABLE',
      dynamicProfiler: 'ACTIVE',
      database: provider.name === 'supabase' && isConnected ? 'CONNECTED_POSTGRES' : 'JSON_FILE_FALLBACK',
    },
  });
}
