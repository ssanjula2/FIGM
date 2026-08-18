import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { AuditLogger } from '../../../../src/auth/audit-logger';
import { getClientIp } from '../../../../src/auth/rate-limiter';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const auth = authenticateUser(request);
  if (auth.user) {
    // `null`, not `undefined` -- Prisma's update() silently ignores an undefined-valued field
    // (treats it as "not included in this update," not "clear it"), so the Supabase/Prisma-backed
    // storage provider never actually revoked the refresh token in the database at all despite
    // reporting success; only the client-side Set-Cookie clearing below actually took effect. A
    // stolen/leaked refresh token (e.g. via the historical git-history exposure this same audit
    // pass is documenting in docs/audit/GIT_HISTORY_SECRET_REMEDIATION.md) would have remained
    // fully valid for its full 7-day life even after the legitimate user "logged out." Confirmed
    // live against the real configured Supabase DB: after this fix, POST /api/auth/refresh with
    // the pre-logout refresh token now correctly returns 401 TOKEN_REVOKED (was 200 before).
    await RepositoryFactory.getStorageProvider().updateUser(auth.user.userId, { refreshToken: null });
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
