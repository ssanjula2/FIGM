import { NextResponse } from 'next/server';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';
import { AIRemediationPipeline } from '../../../src/ai/ai-remediation-pipeline';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { authenticateUser } from '../../../src/auth/auth-middleware';

const MAX_CODE_LENGTH = 500000; // 500KB limit

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, fileName, action, defect } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code string is required' }, { status: 400 });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: 'Payload exceeds maximum limit of 500KB' }, { status: 413 });
    }

    const targetFile = fileName || 'Component.tsx';
    const scanResult = RuleExecutionEngine.analyzeFile(targetFile, code);

    // Handle AI Fix Request
    if (action === 'ai-fix' && defect) {
      const aiResult = await AIRemediationPipeline.remediateDefect(code, defect, scanResult.framework);
      return NextResponse.json(aiResult);
    }

    // Optional Authentication Context
    const auth = authenticateUser(request);
    const userId = auth.user ? auth.user.userId : 'usr_anonymous_guest';

    // Persist scan record under authenticated user or guest audit log
    if (auth.user) {
      try {
        // Use the SAME quality score already computed by RuleExecutionEngine and returned in the
        // live response below — a separately-recomputed formula here previously produced a
        // different number (a real, live-observed discrepancy: 74 in the live response vs. 88 in
        // the persisted history record for the same scan) purely because this route independently
        // reimplemented a cruder, differently-weighted formula instead of reusing the real one.
        await ScanRepository.createScanRecord({
          userId,
          fileName: targetFile,
          framework: scanResult.framework,
          qualityScore: scanResult.qualityScore ?? 0,
          scanTimeMs: scanResult.profile?.executionTimeMs || 0.12,
          memoryUsageMb: scanResult.profile?.peakMemoryMb || 0.45,
          ruleCount: scanResult.diagnostics.length,
          aiFixCount: 0,
          diagnostics: scanResult.diagnostics as any,
          isFavorite: false,
        });
      } catch (err) {
        // Non-fatal: the scan result is still returned to the caller even if persistence fails,
        // but the failure must be visible server-side rather than silently discarded.
        console.error('[api/scan] Failed to persist scan record:', err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json(scanResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Scan execution failed' }, { status: 500 });
  }
}

