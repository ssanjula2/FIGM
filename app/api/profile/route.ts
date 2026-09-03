import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { UserRepository } from '../../../src/engine/user-repository';
import { AuditLogger } from '../../../src/auth/audit-logger';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user, stats, settings } = await UserRepository.getUserProfile(auth.user.userId);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      apiKey: user.apiKey,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    stats,
    settings,
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user.userId;

  try {
    const body = await request.json();
    const { action, fullName, avatarUrl, currentPassword, newPassword } = body;

    if (action === 'REGENERATE_API_KEY') {
      const newKey = await UserRepository.regenerateApiKey(userId);
      return NextResponse.json({ message: 'API Key regenerated', apiKey: newKey });
    }

    if (action === 'CHANGE_PASSWORD') {
      // Password changes are as sensitive as login attempts (an attacker with a stolen session
      // could try to brute-force currentPassword); throttle the same way login does. The audit
      // log entry both records the attempt and is what checkRateLimit's DB-backed path counts
      // against for subsequent requests from this IP.
      const ip = getClientIp(request);
      const rateLimitError = await checkRateLimit(ip, 10, 60000);
      if (rateLimitError) return rateLimitError;

      if (!currentPassword || !newPassword) {
        await AuditLogger.logEvent('RESET_PASSWORD', { userId, email: auth.user.email, ipAddress: ip, status: 'FAILURE', details: 'CHANGE_PASSWORD via /api/profile: missing fields' });
        return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
      }
      const res = await UserRepository.changePassword(userId, currentPassword, newPassword);
      await AuditLogger.logEvent('RESET_PASSWORD', {
        userId,
        email: auth.user.email,
        ipAddress: ip,
        status: res.success ? 'SUCCESS' : 'FAILURE',
        details: `CHANGE_PASSWORD via /api/profile: ${res.message}`,
      });
      if (!res.success) {
        return NextResponse.json({ error: res.message }, { status: 400 });
      }
      return NextResponse.json({ message: res.message });
    }

    const updatedUser = await UserRepository.updateProfile(userId, { fullName, avatarUrl });
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
            lastLoginAt: updatedUser.lastLoginAt,
          }
        : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateUser(request);
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user.userId;

  const success = await UserRepository.deleteAccount(userId);
  if (!success) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  // userId is deliberately omitted here (email is kept for traceability): AuditLog.userId is a
  // real foreign key to User (nullable, ON DELETE SET NULL -- see prisma/schema.prisma). That
  // cascade only rewrites rows that already existed at delete time; it does nothing for a NEW row
  // inserted afterward. Referencing the just-deleted userId here has no matching User to satisfy
  // the constraint, so on the real Postgres backend this INSERT always failed with a foreign-key
  // violation, turning a successful account deletion into a reported 500 (silently masked on the
  // JSON fallback backend, which doesn't enforce the constraint -- why the existing test suite,
  // which runs against JSON, never caught it). Confirmed live against Postgres.
  await AuditLogger.logEvent('LOGOUT', {
    email: auth.user.email,
    details: 'User account deleted',
  });

  return NextResponse.json({ message: 'Account deleted successfully' });
}
