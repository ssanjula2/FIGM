import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { NotificationRepository } from '../../../src/engine/notification-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId;

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
  const pageSize = searchParams.has('pageSize') ? Number(searchParams.get('pageSize')) : 10;

  const result = ScanRepository.getScanRecords({
    userId: undefined,
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

  return NextResponse.json({
    records: result.records,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  });
}

export async function POST(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_anonymous';

  try {
    const body = await request.json();
    const {
      fileName,
      framework,
      scanTimeMs,
      memoryUsageMb,
      qualityScore,
      ruleCount,
      aiFixCount,
      diagnostics,
      projectId,
      repositoryUrl,
    } = body;

    const record = ScanRepository.createScanRecord({
      userId,
      projectId,
      fileName: fileName || 'Component.tsx',
      framework: framework || 'React',
      repositoryUrl: repositoryUrl || 'Local Repository',
      scanTimeMs: scanTimeMs || 0.34,
      memoryUsageMb: memoryUsageMb || 1.42,
      qualityScore: qualityScore !== undefined ? qualityScore : 85,
      ruleCount: ruleCount !== undefined ? ruleCount : 2,
      aiFixCount: aiFixCount !== undefined ? aiFixCount : 2,
      diagnostics: diagnostics || [],
      isFavorite: false,
    });

    // Create real notification
    NotificationRepository.createNotification(
      userId,
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
