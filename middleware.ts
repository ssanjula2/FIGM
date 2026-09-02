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

  // Public paths that don't require authentication. The application's product requirement is
  // "login/register first" -- every page route other than the auth flow itself and the public
  // research/about page requires a session. (Previously only a hand-maintained allow-list of
  // routes -- /admin, /submissions, /profile, /analytics, /auth -- was gated via the matcher
  // below, which meant every other page, including the homepage and the main app surfaces
  // (live-scan, history, projects, guidelines, ...), was reachable unauthenticated. That gap is
  // closed by making this an authenticated-by-default matcher instead: see `config.matcher`.)
  const isPublicPath =
    path === '/login' ||
    path === '/register' ||
    path === '/forgot-password' ||
    path.startsWith('/auth/') ||
    path === '/about' ||
    // Published research evidence artifacts (benchmark CSV/MD/tex under public/eval-results/) --
    // intentionally fetchable without an account, same rationale as the public /api/research-
    // metrics endpoint (see the API route matrix in the forensic audit): they're evidence for an
    // external reviewer, not application data.
    path.startsWith('/eval-results/') ||
    // RQ1 FCP/TTI experiment fixture pages (docs/research/RQ1_EXPERIMENT_PROTOCOL.md) -- these
    // are minimal, isolated research fixtures navigated to by an unauthenticated Lighthouse/
    // chrome-launcher process (research/rq1-experiment/scripts/run-experiment.ts), not
    // application surfaces; gating them behind login would make the measured page include an
    // auth redirect in every run, confounding the very metric being measured.
    path.startsWith('/rq1-experiment') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path === '/icon.svg';

  const token = request.cookies.get('figm_token')?.value;

  // Redirect unauthenticated users trying to access protected page routes. (API routes are
  // exempt from this check by design -- see the /api/ branch above, which returns before this
  // point is ever reached for API requests. API authorization/authentication is enforced per
  // route via src/auth/auth-middleware.ts's authenticateUser()/authorizeRole(), since which
  // endpoints require auth vs. are intentionally public is a route-by-route decision, not a
  // blanket one this middleware should make.)
  if (!isPublicPath && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    if (path !== '/') loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from the login/register/forgot-password pages (both the
  // canonical /auth/* implementations and the top-level redirect stubs) straight to the
  // authenticated application instead of bouncing through the stub first.
  const isAuthPage =
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path === '/login' ||
    path === '/register';
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next.js internals and static assets -- see isPublicPath above for the
  // actual allow-list of routes that don't require a session. A negative matcher (rather than a
  // hand-maintained positive list of protected routes) means a newly-added page is
  // authenticated-by-default instead of silently public until someone remembers to add it here.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
