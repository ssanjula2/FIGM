import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { UserRepository } from '../../../src/engine/user-repository';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_anonymous';

  const settings = UserRepository.getSettings(userId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_anonymous';

  try {
    const body = await request.json();
    const settings = UserRepository.updateSettings(userId, body);
    return NextResponse.json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
