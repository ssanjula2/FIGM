import { NextResponse } from 'next/server';
import {
  hashPassword,
  signJWT,
  signRefreshToken,
  validateEmail,
  validatePassword,
} from '../../../../src/auth/auth-service';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 10, 60000);
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const provider = RepositoryFactory.getStorageProvider();

  try {
    const body = await request.json();
    const { email, password, fullName, role } = body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      await AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid full name' });
      return NextResponse.json({ error: 'Full name must be at least 2 characters long', code: 'INVALID_NAME' }, { status: 400 });
    }

    if (!validateEmail(email)) {
      await AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid email format' });
      return NextResponse.json({ error: 'Please provide a valid email address', code: 'INVALID_EMAIL' }, { status: 400 });
    }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      await AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: passCheck.message });
      return NextResponse.json({ error: passCheck.message, code: 'WEAK_PASSWORD' }, { status: 400 });
    }

    const existing = await provider.findUserByEmail(email);
    if (existing) {
      await AuditLogger.logEvent('REGISTER', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Email already registered' });
      return NextResponse.json({ error: 'An account with this email address already exists', code: 'EMAIL_EXISTS' }, { status: 409 });
    }

    // Public self-registration may only create DEVELOPER or AUDITOR accounts (the two options the
    // signup form itself offers) -- ADMIN can only be granted by an existing ADMIN via the
    // role-gated PATCH /api/admin/users endpoint. A prior version of this route accepted the raw
    // client-supplied `role` field via validateRole(), which itself allows 'ADMIN' too, letting
    // anyone self-register as an administrator by sending role:"ADMIN" directly to the API.
    const assignedRole = role === 'AUDITOR' ? 'AUDITOR' : 'DEVELOPER';
    const passwordHash = hashPassword(password);
    const user = await provider.createUser({ email, passwordHash, fullName, role: assignedRole });

    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const accessToken = signJWT(payload, 3600); // 1 hour
    const refreshToken = signRefreshToken(payload, 604800); // 7 days

    await provider.updateUser(user.id, { refreshToken });
    await AuditLogger.logEvent('REGISTER', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

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
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
