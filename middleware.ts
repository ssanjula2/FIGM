import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCorsHeaders } from './src/lib/cors';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // CORS applies uniformly to every /api/* request, independent of the page-route auth gating
  // below. Handled first so it also covers preflight OPTIONS requests, which never reach a
  // route handler (none of the API routes export an OPTIONS method).
  if (path.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Define public paths that don't require authentication
  const isPublicPath =
    path === '/' ||
    path.startsWith('/auth/') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico';

  const token = request.cookies.get('figm_token')?.value;

  // Redirect unauthenticated users trying to access protected page routes. (API routes are
  // exempt from this check by design -- see the /api/ branch above, which returns before this
  // point is ever reached for API requests. API authorization/authentication is enforced per
  // route via src/auth/auth-middleware.ts's authenticateUser()/authorizeRole(), since which
  // endpoints require auth vs. are intentionally public is a route-by-route decision, not a
  // blanket one this middleware should make.)
  if (!isPublicPath && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/register pages
  if (path.startsWith('/auth/login') || path.startsWith('/auth/register')) {
    if (token) {
      return NextResponse.redirect(new URL('/guidelines', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/submissions/:path*',
    '/profile/:path*',
    '/analytics/:path*',
    '/auth/:path*',
    '/api/:path*',
  ],
};
