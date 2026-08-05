import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { UserRepository } from '../../../../src/engine/user-repository';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function GET(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = UserRepository.getAllUsers().map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    apiKey: u.apiKey,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, role, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (role) {
      UserRepository.updateUserRole(userId, role);
    }

    if (newPassword) {
      UserRepository.adminResetPassword(userId, newPassword);
    }

    AuditLogger.logEvent('REGISTER', {
      userId: auth.user.userId,
      email: auth.user.email,
      details: `Admin updated user ${userId} settings`,
    });

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Admin action failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const success = UserRepository.deleteAccount(userId);
  if (!success) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  AuditLogger.logEvent('LOGOUT', {
    userId: auth.user.userId,
    email: auth.user.email,
    details: `Admin deleted user ${userId}`,
  });

  return NextResponse.json({ message: 'User deleted successfully' });
}
