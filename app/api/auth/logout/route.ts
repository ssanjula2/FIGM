import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const auth = authenticateUser(request);
  if (auth.user) {
    await RepositoryFactory.getStorageProvider().updateUser(auth.user.userId, { refreshToken: undefined });
    await AuditLogger.logEvent('LOGOUT', { userId: auth.user.userId, email: auth.user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });
  } else {
    await AuditLogger.logEvent('LOGOUT', { ipAddress: ip, userAgent, status: 'SUCCESS', details: 'Unauthenticated logout request' });
  }

  const response = NextResponse.json({ message: 'Logout successful' });

  // Clear HTTP-only cookies
  response.cookies.set('figm_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  response.cookies.set('figm_refresh_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
