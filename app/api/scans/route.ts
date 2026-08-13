import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { ProjectRepository } from '../../../src/engine/project-repository';
import { NotificationRepository } from '../../../src/engine/notification-repository';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

const MAX_CODE_LENGTH = 500000; // 500KB, matches /api/scan's limit

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || undefined;
  const search = searchParams.get('search') || undefined;
  const framework = searchParams.get('framework') || undefined;
  const minScore = searchParams.has('minScore') ? Number(searchParams.get('minScore')) : undefined;
  const maxScore = searchParams.has('maxScore') ? Number(searchParams.get('maxScore')) : undefined;
  const onlyFavorites = searchParams.get('onlyFavorites') === 'true';
  const sortBy = (searchParams.get('sortBy') as any) || undefined;
  const sortOrder = (searchParams.get('sortOrder') as any) || undefined;
  const page = searchParams.has('page') ? Number(searchParams.get('page')) : 1;
  const pageSize = searchParams.has('pageSize') ? Number(searchParams.get('pageSize')) : 100;

  // Regular users see only their own scans; ADMIN can see across all users.
  const userId = auth.user.role === 'ADMIN' ? undefined : auth.user.userId;

  const result = await ScanRepository.getScanRecords({
    userId,
    projectId,
    search,
    framework,
    minScore,
    maxScore,
    onlyFavorites,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  // This endpoint persists a durable scan record attributed to a real user account -- unlike
  // /api/scan (which allows an anonymous guest preview), it requires authentication so a record
  // always has a real, verifiable owner. A prior version accepted an unauthenticated caller,
  // trusted a client-supplied `participantId` as the record's userId (letting anyone attribute a
  // forged scan to any known account id), and trusted client-supplied qualityScore/diagnostics
  // verbatim (letting anyone forge arbitrary results into their own history).
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 60, 60000);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { code, fileName, framework, projectId, repositoryUrl } = body;

    // participantId/qualityScore/diagnostics/ruleCount/aiFixCount are deliberately NOT read from
    // the request body at all -- there is no "trusted" client-supplied override for any of them.
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: 'Payload exceeds maximum limit of 500KB' }, { status: 413 });
    }

    const targetFile = fileName || 'Component.tsx';
    const analysis = RuleExecutionEngine.analyzeFile(targetFile, code);

    // A caller-supplied projectId is only honored if the authenticated user actually owns that
    // project (or is ADMIN) -- otherwise a scan could be linked into another user's project,
    // inflating that project's totalScans/qualityScore with data the attacker controls.
    let ownedProjectId: string | undefined;
    if (projectId && typeof projectId === 'string') {
      const project = await ProjectRepository.getProjectById(projectId);
      if (project && (project.userId === auth.user.userId || auth.user.role === 'ADMIN')) {
        ownedProjectId = projectId;
      }
    }

    const record = await ScanRepository.createScanRecord({
      userId: auth.user.userId,
      projectId: ownedProjectId,
      fileName: targetFile,
      framework: framework || analysis.framework || 'React',
      repositoryUrl: repositoryUrl || 'Local Repository',
      scanTimeMs: analysis.profile?.executionTimeMs || 0,
      memoryUsageMb: analysis.profile?.peakMemoryMb || 0,
      // Server-derived, not client-supplied: this is the entire point of the fix.
      qualityScore: analysis.qualityScore ?? 0,
      ruleCount: analysis.diagnostics.length,
      aiFixCount: 0,
      diagnostics: analysis.diagnostics as any,
      isFavorite: false,
    });

    await NotificationRepository.createNotification(
      auth.user.userId,
      'SCAN_SUCCESS',
      'Scan Completed',
      `Scanned ${record.fileName} — Quality Score: ${record.qualityScore}%`
    );

    return NextResponse.json({
      message: 'Scan record saved successfully',
      record,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save scan record';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
