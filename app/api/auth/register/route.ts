import { NextResponse } from 'next/server';
import {
  hashPassword,
  signJWT,
  signRefreshToken,
  validateEmail,
  validatePassword,
  validateRole,
} from '../../../../src/auth/auth-service';
import { UserDB } from '../../../../src/auth/user-db';
import { checkRateLimit } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitError = checkRateLimit(ip, 10, 60000);
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();
    const { email, password, fullName, role } = body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid full name' });
      return NextResponse.json({ error: 'Full name must be at least 2 characters long', code: 'INVALID_NAME' }, { status: 400 });
    }

    if (!validateEmail(email)) {
      AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid email format' });
      return NextResponse.json({ error: 'Please provide a valid email address', code: 'INVALID_EMAIL' }, { status: 400 });
    }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: passCheck.message });
      return NextResponse.json({ error: passCheck.message, code: 'WEAK_PASSWORD' }, { status: 400 });
    }

    const existing = UserDB.findUserByEmail(email);
    if (existing) {
      AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Email already registered' });
      return NextResponse.json({ error: 'An account with this email address already exists', code: 'EMAIL_EXISTS' }, { status: 409 });
    }

    const assignedRole = validateRole(role);
    const passwordHash = hashPassword(password);
    const user = await UserDB.createUserAsync({ email, passwordHash, fullName, role: assignedRole });

    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const accessToken = signJWT(payload, 3600); // 1 hour
    const refreshToken = signRefreshToken(payload, 604800); // 7 days

    await UserDB.updateUserAsync(user.id, { refreshToken });
    AuditLogger.logEvent('REGISTER', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

    const response = NextResponse.json({
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: payload,
    });

    response.cookies.set('figm_token', accessToken, {
      httpOnly: true,
      path: '/',
      maxAge: 3600,
      sameSite: 'lax',
    });

    response.cookies.set('figm_refresh_token', refreshToken, {
      httpOnly: true,
      path: '/',
      maxAge: 604800,
      sameSite: 'lax',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
