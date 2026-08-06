import { NextResponse } from 'next/server';
import {
  verifyPassword,
  signJWT,
  signRefreshToken,
  validateEmail,
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
    const { email, password } = body;

    if (!validateEmail(email) || !password) {
      AuditLogger.logEvent('LOGIN', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Missing or invalid fields' });
      return NextResponse.json(
        { error: 'Valid email and password are required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const user = UserDB.findUserByEmail(email);
    if (!user) {
      AuditLogger.logEvent('LOGIN', { email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'User not found' });
      return NextResponse.json(
        { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      AuditLogger.logEvent('LOGIN', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'FAILURE', details: 'Password mismatch' });
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

    UserDB.updateUser(user.id, {
      refreshToken,
      lastLoginAt: new Date().toISOString(),
    });

    // Explicit synchronous write-through to Supabase PostgreSQL Database for login audit
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(url, key, { auth: { persistSession: false } });
        await supabase.from('users').update({
          refresh_token: refreshToken,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      }
    } catch (dbErr: any) {
      console.error('Supabase login sync error:', dbErr.message);
    }

    AuditLogger.logEvent('LOGIN', { userId: user.id, email: user.email, ipAddress: ip, userAgent, status: 'SUCCESS' });

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
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
