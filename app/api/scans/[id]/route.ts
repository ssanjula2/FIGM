import { NextResponse } from 'next/server';
import { UserDB } from '../../../../src/auth/user-db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const record = UserDB.getScanRecordById(params.id);
  if (!record) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }
  return NextResponse.json({ record });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const record = UserDB.toggleFavoriteScan(params.id);
  if (!record) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }
  return NextResponse.json({ message: 'Toggled favorite status', record });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const success = UserDB.deleteScanRecord(params.id);
  if (!success) {
    return NextResponse.json({ error: 'Scan record not found' }, { status: 404 });
  }
  return NextResponse.json({ message: 'Scan record deleted successfully' });
}
