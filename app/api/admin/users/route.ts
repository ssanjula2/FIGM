import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { UserRepository } from '../../../../src/engine/user-repository';
import { AuditLogger } from '../../../../src/auth/audit-logger';

const ALLOWED_ROLES = new Set(['ADMIN', 'AUDITOR', 'DEVELOPER']);

/** SEC-08: an admin listing every OTHER user's API key in plaintext broadens the blast radius of
 *  any single admin-account compromise to every user's key at once. A user views their OWN key in
 *  full via GET /api/profile (a different, self-service-only route this doesn't touch) -- admins
 *  only need enough of the key to identify/confirm it, e.g. when a user reports "my key doesn't
 *  work," not the ability to read/reuse it themselves. */
function maskApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return '*'.repeat(apiKey.length);
  return `${'*'.repeat(apiKey.length - 4)}${apiKey.slice(-4)}`;
}

export async function GET(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allUsers = await UserRepository.getAllUsers();
  const users = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    apiKey: maskApiKey(u.apiKey),
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || u.createdAt,
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, role, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Explicit application-layer validation, not just the Postgres enum constraint the live DB
    // happens to have -- the JSON-fallback storage provider has no equivalent DB-level constraint
    // at all, and relying only on the DB meant a garbage value here previously surfaced as an
    // opaque 500 (Postgres) or was silently persisted (JSON) rather than a clear 400.
    if (role !== undefined && !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: `role must be one of: ${[...ALLOWED_ROLES].join(', ')}` }, { status: 400 });
    }

    if (role) {
      await UserRepository.updateUserRole(userId, role);
    }

    if (newPassword) {
      const resetResult = await UserRepository.adminResetPassword(userId, newPassword);
      if (!resetResult.success) {
        return NextResponse.json({ error: resetResult.message, code: 'WEAK_PASSWORD' }, { status: 400 });
      }
    }

    await AuditLogger.logEvent('RESET_PASSWORD', {
      userId: auth.user.userId,
      email: auth.user.email,
      details: `Admin updated user ${userId} settings (role: ${role ?? 'unchanged'}, password: ${newPassword ? 'reset' : 'unchanged'})`,
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
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const success = await UserRepository.deleteAccount(userId);
  if (!success) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await AuditLogger.logEvent('LOGOUT', {
    userId: auth.user.userId,
    email: auth.user.email,
    details: `Admin deleted user ${userId}`,
  });

  return NextResponse.json({ message: 'User deleted successfully' });
}
