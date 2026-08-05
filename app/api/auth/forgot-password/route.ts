import { NextResponse } from 'next/server';
import { generateResetToken, validateEmail } from '../../../../src/auth/auth-service';
import { UserDB } from '../../../../src/auth/user-db';
import { checkRateLimit } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitError = checkRateLimit(ip, 5, 60000); // 5 requests per minute
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const { email } = body;

    if (!validateEmail(email)) {
      AuditLogger.logEvent('FORGOT_PASSWORD', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid email' });
      return NextResponse.json(
        { error: 'Please provide a valid email address', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    const user = UserDB.findUserByEmail(email);
    if (!user) {
      // Do not reveal whether user exists for security
      AuditLogger.logEvent('FORGOT_PASSWORD', { email, ipAddress: ip, userAgent, status: 'SUCCESS', details: 'User not found (masked)' });
      return NextResponse.json({
        message: 'If an account exists with that email address, a password reset token has been generated.',
      });
    }

    const { token, expiry } = generateResetToken();
    UserDB.updateUser(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });

    AuditLogger.logEvent('FORGOT_PASSWORD', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

    return NextResponse.json({
      message: 'Password reset token generated successfully',
      resetToken: token, // Provided for demonstration/testing
      expiresAt: expiry,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Forgot password request failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
