import { NextResponse } from 'next/server';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { ExportService } from '../../../src/engine/export-service';
import { NotificationRepository } from '../../../src/engine/notification-repository';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

export async function POST(request: Request) {
  try {
    const auth = authenticateUser(request);
    if (auth.errorResponse || !auth.user) {
      return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = auth.user.userId;

    // Every request generates real report content (PDF/CSV/Markdown/JSON) and writes a
    // notification row -- an authenticated account could otherwise hammer this to force
    // unlimited generation + DB writes. Same checkRateLimit/getClientIp pattern used by every
    // other write-triggering auth route in this codebase (see export-dissertation, 5/min).
    const rateLimitError = await checkRateLimit(getClientIp(request), 10, 60000);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const { scanId, format } = body;

    if (!scanId || !format) {
      return NextResponse.json(
        { error: 'scanId and format are required fields', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const record = await ScanRepository.getScanRecordById(scanId);
    if (!record) {
      return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
    }

    if (auth.user.role !== 'ADMIN' && record.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this scan record' }, { status: 403 });
    }

    const requestedFormat = (format || 'JSON').toUpperCase();
    let content = '';
    let contentType = 'application/json';
    let ext = 'json';

    if (requestedFormat === 'PDF') {
      content = ExportService.exportPDF(record);
      contentType = 'text/html';
      ext = 'html';
    } else if (requestedFormat === 'JSON') {
      content = ExportService.exportJSON(record);
      contentType = 'application/json';
      ext = 'json';
    } else if (requestedFormat === 'CSV') {
      content = ExportService.exportCSV(record);
      contentType = 'text/csv';
      ext = 'csv';
    } else if (requestedFormat === 'MARKDOWN' || requestedFormat === 'MD') {
      content = ExportService.exportMarkdown(record);
      contentType = 'text/markdown';
      ext = 'md';
    } else {
      content = ExportService.exportJSON(record);
    }

    await NotificationRepository.createNotification(
      userId,
      'EXPORT_FINISHED',
      'Export Ready',
      `Report for ${record.fileName} exported as ${requestedFormat}`
    );

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="figm-report-${record.id}.${ext}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
