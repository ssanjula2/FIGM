import { NextResponse } from 'next/server';
import { verifyRefreshToken, signJWT, signRefreshToken } from '../../../../src/auth/auth-service';
import { RepositoryFactory } from '../../../../src/storage/repository-factory';
import { checkRateLimit, getClientIp } from '../../../../src/auth/rate-limiter';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitError = await checkRateLimit(ip, 20, 60000);
  if (rateLimitError) return rateLimitError;

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const provider = RepositoryFactory.getStorageProvider();

  try {
    let token: string | undefined;

    // Check body or cookie for refresh token
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/figm_refresh_token=([^;]+)/);
    if (match) {
      token = match[1];
    }

    if (!token) {
      try {
        const body = await request.json();
        token = body.refreshToken;
      } catch {
        // Body reading fallback
      }
    }

    if (!token) {
      await AuditLogger.logEvent('REFRESH_TOKEN', { ipAddress: ip, userAgent, status: 'FAILURE', details: 'Missing refresh token' });
      return NextResponse.json(
        { error: 'Refresh token is required', code: 'MISSING_REFRESH_TOKEN' },
        { status: 400 }
      );
    }

    const payload = verifyRefreshToken(token);
    if (!payload) {
      await AuditLogger.logEvent('REFRESH_TOKEN', { ipAddress: ip, userAgent, status: 'FAILURE', details: 'Invalid or expired refresh token' });
      return NextResponse.json(
        { error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    const user = await provider.findUserById(payload.userId);
    if (!user || user.refreshToken !== token) {
      await AuditLogger.logEvent('REFRESH_TOKEN', { userId: payload.userId, email: payload.email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Token revoked or user mismatch' });
      return NextResponse.json(
        { error: 'Refresh token has been revoked', code: 'TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    const userPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role || 'DEVELOPER',
    };

    const newAccessToken = signJWT(userPayload, user.tokenVersion ?? 0, 3600);
    const newRefreshToken = signRefreshToken(userPayload, 604800);

    await provider.updateUser(user.id, { refreshToken: newRefreshToken });
    await AuditLogger.logEvent('REFRESH_TOKEN', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

    const response = NextResponse.json({
      message: 'Token refreshed successfully',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: userPayload,
    });

    response.cookies.set('figm_token', newAccessToken, {
      httpOnly: true,
      path: '/',
      maxAge: 3600,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    response.cookies.set('figm_refresh_token', newRefreshToken, {
      httpOnly: true,
      path: '/',
      maxAge: 604800,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token refresh failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
