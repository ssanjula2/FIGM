import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { UserDB } from '../../../../src/auth/user-db';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const auth = authenticateUser(request);
  if (auth.user) {
    UserDB.updateUser(auth.user.userId, { refreshToken: undefined });
    AuditLogger.logEvent('LOGOUT', { userId: auth.user.userId, email: auth.user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });
  } else {
    AuditLogger.logEvent('LOGOUT', { ipAddress: ip, userAgent, status: 'SUCCESS', details: 'Unauthenticated logout request' });
  }

  const response = NextResponse.json({ message: 'Logout successful' });

  // Clear HTTP-only cookies
  response.cookies.set('figm_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });

  response.cookies.set('figm_refresh_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });

  return response;
}
