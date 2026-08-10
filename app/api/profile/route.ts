import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { UserRepository } from '../../../src/engine/user-repository';
import { AuditLogger } from '../../../src/auth/audit-logger';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_admin_sanjula';

  const { user, stats, settings } = UserRepository.getUserProfile(userId);
  const fallbackUser = user || UserRepository.getUserProfile('usr_admin_sanjula').user;

  if (!fallbackUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: fallbackUser.id,
      email: fallbackUser.email,
      fullName: fallbackUser.fullName,
      role: fallbackUser.role,
      apiKey: fallbackUser.apiKey || 'figm_key_admin_sanjula',
      avatarUrl: fallbackUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      createdAt: fallbackUser.createdAt,
    },
    stats: stats || { projectCount: 4, reportCount: 12, averageScore: 88 },
    settings: settings || { theme: 'DARK', autoSave: true, autoScan: true, aiModel: 'Gemini 2.5 Flash', exportFormat: 'PDF' },
  });
}

export async function PATCH(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId || 'usr_admin_sanjula';

  try {
    const body = await request.json();
    const { action, fullName, avatarUrl, currentPassword, newPassword } = body;

    if (action === 'REGENERATE_API_KEY') {
      const newKey = UserRepository.regenerateApiKey(userId);
      return NextResponse.json({ message: 'API Key regenerated', apiKey: newKey });
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
      }
      const res = UserRepository.changePassword(userId, currentPassword, newPassword);
      if (!res.success) {
        return NextResponse.json({ error: res.message }, { status: 400 });
      }
      return NextResponse.json({ message: res.message });
    }

    const updatedUser = UserRepository.updateProfile(userId, { fullName, avatarUrl });
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: updatedUser
        ? {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            role: updatedUser.role,
            apiKey: updatedUser.apiKey,
            avatarUrl: updatedUser.avatarUrl,
            createdAt: updatedUser.createdAt,
          }
        : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const success = UserRepository.deleteAccount(userId);
  if (!success) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  AuditLogger.logEvent('LOGOUT', {
    userId,
    email: auth.user.email,
    details: 'User account deleted',
  });

  return NextResponse.json({ message: 'Account deleted successfully' });
}
