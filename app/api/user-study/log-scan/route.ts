import { NextResponse } from 'next/server';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { AuditLogger } from '../../../../src/auth/audit-logger';
import { RuleExecutionEngine } from '../../../../src/engine/rule-execution-engine';
import { hashPassword } from '../../../../src/auth/auth-service';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';

// Participant ids must match the synthetic "P001"-style format this endpoint generates itself.
// Without this check, a caller could pass an existing real user's id as participantId and this
// route would attribute a fabricated benchmark scan record to that real account.
const PARTICIPANT_ID_PATTERN = /^P\d{3,6}$/;

/**
 * User-study participant scans are attributed to a synthetic identity ("P001", "P002", ...) rather
 * than a real authenticated account. ScanReport.userId is a required (non-null) foreign key to User,
 * so a matching User row must exist before a scan can be persisted for a given participant. Ensures
 * one exists (idempotent upsert-by-id) without ever touching an existing real user's data.
 */
async function ensureParticipantUser(provider: ReturnType<typeof RepositoryFactory.getStorageProvider>, participantId: string) {
  const existing = await provider.findUserById(participantId);
  if (existing) return;
  const email = `${participantId.toLowerCase()}@user-study.figm.local`;
  const byEmail = await provider.findUserByEmail(email);
  if (byEmail) return;
  await provider.createUser({
    id: participantId,
    email,
    passwordHash: hashPassword(`user-study-${participantId}-${Date.now()}`),
    fullName: `User Study Participant ${participantId}`,
    role: 'DEVELOPER',
  });
}

export async function GET() {
  try {
    const provider = RepositoryFactory.getStorageProvider();
    const existingScans = (await provider.getScanRecords()) || [];
    const uniqueParticipants = new Set(
      existingScans
        .filter((r) => r.userId.startsWith('P') && r.userId !== 'usr_user_study_participant')
        .map((r) => r.userId)
    );
    const count = uniqueParticipants.size + 1;
    const nextParticipantId = `P${String(count).padStart(3, '0')}`;
    return NextResponse.json({ nextParticipantId, totalParticipants: uniqueParticipants.size });
  } catch (err: any) {
    return NextResponse.json({ nextParticipantId: 'P001', totalParticipants: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const provider = RepositoryFactory.getStorageProvider();
    const body = await request.json();
    const { framework, fileName, code, participantId: clientParticipantId } = body;

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const rateLimitError = await checkRateLimit(ip, 30, 60000);
    if (rateLimitError) return rateLimitError;

    if (clientParticipantId && !PARTICIPANT_ID_PATTERN.test(clientParticipantId)) {
      return NextResponse.json({ error: 'Invalid participantId format' }, { status: 400 });
    }

    // This endpoint exists to record a REAL measurement of what FIGM found for a real
    // participant's benchmark task -- never trust a client-supplied score/count for that (a
    // previous version accepted qualityScore/diagnosticsCount straight from the request body,
    // and the caller sent hardcoded values for every single participant regardless of actual
    // results). The only thing worth persisting is derived from re-running the real analysis
    // engine here, server-side, on the actual submitted source.
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required to log a real scan result' }, { status: 400 });
    }

    const existingScans = (await provider.getScanRecords()) || [];
    const uniqueParticipants = new Set(
      existingScans
        .filter((r) => r.userId.startsWith('P') && r.userId !== 'usr_user_study_participant')
        .map((r) => r.userId)
    );
    const fallbackCount = uniqueParticipants.size + 1;
    const participantId = clientParticipantId || `P${String(fallbackCount).padStart(3, '0')}`;

    await ensureParticipantUser(provider, participantId);

    const analysis = RuleExecutionEngine.analyzeFile(fileName || 'BenchmarkFixture.tsx', code);
    const dynamicDiagnostics = (analysis.diagnostics || []).map((d) => ({
      ruleId: d.ruleId,
      ruleName: d.ruleName,
      domain: d.domain,
      concern: d.concern,
      severity: d.severity,
      filePath: fileName || 'BenchmarkFixture.tsx',
      location: d.location,
      offendingCodeSnippet: d.offendingCodeSnippet,
      remediation: d.remediation,
      standardReference: d.standardReference,
    }));
    const ruleCount = dynamicDiagnostics.length;

    // 1. Audit Log event for Admin Visibility
    await AuditLogger.logEvent('SCAN_RUN', {
      email: `${participantId.toLowerCase()}@user-study.figm`,
      ipAddress: ip,
      userAgent,
      status: 'SUCCESS',
      details: `User Study (${participantId}) benchmark scan executed on ${framework} (${fileName}) - ${ruleCount} issues detected`,
    });

    // 2. Persist scan record for Admin / History view (via the real storage provider)
    const newRecord = await provider.createScanRecord({
      userId: participantId,
      fileName: fileName || 'BenchmarkFixture.tsx',
      framework: framework || analysis.framework || 'React',
      qualityScore: analysis.qualityScore ?? 0,
      scanTimeMs: analysis.profile.executionTimeMs,
      memoryUsageMb: analysis.profile.peakMemoryMb,
      ruleCount,
      aiFixCount: 0,
      isFavorite: false,
      diagnostics: dynamicDiagnostics,
    });

    return NextResponse.json({ success: true, recordId: newRecord.id, participantId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to log study scan' }, { status: 500 });
  }
}
