import { NextResponse } from 'next/server';
import { UserDB } from '../../../src/auth/user-db';
import { ExportService } from '../../../src/engine/export-service';
import { NotificationRepository } from '../../../src/engine/notification-repository';
import { authenticateUser } from '../../../src/auth/auth-middleware';

export async function POST(request: Request) {
  try {
    const auth = authenticateUser(request);
    const userId = auth.user?.userId || 'usr_anonymous';

    const body = await request.json();
    const { scanId, format } = body;

    if (!scanId || !format) {
      return NextResponse.json(
        { error: 'scanId and format are required fields', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const record = UserDB.getScanRecordById(scanId);
    if (!record) {
      return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
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

    NotificationRepository.createNotification(
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
