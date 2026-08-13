import { NextResponse } from 'next/server';
import { hashPassword, validatePassword } from '../../../../src/auth/auth-service';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { checkRateLimit } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitError = await checkRateLimit(ip, 5, 60000);
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const provider = RepositoryFactory.getStorageProvider();

  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== 'string') {
      await AuditLogger.logEvent('RESET_PASSWORD', { ipAddress: ip, userAgent, status: 'FAILURE', details: 'Missing token' });
      return NextResponse.json(
        { error: 'Reset token is required', code: 'MISSING_TOKEN' },
        { status: 400 }
      );
    }

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      await AuditLogger.logEvent('RESET_PASSWORD', { ipAddress: ip, userAgent, status: 'FAILURE', details: passCheck.message });
      return NextResponse.json(
        { error: passCheck.message, code: 'WEAK_PASSWORD' },
        { status: 400 }
      );
    }

    const user = await provider.findUserByResetToken(token);
    if (!user) {
      await AuditLogger.logEvent('RESET_PASSWORD', { ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid or expired reset token' });
      return NextResponse.json(
        { error: 'Invalid or expired reset token', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(newPassword);
    await provider.updateUser(user.id, {
      passwordHash,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    await AuditLogger.logEvent('RESET_PASSWORD', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

    return NextResponse.json({
      message: 'Password reset successful. You may now log in with your new password.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Password reset failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
