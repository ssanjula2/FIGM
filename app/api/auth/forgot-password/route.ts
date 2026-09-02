import { NextResponse } from 'next/server';
import { generateResetToken, validateEmail } from '../../../../src/auth/auth-service';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 5, 60000); // 5 requests per minute
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const provider = RepositoryFactory.getStorageProvider();

  try {
    const body = await request.json();
    const { email } = body;

    if (!validateEmail(email)) {
      await AuditLogger.logEvent('FORGOT_PASSWORD', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid email' });
      return NextResponse.json(
        { error: 'Please provide a valid email address', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    const user = await provider.findUserByEmail(email);
    if (!user) {
      // Do not reveal whether user exists for security
      await AuditLogger.logEvent('FORGOT_PASSWORD', { email, ipAddress: ip, userAgent, status: 'SUCCESS', details: 'User not found (masked)' });
      return NextResponse.json({
        message: 'If an account exists with that email address, a password reset token has been generated.',
      });
    }

    const { token, expiry } = generateResetToken();
    await provider.updateUser(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });

    await AuditLogger.logEvent('FORGOT_PASSWORD', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

    // The reset token must never be returned to the caller outside of automated tests -- this
    // endpoint has no way to know the caller is the account owner (that's the entire point of
    // emailing the token out-of-band instead). Returning it here would let anyone who submits a
    // victim's email obtain a valid reset token immediately, silently defeating the "don't reveal
    // whether the account exists" masking done above for the not-found case. Since this project
    // has no email-sending integration yet, the token is echoed back ONLY when both NODE_ENV=test
    // AND ALLOW_TEST_RESET_TOKEN=true are set, so it can never be enabled by accident in dev,
    // staging, or preview deployments; wiring up real email delivery is required before this flow
    // is safe to deploy with real users.
    const allowTestToken = process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_RESET_TOKEN === 'true';
    return NextResponse.json({
      message: allowTestToken
        ? 'Password reset token generated successfully'
        : 'If an account exists with that email address, a password reset link has been sent.',
      ...(allowTestToken ? { resetToken: token, _devOnly: 'resetToken is only included when NODE_ENV=test and ALLOW_TEST_RESET_TOKEN=true; see comment in forgot-password/route.ts' } : {}),
      expiresAt: expiry,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Forgot password request failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
