import { NextResponse } from 'next/server';
import {
  verifyPassword,
  hashPassword,
  needsRehash,
  signJWT,
  signRefreshToken,
  validateEmail,
} from '../../../../src/auth/auth-service';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

// A fixed, syntactically-valid scrypt hash that no real password will ever match (its salt/hash
// bytes are arbitrary crypto.randomBytes output, not derived from anything). Used only to make
// verifyPassword() run the SAME expensive scrypt computation for an unknown email that it would
// for a real one, so the two cases take roughly the same time -- otherwise an unknown-email
// request returns near-instantly while a known-email request pays the full scrypt cost, letting
// an attacker enumerate valid account emails purely from response latency.
const DUMMY_PASSWORD_HASH =
  'scrypt:dd8f25bbca7e495d7c5efb2f7c5a4f3a:11529b64557fb0415a1c9c9a2ef94d7779b54be69453340c6fc03d2a22966db73015eb5022a56bfe4921b99b012ba78a2002d0d7b07985cf53726dcd47ddaf27';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 10, 60000);
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const provider = RepositoryFactory.getStorageProvider();

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!validateEmail(email) || !password) {
      await AuditLogger.logEvent('LOGIN', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Missing or invalid fields' });
      return NextResponse.json(
        { error: 'Valid email and password are required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const user = await provider.findUserByEmail(email);
    if (!user) {
      // Perform the same expensive scrypt computation a real login attempt would pay for, against
      // a fixed dummy hash that can never match, before returning the identical generic error --
      // this keeps an unknown-email response from completing conspicuously faster than a
      // known-email/wrong-password one, which would otherwise let an attacker enumerate valid
      // account emails purely from response timing.
      verifyPassword(password, DUMMY_PASSWORD_HASH);
      await AuditLogger.logEvent('LOGIN', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'User not found' });
      return NextResponse.json(
        { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      await AuditLogger.logEvent('LOGIN', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Password mismatch' });
      return NextResponse.json(
        { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role || 'DEVELOPER',
    };

    const accessToken = signJWT(payload, 3600); // 1 hr
    const refreshToken = signRefreshToken(payload, 604800); // 7 days

    // SEC-06: transparently upgrade a legacy PBKDF2 hash to scrypt now that the real plaintext
    // password (just verified above) is available -- no forced reset, no destroyed accounts. A
    // no-op for every user who has already logged in once since this migration shipped.
    const rehashedPassword = needsRehash(user.passwordHash) ? hashPassword(password) : undefined;

    await provider.updateUser(user.id, {
      refreshToken,
      lastLoginAt: new Date().toISOString(),
      ...(rehashedPassword ? { passwordHash: rehashedPassword } : {}),
    });

    await AuditLogger.logEvent('LOGIN', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

    const response = NextResponse.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: payload,
    });

    response.cookies.set('figm_token', accessToken, {
      httpOnly: true,
      path: '/',
      maxAge: 3600,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    response.cookies.set('figm_refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      maxAge: 604800,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
