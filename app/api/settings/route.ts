import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { UserRepository } from '../../../src/engine/user-repository';

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await UserRepository.getSettings(auth.user.userId);
  return NextResponse.json({ settings });
}

const ALLOWED_SETTINGS_FIELDS = ['theme', 'autoSave', 'autoScan', 'aiModel', 'exportFormat'] as const;

export async function PATCH(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user.userId;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_SETTINGS_FIELDS) {
      if (key in body) updates[key] = body[key];
    }
    const settings = await UserRepository.updateSettings(userId, updates);
    return NextResponse.json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
