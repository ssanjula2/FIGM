import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { ProjectRepository } from '../../../src/engine/project-repository';
import { NotificationRepository } from '../../../src/engine/notification-repository';
import { RuleExecutionEngine } from '../../../src/engine/rule-execution-engine';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

const MAX_CODE_LENGTH = 500000; // 500KB, matches /api/scan's limit
const MAX_PAGE_SIZE = 100;
const VALID_SORT_FIELDS = new Set(['createdAt', 'qualityScore', 'scanTimeMs', 'memoryUsageMb', 'ruleCount']);

/** Parses and validates a query-string integer parameter. Returns `undefined` if the parameter
 *  is absent, or an error message string if present but not a positive integer -- callers use the
 *  string/undefined distinction to short-circuit with a 400 rather than silently substituting a
 *  default for a malformed value a client actually sent. */
function parsePositiveInt(raw: string | null, label: string): { value?: number; error?: string } {
  if (raw === null) return {};
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { error: `${label} must be a positive integer` };
  }
  return { value: n };
}

function parseScore(raw: string | null, label: string): { value?: number; error?: string } {
  if (raw === null) return {};
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { error: `${label} must be a number between 0 and 100` };
  }
  return { value: n };
}

function parseDate(raw: string | null, label: string): { value?: string; error?: string } {
  if (raw === null) return {};
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) {
    return { error: `${label} must be a valid ISO-8601 date` };
  }
  return { value: raw };
}

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = parsePositiveInt(searchParams.get('page'), 'page');
  const pageSize = parsePositiveInt(searchParams.get('pageSize') ?? searchParams.get('limit'), 'pageSize/limit');
  const minScore = parseScore(searchParams.get('minScore'), 'minScore');
  const maxScore = parseScore(searchParams.get('maxScore'), 'maxScore');
  const from = parseDate(searchParams.get('from'), 'from');
  const to = parseDate(searchParams.get('to'), 'to');

  const firstError = page.error || pageSize.error || minScore.error || maxScore.error || from.error || to.error;
  if (firstError) {
    return NextResponse.json({ error: firstError, code: 'INVALID_QUERY_PARAM' }, { status: 400 });
  }

  if (pageSize.value !== undefined && pageSize.value > MAX_PAGE_SIZE) {
    return NextResponse.json(
      { error: `pageSize/limit must not exceed ${MAX_PAGE_SIZE}`, code: 'INVALID_QUERY_PARAM' },
      { status: 400 }
    );
  }

  const sortByRaw = searchParams.get('sortBy');
  if (sortByRaw && !VALID_SORT_FIELDS.has(sortByRaw)) {
    return NextResponse.json(
      { error: `sortBy must be one of: ${[...VALID_SORT_FIELDS].join(', ')}`, code: 'INVALID_QUERY_PARAM' },
      { status: 400 }
    );
  }

  const sortOrderRaw = searchParams.get('sortOrder');
  if (sortOrderRaw && sortOrderRaw !== 'asc' && sortOrderRaw !== 'desc') {
    return NextResponse.json({ error: 'sortOrder must be "asc" or "desc"', code: 'INVALID_QUERY_PARAM' }, { status: 400 });
  }

  const projectId = searchParams.get('projectId') || undefined;
  const search = searchParams.get('search') || undefined;
  const framework = searchParams.get('framework') || undefined;
  const onlyFavorites = searchParams.get('onlyFavorites') === 'true';
  const sortBy = (sortByRaw as any) || undefined;
  const sortOrder = (sortOrderRaw as any) || undefined;

  // Regular users see only their own scans; ADMIN can see across all users.
  const userId = auth.user.role === 'ADMIN' ? undefined : auth.user.userId;

  const result = await ScanRepository.getScanRecords({
    userId,
    projectId,
    search,
    framework,
    minScore: minScore.value,
    maxScore: maxScore.value,
    onlyFavorites,
    from: from.value,
    to: to.value,
    sortBy,
    sortOrder,
    page: page.value,
    pageSize: pageSize.value,
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

    // participantId/qualityScore/diagnostics/ruleCount/aiFixCount/severity counts are deliberately
    // NOT read from the request body at all -- there is no "trusted" client-supplied override for
    // any of them.
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: 'Payload exceeds maximum limit of 500KB' }, { status: 413 });
    }

    const targetFile = fileName || 'Component.tsx';
    // Async variant: this route serves concurrent multi-user traffic -- see
    // RuleExecutionEngine.analyzeFileAsync's doc comment.
    const analysis = await RuleExecutionEngine.analyzeFileAsync(targetFile, code);

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
      // criticalCount/highCount/mediumCount/lowCount are deliberately not set here -- ScanRepository
      // .createScanRecord always derives them server-side from `diagnostics` (see ScanRecordInput's
      // doc comment), so there is no separate step here to keep in sync.
      aiFixCount: 0,
      diagnostics: analysis.diagnostics as any,
      isFavorite: false,
    });

    // The scan record above is already durably persisted -- a failure creating its companion
    // notification is a separate, non-essential write and must not turn an already-successful
    // save into an HTTP 500. Un-guarded, that previously made the client believe the whole
    // request failed (and, per this codebase's retry-on-failure conventions, could trigger a
    // client retry that creates a second, duplicate scan record for the same real scan).
    try {
      await NotificationRepository.createNotification(
        auth.user.userId,
        'SCAN_SUCCESS',
        'Scan Completed',
        `Scanned ${record.fileName} — Quality Score: ${record.qualityScore}%`
      );
    } catch (err) {
      console.error('[api/scans] Scan record saved, but failed to create its notification:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      message: 'Scan record saved successfully',
      record,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save scan record';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
