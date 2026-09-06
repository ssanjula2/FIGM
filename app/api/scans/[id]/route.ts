import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { ScanRepository } from '../../../../src/engine/scan-repository';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const record = await ScanRepository.getScanRecordById(params.id);
  if (!record) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && record.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this scan record' }, { status: 403 });
  }

  return NextResponse.json({ record });
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await ScanRepository.getScanRecordById(params.id);
  if (!existing) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this scan record' }, { status: 403 });
  }

  const record = await ScanRepository.toggleFavorite(params.id);
  if (!record) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }
  return NextResponse.json({ message: 'Toggled favorite status', record });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await ScanRepository.getScanRecordById(params.id);
  if (!existing) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && existing.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this scan record' }, { status: 403 });
  }

  const success = await ScanRepository.deleteScanRecord(params.id);
  if (!success) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }
  return NextResponse.json({ message: 'Scan record deleted successfully' });
}
