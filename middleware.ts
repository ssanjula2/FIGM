import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Define public paths that don't require authentication
  const isPublicPath =
    path === '/' ||
    path.startsWith('/auth/') ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico';

  const token = request.cookies.get('figm_token')?.value;

  // Redirect unauthenticated users trying to access protected routes
  if (!isPublicPath && !token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized access', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
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
  ],
};
